import { getAccessToken } from '../lib/supabase'
import type { LevelId } from '../types/curriculum'
import type { PronunciationFeedbackResult } from '../types/platform'

export interface BuddyApiResponse {
  childTranscript: string
  englishReply: string
  vietnameseHint: string
  followUpQuestion: string
  safetyRedirected: boolean
  audioBase64?: string
  audioMimeType?: string
  turnsRemainingToday?: number
}

async function safeParseJsonResponse<T>(res: Response): Promise<T & { error?: string }> {
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Máy chủ API chưa phản hồi JSON (hãy kiểm tra biến môi trường hoặc chạy qua Vercel / server dev).'
    )
  }
  return (await res.json()) as T & { error?: string }
}

export async function sendAiBuddyTurn(params: {
  childId?: string
  lessonId: string
  levelId: LevelId
  lessonTitle: string
  lessonWords: string[]
  lessonPhrases: string[]
  message?: string
  audioBase64?: string
  audioMimeType?: string
  history: Array<{ role: 'child' | 'buddy'; text: string }>
  wantTtsAudio: boolean
}): Promise<BuddyApiResponse> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch('/api/ai/buddy', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  const data = await safeParseJsonResponse<BuddyApiResponse>(res)
  if (!res.ok) {
    throw new Error(data.error || 'Không thể kết nối AI English Buddy.')
  }
  return data
}

export async function requestAiPronunciationFeedback(params: {
  childId?: string
  lessonId: string
  levelId: LevelId
  targetText: string
  recognizedText?: string
  audioBase64?: string
  audioMimeType?: string
  wantModelAudio?: boolean
}): Promise<PronunciationFeedbackResult> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch('/api/ai/pronunciation', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  })

  const data = await safeParseJsonResponse<PronunciationFeedbackResult>(res)
  if (!res.ok) {
    throw new Error(data.error || 'Không thể nhận phản hồi luyện phát âm.')
  }
  return data
}

export async function createMomoPaymentSession(
  planId: string
): Promise<{
  orderId: string
  payUrl: string
  amountVnd: number
  recurringApproved: boolean
  billingMode: string
}> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Phụ huynh vui lòng đăng nhập tài khoản trước khi thanh toán.')
  }

  const res = await fetch('/api/momo/create-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId }),
  })

  const data = await safeParseJsonResponse<{
    orderId: string
    payUrl: string
    amountVnd: number
    recurringApproved: boolean
    billingMode: string
  }>(res)

  if (!res.ok) {
    throw new Error(data.error || 'Không thể khởi tạo thanh toán MoMo.')
  }
  return data
}

export async function checkMomoPaymentStatus(orderId: string): Promise<{
  orderId: string
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired'
  message: string | null
}> {
  const token = await getAccessToken()
  if (!token) {
    throw new Error('Phụ huynh cần đăng nhập để kiểm tra trạng thái giao dịch.')
  }

  const res = await fetch(`/api/momo/status?orderId=${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await safeParseJsonResponse<{
    orderId: string
    status: 'pending' | 'paid' | 'failed' | 'canceled' | 'expired'
    message: string | null
  }>(res)

  if (!res.ok) {
    throw new Error(data.error || 'Không thể kiểm tra trạng thái thanh toán.')
  }
  return data
}
