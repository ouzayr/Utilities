// Reporting types

import { BaseEntity } from './common';

export interface Report extends BaseEntity {
  title: string;
  description?: string;
  type: ReportType;
  projectId?: string;
  reportPeriod: ReportPeriod;
  startDate: Date;
  endDate: Date;
  generatedBy: string;
  generatedAt: Date;
  format: 'pdf' | 'excel' | 'html' | 'json';
  data: Record<string, any>;
  charts?: ChartConfig[];
  schedule?: ReportSchedule;
  recipients?: string[];
  tags: string[];
}

export type ReportType =
  | 'executive-summary'
  | 'status-report'
  | 'financial-report'
  | 'resource-utilization'
  | 'risk-report'
  | 'quality-report'
  | 'progress-report'
  | 'variance-report'
  | 'custom';

export interface ReportPeriod {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  label: string;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface ChartConfig {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter';
  title: string;
  dataSource: string;
  xAxis?: string;
  yAxis?: string;
  options?: Record<string, any>;
}

export interface Dashboard extends BaseEntity {
  name: string;
  description?: string;
  type: 'executive' | 'operational' | 'project' | 'custom';
  projectId?: string;
  widgets: DashboardWidget[];
  layout: LayoutConfig;
  shared: boolean;
  sharedWith?: string[];
  defaultDashboard: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'list' | 'calendar' | 'progress';
  title: string;
  dataSource: string;
  refreshInterval?: number;
  config: Record<string, any>;
  position: WidgetPosition;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutConfig {
  columns: number;
  rowHeight: number;
  gap: number;
}

export interface KPI {
  id: string;
  name: string;
  description?: string;
  category: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical';
  calculationPeriod: 'day' | 'week' | 'month' | 'quarter' | 'year';
  lastCalculated: Date;
}
