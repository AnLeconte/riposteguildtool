import { Server as SocketIOServer } from 'socket.io'
import type { Server } from 'http'

export interface PlanItem {
  [key: string]: unknown
}

let io: SocketIOServer | null = null

// Track connected users per raid plan room: planId -> Set of userNames
const planRoomUsers = new Map<string, Set<string>>()

export function initSocketIO(httpServer: Server): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  })

  io.on('connection', (socket) => {
    // --- Sim events ---
    socket.on('sim:subscribe', (simId: string) => {
      socket.join(`sim:${simId}`)
    })
    socket.on('sim:unsubscribe', (simId: string) => {
      socket.leave(`sim:${simId}`)
    })

    // --- Raid plan events ---
    socket.on('raidplan:join', ({ planId, userName }: { planId: string; userName: string }) => {
      const room = `raidplan:${planId}`
      socket.join(room)
      socket.data.raidplan = { planId, userName }

      if (!planRoomUsers.has(planId)) {
        planRoomUsers.set(planId, new Set())
      }
      planRoomUsers.get(planId)!.add(userName)

      const count = planRoomUsers.get(planId)!.size
      io?.to(room).emit('raidplan:user-joined', { userName, count })
    })

    socket.on('raidplan:leave', () => {
      handlePlanLeave(socket)
    })

    socket.on('raidplan:update', ({ planId, phase, items }: { planId: string; phase: number; items: PlanItem[] }) => {
      const room = `raidplan:${planId}`
      socket.to(room).emit('raidplan:update', { planId, phase, items })
    })

    socket.on('raidplan:cursor', ({ planId, x, y, userName, color }: { planId: string; x: number; y: number; userName: string; color: string }) => {
      const room = `raidplan:${planId}`
      socket.to(room).emit('raidplan:cursor', { planId, x, y, userName, color })
    })

    socket.on('disconnect', () => {
      handlePlanLeave(socket)
    })
  })

  return io
}

function handlePlanLeave(socket: { data: Record<string, unknown>; leave: (room: string) => void; id: string }): void {
  const raidplan = socket.data.raidplan as { planId: string; userName: string } | undefined
  if (!raidplan) return

  const { planId, userName } = raidplan
  const room = `raidplan:${planId}`
  socket.leave(room)

  const users = planRoomUsers.get(planId)
  if (users) {
    users.delete(userName)
    const count = users.size
    if (count === 0) {
      planRoomUsers.delete(planId)
    }
    io?.to(room).emit('raidplan:user-left', { userName, count })
  }

  delete socket.data.raidplan
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}

export function emitSimProgress(simId: string, progress: number): void {
  io?.to(`sim:${simId}`).emit('sim:progress', { simId, progress })
}

export function emitSimCompleted(simId: string, result: unknown): void {
  io?.to(`sim:${simId}`).emit('sim:completed', { simId, result })
}

export function emitSimFailed(simId: string, error: string): void {
  io?.to(`sim:${simId}`).emit('sim:failed', { simId, error })
}

// --- Raid plan helpers ---

export function emitPlanUpdate(planId: string, phase: number, items: PlanItem[], excludeSocketId?: string): void {
  const room = `raidplan:${planId}`
  if (excludeSocketId) {
    io?.to(room).except(excludeSocketId).emit('raidplan:update', { planId, phase, items })
  } else {
    io?.to(room).emit('raidplan:update', { planId, phase, items })
  }
}

export function getPlanRoomCount(planId: string): number {
  return planRoomUsers.get(planId)?.size ?? 0
}
