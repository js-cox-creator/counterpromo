import * as cheerio from 'cheerio'
import type { BrandBootstrapPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { uploadToS3 } from '../lib/s3.js'

// ─── Color Utility Helpers ────────────────────────────────────────────────────

/** Parse a 6-digit hex color string into [r, g, b] in range [0, 255]. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

/** Format [r, g, b] (0-255 range) back to a 6-digit hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Convert [r, g, b] (0-255) to HSL.
 * Returns [h (0-360), s (0-1), l (0-1)].
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h * 360, s, l]
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

/**
 * Convert HSL [h (0-360), s (0-1), l (0-1)] to [r, g, b] (0-255).
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hNorm = h / 360
  if (s === 0) {
    const gray = Math.round(l * 255)
    return [gray, gray, gray]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = hueToRgb(p, q, hNorm + 1 / 3)
  const g = hueToRgb(p, q, hNorm)
  const b = hueToRgb(p, q, hNorm - 1 / 3)
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

/**
 * Calculate WCAG relative luminance for a single linear channel value (0-1).
 * Uses the piecewise linearisation defined in WCAG 2.1.
 */
function linearise(value: number): number {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

/**
 * Calculate WCAG relative luminance for a hex color.
 * L = 0.2126*R + 0.7152*G + 0.0722*B (linearized)
 */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const R = linearise(r / 255)
  const G = linearise(g / 255)
  const B = linearise(b / 255)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * Calculate WCAG contrast ratio between two hex colors.
 * Ratio = (L1 + 0.05) / (L2 + 0.05) where L1 >= L2.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Darken a hex color by reducing HSL lightness by the given amount (0-1).
 * Clamps lightness to [0, 1].
 */
function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const newL = Math.max(0, l - amount)
  const [nr, ng, nb] = hslToRgb(h, s, newL)
  return rgbToHex(nr, ng, nb)
}

/**
 * Lighten a hex color by increasing HSL lightness by the given amount (0-1).
 * Clamps lightness to [0, 1].
 */
function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const newL = Math.min(1, l + amount)
  const [nr, ng, nb] = hslToRgb(h, s, newL)
  return rgbToHex(nr, ng, nb)
}

const WHITE = '#ffffff'
const BLACK = '#000000'
const MIN_CONTRAST = 3.0
const LIGHTNESS_ADJUSTMENT = 0.2 // 20% lightness change

/**
 * Adjust a color to meet the minimum contrast ratio against a reference color.
 * If adjusting against white, darken; if adjusting against black, lighten.
 * Returns the (possibly adjusted) hex color.
 */
function adjustContrast(hex: string, reference: string): string {
  if (contrastRatio(hex, reference) >= MIN_CONTRAST) return hex
  // Determine adjustment direction based on reference
  const adjustFn = reference === WHITE ? darkenHex : lightenHex
  return adjustFn(hex, LIGHTNESS_ADJUSTMENT)
}

// ─── URL / Image Utilities ────────────────────────────────────────────────────

function resolveUrl(path: string, base: string): string {
  try {
    return new URL(path, base).href
  } catch {
    return path
  }
}

/**
 * Probe a URL to check whether it returns a valid image response.
 * Returns the URL if valid, undefined otherwise.
 */
async function probeImageUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    const ct = res.headers.get('content-type') ?? ''
    if (res.ok && ct.startsWith('image/')) return url
  } catch {
    // Ignore probe errors
  }
  return undefined
}

/**
 * Download an image from a URL and upload it to S3 under the brand-logos prefix.
 * Returns the S3-hosted URL or undefined on failure.
 */
async function uploadImageFromUrl(
  imageUrl: string,
  accountId: string,
  label: string,
): Promise<string | undefined> {
  const bucket = process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET
  if (!bucket) return undefined

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return undefined
    const ct = res.headers.get('content-type') ?? 'image/png'
    if (!ct.startsWith('image/')) return undefined

    const buf = Buffer.from(await res.arrayBuffer())
    const ext = ct.includes('svg') ? 'svg' : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : 'png'
    const s3Key = `brand-logos/${accountId}/${label}-${Date.now()}.${ext}`
    await uploadToS3(bucket, s3Key, buf, ct)
    return s3Key
  } catch {
    return undefined
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleBrandBootstrap(payload: BrandBootstrapPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    // Fetch the brand URL
    const response = await fetch(payload.url, { signal: AbortSignal.timeout(10000) })
    const html = await response.text()
    const $ = cheerio.load(html)

    // ── Extract logoUrl (primary candidates from HTML) ───────────────────────
    // Priority: explicit logo img > og:image > apple-touch-icon > favicon.ico

    let htmlLogoUrl: string | undefined
    let ogImageUrl: string | undefined
    let appleTouchIconUrl: string | undefined

    // Explicit logo <img> — src or alt contains "logo"
    const logoImg = $('img')
      .filter((_, el) => {
        const src = $(el).attr('src') ?? ''
        const alt = $(el).attr('alt') ?? ''
        return /logo/i.test(src) || /logo/i.test(alt)
      })
      .first()
      .attr('src')
    if (logoImg) {
      htmlLogoUrl = resolveUrl(logoImg, payload.url)
    }

    // PNG icon link (kept from original)
    if (!htmlLogoUrl) {
      const pngIcon = $('link[rel~="icon"][type="image/png"]').attr('href')
      if (pngIcon) {
        htmlLogoUrl = resolveUrl(pngIcon, payload.url)
      }
    }

    // OG image
    const ogImageAttr = $('meta[property="og:image"]').attr('content')
    if (ogImageAttr) {
      ogImageUrl = resolveUrl(ogImageAttr, payload.url)
    }

    // Apple touch icon
    const appleTouchIconAttr = $('link[rel="apple-touch-icon"]').attr('href')
    if (appleTouchIconAttr) {
      appleTouchIconUrl = resolveUrl(appleTouchIconAttr, payload.url)
    }

    // ── Fallback: probe favicon.ico ──────────────────────────────────────────
    const faviconUrl = resolveUrl('/favicon.ico', payload.url)

    // ── Resolve logoUrl by priority, uploading to S3 ─────────────────────────
    let logoUrl: string | undefined
    let logoS3Key: string | undefined

    if (htmlLogoUrl) {
      // Upload the HTML-found logo to S3 for reliable hosting
      const key = await uploadImageFromUrl(htmlLogoUrl, payload.accountId, 'logo')
      if (key) {
        logoS3Key = key
        logoUrl = htmlLogoUrl // store original URL; S3 key is tracked separately
      } else {
        logoUrl = htmlLogoUrl // fallback: store original even if S3 upload failed
      }
    }

    if (!logoUrl && ogImageUrl) {
      const probed = await probeImageUrl(ogImageUrl)
      if (probed) {
        const key = await uploadImageFromUrl(ogImageUrl, payload.accountId, 'og-image')
        logoS3Key = key
        logoUrl = ogImageUrl
      }
    }

    if (!logoUrl && appleTouchIconUrl) {
      const probed = await probeImageUrl(appleTouchIconUrl)
      if (probed) {
        const key = await uploadImageFromUrl(appleTouchIconUrl, payload.accountId, 'apple-touch-icon')
        logoS3Key = key
        logoUrl = appleTouchIconUrl
      }
    }

    if (!logoUrl) {
      const probed = await probeImageUrl(faviconUrl)
      if (probed) {
        const key = await uploadImageFromUrl(faviconUrl, payload.accountId, 'favicon')
        logoS3Key = key
        logoUrl = faviconUrl
      }
    }

    // ── Extract colors ────────────────────────────────────────────────────────
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

    // ── Contrast checking & palette refinement ────────────────────────────────
    // Assign semantic roles: primary = [0], secondary = [1], accent = [2]
    // primary/secondary: checked against white (#fff); accent: checked against black (#000)

    const refinedColors = uniqueColors.map((hex, idx) => {
      if (!hex || !/^#[0-9a-fA-F]{6}$/i.test(hex)) return hex
      if (idx === 2) {
        // Accent: ensure readable on dark backgrounds (check against black)
        return adjustContrast(hex, BLACK)
      }
      // Primary (0) and secondary (1): ensure readable on light backgrounds
      return adjustContrast(hex, WHITE)
    })

    // ── Upsert BrandKit ───────────────────────────────────────────────────────
    await prisma.brandKit.upsert({
      where: { accountId: payload.accountId },
      create: {
        accountId: payload.accountId,
        logoUrl: logoUrl ?? null,
        colors: refinedColors,
        websiteUrl: payload.url,
      },
      update: {
        logoUrl: logoUrl ?? undefined,
        colors: refinedColors.length ? refinedColors : undefined,
        websiteUrl: payload.url,
      },
    })

    await completeJob(payload.jobId, {
      logoUrl,
      logoS3Key,
      colors: refinedColors,
      websiteUrl: payload.url,
    })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
