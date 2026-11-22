import { getSupabaseClient } from '../lib/supabase'
import type { LevelId } from '../types/curriculum'
import type {
  ChildProfile,
  LessonAttemptRecord,
  LessonProgressRecord,
  LessonProgressStatus,
  ParentConsentRecord,
  ParentProfile,
  PaymentRecord,
  PlanRecord,
  SubscriptionRecord,
} from '../types/platform'

export interface ServiceResult<T> {
  data: T | null
  error: string | null
}

function mapParentProfile(row: Record<string, unknown>): ParentProfile {
  return {
    id: String(row.id),
    email: typeof row.email === 'string' ? row.email : null,
    displayName: typeof row.display_name === 'string' ? row.display_name : 'Phụ huynh',
    phone: typeof row.phone === 'string' ? row.phone : null,
    role:
      row.role === 'admin' || row.role === 'editor' ? row.role : 'parent',
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

function mapChildProfile(row: Record<string, unknown>): ChildProfile {
  return {
    id: String(row.id),
    parentId: String(row.parent_id),
    nickname: String(row.nickname ?? 'Bé'),
    birthYear: typeof row.birth_year === 'number' ? row.birth_year : null,
    ageYears: typeof row.age_years === 'number' ? row.age_years : null,
    avatarEmoji: typeof row.avatar_emoji === 'string' ? row.avatar_emoji : '🐣',
    learningLevel:
      row.learning_level === 'L1' ||
      row.learning_level === 'L2' ||
      row.learning_level === 'L3' ||
      row.learning_level === 'L4'
        ? row.learning_level
        : 'L1',
    startedAt: String(row.started_at ?? new Date().toISOString().slice(0, 10)),
    aiEnabled: Boolean(row.ai_enabled),
    aiDailyLimit: typeof row.ai_daily_limit === 'number' ? row.ai_daily_limit : 15,
    achievements: Array.isArray(row.achievements)
      ? (row.achievements as string[])
      : [],
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

function mapProgressRow(row: Record<string, unknown>): LessonProgressRecord {
  const statusRaw = row.status
  const status: LessonProgressStatus =
    statusRaw === 'completed' || statusRaw === 'started' ? statusRaw : 'not_started'
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    childId: String(row.child_id),
    lessonId: String(row.lesson_id),
    status,
    currentStep: typeof row.current_step === 'number' ? row.current_step : 0,
    score: typeof row.score === 'number' ? row.score : null,
    timeSpentSeconds:
      typeof row.time_spent_seconds === 'number' ? row.time_spent_seconds : 0,
    lastAccessedAt: String(row.last_accessed_at ?? row.updated_at ?? new Date().toISOString()),
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

export async function signUpParentAccount(
  email: string,
  password: string,
  displayName: string
): Promise<ServiceResult<{ needsEmailConfirmation: boolean }>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() || 'Phụ huynh' },
      emailRedirectTo: `${window.location.origin}/#/phu-huynh`,
    },
  })

  if (error) return { data: null, error: error.message }

  if (data.user && data.session) {
    await client.from('parent_profiles').upsert(
      {
        id: data.user.id,
        email: data.user.email,
        display_name: displayName.trim() || 'Phụ huynh',
      },
      { onConflict: 'id' }
    )
  }

  return {
    data: { needsEmailConfirmation: !data.session },
    error: null,
  }
}

export async function signInParentAccount(
  email: string,
  password: string
): Promise<ServiceResult<ParentProfile>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error || !data.user) {
    return { data: null, error: error?.message ?? 'Đăng nhập thất bại.' }
  }

  return fetchOrCreateParentProfile(data.user.id, data.user.email ?? null)
}

export async function signOutParentAccount(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return
  await client.auth.signOut()
}

export async function sendParentPasswordReset(
  email: string
): Promise<ServiceResult<boolean>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/#/phu-huynh`,
  })
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

export async function updateParentPassword(
  newPassword: string
): Promise<ServiceResult<boolean>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { error } = await client.auth.updateUser({ password: newPassword })
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

export async function fetchOrCreateParentProfile(
  userId: string,
  email: string | null
): Promise<ServiceResult<ParentProfile>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { data, error } = await client
    .from('parent_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }

  if (data) {
    return { data: mapParentProfile(data as Record<string, unknown>), error: null }
  }

  const fallbackName = email ? email.split('@')[0] : 'Phụ huynh'
  const { data: created, error: createErr } = await client
    .from('parent_profiles')
    .upsert(
      {
        id: userId,
        email,
        display_name: fallbackName,
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single()

  if (createErr || !created) {
    return { data: null, error: createErr?.message ?? 'Không thể khởi tạo hồ sơ phụ huynh.' }
  }

  return { data: mapParentProfile(created as Record<string, unknown>), error: null }
}

export async function updateParentProfileInfo(
  parentId: string,
  displayName: string,
  phone: string | null
): Promise<ServiceResult<ParentProfile>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { data, error } = await client
    .from('parent_profiles')
    .update({
      display_name: displayName.trim() || 'Phụ huynh',
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parentId)
    .select('*')
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Lỗi cập nhật hồ sơ.' }
  return { data: mapParentProfile(data as Record<string, unknown>), error: null }
}

export async function fetchChildProfiles(
  parentId: string
): Promise<ServiceResult<ChildProfile[]>> {
  const client = getSupabaseClient()
  if (!client) return { data: [], error: null }

  const { data, error } = await client
    .from('child_profiles')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((row) => mapChildProfile(row as Record<string, unknown>)),
    error: null,
  }
}

export async function createChildProfile(input: {
  parentId: string
  nickname: string
  ageYears: number
  avatarEmoji: string
  learningLevel: LevelId
}): Promise<ServiceResult<ChildProfile>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const currentYear = new Date().getFullYear()
  const { data, error } = await client
    .from('child_profiles')
    .insert({
      parent_id: input.parentId,
      nickname: input.nickname.trim(),
      age_years: input.ageYears,
      birth_year: currentYear - input.ageYears,
      avatar_emoji: input.avatarEmoji,
      learning_level: input.learningLevel,
      ai_enabled: false,
    })
    .select('*')
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Không thể tạo hồ sơ trẻ.' }
  return { data: mapChildProfile(data as Record<string, unknown>), error: null }
}

export async function updateChildProfile(
  childId: string,
  parentId: string,
  patch: Partial<{
    nickname: string
    ageYears: number
    avatarEmoji: string
    learningLevel: LevelId
    aiEnabled: boolean
    aiDailyLimit: number
  }>
): Promise<ServiceResult<ChildProfile>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.nickname !== undefined) payload.nickname = patch.nickname.trim()
  if (patch.ageYears !== undefined) {
    payload.age_years = patch.ageYears
    payload.birth_year = new Date().getFullYear() - patch.ageYears
  }
  if (patch.avatarEmoji !== undefined) payload.avatar_emoji = patch.avatarEmoji
  if (patch.learningLevel !== undefined) payload.learning_level = patch.learningLevel
  if (patch.aiEnabled !== undefined) payload.ai_enabled = patch.aiEnabled
  if (patch.aiDailyLimit !== undefined) payload.ai_daily_limit = patch.aiDailyLimit

  const { data, error } = await client
    .from('child_profiles')
    .update(payload)
    .eq('id', childId)
    .eq('parent_id', parentId)
    .select('*')
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Không thể cập nhật hồ sơ trẻ.' }
  return { data: mapChildProfile(data as Record<string, unknown>), error: null }
}

export async function deleteChildProfile(
  childId: string,
  parentId: string
): Promise<ServiceResult<boolean>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { error } = await client
    .from('child_profiles')
    .delete()
    .eq('id', childId)
    .eq('parent_id', parentId)

  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

export async function fetchChildProgress(
  childId: string
): Promise<ServiceResult<LessonProgressRecord[]>> {
  const client = getSupabaseClient()
  if (!client) return { data: [], error: null }

  const { data, error } = await client
    .from('lesson_progress')
    .select('*')
    .eq('child_id', childId)
    .order('updated_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((row) => mapProgressRow(row as Record<string, unknown>)),
    error: null,
  }
}

export async function upsertChildLessonProgress(input: {
  childId: string
  lessonId: string
  status: LessonProgressStatus
  currentStep: number
  score?: number | null
  timeSpentSeconds?: number
}): Promise<ServiceResult<LessonProgressRecord>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    child_id: input.childId,
    lesson_id: input.lessonId,
    status: input.status,
    current_step: input.currentStep,
    last_accessed_at: now,
    updated_at: now,
  }

  if (input.score !== undefined) payload.score = input.score
  if (input.timeSpentSeconds !== undefined) payload.time_spent_seconds = input.timeSpentSeconds
  if (input.status === 'completed') payload.completed_at = now

  const { data, error } = await client
    .from('lesson_progress')
    .upsert(payload, { onConflict: 'child_id,lesson_id' })
    .select('*')
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? 'Không thể lưu tiến độ.' }
  }
  return { data: mapProgressRow(data as Record<string, unknown>), error: null }
}

export async function recordLessonAttempt(input: {
  childId: string
  lessonId: string
  activityKind: string
  score: number
  maxScore: number
  durationSeconds: number
}): Promise<ServiceResult<LessonAttemptRecord>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: null }

  const { data, error } = await client
    .from('lesson_attempts')
    .insert({
      child_id: input.childId,
      lesson_id: input.lessonId,
      activity_kind: input.activityKind,
      score: input.score,
      max_score: input.maxScore,
      duration_seconds: input.durationSeconds,
    })
    .select('*')
    .single()

  if (error || !data) return { data: null, error: error?.message ?? null }
  const row = data as Record<string, unknown>
  return {
    data: {
      id: String(row.id),
      childId: String(row.child_id),
      lessonId: String(row.lesson_id),
      activityKind: String(row.activity_kind),
      score: typeof row.score === 'number' ? row.score : null,
      maxScore: typeof row.max_score === 'number' ? row.max_score : null,
      durationSeconds: typeof row.duration_seconds === 'number' ? row.duration_seconds : 0,
      createdAt: String(row.created_at),
    },
    error: null,
  }
}

export async function fetchParentConsents(
  parentId: string
): Promise<ServiceResult<ParentConsentRecord[]>> {
  const client = getSupabaseClient()
  if (!client) return { data: [], error: null }

  const { data, error } = await client
    .from('parent_consents')
    .select('*')
    .eq('parent_id', parentId)
    .is('revoked_at', null)

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        parentId: String(r.parent_id),
        childId: typeof r.child_id === 'string' ? r.child_id : null,
        consentType: r.consent_type as ParentConsentRecord['consentType'],
        policyVersion: String(r.policy_version),
        grantedAt: String(r.granted_at),
        revokedAt: typeof r.revoked_at === 'string' ? r.revoked_at : null,
      }
    }),
    error: null,
  }
}

export async function saveParentConsent(
  parentId: string,
  childId: string | null,
  consentType: ParentConsentRecord['consentType'],
  granted: boolean
): Promise<ServiceResult<boolean>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  if (granted) {
    const { error } = await client.from('parent_consents').insert({
      parent_id: parentId,
      child_id: childId,
      consent_type: consentType,
      policy_version: 'v2-2026-11',
    })
    if (error) return { data: null, error: error.message }
    return { data: true, error: null }
  }

  let query = client
    .from('parent_consents')
    .update({ revoked_at: new Date().toISOString() })
    .eq('parent_id', parentId)
    .eq('consent_type', consentType)
    .is('revoked_at', null)

  if (childId) {
    query = query.eq('child_id', childId)
  }

  const { error } = await query
  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}

export async function fetchMembershipPlans(): Promise<ServiceResult<PlanRecord[]>> {
  const client = getSupabaseClient()
  if (!client) return { data: [], error: null }

  const { data, error } = await client
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: String(r.id),
        name: String(r.name),
        tagline: String(r.tagline ?? ''),
        priceVnd: typeof r.price_vnd === 'number' ? r.price_vnd : 0,
        billingCycle: (r.billing_cycle as PlanRecord['billingCycle']) ?? 'monthly',
        maxChildren: typeof r.max_children === 'number' ? r.max_children : 1,
        aiDailyLimit: typeof r.ai_daily_limit === 'number' ? r.ai_daily_limit : 5,
        features: Array.isArray(r.features) ? (r.features as string[]) : [],
        isActive: Boolean(r.is_active),
        sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 1,
      }
    }),
    error: null,
  }
}

export async function fetchParentSubscriptionAndPayments(parentId: string): Promise<{
  subscription: SubscriptionRecord | null
  payments: PaymentRecord[]
  error: string | null
}> {
  const client = getSupabaseClient()
  if (!client) return { subscription: null, payments: [], error: null }

  const [{ data: subRows, error: subErr }, { data: payRows, error: payErr }] =
    await Promise.all([
      client
        .from('subscriptions')
        .select('*')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false })
        .limit(1),
      client
        .from('payments')
        .select('*')
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  if (subErr || payErr) {
    return {
      subscription: null,
      payments: [],
      error: subErr?.message ?? payErr?.message ?? null,
    }
  }

  const subRow = subRows?.[0] as Record<string, unknown> | undefined
  const subscription: SubscriptionRecord | null = subRow
    ? {
        id: String(subRow.id),
        parentId: String(subRow.parent_id),
        planId: String(subRow.plan_id),
        status: subRow.status as SubscriptionRecord['status'],
        billingMode: subRow.billing_mode as SubscriptionRecord['billingMode'],
        autoRenew: Boolean(subRow.auto_renew),
        momoRecurringCapable: Boolean(subRow.momo_recurring_capable),
        currentPeriodStart: String(subRow.current_period_start),
        currentPeriodEnd:
          typeof subRow.current_period_end === 'string'
            ? subRow.current_period_end
            : null,
        cancelAtPeriodEnd: Boolean(subRow.cancel_at_period_end),
      }
    : null

  const payments: PaymentRecord[] = (payRows ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      parentId: String(r.parent_id),
      subscriptionId:
        typeof r.subscription_id === 'string' ? r.subscription_id : null,
      planId: String(r.plan_id),
      provider: 'momo',
      orderId: String(r.order_id),
      requestId: String(r.request_id),
      momoTransId: typeof r.momo_trans_id === 'string' ? r.momo_trans_id : null,
      amountVnd: typeof r.amount_vnd === 'number' ? r.amount_vnd : 0,
      currency: String(r.currency ?? 'VND'),
      status: r.status as PaymentRecord['status'],
      resultCode: typeof r.result_code === 'number' ? r.result_code : null,
      message: typeof r.message === 'string' ? r.message : null,
      verifiedAt: typeof r.verified_at === 'string' ? r.verified_at : null,
      createdAt: String(r.created_at),
    }
  })

  return { subscription, payments, error: null }
}

export async function toggleCancelSubscriptionRenewal(
  subscriptionId: string,
  parentId: string,
  cancelAtPeriodEnd: boolean
): Promise<ServiceResult<boolean>> {
  const client = getSupabaseClient()
  if (!client) return { data: null, error: 'Chưa cấu hình kết nối Supabase.' }

  const { error } = await client
    .from('subscriptions')
    .update({ cancel_at_period_end: cancelAtPeriodEnd })
    .eq('id', subscriptionId)
    .eq('parent_id', parentId)

  if (error) return { data: null, error: error.message }
  return { data: true, error: null }
}
