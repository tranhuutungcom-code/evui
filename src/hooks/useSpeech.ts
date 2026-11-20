import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelSpeech,
  isSpeechSynthesisSupported,
  SPEECH_FALLBACK_MESSAGE,
  speakEnglish,
  speakEnglishSequence,
  subscribeVoicesChanged,
  type SpeechSpeed,
} from '../utils/speech'

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionErrorEventLike {
  error?: string
}

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives?: number
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  start: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export function useSpeech(defaultRateMode: SpeechSpeed) {
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [speechNotice, setSpeechNotice] = useState('')
  const [fallbackNotice, setFallbackNotice] = useState<string>(() =>
    isSpeechSynthesisSupported() ? '' : SPEECH_FALLBACK_MESSAGE
  )
  const [voicesChecked, setVoicesChecked] = useState(false)
  const [hasEnglishVoice, setHasEnglishVoice] = useState(true)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const ttsSupported = isSpeechSynthesisSupported()
  const micSupported = getSpeechRecognitionCtor() !== null

  useEffect(() => {
    if (!ttsSupported) {
      setHasEnglishVoice(false)
      setVoicesChecked(true)
      setFallbackNotice(SPEECH_FALLBACK_MESSAGE)
      return
    }

    let timeoutId: number | undefined

    const unsubscribe = subscribeVoicesChanged((voices, hasEnglish) => {
      if (voices.length > 0) {
        setVoicesChecked(true)
        setHasEnglishVoice(hasEnglish)
        setFallbackNotice(hasEnglish ? '' : SPEECH_FALLBACK_MESSAGE)
      }
    })

    // Give Chrome/Android async voice loading a brief window before checking empty voices
    timeoutId = window.setTimeout(() => {
      const voices = window.speechSynthesis.getVoices()
      const hasEnglish = voices.some((v) =>
        v.lang.toLowerCase().startsWith('en')
      )
      setVoicesChecked(true)
      if (voices.length === 0 || !hasEnglish) {
        setHasEnglishVoice(false)
        setFallbackNotice(SPEECH_FALLBACK_MESSAGE)
      }
    }, 900)

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [ttsSupported])

  const stopAll = useCallback(() => {
    cancelSpeech()
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore abort errors when already stopped
      }
      recognitionRef.current = null
    }
    setActiveAudioId(null)
    setListening(false)
  }, [])

  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  const resetTranscript = useCallback(() => {
    setTranscript('')
    setSpeechNotice('')
  }, [])

  const speak = useCallback(
    (text: string, overrideRate?: SpeechSpeed, activeId?: string) => {
      const rateMode = overrideRate ?? defaultRateMode
      const resolvedId = activeId ?? `${text}::${rateMode}`

      if (!ttsSupported) {
        setFallbackNotice(SPEECH_FALLBACK_MESSAGE)
        return
      }

      speakEnglish(text, {
        rateMode,
        activeId: resolvedId,
        onStart: (id) => {
          setActiveAudioId(id)
          setFallbackNotice('')
        },
        onEnd: () => {
          setActiveAudioId((prev) => (prev === resolvedId ? null : prev))
        },
        onFallback: (msg) => {
          setFallbackNotice(msg)
        },
      })
    },
    [defaultRateMode, ttsSupported]
  )

  const speakSequence = useCallback(
    (items: string[], overrideRate?: SpeechSpeed, activeId = 'story-sequence') => {
      const rateMode = overrideRate ?? defaultRateMode
      if (!ttsSupported) {
        setFallbackNotice(SPEECH_FALLBACK_MESSAGE)
        return
      }

      speakEnglishSequence(items, {
        rateMode,
        activeId,
        onStart: (id) => {
          setActiveAudioId(id)
          setFallbackNotice('')
        },
        onEnd: () => {
          setActiveAudioId((prev) => (prev === activeId ? null : prev))
        },
        onFallback: (msg) => {
          setFallbackNotice(msg)
        },
      })
    },
    [defaultRateMode, ttsSupported]
  )

  const startMic = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setSpeechNotice(
        'Trình duyệt hoặc thiết bị chưa hỗ trợ nhận diện giọng nói. Bé vẫn có thể nghe mẫu và nói theo cùng người lớn.'
      )
      return
    }

    if (listening && recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore
      }
      recognitionRef.current = null
      setListening(false)
      return
    }

    cancelSpeech()
    setActiveAudioId(null)

    const recognition = new Ctor()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setListening(true)
      setSpeechNotice('Đang lắng nghe… Bé hãy nói to và rõ một từ hoặc câu nhé.')
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onresult = (event) => {
      const resultText = event.results?.[0]?.[0]?.transcript?.trim() ?? ''
      if (resultText) {
        setTranscript(resultText)
        setSpeechNotice(
          'Đã ghi nhận lời nói. Đây là bản chép lời tham khảo từ trình duyệt, không phải điểm đánh giá phát âm.'
        )
      }
    }

    recognition.onerror = (event) => {
      setListening(false)
      recognitionRef.current = null
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSpeechNotice(
          'Trình duyệt đang chặn quyền micro. Phụ huynh hãy cho phép quyền micro nếu muốn dùng thử tính năng này.'
        )
      } else if (event.error === 'no-speech') {
        setSpeechNotice('Chưa nghe thấy giọng nói. Hãy thử lại ở nơi yên tĩnh hơn nhé.')
      } else if (event.error !== 'aborted') {
        setSpeechNotice(
          'Không nhận diện được giọng nói lúc này. Bé cứ luyện nói cùng phụ huynh nhé!'
        )
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setListening(false)
      recognitionRef.current = null
    }
  }, [listening])

  return {
    activeAudioId,
    listening,
    transcript,
    speechNotice,
    fallbackNotice,
    voicesChecked,
    hasEnglishVoice,
    ttsSupported,
    micSupported,
    speak,
    speakSequence,
    startMic,
    stopAll,
    resetTranscript,
    dismissFallbackNotice: () => setFallbackNotice(''),
  }
}
