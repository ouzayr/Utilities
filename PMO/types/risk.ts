// Risk management types

import { BaseEntity, Priority } from './common';

export interface Risk extends BaseEntity {
  projectId: string;
  title: string;
  description: string;
  category: RiskCategory;
  probability: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  impact: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  riskScore: number; // probability * impact
  priority: Priority;
  status: 'identified' | 'analyzing' | 'mitigating' | 'monitoring' | 'closed' | 'realized';
  owner: string;
  identifiedDate: Date;
  mitigationStrategy?: string;
  contingencyPlan?: string;
  triggers?: string[];
  residualProbability?: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  residualImpact?: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  residualRiskScore?: number;
  reviewDate?: Date;
  closedDate?: Date;
  tags: string[];
}

export type RiskCategory =
  | 'technical'
  | 'schedule'
  | 'cost'
  | 'resource'
  | 'quality'
  | 'scope'
  | 'external'
  | 'organizational'
  | 'regulatory'
  | 'security';

export interface RiskMitigation extends BaseEntity {
  riskId: string;
  action: string;
  owner: string;
  dueDate: Date;
  status: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  effectiveness?: 'not-effective' | 'partially-effective' | 'effective' | 'very-effective';
  cost?: number;
  notes?: string;
}

export interface RiskMatrix {
  veryLow: { veryLow: number; low: number; medium: number; high: number; veryHigh: number };
  low: { veryLow: number; low: number; medium: number; high: number; veryHigh: number };
  medium: { veryLow: number; low: number; medium: number; high: number; veryHigh: number };
  high: { veryLow: number; low: number; medium: number; high: number; veryHigh: number };
  veryHigh: { veryLow: number; low: number; medium: number; high: number; veryHigh: number };
}
