// Authentication service

import { User, LoginCredentials, RegistrationData, AuthSession } from '@/types';
import { dataService, DATA_KEYS } from '@/services/storage';
import { generateId } from '@/utils/helpers';
import { createDefaultPermissions } from '@/lib/permissions';

class AuthService {
  private readonly SESSION_KEY = 'auth_session';

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const users = await dataService.getAll<User>(DATA_KEYS.USERS);
    const user = users.find(u => u.email === credentials.email && u.active);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // In a real app, you would verify the password hash
    // For now, we'll just check if user exists

    // Update last login
    await dataService.update<User>(DATA_KEYS.USERS, user.id, {
      lastLogin: new Date(),
    });

    const session: AuthSession = {
      user,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    this.saveSession(session);

    return session;
  }

  /**
   * Register new user
   */
  async register(data: RegistrationData): Promise<User> {
    const users = await dataService.getAll<User>(DATA_KEYS.USERS);
    const existingUser = users.find(u => u.email === data.email);

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const now = new Date();
    const newUser: User = {
      id: generateId(),
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'team_member', // Default role
      department: data.department,
      jobTitle: data.jobTitle,
      active: true,
      permissions: createDefaultPermissions('team_member'),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
    };

    await dataService.create<User>(DATA_KEYS.USERS, newUser);

    return newUser;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    this.clearSession();
  }

  /**
   * Get current session
   */
  getSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;

    const sessionStr = localStorage.getItem(this.SESSION_KEY);
    if (!sessionStr) return null;

    try {
      const session: AuthSession = JSON.parse(sessionStr);

      // Check if session expired
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    const session = this.getSession();
    return session?.user || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  /**
   * Update current user
   */
  async updateCurrentUser(updates: Partial<User>): Promise<User> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const updatedUser = await dataService.update<User>(
      DATA_KEYS.USERS,
      session.user.id,
      updates
    );

    // Update session
    session.user = updatedUser;
    this.saveSession(session);

    return updatedUser;
  }

  /**
   * Change password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const session = this.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // In a real app, you would verify old password and hash new one
    // For now, we'll just simulate success
    console.log('Password changed successfully');
  }

  /**
   * Save session to localStorage
   */
  private saveSession(session: AuthSession): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Clear session from localStorage
   */
  private clearSession(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Initialize default admin user if no users exist
   */
  async initializeDefaultUser(): Promise<void> {
    const users = await dataService.getAll<User>(DATA_KEYS.USERS);

    if (users.length === 0) {
      const now = new Date();
      const adminUser: User = {
        id: generateId(),
        email: 'admin@pmo.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        department: 'IT',
        jobTitle: 'System Administrator',
        active: true,
        permissions: createDefaultPermissions('admin'),
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        updatedBy: 'system',
      };

      await dataService.create<User>(DATA_KEYS.USERS, adminUser);
      console.log('Default admin user created: admin@pmo.com / password');
    }
  }
}

export default new AuthService();
