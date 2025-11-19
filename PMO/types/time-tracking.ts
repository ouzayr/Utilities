// Time tracking types

import { BaseEntity } from './common';

export interface TimeEntry extends BaseEntity {
  userId: string;
  projectId: string;
  taskId?: string;
  description: string;
  hours: number;
  date: Date;
  billable: boolean;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  invoiced: boolean;
  tags: string[];
}

export interface Timesheet extends BaseEntity {
  userId: string;
  weekStarting: Date;
  weekEnding: Date;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  entries: TimeEntry[];
  notes?: string;
}

export interface TimeSummary {
  userId?: string;
  projectId?: string;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationRate: number;
  byProject?: Record<string, number>;
  byTask?: Record<string, number>;
}
