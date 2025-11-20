/**
 * API Service - Business logic layer
 * Currently uses localStorage via storageService
 * Designed to be easily replaced with actual HTTP API calls
 */

import { storageService, STORAGE_KEYS } from './storage.service';
import {
  User,
  AuthUser,
  MainEvent,
  Category,
  ApiResponse,
  LoginCredentials,
  SignupData,
  MediaUploadConfig,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

// Default categories
const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'userId' | 'createdAt'>[] = [
  { name: 'Travel', color: '#3b82f6', icon: 'Plane' },
  { name: 'Wedding', color: '#ec4899', icon: 'Heart' },
  { name: 'Career', color: '#8b5cf6', icon: 'Briefcase' },
  { name: 'Education', color: '#10b981', icon: 'GraduationCap' },
  { name: 'Family', color: '#f59e0b', icon: 'Users' },
  { name: 'Achievement', color: '#ef4444', icon: 'Trophy' },
  { name: 'Health', color: '#14b8a6', icon: 'Heart' },
  { name: 'Other', color: '#6b7280', icon: 'Calendar' },
];

// Default media config
const DEFAULT_MEDIA_CONFIG: MediaUploadConfig = {
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxImagesPerEvent: 10,
  allowedImageFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowYouTube: true,
};

class ApiService {
  // ==================== Auth Methods ====================

  async signup(data: SignupData): Promise<ApiResponse<User>> {
    try {
      // Check if user already exists
      const users = storageService.getAll<AuthUser>(STORAGE_KEYS.USERS);
      const existingUser = users.find(u => u.email === data.email);

      if (existingUser) {
        return {
          success: false,
          error: 'User with this email already exists',
        };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10);

      // Create user
      const newUser: AuthUser = {
        id: uuidv4(),
        email: data.email,
        name: data.name,
        passwordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save user
      storageService.upsert(STORAGE_KEYS.USERS, newUser);

      // Create default categories for user
      this.initializeDefaultCategories(newUser.id);

      // Return user without password
      const { passwordHash: _, ...userWithoutPassword } = newUser;
      return {
        success: true,
        data: userWithoutPassword,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create account',
      };
    }
  }

  async login(credentials: LoginCredentials): Promise<ApiResponse<User>> {
    try {
      const users = storageService.getAll<AuthUser>(STORAGE_KEYS.USERS);
      const user = users.find(u => u.email === credentials.email);

      if (!user) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Verify password
      const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

      if (!isValid) {
        return {
          success: false,
          error: 'Invalid email or password',
        };
      }

      // Set current user
      const { passwordHash: _, ...userWithoutPassword } = user;
      storageService.set(STORAGE_KEYS.CURRENT_USER, userWithoutPassword);

      return {
        success: true,
        data: userWithoutPassword,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Login failed',
      };
    }
  }

  logout(): void {
    storageService.remove(STORAGE_KEYS.CURRENT_USER);
  }

  getCurrentUser(): User | null {
    return storageService.get<User>(STORAGE_KEYS.CURRENT_USER);
  }

  // ==================== Event Methods ====================

  async getEvents(userId: string): Promise<ApiResponse<MainEvent[]>> {
    try {
      const events = storageService.getAll<MainEvent>(STORAGE_KEYS.EVENTS);
      const userEvents = events.filter(e => e.userId === userId);

      // Sort by dateFrom (most recent first)
      userEvents.sort((a, b) =>
        new Date(b.dateFrom).getTime() - new Date(a.dateFrom).getTime()
      );

      return {
        success: true,
        data: userEvents,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch events',
      };
    }
  }

  async getEvent(eventId: string): Promise<ApiResponse<MainEvent>> {
    try {
      const event = storageService.getById<MainEvent>(STORAGE_KEYS.EVENTS, eventId);

      if (!event) {
        return {
          success: false,
          error: 'Event not found',
        };
      }

      return {
        success: true,
        data: event,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch event',
      };
    }
  }

  async createEvent(event: Omit<MainEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<MainEvent>> {
    try {
      const newEvent: MainEvent = {
        ...event,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storageService.upsert(STORAGE_KEYS.EVENTS, newEvent);

      return {
        success: true,
        data: newEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create event',
      };
    }
  }

  async updateEvent(eventId: string, updates: Partial<MainEvent>): Promise<ApiResponse<MainEvent>> {
    try {
      const event = storageService.getById<MainEvent>(STORAGE_KEYS.EVENTS, eventId);

      if (!event) {
        return {
          success: false,
          error: 'Event not found',
        };
      }

      const updatedEvent: MainEvent = {
        ...event,
        ...updates,
        id: eventId, // Ensure ID doesn't change
        updatedAt: new Date().toISOString(),
      };

      storageService.upsert(STORAGE_KEYS.EVENTS, updatedEvent);

      return {
        success: true,
        data: updatedEvent,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to update event',
      };
    }
  }

  async deleteEvent(eventId: string): Promise<ApiResponse<void>> {
    try {
      storageService.deleteById(STORAGE_KEYS.EVENTS, eventId);

      return {
        success: true,
        message: 'Event deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete event',
      };
    }
  }

  // ==================== Category Methods ====================

  async getCategories(userId: string): Promise<ApiResponse<Category[]>> {
    try {
      const categories = storageService.getAll<Category>(STORAGE_KEYS.CATEGORIES);
      const userCategories = categories.filter(c => c.userId === userId);

      return {
        success: true,
        data: userCategories,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch categories',
      };
    }
  }

  async createCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<ApiResponse<Category>> {
    try {
      const newCategory: Category = {
        ...category,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
      };

      storageService.upsert(STORAGE_KEYS.CATEGORIES, newCategory);

      return {
        success: true,
        data: newCategory,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create category',
      };
    }
  }

  async deleteCategory(categoryId: string): Promise<ApiResponse<void>> {
    try {
      storageService.deleteById(STORAGE_KEYS.CATEGORIES, categoryId);

      return {
        success: true,
        message: 'Category deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete category',
      };
    }
  }

  // ==================== Config Methods ====================

  getMediaConfig(): MediaUploadConfig {
    const config = storageService.get<MediaUploadConfig>(STORAGE_KEYS.CONFIG);
    return config || DEFAULT_MEDIA_CONFIG;
  }

  updateMediaConfig(config: Partial<MediaUploadConfig>): void {
    const currentConfig = this.getMediaConfig();
    const updatedConfig = { ...currentConfig, ...config };
    storageService.set(STORAGE_KEYS.CONFIG, updatedConfig);
  }

  // ==================== Helper Methods ====================

  private initializeDefaultCategories(userId: string): void {
    const categories: Category[] = DEFAULT_CATEGORIES.map(cat => ({
      ...cat,
      id: uuidv4(),
      userId,
      createdAt: new Date().toISOString(),
    }));

    categories.forEach(category => {
      storageService.upsert(STORAGE_KEYS.CATEGORIES, category);
    });
  }
}

export const apiService = new ApiService();
