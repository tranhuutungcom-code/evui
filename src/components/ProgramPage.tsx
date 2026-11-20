import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Play,
} from 'lucide-react'
import type { LessonType, Level, LevelId } from '../types/curriculum'
import type { RouteState } from '../utils/router'

interface ProgramPageProps {
  levels: Level[]
  selectedLevel: Level
  completedIds: string[]
  plannedTotalLessons: number
  onSelectLevel: (levelId: LevelId) => void
  onNavigate: (route: RouteState) => void
}

const TYPE_LABELS: Record<'all' | LessonType, string> = {
  all: 'Tất cả',
  listen: 'Nghe',
  speak: 'Nói',
  play: 'Chơi',
  story: 'Truyện',
}

export function ProgramPage({
  levels,
  selectedLevel,
  completedIds,
  plannedTotalLessons,
  onSelectLevel,
  onNavigate,
}: ProgramPageProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | LessonType>('all')
  const [showRoadmap, setShowRoadmap] = useState(false)

  const activeUnit = selectedLevel.units[0]
  const plannedUnits = selectedLevel.units.slice(1)
  const levelLessons = selectedLevel.units.flatMap((u) => u.lessons)
  const completedInLevel = levelLessons.filter((l) =>
    completedIds.includes(l.id)
  ).length

  const filteredLessons =
    typeFilter === 'all'
      ? activeUnit.lessons
      : activeUnit.lessons.filter((l) => l.type === typeFilter)

  return (
    <main className="content-page">
      <div className="page-title">
        <p className="eyebrow">Lộ trình học 3–11 tuổi</p>
        <h1>Chương trình học</h1>
        <p>
          Bốn cấp độ được thiết kế theo kiến trúc{' '}
          <strong className="tabular-nums">
            4 cấp độ × 8 đơn vị × 10 bài ({plannedTotalLessons} bài)
          </strong>
          . Phiên bản hiện tại mở sẵn 16 bài tương tác mẫu để bé và phụ huynh
          trải nghiệm trước.
        </p>
      </div>

      <div className="program-layout">
        <aside className="level-sidebar" aria-label="Chọn cấp độ học">
          <h3>Chọn cấp độ</h3>
          <div className="level-picker-list">
            {levels.map((level) => {
              const isSelected = selectedLevel.id === level.id
              return (
                <button
                  type="button"
                  key={level.id}
                  className={isSelected ? 'selected' : ''}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setTypeFilter('all')
                    onSelectLevel(level.id)
                  }}
                >
                  <span className={`dot ${level.color}`} aria-hidden="true" />
                  <span className="level-option-text">
                    <b>{level.name}</b>
                    <small>{level.age}</small>
                  </span>
                  <ArrowRight
                    size={16}
                    className="level-arrow"
                    aria-hidden="true"
                  />
                </button>
              )
            })}
          </div>
        </aside>

        <section className="lesson-list">
          <div className={`level-banner ${selectedLevel.color}`}>
            <div>
              <p className="eyebrow">
                {selectedLevel.age} · {selectedLevel.range}
              </p>
              <h2>{selectedLevel.name}</h2>
              <p>{selectedLevel.description}</p>
              <div className="level-banner-meta">
                <span>
                  Mục tiêu: <strong>{selectedLevel.goal}</strong>
                </span>
                <span className="tabular-nums">
                  Đã hoàn thành: {completedInLevel}/{levelLessons.length} bài mẫu
                </span>
              </div>
            </div>
            <div className="level-emoji" aria-hidden="true">
              {selectedLevel.emoji}
            </div>
          </div>

          <div className="unit-header-bar">
            <div>
              <h3>{activeUnit.title}</h3>
              <p className="unit-subtitle">
                {activeUnit.subtitle} · {activeUnit.lessons.length}/
                {activeUnit.targetLessonsCount} bài đã mở
              </p>
            </div>

            <div
              className="filter-tabs"
              role="group"
              aria-label="Lọc theo dạng bài học"
            >
              {(Object.keys(TYPE_LABELS) as Array<'all' | LessonType>).map(
                (key) => (
                  <button
                    type="button"
                    key={key}
                    className={typeFilter === key ? 'active' : ''}
                    aria-pressed={typeFilter === key}
                    onClick={() => setTypeFilter(key)}
                  >
                    {TYPE_LABELS[key]}
                  </button>
                )
              )}
            </div>
          </div>

          {filteredLessons.length === 0 ? (
            <div className="empty-filter-box">
              <p>Chưa có bài dạng "{TYPE_LABELS[typeFilter]}" trong đơn vị này.</p>
              <button
                type="button"
                className="outline-btn"
                onClick={() => setTypeFilter('all')}
              >
                Xem tất cả bài học
              </button>
            </div>
          ) : (
            <div className="lesson-rows">
              {filteredLessons.map((lesson, idx) => {
                const isDone = completedIds.includes(lesson.id)
                return (
                  <div
                    className={`lesson-row ${isDone ? 'is-done' : ''}`}
                    key={lesson.id}
                  >
                    <div className="lesson-index tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="lesson-info">
                      <h4>{lesson.title}</h4>
                      <p>{lesson.objective}</p>
                      <div className="lesson-meta-line tabular-nums">
                        <span>{TYPE_LABELS[lesson.type]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lesson.duration}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lesson.words.length} từ trọng tâm</span>
                      </div>
                    </div>

                    <div className="lesson-row-actions">
                      <span
                        className={`lesson-status ${isDone ? 'done' : 'pending'}`}
                        aria-label={
                          isDone ? 'Đã hoàn thành' : 'Chưa hoàn thành'
                        }
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 size={18} aria-hidden="true" />
                            <span className="status-label">Đã xong</span>
                          </>
                        ) : (
                          <span className="play-circle" aria-hidden="true">
                            <Play size={14} />
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() =>
                          onNavigate({ page: 'lesson', lessonId: lesson.id })
                        }
                      >
                        <span>{isDone ? 'Ôn lại' : 'Học bài'}</span>
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="roadmap-box">
            <button
              type="button"
              className="roadmap-toggle"
              aria-expanded={showRoadmap}
              onClick={() => setShowRoadmap((v) => !v)}
            >
              <span className="roadmap-title">
                <Layers size={18} aria-hidden="true" />
                <span>
                  Khung mở rộng 8 đơn vị của {selectedLevel.name} (
                  {selectedLevel.units.length * 10} bài dự kiến)
                </span>
              </span>
              {showRoadmap ? (
                <ChevronUp size={18} aria-hidden="true" />
              ) : (
                <ChevronDown size={18} aria-hidden="true" />
              )}
            </button>

            {showRoadmap && (
              <div className="roadmap-grid">
                {plannedUnits.map((unit) => (
                  <div className="roadmap-card" key={unit.id}>
                    <div className="roadmap-card-head">
                      <span aria-hidden="true">{unit.themeEmoji}</span>
                      <strong className="tabular-nums">
                        {unit.targetLessonsCount} bài dự kiến
                      </strong>
                    </div>
                    <h4>{unit.title}</h4>
                    <p>{unit.subtitle}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
