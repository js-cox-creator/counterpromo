import type { GenerateCoopReportPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { uploadToS3 } from '../lib/s3.js'

export async function handleGenerateCoopReport(payload: GenerateCoopReportPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    // Fetch all PromoItems for this promo that have at least one co-op field set
    const items = await prisma.promoItem.findMany({
      where: {
        promoId: payload.promoId,
        coopVendor: { not: null },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Fetch promo title and account name for the report header
    const promo = await prisma.promo.findUnique({
      where: { id: payload.promoId },
      select: {
        title: true,
        account: { select: { name: true } },
      },
    })

    // Build CSV
    const header = 'Vendor,Product Name,SKU,Price,Co-op Amount,Co-op %,Note'

    const rows = items.map((item) => {
      const price = item.price ? Number(item.price).toFixed(2) : ''
      const coopAmount = item.coopAmount != null ? Number(item.coopAmount).toFixed(2) : ''
      let coopPct = ''
      if (item.coopAmount != null && item.price != null && Number(item.price) !== 0) {
        coopPct = ((Number(item.coopAmount) / Number(item.price)) * 100).toFixed(1)
      }

      // Escape CSV fields that may contain commas or quotes
      const escape = (val: string | null | undefined): string => {
        if (val == null) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      return [
        escape(item.coopVendor),
        escape(item.name),
        escape(item.sku),
        price,
        coopAmount,
        coopPct,
        escape(item.coopNote),
      ].join(',')
    })

    const csvString = [header, ...rows].join('\n')
    const csvBuffer = Buffer.from(csvString, 'utf-8')

    const timestamp = Date.now()
    const s3Key = `assets/${payload.accountId}/${payload.promoId}/coop/${timestamp}.csv`

    await uploadToS3(
      (process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!,
      s3Key,
      csvBuffer,
      'text/csv',
    )

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        type: 'coop_report',
        s3Key,
        sizeBytes: csvBuffer.length,
      },
    })

    await completeJob(payload.jobId, {
      s3Key,
      rowCount: items.length,
      promoTitle: promo?.title ?? '',
      accountName: promo?.account.name ?? '',
    })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
