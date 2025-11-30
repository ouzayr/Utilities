// Common types used across the application

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface AuditLog extends BaseEntity {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'export' | 'import';
  userId: string;
  userName: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface Notification extends BaseEntity {
  userId: string;
  type: 'approval_pending' | 'approval_approved' | 'approval_rejected' | 'task_assigned' | 'deadline_approaching' | 'risk_escalated' | 'issue_created' | 'meeting_scheduled' | 'document_uploaded' | 'comment_added';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Comment extends BaseEntity {
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  content: string;
  mentions?: string[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  category?: string;
}

export type Status = 'draft' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type HealthStatus = 'green' | 'yellow' | 'red';
