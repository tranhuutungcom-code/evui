import crypto from 'node:crypto'
import { readJsonBody, sendJson, type ApiRequest, type ApiResponse } from '../_lib/httpTypes'
import {
  buildCreatePaymentRawSignature,
  getMomoConfig,
  signMomoHmacSha256,
} from '../_lib/momoCrypto'
import { getServerSupabaseAdmin, verifyParentBearer } from '../_lib/serverSupabase'

interface CreatePaymentBody {
  planId?: string
  requestAutoRenew?: boolean
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const admin = getServerSupabaseAdmin()
  const momo = getMomoConfig()

  const missingEnv: string[] = []
  if (!admin) missingEnv.push('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!momo) missingEnv.push('MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY')

  if (missingEnv.length > 0 || !admin || !momo) {
    sendJson(res, 503, {
      error:
        'Cổng thanh toán MoMo chưa thể khởi tạo vì thiếu biến môi trường cấu hình trên máy chủ/Vercel.',
      missingEnv,
    })
    return
  }

  const authUser = await verifyParentBearer(req.headers.authorization)
  if (!authUser) {
    sendJson(res, 401, { error: 'Phụ huynh cần đăng nhập để thực hiện thanh toán.' })
    return
  }

  let body: CreatePaymentBody
  try {
    body = await readJsonBody<CreatePaymentBody>(req)
  } catch {
    sendJson(res, 400, { error: 'Yêu cầu thanh toán không hợp lệ.' })
    return
  }

  const planId = String(body.planId ?? '').trim()
  if (!planId || planId === 'free') {
    sendJson(res, 400, { error: 'Vui lòng chọn gói thành viên trả phí hợp lệ.' })
    return
  }

  // Always read authoritative price from database on server — never trust client amount
  const { data: plan, error: planErr } = await admin
    .from('plans')
    .select('id, name, price_vnd, billing_cycle, is_active')
    .eq('id', planId)
    .eq('is_active', true)
    .maybeSingle()

  if (planErr || !plan || typeof plan.price_vnd !== 'number' || plan.price_vnd <= 0) {
    sendJson(res, 404, { error: 'Không tìm thấy gói thành viên hợp lệ hoặc gói chưa có giá.' })
    return
  }

  const amount = plan.price_vnd
  const suffix = crypto.randomBytes(4).toString('hex')
  const orderId = `ELW_${Date.now()}_${suffix}`
  const requestId = `REQ_${Date.now()}_${suffix}`

  const rawEnvOrigin = (
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  ).trim()

  let baseOrigin = ''
  if (rawEnvOrigin) {
    try {
      const parsed = new URL(rawEnvOrigin)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        baseOrigin = parsed.origin
      }
    } catch {
      baseOrigin = ''
    }
  }

  if (!baseOrigin) {
    const rawHost = String(
      (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || ''
    )
      .split(',')[0]
      .trim()
    const isSafeHost = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost)
    const proto =
      rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https'
    if (isSafeHost) {
      baseOrigin = `${proto}://${rawHost}`
    }
  }

  if (!baseOrigin) {
    sendJson(res, 500, { error: 'Không xác định được APP_BASE_URL cho redirectUrl và ipnUrl.' })
    return
  }

  const redirectUrl = `${baseOrigin}/#/phu-huynh?momoOrderId=${encodeURIComponent(orderId)}`
  const ipnUrl = `${baseOrigin}/api/momo/ipn`
  const orderInfo = `English Little World - ${plan.name}`
  const extraData = Buffer.from(
    JSON.stringify({ parentId: authUser.userId, planId: plan.id })
  ).toString('base64')
  const requestType = 'captureWallet'

  // Insert pending payment BEFORE calling MoMo so IPN always has an authoritative order record
  const { error: insertErr } = await admin.from('payments').insert({
    parent_id: authUser.userId,
    plan_id: plan.id,
    provider: 'momo',
    order_id: orderId,
    request_id: requestId,
    amount_vnd: amount,
    currency: 'VND',
    status: 'pending',
    message: 'Đang chờ thanh toán qua MoMo',
  })

  if (insertErr) {
    sendJson(res, 500, { error: `Không thể tạo bản ghi giao dịch: ${insertErr.message}` })
    return
  }

  const rawSignature = buildCreatePaymentRawSignature({
    accessKey: momo.accessKey,
    amount,
    extraData,
    ipnUrl,
    orderId,
    orderInfo,
    partnerCode: momo.partnerCode,
    redirectUrl,
    requestId,
    requestType,
  })
  const signature = signMomoHmacSha256(rawSignature, momo.secretKey)

  try {
    const momoRes = await fetch(momo.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerCode: momo.partnerCode,
        partnerName: 'English Little World',
        storeId: 'ELW_STORE',
        requestId,
        amount,
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        lang: 'vi',
        extraData,
        requestType,
        signature,
      }),
    })

    const momoData = (await momoRes.json()) as {
      resultCode?: number
      message?: string
      payUrl?: string
      deeplink?: string
    }

    if (!momoRes.ok || momoData.resultCode !== 0 || !momoData.payUrl) {
      await admin
        .from('payments')
        .update({
          status: 'failed',
          result_code: typeof momoData.resultCode === 'number' ? momoData.resultCode : -1,
          message: momoData.message ?? 'Khởi tạo MoMo thất bại',
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId)

      sendJson(res, 502, {
        error: momoData.message || 'Không thể tạo liên kết thanh toán MoMo.',
        resultCode: momoData.resultCode,
      })
      return
    }

    sendJson(res, 200, {
      orderId,
      payUrl: momoData.payUrl,
      deeplink: momoData.deeplink,
      amountVnd: amount,
      recurringApproved: momo.recurringApproved,
      billingMode: momo.recurringApproved ? 'momo_recurring_active' : 'manual',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error'
    sendJson(res, 502, { error: `Lỗi kết nối cổng thanh toán MoMo: ${msg}` })
  }
}
