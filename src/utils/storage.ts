export type SpeechRateMode = 'normal' | 'slow'

export interface HistoryEntry {
  lessonId: string
  completedAt: string
}

export interface LocalProgressState {
  completedIds: string[]
  history: HistoryEntry[]
  lastLessonId: string | null
  speechRate: SpeechRateMode
}

const STORAGE_KEY = 'elw_mvp_progress_v1'

const defaultState: LocalProgressState = {
  completedIds: [],
  history: [],
  lastLessonId: null,
  speechRate: 'normal',
}

export function loadLocalProgress(): LocalProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<LocalProgressState>
    return {
      completedIds: Array.isArray(parsed.completedIds) ? parsed.completedIds : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      lastLessonId:
        typeof parsed.lastLessonId === 'string' ? parsed.lastLessonId : null,
      speechRate: parsed.speechRate === 'slow' ? 'slow' : 'normal',
    }
  } catch {
    return defaultState
  }
}

export function saveLocalProgress(state: LocalProgressState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage quota or private browsing restrictions gracefully
  }
}

export function clearLocalProgress(): LocalProgressState {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage restrictions
  }
  return defaultState
}
