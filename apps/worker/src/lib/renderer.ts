import { chromium } from 'playwright-core'
import { execSync } from 'child_process'

function getChromiumPath(): string {
  // Use explicit env override first (set in Docker)
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH

  // Try to find system chromium for local dev
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const candidate of candidates) {
    try {
      execSync(`test -f "${candidate}"`, { stdio: 'ignore' })
      return candidate
    } catch {
      // not found, try next
    }
  }

  // Fall back to playwright-core's bundled path (only works if `npx playwright install chromium` was run)
  try {
    return chromium.executablePath()
  } catch {
    throw new Error(
      'No Chromium/Chrome found. Either install Google Chrome, set CHROMIUM_PATH, or run: npx playwright install chromium',
    )
  }
}

export async function renderHtmlToScreenshot(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: getChromiumPath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 816, height: 1056 }) // 8.5in × 11in at 96dpi
    await page.setContent(html, { waitUntil: 'networkidle' })
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    return Buffer.from(screenshot)
  } finally {
    await browser.close()
  }
}

export async function renderHtmlToSocialImage(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: getChromiumPath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1080, height: 1080 })
    await page.setContent(html, { waitUntil: 'networkidle' })
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    return Buffer.from(screenshot)
  } finally {
    await browser.close()
  }
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: getChromiumPath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
