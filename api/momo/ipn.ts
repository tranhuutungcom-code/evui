import { readJsonBody, sendJson, sendNoContent, type ApiRequest, type ApiResponse } from '../_lib/httpTypes'
import {
  buildIpnRawSignature,
  getMomoConfig,
  signMomoHmacSha256,
  timingSafeHexEqual,
} from '../_lib/momoCrypto'
import { getServerSupabaseAdmin } from '../_lib/serverSupabase'

interface MomoIpnBody {
  partnerCode?: string
  orderId?: string
  requestId?: string
  amount?: number
  orderInfo?: string
  orderType?: string
  transId?: number | string
  resultCode?: number
  message?: string
  payType?: string
  responseTime?: number
  extraData?: string
  signature?: string
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const admin = getServerSupabaseAdmin()
  const momo = getMomoConfig()
  if (!admin || !momo) {
    sendJson(res, 503, { error: 'MoMo or Supabase server configuration missing' })
    return
  }

  let body: MomoIpnBody
  try {
    body = await readJsonBody<MomoIpnBody>(req)
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  if (!body.orderId || !body.requestId || !body.signature) {
    sendJson(res, 400, { error: 'Missing required MoMo IPN fields' })
    return
  }

  const rawSignature = buildIpnRawSignature({
    accessKey: momo.accessKey,
    amount: body.amount ?? 0,
    extraData: body.extraData ?? '',
    message: body.message ?? '',
    orderId: body.orderId,
    orderInfo: body.orderInfo ?? '',
    orderType: body.orderType ?? 'momo_wallet',
    partnerCode: body.partnerCode ?? momo.partnerCode,
    payType: body.payType ?? '',
    requestId: body.requestId,
    responseTime: body.responseTime ?? 0,
    resultCode: body.resultCode ?? -1,
    transId: body.transId ?? 0,
  })
  const expectedSig = signMomoHmacSha256(rawSignature, momo.secretKey)

  if (!timingSafeHexEqual(body.signature, expectedSig)) {
    sendJson(res, 401, { error: 'Invalid MoMo IPN signature' })
    return
  }

  const { data: payment, error: payErr } = await admin
    .from('payments')
    .select('id, parent_id, plan_id, amount_vnd, status')
    .eq('order_id', body.orderId)
    .maybeSingle()

  if (payErr || !payment) {
    sendJson(res, 404, { error: 'Order not found' })
    return
  }

  // Idempotency: ignore already-paid transactions without double-activating
  if (payment.status === 'paid') {
    sendNoContent(res)
    return
  }

  if (Number(body.amount) !== payment.amount_vnd) {
    await admin
      .from('payments')
      .update({
        status: 'failed',
        message: 'Amount mismatch in MoMo IPN',
        raw_ipn: body as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    sendJson(res, 400, { error: 'Amount mismatch' })
    return
  }

  const now = new Date()
  if (body.resultCode === 0) {
    const { data: claimedPayment } = await admin
      .from('payments')
      .update({
        status: 'paid',
        momo_trans_id: body.transId ? String(body.transId) : null,
        result_code: 0,
        message: body.message ?? 'Thanh toán thành công',
        raw_ipn: body as Record<string, unknown>,
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

      const { data: subscription } = await admin
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

      if (subscription?.id) {
        await admin
          .from('payments')
          .update({ subscription_id: subscription.id })
          .eq('id', payment.id)
      }
    }
  } else {
    await admin
      .from('payments')
      .update({
        status: 'failed',
        momo_trans_id: body.transId ? String(body.transId) : null,
        result_code: typeof body.resultCode === 'number' ? body.resultCode : -1,
        message: body.message ?? 'Giao dịch không thành công',
        raw_ipn: body as Record<string, unknown>,
        updated_at: now.toISOString(),
      })
      .eq('id', payment.id)
  }

  sendNoContent(res)
}
