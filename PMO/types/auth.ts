// Authentication and user management types

import { BaseEntity } from './common';

export type UserRole = 'admin' | 'pmo_manager' | 'project_manager' | 'team_member' | 'stakeholder';

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  active: boolean;
  lastLogin?: Date;
  permissions: Permission[];
}

export interface Permission {
  resource: PermissionResource;
  actions: Action[];
  scope?: 'all' | 'own' | 'department' | 'project';
  projectIds?: string[];
}

export type PermissionResource =
  | 'projects'
  | 'scheduling'
  | 'resources'
  | 'budget'
  | 'risks'
  | 'issues'
  | 'time_tracking'
  | 'documents'
  | 'status'
  | 'change_requests'
  | 'stakeholders'
  | 'meetings'
  | 'quality'
  | 'communications'
  | 'reports'
  | 'users'
  | 'settings';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'import';

export interface AuthSession {
  user: User;
  token?: string;
  expiresAt?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData extends LoginCredentials {
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
}
