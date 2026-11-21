import type { LevelId } from '../types/curriculum'

export type SpeechSpeed = 'normal' | 'slow'

export const SPEECH_FALLBACK_MESSAGE =
  'Thiết bị chưa bật giọng đọc tiếng Anh, ba mẹ kiểm tra âm lượng, tắt chế độ im lặng trên iPhone hoặc mở bằng Chrome/Safari nhé.'

export interface SpeakOptions {
  rateMode?: SpeechSpeed
  levelId?: LevelId
  audioUrl?: string
  activeId?: string
  onStart?: (activeId: string) => void
  onEnd?: () => void
  onFallback?: (message: string) => void
}

declare global {
  interface Window {
    __elwUtterance?: SpeechSynthesisUtterance | null
  }
}

const PREFERRED_VOICE_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /\b(natural|enhanced|premium)\b/i, score: 50 },
  { pattern: /\bsamantha\b/i, score: 45 },
  { pattern: /\bkaren\b/i, score: 43 },
  { pattern: /\bdaniel\b/i, score: 41 },
  { pattern: /\baaron\b/i, score: 39 },
  { pattern: /\bnicky\b/i, score: 37 },
  { pattern: /\bgoogle us english\b/i, score: 36 },
  { pattern: /\bmicrosoft zira\b/i, score: 34 },
  { pattern: /\b(ava|allison|aria|jenny|serena|google uk english female)\b/i, score: 28 },
]

let activeAudioEl: HTMLAudioElement | null = null
let pendingSpeakTimer: number | null = null
let activeSequenceToken = 0
let iosUnlocked = false
let unlockInstalled = false

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

export function getSpeechParams(
  rateMode: SpeechSpeed,
  levelId?: LevelId
): { rate: number; pitch: number } {
  if (rateMode === 'slow') {
    return { rate: 0.68, pitch: 1.05 }
  }
  // L1 (3–4 tuổi) & L2 (5–6 tuổi): slower natural cadence; L3–L4 (7–11 tuổi): standard clear cadence
  if (levelId === 'L1' || levelId === 'L2') {
    return { rate: 0.83, pitch: 1.08 }
  }
  return { rate: 0.92, pitch: 1.05 }
}

export function selectBestEnglishVoice(
  voices?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null
  const allVoices =
    voices && voices.length > 0 ? voices : window.speechSynthesis.getVoices()

  // On iOS Safari, getVoices() often returns [] on initial calls — never block on empty
  if (allVoices.length === 0) return null

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

/**
 * Unlocks iOS Safari speechSynthesis on the very first touch/click gesture
 * by priming an empty silent utterance once.
 */
export function installSpeechUnlockListener(): () => void {
  if (typeof window === 'undefined' || unlockInstalled || iosUnlocked) {
    return () => {}
  }

  unlockInstalled = true

  const handleFirstInteraction = () => {
    if (iosUnlocked) return
    iosUnlocked = true

    window.removeEventListener('touchstart', handleFirstInteraction)
    window.removeEventListener('click', handleFirstInteraction)

    if (!isSpeechSynthesisSupported()) return

    try {
      const synth = window.speechSynthesis
      if (synth.paused) {
        synth.resume()
      }
      // Only prime if nothing is already speaking/pending
      if (!synth.speaking && !synth.pending) {
        const primer = new SpeechSynthesisUtterance('')
        primer.lang = 'en-US'
        primer.volume = 0
        window.__elwUtterance = primer
        synth.speak(primer)
      }
    } catch {
      // Ignore unlock edge-case failures
    }
  }

  window.addEventListener('touchstart', handleFirstInteraction, {
    once: true,
    passive: true,
  })
  window.addEventListener('click', handleFirstInteraction, {
    once: true,
    passive: true,
  })

  return () => {
    window.removeEventListener('touchstart', handleFirstInteraction)
    window.removeEventListener('click', handleFirstInteraction)
    unlockInstalled = false
  }
}

export function subscribeVoicesChanged(
  onUpdate: (voices: SpeechSynthesisVoice[]) => void
): () => void {
  if (!isSpeechSynthesisSupported()) {
    onUpdate([])
    return () => {}
  }

  const notify = () => {
    onUpdate(window.speechSynthesis.getVoices())
  }

  // Immediate check for iOS Safari / desktop Safari
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

  if (pendingSpeakTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingSpeakTimer)
    pendingSpeakTimer = null
  }

  if (activeAudioEl) {
    try {
      activeAudioEl.pause()
      activeAudioEl.currentTime = 0
    } catch {
      // Ignore audio element stop errors
    }
    activeAudioEl = null
  }

  if (typeof window !== 'undefined') {
    window.__elwUtterance = null
  }

  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

function speakViaWebSpeech(cleanText: string, options: SpeakOptions): boolean {
  if (!isSpeechSynthesisSupported()) {
    options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: unsupported)`)
    options.onEnd?.()
    return false
  }

  const synth = window.speechSynthesis
  const { rate, pitch } = getSpeechParams(
    options.rateMode ?? 'normal',
    options.levelId
  )
  const activeId = options.activeId ?? cleanText

  const buildAndSpeak = () => {
    try {
      if (synth.paused) {
        synth.resume()
      }

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'en-US'
      utterance.rate = rate
      utterance.pitch = pitch

      // Never block if getVoices() returns [] — only assign voice when an English voice is available
      const voices = synth.getVoices()
      const selectedVoice = selectBestEnglishVoice(voices)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      utterance.onstart = () => {
        iosUnlocked = true
        options.onStart?.(activeId)
      }

      utterance.onend = () => {
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        options.onEnd?.()
      }

      utterance.onerror = (event) => {
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error
        if (errCode !== 'canceled' && errCode !== 'interrupted') {
          const codeLabel = errCode ? ` (Mã lỗi: ${errCode})` : ''
          options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE}${codeLabel}`)
        }
        options.onEnd?.()
      }

      // Keep global reference so iOS Safari does not garbage-collect the utterance mid-playback
      window.__elwUtterance = utterance
      synth.speak(utterance)
    } catch {
      window.__elwUtterance = null
      options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: speak-exception)`)
      options.onEnd?.()
    }
  }

  if (synth.paused) {
    synth.resume()
  }

  // If synth is actively speaking or queued, cancel and delay ~70ms before speaking on iOS Safari
  if (synth.speaking || synth.pending) {
    synth.cancel()
    pendingSpeakTimer = window.setTimeout(() => {
      pendingSpeakTimer = null
      buildAndSpeak()
    }, 70)
  } else {
    buildAndSpeak()
  }

  return true
}

export function speakEnglish(text: string, options: SpeakOptions = {}): boolean {
  const cleanText = text.trim()
  if (!cleanText) return false

  cancelSpeech()

  // Priority 1: Dedicated audio file if configured for this word/phrase
  if (options.audioUrl && typeof Audio !== 'undefined') {
    const activeId = options.activeId ?? cleanText
    try {
      const audio = new Audio(options.audioUrl)
      audio.playbackRate = options.rateMode === 'slow' ? 0.78 : 1
      activeAudioEl = audio

      audio.onplay = () => {
        options.onStart?.(activeId)
      }
      audio.onended = () => {
        if (activeAudioEl === audio) activeAudioEl = null
        options.onEnd?.()
      }
      audio.onerror = () => {
        if (activeAudioEl === audio) activeAudioEl = null
        speakViaWebSpeech(cleanText, options)
      }

      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (activeAudioEl === audio) activeAudioEl = null
          speakViaWebSpeech(cleanText, options)
        })
      }
      return true
    } catch {
      activeAudioEl = null
    }
  }

  // Priority 2: Web Speech API
  return speakViaWebSpeech(cleanText, options)
}

export function speakEnglishSequence(
  items: string[],
  options: SpeakOptions = {}
): boolean {
  const cleanItems = items.map((s) => s.trim()).filter(Boolean)
  if (cleanItems.length === 0) return false

  if (!isSpeechSynthesisSupported()) {
    options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: unsupported)`)
    options.onEnd?.()
    return false
  }

  const synth = window.speechSynthesis
  const hadActiveQueue = synth.speaking || synth.pending

  cancelSpeech()
  const token = activeSequenceToken
  const activeId = options.activeId ?? 'sequence'
  const { rate, pitch } = getSpeechParams(
    options.rateMode ?? 'normal',
    options.levelId
  )

  let idx = 0

  const playNext = () => {
    if (token !== activeSequenceToken) return
    if (idx >= cleanItems.length) {
      window.__elwUtterance = null
      options.onEnd?.()
      return
    }

    const currentText = cleanItems[idx]
    idx += 1

    if (synth.paused) {
      synth.resume()
    }

    const utterance = new SpeechSynthesisUtterance(currentText)
    utterance.lang = 'en-US'
    utterance.rate = rate
    utterance.pitch = pitch

    const selectedVoice = selectBestEnglishVoice(synth.getVoices())
    if (selectedVoice) {
      utterance.voice = selectedVoice
    }

    utterance.onstart = () => {
      if (token === activeSequenceToken) {
        iosUnlocked = true
        options.onStart?.(activeId)
      }
    }

    utterance.onend = () => {
      if (window.__elwUtterance === utterance) {
        window.__elwUtterance = null
      }
      if (token === activeSequenceToken) {
        playNext()
      }
    }

    utterance.onerror = (event) => {
      if (window.__elwUtterance === utterance) {
        window.__elwUtterance = null
      }
      const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error
      if (errCode !== 'canceled' && errCode !== 'interrupted') {
        const codeLabel = errCode ? ` (Mã lỗi: ${errCode})` : ''
        options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE}${codeLabel}`)
      }
      options.onEnd?.()
    }

    window.__elwUtterance = utterance
    synth.speak(utterance)
  }

  if (hadActiveQueue) {
    pendingSpeakTimer = window.setTimeout(() => {
      pendingSpeakTimer = null
      playNext()
    }, 70)
  } else {
    playNext()
  }

  return true
}
