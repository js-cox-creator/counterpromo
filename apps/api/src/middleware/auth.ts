import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyToken } from '@clerk/backend'
import { prisma } from '@counterpromo/db'

export interface AuthContext {
  clerkId: string
  accountId: string
  role: string
  branchId: string | null
}

export interface JwtContext {
  clerkId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext
    jwtAuth: JwtContext
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }

  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    const clerkId = payload.sub

    const accountUser = await prisma.accountUser.findFirst({
      where: { clerkId },
      select: { accountId: true, role: true, clerkId: true, branchId: true },
    })

    if (!accountUser) {
      return reply.status(403).send({ error: 'No account found for this user' })
    }

    request.auth = {
      clerkId,
      accountId: accountUser.accountId,
      role: accountUser.role,
      branchId: accountUser.branchId,
    }
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}

// JWT-only auth — verifies the Clerk token but does NOT require an AccountUser.
// Use only for the account bootstrap endpoint (first login).
export async function requireJwtAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! })
    request.jwtAuth = { clerkId: payload.sub }
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.auth?.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
  }
}
