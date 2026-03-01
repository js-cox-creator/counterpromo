import * as cheerio from 'cheerio'
import { generateCopy } from '../lib/gemini.js'
import type { TemplatePromoData } from './types.js'

// ---------------------------------------------------------------------------
// Colour injection
// ---------------------------------------------------------------------------

function injectColor(
  $: cheerio.CheerioAPI,
  selector: string,
  prop: string,
  value: string,
) {
  $(selector).each((_i, el) => {
    const existing = $(el).attr('style') ?? ''
    const separator = existing && !existing.trim().endsWith(';') ? '; ' : ''
    $(el).attr('style', `${existing}${separator}${prop}: ${value};`)
  })
}

// ---------------------------------------------------------------------------
// Price formatting helpers
// ---------------------------------------------------------------------------

function formatPrice(price: string): string {
  const num = parseFloat(price)
  if (isNaN(num)) return price
  return `$${num.toFixed(2)}`
}

function priceWhole(price: string): string {
  const num = parseFloat(price)
  if (isNaN(num)) return '0'
  return String(Math.floor(num))
}

function priceCents(price: string): string {
  const num = parseFloat(price)
  if (isNaN(num)) return '00'
  return num.toFixed(2).split('.')[1] ?? '00'
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processCustomTemplate(
  html: string,
  data: TemplatePromoData,
  keywords: string[],
): Promise<string> {
  const $ = cheerio.load(html)

  // 1. Colour injection
  injectColor($, '.counterpromo-bg-primary', 'background-color', data.brand.primaryColor)
  injectColor($, '.counterpromo-bg-secondary', 'background-color', data.brand.secondaryColor)
  injectColor($, '.counterpromo-text-primary', 'color', data.brand.primaryColor)
  injectColor($, '.counterpromo-text-secondary', 'color', data.brand.secondaryColor)
  injectColor($, '.counterpromo-border-primary', 'border-color', data.brand.primaryColor)
  injectColor($, '.counterpromo-border-secondary', 'border-color', data.brand.secondaryColor)

  // 2. Text / image slots
  $('.counterpromo-brand-name').text(data.brand.name)

  if (data.brand.logoUrl) {
    $('.counterpromo-brand-logo').attr('src', data.brand.logoUrl)
  } else {
    $('.counterpromo-brand-logo').remove()
  }

  $('.counterpromo-promo-title').text(data.promo.title)

  if (data.promo.subhead) {
    $('.counterpromo-promo-subhead').text(data.promo.subhead)
  } else {
    $('.counterpromo-promo-subhead').remove()
  }

  $('.counterpromo-promo-cta').text(data.promo.cta ?? 'Contact us today')

  if (data.branch) {
    $('.counterpromo-branch-name').text(data.branch.name)
    $('.counterpromo-branch-phone').text(data.branch.phone ?? '')
    $('.counterpromo-branch-email').text(data.branch.email ?? '')
    $('.counterpromo-branch-address').text(data.branch.address ?? '')
  }

  // 3. Conditionals
  if (!data.brand.logoUrl) {
    $('.counterpromo-if-logo').remove()
  }
  if (!data.branch) {
    $('.counterpromo-if-branch').remove()
  }
  if (!data.promo.subhead) {
    $('.counterpromo-if-subhead').remove()
  }

  // 4. Product repeater
  const productTemplate = $('.counterpromo-product').first()
  if (productTemplate.length && data.items.length > 0) {
    const parent = productTemplate.parent()

    for (const item of data.items) {
      const clone = productTemplate.clone()

      clone.find('.counterpromo-product-name').text(item.name)
      clone.find('.counterpromo-product-price').text(formatPrice(item.price))
      clone.find('.counterpromo-product-price-whole').text(priceWhole(item.price))
      clone.find('.counterpromo-product-price-cents').text(priceCents(item.price))

      if (item.imageUrl) {
        clone.find('.counterpromo-product-image').attr('src', item.imageUrl)
      } else {
        clone.find('.counterpromo-product-image').remove()
      }

      clone.find('.counterpromo-product-category').text(item.category ?? '')
      clone.find('.counterpromo-product-vendor').text(item.vendor ?? '')
      clone.find('.counterpromo-product-sku').text(item.sku ?? '')
      clone.find('.counterpromo-product-unit').text(item.unit ?? '')

      parent.append(clone)
    }

    productTemplate.remove()
  }

  // 5. AI copy generation (sequential to avoid rate-limiting hammering)
  const genEls = $('.counterpromo-gen').toArray()
  for (const el of genEls) {
    const prompt = $(el).text().trim()
    if (prompt) {
      const copy = await generateCopy(prompt, {
        brandName: data.brand.name,
        promoTitle: data.promo.title,
        keywords,
      })
      if (copy) $(el).text(copy)
      // if null (no key / error), element keeps its original prompt text
    }
  }

  return $.html()
}
