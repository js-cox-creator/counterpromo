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

    const data = await loadTemplateData(payload.promoId, payload.accountId, payload.watermark)

    const promo = await prisma.promo.findUnique({
      where: { id: payload.promoId },
      select: { templateId: true },
    })
    const templateId = promo?.templateId ?? 'classic'

    const html = renderTemplate(templateId, data)

    const pdfBuffer = await renderHtmlToPdf(html)

    const s3Key = `assets/${payload.accountId}/${payload.promoId}/pdf/${Date.now()}.pdf`

    await uploadToS3((process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!, s3Key, pdfBuffer, 'application/pdf')

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        type: 'pdf',
        s3Key,
        sizeBytes: pdfBuffer.length,
      },
    })

    await completeJob(payload.jobId, { s3Key, sizeBytes: pdfBuffer.length })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
