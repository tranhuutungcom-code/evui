import type { LevelId } from '../types/curriculum'

export type SpeechSpeed = 'normal' | 'slow'

export type SpeechStatus =
  | 'idle'
  | 'loading'
  | 'speaking'
  | 'completed'
  | 'error'
  | 'unsupported'

export const SPEECH_FALLBACK_MESSAGE =
  'Không thể phát âm thanh lúc này. Ba mẹ kiểm tra âm lượng, tắt chế độ im lặng (nút gạt bên hông iPhone) hoặc kiểm tra kết nối tai nghe Bluetooth nhé.'

export interface SpeakOptions {
  rateMode?: SpeechSpeed
  levelId?: LevelId
  audioUrl?: string
  activeId?: string
  onStateChange?: (status: SpeechStatus, activeId: string | null) => void
  onStart?: (activeId: string) => void
  onEnd?: () => void
  onFallback?: (message: string) => void
}

declare global {
  interface Window {
    __elwUtterance?: SpeechSynthesisUtterance | null
  }
}

const EXCLUDED_VOICE_NAMES =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|fred|good news|jester|junior|kathy|organ|ralph|superstar|trinoids|whisper|wobble|zarvox)\b/i

const PREFERRED_VOICE_PATTERNS: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /\b(natural|enhanced|premium)\b/i, score: 50 },
  { pattern: /\bsamantha\b/i, score: 45 },
  { pattern: /\baaron\b/i, score: 42 },
  { pattern: /\bnicky\b/i, score: 40 },
  { pattern: /\bkaren\b/i, score: 38 },
  { pattern: /\bdaniel\b/i, score: 36 },
  { pattern: /\bgoogle us english\b/i, score: 35 },
  { pattern: /\bmicrosoft zira\b/i, score: 33 },
  { pattern: /\b(ava|allison|aria|jenny|serena|google uk english female)\b/i, score: 28 },
]

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
    return { rate: 0.72, pitch: 1 }
  }
  if (levelId === 'L1' || levelId === 'L2') {
    return { rate: 0.86, pitch: 1 }
  }
  return { rate: 0.94, pitch: 1 }
}

export function selectBestEnglishVoice(
  voices?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null
  const allVoices =
    voices && voices.length > 0 ? voices : window.speechSynthesis.getVoices()

  // Never block when getVoices() returns [] (common on iOS Safari initial loads)
  if (allVoices.length === 0) return null

  const englishVoices = allVoices.filter(
    (v) =>
      typeof v.lang === 'string' &&
      v.lang.toLowerCase().startsWith('en') &&
      !EXCLUDED_VOICE_NAMES.test(v.name ?? '')
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

    if (lang === 'en-us' || lang === 'en_us') score += 26
    else if (lang === 'en-gb' || lang === 'en_gb') score += 16
    else score += 8

    if (voice.localService) score += 10
    if (voice.default && lang.startsWith('en-us')) score += 6

    if (score > bestScore) {
      bestScore = score
      bestVoice = voice
    }
  }

  return bestVoice
}

class CentralizedSpeechService {
  private cachedVoices: SpeechSynthesisVoice[] = []
  private activeAudioEl: HTMLAudioElement | null = null
  private activeOptions: SpeakOptions | null = null
  private activeId: string | null = null
  private status: SpeechStatus = 'idle'
  private requestToken = 0
  private sequenceToken = 0
  private startWatchdogTimer: number | null = null
  private endWatchdogTimer: number | null = null
  private lifecycleInstalled = false
  private voicesListenerInstalled = false
  private voiceSubscribers = new Set<(voices: SpeechSynthesisVoice[]) => void>()

  getStatus(): SpeechStatus {
    return this.status
  }

  getActiveId(): string | null {
    return this.activeId
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!isSpeechSynthesisSupported()) return []
    const live = window.speechSynthesis.getVoices()
    if (live.length > 0) {
      this.cachedVoices = live
    }
    return this.cachedVoices
  }

  private clearWatchdogs(): void {
    if (typeof window === 'undefined') return
    if (this.startWatchdogTimer !== null) {
      window.clearTimeout(this.startWatchdogTimer)
      this.startWatchdogTimer = null
    }
    if (this.endWatchdogTimer !== null) {
      window.clearTimeout(this.endWatchdogTimer)
      this.endWatchdogTimer = null
    }
  }

  private setStatus(
    nextStatus: SpeechStatus,
    nextActiveId: string | null,
    options?: SpeakOptions | null
  ): void {
    this.status = nextStatus
    this.activeId = nextActiveId
    const targetOptions = options ?? this.activeOptions
    targetOptions?.onStateChange?.(nextStatus, nextActiveId)
  }

  /**
   * Registers voiceschanged + tab-hide/pagehide lifecycle cleanup without
   * sending silent empty utterances that break user activation on iOS Safari.
   */
  installLifecycleListeners(): () => void {
    if (typeof window === 'undefined') return () => {}

    if (isSpeechSynthesisSupported() && !this.voicesListenerInstalled) {
      this.voicesListenerInstalled = true
      const synth = window.speechSynthesis
      this.cachedVoices = synth.getVoices()

      const onVoicesChanged = () => {
        this.cachedVoices = synth.getVoices()
        this.voiceSubscribers.forEach((cb) => cb(this.cachedVoices))
      }

      if (typeof synth.addEventListener === 'function') {
        synth.addEventListener('voiceschanged', onVoicesChanged)
      } else {
        synth.onvoiceschanged = onVoicesChanged
      }
    }

    if (this.lifecycleInstalled) {
      return () => {}
    }

    this.lifecycleInstalled = true

    const handleVisibilityOrHide = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.cancel()
      }
    }

    const handlePageHide = () => {
      this.cancel()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrHide)
    }
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrHide)
      }
      window.removeEventListener('pagehide', handlePageHide)
      this.lifecycleInstalled = false
    }
  }

  subscribeVoicesChanged(onUpdate: (voices: SpeechSynthesisVoice[]) => void): () => void {
    if (!isSpeechSynthesisSupported()) {
      onUpdate([])
      return () => {}
    }
    this.installLifecycleListeners()
    this.voiceSubscribers.add(onUpdate)
    onUpdate(this.getVoices())

    return () => {
      this.voiceSubscribers.delete(onUpdate)
    }
  }

  /**
   * Stops any currently playing HTMLAudioElement or active SpeechSynthesis queue.
   * Does NOT call window.speechSynthesis.cancel() unless something is actually active,
   * avoiding unnecessary WebKit speech queue resets before a fresh user click.
   */
  cancel(): void {
    this.requestToken += 1
    this.sequenceToken += 1
    this.clearWatchdogs()

    const previousOptions = this.activeOptions
    this.activeOptions = null

    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.onplay = null
        this.activeAudioEl.onended = null
        this.activeAudioEl.onerror = null
        this.activeAudioEl.pause()
        this.activeAudioEl.currentTime = 0
      } catch {
        // Ignore audio element stop errors
      }
      this.activeAudioEl = null
    }

    if (typeof window !== 'undefined') {
      window.__elwUtterance = null
    }

    if (isSpeechSynthesisSupported()) {
      const synth = window.speechSynthesis
      if (synth.speaking || synth.pending || synth.paused) {
        try {
          synth.cancel()
        } catch {
          // Ignore cancel errors
        }
      }
    }

    if (this.status === 'speaking' || this.status === 'loading') {
      this.setStatus('idle', null, previousOptions)
      previousOptions?.onEnd?.()
    } else {
      this.status = 'idle'
      this.activeId = null
    }
  }

  private speakViaWebSpeech(
    cleanText: string,
    options: SpeakOptions,
    token: number
  ): boolean {
    if (!isSpeechSynthesisSupported()) {
      this.setStatus('unsupported', null, options)
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
    this.activeOptions = options

    try {
      // Only cancel if WebKit actually has active/pending output so fresh clicks never touch cancel()
      if (synth.speaking || synth.pending) {
        synth.cancel()
      }
      if (synth.paused) {
        synth.resume()
      }

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'en-US'
      utterance.rate = rate
      utterance.pitch = pitch
      utterance.volume = 1

      const voices = this.getVoices()
      const selectedVoice = selectBestEnglishVoice(voices)
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      let didStart = false

      // Watchdog: if onstart never fires within 2.2s on iOS Safari, clear wedged state & inform parent
      this.startWatchdogTimer = window.setTimeout(() => {
        if (token !== this.requestToken || didStart) return
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        try {
          if (synth.speaking || synth.pending) {
            synth.cancel()
          }
        } catch {
          // Ignore
        }
        this.setStatus('error', null, options)
        options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: audio-timeout)`)
        options.onEnd?.()
      }, 2200)

      utterance.onstart = () => {
        if (token !== this.requestToken) return
        didStart = true
        if (this.startWatchdogTimer !== null) {
          window.clearTimeout(this.startWatchdogTimer)
          this.startWatchdogTimer = null
        }

        // Guard against iOS Safari dropping onend and leaving the button stuck in "Đang đọc..."
        const maxDurationMs = Math.max(9000, cleanText.length * 240)
        this.endWatchdogTimer = window.setTimeout(() => {
          if (token !== this.requestToken) return
          if (window.__elwUtterance === utterance) {
            window.__elwUtterance = null
          }
          try {
            if (synth.speaking || synth.pending) {
              synth.cancel()
            }
          } catch {
            // Ignore
          }
          this.setStatus('idle', null, options)
          options.onEnd?.()
        }, maxDurationMs)

        this.setStatus('speaking', activeId, options)
        options.onStart?.(activeId)
      }

      utterance.onend = () => {
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        if (token !== this.requestToken) return
        this.clearWatchdogs()
        this.setStatus('completed', null, options)
        options.onEnd?.()
      }

      utterance.onerror = (event) => {
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        if (token !== this.requestToken) return
        this.clearWatchdogs()
        const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error
        if (errCode === 'canceled' || errCode === 'interrupted') {
          this.setStatus('idle', null, options)
        } else {
          const codeLabel = errCode ? ` (Mã lỗi: ${errCode})` : ''
          this.setStatus('error', null, options)
          options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE}${codeLabel}`)
        }
        options.onEnd?.()
      }

      // Strong global reference prevents WebKit GC mid-utterance
      window.__elwUtterance = utterance

      // Synchronous call directly inside user click stack — preserves iOS Safari user activation
      synth.speak(utterance)
      return true
    } catch {
      this.clearWatchdogs()
      window.__elwUtterance = null
      this.setStatus('error', null, options)
      options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: speak-exception)`)
      options.onEnd?.()
      return false
    }
  }

  speak(text: string, options: SpeakOptions = {}): boolean {
    const cleanText = text.trim()
    if (!cleanText) return false

    this.cancel()
    const token = ++this.requestToken
    const activeId = options.activeId ?? cleanText

    // Priority 1: Pre-generated / verified MP3 audio file if provided
    if (options.audioUrl && typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(options.audioUrl)
        audio.preload = 'auto'
        audio.playbackRate = options.rateMode === 'slow' ? 0.8 : 1
        this.activeAudioEl = audio
        this.activeOptions = options
        this.setStatus('loading', activeId, options)

        audio.onplay = () => {
          if (token !== this.requestToken) return
          this.setStatus('speaking', activeId, options)
          options.onStart?.(activeId)
        }

        audio.onended = () => {
          if (this.activeAudioEl === audio) this.activeAudioEl = null
          if (token !== this.requestToken) return
          this.setStatus('completed', null, options)
          options.onEnd?.()
        }

        const fallbackToTts = () => {
          if (this.activeAudioEl === audio) this.activeAudioEl = null
          if (token !== this.requestToken) return
          this.speakViaWebSpeech(cleanText, options, token)
        }

        audio.onerror = fallbackToTts

        const playPromise = audio.play()
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(fallbackToTts)
        }
        return true
      } catch {
        this.activeAudioEl = null
      }
    }

    // Priority 2: Synchronous Web Speech API (iOS Safari user-gesture safe)
    return this.speakViaWebSpeech(cleanText, options, token)
  }

  speakSequence(items: string[], options: SpeakOptions = {}): boolean {
    const cleanItems = items.map((s) => s.trim()).filter(Boolean)
    if (cleanItems.length === 0) return false

    if (!isSpeechSynthesisSupported()) {
      this.setStatus('unsupported', null, options)
      options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: unsupported)`)
      options.onEnd?.()
      return false
    }

    this.cancel()
    const token = ++this.requestToken
    const seqToken = ++this.sequenceToken
    const activeId = options.activeId ?? 'sequence'
    const synth = window.speechSynthesis
    const { rate, pitch } = getSpeechParams(
      options.rateMode ?? 'normal',
      options.levelId
    )

    this.activeOptions = options
    let idx = 0

    const playNext = () => {
      if (seqToken !== this.sequenceToken || token !== this.requestToken) return
      if (idx >= cleanItems.length) {
        this.clearWatchdogs()
        window.__elwUtterance = null
        this.setStatus('completed', null, options)
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
      utterance.volume = 1

      const selectedVoice = selectBestEnglishVoice(this.getVoices())
      if (selectedVoice) {
        utterance.voice = selectedVoice
      }

      let didStart = false
      if (idx === 1) {
        this.startWatchdogTimer = window.setTimeout(() => {
          if (seqToken !== this.sequenceToken || didStart) return
          if (window.__elwUtterance === utterance) {
            window.__elwUtterance = null
          }
          try {
            if (synth.speaking || synth.pending) synth.cancel()
          } catch {
            // Ignore
          }
          this.setStatus('error', null, options)
          options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE} (Mã lỗi: audio-timeout)`)
          options.onEnd?.()
        }, 2200)
      }

      utterance.onstart = () => {
        if (seqToken !== this.sequenceToken) return
        didStart = true
        if (this.startWatchdogTimer !== null) {
          window.clearTimeout(this.startWatchdogTimer)
          this.startWatchdogTimer = null
        }
        if (this.endWatchdogTimer !== null) {
          window.clearTimeout(this.endWatchdogTimer)
        }
        const maxDurationMs = Math.max(9000, currentText.length * 240)
        this.endWatchdogTimer = window.setTimeout(() => {
          if (seqToken !== this.sequenceToken) return
          if (window.__elwUtterance === utterance) {
            window.__elwUtterance = null
          }
          try {
            if (synth.speaking || synth.pending) synth.cancel()
          } catch {
            // Ignore
          }
          this.setStatus('idle', null, options)
          options.onEnd?.()
        }, maxDurationMs)

        this.setStatus('speaking', activeId, options)
        options.onStart?.(activeId)
      }

      utterance.onend = () => {
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        if (this.endWatchdogTimer !== null) {
          window.clearTimeout(this.endWatchdogTimer)
          this.endWatchdogTimer = null
        }
        if (seqToken === this.sequenceToken) {
          playNext()
        }
      }

      utterance.onerror = (event) => {
        if (window.__elwUtterance === utterance) {
          window.__elwUtterance = null
        }
        if (seqToken !== this.sequenceToken) return
        this.clearWatchdogs()
        const errCode = (event as SpeechSynthesisErrorEvent | undefined)?.error
        if (errCode === 'canceled' || errCode === 'interrupted') {
          this.setStatus('idle', null, options)
        } else {
          const codeLabel = errCode ? ` (Mã lỗi: ${errCode})` : ''
          this.setStatus('error', null, options)
          options.onFallback?.(`${SPEECH_FALLBACK_MESSAGE}${codeLabel}`)
        }
        options.onEnd?.()
      }

      window.__elwUtterance = utterance
      // Direct synchronous speak for the initial utterance inside click handler
      synth.speak(utterance)
    }

    playNext()
    return true
  }
}

export const speechService = new CentralizedSpeechService()

export function installSpeechUnlockListener(): () => void {
  return speechService.installLifecycleListeners()
}

export function subscribeVoicesChanged(
  onUpdate: (voices: SpeechSynthesisVoice[]) => void
): () => void {
  return speechService.subscribeVoicesChanged(onUpdate)
}

export function cancelSpeech(): void {
  speechService.cancel()
}

export function speakEnglish(text: string, options: SpeakOptions = {}): boolean {
  return speechService.speak(text, options)
}

export function speakEnglishSequence(
  items: string[],
  options: SpeakOptions = {}
): boolean {
  return speechService.speakSequence(items, options)
}
