export type UserRole = "SuperAdmin" | "ClientAdmin" | "TemplateManager" | "User";
export type SubscriptionTier = "Starter" | "Professional" | "Enterprise";
export type TemplateCreationPolicy =
  | "PlatformAdminOnly"
  | "ClientAdminOnly"
  | "TemplateManagerOrAbove"
  | "AnyUser";

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  templateCreationPolicy: TemplateCreationPolicy | null;
}

export interface MeResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  phone?: string;
  role: UserRole;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  templateCreationPolicy: TemplateCreationPolicy | null;
  activeTier: SubscriptionTier | null;
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  templateCreationPolicy: TemplateCreationPolicy;
  whiteLabelEnabled: boolean;
  createdAt: string;
}

export interface UserDto {
  id: string;
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateDto {
  id: string;
  tenantId: string | null;
  createdByUserId: string;
  name: string;
  fabricJson: string;
  placeholders: string;
  isPublished: boolean;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardDto {
  id: string;
  tenantId: string;
  userId: string;
  templateId: string | null;
  name: string;
  fabricJson: string;
  fieldValues: string;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionDto {
  id: string;
  tenantId: string;
  tier: SubscriptionTier;
  status: string;
  startsAt: string;
  endsAt?: string;
  createdAt: string;
}

export interface BillingDetailsDto {
  id: string;
  subscriptionId: string;
  externalCustomerId?: string;
  externalInvoiceId?: string;
  paymentMethod?: string;
  amountCents: number;
  currency: string;
  paidAt?: string;
}

export interface ApiError {
  status: number;
  title: string;
  detail: string;
  currentTier?: SubscriptionTier;
  requiredTier?: SubscriptionTier;
}
