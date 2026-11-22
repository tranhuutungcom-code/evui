import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileEdit,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { checkMomoPaymentStatus, createMomoPaymentSession } from '../services/aiService'
import {
  createChildProfile,
  deleteChildProfile,
  saveParentConsent,
  sendParentPasswordReset,
  signInParentAccount,
  signOutParentAccount,
  signUpParentAccount,
  toggleCancelSubscriptionRenewal,
  updateChildProfile,
  updateParentPassword,
  updateParentProfileInfo,
} from '../services/platformService'
import type { Lesson, Level, LevelId } from '../types/curriculum'
import type {
  ChildProfile,
  LessonProgressRecord,
  ParentConsentRecord,
  ParentProfile,
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
} from '../types/platform'
import type { RouteState } from '../utils/router'
import type { HistoryEntry } from '../utils/storage'
import { PWAInstallButton } from './PWAInstallButton'

interface ParentPageProps {
  levels: Level[]
  allLessons: Lesson[]
  completedIds: string[]
  startedIds: string[]
  history: HistoryEntry[]
  progressRecords: LessonProgressRecord[]
  plannedTotalLessons: number
  parentProfile: ParentProfile | null
  childrenList: ChildProfile[]
  activeChild: ChildProfile | null
  consents: ParentConsentRecord[]
  plans: PlanRecord[]
  subscription: SubscriptionRecord | null
  payments: PaymentRecord[]
  authLoading: boolean
  isPasswordRecovery: boolean
  onSelectActiveChild: (childId: string | null) => void
  onRefreshAccountData: () => Promise<void>
  onResetProgress: () => void
  onNavigate: (route: RouteState) => void
}

type ParentTab = 'overview' | 'safety' | 'billing'

const AVATAR_OPTIONS = ['🐣', '🦊', '🐼', '🦁', '🐰', '🦄']

function suggestLevelByAge(age: number): LevelId {
  if (age <= 4) return 'L1'
  if (age <= 6) return 'L2'
  if (age <= 9) return 'L3'
  return 'L4'
}

function formatVnd(amount: number): string {
  if (amount === 0) return '0đ'
  return `${amount.toLocaleString('vi-VN')}đ`
}

export function ParentPage({
  levels,
  allLessons,
  completedIds,
  startedIds,
  history,
  progressRecords,
  plannedTotalLessons,
  parentProfile,
  childrenList,
  activeChild,
  consents,
  plans,
  subscription,
  payments,
  authLoading,
  isPasswordRecovery,
  onSelectActiveChild,
  onRefreshAccountData,
  onResetProgress,
  onNavigate,
}: ParentPageProps) {
  const [activeTab, setActiveTab] = useState<ParentTab>('overview')
  const [confirmingReset, setConfirmingReset] = useState(false)

  // Optional parent math gate when switching from active child learning mode
  const [gateUnlocked, setGateUnlocked] = useState(() => !activeChild)
  const [gateChallenge] = useState(() => {
    const a = 12 + Math.floor(Math.random() * 8)
    const b = 4 + Math.floor(Math.random() * 6)
    return { a, b, answer: a + b }
  })
  const [gateInput, setGateInput] = useState('')
  const [gateError, setGateError] = useState('')

  // Auth form states
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [authError, setAuthError] = useState('')

  // Profile edit state
  const [editParentName, setEditParentName] = useState(parentProfile?.displayName ?? '')
  const [editParentPhone, setEditParentPhone] = useState(parentProfile?.phone ?? '')

  // Child form state
  const [showAddChild, setShowAddChild] = useState(false)
  const [childNickname, setChildNickname] = useState('')
  const [childAge, setChildAge] = useState(5)
  const [childAvatar, setChildAvatar] = useState('🐣')
  const [childLevel, setChildLevel] = useState<LevelId>('L2')
  const [childActionMsg, setChildActionMsg] = useState('')
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null)
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null)

  // Billing & MoMo state
  const [momoLoadingPlanId, setMomoLoadingPlanId] = useState<string | null>(null)
  const [billingMessage, setBillingMessage] = useState('')
  const [billingError, setBillingError] = useState('')

  useEffect(() => {
    if (parentProfile) {
      setEditParentName(parentProfile.displayName)
      setEditParentPhone(parentProfile.phone ?? '')
    }
  }, [parentProfile])

  // Verify MoMo return URL server-side if redirected back with ?momoOrderId=...
  useEffect(() => {
    if (typeof window === 'undefined' || !parentProfile) return
    const hashParts = window.location.hash.split('?')
    const queryStr = hashParts[1] || window.location.search.replace(/^\?/, '')
    if (!queryStr) return
    const params = new URLSearchParams(queryStr)
    const orderId = params.get('momoOrderId')
    if (!orderId) return

    setActiveTab('billing')
    setBillingMessage('Đang xác thực kết quả giao dịch MoMo với máy chủ...')
    checkMomoPaymentStatus(orderId)
      .then(async (res) => {
        if (res.status === 'paid') {
          setBillingMessage(
            `Thanh toán đơn hàng ${res.orderId} đã được xác thực thành công!`
          )
          await onRefreshAccountData()
        } else if (res.status === 'pending') {
          setBillingMessage(
            `Đơn hàng ${res.orderId} đang chờ MoMo xác nhận qua IPN. Vui lòng bấm kiểm tra lại sau ít giây.`
          )
        } else {
          setBillingError(
            `Giao dịch ${res.orderId} chưa hoàn tất (${res.message || res.status}).`
          )
        }
      })
      .catch((err) => {
        setBillingError(
          err instanceof Error ? err.message : 'Không thể xác thực đơn hàng MoMo.'
        )
      })
  }, [parentProfile, onRefreshAccountData])

  const progressPercent =
    allLessons.length > 0
      ? Math.round((completedIds.length / allLessons.length) * 100)
      : 0

  const totalStudyMinutes = useMemo(() => {
    const secs = progressRecords.reduce((sum, r) => sum + (r.timeSpentSeconds || 0), 0)
    return Math.round(secs / 60)
  }, [progressRecords])

  const earnedBadges = useMemo(() => {
    const list: string[] = []
    if (completedIds.length >= 1) list.push('🌱 Bước khởi đầu')
    if (completedIds.length >= 4) list.push('⭐ Hoàn thành Unit mẫu')
    if (completedIds.length >= 8) list.push('🚀 Chăm chỉ mỗi tuần')
    if (completedIds.length >= 16) list.push('🏆 Chinh phục 16 bài nền tảng')
    return list
  }, [completedIds.length])

  const hasConsent = (type: ParentConsentRecord['consentType']) =>
    consents.some((c) => c.consentType === type && !c.revokedAt)

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthSubmitting(true)
    setAuthError('')
    setAuthNotice('')

    if (authMode === 'login') {
      const res = await signInParentAccount(email, password)
      setAuthSubmitting(false)
      if (res.error) {
        setAuthError(res.error)
      } else {
        setAuthNotice('Đăng nhập thành công!')
        await onRefreshAccountData()
      }
      return
    }

    if (authMode === 'signup') {
      const res = await signUpParentAccount(email, password, displayName)
      setAuthSubmitting(false)
      if (res.error) {
        setAuthError(res.error)
      } else if (res.data?.needsEmailConfirmation) {
        setAuthNotice(
          'Đăng ký thành công! Vui lòng kiểm tra hộp thư để xác nhận email trước khi đăng nhập.'
        )
      } else {
        setAuthNotice('Tài khoản phụ huynh đã được tạo và đăng nhập!')
        await onRefreshAccountData()
      }
      return
    }

    const res = await sendParentPasswordReset(email)
    setAuthSubmitting(false)
    if (res.error) {
      setAuthError(res.error)
    } else {
      setAuthNotice(
        'Đã gửi liên kết đặt lại mật khẩu tới email của bạn (hãy kiểm tra cả thư mục Spam).'
      )
    }
  }

  const handleUpdateRecoveredPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setAuthError('Mật khẩu mới cần ít nhất 6 ký tự.')
      return
    }
    setAuthSubmitting(true)
    const res = await updateParentPassword(newPassword)
    setAuthSubmitting(false)
    if (res.error) {
      setAuthError(res.error)
    } else {
      setAuthNotice('Đã cập nhật mật khẩu mới thành công!')
      setNewPassword('')
    }
  }

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentProfile || !childNickname.trim()) return
    setChildActionMsg('')
    const res = await createChildProfile({
      parentId: parentProfile.id,
      nickname: childNickname,
      ageYears: childAge,
      avatarEmoji: childAvatar,
      learningLevel: childLevel,
    })
    if (res.error) {
      setAuthError(res.error)
      return
    }
    setChildNickname('')
    setShowAddChild(false)
    setChildActionMsg(`Đã tạo hồ sơ cho bé "${res.data?.nickname}".`)
    await onRefreshAccountData()
    if (res.data) onSelectActiveChild(res.data.id)
  }

  const handleSaveEditChild = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parentProfile || !editingChild) return
    const res = await updateChildProfile(editingChild.id, parentProfile.id, {
      nickname: editingChild.nickname,
      ageYears: editingChild.ageYears ?? 5,
      avatarEmoji: editingChild.avatarEmoji,
      learningLevel: editingChild.learningLevel,
    })
    if (res.error) {
      setAuthError(res.error)
      return
    }
    setEditingChild(null)
    setChildActionMsg('Đã cập nhật thông tin hồ sơ trẻ.')
    await onRefreshAccountData()
  }

  const handleConfirmDeleteChild = async (childId: string) => {
    if (!parentProfile) return
    const res = await deleteChildProfile(childId, parentProfile.id)
    setDeletingChildId(null)
    if (res.error) {
      setAuthError(res.error)
      return
    }
    if (activeChild?.id === childId) {
      onSelectActiveChild(null)
    }
    setChildActionMsg('Đã xóa hồ sơ trẻ.')
    await onRefreshAccountData()
  }

  const handleStartMomoCheckout = async (planId: string) => {
    setMomoLoadingPlanId(planId)
    setBillingError('')
    setBillingMessage('')
    try {
      const session = await createMomoPaymentSession(planId)
      window.location.href = session.payUrl
    } catch (err) {
      setBillingError(
        err instanceof Error ? err.message : 'Không thể khởi tạo thanh toán MoMo.'
      )
    } finally {
      setMomoLoadingPlanId(null)
    }
  }

  if (!gateUnlocked && activeChild) {
    return (
      <main className="content-page">
        <div className="parent-gate-card">
          <Lock size={28} aria-hidden="true" />
          <h2>Khu vực dành riêng cho Phụ huynh</h2>
          <p>
            Đang ở chế độ học của bé <strong>{activeChild.avatarEmoji} {activeChild.nickname}</strong>.
            Ba mẹ trả lời phép tính nhỏ để mở phần quản lý tài khoản &amp; thanh toán nhé:
          </p>
          <form
            className="parent-gate-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (Number(gateInput.trim()) === gateChallenge.answer) {
                setGateUnlocked(true)
                setGateError('')
              } else {
                setGateError('Chưa đúng rồi, ba mẹ thử nhập lại nhé.')
              }
            }}
          >
            <label htmlFor="parent-gate-input">
              <strong>
                {gateChallenge.a} + {gateChallenge.b} = ?
              </strong>
            </label>
            <input
              id="parent-gate-input"
              type="number"
              inputMode="numeric"
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              placeholder="Nhập kết quả..."
              required
            />
            <div className="parent-gate-actions">
              <button type="submit" className="primary compact">
                Mở Góc phụ huynh
              </button>
              <button
                type="button"
                className="outline-btn"
                onClick={() =>
                  onNavigate({
                    page: 'program',
                    levelId: activeChild.learningLevel,
                  })
                }
              >
                Quay lại bài học của bé
              </button>
            </div>
          </form>
          {gateError && (
            <p className="activity-feedback retry" role="alert">
              {gateError}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="content-page">
      <div className="page-title parent-title-row">
        <div>
          <p className="eyebrow">Parent Area · Khu vực phụ huynh</p>
          <h1>Đồng hành cùng con</h1>
          <p>
            Quản lý tài khoản phụ huynh, hồ sơ từng bé, tiến độ học tập, quyền
            an toàn AI và gói thành viên.
          </p>
        </div>

        <button
          type="button"
          className="outline-btn"
          onClick={() => onNavigate({ page: 'admin' })}
        >
          <FileEdit size={16} aria-hidden="true" />
          <span>Quản trị nội dung (CMS)</span>
        </button>
      </div>

      <div className="parent-tabs" role="tablist" aria-label="Phân mục phụ huynh">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Hồ sơ &amp; Tiến độ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'safety'}
          className={activeTab === 'safety' ? 'active' : ''}
          onClick={() => setActiveTab('safety')}
        >
          An toàn &amp; AI Buddy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'billing'}
          className={activeTab === 'billing' ? 'active' : ''}
          onClick={() => setActiveTab('billing')}
        >
          Gói thành viên &amp; MoMo
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="parent-grid">
          <div className="parent-main">
            {/* Supabase Auth & Account Panel */}
            <div className="parent-panel auth-panel">
              {!isSupabaseConfigured ? (
                <div className="supabase-notice">
                  <ShieldCheck size={20} aria-hidden="true" />
                  <div>
                    <h3>Chế độ dùng thử cục bộ (Chưa kết nối Supabase)</h3>
                    <p>
                      Tiến độ hiện được lưu trên trình duyệt của thiết bị này. Khi
                      bổ sung <code>VITE_SUPABASE_URL</code> và{' '}
                      <code>VITE_SUPABASE_ANON_KEY</code> trên Vercel, hệ thống tự
                      động kích hoạt đăng ký/đăng nhập phụ huynh, hồ sơ nhiều bé và
                      đồng bộ đám mây.
                    </p>
                  </div>
                </div>
              ) : authLoading ? (
                <p className="muted">Đang kiểm tra phiên đăng nhập phụ huynh...</p>
              ) : isPasswordRecovery ? (
                <form className="auth-form" onSubmit={handleUpdateRecoveredPassword}>
                  <h3>
                    <KeyRound size={18} aria-hidden="true" /> Đặt lại mật khẩu mới
                  </h3>
                  <label>
                    <span>Mật khẩu mới (tối thiểu 6 ký tự)</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </label>
                  <button type="submit" className="primary compact" disabled={authSubmitting}>
                    {authSubmitting ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
                  </button>
                </form>
              ) : parentProfile ? (
                <div className="account-signed-in">
                  <div className="panel-head-row">
                    <div>
                      <p className="eyebrow">Tài khoản phụ huynh đã xác thực</p>
                      <h3>
                        {parentProfile.displayName}{' '}
                        <small className="role-chip">{parentProfile.role}</small>
                      </h3>
                      <p className="muted">{parentProfile.email}</p>
                    </div>
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={async () => {
                        await signOutParentAccount()
                        onSelectActiveChild(null)
                        await onRefreshAccountData()
                      }}
                    >
                      <LogOut size={16} aria-hidden="true" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>

                  <form
                    className="parent-profile-inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      setAuthNotice('')
                      const res = await updateParentProfileInfo(
                        parentProfile.id,
                        editParentName,
                        editParentPhone || null
                      )
                      if (res.error) setAuthError(res.error)
                      else {
                        setAuthNotice('Đã lưu thông tin phụ huynh.')
                        await onRefreshAccountData()
                      }
                    }}
                  >
                    <input
                      type="text"
                      aria-label="Tên hiển thị phụ huynh"
                      value={editParentName}
                      onChange={(e) => setEditParentName(e.target.value)}
                      placeholder="Tên phụ huynh"
                    />
                    <input
                      type="tel"
                      aria-label="Số điện thoại liên hệ"
                      value={editParentPhone}
                      onChange={(e) => setEditParentPhone(e.target.value)}
                      placeholder="Số điện thoại (tùy chọn)"
                    />
                    <button type="submit" className="outline-btn">
                      Lưu thông tin
                    </button>
                  </form>
                </div>
              ) : (
                <div className="auth-box">
                  <div className="auth-mode-switch" role="tablist">
                    <button
                      type="button"
                      className={authMode === 'login' ? 'active' : ''}
                      onClick={() => {
                        setAuthMode('login')
                        setAuthError('')
                        setAuthNotice('')
                      }}
                    >
                      Đăng nhập
                    </button>
                    <button
                      type="button"
                      className={authMode === 'signup' ? 'active' : ''}
                      onClick={() => {
                        setAuthMode('signup')
                        setAuthError('')
                        setAuthNotice('')
                      }}
                    >
                      Đăng ký tài khoản
                    </button>
                    <button
                      type="button"
                      className={authMode === 'forgot' ? 'active' : ''}
                      onClick={() => {
                        setAuthMode('forgot')
                        setAuthError('')
                        setAuthNotice('')
                      }}
                    >
                      Quên mật khẩu
                    </button>
                  </div>

                  <form className="auth-form" onSubmit={handleAuthSubmit}>
                    {authMode === 'signup' && (
                      <label>
                        <span>Tên phụ huynh</span>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Ví dụ: Mẹ Minh Anh"
                          required
                        />
                      </label>
                    )}
                    <label>
                      <span>Email phụ huynh</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        required
                      />
                    </label>
                    {authMode !== 'forgot' && (
                      <label>
                        <span>Mật khẩu</span>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          minLength={6}
                          placeholder="Tối thiểu 6 ký tự"
                          required
                        />
                      </label>
                    )}
                    <button type="submit" className="primary compact" disabled={authSubmitting}>
                      {authSubmitting
                        ? 'Đang xử lý...'
                        : authMode === 'login'
                          ? 'Đăng nhập phụ huynh'
                          : authMode === 'signup'
                            ? 'Tạo tài khoản phụ huynh'
                            : 'Gửi email đặt lại mật khẩu'}
                    </button>
                  </form>
                </div>
              )}

              {authNotice && (
                <div className="feedback success-banner" role="status">
                  {authNotice}
                </div>
              )}
              {authError && (
                <div className="activity-feedback retry" role="alert">
                  <span>{authError}</span>
                </div>
              )}
            </div>

            {/* Child Profiles Manager */}
            {parentProfile && (
              <div className="parent-panel">
                <div className="panel-head-row">
                  <div>
                    <h3>Hồ sơ học tập của các con ({childrenList.length})</h3>
                    <p className="muted">
                      Mỗi bé có tiến độ, cấp độ và lịch sử hoàn thành riêng biệt.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="primary compact"
                    onClick={() => setShowAddChild((v) => !v)}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span>Thêm hồ sơ bé</span>
                  </button>
                </div>

                {showAddChild && (
                  <form className="child-form-box" onSubmit={handleCreateChild}>
                    <div className="cms-form-grid">
                      <label>
                        <span>Tên gọi của bé (biệt danh)</span>
                        <input
                          type="text"
                          value={childNickname}
                          onChange={(e) => setChildNickname(e.target.value)}
                          placeholder="Ví dụ: Bé Bông"
                          maxLength={32}
                          required
                        />
                      </label>
                      <label>
                        <span>Độ tuổi</span>
                        <select
                          value={childAge}
                          onChange={(e) => {
                            const age = Number(e.target.value)
                            setChildAge(age)
                            setChildLevel(suggestLevelByAge(age))
                          }}
                        >
                          {[3, 4, 5, 6, 7, 8, 9, 10, 11].map((age) => (
                            <option key={age} value={age}>
                              {age} tuổi
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Cấp độ khởi đầu</span>
                        <select
                          value={childLevel}
                          onChange={(e) => setChildLevel(e.target.value as LevelId)}
                        >
                          <option value="L1">L1 – Little Explorers (3–4 tuổi)</option>
                          <option value="L2">L2 – Little Learners (5–6 tuổi)</option>
                          <option value="L3">L3 – Young Learners (7–9 tuổi)</option>
                          <option value="L4">L4 – Junior English (10–11 tuổi)</option>
                        </select>
                      </label>
                      <div>
                        <span className="field-label-span">Chọn linh vật đại diện</span>
                        <div className="avatar-picker-row">
                          {AVATAR_OPTIONS.map((emoji) => (
                            <button
                              type="button"
                              key={emoji}
                              className={childAvatar === emoji ? 'active' : ''}
                              onClick={() => setChildAvatar(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="cms-editor-actions">
                      <button type="submit" className="primary compact">
                        <UserPlus size={16} aria-hidden="true" />
                        <span>Lưu hồ sơ bé</span>
                      </button>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => setShowAddChild(false)}
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                )}

                {editingChild && (
                  <form className="child-form-box" onSubmit={handleSaveEditChild}>
                    <h4>Chỉnh sửa hồ sơ: {editingChild.nickname}</h4>
                    <div className="cms-form-grid">
                      <label>
                        <span>Tên gọi của bé</span>
                        <input
                          type="text"
                          value={editingChild.nickname}
                          onChange={(e) =>
                            setEditingChild({ ...editingChild, nickname: e.target.value })
                          }
                          required
                        />
                      </label>
                      <label>
                        <span>Cấp độ học</span>
                        <select
                          value={editingChild.learningLevel}
                          onChange={(e) =>
                            setEditingChild({
                              ...editingChild,
                              learningLevel: e.target.value as LevelId,
                            })
                          }
                        >
                          <option value="L1">L1 – Little Explorers</option>
                          <option value="L2">L2 – Little Learners</option>
                          <option value="L3">L3 – Young Learners</option>
                          <option value="L4">L4 – Junior English</option>
                        </select>
                      </label>
                    </div>
                    <div className="cms-editor-actions">
                      <button type="submit" className="primary compact">
                        Cập nhật
                      </button>
                      <button
                        type="button"
                        className="outline-btn"
                        onClick={() => setEditingChild(null)}
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                )}

                {childActionMsg && (
                  <div className="feedback success-banner" role="status">
                    {childActionMsg}
                  </div>
                )}

                {childrenList.length === 0 ? (
                  <p className="muted">
                    Chưa có hồ sơ trẻ nào. Hãy bấm &ldquo;Thêm hồ sơ bé&rdquo; để
                    bắt đầu lưu tiến độ riêng cho từng con nhé.
                  </p>
                ) : (
                  <div className="child-cards-list">
                    {childrenList.map((child) => {
                      const isActive = activeChild?.id === child.id
                      return (
                        <div
                          key={child.id}
                          className={`child-profile-card ${isActive ? 'is-active' : ''}`}
                        >
                          <div className="child-card-main">
                            <span className="child-avatar" aria-hidden="true">
                              {child.avatarEmoji}
                            </span>
                            <div>
                              <strong>{child.nickname}</strong>
                              <small>
                                {child.ageYears ? `${child.ageYears} tuổi · ` : ''}
                                Cấp độ {child.learningLevel} · Bắt đầu {child.startedAt}
                              </small>
                            </div>
                          </div>

                          <div className="child-card-actions">
                            <button
                              type="button"
                              className={isActive ? 'primary compact' : 'outline-btn'}
                              onClick={() => {
                                onSelectActiveChild(child.id)
                                onNavigate({
                                  page: 'program',
                                  levelId: child.learningLevel,
                                })
                              }}
                            >
                              <UserCheck size={15} aria-hidden="true" />
                              <span>{isActive ? 'Vào học ngay' : 'Chọn bé học'}</span>
                            </button>
                            <button
                              type="button"
                              className="outline-btn"
                              onClick={() => setEditingChild(child)}
                            >
                              Sửa
                            </button>
                            {deletingChildId === child.id ? (
                              <button
                                type="button"
                                className="danger-btn"
                                onClick={() => handleConfirmDeleteChild(child.id)}
                              >
                                Xác nhận xóa
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-reset-btn"
                                aria-label={`Xóa hồ sơ ${child.nickname}`}
                                onClick={() => setDeletingChildId(child.id)}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Learning Progress Overview (Inherits V1 + enriches with activeChild DB metrics) */}
            <div className="progress-card">
              <div>
                <p className="eyebrow">
                  {activeChild
                    ? `Tiến độ của ${activeChild.avatarEmoji} ${activeChild.nickname}`
                    : 'Tổng quan học tập'}
                </p>
                <h2>Hành trình của bé</h2>
                <p className="muted">
                  {activeChild
                    ? 'Tiến độ và thời lượng học đang được đồng bộ bảo mật theo từng hồ sơ trẻ trên Supabase.'
                    : 'Dữ liệu dùng thử hiện lưu cục bộ trên trình duyệt. Đăng nhập phụ huynh và chọn hồ sơ trẻ để đồng bộ đám mây.'}
                </p>
              </div>
              <div className="progress-ring tabular-nums">
                <b>{progressPercent}%</b>
                <small>bài đã mở</small>
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
                <b>
                  {activeChild ? `${totalStudyMinutes} phút` : startedIds.length}
                </b>
                <small>{activeChild ? 'Tổng thời gian học' : 'Bài đang học dở'}</small>
              </div>
              <div className="stat-box">
                <Star size={20} aria-hidden="true" />
                <b>{plannedTotalLessons}</b>
                <small>Lộ trình 4×8×10 bài</small>
              </div>
            </div>

            {earnedBadges.length > 0 && (
              <div className="parent-panel">
                <h3>
                  <Award size={18} aria-hidden="true" /> Thành tích đã đạt
                </h3>
                <div className="achievement-row">
                  {earnedBadges.map((badge) => (
                    <span className="achievement-chip" key={badge}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                          {done}/{levelLessons.length} bài đã mở
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
                {!activeChild && completedIds.length > 0 && !confirmingReset && (
                  <button
                    type="button"
                    className="text-reset-btn"
                    onClick={() => setConfirmingReset(true)}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    <span>Đặt lại tiến độ cục bộ</span>
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
                      const dbRecord = progressRecords.find((r) => r.lessonId === id)
                      const dateStr = dbRecord?.completedAt ?? entry?.completedAt
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
                            {dateStr
                              ? new Date(dateStr).toLocaleDateString('vi-VN')
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

            <PWAInstallButton variant="card" />

            <div className="side-card safety-card">
              <ShieldCheck size={22} aria-hidden="true" />
              <h3>Quyền riêng tư của trẻ</h3>
              <p>
                Trẻ không cần email hay tài khoản riêng. Khu vực học tập không có
                quảng cáo, dữ liệu từng bé được tách biệt và bảo vệ bằng Row Level
                Security (RLS).
              </p>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="parent-main">
          <div className="parent-panel">
            <h3>
              <ShieldCheck size={20} aria-hidden="true" /> Chấp thuận của phụ huynh
              (Parent Consent)
            </h3>
            <p className="muted">
              Để bảo vệ quyền riêng tư và dữ liệu trẻ em, phụ huynh chủ động quyết
              định việc kích hoạt AI hội thoại và luyện phát âm cho từng hồ sơ trẻ.
            </p>

            {!parentProfile ? (
              <p className="feedback">
                Vui lòng đăng nhập tài khoản phụ huynh ở tab &ldquo;Hồ sơ &amp;
                Tiến độ&rdquo; để lưu xác nhận chấp thuận trên cơ sở dữ liệu.
              </p>
            ) : (
              <div className="consent-list">
                {(
                  [
                    {
                      type: 'child_privacy_v2',
                      title: 'Đồng ý chính sách bảo vệ dữ liệu trẻ em (bắt buộc)',
                      desc: 'Chỉ thu thập biệt danh, độ tuổi/năm sinh ước lượng và tiến độ học tập. Không thu thập địa chỉ, số điện thoại hay thông tin trường lớp của trẻ.',
                    },
                    {
                      type: 'ai_buddy',
                      title: 'Cho phép sử dụng AI English Buddy theo chủ đề bài học',
                      desc: 'AI chỉ giao tiếp tiếng Anh/Việt đơn giản xoay quanh bài học, có bộ lọc chặn thông tin cá nhân và giới hạn số lượt mỗi ngày.',
                    },
                    {
                      type: 'speech_practice',
                      title: 'Cho phép xử lý giọng nói tức thời khi luyện nói',
                      desc: 'Đoạn thu âm được gửi qua máy chủ proxy để nhận diện và động viên tức thời, không lưu trữ tệp âm thanh lâu dài.',
                    },
                  ] as const
                ).map((item) => {
                  const granted = hasConsent(item.type)
                  return (
                    <label className="consent-item" key={item.type}>
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={async (e) => {
                          await saveParentConsent(
                            parentProfile.id,
                            activeChild?.id ?? null,
                            item.type,
                            e.target.checked
                          )
                          await onRefreshAccountData()
                        }}
                      />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.desc}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {parentProfile && childrenList.length > 0 && (
            <div className="parent-panel">
              <h3>
                <Sparkles size={20} aria-hidden="true" /> Giới hạn AI theo từng bé
              </h3>
              <div className="child-cards-list">
                {childrenList.map((child) => (
                  <div className="child-profile-card" key={`ai-${child.id}`}>
                    <div className="child-card-main">
                      <span className="child-avatar">{child.avatarEmoji}</span>
                      <div>
                        <strong>{child.nickname}</strong>
                        <small>
                          Giới hạn tối đa: {child.aiDailyLimit} lượt AI/ngày
                        </small>
                      </div>
                    </div>
                    <div className="child-card-actions">
                      <select
                        aria-label={`Giới hạn lượt AI mỗi ngày cho ${child.nickname}`}
                        value={child.aiDailyLimit}
                        onChange={async (e) => {
                          await updateChildProfile(child.id, parentProfile.id, {
                            aiDailyLimit: Number(e.target.value),
                          })
                          await onRefreshAccountData()
                        }}
                      >
                        <option value={5}>5 lượt/ngày</option>
                        <option value={15}>15 lượt/ngày</option>
                        <option value={30}>30 lượt/ngày</option>
                      </select>
                      <button
                        type="button"
                        className={child.aiEnabled ? 'primary compact' : 'outline-btn'}
                        onClick={async () => {
                          await updateChildProfile(child.id, parentProfile.id, {
                            aiEnabled: !child.aiEnabled,
                          })
                          await onRefreshAccountData()
                        }}
                      >
                        {child.aiEnabled ? 'AI: Đang BẬT' : 'AI: Đang TẮT'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="parent-main">
          {billingMessage && (
            <div className="feedback success-banner" role="status">
              {billingMessage}
            </div>
          )}
          {billingError && (
            <div className="activity-feedback retry" role="alert">
              <span>{billingError}</span>
            </div>
          )}

          <div className="parent-panel">
            <div className="panel-head-row">
              <div>
                <h3>
                  <CreditCard size={20} aria-hidden="true" /> Trạng thái gói thành viên
                </h3>
                <p className="muted">
                  {subscription
                    ? `Gói hiện tại: ${subscription.planId.toUpperCase()} · Trạng thái: ${subscription.status}`
                    : 'Đang sử dụng gói Miễn phí mặc định.'}
                </p>
              </div>
              {subscription && subscription.status === 'active' && (
                <button
                  type="button"
                  className="outline-btn"
                  onClick={async () => {
                    if (!parentProfile) return
                    await toggleCancelSubscriptionRenewal(
                      subscription.id,
                      parentProfile.id,
                      !subscription.cancelAtPeriodEnd
                    )
                    await onRefreshAccountData()
                  }}
                >
                  {subscription.cancelAtPeriodEnd
                    ? 'Khôi phục gia hạn cuối kỳ'
                    : 'Hủy gia hạn'}
                </button>
              )}
            </div>

            {subscription && (
              <div className="sub-details-grid">
                <div>
                  <small>Ngày bắt đầu</small>
                  <strong>
                    {new Date(subscription.currentPeriodStart).toLocaleDateString('vi-VN')}
                  </strong>
                </div>
                <div>
                  <small>Ngày hết hạn</small>
                  <strong>
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('vi-VN')
                      : 'Không giới hạn (Free)'}
                  </strong>
                </div>
                <div>
                  <small>Phương thức gia hạn</small>
                  <strong>
                    {subscription.momoRecurringCapable
                      ? 'Gia hạn tự động MoMo'
                      : 'Gia hạn thủ công qua MoMo'}
                  </strong>
                </div>
              </div>
            )}

            <div className="momo-recurring-note">
              <RefreshCw size={18} aria-hidden="true" />
              <div>
                <strong>Lưu ý về gia hạn tự động MoMo:</strong> Chức năng thanh toán
                định kỳ tự động (Subscription API) phụ thuộc vào việc tài khoản
                merchant được MoMo phê duyệt quyền Recurring. Khi chưa bật{' '}
                <code>MOMO_RECURRING_APPROVED=true</code>, hệ thống sử dụng phương
                án gia hạn thủ công minh bạch qua cổng MoMo chính thức và chỉ kích
                hoạt gói sau khi IPN/máy chủ xác thực chữ ký giao dịch thành công.
              </div>
            </div>
          </div>

          <div className="plans-grid">
            {plans.length === 0 ? (
              <div className="parent-panel">
                <h3>Bảng giá cấu hình từ cơ sở dữ liệu</h3>
                <p className="muted">
                  Giá bán và quyền lợi các gói (Free, Premium, Family) được đọc trực
                  tiếp từ bảng <code>plans</code> trong Supabase để không hard-code
                  giá trên giao diện. Hãy chạy file seed SQL{' '}
                  <code>003_seed_plans_and_courses.sql</code> để hiển thị các gói
                  thành viên.
                </p>
              </div>
            ) : (
              plans.map((plan) => {
                const isCurrent =
                  subscription?.planId === plan.id && subscription.status === 'active'
                return (
                  <div
                    className={`plan-card ${isCurrent ? 'is-current' : ''}`}
                    key={plan.id}
                  >
                    <p className="eyebrow">{plan.billingCycle === 'free' ? 'Miễn phí' : 'Theo tháng'}</p>
                    <h3>{plan.name}</h3>
                    <div className="plan-price tabular-nums">
                      <b>{formatVnd(plan.priceVnd)}</b>
                      {plan.priceVnd > 0 && <small>/tháng</small>}
                    </div>
                    <p className="muted">{plan.tagline}</p>
                    <ul className="plan-features">
                      {plan.features.map((feat) => (
                        <li key={feat}>
                          <CheckCircle2 size={16} aria-hidden="true" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    {plan.priceVnd === 0 ? (
                      <span className="plan-status-tag">
                        {isCurrent || !subscription ? 'Đang sử dụng' : 'Gói mặc định'}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="primary compact"
                        disabled={momoLoadingPlanId === plan.id || !parentProfile}
                        onClick={() => handleStartMomoCheckout(plan.id)}
                      >
                        {momoLoadingPlanId === plan.id
                          ? 'Đang tạo cổng MoMo...'
                          : !parentProfile
                            ? 'Đăng nhập để đăng ký'
                            : isCurrent
                              ? 'Gia hạn thêm qua MoMo'
                              : 'Thanh toán qua MoMo'}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {payments.length > 0 && (
            <div className="parent-panel">
              <h3>Lịch sử giao dịch MoMo</h3>
              <div className="payment-history-list">
                {payments.map((pay) => (
                  <div className="payment-row" key={pay.id}>
                    <div>
                      <strong className="tabular-nums">{pay.orderId}</strong>
                      <small>
                        Gói {pay.planId.toUpperCase()} ·{' '}
                        {new Date(pay.createdAt).toLocaleString('vi-VN')}
                      </small>
                    </div>
                    <div className="payment-right tabular-nums">
                      <strong>{formatVnd(pay.amountVnd)}</strong>
                      <span className={`pay-badge status-${pay.status}`}>
                        {pay.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
