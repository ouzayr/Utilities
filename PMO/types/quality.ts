// Quality management types

import { BaseEntity, Priority } from './common';

export interface QualityMetric extends BaseEntity {
  projectId: string;
  name: string;
  description: string;
  category: QualityCategory;
  targetValue: number;
  actualValue: number;
  unit: string;
  threshold: {
    red: number;
    yellow: number;
    green: number;
  };
  status: 'red' | 'yellow' | 'green';
  measuredDate: Date;
  measuredBy: string;
  trend: 'improving' | 'stable' | 'declining';
}

export type QualityCategory =
  | 'defect-density'
  | 'test-coverage'
  | 'performance'
  | 'reliability'
  | 'security'
  | 'usability'
  | 'compliance'
  | 'customer-satisfaction'
  | 'other';

export interface TestCase extends BaseEntity {
  projectId: string;
  testSuite: string;
  title: string;
  description: string;
  type: TestType;
  priority: Priority;
  steps: TestStep[];
  expectedResult: string;
  status: 'draft' | 'ready' | 'in-progress' | 'passed' | 'failed' | 'blocked' | 'skipped';
  assignedTo?: string;
  automatable: boolean;
  automated: boolean;
  tags: string[];
}

export type TestType =
  | 'unit'
  | 'integration'
  | 'system'
  | 'acceptance'
  | 'regression'
  | 'performance'
  | 'security'
  | 'usability';

export interface TestStep {
  stepNumber: number;
  action: string;
  expectedResult: string;
}

export interface TestExecution extends BaseEntity {
  testCaseId: string;
  executedBy: string;
  executedDate: Date;
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  actualResult?: string;
  defectsFound?: string[];
  duration?: number;
  environment: string;
  build?: string;
  notes?: string;
  attachments?: string[];
}

export interface Defect extends BaseEntity {
  projectId: string;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  priority: Priority;
  status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'verified' | 'closed' | 'reopened';
  type: 'functional' | 'performance' | 'security' | 'usability' | 'data' | 'integration' | 'other';
  reportedBy: string;
  reportedDate: Date;
  assignedTo?: string;
  environment: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedDate?: Date;
  verifiedBy?: string;
  verifiedDate?: Date;
  rootCause?: string;
  tags: string[];
}

export interface QualityAudit extends BaseEntity {
  projectId: string;
  title: string;
  auditType: 'process' | 'product' | 'compliance' | 'security';
  scheduledDate: Date;
  completedDate?: Date;
  auditor: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  findings: AuditFinding[];
  overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  report?: string;
}

export interface AuditFinding {
  id: string;
  category: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  recommendation: string;
  assignedTo?: string;
  dueDate?: Date;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted';
}
