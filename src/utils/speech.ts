export type SpeechSpeed = 'normal' | 'slow'

export const SPEECH_FALLBACK_MESSAGE =
  'Thiết bị chưa bật giọng đọc tiếng Anh, ba mẹ kiểm tra âm lượng hoặc mở bằng Chrome/Safari nhé.'

export interface SpeakOptions {
  rateMode?: SpeechSpeed
  activeId?: string
  onStart?: (activeId: string) => void
  onEnd?: () => void
  onFallback?: (message: string) => void
}

const PREFERRED_VOICE_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /\b(natural|enhanced|premium)\b/i, score: 50 },
  { pattern: /\bsamantha\b/i, score: 42 },
  { pattern: /\bgoogle us english\b/i, score: 40 },
  { pattern: /\bmicrosoft zira\b/i, score: 38 },
  { pattern: /\bdaniel\b/i, score: 36 },
  { pattern: /\b(ava|allison|aria|jenny|karen|serena|google uk english female)\b/i, score: 30 },
]

// Hold a reference to the active utterance to prevent premature GC in Chromium
let activeUtterance: SpeechSynthesisUtterance | null = null
let activeSequenceToken = 0

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return []
  const voices = window.speechSynthesis.getVoices()
  return voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
}

export function selectBestEnglishVoice(
  voices?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null
  const allVoices = voices && voices.length > 0 ? voices : window.speechSynthesis.getVoices()
  const englishVoices = allVoices.filter((v) =>
    v.lang.toLowerCase().startsWith('en')
  )
  if (englishVoices.length === 0) return null

  let bestVoice: SpeechSynthesisVoice | null = null
  let bestScore = -1

  for (const voice of englishVoices) {
    let score = 0
    const name = voice.name ?? ''
    const lang = (voice.lang ?? '').toLowerCase()

    for (const rule of PREFERRED_VOICE_PATTERNS) {
      if (rule.pattern.test(name)) {
        score += rule.score
      }
    }

    if (lang === 'en-us') score += 22
    else if (lang === 'en-gb') score += 16
    else score += 8

    if (voice.localService) score += 4
    if (voice.default && lang.startsWith('en-us')) score += 2

    if (score > bestScore) {
      bestScore = score
      bestVoice = voice
    }
  }

  return bestVoice
}

export function subscribeVoicesChanged(
  onUpdate: (voices: SpeechSynthesisVoice[], hasEnglishVoice: boolean) => void
): () => void {
  if (!isSpeechSynthesisSupported()) {
    onUpdate([], false)
    return () => {}
  }

  const notify = () => {
    const all = window.speechSynthesis.getVoices()
    const hasEnglish = all.some((v) => v.lang.toLowerCase().startsWith('en'))
    onUpdate(all, hasEnglish)
  }

  // Immediate check for iOS Safari / desktop Safari / Firefox
  notify()

  const synth = window.speechSynthesis
  const previousHandler = synth.onvoiceschanged

  const handleVoicesChanged = () => {
    notify()
  }

  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', handleVoicesChanged)
  } else {
    synth.onvoiceschanged = handleVoicesChanged
  }

  return () => {
    if (typeof synth.removeEventListener === 'function') {
      synth.removeEventListener('voiceschanged', handleVoicesChanged)
    } else if (synth.onvoiceschanged === handleVoicesChanged) {
      synth.onvoiceschanged = previousHandler ?? null
    }
  }
}

export function cancelSpeech(): void {
  activeSequenceToken += 1
  activeUtterance = null
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

export function speakEnglish(text: string, options: SpeakOptions = {}): boolean {
  const cleanText = text.trim()
  if (!cleanText) return false

  if (!isSpeechSynthesisSupported()) {
    options.onFallback?.(SPEECH_FALLBACK_MESSAGE)
    options.onEnd?.()
    return false
  }

  cancelSpeech()

  const allVoices = window.speechSynthesis.getVoices()
  const englishVoices = allVoices.filter((v) =>
    v.lang.toLowerCase().startsWith('en')
  )

  // If browser finished enumerating voices and found zero English voices, notify gently
  if (allVoices.length > 0 && englishVoices.length === 0) {
    options.onFallback?.(SPEECH_FALLBACK_MESSAGE)
  }

  const utterance = new SpeechSynthesisUtterance(cleanText)
  utterance.lang = 'en-US'
  utterance.rate = options.rateMode === 'slow' ? 0.62 : 0.9
  utterance.pitch = 1.04

  const bestVoice = selectBestEnglishVoice(allVoices)
  if (bestVoice) {
    utterance.voice = bestVoice
  }

  const activeId = options.activeId ?? cleanText

  utterance.onstart = () => {
    options.onStart?.(activeId)
  }

  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null
    }
    options.onEnd?.()
  }

  utterance.onerror = (event) => {
    if (activeUtterance === utterance) {
      activeUtterance = null
    }
    const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error
    if (errCode !== 'canceled' && errCode !== 'interrupted') {
      options.onFallback?.(SPEECH_FALLBACK_MESSAGE)
    }
    options.onEnd?.()
  }

  activeUtterance = utterance

  try {
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    activeUtterance = null
    options.onFallback?.(SPEECH_FALLBACK_MESSAGE)
    options.onEnd?.()
    return false
  }
}

export function speakEnglishSequence(
  items: string[],
  options: SpeakOptions = {}
): boolean {
  const cleanItems = items.map((s) => s.trim()).filter(Boolean)
  if (cleanItems.length === 0) return false

  if (!isSpeechSynthesisSupported()) {
    options.onFallback?.(SPEECH_FALLBACK_MESSAGE)
    options.onEnd?.()
    return false
  }

  cancelSpeech()
  const token = activeSequenceToken
  const allVoices = window.speechSynthesis.getVoices()
  const bestVoice = selectBestEnglishVoice(allVoices)
  const activeId = options.activeId ?? 'sequence'

  let idx = 0

  const playNext = () => {
    if (token !== activeSequenceToken) return
    if (idx >= cleanItems.length) {
      activeUtterance = null
      options.onEnd?.()
      return
    }

    const currentText = cleanItems[idx]
    idx += 1

    const utterance = new SpeechSynthesisUtterance(currentText)
    utterance.lang = 'en-US'
    utterance.rate = options.rateMode === 'slow' ? 0.62 : 0.9
    utterance.pitch = 1.04
    if (bestVoice) {
      utterance.voice = bestVoice
    }

    utterance.onstart = () => {
      if (token === activeSequenceToken) {
        options.onStart?.(activeId)
      }
    }

    utterance.onend = () => {
      if (activeUtterance === utterance) {
        activeUtterance = null
      }
      if (token === activeSequenceToken) {
        playNext()
      }
    }

    utterance.onerror = (event) => {
      if (activeUtterance === utterance) {
        activeUtterance = null
      }
      const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error
      if (errCode !== 'canceled' && errCode !== 'interrupted') {
        options.onFallback?.(SPEECH_FALLBACK_MESSAGE)
      }
      options.onEnd?.()
    }

    activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
  }

  playNext()
  return true
}
