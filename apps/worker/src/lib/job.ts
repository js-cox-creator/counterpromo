import { prisma } from '@counterpromo/db'

export async function startJob(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })
}

export async function completeJob(jobId: string, result?: object): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'done', completedAt: new Date(), result: result ?? {} },
  })
}

export async function failJob(jobId: string, error: unknown): Promise<void> {
  const errorMsg = error instanceof Error ? error.message : String(error)
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'failed', completedAt: new Date(), errorMsg },
  })
}
