import * as cheerio from 'cheerio'
import type { ProductUrlScrapePayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'

function resolveUrl(path: string, base: string): string {
  try {
    return new URL(path, base).href
  } catch {
    return path
  }
}

export async function handleProductUrlScrape(payload: ProductUrlScrapePayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    // Fetch the product URL
    const response = await fetch(payload.url, { signal: AbortSignal.timeout(10000) })
    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract title
    const title = (
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text()
    ).trim()

    // Extract image URL
    const rawImageUrl = $('meta[property="og:image"]').attr('content')
    const resolvedImageUrl = rawImageUrl ? resolveUrl(rawImageUrl, payload.url) : undefined

    // Extract price (optional)
    const rawPrice =
      $('meta[property="product:price:amount"]').attr('content') ||
      $('meta[property="og:price:amount"]').attr('content')
    const scrapedPrice = rawPrice ? parseFloat(rawPrice) : undefined

    // Fetch existing item to avoid overwriting good data
    const existing = await prisma.promoItem.findUnique({ where: { id: payload.itemId } })

    // Update item
    await prisma.promoItem.update({
      where: { id: payload.itemId },
      data: {
        name: title || existing?.name || 'Product',
        imageUrl: resolvedImageUrl || existing?.imageUrl || null,
        ...(scrapedPrice !== undefined && scrapedPrice > 0 ? { price: scrapedPrice } : {}),
      },
    })

    await completeJob(payload.jobId, { title, imageUrl: resolvedImageUrl })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
