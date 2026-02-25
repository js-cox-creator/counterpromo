import * as cheerio from 'cheerio'
import type { BrandBootstrapPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'

function resolveUrl(path: string, base: string): string {
  try {
    return new URL(path, base).href
  } catch {
    return path
  }
}

export async function handleBrandBootstrap(payload: BrandBootstrapPayload): Promise<void> {
  await startJob(payload.jobId)

  try {
    // Fetch the brand URL
    const response = await fetch(payload.url, { signal: AbortSignal.timeout(10000) })
    const html = await response.text()
    const $ = cheerio.load(html)

    // --- Extract logoUrl ---
    let logoUrl: string | undefined

    const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr('href')
    if (appleTouchIcon) {
      logoUrl = resolveUrl(appleTouchIcon, payload.url)
    }

    if (!logoUrl) {
      const pngIcon = $('link[rel~="icon"][type="image/png"]').attr('href')
      if (pngIcon) {
        logoUrl = resolveUrl(pngIcon, payload.url)
      }
    }

    if (!logoUrl) {
      const ogImage = $('meta[property="og:image"]').attr('content')
      if (ogImage) {
        logoUrl = resolveUrl(ogImage, payload.url)
      }
    }

    if (!logoUrl) {
      const logoImg = $('img')
        .filter((_, el) => {
          const src = $(el).attr('src') ?? ''
          const alt = $(el).attr('alt') ?? ''
          return /logo/i.test(src) || /logo/i.test(alt)
        })
        .first()
        .attr('src')
      if (logoImg) {
        logoUrl = resolveUrl(logoImg, payload.url)
      }
    }

    // --- Extract colors ---
    const colors: string[] = []

    const themeColor = $('meta[name="theme-color"]').attr('content')
    if (themeColor && /^#[0-9a-fA-F]{6}$/.test(themeColor)) {
      colors.push(themeColor)
    }

    // Try to extract colors from the first stylesheet
    const firstStylesheet = $('link[rel="stylesheet"]').first().attr('href')
    if (firstStylesheet) {
      try {
        const cssUrl = resolveUrl(firstStylesheet, payload.url)
        const cssResponse = await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })
        const cssText = await cssResponse.text()
        const cssColors = cssText.match(/#[0-9a-fA-F]{6}/g) ?? []
        // Dedupe and take top 5
        const uniqueCssColors = [...new Set(cssColors)].slice(0, 5)
        colors.push(...uniqueCssColors)
      } catch {
        // Ignore CSS fetch errors
      }
    }

    // Dedupe all colors and limit to 5
    const uniqueColors = [...new Set(colors)].slice(0, 5)

    // --- Upsert BrandKit ---
    await prisma.brandKit.upsert({
      where: { accountId: payload.accountId },
      create: {
        accountId: payload.accountId,
        logoUrl: logoUrl ?? null,
        colors: uniqueColors,
        websiteUrl: payload.url,
      },
      update: {
        logoUrl: logoUrl ?? undefined,
        colors: uniqueColors.length ? uniqueColors : undefined,
        websiteUrl: payload.url,
      },
    })

    await completeJob(payload.jobId, { logoUrl, colors: uniqueColors, websiteUrl: payload.url })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
