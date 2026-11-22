import { Menu, Users, X } from 'lucide-react'
import type { ChildProfile } from '../types/platform'
import type { RouteState } from '../utils/router'

interface HeaderProps {
  currentPage: RouteState['page']
  mobileMenuOpen: boolean
  activeChild: ChildProfile | null
  onToggleMobileMenu: () => void
  onNavigate: (route: RouteState) => void
}

export function Header({
  currentPage,
  mobileMenuOpen,
  activeChild,
  onToggleMobileMenu,
  onNavigate,
}: HeaderProps) {
  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => onNavigate({ page: 'home' })}
        >
          <img
            src="/logo-evui.png"
            alt="Logo English Little World"
            className="brand-logo"
            width={40}
            height={40}
            decoding="async"
          />
          <span className="brand-name">ENGLISH LITTLE WORLD</span>
        </button>

        <nav className="desktop-nav" aria-label="Điều hướng chính">
          <button
            type="button"
            className={currentPage === 'home' ? 'active' : ''}
            aria-current={currentPage === 'home' ? 'page' : undefined}
            onClick={() => onNavigate({ page: 'home' })}
          >
            Trang chủ
          </button>
          <button
            type="button"
            className={
              currentPage === 'program' || currentPage === 'lesson'
                ? 'active'
                : ''
            }
            aria-current={currentPage === 'program' ? 'page' : undefined}
            onClick={() => onNavigate({ page: 'program' })}
          >
            Chương trình
          </button>
          <button
            type="button"
            className={currentPage === 'parent' || currentPage === 'admin' ? 'active' : ''}
            aria-current={currentPage === 'parent' ? 'page' : undefined}
            onClick={() => onNavigate({ page: 'parent' })}
          >
            Phụ huynh
          </button>
        </nav>

        <div className="top-actions">
          {activeChild && (
            <button
              type="button"
              className="active-child-pill"
              onClick={() => onNavigate({ page: 'parent' })}
              title="Đổi hồ sơ bé"
            >
              <span aria-hidden="true">{activeChild.avatarEmoji}</span>
              <span>{activeChild.nickname}</span>
            </button>
          )}
          <button
            type="button"
            className="parent-btn"
            onClick={() => onNavigate({ page: 'parent' })}
          >
            <Users size={17} aria-hidden="true" />
            <span>Góc phụ huynh</span>
          </button>
          <button
            type="button"
            className="mobile-menu"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <nav className="mobile-nav" aria-label="Menu di động">
          <button
            type="button"
            className={currentPage === 'home' ? 'active' : ''}
            onClick={() => onNavigate({ page: 'home' })}
          >
            Trang chủ
          </button>
          <button
            type="button"
            className={currentPage === 'program' ? 'active' : ''}
            onClick={() => onNavigate({ page: 'program' })}
          >
            Chương trình học
          </button>
          <button
            type="button"
            className={currentPage === 'parent' ? 'active' : ''}
            onClick={() => onNavigate({ page: 'parent' })}
          >
            Dành cho phụ huynh
          </button>
          <button
            type="button"
            className={currentPage === 'admin' ? 'active' : ''}
            onClick={() => onNavigate({ page: 'admin' })}
          >
            Quản trị nội dung (CMS)
          </button>
        </nav>
      )}
    </>
  )
}
