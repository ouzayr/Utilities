// Project-related types

import { BaseEntity, Status, Priority, HealthStatus } from './common';

export interface Project extends BaseEntity {
  name: string;
  code: string;
  description: string;
  status: Status;
  priority: Priority;
  health: HealthStatus;
  startDate: Date;
  endDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  projectManager: string;
  sponsor: string;
  department: string;
  budget: number;
  spentBudget: number;
  progress: number; // 0-100
  tags: string[];
  metadata?: Record<string, any>;
}

export interface Milestone extends BaseEntity {
  projectId: string;
  name: string;
  description?: string;
  dueDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  dependencies?: string[];
  owner: string;
}

export interface Task extends BaseEntity {
  projectId: string;
  milestoneId?: string;
  name: string;
  description: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  priority: Priority;
  assignedTo: string[];
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  actualHours: number;
  progress: number;
  dependencies?: string[];
  tags: string[];
  parentTaskId?: string;
}
