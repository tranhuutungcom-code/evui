import { sendJson, type ApiRequest, type ApiResponse } from '../_lib/httpTypes'
import {
  buildQueryStatusRawSignature,
  getMomoConfig,
  signMomoHmacSha256,
} from '../_lib/momoCrypto'
import { getServerSupabaseAdmin, verifyParentBearer } from '../_lib/serverSupabase'

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const admin = getServerSupabaseAdmin()
  if (!admin) {
    sendJson(res, 503, { error: 'Chưa cấu hình máy chủ Supabase.' })
    return
  }

  const authUser = await verifyParentBearer(req.headers.authorization)
  if (!authUser) {
    sendJson(res, 401, { error: 'Phụ huynh cần đăng nhập.' })
    return
  }

  const urlObj = new URL(req.url || '/', 'http://localhost')
  const orderId = (urlObj.searchParams.get('orderId') || '').trim()
  if (!orderId) {
    sendJson(res, 400, { error: 'Thiếu mã đơn hàng orderId.' })
    return
  }

  const { data: payment, error } = await admin
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .eq('parent_id', authUser.userId)
    .maybeSingle()

  if (error || !payment) {
    sendJson(res, 404, { error: 'Không tìm thấy giao dịch.' })
    return
  }

  // If still pending and MoMo keys exist, perform signed server-to-server status query
  const momo = getMomoConfig()
  if (payment.status === 'pending' && momo) {
    try {
      const requestId = `QRY_${Date.now()}`
      const rawSig = buildQueryStatusRawSignature({
        accessKey: momo.accessKey,
        orderId: payment.order_id,
        partnerCode: momo.partnerCode,
        requestId,
      })
      const signature = signMomoHmacSha256(rawSig, momo.secretKey)
      const qRes = await fetch(momo.queryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode: momo.partnerCode,
          requestId,
          orderId: payment.order_id,
          lang: 'vi',
          signature,
        }),
      })
      const qData = (await qRes.json()) as {
        resultCode?: number
        message?: string
        transId?: number | string
      }

      if (qData.resultCode === 0) {
        const now = new Date()
        const { data: claimedPayment } = await admin
          .from('payments')
          .update({
            status: 'paid',
            momo_trans_id: qData.transId ? String(qData.transId) : null,
            result_code: 0,
            message: qData.message ?? 'Đã xác nhận thanh toán từ MoMo',
            verified_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', payment.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (claimedPayment) {
          const { data: plan } = await admin
            .from('plans')
            .select('billing_cycle')
            .eq('id', payment.plan_id)
            .maybeSingle()
          const durationDays = plan?.billing_cycle === 'yearly' ? 365 : 30
          const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

          const { data: sub } = await admin
            .from('subscriptions')
            .insert({
              parent_id: payment.parent_id,
              plan_id: payment.plan_id,
              status: 'active',
              billing_mode: momo.recurringApproved ? 'momo_recurring_active' : 'manual',
              auto_renew: momo.recurringApproved,
              momo_recurring_capable: momo.recurringApproved,
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              cancel_at_period_end: false,
            })
            .select('id')
            .single()

          if (sub?.id) {
            await admin
              .from('payments')
              .update({ subscription_id: sub.id })
              .eq('id', payment.id)
          }
        }

        sendJson(res, 200, {
          orderId: payment.order_id,
          status: 'paid',
          message: qData.message ?? 'Thanh toán thành công',
        })
        return
      }
    } catch {
      // Return current DB status gracefully
    }
  }

  sendJson(res, 200, {
    orderId: payment.order_id,
    status: payment.status,
    message: payment.message,
  })
}
