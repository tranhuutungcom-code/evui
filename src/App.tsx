import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPage } from './components/AdminPage'
import { Header } from './components/Header'
import { HomePage } from './components/HomePage'
import { LessonPage } from './components/LessonPage'
import { MobileBottomNav } from './components/MobileBottomNav'
import { ParentPage } from './components/ParentPage'
import { ProgramPage } from './components/ProgramPage'
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabase'
import { curriculumRepository } from './repositories/curriculumRepository'
import {
  fetchChildProfiles,
  fetchChildProgress,
  fetchMembershipPlans,
  fetchOrCreateParentProfile,
  fetchParentConsents,
  fetchParentSubscriptionAndPayments,
  recordLessonAttempt,
  upsertChildLessonProgress,
} from './services/platformService'
import type { LevelId } from './types/curriculum'
import type {
  ChildProfile,
  LessonProgressRecord,
  ParentConsentRecord,
  ParentProfile,
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
} from './types/platform'
import { buildHashPath, parseHashRoute, type RouteState } from './utils/router'
import { cancelSpeech, installSpeechUnlockListener } from './utils/speech'
import {
  clearLocalProgress,
  loadLocalProgress,
  saveLocalProgress,
  type LocalProgressState,
  type SpeechRateMode,
} from './utils/storage'

export default function App() {
  const [catalogVersion, setCatalogVersion] = useState(0)

  const levels = useMemo(() => {
    void catalogVersion
    return curriculumRepository.getLevels()
  }, [catalogVersion])

  const catalogLevels = useMemo(() => {
    void catalogVersion
    return curriculumRepository.getCatalogLevels()
  }, [catalogVersion])

  const allLessons = useMemo(() => {
    void catalogVersion
    return curriculumRepository.getAllLessons()
  }, [catalogVersion])

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
  const [localProgress, setLocalProgress] = useState<LocalProgressState>(() =>
    loadLocalProgress()
  )

  // V2 Account, Child Profile, Progress, Consents, and Billing states
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [parentProfile, setParentProfile] = useState<ParentProfile | null>(null)
  const [childrenList, setChildrenList] = useState<ChildProfile[]>([])
  const [childProgressRecords, setChildProgressRecords] = useState<
    LessonProgressRecord[]
  >([])
  const [consents, setConsents] = useState<ParentConsentRecord[]>([])
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])

  const activeChild = useMemo(() => {
    if (childrenList.length === 0) return null
    const matched = childrenList.find(
      (c) => c.id === localProgress.activeChildId
    )
    return matched ?? childrenList[0]
  }, [childrenList, localProgress.activeChildId])

  const loadAccountBundle = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) {
      setAuthLoading(false)
      return
    }

    setAuthLoading(true)
    try {
      const [plansRes, sessionRes] = await Promise.all([
        fetchMembershipPlans(),
        client.auth.getSession(),
      ])

      if (plansRes.data) {
        setPlans(plansRes.data)
      }

      const user = sessionRes.data.session?.user
      if (!user) {
        setParentProfile(null)
        setChildrenList([])
        setChildProgressRecords([])
        setConsents([])
        setSubscription(null)
        setPayments([])
        await curriculumRepository.syncFromSupabase(false)
        setCatalogVersion((v) => v + 1)
        return
      }

      const profileRes = await fetchOrCreateParentProfile(
        user.id,
        user.email ?? null
      )
      const profile = profileRes.data
      setParentProfile(profile)

      const includeDrafts =
        profile?.role === 'admin' || profile?.role === 'editor'

      const [childrenRes, consentsRes, billingRes] = await Promise.all([
        fetchChildProfiles(user.id),
        fetchParentConsents(user.id),
        fetchParentSubscriptionAndPayments(user.id),
        curriculumRepository.syncFromSupabase(includeDrafts),
      ])

      setCatalogVersion((v) => v + 1)
      if (childrenRes.data) setChildrenList(childrenRes.data)
      if (consentsRes.data) setConsents(consentsRes.data)
      setSubscription(billingRes.subscription)
      setPayments(billingRes.payments)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  // Fetch progress for whichever child profile is currently active
  useEffect(() => {
    if (!activeChild) {
      setChildProgressRecords([])
      return
    }
    fetchChildProgress(activeChild.id).then((res) => {
      if (res.data) setChildProgressRecords(res.data)
    })
  }, [activeChild])

  useEffect(() => {
    saveLocalProgress(localProgress)
  }, [localProgress])

  useEffect(() => {
    loadAccountBundle()
    const client = getSupabaseClient()
    if (!client) return

    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false)
      }
      loadAccountBundle()
    })
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [loadAccountBundle])

  useEffect(() => {
    const cleanupUnlock = installSpeechUnlockListener()

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
      cleanupUnlock()
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
      setLocalProgress((prev) => ({
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

  const handleSelectActiveChild = useCallback((childId: string | null) => {
    setLocalProgress((prev) => ({ ...prev, activeChildId: childId }))
  }, [])

  // Effective progress: uses activeChild DB records when signed in with a child profile, otherwise V1 localStorage
  const completedIds = useMemo(() => {
    if (activeChild) {
      return childProgressRecords
        .filter((r) => r.status === 'completed')
        .map((r) => r.lessonId)
    }
    return localProgress.completedIds
  }, [activeChild, childProgressRecords, localProgress.completedIds])

  const startedIds = useMemo(() => {
    if (activeChild) {
      return childProgressRecords
        .filter((r) => r.status === 'started')
        .map((r) => r.lessonId)
    }
    return localProgress.startedIds
  }, [activeChild, childProgressRecords, localProgress.startedIds])

  const handleSaveProgressStep = useCallback(
    (lessonId: string, step: number, elapsedSeconds: number) => {
      setLocalProgress((prev) => ({
        ...prev,
        startedIds: prev.startedIds.includes(lessonId)
          ? prev.startedIds
          : [...prev.startedIds, lessonId],
        lessonSteps: { ...prev.lessonSteps, [lessonId]: step },
        lastLessonId: lessonId,
      }))

      if (activeChild) {
        const existing = childProgressRecords.find((r) => r.lessonId === lessonId)
        const nextStatus =
          existing?.status === 'completed' ? 'completed' : 'started'
        upsertChildLessonProgress({
          childId: activeChild.id,
          lessonId,
          status: nextStatus,
          currentStep: step,
          timeSpentSeconds: (existing?.timeSpentSeconds ?? 0) + elapsedSeconds,
        }).then((res) => {
          if (res.data) {
            setChildProgressRecords((prev) => {
              const others = prev.filter((r) => r.lessonId !== lessonId)
              return [res.data!, ...others]
            })
          }
        })
      }
    },
    [activeChild, childProgressRecords]
  )

  const handleRecordAttempt = useCallback(
    (lessonId: string, activityKind: string, durationSeconds: number) => {
      if (!activeChild) return
      recordLessonAttempt({
        childId: activeChild.id,
        lessonId,
        activityKind,
        score: 1,
        maxScore: 1,
        durationSeconds,
      })
    },
    [activeChild]
  )

  const handleCompleteLesson = useCallback(
    (lessonId: string, elapsedSeconds: number) => {
      setLocalProgress((prev) => {
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
          lessonSteps: { ...prev.lessonSteps, [lessonId]: 4 },
          history: nextHistory,
          lastLessonId: lessonId,
        }
      })

      if (activeChild) {
        const existing = childProgressRecords.find((r) => r.lessonId === lessonId)
        upsertChildLessonProgress({
          childId: activeChild.id,
          lessonId,
          status: 'completed',
          currentStep: 4,
          score: 100,
          timeSpentSeconds: (existing?.timeSpentSeconds ?? 0) + elapsedSeconds,
        }).then((res) => {
          if (res.data) {
            setChildProgressRecords((prev) => {
              const others = prev.filter((r) => r.lessonId !== lessonId)
              return [res.data!, ...others]
            })
          }
        })
      }
    },
    [activeChild, childProgressRecords]
  )

  const handleChangeSpeechRate = useCallback((speechRate: SpeechRateMode) => {
    setLocalProgress((prev) => ({ ...prev, speechRate }))
  }, [])

  const handleResetProgress = useCallback(() => {
    const reset = clearLocalProgress()
    setLocalProgress(reset)
  }, [])

  const selectedLevel =
    curriculumRepository.getLevelById(selectedLevelId) ?? levels[0]

  const firstLessonId = allLessons[0]?.id ?? 'L1-01'
  const continueLessonId =
    localProgress.lastLessonId &&
    curriculumRepository.getLessonLocation(localProgress.lastLessonId)
      ? localProgress.lastLessonId
      : firstLessonId

  const activeLessonLocation =
    route.page === 'lesson'
      ? curriculumRepository.getLessonLocation(route.lessonId) ??
        curriculumRepository.getLessonLocation(firstLessonId)
      : undefined

  const adjacent = activeLessonLocation
    ? curriculumRepository.getAdjacentLessons(activeLessonLocation.lesson.id)
    : { prev: null, next: null }

  const hasAiConsent = consents.some(
    (c) => c.consentType === 'ai_buddy' && !c.revokedAt
  )

  const activeLessonStep = activeLessonLocation
    ? childProgressRecords.find(
        (r) => r.lessonId === activeLessonLocation.lesson.id
      )?.currentStep ??
      localProgress.lessonSteps[activeLessonLocation.lesson.id] ??
      0
    : 0

  return (
    <div className="app-shell">
      <Header
        currentPage={route.page}
        mobileMenuOpen={mobileMenuOpen}
        activeChild={activeChild}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
        onNavigate={navigate}
      />

      {route.page === 'home' && (
        <HomePage
          levels={levels}
          completedIds={completedIds}
          firstLessonId={firstLessonId}
          onNavigate={navigate}
        />
      )}

      {route.page === 'program' && (
        <ProgramPage
          levels={levels}
          selectedLevel={selectedLevel}
          completedIds={completedIds}
          startedIds={startedIds}
          activeChild={activeChild}
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
          isCompleted={completedIds.includes(activeLessonLocation.lesson.id)}
          isStarted={startedIds.includes(activeLessonLocation.lesson.id)}
          initialStep={activeLessonStep}
          speechRate={localProgress.speechRate}
          activeChild={activeChild}
          hasAiConsent={hasAiConsent}
          isAuthenticated={Boolean(parentProfile)}
          onChangeSpeechRate={handleChangeSpeechRate}
          onSaveProgressStep={handleSaveProgressStep}
          onRecordAttempt={handleRecordAttempt}
          onCompleteLesson={handleCompleteLesson}
          onNavigate={navigate}
        />
      )}

      {route.page === 'parent' && (
        <ParentPage
          levels={levels}
          allLessons={allLessons}
          completedIds={completedIds}
          startedIds={startedIds}
          history={localProgress.history}
          progressRecords={childProgressRecords}
          plannedTotalLessons={plannedTotalLessons}
          parentProfile={parentProfile}
          childrenList={childrenList}
          activeChild={activeChild}
          consents={consents}
          plans={plans}
          subscription={subscription}
          payments={payments}
          authLoading={authLoading}
          isPasswordRecovery={isPasswordRecovery}
          onSelectActiveChild={handleSelectActiveChild}
          onRefreshAccountData={loadAccountBundle}
          onResetProgress={handleResetProgress}
          onNavigate={navigate}
        />
      )}

      {route.page === 'admin' && (
        <AdminPage
          catalogLevels={catalogLevels}
          parentProfile={parentProfile}
          onCatalogUpdated={() => setCatalogVersion((v) => v + 1)}
          onNavigate={navigate}
        />
      )}

      <footer className="site-footer">
        <div className="footer-brand">
          <img
            src="/logo-evui.png"
            alt="Logo English Little World"
            className="brand-logo footer-logo"
            width={44}
            height={44}
            decoding="async"
          />
          <div>
            <b>ENGLISH LITTLE WORLD</b>
            <small>Learn · Play · Speak · Grow</small>
          </div>
        </div>
        <p>
          Học tiếng Anh bằng sự tò mò, niềm vui và những bước tiến nhỏ mỗi ngày.
        </p>
        <div className="footer-bottom">
          <span>© 2026 English Little World · Phiên bản V2</span>
          <span>Điều khoản · Quyền riêng tư trẻ em · Đồng hành cùng gia đình</span>
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
