// Change request types

import { BaseEntity, Priority } from './common';

export interface ChangeRequest extends BaseEntity {
  projectId: string;
  title: string;
  description: string;
  requestedBy: string;
  requestDate: Date;
  type: ChangeType;
  priority: Priority;
  impactAssessment: ImpactAssessment;
  status: ChangeStatus;
  workflowId: string;
  currentApprovalStep?: number;
  approvals: Approval[];
  implementationPlan?: string;
  implementedDate?: Date;
  implementedBy?: string;
  rollbackPlan?: string;
  tags: string[];
}

export type ChangeType =
  | 'scope'
  | 'schedule'
  | 'budget'
  | 'resource'
  | 'quality'
  | 'technical'
  | 'process'
  | 'other';

export type ChangeStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'pending-approval'
  | 'approved'
  | 'rejected'
  | 'implementing'
  | 'implemented'
  | 'cancelled';

export interface ImpactAssessment {
  scheduleImpact: string;
  budgetImpact: number;
  resourceImpact: string;
  riskImpact: string;
  benefitsExpected: string;
  alternativesConsidered?: string;
}

export interface ApprovalWorkflow extends BaseEntity {
  name: string;
  description?: string;
  projectId?: string;
  steps: ApprovalStep[];
  active: boolean;
  defaultWorkflow: boolean;
}

export interface ApprovalStep {
  stepNumber: number;
  name: string;
  approverType: 'user' | 'role';
  approverIds?: string[];
  approverRoles?: string[];
  requireAll: boolean; // All approvers must approve or just one
  autoApprove: boolean;
  dueInDays?: number;
}

export interface Approval extends BaseEntity {
  changeRequestId: string;
  workflowId: string;
  stepNumber: number;
  approverId: string;
  approverName: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated';
  comments?: string;
  approvedAt?: Date;
  dueDate?: Date;
  delegatedTo?: string;
}
