import Handlebars from 'handlebars'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { prisma } from '@counterpromo/db'
import type { TemplatePromoData } from './types.js'
import { processCustomTemplate } from './custom-processor.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b)

// Split a formatted price "$12.99" into whole and cents parts
Handlebars.registerHelper('priceWhole', (price: string) => {
  const s = String(price).replace('$', '').trim()
  return s.split('.')[0] ?? '0'
})
Handlebars.registerHelper('priceCents', (price: string) => {
  const match = String(price).match(/\.(\d{2})/)
  return match?.[1] ?? '00'
})

// Group an items array into rows of 3, padding the last row with nulls.
// Context inside the block: { row: [...], rowIndex, isFirst, isLast }
Handlebars.registerHelper('eachRow', function(
  items: unknown[],
  options: Handlebars.HelperOptions,
) {
  if (!Array.isArray(items)) return ''
  let result = ''
  const size = 3
  for (let i = 0; i < items.length; i += size) {
    const row = items.slice(i, i + size)
    while (row.length < size) row.push(null)
    result += (options.fn as (ctx: unknown) => string)({
      row,
      rowIndex: i / size,
      isFirst: i === 0,
      isLast: i + size >= items.length,
    })
  }
  return result
})

export function renderTemplate(templateId: string, data: TemplatePromoData): string {
  let resolvedId = templateId
  let templatePath = join(__dirname, `${resolvedId}.hbs`)
  // Fallback to multi-product if the requested template file doesn't exist
  if (!existsSync(templatePath)) {
    resolvedId = 'multi-product'
    templatePath = join(__dirname, 'multi-product.hbs')
  }
  const source = readFileSync(templatePath, 'utf8')
  const template = Handlebars.compile(source)
  return template(data)
}

export async function resolveAndRenderTemplate(
  templateId: string | null | undefined,
  data: TemplatePromoData,
  keywords: string[],
  accountId: string,
): Promise<string> {
  const id = templateId ?? 'multi-product'

  // 1. Check built-in .hbs file first (sync, fast)
  const builtinPath = join(__dirname, `${id}.hbs`)
  if (existsSync(builtinPath)) return renderTemplate(id, data)

  // 2. Look up custom template in DB
  const custom = await prisma.customTemplate.findFirst({
    where: {
      id,
      OR: [{ accountId }, { isSystem: true }],
    },
  })
  if (custom) return processCustomTemplate(custom.htmlContent, data, keywords)

  // 3. Fallback to multi-product
  return renderTemplate('multi-product', data)
}
