import { Type } from '@google/genai'
import { getGeminiClient, getLevelPedagogyPrompt } from '../_lib/geminiClient'
import { readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/httpTypes'
import { getServerSupabaseAdmin, verifyParentBearer } from '../_lib/serverSupabase'

interface PronunciationRequestBody {
  childId?: string
  lessonId?: string
  levelId?: string
  targetText?: string
  recognizedText?: string
  audioBase64?: string
  audioMimeType?: string
  wantModelAudio?: boolean
}

const ALLOWED_LABELS = [
  'Great pronunciation!',
  'Good try!',
  'Listen carefully!',
  "Let's try again!",
] as const

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const ai = getGeminiClient()
  if (!ai) {
    sendJson(res, 503, {
      error:
        'Chức năng AI luyện phát âm chưa sẵn sàng vì máy chủ/Vercel chưa cấu hình GEMINI_API_KEY.',
      missingEnv: ['GEMINI_API_KEY'],
    })
    return
  }

  let body: PronunciationRequestBody
  try {
    body = await readJsonBody<PronunciationRequestBody>(req)
  } catch {
    sendJson(res, 400, { error: 'Dữ liệu gửi lên không hợp lệ.' })
    return
  }

  const targetText = String(body.targetText ?? '').trim().slice(0, 160)
  if (!targetText) {
    sendJson(res, 400, { error: 'Thiếu từ hoặc câu mẫu cần luyện.' })
    return
  }

  const levelId = ['L1', 'L2', 'L3', 'L4'].includes(body.levelId ?? '')
    ? String(body.levelId)
    : 'L1'

  const admin = getServerSupabaseAdmin()
  let verifiedParentId: string | null = null
  let turnsRemainingToday: number | undefined

  if (admin) {
    const authUser = await verifyParentBearer(req.headers.authorization)
    if (!authUser) {
      sendJson(res, 401, {
        error: 'Phụ huynh cần đăng nhập để sử dụng AI luyện phát âm.',
      })
      return
    }
    verifiedParentId = authUser.userId

    if (!body.childId) {
      sendJson(res, 400, { error: 'Vui lòng chọn hồ sơ trẻ trước khi luyện nói.' })
      return
    }

    const { data: childRow, error: childErr } = await admin
      .from('child_profiles')
      .select('id, parent_id, ai_enabled, ai_daily_limit')
      .eq('id', body.childId)
      .eq('parent_id', verifiedParentId)
      .maybeSingle()

    if (childErr || !childRow) {
      sendJson(res, 403, { error: 'Không có quyền truy cập hồ sơ trẻ này.' })
      return
    }

    if (!childRow.ai_enabled) {
      sendJson(res, 403, {
        error: 'Phụ huynh chưa bật quyền sử dụng AI cho hồ sơ trẻ này.',
      })
      return
    }

    const { data: consentRow } = await admin
      .from('parent_consents')
      .select('id')
      .eq('parent_id', verifiedParentId)
      .in('consent_type', ['ai_buddy', 'speech_practice'])
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle()

    if (!consentRow) {
      sendJson(res, 403, {
        error: 'Cần xác nhận đồng ý sử dụng AI/luyện phát âm cho trẻ trong Góc phụ huynh trước.',
      })
      return
    }

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const { data: todaySessions } = await admin
      .from('ai_sessions')
      .select('turns_used')
      .eq('child_id', body.childId)
      .gte('created_at', todayStart.toISOString())

    const usedToday = (todaySessions ?? []).reduce(
      (sum, row) => sum + (typeof row.turns_used === 'number' ? row.turns_used : 0),
      0
    )
    const dailyLimit = typeof childRow.ai_daily_limit === 'number' ? childRow.ai_daily_limit : 15
    if (usedToday >= dailyLimit) {
      sendJson(res, 429, {
        error: `Bé đã hoàn thành ${dailyLimit} lượt luyện AI hôm nay rồi nhé!`,
      })
      return
    }
    turnsRemainingToday = Math.max(0, dailyLimit - usedToday - 1)
  }

  let recognizedText = (body.recognizedText ?? '').trim().slice(0, 180)

  if (!recognizedText && body.audioBase64 && body.audioMimeType) {
    if (body.audioBase64.length > 2_500_000) {
      sendJson(res, 400, { error: 'Bản ghi âm quá dài, bé hãy nói ngắn hơn nhé.' })
      return
    }
    try {
      const transcribeRes = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: body.audioMimeType,
                data: body.audioBase64,
              },
            },
            {
              text: `Transcribe the child attempting to say the English phrase "${targetText}". Return only what was heard.`,
            },
          ],
        },
      })
      recognizedText = (transcribeRes.text ?? '').trim().slice(0, 180)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audio transcription error'
      sendJson(res, 502, { error: `Không thể phân tích âm thanh lúc này: ${msg}` })
      return
    }
  }

  if (!recognizedText) {
    sendJson(res, 400, { error: 'Chưa nghe rõ giọng của bé, bé hãy bấm ghi âm và nói lại gần micro nhé.' })
    return
  }

  const systemInstruction = [
    'You are a warm, encouraging English pronunciation helper for children.',
    getLevelPedagogyPrompt(levelId),
    'IMPORTANT RULES:',
    '1. Do NOT invent numeric pronunciation scores, percentages, IELTS/CEFR band claims, or claim certified speech assessment.',
    '2. Choose encouragementLabel strictly from: "Great pronunciation!", "Good try!", "Listen carefully!", "Let\'s try again!".',
    '3. Keep feedbackEn very short (1 sentence). Keep feedbackVi warm and supportive for parent and child.',
    '4. Give 1 simple, practical tipVi (e.g., focus on the ending sound or speak slowly).',
  ].join('\n')

  try {
    const evalRes = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Target English phrase: "${targetText}"\nHeard/recognized speech: "${recognizedText}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            encouragementLabel: { type: Type.STRING },
            feedbackEn: { type: Type.STRING },
            feedbackVi: { type: Type.STRING },
            tipVi: { type: Type.STRING },
          },
          required: ['encouragementLabel', 'feedbackEn', 'feedbackVi', 'tipVi'],
        },
      },
    })

    const parsed = JSON.parse((evalRes.text ?? '{}').trim()) as {
      encouragementLabel?: string
      feedbackEn?: string
      feedbackVi?: string
      tipVi?: string
    }

    const label = ALLOWED_LABELS.includes(
      parsed.encouragementLabel as (typeof ALLOWED_LABELS)[number]
    )
      ? (parsed.encouragementLabel as (typeof ALLOWED_LABELS)[number])
      : 'Good try!'

    let audioBase64: string | undefined
    let audioMimeType: string | undefined
    if (body.wantModelAudio) {
      try {
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: targetText,
                  speechMetadata: {
                    style: 'Clear, gentle, slightly slow pronunciation model for children',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        })
        const rawAudio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
        if (rawAudio) {
          audioBase64 = rawAudio
          audioMimeType = 'audio/wav'
        }
      } catch {
        // Ignore TTS failure; Web Speech fallback works
      }
    }

    if (admin && verifiedParentId && body.childId) {
      await Promise.all([
        admin.from('ai_sessions').insert({
          parent_id: verifiedParentId,
          child_id: body.childId,
          lesson_id: body.lessonId ?? null,
          level_id: levelId,
          mode: 'pronunciation',
          turns_used: 1,
          safety_flagged: false,
        }),
        admin.from('pronunciation_records').insert({
          parent_id: verifiedParentId,
          child_id: body.childId,
          lesson_id: body.lessonId ?? null,
          target_text: targetText,
          recognized_text: recognizedText,
          feedback_label: label,
          feedback_en: parsed.feedbackEn || label,
          feedback_vi: parsed.feedbackVi || 'Bé đã rất cố gắng, cùng nghe lại mẫu nhé!',
        }),
      ])
    }

    sendJson(res, 200, {
      recognizedText,
      targetText,
      encouragementLabel: label,
      feedbackEn: parsed.feedbackEn || label,
      feedbackVi: parsed.feedbackVi || 'Bé đã thử rất tốt! Hãy nghe lại mẫu chuẩn và đọc cùng nhé.',
      tipVi: parsed.tipVi || 'Nói chậm rãi và rõ từng âm cuối.',
      audioBase64,
      audioMimeType,
      turnsRemainingToday,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Pronunciation feedback failed'
    sendJson(res, 502, { error: `Không thể nhận phản hồi phát âm lúc này: ${msg}` })
  }
}
