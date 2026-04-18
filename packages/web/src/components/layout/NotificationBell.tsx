import { useEffect, useRef, useState } from 'react'
import { useNotificationStore } from '@/stores/useNotificationStore'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, clear } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = unreadCount()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-72 rounded-xl border border-white/[0.08] bg-wow-panel/95 backdrop-blur-xl shadow-lg shadow-black/30 animate-fade-in z-50">
          <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Notifications</span>
            <div className="flex gap-2">
              {count > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-gray-500 hover:text-[color:var(--class-color)] transition-colors">Mark all read</button>
              )}
              {notifications.length > 0 && (
                <button onClick={clear} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors">Clear</button>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-8">No notifications</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div key={n.id} onClick={() => markRead(n.id)}
                  className={`px-3 py-2.5 border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.02] transition-colors ${!n.read ? 'bg-[color:var(--class-color)]/[0.02]' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--class-color)] flex-shrink-0 mt-1.5" />}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-200">{n.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{n.body}</p>
                      <p className="text-[9px] text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
