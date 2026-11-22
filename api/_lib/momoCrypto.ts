import crypto from 'node:crypto'

export interface MomoConfig {
  partnerCode: string
  accessKey: string
  secretKey: string
  endpoint: string
  queryEndpoint: string
  recurringApproved: boolean
}

export function getMomoConfig(): MomoConfig | null {
  const partnerCode = (process.env.MOMO_PARTNER_CODE || '').trim()
  const accessKey = (process.env.MOMO_ACCESS_KEY || '').trim()
  const secretKey = (process.env.MOMO_SECRET_KEY || '').trim()
  if (!partnerCode || !accessKey || !secretKey) {
    return null
  }

  const baseEndpoint = (
    process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create'
  ).trim()
  const queryEndpoint = (
    process.env.MOMO_QUERY_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/query'
  ).trim()

  return {
    partnerCode,
    accessKey,
    secretKey,
    endpoint: baseEndpoint,
    queryEndpoint,
    recurringApproved: process.env.MOMO_RECURRING_APPROVED === 'true',
  }
}

export function signMomoHmacSha256(rawSignature: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex')
}

export function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    return false
  }
}

export function buildCreatePaymentRawSignature(params: {
  accessKey: string
  amount: number
  extraData: string
  ipnUrl: string
  orderId: string
  orderInfo: string
  partnerCode: string
  redirectUrl: string
  requestId: string
  requestType: string
}): string {
  return [
    `accessKey=${params.accessKey}`,
    `amount=${params.amount}`,
    `extraData=${params.extraData}`,
    `ipnUrl=${params.ipnUrl}`,
    `orderId=${params.orderId}`,
    `orderInfo=${params.orderInfo}`,
    `partnerCode=${params.partnerCode}`,
    `redirectUrl=${params.redirectUrl}`,
    `requestId=${params.requestId}`,
    `requestType=${params.requestType}`,
  ].join('&')
}

export function buildIpnRawSignature(params: {
  accessKey: string
  amount: number | string
  extraData: string
  message: string
  orderId: string
  orderInfo: string
  orderType: string
  partnerCode: string
  payType: string
  requestId: string
  responseTime: number | string
  resultCode: number | string
  transId: number | string
}): string {
  return [
    `accessKey=${params.accessKey}`,
    `amount=${params.amount}`,
    `extraData=${params.extraData}`,
    `message=${params.message}`,
    `orderId=${params.orderId}`,
    `orderInfo=${params.orderInfo}`,
    `orderType=${params.orderType}`,
    `partnerCode=${params.partnerCode}`,
    `payType=${params.payType}`,
    `requestId=${params.requestId}`,
    `responseTime=${params.responseTime}`,
    `resultCode=${params.resultCode}`,
    `transId=${params.transId}`,
  ].join('&')
}

export function buildQueryStatusRawSignature(params: {
  accessKey: string
  orderId: string
  partnerCode: string
  requestId: string
}): string {
  return [
    `accessKey=${params.accessKey}`,
    `orderId=${params.orderId}`,
    `partnerCode=${params.partnerCode}`,
    `requestId=${params.requestId}`,
  ].join('&')
}
