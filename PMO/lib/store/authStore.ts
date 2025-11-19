// Zustand store for authentication state

import { create } from 'zustand';
import { User, AuthSession } from '@/types';
import authService from '@/services/api/authService';

interface AuthState {
  user: User | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: AuthSession | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  checkAuth: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setSession: (session) =>
    set({
      session,
      user: session?.user || null,
      isAuthenticated: !!session,
    }),

  login: async (email, password) => {
    try {
      const session = await authService.login({ email, password });
      set({
        session,
        user: session.user,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
      set({
        session: null,
        user: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },

  register: async (data) => {
    try {
      await authService.register(data);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  },

  updateUser: async (updates) => {
    try {
      const updatedUser = await authService.updateCurrentUser(updates);
      set({ user: updatedUser });
    } catch (error) {
      console.error('Update user failed:', error);
      throw error;
    }
  },

  checkAuth: () => {
    const session = authService.getSession();
    if (session) {
      set({
        session,
        user: session.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      set({
        session: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  initialize: async () => {
    try {
      await authService.initializeDefaultUser();
      get().checkAuth();
    } catch (error) {
      console.error('Initialization failed:', error);
      set({ isLoading: false });
    }
  },
}));
