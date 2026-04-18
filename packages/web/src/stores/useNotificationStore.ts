import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notification {
  id: string
  type: 'sim_complete' | 'info' | 'guild'
  title: string
  body: string
  read: boolean
  createdAt: string
}

interface NotificationState {
  notifications: Notification[]
  addNotification: (notif: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clear: () => void
  unreadCount: () => number
}

const uid = () => Math.random().toString(36).slice(2, 10)

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (notif) => set((s) => ({
        notifications: [
          { ...notif, id: uid(), read: false, createdAt: new Date().toISOString() },
          ...s.notifications.slice(0, 49), // keep max 50
        ],
      })),

      markRead: (id) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      })),

      markAllRead: () => set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      })),

      clear: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: 'wow-notifications' },
  ),
)
