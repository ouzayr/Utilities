// Meeting management types

import { BaseEntity } from './common';

export interface Meeting extends BaseEntity {
  projectId?: string;
  title: string;
  description?: string;
  type: MeetingType;
  startTime: Date;
  endTime: Date;
  location?: string;
  virtualMeetingLink?: string;
  organizer: string;
  attendees: MeetingAttendee[];
  agenda?: AgendaItem[];
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  recurrence?: RecurrencePattern;
  tags: string[];
}

export type MeetingType =
  | 'kickoff'
  | 'status-review'
  | 'steering-committee'
  | 'planning'
  | 'retrospective'
  | 'standup'
  | 'one-on-one'
  | 'stakeholder-update'
  | 'other';

export interface MeetingAttendee {
  userId: string;
  name: string;
  email: string;
  required: boolean;
  status: 'invited' | 'accepted' | 'declined' | 'tentative' | 'no-response';
  responseDate?: Date;
}

export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  duration: number; // in minutes
  presenter?: string;
  order: number;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
  endDate?: Date;
  occurrences?: number;
}

export interface MeetingMinutes extends BaseEntity {
  meetingId: string;
  summary: string;
  discussion?: string;
  decisions?: Decision[];
  actionItems: ActionItem[];
  attendees: string[];
  nextMeetingDate?: Date;
  recordedBy: string;
}

export interface Decision {
  id: string;
  description: string;
  decisionMaker: string;
  impact?: string;
}

export interface ActionItem extends BaseEntity {
  meetingId: string;
  description: string;
  assignedTo: string;
  dueDate: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  completedDate?: Date;
  notes?: string;
}
