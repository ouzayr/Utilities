// LocalStorage implementation of IDataService
// This allows for easy migration to API calls later

import { IDataService } from './IDataService';

class LocalStorageService implements IDataService {
  private prefix = 'pmo_';

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private getStorage<T>(key: string): T[] {
    if (typeof window === 'undefined') return [];

    const storageKey = this.getKey(key);
    const data = localStorage.getItem(storageKey);

    if (!data) return [];

    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(`Error parsing localStorage key ${storageKey}:`, error);
      return [];
    }
  }

  private setStorage<T>(key: string, data: T[]): void {
    if (typeof window === 'undefined') return;

    const storageKey = this.getKey(key);
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving to localStorage key ${storageKey}:`, error);
      throw error;
    }
  }

  async get<T>(key: string, id: string): Promise<T | null> {
    const items = this.getStorage<T>(key);
    return items.find((item: any) => item.id === id) || null;
  }

  async getAll<T>(key: string): Promise<T[]> {
    return this.getStorage<T>(key);
  }

  async create<T>(key: string, data: T): Promise<T> {
    const items = this.getStorage<T>(key);

    // Ensure unique ID
    const existingItem = items.find((item: any) => item.id === (data as any).id);
    if (existingItem) {
      throw new Error(`Item with id ${(data as any).id} already exists`);
    }

    items.push(data);
    this.setStorage(key, items);

    return data;
  }

  async update<T>(
    key: string,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    const items = this.getStorage<T>(key);
    const index = items.findIndex((item: any) => item.id === id);

    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }

    items[index] = { ...items[index], ...data };
    this.setStorage(key, items);

    return items[index];
  }

  async delete(key: string, id: string): Promise<boolean> {
    const items = this.getStorage(key);
    const filteredItems = items.filter((item: any) => item.id !== id);

    if (filteredItems.length === items.length) {
      return false; // Item not found
    }

    this.setStorage(key, filteredItems);
    return true;
  }

  async query<T>(key: string, predicate: (item: T) => boolean): Promise<T[]> {
    const items = this.getStorage<T>(key);
    return items.filter(predicate);
  }

  async createMany<T>(key: string, newItems: T[]): Promise<T[]> {
    const items = this.getStorage<T>(key);

    // Check for duplicate IDs
    const existingIds = new Set(items.map((item: any) => item.id));
    const duplicates = newItems.filter((item: any) => existingIds.has(item.id));

    if (duplicates.length > 0) {
      throw new Error(`Duplicate IDs found: ${duplicates.map((d: any) => d.id).join(', ')}`);
    }

    items.push(...newItems);
    this.setStorage(key, items);

    return newItems;
  }

  async updateMany<T>(
    key: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<T[]> {
    const items = this.getStorage<T>(key);
    const updatedItems: T[] = [];

    updates.forEach(({ id, data }) => {
      const index = items.findIndex((item: any) => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...data };
        updatedItems.push(items[index]);
      }
    });

    this.setStorage(key, items);
    return updatedItems;
  }

  async deleteMany(key: string, ids: string[]): Promise<boolean> {
    const items = this.getStorage(key);
    const idsSet = new Set(ids);
    const filteredItems = items.filter((item: any) => !idsSet.has(item.id));

    this.setStorage(key, filteredItems);
    return true;
  }

  async clear(key: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const storageKey = this.getKey(key);
    localStorage.removeItem(storageKey);
    return true;
  }

  async clearAll(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Remove only PMO-prefixed keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    return true;
  }
}

export default new LocalStorageService();
