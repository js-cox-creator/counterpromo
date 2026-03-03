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

  // 2. Text / image slots — brand
  $('.counterpromo-brand-name').text(data.brand.name)

  if (data.brand.logoUrl) {
    $('.counterpromo-brand-logo').attr('src', data.brand.logoUrl)
  } else {
    $('.counterpromo-brand-logo').remove()
  }

  if (data.brand.strapline) {
    $('.counterpromo-brand-strapline').text(data.brand.strapline)
  } else {
    $('.counterpromo-brand-strapline').remove()
  }

  if (data.brand.aiDescription) {
    $('.counterpromo-brand-description').text(data.brand.aiDescription)
  } else {
    $('.counterpromo-brand-description').remove()
  }

  if (data.brand.websiteUrl) {
    $('.counterpromo-brand-website').text(data.brand.websiteUrl)
  } else {
    $('.counterpromo-brand-website').remove()
  }

  // 2b. Text / image slots — promo
  $('.counterpromo-promo-title').text(data.promo.title)

  if (data.promo.subhead) {
    $('.counterpromo-promo-subhead').text(data.promo.subhead)
  } else {
    $('.counterpromo-promo-subhead').remove()
  }

  $('.counterpromo-promo-cta').text(data.promo.cta ?? 'Contact us today')

  // 2c. Text slots — branch
  if (data.branch) {
    $('.counterpromo-branch-name').text(data.branch.name)
    $('.counterpromo-branch-phone').text(data.branch.phone ?? '')
    $('.counterpromo-branch-email').text(data.branch.email ?? '')
    $('.counterpromo-branch-address').text(data.branch.address ?? '')
  }

  // 3. Conditionals
  if (!data.brand.logoUrl) $('.counterpromo-if-logo').remove()
  if (!data.branch) $('.counterpromo-if-branch').remove()
  if (!data.promo.subhead) $('.counterpromo-if-subhead').remove()
  if (!data.brand.strapline) $('.counterpromo-if-strapline').remove()
  if (!data.brand.aiDescription) $('.counterpromo-if-description').remove()

  // 4. Product repeater
  const productTemplate = $('.counterpromo-product').first()
  if (productTemplate.length && data.items.length > 0) {
    const parent = productTemplate.parent()

    for (const item of data.items) {
      const clone = productTemplate.clone()

      clone.find('.counterpromo-product-name').text(item.name)

      // Sale price
      clone.find('.counterpromo-product-price').text(item.price)
      clone.find('.counterpromo-product-price-whole').text(item.priceWhole)
      clone.find('.counterpromo-product-price-cents').text(item.priceCents)

      // RRP / MSRP
      if (item.rrp) {
        clone.find('.counterpromo-product-rrp').text(item.rrp)
        clone.find('.counterpromo-product-rrp-whole').text(item.rrpWhole ?? '')
        clone.find('.counterpromo-product-rrp-cents').text(item.rrpCents ?? '')
      } else {
        clone.find('.counterpromo-product-rrp').remove()
        clone.find('.counterpromo-product-rrp-whole').remove()
        clone.find('.counterpromo-product-rrp-cents').remove()
      }

      // Discount percent
      if (item.discountPercent) {
        clone.find('.counterpromo-product-discount-percent').text(`${item.discountPercent}%`)
      } else {
        clone.find('.counterpromo-product-discount-percent').remove()
      }

      // Conditional blocks inside product
      if (!item.hasRrp) clone.find('.counterpromo-if-rrp').remove()

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
