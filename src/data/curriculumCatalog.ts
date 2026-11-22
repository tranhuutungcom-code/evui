import { levels as v1BaseLevels } from './curriculum'
import type { Lesson, LessonType, Level, LevelId, Unit } from '../types/curriculum'

export interface PedagogicalSlotBlueprint {
  slot: number
  title: string
  labelVi: string
  type: LessonType
}

export const TEN_LESSON_UNIT_BLUEPRINT: PedagogicalSlotBlueprint[] = [
  { slot: 1, title: 'Explore the Topic', labelVi: 'Khám phá chủ đề', type: 'listen' },
  { slot: 2, title: 'Words 1', labelVi: 'Từ vựng phần 1', type: 'listen' },
  { slot: 3, title: 'Words 2', labelVi: 'Từ vựng phần 2', type: 'play' },
  { slot: 4, title: 'Listen and Understand', labelVi: 'Nghe và hiểu', type: 'listen' },
  { slot: 5, title: 'Speak and Repeat', labelVi: 'Nói và nhắc lại', type: 'speak' },
  { slot: 6, title: 'Sounds and Phonics', labelVi: 'Âm thanh & Ngữ âm', type: 'speak' },
  { slot: 7, title: 'Build a Sentence', labelVi: 'Ghép câu hoàn chỉnh', type: 'play' },
  { slot: 8, title: 'Play and Practice', labelVi: 'Trò chơi & Thực hành', type: 'play' },
  { slot: 9, title: 'Story or Dialogue', labelVi: 'Truyện & Hội thoại', type: 'story' },
  { slot: 10, title: 'Review and Challenge', labelVi: 'Ôn tập & Thử thách', type: 'play' },
]

function getDefaultDurationForLevel(levelId: LevelId): { label: string; minutes: number } {
  switch (levelId) {
    case 'L1':
      return { label: '5–7 phút', minutes: 6 }
    case 'L2':
      return { label: '7–9 phút', minutes: 8 }
    case 'L3':
      return { label: '9–12 phút', minutes: 10 }
    case 'L4':
      return { label: '10–14 phút', minutes: 12 }
  }
}

function getAgeSpecificObjective(levelId: LevelId, unitTitle: string, slot: PedagogicalSlotBlueprint): string {
  const cleanTopic = unitTitle.replace(/^Unit \d+:\s*/i, '')
  switch (levelId) {
    case 'L1':
      return `[Bản nháp sư phạm] ${slot.labelVi} chủ đề "${cleanTopic}" (3–4 tuổi): ưu tiên nghe, nhìn hình và bắt chước tự nhiên, không ép đọc/viết.`
    case 'L2':
      return `[Bản nháp sư phạm] ${slot.labelVi} chủ đề "${cleanTopic}" (5–6 tuổi): luyện nghe hiểu và phản xạ từ vựng, câu ngắn kèm ngữ âm cơ bản.`
    case 'L3':
      return `[Bản nháp sư phạm] ${slot.labelVi} chủ đề "${cleanTopic}" (7–9 tuổi): mở rộng từ vựng, ghép câu hoàn chỉnh và nghe hiểu hội thoại ngắn.`
    case 'L4':
      return `[Bản nháp sư phạm] ${slot.labelVi} chủ đề "${cleanTopic}" (10–11 tuổi): luyện hội thoại thực tế, đọc hiểu ngắn và diễn đạt ý kiến kèm lý do.`
  }
}

function buildDraftScaffoldLesson(
  levelId: LevelId,
  unit: Unit,
  slotBlueprint: PedagogicalSlotBlueprint
): Lesson {
  const unitCode = `U${unit.order}`
  const lessonNum = String(slotBlueprint.slot).padStart(2, '0')
  const cleanTopic = unit.title.replace(/^Unit \d+:\s*/i, '')
  const duration = getDefaultDurationForLevel(levelId)

  return {
    id: `${levelId}-${unitCode}-${lessonNum}`,
    unitId: unit.id,
    levelId,
    order: slotBlueprint.slot,
    pedagogicalSlot: slotBlueprint.slot,
    title: `${slotBlueprint.title}: ${cleanTopic}`,
    duration: duration.label,
    durationMinutes: duration.minutes,
    objective: getAgeSpecificObjective(levelId, unit.title, slotBlueprint),
    type: slotBlueprint.type,
    accessTier: unit.order === 1 ? 'free' : 'premium',
    words: [
      { word: cleanTopic.split(' ')[0] || 'Hello', emoji: unit.themeEmoji, meaningVi: 'Từ khóa chủ đề (chờ biên tập)' },
    ],
    phrases: [
      { en: `Let's explore ${cleanTopic}.`, vi: `Cùng khám phá chủ đề ${cleanTopic} (bản nháp).` },
    ],
    activity: `${slotBlueprint.labelVi} — khung bài học nháp chờ biên tập viên bổ sung câu hỏi và audio kiểm duyệt.`,
    activityConfig: {
      kind: 'listen_pick',
      promptVi: 'Bản nháp nội dung đang chờ kiểm duyệt sư phạm trước khi xuất bản.',
      rounds: [
        {
          audioText: cleanTopic,
          hintVi: 'Nội dung nháp',
          options: [
            { id: 'draft-a', label: cleanTopic, emoji: unit.themeEmoji, sublabel: 'Chủ đề bài học' },
            { id: 'draft-b', label: 'Practice', emoji: '✨', sublabel: 'Thực hành' },
          ],
          correctId: 'draft-a',
        },
      ],
    },
    parentTip: 'Bài học đang ở trạng thái Bản nháp (Draft) và sẽ hiển thị cho bé sau khi được kiểm duyệt và xuất bản.',
    status: 'draft',
    version: 1,
  }
}

/**
 * Builds the complete 320-lesson catalog (4 levels × 8 units × 10 lessons).
 * - Preserves all 16 verified V1 lessons as 'published' with their exact IDs (L1-01..L4-04).
 * - Generates 304 structured 'draft' scaffolds for the remaining slots across Units 1–8.
 * - Draft lessons NEVER appear in the Child Learning Area until reviewed & published.
 */
export const fullCatalogLevels: Level[] = v1BaseLevels.map((level) => {
  const expandedUnits: Unit[] = level.units.map((unit) => {
    const existingBySlot = new Map<number, Lesson>()
    unit.lessons.forEach((lesson, idx) => {
      const slot = lesson.pedagogicalSlot ?? idx + 1
      existingBySlot.set(slot, {
        ...lesson,
        pedagogicalSlot: slot,
        accessTier: lesson.accessTier ?? 'free',
      })
    })

    const fullTenLessons: Lesson[] = TEN_LESSON_UNIT_BLUEPRINT.map((blueprint) => {
      const existing = existingBySlot.get(blueprint.slot)
      if (existing) {
        return existing
      }
      return buildDraftScaffoldLesson(level.id, unit, blueprint)
    })

    return {
      ...unit,
      targetLessonsCount: 10,
      lessons: fullTenLessons,
    }
  })

  return {
    ...level,
    units: expandedUnits,
  }
})
