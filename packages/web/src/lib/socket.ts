import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function subscribeToSim(
  simId: string,
  callbacks: {
    onProgress: (progress: number) => void
    onCompleted: (result: unknown) => void
    onFailed: (error: string) => void
  },
): () => void {
  const s = getSocket()
  s.emit('sim:subscribe', simId)

  const handleProgress = (data: { simId: string; progress: number }) => {
    if (data.simId === simId) callbacks.onProgress(data.progress)
  }
  const handleCompleted = (data: { simId: string; result: unknown }) => {
    if (data.simId === simId) callbacks.onCompleted(data.result)
  }
  const handleFailed = (data: { simId: string; error: string }) => {
    if (data.simId === simId) callbacks.onFailed(data.error)
  }

  s.on('sim:progress', handleProgress)
  s.on('sim:completed', handleCompleted)
  s.on('sim:failed', handleFailed)

  return () => {
    s.emit('sim:unsubscribe', simId)
    s.off('sim:progress', handleProgress)
    s.off('sim:completed', handleCompleted)
    s.off('sim:failed', handleFailed)
  }
}

// ── Raid Planner Collaboration ───────────────────────────────────────────────

export interface PlanCursor {
  x: number
  y: number
  userName: string
  color: string
}

export interface PlanCollabCallbacks {
  onUpdate: (phase: number, items: any[]) => void
  onCursor: (cursor: PlanCursor) => void
  onUserJoined: (userName: string, count: number) => void
  onUserLeft: (userName: string, count: number) => void
}

export function joinPlanRoom(
  planId: string,
  userName: string,
  callbacks: PlanCollabCallbacks,
): {
  sendUpdate: (phase: number, items: any[]) => void
  sendCursor: (x: number, y: number, color: string) => void
  leave: () => void
} {
  const s = getSocket()
  s.emit('raidplan:join', { planId, userName })

  const handleUpdate = (data: { planId: string; phase: number; items: any[] }) => {
    if (data.planId === planId) callbacks.onUpdate(data.phase, data.items)
  }
  const handleCursor = (data: { planId: string } & PlanCursor) => {
    if (data.planId === planId) callbacks.onCursor(data)
  }
  const handleJoined = (data: { userName: string; count: number }) => {
    callbacks.onUserJoined(data.userName, data.count)
  }
  const handleLeft = (data: { userName: string; count: number }) => {
    callbacks.onUserLeft(data.userName, data.count)
  }

  s.on('raidplan:update', handleUpdate)
  s.on('raidplan:cursor', handleCursor)
  s.on('raidplan:user-joined', handleJoined)
  s.on('raidplan:user-left', handleLeft)

  // Throttle cursor sends to ~20fps
  let cursorRaf = 0
  let pendingCursor: { x: number; y: number; color: string } | null = null

  return {
    sendUpdate: (phase: number, items: any[]) => {
      s.emit('raidplan:update', { planId, phase, items })
    },
    sendCursor: (x: number, y: number, color: string) => {
      pendingCursor = { x, y, color }
      if (cursorRaf) return
      cursorRaf = requestAnimationFrame(() => {
        if (pendingCursor) {
          s.emit('raidplan:cursor', { planId, x: pendingCursor.x, y: pendingCursor.y, userName, color: pendingCursor.color })
          pendingCursor = null
        }
        cursorRaf = 0
      })
    },
    leave: () => {
      s.emit('raidplan:leave', { planId })
      s.off('raidplan:update', handleUpdate)
      s.off('raidplan:cursor', handleCursor)
      s.off('raidplan:user-joined', handleJoined)
      s.off('raidplan:user-left', handleLeft)
      if (cursorRaf) cancelAnimationFrame(cursorRaf)
    },
  }
}
