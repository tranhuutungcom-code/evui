import express from 'express'
import { createServer as createViteServer } from 'vite'
import aiBuddyHandler from './api/ai/buddy'
import aiPronunciationHandler from './api/ai/pronunciation'
import momoCreatePaymentHandler from './api/momo/create-payment'
import momoIpnHandler from './api/momo/ipn'
import momoStatusHandler from './api/momo/status'

async function startServer() {
  const app = express()
  app.use(express.json({ limit: '4mb' }))

  app.post('/api/ai/buddy', (req, res) => aiBuddyHandler(req, res))
  app.post('/api/ai/pronunciation', (req, res) => aiPronunciationHandler(req, res))
  app.post('/api/momo/create-payment', (req, res) => momoCreatePaymentHandler(req, res))
  app.post('/api/momo/ipn', (req, res) => momoIpnHandler(req, res))
  app.get('/api/momo/status', (req, res) => momoStatusHandler(req, res))

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  })

  app.use(vite.middlewares)

  const port = Number(process.env.PORT || 3000)
  app.listen(port, '0.0.0.0', () => {
    console.log(`English Little World dev server listening on http://0.0.0.0:${port}`)
  })
}

startServer()
