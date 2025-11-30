// Audit trail service for tracking all changes

import { AuditLog } from '@/types';
import { dataService, DATA_KEYS } from '@/services/storage';
import { generateId } from '@/utils/helpers';

class AuditService {
  /**
   * Create audit log entry
   */
  async log(
    entityType: string,
    entityId: string,
    action: AuditLog['action'],
    userId: string,
    userName: string,
    changes?: Record<string, { old: any; new: any }>,
    metadata?: Record<string, any>
  ): Promise<AuditLog> {
    const now = new Date();

    const auditLog: AuditLog = {
      id: generateId(),
      entityType,
      entityId,
      action,
      userId,
      userName,
      changes,
      metadata,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    await dataService.create<AuditLog>(DATA_KEYS.AUDIT_LOGS, auditLog);

    return auditLog;
  }

  /**
   * Get audit logs for specific entity
   */
  async getEntityLogs(entityType: string, entityId: string): Promise<AuditLog[]> {
    const logs = await dataService.query<AuditLog>(
      DATA_KEYS.AUDIT_LOGS,
      log => log.entityType === entityType && log.entityId === entityId
    );

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get all audit logs for a user
   */
  async getUserLogs(userId: string): Promise<AuditLog[]> {
    const logs = await dataService.query<AuditLog>(
      DATA_KEYS.AUDIT_LOGS,
      log => log.userId === userId
    );

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get audit logs within a date range
   */
  async getLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    const logs = await dataService.query<AuditLog>(DATA_KEYS.AUDIT_LOGS, log => {
      const logDate = new Date(log.createdAt);
      return logDate >= startDate && logDate <= endDate;
    });

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get audit logs by action type
   */
  async getLogsByAction(action: AuditLog['action']): Promise<AuditLog[]> {
    const logs = await dataService.query<AuditLog>(
      DATA_KEYS.AUDIT_LOGS,
      log => log.action === action
    );

    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get all audit logs with pagination
   */
  async getAllLogs(page: number = 1, pageSize: number = 50): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const allLogs = await dataService.getAll<AuditLog>(DATA_KEYS.AUDIT_LOGS);
    const sortedLogs = allLogs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = sortedLogs.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const logs = sortedLogs.slice(startIndex, endIndex);

    return {
      logs,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Create audit trail for create action
   */
  async logCreate(
    entityType: string,
    entityId: string,
    userId: string,
    userName: string,
    data: any
  ): Promise<void> {
    await this.log(entityType, entityId, 'create', userId, userName, undefined, { data });
  }

  /**
   * Create audit trail for update action
   */
  async logUpdate(
    entityType: string,
    entityId: string,
    userId: string,
    userName: string,
    oldData: any,
    newData: any
  ): Promise<void> {
    const changes: Record<string, { old: any; new: any }> = {};

    // Track what fields changed
    Object.keys(newData).forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = {
          old: oldData[key],
          new: newData[key],
        };
      }
    });

    await this.log(entityType, entityId, 'update', userId, userName, changes);
  }

  /**
   * Create audit trail for delete action
   */
  async logDelete(
    entityType: string,
    entityId: string,
    userId: string,
    userName: string,
    data: any
  ): Promise<void> {
    await this.log(entityType, entityId, 'delete', userId, userName, undefined, { data });
  }

  /**
   * Create audit trail for approval action
   */
  async logApproval(
    entityType: string,
    entityId: string,
    userId: string,
    userName: string,
    approved: boolean,
    comments?: string
  ): Promise<void> {
    await this.log(entityType, entityId, 'approve', userId, userName, undefined, {
      approved,
      comments,
    });
  }

  /**
   * Create audit trail for export action
   */
  async logExport(
    entityType: string,
    userId: string,
    userName: string,
    format: string,
    recordCount: number
  ): Promise<void> {
    await this.log(entityType, 'bulk', 'export', userId, userName, undefined, {
      format,
      recordCount,
    });
  }

  /**
   * Create audit trail for import action
   */
  async logImport(
    entityType: string,
    userId: string,
    userName: string,
    format: string,
    recordCount: number
  ): Promise<void> {
    await this.log(entityType, 'bulk', 'import', userId, userName, undefined, {
      format,
      recordCount,
    });
  }
}

export default new AuditService();
