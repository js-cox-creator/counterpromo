import Handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { GenerateEmailPayload } from '@counterpromo/shared'
import { prisma } from '@counterpromo/db'
import { startJob, completeJob, failJob } from '../lib/job.js'
import { uploadToS3 } from '../lib/s3.js'
import { loadTemplateData } from '../templates/loader.js'
import { generateEmailCopy } from '../lib/gemini.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function renderEmailTemplate(data: object): string {
  const templatePath = join(__dirname, '../templates/email.hbs')
  const source = readFileSync(templatePath, 'utf8')
  const template = Handlebars.compile(source)
  return template(data)
}

export async function handleRenderEmail(payload: GenerateEmailPayload): Promise<void> {
  try {
    await startJob(payload.jobId)

    const data = await loadTemplateData(payload.promoId, payload.accountId, false, payload.branchId)

    const emailCopy = await generateEmailCopy(data)

    const html = renderEmailTemplate({ ...data, emailCopy })

    const htmlBuffer = Buffer.from(html, 'utf8')
    const branchSegment = payload.branchId ? `branches/${payload.branchId}/` : ''
    const s3Key = `assets/${payload.accountId}/${payload.promoId}/${branchSegment}email/${Date.now()}.html`

    await uploadToS3(
      (process.env.S3_ASSETS_BUCKET ?? process.env.ASSETS_BUCKET)!,
      s3Key,
      htmlBuffer,
      'text/html',
    )

    await prisma.asset.create({
      data: {
        accountId: payload.accountId,
        promoId: payload.promoId,
        branchId: payload.branchId ?? null,
        type: 'email_html',
        s3Key,
        sizeBytes: htmlBuffer.length,
      },
    })

    await completeJob(payload.jobId, {
      s3Key,
      sizeBytes: htmlBuffer.length,
      subject: emailCopy.subject,
      preheader: emailCopy.preheader,
    })
  } catch (err) {
    await failJob(payload.jobId, err)
  }
}
