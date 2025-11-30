// Permission management system

import { Permission, UserRole, PermissionResource, Action, User } from '@/types';

/**
 * Create default permissions based on role
 */
export function createDefaultPermissions(role: UserRole): Permission[] {
  switch (role) {
    case 'admin':
      return getAdminPermissions();
    case 'pmo_manager':
      return getPMOManagerPermissions();
    case 'project_manager':
      return getProjectManagerPermissions();
    case 'team_member':
      return getTeamMemberPermissions();
    case 'stakeholder':
      return getStakeholderPermissions();
    default:
      return [];
  }
}

/**
 * Admin has full access to everything
 */
function getAdminPermissions(): Permission[] {
  const allResources: PermissionResource[] = [
    'projects',
    'scheduling',
    'resources',
    'budget',
    'risks',
    'issues',
    'time_tracking',
    'documents',
    'status',
    'change_requests',
    'stakeholders',
    'meetings',
    'quality',
    'communications',
    'reports',
    'users',
    'settings',
  ];

  const allActions: Action[] = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'import'];

  return allResources.map(resource => ({
    resource,
    actions: allActions,
    scope: 'all',
  }));
}

/**
 * PMO Manager can view and manage all projects
 */
function getPMOManagerPermissions(): Permission[] {
  return [
    { resource: 'projects', actions: ['view', 'create', 'edit', 'delete', 'export', 'import'], scope: 'all' },
    { resource: 'scheduling', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'resources', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'budget', actions: ['view', 'create', 'edit', 'approve', 'export'], scope: 'all' },
    { resource: 'risks', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'issues', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'time_tracking', actions: ['view', 'approve', 'export'], scope: 'all' },
    { resource: 'documents', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'status', actions: ['view', 'export'], scope: 'all' },
    { resource: 'change_requests', actions: ['view', 'create', 'edit', 'approve', 'export'], scope: 'all' },
    { resource: 'stakeholders', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'meetings', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'quality', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'all' },
    { resource: 'communications', actions: ['view', 'create', 'edit', 'delete'], scope: 'all' },
    { resource: 'reports', actions: ['view', 'create', 'export'], scope: 'all' },
    { resource: 'users', actions: ['view', 'create', 'edit'], scope: 'all' },
    { resource: 'settings', actions: ['view', 'edit'], scope: 'all' },
  ];
}

/**
 * Project Manager can manage their own projects
 */
function getProjectManagerPermissions(): Permission[] {
  return [
    { resource: 'projects', actions: ['view', 'create', 'edit', 'export'], scope: 'own' },
    { resource: 'scheduling', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'resources', actions: ['view', 'create', 'edit', 'export'], scope: 'project' },
    { resource: 'budget', actions: ['view', 'create', 'edit', 'export'], scope: 'project' },
    { resource: 'risks', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'issues', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'time_tracking', actions: ['view', 'approve', 'export'], scope: 'project' },
    { resource: 'documents', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'status', actions: ['view', 'export'], scope: 'project' },
    { resource: 'change_requests', actions: ['view', 'create', 'edit', 'export'], scope: 'project' },
    { resource: 'stakeholders', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'meetings', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'quality', actions: ['view', 'create', 'edit', 'delete', 'export'], scope: 'project' },
    { resource: 'communications', actions: ['view', 'create', 'edit', 'delete'], scope: 'project' },
    { resource: 'reports', actions: ['view', 'create', 'export'], scope: 'project' },
  ];
}

/**
 * Team Member has limited access
 */
function getTeamMemberPermissions(): Permission[] {
  return [
    { resource: 'projects', actions: ['view'], scope: 'project' },
    { resource: 'scheduling', actions: ['view'], scope: 'project' },
    { resource: 'resources', actions: ['view'], scope: 'project' },
    { resource: 'budget', actions: ['view'], scope: 'project' },
    { resource: 'risks', actions: ['view', 'create'], scope: 'project' },
    { resource: 'issues', actions: ['view', 'create', 'edit'], scope: 'own' },
    { resource: 'time_tracking', actions: ['view', 'create', 'edit', 'export'], scope: 'own' },
    { resource: 'documents', actions: ['view', 'create'], scope: 'project' },
    { resource: 'status', actions: ['view'], scope: 'project' },
    { resource: 'change_requests', actions: ['view', 'create'], scope: 'project' },
    { resource: 'stakeholders', actions: ['view'], scope: 'project' },
    { resource: 'meetings', actions: ['view'], scope: 'project' },
    { resource: 'quality', actions: ['view', 'create'], scope: 'project' },
    { resource: 'communications', actions: ['view', 'create'], scope: 'project' },
    { resource: 'reports', actions: ['view'], scope: 'project' },
  ];
}

/**
 * Stakeholder has read-only access
 */
function getStakeholderPermissions(): Permission[] {
  return [
    { resource: 'projects', actions: ['view'], scope: 'project' },
    { resource: 'scheduling', actions: ['view'], scope: 'project' },
    { resource: 'budget', actions: ['view'], scope: 'project' },
    { resource: 'risks', actions: ['view'], scope: 'project' },
    { resource: 'issues', actions: ['view'], scope: 'project' },
    { resource: 'documents', actions: ['view'], scope: 'project' },
    { resource: 'status', actions: ['view'], scope: 'project' },
    { resource: 'stakeholders', actions: ['view'], scope: 'project' },
    { resource: 'meetings', actions: ['view'], scope: 'project' },
    { resource: 'communications', actions: ['view'], scope: 'project' },
    { resource: 'reports', actions: ['view'], scope: 'project' },
  ];
}

/**
 * Check if user has permission to perform action on resource
 */
export function hasPermission(
  user: User,
  resource: PermissionResource,
  action: Action,
  context?: {
    projectId?: string;
    ownerId?: string;
    department?: string;
  }
): boolean {
  // Admin has all permissions
  if (user.role === 'admin') return true;

  const permission = user.permissions.find(p => p.resource === resource);

  if (!permission) return false;

  // Check if action is allowed
  if (!permission.actions.includes(action)) return false;

  // Check scope
  if (permission.scope === 'all') return true;

  if (permission.scope === 'own' && context?.ownerId) {
    return context.ownerId === user.id;
  }

  if (permission.scope === 'department' && context?.department) {
    return context.department === user.department;
  }

  if (permission.scope === 'project' && context?.projectId) {
    return permission.projectIds?.includes(context.projectId) ?? true;
  }

  return false;
}

/**
 * Filter permissions by resource
 */
export function getResourcePermissions(user: User, resource: PermissionResource): Permission | null {
  return user.permissions.find(p => p.resource === resource) || null;
}

/**
 * Get all actions user can perform on resource
 */
export function getAllowedActions(user: User, resource: PermissionResource): Action[] {
  if (user.role === 'admin') {
    return ['view', 'create', 'edit', 'delete', 'approve', 'export', 'import'];
  }

  const permission = getResourcePermissions(user, resource);
  return permission?.actions || [];
}
