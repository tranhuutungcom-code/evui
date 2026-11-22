import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Edit3,
  FileCheck2,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { curriculumRepository } from '../repositories/curriculumRepository'
import type {
  AccessTier,
  Lesson,
  LessonStatus,
  Level,
  LevelId,
} from '../types/curriculum'
import type { ParentProfile } from '../types/platform'
import type { RouteState } from '../utils/router'

interface AdminPageProps {
  catalogLevels: Level[]
  parentProfile: ParentProfile | null
  onCatalogUpdated: () => void
  onNavigate: (route: RouteState) => void
}

const STATUS_LABELS: Record<LessonStatus, string> = {
  draft: 'Bản nháp (Draft)',
  review: 'Chờ duyệt (In Review)',
  published: 'Đã xuất bản (Published)',
  archived: 'Lưu trữ (Archived)',
}

export function AdminPage({
  catalogLevels,
  parentProfile,
  onCatalogUpdated,
  onNavigate,
}: AdminPageProps) {
  const [filterLevel, setFilterLevel] = useState<'all' | LevelId>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | LessonStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const isEditorRole =
    parentProfile?.role === 'admin' || parentProfile?.role === 'editor'

  const allLessons = useMemo(
    () => catalogLevels.flatMap((lvl) => lvl.units.flatMap((u) => u.lessons)),
    [catalogLevels]
  )

  const stats = useMemo(() => {
    const counts: Record<LessonStatus, number> = {
      draft: 0,
      review: 0,
      published: 0,
      archived: 0,
    }
    for (const l of allLessons) {
      counts[l.status] += 1
    }
    return counts
  }, [allLessons])

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allLessons.filter((l) => {
      if (filterLevel !== 'all' && l.levelId !== filterLevel) return false
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (
        q &&
        !l.id.toLowerCase().includes(q) &&
        !l.title.toLowerCase().includes(q) &&
        !l.objective.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [allLessons, filterLevel, filterStatus, searchQuery])

  const handleSeed320 = async () => {
    setSeeding(true)
    setNotice('')
    setErrorMsg('')
    const res = await curriculumRepository.seedCatalogToSupabase()
    setSeeding(false)
    if (!res.ok) {
      setErrorMsg(res.error || 'Không thể đồng bộ khung 320 bài lên Supabase.')
    } else {
      setNotice(
        `Đã đồng bộ an toàn ${res.insertedCount} bản ghi bài học (4×8×10) theo cơ chế chống trùng lặp (ON CONFLICT DO NOTHING).`
      )
      onCatalogUpdated()
    }
  }

  const handleSaveLesson = async () => {
    if (!editingLesson) return
    setSaving(true)
    setNotice('')
    setErrorMsg('')

    const nextLesson: Lesson = {
      ...editingLesson,
      version: editingLesson.version + 1,
    }

    const res = await curriculumRepository.saveLessonInSupabase(
      nextLesson,
      parentProfile?.id
    )
    setSaving(false)
    onCatalogUpdated()

    if (!res.ok) {
      setErrorMsg(res.error || 'Không thể lưu lên Supabase.')
    } else {
      setNotice(
        `Đã cập nhật bài ${nextLesson.id} (trạng thái: ${STATUS_LABELS[nextLesson.status]}). Lịch sử học tập của trẻ giữ nguyên theo Lesson ID.`
      )
      setEditingLesson(null)
    }
  }

  return (
    <main className="content-page">
      <div className="lesson-topbar-nav">
        <button
          type="button"
          className="back-link"
          onClick={() => onNavigate({ page: 'parent' })}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Quay lại Góc phụ huynh</span>
        </button>
      </div>

      <div className="page-title">
        <p className="eyebrow">Quản trị nội dung &amp; Xuất bản (320 bài học)</p>
        <h1>Biên tập &amp; Duyệt bài học</h1>
        <p>
          Quản lý quy trình sư phạm <strong>Draft → In Review → Published → Archived</strong>.
          Chỉ bài học ở trạng thái <strong>Published</strong> mới hiển thị trong
          khu vực học tập của trẻ.
        </p>
      </div>

      {(!isSupabaseConfigured || !isEditorRole) && (
        <div className="admin-guard-banner" role="alert">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <strong>Chế độ xem trước phân quyền biên tập:</strong>{' '}
            {!isSupabaseConfigured
              ? 'Chưa cấu hình biến môi trường Supabase nên các thay đổi chỉ lưu tạm trong phiên hiện tại.'
              : 'Tài khoản hiện tại có vai trò "parent". Chỉ tài khoản có quyền "editor" hoặc "admin" trong bảng parent_profiles mới được phép ghi/xuất bản bài học lên cơ sở dữ liệu Supabase (được bảo vệ bởi RLS).'}
          </div>
        </div>
      )}

      <div className="stats-grid tabular-nums cms-stats-grid">
        <div className="stat-box">
          <b>{allLessons.length}</b>
          <small>Tổng khung 4×8×10</small>
        </div>
        <div className="stat-box">
          <b>{stats.published}</b>
          <small>Đã xuất bản (Published)</small>
        </div>
        <div className="stat-box">
          <b>{stats.draft + stats.review}</b>
          <small>Nháp &amp; Chờ duyệt</small>
        </div>
      </div>

      <div className="cms-toolbar">
        <div className="cms-filters">
          <div className="cms-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã bài (L1-01) hoặc tiêu đề..."
            />
          </div>

          <select
            aria-label="Lọc theo cấp độ"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as 'all' | LevelId)}
          >
            <option value="all">Tất cả cấp độ (L1–L4)</option>
            <option value="L1">L1 – Little Explorers</option>
            <option value="L2">L2 – Little Learners</option>
            <option value="L3">L3 – Young Learners</option>
            <option value="L4">L4 – Junior English</option>
          </select>

          <select
            aria-label="Lọc theo trạng thái"
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | LessonStatus)
            }
          >
            <option value="all">Mọi trạng thái</option>
            <option value="published">Published</option>
            <option value="review">In Review</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <button
          type="button"
          className="outline-btn"
          disabled={seeding || !isSupabaseConfigured || !isEditorRole}
          onClick={handleSeed320}
        >
          <Database size={16} aria-hidden="true" />
          <span>
            {seeding ? 'Đang đồng bộ...' : 'Đồng bộ khung 320 bài lên Supabase'}
          </span>
        </button>
      </div>

      {notice && (
        <div className="feedback success-banner" role="status">
          <CheckCircle2 size={18} aria-hidden="true" /> {notice}
        </div>
      )}
      {errorMsg && (
        <div className="activity-feedback retry" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {editingLesson && (
        <div className="parent-panel cms-editor-panel">
          <div className="panel-head-row">
            <h3>
              <FileCheck2 size={18} aria-hidden="true" /> Chỉnh sửa bài học:{' '}
              {editingLesson.id}
            </h3>
            <button
              type="button"
              className="outline-btn"
              onClick={() => setEditingLesson(null)}
            >
              Đóng
            </button>
          </div>

          <div className="cms-form-grid">
            <label>
              <span>Tiêu đề bài học</span>
              <input
                type="text"
                value={editingLesson.title}
                onChange={(e) =>
                  setEditingLesson({ ...editingLesson, title: e.target.value })
                }
              />
            </label>

            <label>
              <span>Trạng thái xuất bản</span>
              <select
                value={editingLesson.status}
                onChange={(e) =>
                  setEditingLesson({
                    ...editingLesson,
                    status: e.target.value as LessonStatus,
                  })
                }
              >
                <option value="draft">Draft (Bản nháp — ẩn khỏi trẻ)</option>
                <option value="review">In Review (Chờ duyệt sư phạm)</option>
                <option value="published">
                  Published (Đã duyệt — hiển thị cho trẻ)
                </option>
                <option value="archived">Archived (Lưu trữ)</option>
              </select>
            </label>

            <label>
              <span>Phân loại gói</span>
              <select
                value={editingLesson.accessTier ?? 'free'}
                onChange={(e) =>
                  setEditingLesson({
                    ...editingLesson,
                    accessTier: e.target.value as AccessTier,
                  })
                }
              >
                <option value="free">Miễn phí (Free)</option>
                <option value="premium">Thành viên (Premium / Family)</option>
              </select>
            </label>

            <label className="full-span">
              <span>Mục tiêu bài học</span>
              <textarea
                rows={2}
                value={editingLesson.objective}
                onChange={(e) =>
                  setEditingLesson({
                    ...editingLesson,
                    objective: e.target.value,
                  })
                }
              />
            </label>

            <label className="full-span">
              <span>Lời khuyên dành cho phụ huynh</span>
              <textarea
                rows={2}
                value={editingLesson.parentTip}
                onChange={(e) =>
                  setEditingLesson({
                    ...editingLesson,
                    parentTip: e.target.value,
                  })
                }
              />
            </label>
          </div>

          <div className="cms-editor-actions">
            <button
              type="button"
              className="primary compact"
              disabled={saving}
              onClick={handleSaveLesson}
            >
              <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi bài học'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="cms-lesson-table">
        {filteredLessons.slice(0, 60).map((lesson) => (
          <div className="cms-lesson-row" key={lesson.id}>
            <div className="cms-lesson-main">
              <div className="cms-lesson-badges">
                <span className="cms-id-tag tabular-nums">{lesson.id}</span>
                <span className={`cms-status-tag status-${lesson.status}`}>
                  {lesson.status}
                </span>
                <span className="cms-tier-tag">
                  {lesson.accessTier === 'premium' ? 'Premium' : 'Free'}
                </span>
              </div>
              <h4>{lesson.title}</h4>
              <p>{lesson.objective}</p>
            </div>
            <button
              type="button"
              className="outline-btn"
              onClick={() => setEditingLesson({ ...lesson })}
            >
              <Edit3 size={15} aria-hidden="true" />
              <span>Biên tập</span>
            </button>
          </div>
        ))}
        {filteredLessons.length > 60 && (
          <p className="muted cms-more-note">
            Đang hiển thị 60/{filteredLessons.length} bài khớp bộ lọc. Hãy dùng ô
            tìm kiếm hoặc chọn cấp độ cụ thể để thu hẹp danh sách.
          </p>
        )}
      </div>
    </main>
  )
}
