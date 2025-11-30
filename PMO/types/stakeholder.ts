// Stakeholder management types

import { BaseEntity } from './common';

export interface Stakeholder extends BaseEntity {
  projectId: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  title: string;
  role: StakeholderRole;
  category: StakeholderCategory;
  influence: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  interest: 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
  sentiment: 'champion' | 'supportive' | 'neutral' | 'resistant' | 'opposed';
  engagementStrategy: string;
  communicationPreference: 'email' | 'phone' | 'meeting' | 'report';
  communicationFrequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'as-needed';
  lastContactDate?: Date;
  nextContactDate?: Date;
  notes?: string;
  tags: string[];
}

export type StakeholderRole =
  | 'sponsor'
  | 'customer'
  | 'executive'
  | 'project-manager'
  | 'team-member'
  | 'vendor'
  | 'consultant'
  | 'end-user'
  | 'regulator'
  | 'other';

export type StakeholderCategory = 'internal' | 'external' | 'partner';

export interface StakeholderEngagement extends BaseEntity {
  stakeholderId: string;
  type: 'meeting' | 'email' | 'call' | 'presentation' | 'workshop' | 'review';
  date: Date;
  summary: string;
  attendees?: string[];
  outcomes?: string;
  actionItems?: string[];
  nextSteps?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface StakeholderMatrix {
  highInterestHighInfluence: Stakeholder[];
  highInterestLowInfluence: Stakeholder[];
  lowInterestHighInfluence: Stakeholder[];
  lowInterestLowInfluence: Stakeholder[];
}
