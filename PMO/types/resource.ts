// Resource management types

import { BaseEntity } from './common';

export interface Resource extends BaseEntity {
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skillSet: Skill[];
  capacity: number; // hours per week
  cost: number; // hourly rate
  availability: ResourceAvailability[];
  active: boolean;
}

export interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
}

export interface ResourceAvailability {
  startDate: Date;
  endDate: Date;
  availableHours: number;
  reason?: string;
}

export interface ResourceAllocation extends BaseEntity {
  resourceId: string;
  projectId: string;
  taskId?: string;
  allocatedHours: number;
  startDate: Date;
  endDate: Date;
  utilizationRate: number; // percentage
  billable: boolean;
}

export interface WorkloadSummary {
  resourceId: string;
  resourceName: string;
  totalCapacity: number;
  allocatedHours: number;
  availableHours: number;
  utilizationRate: number;
  overallocated: boolean;
}
