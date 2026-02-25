import type { FastifyInstance } from 'fastify'
import { prisma } from '@counterpromo/db'
import { BillingPlan, PLAN_LIMITS } from '@counterpromo/shared'
import { requireAuth } from '../middleware/auth.js'

export async function usageRoutes(app: FastifyInstance) {
  // GET /usage — return current month usage summary
  app.get('/', { preHandler: requireAuth }, async (request, reply) => {
    const { accountId } = request.auth

    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1 // 1-12

    // Compute period start/end for the current calendar month
    const periodStart = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString()

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { plan: true },
    })

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' })
    }

    const plan = account.plan as BillingPlan
    const limits = PLAN_LIMITS[plan]

    const usage = await prisma.usageMonthly.findUnique({
      where: { accountId_year_month: { accountId, year, month } },
      select: { promosCount: true },
    })

    return reply.send({
      plan,
      promosUsed: usage?.promosCount ?? 0,
      promosLimit: limits.promosPerMonth,
      periodStart,
      periodEnd,
    })
  })
}
