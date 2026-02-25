import type { FastifyInstance } from 'fastify'
import { prisma } from '@counterpromo/db'
import { requireAuth } from '../middleware/auth.js'

export async function jobRoutes(app: FastifyInstance) {
  // GET /jobs/:id — poll job status
  app.get('/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth
    const { id } = request.params as { id: string }

    const job = await prisma.job.findFirst({
      where: { id, accountId },
      select: {
        id: true,
        type: true,
        status: true,
        result: true,
        errorMsg: true,
        startedAt: true,
        completedAt: true,
      },
    })

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' })
    }

    return reply.send(job)
  })
}
