// Budget and financial tracking types

import { BaseEntity } from './common';

export interface BudgetItem extends BaseEntity {
  projectId: string;
  category: BudgetCategory;
  name: string;
  description?: string;
  plannedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  currency: string;
  fiscalYear: number;
  fiscalQuarter: number;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export type BudgetCategory =
  | 'labor'
  | 'materials'
  | 'equipment'
  | 'software'
  | 'travel'
  | 'training'
  | 'consulting'
  | 'facilities'
  | 'contingency'
  | 'other';

export interface Expense extends BaseEntity {
  projectId: string;
  budgetItemId?: string;
  category: BudgetCategory;
  description: string;
  amount: number;
  currency: string;
  expenseDate: Date;
  submittedBy: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  receipt?: string;
  notes?: string;
}

export interface BudgetBaseline extends BaseEntity {
  projectId: string;
  version: number;
  totalBudget: number;
  contingency: number;
  baselineDate: Date;
  items: BudgetItem[];
  notes?: string;
}

export interface FinancialSummary {
  projectId: string;
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  remaining: number;
  variance: number;
  variancePercentage: number;
  burnRate: number; // spending per month
  projectedCost: number;
  costPerformanceIndex: number; // EVM metric
}
