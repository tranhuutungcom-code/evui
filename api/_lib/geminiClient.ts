import { GoogleGenAI } from '@google/genai'

let cachedClient: GoogleGenAI | null = null
let cachedKey: string | undefined

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) return null
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
    cachedKey = apiKey
  }
  return cachedClient
}

export const PII_PATTERNS: RegExp[] = [
  /\b\d{9,12}\b/, // phone numbers / ID numbers
  /\b[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/, // email addresses
  /\b(số nhà|địa chỉ|address|phone|số điện thoại|trường|school|home address|mật khẩu|password)\b/i,
]

export function containsPotentialPii(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text))
}

export function getLevelPedagogyPrompt(levelId: string): string {
  switch (levelId) {
    case 'L1':
      return 'Age 3-4 (Little Explorers). Use ultra-simple English (2 to 6 words per sentence), playful warmth, basic greetings/colors/animals/family words. Never ask the child to read long text or write.'
    case 'L2':
      return 'Age 5-6 (Little Learners). Use short friendly sentences (4 to 8 words), gentle repetition, simple questions, and encouragement.'
    case 'L3':
      return 'Age 7-9 (Young Learners). Use clear complete sentences, simple everyday dialogue, and short encouraging corrections.'
    case 'L4':
      return 'Age 10-11 (Junior English). Use natural age-appropriate dialogue, ask simple "why" or opinion questions, and gently suggest clearer phrasing.'
    default:
      return 'Age 5-9. Keep English simple, friendly, and directly tied to the lesson topic.'
  }
}
