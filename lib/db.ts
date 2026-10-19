// One shared Prisma client for the whole app (server only).
// The 20-second connect budget is added in memory — .env is never edited —
// because this PC's network can take ~5 s just to reach the database.
import { PrismaClient } from '@prisma/client'

const CONNECT_TIMEOUT_SECONDS = 20

function buildDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  if (/connect_timeout=/.test(url)) return url
  return `${url}&connect_timeout=${CONNECT_TIMEOUT_SECONDS}`
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(buildDatasourceUrl() ? { datasourceUrl: buildDatasourceUrl() } : {}),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
