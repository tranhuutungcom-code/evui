import type { IncomingMessage, ServerResponse } from 'node:http'

export interface ApiRequest extends IncomingMessage {
  body?: unknown
  query?: Record<string, unknown>
}

export interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse
  json?: (payload: unknown) => unknown
  send?: (body: unknown) => unknown
}

export function sendJson(res: ApiResponse, statusCode: number, payload: unknown): void {
  const statusFn = res.status
  if (typeof statusFn === 'function') {
    const chained = statusFn.call(res, statusCode)
    if (typeof chained.json === 'function') {
      chained.json(payload)
      return
    }
  }
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export function sendNoContent(res: ApiResponse): void {
  const statusFn = res.status
  if (typeof statusFn === 'function') {
    const chained = statusFn.call(res, 204)
    if (typeof chained.send === 'function') {
      chained.send('')
      return
    }
  }
  res.statusCode = 204
  res.end()
}

export async function readJsonBody<T = Record<string, unknown>>(req: ApiRequest): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as T
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {} as T
  return JSON.parse(raw) as T
}
