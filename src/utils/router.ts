import type { LevelId } from '../types/curriculum'

export type RouteState =
  | { page: 'home' }
  | { page: 'program'; levelId?: LevelId }
  | { page: 'lesson'; lessonId: string }
  | { page: 'parent' }

const VALID_LEVELS: LevelId[] = ['L1', 'L2', 'L3', 'L4']

export function parseHashRoute(hash: string): RouteState {
  const cleaned = hash.replace(/^#\/?/, '').trim()
  if (!cleaned) return { page: 'home' }

  const parts = cleaned.split('/').filter(Boolean)
  const root = parts[0]

  if (root === 'chuong-trinh') {
    const maybeLevel = parts[1]?.toUpperCase() as LevelId | undefined
    if (maybeLevel && VALID_LEVELS.includes(maybeLevel)) {
      return { page: 'program', levelId: maybeLevel }
    }
    return { page: 'program' }
  }

  if (root === 'bai-hoc' && parts[1]) {
    return { page: 'lesson', lessonId: decodeURIComponent(parts[1]) }
  }

  if (root === 'phu-huynh') {
    return { page: 'parent' }
  }

  return { page: 'home' }
}

export function buildHashPath(route: RouteState): string {
  switch (route.page) {
    case 'home':
      return '#/'
    case 'program':
      return route.levelId ? `#/chuong-trinh/${route.levelId}` : '#/chuong-trinh'
    case 'lesson':
      return `#/bai-hoc/${encodeURIComponent(route.lessonId)}`
    case 'parent':
      return '#/phu-huynh'
  }
}
