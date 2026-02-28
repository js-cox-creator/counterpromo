import type { RenderPdfPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { uploadToS3 } from '../lib/s3.js'
import { loadTemplateData } from '../templates/loader.js'
import { renderTemplate } from '../templates/render.js'
import { renderHtmlToPdf } from '../lib/renderer.js'

export async function handleRenderPdf(payload: RenderPdfPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    const data = await loadTemplateData(payload.promoId, payload.accountId, payload.watermark, payload.branchId)

    const promo = await prisma.promo.findUnique({
      where: { id: payload.promoId },
      select: { templateId: true },
    })
    const templateId = promo?.templateId ?? 'classic'

    const html = renderTemplate(templateId, data)

    const pdfBuffer = await renderHtmlToPdf(html)

    const branchSegment = payload.branchId ? `branches/${payload.branchId}/` : ''
    const s3Key = `assets/${payload.accountId}/${payload.promoId}/${branchSegment}pdf/${Date.now()}.pdf`

    await uploadToS3((process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!, s3Key, pdfBuffer, 'application/pdf')

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        branchId: payload.branchId ?? null,
        type: 'pdf',
        s3Key,
        sizeBytes: pdfBuffer.length,
      },
    })

    // Increment monthly render count for usage tracking
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1
    await prisma.usageMonthly.upsert({
      where: { accountId_year_month: { accountId: payload.accountId, year, month } },
      create: { accountId: payload.accountId, year, month, promosCount: 1 },
      update: { promosCount: { increment: 1 } },
    })

    await completeJob(payload.jobId, { s3Key, sizeBytes: pdfBuffer.length })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
