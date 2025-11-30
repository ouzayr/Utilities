import { create } from 'zustand';
import { MainEvent, Category, User } from '@/types';

interface AppState {
  user: User | null;
  events: MainEvent[];
  categories: Category[];
  selectedEvent: MainEvent | null;
  filters: {
    categoryIds: string[];
    searchQuery: string;
  };
  setUser: (user: User | null) => void;
  setEvents: (events: MainEvent[]) => void;
  setCategories: (categories: Category[]) => void;
  setSelectedEvent: (event: MainEvent | null) => void;
  setFilters: (filters: Partial<AppState['filters']>) => void;
  addEvent: (event: MainEvent) => void;
  updateEvent: (event: MainEvent) => void;
  deleteEvent: (eventId: string) => void;
  addCategory: (category: Category) => void;
  deleteCategory: (categoryId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  events: [],
  categories: [],
  selectedEvent: null,
  filters: {
    categoryIds: [],
    searchQuery: '',
  },
  setUser: (user) => set({ user }),
  setEvents: (events) => set({ events }),
  setCategories: (categories) => set({ categories }),
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),
  updateEvent: (event) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === event.id ? event : e)),
    })),
  deleteEvent: (eventId) =>
    set((state) => ({
      events: state.events.filter((e) => e.id !== eventId),
    })),
  addCategory: (category) =>
    set((state) => ({ categories: [...state.categories, category] })),
  deleteCategory: (categoryId) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== categoryId),
    })),
}));
