import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import type { JobPayload } from '@counterpromo/shared'

export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION ?? 'eu-west-2',
})

const QUEUE_URL = process.env.JOBS_QUEUE_URL

/**
 * Enqueue a job payload to SQS.
 * Non-fatal: if SQS is unavailable (e.g. expired AWS session in local dev)
 * the error is logged and the call returns normally. The Job record is always
 * saved to the DB before this is called, so it can be requeued manually.
 */
export async function enqueueJob(payload: JobPayload): Promise<void> {
  if (!QUEUE_URL) {
    console.warn('[sqs] JOBS_QUEUE_URL not set — skipping enqueue for job', payload.jobId)
    return
  }
  try {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(payload),
      }),
    )
  } catch (err) {
    // Log but don't throw — the Job row is already persisted and can be requeued
    // once AWS credentials are refreshed (common in local dev with SSO sessions).
    console.warn('[sqs] Failed to enqueue job', payload.jobId, '—', err instanceof Error ? err.message : err)
  }
}
