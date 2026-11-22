import { Type } from '@google/genai'
import { containsPotentialPii, getGeminiClient, getLevelPedagogyPrompt } from '../_lib/geminiClient'
import { readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/httpTypes'
import { getServerSupabaseAdmin, verifyParentBearer } from '../_lib/serverSupabase'

interface BuddyHistoryTurn {
  role: 'child' | 'buddy'
  text: string
}

interface BuddyRequestBody {
  childId?: string
  lessonId?: string
  levelId?: string
  lessonTitle?: string
  lessonWords?: string[]
  lessonPhrases?: string[]
  message?: string
  audioBase64?: string
  audioMimeType?: string
  history?: BuddyHistoryTurn[]
  wantTtsAudio?: boolean
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const ai = getGeminiClient()
  if (!ai) {
    sendJson(res, 503, {
      error:
        'AI English Buddy chưa sẵn sàng vì máy chủ/Vercel chưa cấu hình GEMINI_API_KEY.',
      missingEnv: ['GEMINI_API_KEY'],
    })
    return
  }

  let body: BuddyRequestBody
  try {
    body = await readJsonBody<BuddyRequestBody>(req)
  } catch {
    sendJson(res, 400, { error: 'Dữ liệu gửi lên không hợp lệ.' })
    return
  }

  const levelId = ['L1', 'L2', 'L3', 'L4'].includes(body.levelId ?? '')
    ? String(body.levelId)
    : 'L1'
  const lessonTitle = String(body.lessonTitle ?? 'English Lesson').slice(0, 120)
  const lessonWords = Array.isArray(body.lessonWords)
    ? body.lessonWords.slice(0, 12).map((w) => String(w).slice(0, 40))
    : []
  const lessonPhrases = Array.isArray(body.lessonPhrases)
    ? body.lessonPhrases.slice(0, 8).map((p) => String(p).slice(0, 80))
    : []

  // Server-side parent auth, child ownership, consent, and daily turn cap verification
  const admin = getServerSupabaseAdmin()
  let verifiedParentId: string | null = null
  let turnsRemainingToday: number | undefined

  if (admin) {
    const authUser = await verifyParentBearer(req.headers.authorization)
    if (!authUser) {
      sendJson(res, 401, {
        error: 'Phụ huynh cần đăng nhập tài khoản để sử dụng AI English Buddy.',
      })
      return
    }
    verifiedParentId = authUser.userId

    if (!body.childId) {
      sendJson(res, 400, { error: 'Vui lòng chọn hồ sơ trẻ trước khi trò chuyện với AI.' })
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
        error: 'Phụ huynh chưa bật quyền sử dụng AI cho hồ sơ trẻ này trong Góc phụ huynh.',
      })
      return
    }

    const { data: consentRow } = await admin
      .from('parent_consents')
      .select('id')
      .eq('parent_id', verifiedParentId)
      .eq('consent_type', 'ai_buddy')
      .is('revoked_at', null)
      .limit(1)
      .maybeSingle()

    if (!consentRow) {
      sendJson(res, 403, {
        error: 'Cần xác nhận đồng ý sử dụng AI cho trẻ trong Góc phụ huynh trước khi bật tính năng này.',
      })
      return
    }

    // Check daily turn cap across today's sessions
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
        error: `Bé đã dùng hết ${dailyLimit} lượt AI hôm nay để bảo vệ mắt và thời gian nghỉ ngơi nhé!`,
      })
      return
    }
    turnsRemainingToday = Math.max(0, dailyLimit - usedToday - 1)
  }

  let childText = (body.message ?? '').trim().slice(0, 280)

  // Step 1: Optional audio transcription (ephemeral, never persisted)
  if (!childText && body.audioBase64 && body.audioMimeType) {
    if (body.audioBase64.length > 2_800_000) {
      sendJson(res, 400, { error: 'Đoạn ghi âm quá dài, bé hãy nói ngắn hơn (dưới 12 giây) nhé.' })
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
              text: 'Transcribe the child speaking in English (or Vietnamese) accurately and concisely.',
            },
          ],
        },
      })
      childText = (transcribeRes.text ?? '').trim().slice(0, 280)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Audio transcription error'
      sendJson(res, 502, { error: `Không thể xử lý đoạn ghi âm: ${msg}` })
      return
    }
  }

  if (!childText) {
    sendJson(res, 400, { error: 'Bé hãy nhập câu nói hoặc nói vào micro nhé.' })
    return
  }

  // Step 2: Child safety PII pre-check
  if (containsPotentialPii(childText)) {
    const safeReply = {
      childTranscript: childText,
      englishReply: "Let's keep personal info private! Can you tell me a word from our lesson instead?",
      vietnameseHint:
        'Để giữ an toàn cho bé, mình không chia sẻ thông tin cá nhân nhé. Bé thử nói một từ trong bài học nào!',
      followUpQuestion: lessonWords[0]
        ? `Can you say "${lessonWords[0]}"?`
        : 'What is your favorite word today?',
      safetyRedirected: true,
      turnsRemainingToday,
    }
    sendJson(res, 200, safeReply)
    return
  }

  const recentHistory = Array.isArray(body.history)
    ? body.history
        .slice(-6)
        .map((h) => `${h.role === 'child' ? 'Child' : 'Buddy'}: ${String(h.text).slice(0, 180)}`)
        .join('\n')
    : ''

  const systemInstruction = [
    'You are "Little Buddy", a warm, patient English learning companion for children aged 3 to 11.',
    `Pedagogy level: ${getLevelPedagogyPrompt(levelId)}`,
    `Current lesson topic: "${lessonTitle}".`,
    lessonWords.length > 0 ? `Focus words: ${lessonWords.join(', ')}.` : '',
    lessonPhrases.length > 0 ? `Focus phrases: ${lessonPhrases.join(' | ')}.` : '',
    'STRICT CHILD SAFETY & SCOPE RULES:',
    '1. Stay strictly on the lesson topic or simple kid-friendly greetings.',
    '2. NEVER ask for or repeat personal data (real full name, home address, phone number, school name, family details).',
    '3. If the child asks something unrelated, unsafe, or personal, gently redirect back to the lesson words/topic.',
    '4. Never pressure the child or assign numeric pronunciation/CEFR scores.',
    '5. Keep englishReply under 2 short sentences and include a simple followUpQuestion.',
    '6. Provide vietnameseHint (1 brief encouraging sentence in Vietnamese for child/parent clarity).',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const chatRes = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        recentHistory ? `Recent turns:\n${recentHistory}` : '',
        `Child says: "${childText}"`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            englishReply: { type: Type.STRING },
            vietnameseHint: { type: Type.STRING },
            followUpQuestion: { type: Type.STRING },
            safetyRedirected: { type: Type.BOOLEAN },
          },
          required: ['englishReply', 'vietnameseHint', 'followUpQuestion', 'safetyRedirected'],
        },
      },
    })

    const parsed = JSON.parse((chatRes.text ?? '{}').trim()) as {
      englishReply?: string
      vietnameseHint?: string
      followUpQuestion?: string
      safetyRedirected?: boolean
    }

    const englishReply = (parsed.englishReply || 'Great job! Let us practice together!').trim()
    const followUpQuestion = (parsed.followUpQuestion || '').trim()
    const vietnameseHint = (parsed.vietnameseHint || 'Bé làm tốt lắm! Hãy thử trả lời tiếp nhé.').trim()
    const safetyRedirected = Boolean(parsed.safetyRedirected)

    // Step 3: Optional TTS audio response using gemini-3.8-flash-lite-tts
    let audioBase64: string | undefined
    let audioMimeType: string | undefined

    if (body.wantTtsAudio) {
      try {
        const spokenPrompt = followUpQuestion ? `${englishReply} ${followUpQuestion}` : englishReply
        const ttsRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: spokenPrompt,
                  speechMetadata: {
                    style: 'Warm, cheerful, slow and clear English teacher speaking to a young child',
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
        // Non-fatal: client falls back cleanly to browser Web Speech if TTS quota/network fails
      }
    }

    // Step 4: Log turn usage in Supabase (no raw audio or child PII stored)
    if (admin && verifiedParentId && body.childId) {
      await admin.from('ai_sessions').insert({
        parent_id: verifiedParentId,
        child_id: body.childId,
        lesson_id: body.lessonId ?? null,
        level_id: levelId,
        mode: 'buddy',
        turns_used: 1,
        safety_flagged: safetyRedirected,
      })
    }

    sendJson(res, 200, {
      childTranscript: childText,
      englishReply,
      vietnameseHint,
      followUpQuestion,
      safetyRedirected,
      audioBase64,
      audioMimeType,
      turnsRemainingToday,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini request failed'
    sendJson(res, 502, { error: `Không thể kết nối AI English Buddy: ${msg}` })
  }
}
