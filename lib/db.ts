// One shared Prisma client for the whole app (server only).
// The connect and pool budgets are added in memory — .env is never edited —
// because this PC's network can take ~5 s just to reach the database.
import { PrismaClient } from '@prisma/client'

const CONNECT_TIMEOUT_SECONDS = 20
// Prisma's default pool_timeout is 10 s: on a slow link one query can hold
// a connection longer than that and the next one dies with "timed out
// fetching a new connection from the connection pool".
const POOL_TIMEOUT_SECONDS = 30

function buildDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  let out = url
  if (!/connect_timeout=/.test(out)) out = `${out}&connect_timeout=${CONNECT_TIMEOUT_SECONDS}`
  if (!/pool_timeout=/.test(out)) out = `${out}&pool_timeout=${POOL_TIMEOUT_SECONDS}`
  return out
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
