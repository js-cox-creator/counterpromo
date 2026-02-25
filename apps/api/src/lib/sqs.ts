import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import type { JobPayload } from '@counterpromo/shared'

export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION ?? 'eu-west-2',
})

const QUEUE_URL = process.env.JOBS_QUEUE_URL!

export async function enqueueJob(payload: JobPayload): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    }),
  )
}
