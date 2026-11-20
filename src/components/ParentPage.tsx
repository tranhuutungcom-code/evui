import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Star,
  Trophy,
} from 'lucide-react'
import type { Lesson, Level } from '../types/curriculum'
import type { RouteState } from '../utils/router'
import type { HistoryEntry } from '../utils/storage'

interface ParentPageProps {
  levels: Level[]
  allLessons: Lesson[]
  completedIds: string[]
  history: HistoryEntry[]
  plannedTotalLessons: number
  onResetProgress: () => void
  onNavigate: (route: RouteState) => void
}

export function ParentPage({
  levels,
  allLessons,
  completedIds,
  history,
  plannedTotalLessons,
  onResetProgress,
  onNavigate,
}: ParentPageProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)

  const progressPercent =
    allLessons.length > 0
      ? Math.round((completedIds.length / allLessons.length) * 100)
      : 0

  return (
    <main className="content-page">
      <div className="page-title">
        <p className="eyebrow">Góc đồng hành của phụ huynh</p>
        <h1>Đồng hành cùng con</h1>
        <p>
          Theo dõi tiến độ học tập trên thiết bị này và xem gợi ý hỗ trợ bé học
          tại nhà một cách nhẹ nhàng.
        </p>
      </div>

      <div className="parent-grid">
        <div className="parent-main">
          <div className="progress-card">
            <div>
              <p className="eyebrow">Tổng quan học tập</p>
              <h2>Hành trình của bé</h2>
              <p className="muted">
                Dữ liệu hiện được lưu cục bộ trên trình duyệt (Giai đoạn 1). Kết
                nối tài khoản phụ huynh và hồ sơ nhiều bé trên Supabase sẽ có ở
                Giai đoạn 2.
              </p>
            </div>
            <div className="progress-ring tabular-nums">
              <b>{progressPercent}%</b>
              <small>bài mẫu</small>
            </div>
          </div>

          <div className="stats-grid tabular-nums">
            <div className="stat-box">
              <BookOpen size={20} aria-hidden="true" />
              <b>{completedIds.length}</b>
              <small>Bài đã hoàn thành</small>
            </div>
            <div className="stat-box">
              <Trophy size={20} aria-hidden="true" />
              <b>{allLessons.length}</b>
              <small>Bài mẫu hiện có</small>
            </div>
            <div className="stat-box">
              <Star size={20} aria-hidden="true" />
              <b>{plannedTotalLessons}</b>
              <small>Lộ trình 4×8×10 bài</small>
            </div>
          </div>

          <div className="parent-panel">
            <h3>Tiến độ theo từng cấp độ</h3>
            <div className="level-progress-list">
              {levels.map((level) => {
                const levelLessons = level.units.flatMap((u) => u.lessons)
                const done = levelLessons.filter((l) =>
                  completedIds.includes(l.id)
                ).length
                const pct =
                  levelLessons.length > 0
                    ? Math.round((done / levelLessons.length) * 100)
                    : 0

                return (
                  <div className="level-progress-row" key={level.id}>
                    <div className="level-progress-label">
                      <span>
                        <strong className="level-short">{level.name}</strong>{' '}
                        <small>({level.age})</small>
                      </span>
                      <span className="tabular-nums">
                        {done}/{levelLessons.length} bài
                      </span>
                    </div>
                    <div className="mini-progress-track">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="parent-panel">
            <div className="panel-head-row">
              <h3>Lịch sử hoàn thành gần đây</h3>
              {completedIds.length > 0 && !confirmingReset && (
                <button
                  type="button"
                  className="text-reset-btn"
                  onClick={() => setConfirmingReset(true)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  <span>Đặt lại tiến độ</span>
                </button>
              )}
            </div>

            {confirmingReset && (
              <div className="inline-confirm-box" role="alert">
                <span>Xóa toàn bộ tiến độ dùng thử trên thiết bị này?</span>
                <div className="inline-confirm-actions">
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => {
                      onResetProgress()
                      setConfirmingReset(false)
                    }}
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setConfirmingReset(false)}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {completedIds.length === 0 ? (
              <div className="empty-history">
                <p className="muted">
                  Chưa có bài học hoàn thành. Hãy cùng bé trải nghiệm bài học
                  đầu tiên nhé!
                </p>
                <button
                  type="button"
                  className="outline-btn"
                  onClick={() => onNavigate({ page: 'program' })}
                >
                  <span>Chọn bài học</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="history-list">
                {completedIds
                  .slice()
                  .reverse()
                  .map((id) => {
                    const lesson = allLessons.find((l) => l.id === id)
                    const entry = history.find((h) => h.lessonId === id)
                    return (
                      <button
                        type="button"
                        className="history-row"
                        key={id}
                        onClick={() =>
                          onNavigate({ page: 'lesson', lessonId: id })
                        }
                      >
                        <CheckCircle2 size={18} aria-hidden="true" />
                        <span className="history-title">
                          {lesson?.title ?? id}
                        </span>
                        <small className="tabular-nums">
                          {entry
                            ? new Date(entry.completedAt).toLocaleDateString(
                                'vi-VN'
                              )
                            : 'Hoàn thành'}
                        </small>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        <aside className="parent-tips">
          <div className="side-card">
            <span className="side-icon" aria-hidden="true">
              💡
            </span>
            <h3>Gợi ý đồng hành</h3>
            <ul>
              <li>Học ngắn (5–15 phút) và đều đặn mỗi ngày.</li>
              <li>Nghe lại câu quen thuộc trong sinh hoạt hằng ngày.</li>
              <li>Khen sự cố gắng thay vì chỉ khen kết quả đúng.</li>
              <li>Không so sánh tốc độ tiếp thu của trẻ với bạn khác.</li>
            </ul>
          </div>

          <div className="side-card safety-card">
            <ShieldCheck size={22} aria-hidden="true" />
            <h3>Quyền riêng tư của trẻ</h3>
            <p>
              Phiên bản hiện tại không tạo tài khoản trẻ, không gửi bản ghi âm
              giọng nói lên máy chủ và chưa bật AI hội thoại. Trước khi mở AI ở
              giai đoạn sau, phụ huynh sẽ toàn quyền bật/tắt và giới hạn chủ đề
              theo độ tuổi.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}
