// Zustand store for notifications

import { create } from 'zustand';
import { Notification } from '@/types';
import { dataService, DATA_KEYS } from '@/services/storage';
import { generateId } from '@/utils/helpers';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  loadNotifications: (userId: string) => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'read'>) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAll: (userId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async (userId) => {
    set({ isLoading: true });
    try {
      const allNotifications = await dataService.query<Notification>(
        DATA_KEYS.NOTIFICATIONS,
        n => n.userId === userId
      );

      const sortedNotifications = allNotifications.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const unreadCount = sortedNotifications.filter(n => !n.read).length;

      set({
        notifications: sortedNotifications,
        unreadCount,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({ isLoading: false });
    }
  },

  addNotification: async (notificationData) => {
    try {
      const now = new Date();
      const notification: Notification = {
        ...notificationData,
        id: generateId(),
        read: false,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        updatedBy: 'system',
      };

      await dataService.create<Notification>(DATA_KEYS.NOTIFICATIONS, notification);

      set(state => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    } catch (error) {
      console.error('Failed to add notification:', error);
    }
  },

  markAsRead: async (notificationId) => {
    try {
      await dataService.update<Notification>(DATA_KEYS.NOTIFICATIONS, notificationId, {
        read: true,
      });

      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async (userId) => {
    try {
      const { notifications } = get();
      const unreadNotifications = notifications.filter(n => !n.read && n.userId === userId);

      const updates = unreadNotifications.map(n => ({
        id: n.id,
        data: { read: true },
      }));

      await dataService.updateMany<Notification>(DATA_KEYS.NOTIFICATIONS, updates);

      set(state => ({
        notifications: state.notifications.map(n =>
          n.userId === userId ? { ...n, read: true } : n
        ),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      const notification = get().notifications.find(n => n.id === notificationId);
      await dataService.delete(DATA_KEYS.NOTIFICATIONS, notificationId);

      set(state => ({
        notifications: state.notifications.filter(n => n.id !== notificationId),
        unreadCount: notification && !notification.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  },

  clearAll: async (userId) => {
    try {
      const { notifications } = get();
      const userNotifications = notifications.filter(n => n.userId === userId);
      const ids = userNotifications.map(n => n.id);

      await dataService.deleteMany(DATA_KEYS.NOTIFICATIONS, ids);

      set({
        notifications: [],
        unreadCount: 0,
      });
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  },
}));
