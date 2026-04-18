import type { ConnectionOptions } from 'bullmq'

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const u = new URL(url)
    const opts: ConnectionOptions = {
      host: u.hostname || 'localhost',
      port: u.port ? parseInt(u.port, 10) : 6379,
    }
    if (u.password) (opts as Record<string, unknown>).password = u.password
    if (u.pathname && u.pathname !== '/') {
      const db = parseInt(u.pathname.slice(1), 10)
      if (!isNaN(db)) (opts as Record<string, unknown>).db = db
    }
    return opts
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

export const redisConnection: ConnectionOptions = parseRedisUrl(
  process.env.REDIS_URL || 'redis://localhost:6379',
)
