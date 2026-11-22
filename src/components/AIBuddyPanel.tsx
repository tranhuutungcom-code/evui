import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Lock,
  Mic,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  requestAiPronunciationFeedback,
  sendAiBuddyTurn,
} from '../services/aiService'
import type { Lesson, Level } from '../types/curriculum'
import type {
  AIBuddyMessage,
  ChildProfile,
  PronunciationFeedbackResult,
} from '../types/platform'
import type { RouteState } from '../utils/router'
import { speakEnglish } from '../utils/speech'

interface AIBuddyPanelProps {
  level: Level
  lesson: Lesson
  activeChild: ChildProfile | null
  hasAiConsent: boolean
  isAuthenticated: boolean
  onNavigate: (route: RouteState) => void
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(new Error('Không đọc được tệp âm thanh.'))
    reader.readAsDataURL(blob)
  })
}

export function AIBuddyPanel({
  level,
  lesson,
  activeChild,
  hasAiConsent,
  isAuthenticated,
  onNavigate,
}: AIBuddyPanelProps) {
  const [tab, setTab] = useState<'buddy' | 'pronunciation'>('buddy')
  const [messages, setMessages] = useState<AIBuddyMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [turnsRemaining, setTurnsRemaining] = useState<number | undefined>(
    undefined
  )
  const [recordingMode, setRecordingMode] = useState<
    'idle' | 'buddy' | 'pronunciation'
  >('idle')
  const [targetPhrase, setTargetPhrase] = useState(
    lesson.phrases[0]?.en ?? lesson.words[0]?.word ?? 'Hello!'
  )
  const [pronResult, setPronResult] =
    useState<PronunciationFeedbackResult | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setMessages([])
    setInputText('')
    setErrorMsg('')
    setPronResult(null)
    setTargetPhrase(
      lesson.phrases[0]?.en ?? lesson.words[0]?.word ?? 'Hello!'
    )
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
        activeAudioRef.current = null
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [lesson.id, lesson.phrases, lesson.words])

  const playResponseAudio = (
    audioBase64?: string,
    mimeType?: string,
    fallbackText?: string
  ) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }
    if (audioBase64 && mimeType) {
      try {
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`)
        activeAudioRef.current = audio
        audio.play().catch(() => {
          if (fallbackText) speakEnglish(fallbackText, { levelId: level.id })
        })
        return
      } catch {
        // Fallback below
      }
    }
    if (fallbackText) {
      speakEnglish(fallbackText, { levelId: level.id })
    }
  }

  // Parent safety lock checks when Supabase account mode is active
  const requiresParentActivation =
    isSupabaseConfigured &&
    (!isAuthenticated ||
      !activeChild ||
      !activeChild.aiEnabled ||
      !hasAiConsent)

  const submitBuddyTurn = async (payload: {
    text?: string
    audioBase64?: string
    audioMimeType?: string
  }) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        text: m.englishText,
      }))

      const res = await sendAiBuddyTurn({
        childId: activeChild?.id,
        lessonId: lesson.id,
        levelId: level.id,
        lessonTitle: lesson.title,
        lessonWords: lesson.words.map((w) => w.word),
        lessonPhrases: lesson.phrases.map((p) => p.en),
        message: payload.text,
        audioBase64: payload.audioBase64,
        audioMimeType: payload.audioMimeType,
        history: historyPayload,
        wantTtsAudio: true,
      })

      const childMsg: AIBuddyMessage = {
        id: `c-${Date.now()}`,
        role: 'child',
        englishText: res.childTranscript,
        createdAt: new Date().toISOString(),
      }
      const buddyMsg: AIBuddyMessage = {
        id: `b-${Date.now() + 1}`,
        role: 'buddy',
        englishText: res.englishReply,
        vietnameseHint: res.vietnameseHint,
        followUpQuestion: res.followUpQuestion,
        audioBase64: res.audioBase64,
        audioMimeType: res.audioMimeType,
        safetyRedirected: res.safetyRedirected,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, childMsg, buddyMsg])
      setInputText('')
      if (typeof res.turnsRemainingToday === 'number') {
        setTurnsRemaining(res.turnsRemainingToday)
      }

      const spokenText = res.followUpQuestion
        ? `${res.englishReply} ${res.followUpQuestion}`
        : res.englishReply
      playResponseAudio(res.audioBase64, res.audioMimeType, spokenText)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể kết nối AI Buddy.'
      )
    } finally {
      setLoading(false)
    }
  }

  const submitPronunciationClip = async (
    audioBase64: string,
    audioMimeType: string
  ) => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await requestAiPronunciationFeedback({
        childId: activeChild?.id,
        lessonId: lesson.id,
        levelId: level.id,
        targetText: targetPhrase,
        audioBase64,
        audioMimeType,
        wantModelAudio: true,
      })
      setPronResult(res)
      if (typeof res.turnsRemainingToday === 'number') {
        setTurnsRemaining(res.turnsRemainingToday)
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể gửi đoạn nói để nhận phản hồi.'
      )
    } finally {
      setLoading(false)
    }
  }

  const startVoiceRecording = async (mode: 'buddy' | 'pronunciation') => {
    setErrorMsg('')
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setErrorMsg(
        'Trình duyệt chưa hỗ trợ ghi âm micro trực tiếp. Bé có thể chọn câu gợi ý hoặc gõ chữ nhé.'
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream)

      chunksRef.current = []
      mediaRecorderRef.current = recorder
      setRecordingMode(mode)

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecordingMode('idle')
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 300) {
          setErrorMsg('Đoạn ghi âm quá ngắn, bé hãy bấm và nói rõ hơn nhé.')
          return
        }
        try {
          const base64 = await blobToBase64(blob)
          if (mode === 'buddy') {
            await submitBuddyTurn({ audioBase64: base64, audioMimeType: mimeType })
          } else {
            await submitPronunciationClip(base64, mimeType)
          }
        } catch (err) {
          setErrorMsg(
            err instanceof Error ? err.message : 'Lỗi xử lý âm thanh ghi âm.'
          )
        }
      }

      recorder.start()
    } catch {
      setRecordingMode('idle')
      setErrorMsg(
        'Chưa được cấp quyền Micro. Ba mẹ hãy cho phép truy cập micro trên trình duyệt nhé.'
      )
    }
  }

  const stopVoiceRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }
  }

  const quickSuggestions = [
    ...lesson.phrases.map((p) => p.en),
    ...lesson.words.slice(0, 3).map((w) => w.word),
  ].slice(0, 5)

  return (
    <section className="ai-buddy-section" aria-label="AI English Buddy">
      <div className="ai-buddy-header">
        <div>
          <p className="step-label">04 / AI Đồng hành cùng bé (Text + Audio)</p>
          <h3>
            <Bot size={22} aria-hidden="true" />
            <span>AI English Buddy</span>
          </h3>
        </div>
        {typeof turnsRemaining === 'number' && (
          <span className="ai-quota-badge tabular-nums">
            Còn {turnsRemaining} lượt hôm nay
          </span>
        )}
      </div>

      <div className="ai-safety-strip">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>
          Giới hạn theo chủ đề bài học · Không thu thập thông tin cá nhân · Âm
          thanh xử lý tức thời, không lưu trữ lâu dài.
        </span>
      </div>

      {requiresParentActivation ? (
        <div className="ai-locked-card">
          <Lock size={22} aria-hidden="true" />
          <div>
            <h4>Tính năng AI đang chờ phụ huynh kích hoạt</h4>
            <p>
              {!isAuthenticated
                ? 'Phụ huynh hãy đăng nhập tài khoản, chọn hồ sơ trẻ và bật quyền sử dụng AI trong Góc phụ huynh để bé trò chuyện an toàn cùng AI Buddy.'
                : !activeChild
                  ? 'Hãy chọn hoặc tạo một hồ sơ trẻ trong Góc phụ huynh trước khi mở AI Buddy.'
                  : !hasAiConsent
                    ? 'Phụ huynh cần xác nhận đồng ý quy tắc an toàn AI cho trẻ trong mục An toàn & AI.'
                    : `AI English Buddy đang tắt cho hồ sơ "${activeChild.nickname}". Phụ huynh có thể bật lại bất kỳ lúc nào.`}
            </p>
            <button
              type="button"
              className="outline-btn"
              onClick={() => onNavigate({ page: 'parent' })}
            >
              <span>Mở Góc phụ huynh để cài đặt</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ai-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'buddy'}
              className={tab === 'buddy' ? 'active' : ''}
              onClick={() => setTab('buddy')}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>Hội thoại cùng Buddy</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'pronunciation'}
              className={tab === 'pronunciation' ? 'active' : ''}
              onClick={() => setTab('pronunciation')}
            >
              <Mic size={16} aria-hidden="true" />
              <span>Luyện nói &amp; Phản hồi</span>
            </button>
          </div>

          {tab === 'buddy' ? (
            <div className="ai-buddy-chat">
              <div className="ai-chat-feed" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="ai-empty-chat">
                    <p>
                      Chào {activeChild ? activeChild.nickname : 'bé'}! Mình là{' '}
                      <strong>Little Buddy</strong>. Hãy chạm một gợi ý bên dưới
                      hoặc bấm micro nói về bài{' '}
                      <strong lang="en">&ldquo;{lesson.title}&rdquo;</strong> nhé!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`ai-bubble ${msg.role === 'child' ? 'is-child' : 'is-buddy'}`}
                    >
                      <div className="ai-bubble-top">
                        <strong>
                          {msg.role === 'child'
                            ? activeChild?.nickname ?? 'Bé'
                            : 'Little Buddy'}
                        </strong>
                        {msg.role === 'buddy' && (
                          <button
                            type="button"
                            className="ai-replay-btn"
                            aria-label="Nghe lại câu trả lời của Buddy"
                            onClick={() =>
                              playResponseAudio(
                                msg.audioBase64,
                                msg.audioMimeType,
                                msg.followUpQuestion
                                  ? `${msg.englishText} ${msg.followUpQuestion}`
                                  : msg.englishText
                              )
                            }
                          >
                            <Volume2 size={16} aria-hidden="true" />
                            <span>Nghe</span>
                          </button>
                        )}
                      </div>
                      <p className="ai-en-text" lang="en">
                        {msg.englishText}
                      </p>
                      {msg.followUpQuestion && (
                        <p className="ai-followup" lang="en">
                          {msg.followUpQuestion}
                        </p>
                      )}
                      {msg.vietnameseHint && (
                        <p className="ai-vi-hint">{msg.vietnameseHint}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="ai-suggestions">
                {quickSuggestions.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    lang="en"
                    disabled={loading}
                    onClick={() => submitBuddyTurn({ text: phrase })}
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              <form
                className="ai-input-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (inputText.trim() && !loading) {
                    submitBuddyTurn({ text: inputText.trim() })
                  }
                }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Gõ tiếng Anh đơn giản hoặc bấm micro để nói..."
                  maxLength={240}
                  disabled={loading || recordingMode !== 'idle'}
                />
                {recordingMode === 'buddy' ? (
                  <button
                    type="button"
                    className="ai-voice-btn recording"
                    onClick={stopVoiceRecording}
                  >
                    <Square size={18} aria-hidden="true" />
                    <span>Dừng &amp; Gửi</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ai-voice-btn"
                    disabled={loading || recordingMode !== 'idle'}
                    onClick={() => startVoiceRecording('buddy')}
                  >
                    <Mic size={18} aria-hidden="true" />
                    <span>Nói</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="primary compact"
                  disabled={loading || !inputText.trim() || recordingMode !== 'idle'}
                >
                  <Send size={17} aria-hidden="true" />
                  <span>{loading ? 'Đang trả lời...' : 'Gửi'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="ai-pronunciation-box">
              <p className="muted">
                Chọn một từ/câu trong bài, nghe mẫu rồi bấm ghi âm đọc lại. Phản
                hồi chỉ mang tính động viên và gợi ý thực hành, không phải điểm
                số khảo thí.
              </p>

              <div className="pron-phrase-picker">
                {quickSuggestions.map((phrase) => (
                  <button
                    key={`target-${phrase}`}
                    type="button"
                    lang="en"
                    className={targetPhrase === phrase ? 'active' : ''}
                    onClick={() => {
                      setTargetPhrase(phrase)
                      setPronResult(null)
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              <div className="pron-target-card">
                <strong lang="en">{targetPhrase}</strong>
                <div className="pron-actions">
                  <button
                    type="button"
                    className="audio-pill-btn"
                    onClick={() =>
                      speakEnglish(targetPhrase, {
                        levelId: level.id,
                        rateMode: 'normal',
                      })
                    }
                  >
                    <Volume2 size={18} aria-hidden="true" />
                    <span>Nghe mẫu</span>
                  </button>
                  <button
                    type="button"
                    className="audio-pill-btn slow"
                    onClick={() =>
                      speakEnglish(targetPhrase, {
                        levelId: level.id,
                        rateMode: 'slow',
                      })
                    }
                  >
                    <span className="turtle-icon" aria-hidden="true">
                      🐢
                    </span>
                    <span>Nghe chậm</span>
                  </button>
                  {recordingMode === 'pronunciation' ? (
                    <button
                      type="button"
                      className="ai-voice-btn recording"
                      onClick={stopVoiceRecording}
                    >
                      <Square size={18} aria-hidden="true" />
                      <span>Dừng ghi âm</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary compact"
                      disabled={loading || recordingMode !== 'idle'}
                      onClick={() => startVoiceRecording('pronunciation')}
                    >
                      <Mic size={18} aria-hidden="true" />
                      <span>
                        {loading ? 'Đang phân tích...' : 'Ghi âm nói thử'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {pronResult && (
                <div className="pron-result-card" role="status">
                  <div className="pron-result-head">
                    <span className="pron-label" lang="en">
                      {pronResult.encouragementLabel}
                    </span>
                    <button
                      type="button"
                      className="ai-replay-btn"
                      onClick={() =>
                        playResponseAudio(
                          pronResult.audioBase64,
                          pronResult.audioMimeType,
                          pronResult.targetText
                        )
                      }
                    >
                      <Volume2 size={16} aria-hidden="true" />
                      <span>Nghe mẫu AI</span>
                    </button>
                  </div>
                  <p>
                    <strong>Bé đã nói:</strong>{' '}
                    <span lang="en">{pronResult.recognizedText}</span>
                  </p>
                  <p lang="en">{pronResult.feedbackEn}</p>
                  <p>{pronResult.feedbackVi}</p>
                  <p className="pron-tip">
                    <strong>Gợi ý nhỏ:</strong> {pronResult.tipVi}
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="activity-feedback retry" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
