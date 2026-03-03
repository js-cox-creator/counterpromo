import { prisma } from '@counterpromo/db'
import type { TemplatePromoData } from './types.js'

function toNumber(price: unknown): number {
  const n = typeof price === 'object' && price !== null && 'toNumber' in price
    ? (price as { toNumber(): number }).toNumber()
    : Number(price)
  return isNaN(n) ? 0 : n
}

function formatPrice(price: unknown): string {
  const n = toNumber(price)
  return `$${n.toFixed(2)}`
}

function wholeOf(formatted: string): string {
  return formatted.replace('$', '').split('.')[0] ?? '0'
}

function centsOf(formatted: string): string {
  return formatted.replace('$', '').split('.')[1] ?? '00'
}

export async function loadTemplateData(
  promoId: string,
  accountId: string,
  watermark: boolean,
  branchId?: string,
): Promise<TemplatePromoData> {
  const [promo, brandKit] = await Promise.all([
    prisma.promo.findFirstOrThrow({
      where: { id: promoId, accountId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.brandKit.findUnique({ where: { accountId } }),
  ])

  const colors = (brandKit?.colors ?? []) as string[]
  const [account, branch] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { name: true } }),
    branchId ? prisma.branch.findFirst({ where: { id: branchId, accountId } }) : Promise.resolve(null),
  ])

  // CTA: use promo CTA if set, otherwise fall back to branch CTA
  const resolvedCta = promo.cta || branch?.cta || null

  return {
    promo: { id: promo.id, title: promo.title, subhead: promo.subhead, cta: resolvedCta },
    items: promo.items.map(item => {
      const priceFormatted = formatPrice(item.price)
      const rrpRaw = item.rrp ? toNumber(item.rrp) : null
      const saleRaw = toNumber(item.price)
      const rrpFormatted = rrpRaw !== null ? `$${rrpRaw.toFixed(2)}` : null
      const hasRrp = rrpRaw !== null && rrpRaw > saleRaw
      const discountPercent = hasRrp && rrpRaw
        ? String(Math.round((1 - saleRaw / rrpRaw) * 100))
        : null

      return {
        name: item.name,
        price: priceFormatted,
        priceWhole: wholeOf(priceFormatted),
        priceCents: centsOf(priceFormatted),
        rrp: rrpFormatted,
        rrpWhole: rrpFormatted ? wholeOf(rrpFormatted) : null,
        rrpCents: rrpFormatted ? centsOf(rrpFormatted) : null,
        discountPercent,
        hasRrp,
        sku: item.sku,
        unit: item.unit,
        category: item.category,
        vendor: item.vendor,
        imageUrl: item.imageUrl,
      }
    }),
    brand: {
      logoUrl: brandKit?.logoUrl ?? null,
      primaryColor: colors[0] ?? '#1a1a2e',
      secondaryColor: colors[1] ?? '#e94560',
      name: account?.name ?? 'My Company',
      strapline: brandKit?.strapline ?? null,
      websiteUrl: brandKit?.websiteUrl ?? null,
      aiDescription: brandKit?.aiDescription ?? null,
    },
    ...(branch ? {
      branch: {
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        email: branch.email,
        cta: branch.cta,
      },
    } : {}),
    watermark,
  }
}
