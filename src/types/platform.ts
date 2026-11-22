import type { LevelId } from './curriculum'

export type UserRole = 'parent' | 'editor' | 'admin'

export interface ParentProfile {
  id: string
  email: string | null
  displayName: string
  phone: string | null
  role: UserRole
  createdAt: string
}

export interface ChildProfile {
  id: string
  parentId: string
  nickname: string
  birthYear: number | null
  ageYears: number | null
  avatarEmoji: string
  learningLevel: LevelId
  startedAt: string
  aiEnabled: boolean
  aiDailyLimit: number
  achievements: string[]
  createdAt: string
}

export type LessonProgressStatus = 'not_started' | 'started' | 'completed'

export interface LessonProgressRecord {
  id?: string
  childId: string
  lessonId: string
  status: LessonProgressStatus
  currentStep: number
  score: number | null
  timeSpentSeconds: number
  lastAccessedAt: string
  completedAt: string | null
  updatedAt: string
}

export interface LessonAttemptRecord {
  id: string
  childId: string
  lessonId: string
  activityKind: string
  score: number | null
  maxScore: number | null
  durationSeconds: number
  createdAt: string
}

export interface ParentConsentRecord {
  id: string
  parentId: string
  childId: string | null
  consentType: 'ai_buddy' | 'speech_practice' | 'child_privacy_v2'
  policyVersion: string
  grantedAt: string
  revokedAt: string | null
}

export interface PlanRecord {
  id: string
  name: string
  tagline: string
  priceVnd: number
  billingCycle: 'free' | 'monthly' | 'yearly'
  maxChildren: number
  aiDailyLimit: number
  features: string[]
  isActive: boolean
  sortOrder: number
}

export interface SubscriptionRecord {
  id: string
  parentId: string
  planId: string
  status: 'active' | 'pending_payment' | 'past_due' | 'canceled' | 'expired'
  billingMode: 'free' | 'manual' | 'momo_recurring_pending' | 'momo_recurring_active'
  autoRenew: boolean
  momoRecurringCapable: boolean
  currentPeriodStart: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export interface PaymentRecord {
  id: string
  parentId: string
  subscriptionId: string | null
  planId: string
  provider: 'momo'
  orderId: string
  requestId: string
  momoTransId: string | null
  amountVnd: number
  currency: string
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired'
  resultCode: number | null
  message: string | null
  verifiedAt: string | null
  createdAt: string
}

export interface AIBuddyMessage {
  id: string
  role: 'child' | 'buddy'
  englishText: string
  vietnameseHint?: string
  followUpQuestion?: string
  audioBase64?: string
  audioMimeType?: string
  safetyRedirected?: boolean
  createdAt: string
}

export interface PronunciationFeedbackResult {
  recognizedText: string
  targetText: string
  encouragementLabel: string
  feedbackEn: string
  feedbackVi: string
  tipVi: string
  audioBase64?: string
  audioMimeType?: string
  turnsRemainingToday?: number
}
