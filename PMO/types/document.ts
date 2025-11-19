// Document management types

import { BaseEntity } from './common';

export interface Document extends BaseEntity {
  projectId?: string;
  name: string;
  description?: string;
  type: DocumentType;
  category: string;
  url: string;
  size: number;
  mimeType: string;
  version: number;
  status: 'draft' | 'review' | 'approved' | 'archived';
  uploadedBy: string;
  currentVersion: boolean;
  parentDocumentId?: string;
  tags: string[];
  accessLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  approvedBy?: string;
  approvedAt?: Date;
  expiryDate?: Date;
  checkoutBy?: string;
  checkoutAt?: Date;
}

export type DocumentType =
  | 'charter'
  | 'plan'
  | 'specification'
  | 'design'
  | 'procedure'
  | 'report'
  | 'presentation'
  | 'spreadsheet'
  | 'contract'
  | 'template'
  | 'other';

export interface DocumentVersion {
  versionNumber: number;
  documentId: string;
  url: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  changeLog?: string;
  major: boolean;
}

export interface DocumentReview extends BaseEntity {
  documentId: string;
  reviewerId: string;
  status: 'pending' | 'in-review' | 'approved' | 'rejected' | 'changes-requested';
  comments?: string;
  reviewedAt?: Date;
  dueDate: Date;
}

export interface Folder {
  id: string;
  name: string;
  parentFolderId?: string;
  projectId?: string;
  createdBy: string;
  createdAt: Date;
  accessLevel: 'public' | 'internal' | 'confidential' | 'restricted';
}
