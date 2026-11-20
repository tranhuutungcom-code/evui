import { useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { HomePage } from './components/HomePage'
import { LessonPage } from './components/LessonPage'
import { MobileBottomNav } from './components/MobileBottomNav'
import { ParentPage } from './components/ParentPage'
import { ProgramPage } from './components/ProgramPage'
import { curriculumRepository } from './repositories/curriculumRepository'
import type { LevelId } from './types/curriculum'
import { buildHashPath, parseHashRoute, type RouteState } from './utils/router'
import { cancelSpeech } from './utils/speech'
import {
  clearLocalProgress,
  loadLocalProgress,
  saveLocalProgress,
  type LocalProgressState,
  type SpeechRateMode,
} from './utils/storage'

export default function App() {
  const levels = useMemo(() => curriculumRepository.getLevels(), [])
  const allLessons = useMemo(() => curriculumRepository.getAllLessons(), [])
  const plannedTotalLessons = useMemo(
    () => curriculumRepository.getPlannedTotalLessons(),
    []
  )

  const [route, setRoute] = useState<RouteState>(() =>
    typeof window !== 'undefined'
      ? parseHashRoute(window.location.hash)
      : { page: 'home' }
  )
  const [selectedLevelId, setSelectedLevelId] = useState<LevelId>(() => {
    if (typeof window !== 'undefined') {
      const initial = parseHashRoute(window.location.hash)
      if (initial.page === 'program' && initial.levelId) return initial.levelId
      if (initial.page === 'lesson') {
        const loc = curriculumRepository.getLessonLocation(initial.lessonId)
        if (loc) return loc.level.id
      }
    }
    return levels[0].id
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [progressState, setProgressState] = useState<LocalProgressState>(() =>
    loadLocalProgress()
  )

  useEffect(() => {
    saveLocalProgress(progressState)
  }, [progressState])

  useEffect(() => {
    const handleHashChange = () => {
      cancelSpeech()
      const next = parseHashRoute(window.location.hash)
      setRoute(next)
      setMobileMenuOpen(false)
      if (next.page === 'program' && next.levelId) {
        setSelectedLevelId(next.levelId)
      } else if (next.page === 'lesson') {
        const loc = curriculumRepository.getLessonLocation(next.lessonId)
        if (loc) setSelectedLevelId(loc.level.id)
      }
      window.scrollTo({ top: 0, behavior: 'auto' })
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => {
      cancelSpeech()
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const navigate = useCallback((nextRoute: RouteState) => {
    cancelSpeech()
    const nextHash = buildHashPath(nextRoute)
    setMobileMenuOpen(false)

    if (nextRoute.page === 'program' && nextRoute.levelId) {
      setSelectedLevelId(nextRoute.levelId)
    }

    if (nextRoute.page === 'lesson') {
      const loc = curriculumRepository.getLessonLocation(nextRoute.lessonId)
      if (loc) {
        setSelectedLevelId(loc.level.id)
      }
      setProgressState((prev) => ({
        ...prev,
        lastLessonId: nextRoute.lessonId,
      }))
    }

    if (window.location.hash === nextHash) {
      setRoute(nextRoute)
      window.scrollTo({ top: 0, behavior: 'auto' })
    } else {
      window.location.hash = nextHash
    }
  }, [])

  const handleSelectLevel = useCallback(
    (levelId: LevelId) => {
      setSelectedLevelId(levelId)
      navigate({ page: 'program', levelId })
    },
    [navigate]
  )

  const handleCompleteLesson = useCallback((lessonId: string) => {
    setProgressState((prev) => {
      const alreadyDone = prev.completedIds.includes(lessonId)
      const nextCompleted = alreadyDone
        ? prev.completedIds
        : [...prev.completedIds, lessonId]
      const filteredHistory = prev.history.filter(
        (item) => item.lessonId !== lessonId
      )
      const nextHistory = [
        ...filteredHistory,
        { lessonId, completedAt: new Date().toISOString() },
      ]
      return {
        ...prev,
        completedIds: nextCompleted,
        history: nextHistory,
        lastLessonId: lessonId,
      }
    })
  }, [])

  const handleChangeSpeechRate = useCallback((speechRate: SpeechRateMode) => {
    setProgressState((prev) => ({ ...prev, speechRate }))
  }, [])

  const handleResetProgress = useCallback(() => {
    const reset = clearLocalProgress()
    setProgressState(reset)
  }, [])

  const selectedLevel =
    curriculumRepository.getLevelById(selectedLevelId) ?? levels[0]

  const firstLessonId = allLessons[0]?.id ?? 'L1-01'
  const continueLessonId =
    (progressState.lastLessonId &&
    curriculumRepository.getLessonLocation(progressState.lastLessonId)
      ? progressState.lastLessonId
      : firstLessonId)

  const activeLessonLocation =
    route.page === 'lesson'
      ? curriculumRepository.getLessonLocation(route.lessonId) ??
        curriculumRepository.getLessonLocation(firstLessonId)
      : undefined

  const adjacent = activeLessonLocation
    ? curriculumRepository.getAdjacentLessons(activeLessonLocation.lesson.id)
    : { prev: null, next: null }

  return (
    <div className="app-shell">
      <Header
        currentPage={route.page}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
        onNavigate={navigate}
      />

      {route.page === 'home' && (
        <HomePage
          levels={levels}
          completedIds={progressState.completedIds}
          firstLessonId={firstLessonId}
          onNavigate={navigate}
        />
      )}

      {route.page === 'program' && (
        <ProgramPage
          levels={levels}
          selectedLevel={selectedLevel}
          completedIds={progressState.completedIds}
          plannedTotalLessons={plannedTotalLessons}
          onSelectLevel={handleSelectLevel}
          onNavigate={navigate}
        />
      )}

      {route.page === 'lesson' && activeLessonLocation && (
        <LessonPage
          level={activeLessonLocation.level}
          unit={activeLessonLocation.unit}
          lesson={activeLessonLocation.lesson}
          prevLesson={adjacent.prev}
          nextLesson={adjacent.next}
          isCompleted={progressState.completedIds.includes(
            activeLessonLocation.lesson.id
          )}
          speechRate={progressState.speechRate}
          onChangeSpeechRate={handleChangeSpeechRate}
          onCompleteLesson={handleCompleteLesson}
          onNavigate={navigate}
        />
      )}

      {route.page === 'parent' && (
        <ParentPage
          levels={levels}
          allLessons={allLessons}
          completedIds={progressState.completedIds}
          history={progressState.history}
          plannedTotalLessons={plannedTotalLessons}
          onResetProgress={handleResetProgress}
          onNavigate={navigate}
        />
      )}

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true">
            EL
          </span>
          <div>
            <b>ENGLISH LITTLE WORLD</b>
            <small>Nghe · Nói · Chơi · Lớn khôn</small>
          </div>
        </div>
        <p>
          Học tiếng Anh bằng sự tò mò, niềm vui và những bước tiến nhỏ mỗi ngày.
        </p>
        <div className="footer-bottom">
          <span>© 2026 English Little World · Phiên bản MVP Giai đoạn 1</span>
          <span>Điều khoản · Quyền riêng tư · Đồng hành cùng trẻ</span>
        </div>
      </footer>

      <MobileBottomNav
        currentPage={route.page}
        continueLessonId={continueLessonId}
        onNavigate={navigate}
      />
    </div>
  )
}
