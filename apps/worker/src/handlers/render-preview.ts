import type { RenderPreviewPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { uploadToS3 } from '../lib/s3.js'
import { loadTemplateData } from '../templates/loader.js'
import { renderTemplate } from '../templates/render.js'
import { renderHtmlToScreenshot } from '../lib/renderer.js'

export async function handleRenderPreview(payload: RenderPreviewPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    const data = await loadTemplateData(payload.promoId, payload.accountId, false, payload.branchId)

    const promo = await prisma.promo.findUnique({
      where: { id: payload.promoId },
      select: { templateId: true },
    })
    const templateId = promo?.templateId ?? 'classic'

    const html = renderTemplate(templateId, data)

    const pngBuffer = await renderHtmlToScreenshot(html)

    const branchSegment = payload.branchId ? `branches/${payload.branchId}/` : ''
    const s3Key = `assets/${payload.accountId}/${payload.promoId}/${branchSegment}preview/${Date.now()}.png`

    await uploadToS3((process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!, s3Key, pngBuffer, 'image/png')

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        branchId: payload.branchId ?? null,
        type: 'preview',
        s3Key,
        sizeBytes: pngBuffer.length,
      },
    })

    await prisma.promo.update({
      where: { id: payload.promoId },
      data: { status: 'ready' },
    })

    await completeJob(payload.jobId, { s3Key, sizeBytes: pngBuffer.length })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
