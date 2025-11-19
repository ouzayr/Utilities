// Communication and collaboration types

import { BaseEntity } from './common';

export interface Message extends BaseEntity {
  projectId?: string;
  channelId?: string;
  senderId: string;
  senderName: string;
  content: string;
  threadId?: string;
  replyToId?: string;
  mentions: string[];
  attachments?: string[];
  reactions: Reaction[];
  edited: boolean;
  editedAt?: Date;
  deleted: boolean;
  deletedAt?: Date;
}

export interface Channel extends BaseEntity {
  projectId?: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  members: string[];
  admins: string[];
  archived: boolean;
  archivedAt?: Date;
  lastMessageAt?: Date;
}

export interface Reaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface Thread {
  id: string;
  rootMessageId: string;
  messageCount: number;
  participants: string[];
  lastReplyAt: Date;
}

export interface Announcement extends BaseEntity {
  projectId?: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  publishedBy: string;
  publishedAt: Date;
  expiresAt?: Date;
  targetAudience: 'all' | 'project-team' | 'stakeholders' | 'custom';
  targetUserIds?: string[];
  pinned: boolean;
  readBy: string[];
  acknowledgementRequired: boolean;
  acknowledgedBy?: string[];
}

export interface DiscussionTopic extends BaseEntity {
  projectId?: string;
  title: string;
  description: string;
  category: string;
  author: string;
  status: 'open' | 'resolved' | 'closed';
  tags: string[];
  views: number;
  messageCount: number;
  lastActivityAt: Date;
  pinned: boolean;
  locked: boolean;
}
