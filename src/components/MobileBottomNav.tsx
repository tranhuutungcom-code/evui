import { BookOpen, Home, PlayCircle, Users } from 'lucide-react'
import type { RouteState } from '../utils/router'

interface MobileBottomNavProps {
  currentPage: RouteState['page']
  continueLessonId: string
  onNavigate: (route: RouteState) => void
}

export function MobileBottomNav({
  currentPage,
  continueLessonId,
  onNavigate,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Thanh điều hướng nhanh">
      <button
        type="button"
        className={currentPage === 'home' ? 'active' : ''}
        aria-current={currentPage === 'home' ? 'page' : undefined}
        onClick={() => onNavigate({ page: 'home' })}
      >
        <Home size={22} aria-hidden="true" />
        <span>Trang chủ</span>
      </button>
      <button
        type="button"
        className={currentPage === 'program' ? 'active' : ''}
        aria-current={currentPage === 'program' ? 'page' : undefined}
        onClick={() => onNavigate({ page: 'program' })}
      >
        <BookOpen size={22} aria-hidden="true" />
        <span>Lộ trình</span>
      </button>
      <button
        type="button"
        className={currentPage === 'lesson' ? 'active' : ''}
        aria-current={currentPage === 'lesson' ? 'page' : undefined}
        onClick={() =>
          onNavigate({ page: 'lesson', lessonId: continueLessonId })
        }
      >
        <PlayCircle size={22} aria-hidden="true" />
        <span>Học bài</span>
      </button>
      <button
        type="button"
        className={currentPage === 'parent' || currentPage === 'admin' ? 'active' : ''}
        aria-current={currentPage === 'parent' ? 'page' : undefined}
        onClick={() => onNavigate({ page: 'parent' })}
      >
        <Users size={22} aria-hidden="true" />
        <span>Phụ huynh</span>
      </button>
    </nav>
  )
}
