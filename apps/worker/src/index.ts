import 'dotenv/config'
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs'
import type { JobPayload } from '@counterpromo/shared'
import { JobType } from '@counterpromo/shared'
import { handleParseUpload } from './handlers/parse-upload.js'
import { handleBrandBootstrap } from './handlers/brand-bootstrap.js'
import { handleProductUrlScrape } from './handlers/product-url-scrape.js'
import { handleRenderPreview } from './handlers/render-preview.js'
import { handleRenderPdf } from './handlers/render-pdf.js'

const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'eu-west-2' })
const QUEUE_URL = process.env.JOBS_QUEUE_URL!

async function processMessage(payload: JobPayload): Promise<void> {
  switch (payload.type) {
    case JobType.ParseUpload:
      return handleParseUpload(payload)
    case JobType.BrandBootstrap:
      return handleBrandBootstrap(payload)
    case JobType.ProductUrlScrape:
      return handleProductUrlScrape(payload)
    case JobType.RenderPreview:
      return handleRenderPreview(payload)
    case JobType.RenderPdf:
      return handleRenderPdf(payload)
    default:
      console.warn('Unknown job type:', (payload as JobPayload).type)
  }
}

async function poll(): Promise<void> {
  const result = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 20, // long polling
    }),
  )

  for (const msg of result.Messages ?? []) {
    const payload = JSON.parse(msg.Body!) as JobPayload
    console.log(`Processing job: ${payload.type} / ${payload.jobId}`)

    try {
      await processMessage(payload)
    } catch (err) {
      console.error(`Job failed: ${payload.type} / ${payload.jobId}`, err)
      // Message will re-appear after visibility timeout → DLQ after maxReceiveCount
      continue
    }

    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle!,
      }),
    )
  }
}

async function run() {
  console.log('Worker started, polling:', QUEUE_URL)
  while (true) {
    await poll().catch((err) => console.error('Poll error:', err))
  }
}

run()
