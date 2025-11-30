/**
 * Storage Service - Abstract layer for data persistence
 * Currently uses localStorage, designed for easy migration to API
 */

const STORAGE_KEYS = {
  USERS: 'timeline_users',
  EVENTS: 'timeline_events',
  CATEGORIES: 'timeline_categories',
  CURRENT_USER: 'timeline_current_user',
  CONFIG: 'timeline_config',
} as const;

class StorageService {
  private isClient = typeof window !== 'undefined';

  /**
   * Generic remove method
   */
  remove(key: string): void {
    if (!this.isClient) return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage (${key}):`, error);
    }
  }

  /**
   * Get single value
   */
  get<T>(key: string): T | null {
    if (!this.isClient) return null;

    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return null;
    }
  }

  /**
   * Set single value
   */
  set<T>(key: string, value: T): void {
    if (!this.isClient) return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
    }
  }

  /**
   * Get all items of a specific type
   */
  getAll<T>(key: string): T[] {
    return this.get<T[]>(key) || [];
  }

  /**
   * Set all items of a specific type
   */
  setAll<T>(key: string, items: T[]): void {
    this.set(key, items);
  }

  /**
   * Get single item by ID
   */
  getById<T extends { id: string }>(key: string, id: string): T | null {
    const items = this.getAll<T>(key);
    return items.find(item => item.id === id) || null;
  }

  /**
   * Add or update item
   */
  upsert<T extends { id: string }>(key: string, item: T): void {
    const items = this.getAll<T>(key);
    const index = items.findIndex(i => i.id === item.id);

    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }

    this.setAll(key, items);
  }

  /**
   * Delete item by ID
   */
  deleteById<T extends { id: string }>(key: string, id: string): void {
    const items = this.getAll<T>(key);
    const filtered = items.filter(item => item.id !== id);
    this.setAll(key, filtered);
  }

  /**
   * Clear all data (useful for logout)
   */
  clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      this.remove(key);
    });
  }

  /**
   * Get storage keys
   */
  get keys() {
    return STORAGE_KEYS;
  }
}

export const storageService = new StorageService();
export { STORAGE_KEYS };
