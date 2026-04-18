import type { Request, Response, NextFunction } from 'express'

const requests = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const entry = requests.get(key)

    if (!entry || now > entry.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ success: false, error: 'Too many requests, please try again later' })
      return
    }

    entry.count++
    next()
  }
}
