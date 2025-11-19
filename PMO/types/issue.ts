// Issue tracking types

import { BaseEntity, Priority } from './common';

export interface Issue extends BaseEntity {
  projectId: string;
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed' | 'reopened';
  reportedBy: string;
  assignedTo?: string;
  reportedDate: Date;
  dueDate?: Date;
  resolvedDate?: Date;
  closedDate?: Date;
  resolution?: string;
  relatedTaskId?: string;
  relatedRiskId?: string;
  blockedTasks?: string[];
  tags: string[];
  watchers: string[];
}

export type IssueType =
  | 'bug'
  | 'blocker'
  | 'dependency'
  | 'resource-conflict'
  | 'scope-creep'
  | 'quality-issue'
  | 'technical-debt'
  | 'process-issue'
  | 'other';

export interface IssueAction extends BaseEntity {
  issueId: string;
  action: string;
  owner: string;
  dueDate: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  completedDate?: Date;
  notes?: string;
}

export interface IssueEscalation extends BaseEntity {
  issueId: string;
  escalatedFrom: string;
  escalatedTo: string;
  reason: string;
  escalatedDate: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}
