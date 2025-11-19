// API implementation of IDataService
// This is a skeleton for future API integration

import { IDataService } from './IDataService';

class ApiService implements IDataService {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(key: string, id: string): Promise<T | null> {
    try {
      return await this.request<T>(`/${key}/${id}`);
    } catch (error) {
      console.error(`Error fetching ${key}/${id}:`, error);
      return null;
    }
  }

  async getAll<T>(key: string): Promise<T[]> {
    try {
      return await this.request<T[]>(`/${key}`);
    } catch (error) {
      console.error(`Error fetching all ${key}:`, error);
      return [];
    }
  }

  async create<T>(key: string, data: T): Promise<T> {
    return await this.request<T>(`/${key}`, 'POST', data);
  }

  async update<T>(key: string, id: string, data: Partial<T>): Promise<T> {
    return await this.request<T>(`/${key}/${id}`, 'PUT', data);
  }

  async delete(key: string, id: string): Promise<boolean> {
    try {
      await this.request(`/${key}/${id}`, 'DELETE');
      return true;
    } catch (error) {
      console.error(`Error deleting ${key}/${id}:`, error);
      return false;
    }
  }

  async query<T>(key: string, predicate: (item: T) => boolean): Promise<T[]> {
    // For API, we'd typically send query parameters
    // For now, fetch all and filter client-side (not ideal for production)
    const items = await this.getAll<T>(key);
    return items.filter(predicate);
  }

  async createMany<T>(key: string, items: T[]): Promise<T[]> {
    return await this.request<T[]>(`/${key}/batch`, 'POST', items);
  }

  async updateMany<T>(
    key: string,
    updates: Array<{ id: string; data: Partial<T> }>
  ): Promise<T[]> {
    return await this.request<T[]>(`/${key}/batch`, 'PUT', updates);
  }

  async deleteMany(key: string, ids: string[]): Promise<boolean> {
    try {
      await this.request(`/${key}/batch`, 'DELETE', { ids });
      return true;
    } catch (error) {
      console.error(`Error deleting multiple ${key}:`, error);
      return false;
    }
  }

  async clear(key: string): Promise<boolean> {
    try {
      await this.request(`/${key}/clear`, 'DELETE');
      return true;
    } catch (error) {
      console.error(`Error clearing ${key}:`, error);
      return false;
    }
  }

  async clearAll(): Promise<boolean> {
    try {
      await this.request('/clear-all', 'DELETE');
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }
}

export default new ApiService();
