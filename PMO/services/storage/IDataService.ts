// Generic data service interface - can be implemented by LocalStorage or API

export interface IDataService {
  // Generic CRUD operations
  get<T>(key: string, id: string): Promise<T | null>;
  getAll<T>(key: string): Promise<T[]>;
  create<T>(key: string, data: T): Promise<T>;
  update<T>(key: string, id: string, data: Partial<T>): Promise<T>;
  delete(key: string, id: string): Promise<boolean>;
  query<T>(key: string, predicate: (item: T) => boolean): Promise<T[]>;

  // Batch operations
  createMany<T>(key: string, items: T[]): Promise<T[]>;
  updateMany<T>(key: string, updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>;
  deleteMany(key: string, ids: string[]): Promise<boolean>;

  // Clear data
  clear(key: string): Promise<boolean>;
  clearAll(): Promise<boolean>;
}

export const DATA_KEYS = {
  USERS: 'users',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  MILESTONES: 'milestones',
  RESOURCES: 'resources',
  RESOURCE_ALLOCATIONS: 'resource_allocations',
  BUDGET_ITEMS: 'budget_items',
  EXPENSES: 'expenses',
  RISKS: 'risks',
  RISK_MITIGATIONS: 'risk_mitigations',
  ISSUES: 'issues',
  ISSUE_ACTIONS: 'issue_actions',
  TIME_ENTRIES: 'time_entries',
  TIMESHEETS: 'timesheets',
  DOCUMENTS: 'documents',
  DOCUMENT_VERSIONS: 'document_versions',
  CHANGE_REQUESTS: 'change_requests',
  APPROVAL_WORKFLOWS: 'approval_workflows',
  APPROVALS: 'approvals',
  STAKEHOLDERS: 'stakeholders',
  STAKEHOLDER_ENGAGEMENTS: 'stakeholder_engagements',
  MEETINGS: 'meetings',
  MEETING_MINUTES: 'meeting_minutes',
  ACTION_ITEMS: 'action_items',
  QUALITY_METRICS: 'quality_metrics',
  TEST_CASES: 'test_cases',
  TEST_EXECUTIONS: 'test_executions',
  DEFECTS: 'defects',
  QUALITY_AUDITS: 'quality_audits',
  MESSAGES: 'messages',
  CHANNELS: 'channels',
  ANNOUNCEMENTS: 'announcements',
  DISCUSSION_TOPICS: 'discussion_topics',
  REPORTS: 'reports',
  DASHBOARDS: 'dashboards',
  AUDIT_LOGS: 'audit_logs',
  NOTIFICATIONS: 'notifications',
  COMMENTS: 'comments',
} as const;
