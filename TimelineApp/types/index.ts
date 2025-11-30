// User types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  passwordHash: string;
}

// Category types
export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  userId: string;
  createdAt: string;
}

// Media types
export type MediaType = 'image' | 'youtube';

export interface Media {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: string;
}

export interface MediaUploadConfig {
  maxImageSize: number; // in bytes
  maxImagesPerEvent: number;
  allowedImageFormats: string[];
  allowYouTube: boolean;
}

// Event types
export interface SubEvent {
  id: string;
  title: string;
  date: string; // ISO date string
  description: string; // Rich text HTML
  media: Media[];
  createdAt: string;
  updatedAt: string;
}

export interface MainEvent {
  id: string;
  userId: string;
  title: string;
  dateFrom: string; // ISO date string
  dateTo: string; // ISO date string
  categoryId: string;
  description: string; // Rich text HTML
  media: Media[];
  subEvents: SubEvent[];
  createdAt: string;
  updatedAt: string;
}

// Filter types
export interface TimelineFilters {
  categoryIds: string[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

// Form types
export interface MainEventFormData {
  title: string;
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  description: string;
}

export interface SubEventFormData {
  title: string;
  date: string;
  description: string;
}

// API Response types (for future API integration)
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface OTPVerification {
  email: string;
  otp: string;
}

export interface Session {
  user: User;
  expires: string;
}
