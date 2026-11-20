import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpeechRateMode } from '../utils/storage'

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

export function useSpeech(rateMode: SpeechRateMode) {
  const [speakingText, setSpeakingText] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [speechNotice, setSpeechNotice] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const ttsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window
  const micSupported = getSpeechRecognitionCtor() !== null

  useEffect(() => {
    if (!ttsSupported) return

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return
      const enUs =
        voices.find(
          (v) => v.lang.toLowerCase() === 'en-us' && v.localService
        ) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en-us')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('en'))
      preferredVoiceRef.current = enUs ?? null
    }

    pickVoice()
    window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice)

    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', pickVoice)
    }
  }, [ttsSupported])

  const stopAll = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel()
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore abort errors when already stopped
      }
      recognitionRef.current = null
    }
    setSpeakingText(null)
    setListening(false)
  }, [ttsSupported])

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
    (text: string, onComplete?: () => void) => {
      if (!ttsSupported) {
        setSpeechNotice(
          'Trình duyệt này chưa hỗ trợ phát âm tự động. Phụ huynh hãy đọc mẫu cùng bé nhé.'
        )
        return
      }

      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = rateMode === 'slow' ? 0.68 : 0.88
      utterance.pitch = 1.02
      if (preferredVoiceRef.current) {
        utterance.voice = preferredVoiceRef.current
      }

      utterance.onstart = () => setSpeakingText(text)
      utterance.onend = () => {
        setSpeakingText(null)
        onComplete?.()
      }
      utterance.onerror = () => {
        setSpeakingText(null)
      }

      window.speechSynthesis.speak(utterance)
    },
    [rateMode, ttsSupported]
  )

  const speakSequence = useCallback(
    (items: string[]) => {
      if (!ttsSupported || items.length === 0) return
      window.speechSynthesis.cancel()

      let idx = 0
      const playNext = () => {
        if (idx >= items.length) {
          setSpeakingText(null)
          return
        }
        const current = items[idx]
        idx += 1
        const utterance = new SpeechSynthesisUtterance(current)
        utterance.lang = 'en-US'
        utterance.rate = rateMode === 'slow' ? 0.68 : 0.88
        if (preferredVoiceRef.current) {
          utterance.voice = preferredVoiceRef.current
        }
        utterance.onstart = () => setSpeakingText(current)
        utterance.onend = () => playNext()
        utterance.onerror = () => setSpeakingText(null)
        window.speechSynthesis.speak(utterance)
      }

      playNext()
    },
    [rateMode, ttsSupported]
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

    if (ttsSupported) {
      window.speechSynthesis.cancel()
      setSpeakingText(null)
    }

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
  }, [listening, ttsSupported])

  return {
    speakingText,
    listening,
    transcript,
    speechNotice,
    ttsSupported,
    micSupported,
    speak,
    speakSequence,
    startMic,
    stopAll,
    resetTranscript,
    setSpeechNotice,
  }
}
