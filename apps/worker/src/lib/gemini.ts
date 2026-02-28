import { GoogleGenerativeAI } from '@google/generative-ai'
import type { TemplatePromoData } from '../templates/types.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

function getModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
}

function buildPromoSummary(data: TemplatePromoData): string {
  const items = data.items
    .slice(0, 8)
    .map((i) => `- ${i.name}: ${i.price}${i.unit ? ' / ' + i.unit : ''}`)
    .join('\n')
  return [
    `Company: ${data.brand.name}`,
    `Promo title: ${data.promo.title}`,
    data.promo.subhead ? `Subhead: ${data.promo.subhead}` : null,
    data.promo.cta ? `CTA: ${data.promo.cta}` : null,
    `Featured products:\n${items}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function generateSocialCaptions(
  data: TemplatePromoData,
): Promise<{ facebook: string; instagram: string; linkedin: string }> {
  const empty = { facebook: '', instagram: '', linkedin: '' }
  if (!process.env.GEMINI_API_KEY) return empty

  try {
    const model = getModel()
    const summary = buildPromoSummary(data)
    const prompt = `You are a marketing copywriter for a building materials dealer. Write short, engaging social media captions for this promotional flyer.

${summary}

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{"facebook":"...","instagram":"...","linkedin":"..."}

Guidelines:
- Facebook: 1-2 sentences, friendly and direct, include a call to action
- Instagram: punchy, emoji-friendly, up to 150 chars, hashtag line at end
- LinkedIn: professional tone, 1-2 sentences, business-focused`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const parsed = JSON.parse(text) as { facebook: string; instagram: string; linkedin: string }
    return {
      facebook: parsed.facebook ?? '',
      instagram: parsed.instagram ?? '',
      linkedin: parsed.linkedin ?? '',
    }
  } catch (err) {
    console.warn('Gemini generateSocialCaptions failed (non-fatal):', err instanceof Error ? err.message : err)
    return empty
  }
}

export async function generateEmailCopy(
  data: TemplatePromoData,
): Promise<{ subject: string; preheader: string; bodyHtml: string }> {
  const empty = { subject: '', preheader: '', bodyHtml: '' }
  if (!process.env.GEMINI_API_KEY) return empty

  try {
    const model = getModel()
    const summary = buildPromoSummary(data)
    const prompt = `You are an email copywriter for a building materials dealer. Write professional email marketing copy for this promotional flyer.

${summary}

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{"subject":"...","preheader":"...","bodyHtml":"..."}

Guidelines:
- subject: compelling email subject line, under 60 chars
- preheader: preview text shown in inbox, under 90 chars
- bodyHtml: 1-2 short paragraphs of HTML (use <p> tags only), conversational and professional tone, no more than 80 words total`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const parsed = JSON.parse(text) as { subject: string; preheader: string; bodyHtml: string }
    return {
      subject: parsed.subject ?? '',
      preheader: parsed.preheader ?? '',
      bodyHtml: parsed.bodyHtml ?? '',
    }
  } catch (err) {
    console.warn('Gemini generateEmailCopy failed (non-fatal):', err instanceof Error ? err.message : err)
    return empty
  }
}
