import { fullCatalogLevels } from '../data/curriculumCatalog'
import { getSupabaseClient } from '../lib/supabase'
import type {
  CurriculumRepository,
  Lesson,
  LessonLocation,
  LessonStatus,
  Level,
  LevelId,
} from '../types/curriculum'

function filterPublishedLevels(sourceLevels: Level[]): Level[] {
  return sourceLevels.map((level) => ({
    ...level,
    units: level.units.map((unit) => ({
      ...unit,
      lessons: unit.lessons.filter((lesson) => lesson.status === 'published'),
    })),
  }))
}

class CurriculumStoreRepository implements CurriculumRepository {
  private catalogLevels: Level[] = fullCatalogLevels

  getCatalogLevels(): Level[] {
    return this.catalogLevels
  }

  getLevels(): Level[] {
    return filterPublishedLevels(this.catalogLevels)
  }

  getLevelById(levelId: LevelId): Level | undefined {
    return this.getLevels().find((l) => l.id === levelId)
  }

  getAllLessons(): Lesson[] {
    return this.getLevels().flatMap((level) =>
      level.units.flatMap((unit) => unit.lessons)
    )
  }

  getAllCatalogLessons(): Lesson[] {
    return this.catalogLevels.flatMap((level) =>
      level.units.flatMap((unit) => unit.lessons)
    )
  }

  getLessonLocation(lessonId: string): LessonLocation | undefined {
    for (const level of this.getLevels()) {
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
    for (const level of this.getLevels()) {
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
    return this.catalogLevels.reduce(
      (sum, level) =>
        sum + level.units.reduce((unitSum, unit) => unitSum + unit.targetLessonsCount, 0),
      0
    )
  }

  /**
   * Merges remote Supabase lesson rows into the in-memory catalog without breaking V1 IDs.
   * Only lessons with status === 'published' will be visible in the Child Learning Area.
   */
  applyRemoteLessons(remoteRows: Array<Record<string, unknown>>): Level[] {
    const rowMap = new Map<string, Record<string, unknown>>()
    for (const row of remoteRows) {
      if (typeof row.id === 'string') {
        rowMap.set(row.id, row)
      }
    }

    this.catalogLevels = this.catalogLevels.map((level) => ({
      ...level,
      units: level.units.map((unit) => ({
        ...unit,
        lessons: unit.lessons.map((lesson) => {
          const remote = rowMap.get(lesson.id)
          if (!remote) return lesson
          const content = (remote.content as Record<string, unknown> | undefined) ?? {}
          return {
            ...lesson,
            title: typeof remote.title === 'string' ? remote.title : lesson.title,
            objective:
              typeof remote.objective === 'string' ? remote.objective : lesson.objective,
            parentTip:
              typeof remote.parent_tip === 'string' ? remote.parent_tip : lesson.parentTip,
            status:
              typeof remote.status === 'string'
                ? (remote.status as LessonStatus)
                : lesson.status,
            version: typeof remote.version === 'number' ? remote.version : lesson.version,
            accessTier:
              remote.access_tier === 'premium' || remote.access_tier === 'free'
                ? remote.access_tier
                : lesson.accessTier,
            words: Array.isArray(content.words) ? (content.words as Lesson['words']) : lesson.words,
            phrases: Array.isArray(content.phrases)
              ? (content.phrases as Lesson['phrases'])
              : lesson.phrases,
            activity:
              typeof content.activity === 'string' ? content.activity : lesson.activity,
            activityConfig:
              content.activityConfig && typeof content.activityConfig === 'object'
                ? (content.activityConfig as Lesson['activityConfig'])
                : lesson.activityConfig,
          }
        }),
      })),
    }))

    return this.getLevels()
  }

  async syncFromSupabase(includeDrafts = false): Promise<{ synced: boolean; count: number; error?: string }> {
    const client = getSupabaseClient()
    if (!client) {
      return { synced: false, count: 0 }
    }

    const query = client
      .from('lessons')
      .select('id, level_id, unit_id, lesson_order, title, objective, parent_tip, access_tier, status, version, content')
      .order('lesson_order', { ascending: true })

    const { data, error } = includeDrafts
      ? await query
      : await query.eq('status', 'published')

    if (error) {
      return { synced: false, count: 0, error: error.message }
    }

    if (data && data.length > 0) {
      this.applyRemoteLessons(data as Array<Record<string, unknown>>)
    }

    return { synced: true, count: data?.length ?? 0 }
  }

  /**
   * Idempotently seeds all 4 levels, 32 units, and 320 lessons to Supabase (admin/editor only).
   * Uses ignoreDuplicates: true so repeated runs never duplicate or overwrite edited content.
   */
  async seedCatalogToSupabase(): Promise<{ ok: boolean; insertedCount: number; error?: string }> {
    const client = getSupabaseClient()
    if (!client) {
      return { ok: false, insertedCount: 0, error: 'Chưa cấu hình Supabase.' }
    }

    const courseRows = this.catalogLevels.map((lvl, idx) => ({
      id: lvl.id,
      name: lvl.name,
      age_label: lvl.age,
      age_range: lvl.range,
      description: lvl.description,
      goal: lvl.goal,
      color: lvl.color,
      emoji: lvl.emoji,
      sort_order: idx + 1,
    }))

    const { error: courseErr } = await client
      .from('courses')
      .upsert(courseRows, { onConflict: 'id', ignoreDuplicates: true })
    if (courseErr) return { ok: false, insertedCount: 0, error: courseErr.message }

    const unitRows = this.catalogLevels.flatMap((lvl) =>
      lvl.units.map((u) => ({
        id: u.id,
        level_id: lvl.id,
        unit_order: u.order,
        title: u.title,
        subtitle: u.subtitle,
        theme_emoji: u.themeEmoji,
        target_lessons_count: u.targetLessonsCount,
      }))
    )

    const { error: unitErr } = await client
      .from('units')
      .upsert(unitRows, { onConflict: 'id', ignoreDuplicates: true })
    if (unitErr) return { ok: false, insertedCount: 0, error: unitErr.message }

    const lessonRows = this.getAllCatalogLessons().map((l) => ({
      id: l.id,
      level_id: l.levelId,
      unit_id: l.unitId,
      lesson_order: l.order,
      pedagogical_slot: l.pedagogicalSlot ?? l.order,
      lesson_type: l.type,
      duration_minutes: l.durationMinutes,
      access_tier: l.accessTier ?? 'free',
      title: l.title,
      objective: l.objective,
      parent_tip: l.parentTip,
      status: l.status,
      version: l.version,
      content: {
        words: l.words,
        phrases: l.phrases,
        activity: l.activity,
        activityConfig: l.activityConfig,
      },
    }))

    // Batch upsert in chunks of 80 with ignoreDuplicates so re-running never creates duplicates
    for (let i = 0; i < lessonRows.length; i += 80) {
      const chunk = lessonRows.slice(i, i + 80)
      const { error: lessonErr } = await client
        .from('lessons')
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true })
      if (lessonErr) {
        return { ok: false, insertedCount: i, error: lessonErr.message }
      }
    }

    return { ok: true, insertedCount: lessonRows.length }
  }

  async saveLessonInSupabase(
    lesson: Lesson,
    editorId?: string
  ): Promise<{ ok: boolean; error?: string }> {
    // Update local catalog state immediately so UI stays consistent
    this.catalogLevels = this.catalogLevels.map((lvl) => ({
      ...lvl,
      units: lvl.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((item) => (item.id === lesson.id ? lesson : item)),
      })),
    }))

    const client = getSupabaseClient()
    if (!client) {
      return { ok: false, error: 'Chưa kết nối Supabase — thay đổi chỉ tạm thời trên phiên hiện tại.' }
    }

    const { error } = await client.from('lessons').upsert(
      {
        id: lesson.id,
        level_id: lesson.levelId,
        unit_id: lesson.unitId,
        lesson_order: lesson.order,
        pedagogical_slot: lesson.pedagogicalSlot ?? lesson.order,
        lesson_type: lesson.type,
        duration_minutes: lesson.durationMinutes,
        access_tier: lesson.accessTier ?? 'free',
        title: lesson.title,
        objective: lesson.objective,
        parent_tip: lesson.parentTip,
        status: lesson.status,
        version: lesson.version,
        updated_by: editorId ?? null,
        updated_at: new Date().toISOString(),
        content: {
          words: lesson.words,
          phrases: lesson.phrases,
          activity: lesson.activity,
          activityConfig: lesson.activityConfig,
        },
      },
      { onConflict: 'id' }
    )

    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: true }
  }
}

export const curriculumRepository = new CurriculumStoreRepository()
