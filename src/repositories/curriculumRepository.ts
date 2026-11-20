import { levels } from '../data/curriculum'
import type {
  CurriculumRepository,
  Lesson,
  LessonLocation,
  Level,
  LevelId,
} from '../types/curriculum'

class LocalCurriculumRepository implements CurriculumRepository {
  getLevels(): Level[] {
    return levels
  }

  getLevelById(levelId: LevelId): Level | undefined {
    return levels.find((l) => l.id === levelId)
  }

  getAllLessons(): Lesson[] {
    return levels.flatMap((level) =>
      level.units.flatMap((unit) => unit.lessons)
    )
  }

  getLessonLocation(lessonId: string): LessonLocation | undefined {
    for (const level of levels) {
      for (const unit of level.units) {
        const lesson = unit.lessons.find((item) => item.id === lessonId)
        if (lesson) {
          return { level, unit, lesson }
        }
      }
    }
    return undefined
  }

  getAdjacentLessons(lessonId: string): {
    prev: LessonLocation | null
    next: LessonLocation | null
  } {
    const locations: LessonLocation[] = []
    for (const level of levels) {
      for (const unit of level.units) {
        for (const lesson of unit.lessons) {
          locations.push({ level, unit, lesson })
        }
      }
    }

    const index = locations.findIndex((loc) => loc.lesson.id === lessonId)
    if (index === -1) {
      return { prev: null, next: null }
    }

    return {
      prev: index > 0 ? locations[index - 1] : null,
      next: index < locations.length - 1 ? locations[index + 1] : null,
    }
  }

  getPlannedTotalLessons(): number {
    return levels.reduce(
      (sum, level) =>
        sum + level.units.reduce((unitSum, unit) => unitSum + unit.targetLessonsCount, 0),
      0
    )
  }
}

export const curriculumRepository: CurriculumRepository =
  new LocalCurriculumRepository()
