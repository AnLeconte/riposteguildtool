import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type JwtPayload } from '../services/auth.js'

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

// Required auth — returns 401 if not authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

// Optional auth — attaches user if token present, continues either way
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7))
    } catch {
      // Invalid token — just proceed without user
    }
  }
  next()
}
