import type { RenderSocialImagePayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { uploadToS3 } from '../lib/s3.js'
import { loadTemplateData } from '../templates/loader.js'
import { renderTemplate } from '../templates/render.js'
import { renderHtmlToSocialImage } from '../lib/renderer.js'
import { generateSocialCaptions } from '../lib/gemini.js'

export async function handleRenderSocialImage(payload: RenderSocialImagePayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    const data = await loadTemplateData(payload.promoId, payload.accountId, payload.watermark, payload.branchId)

    const html = renderTemplate('social-square', data)

    const [pngBuffer, captions] = await Promise.all([
      renderHtmlToSocialImage(html),
      generateSocialCaptions(data),
    ])

    const branchSegment = payload.branchId ? `branches/${payload.branchId}/` : ''
    const s3Key = `assets/${payload.accountId}/${payload.promoId}/${branchSegment}social/${Date.now()}.png`

    await uploadToS3(
      (process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!,
      s3Key,
      pngBuffer,
      'image/png',
    )

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        branchId: payload.branchId ?? null,
        type: 'social_image',
        s3Key,
        sizeBytes: pngBuffer.length,
      },
    })

    await completeJob(payload.jobId, { s3Key, sizeBytes: pngBuffer.length, captions })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
