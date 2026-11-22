export type LevelId = 'L1' | 'L2' | 'L3' | 'L4'

export type LessonType = 'listen' | 'speak' | 'play' | 'story'

export type LessonStatus = 'draft' | 'review' | 'published' | 'archived'

export type AccessTier = 'free' | 'premium'

export type LevelColor = 'peach' | 'yellow' | 'green' | 'purple'

export interface VocabItem {
  word: string
  emoji: string
  meaningVi: string
  audioUrl?: string
  imageUrl?: string
}

export interface PhraseItem {
  en: string
  vi: string
  audioUrl?: string
}

export interface ListenOption {
  id: string
  label: string
  emoji: string
  sublabel?: string
}

export interface ListenRound {
  audioText: string
  hintVi: string
  options: ListenOption[]
  correctId: string
}

export interface MatchRound {
  clueVi: string
  clueEmoji: string
  options: ListenOption[]
  correctId: string
}

export interface StoryStep {
  id: string
  order: number
  en: string
  vi: string
  emoji: string
}

export type ActivityConfig =
  | {
      kind: 'listen_pick'
      promptVi: string
      rounds: ListenRound[]
    }
  | {
      kind: 'match_pick'
      promptVi: string
      rounds: MatchRound[]
    }
  | {
      kind: 'sentence_build'
      promptVi: string
      starterPromptEn: string
      starterPromptVi: string
      chips: string[]
      targetSentences: string[]
      tipsVi: string
    }
  | {
      kind: 'story_order'
      promptVi: string
      steps: StoryStep[]
    }

export interface LessonMedia {
  coverImageUrl?: string
  videoUrl?: string
}

export interface Lesson {
  id: string
  unitId: string
  levelId: LevelId
  order: number
  pedagogicalSlot?: number
  title: string
  duration: string
  durationMinutes: number
  objective: string
  type: LessonType
  accessTier?: AccessTier
  words: VocabItem[]
  phrases: PhraseItem[]
  activity: string
  activityConfig: ActivityConfig
  parentTip: string
  media?: LessonMedia
  status: LessonStatus
  version: number
}

export interface Unit {
  id: string
  levelId: LevelId
  order: number
  title: string
  subtitle: string
  themeEmoji: string
  targetLessonsCount: number
  lessons: Lesson[]
}

export interface Level {
  id: LevelId
  age: string
  name: string
  range: string
  description: string
  color: LevelColor
  goal: string
  emoji: string
  units: Unit[]
}

export interface LessonLocation {
  level: Level
  unit: Unit
  lesson: Lesson
}

export interface CurriculumRepository {
  getLevels(): Level[]
  getCatalogLevels(): Level[]
  getLevelById(levelId: LevelId): Level | undefined
  getAllLessons(): Lesson[]
  getAllCatalogLessons(): Lesson[]
  getLessonLocation(lessonId: string): LessonLocation | undefined
  getAdjacentLessons(lessonId: string): {
    prev: LessonLocation | null
    next: LessonLocation | null
  }
  getPlannedTotalLessons(): number
}
