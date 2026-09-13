import { apiRequest } from '../client';

export interface AdminDashboard {
  kpis: {
    activeInstitutions: number;
    activeInstitutionsThisMonth: number;
    certificates24h: number;
    certificates24hDeltaPct: number;
    openAlerts: number;
    institutionsToReview?: number;
    institutionsToReviewThisMonth?: number;
    rejectedInstitutions?: number;
    rejectedInstitutionsThisWeek?: number;
    suspendedInstitutions?: number;
    suspendedInstitutionsThisMonth?: number;
    suspendedUsers?: number;
    suspendedUsersThisMonth?: number;
    failedCertificates?: number;
    failedCertificates24h?: number;
    failedWebhooks?: number;
    failedWebhooks24h?: number;
    suspensionReviewRequests?: number;
  };
  pendingInstitutions: Array<{
    id: string;
    name: string;
    country: string | null;
    status: 'pending' | 'approved' | 'suspended' | 'revoked';
    createdAt: string;
  }>;
  suspensionReviewRequests?: AdminSuspensionRequest[];
}

export interface AdminInstitution {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  plan: 'starter' | 'pro' | 'pro_extended' | 'enterprise';
  activePlanCode: 'essential' | 'growth' | 'institutional' | 'scale' | 'enterprise' | null;
  status: 'pending' | 'approved' | 'suspended' | 'revoked';
  certificates: number;
  createdAt: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  profileSubmittedAt: string | null;
}

export interface AdminInstitutionDetail extends AdminInstitution {
  website: string | null;
  description: string | null;
  legalName: string | null;
  taxId: string | null;
  addressLine: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  accreditationId: string | null;
  profileSubmittedAt: string | null;
  walletAddress: string;
  members: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    memberRole: string;
    createdAt: string;
  }>;
  certificatesByStatus: Record<string, number>;
}

export interface AdminInstitutionsPayload {
  totals: {
    total: number;
    approved: number;
    pending: number;
    rejected?: number;
    suspended?: number;
    certificates: number;
  };
  data: AdminInstitution[];
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: 'admin' | 'institution_admin' | 'teacher' | 'student' | 'api_client';
  emailVerifiedAt: string | null;
  restricted: boolean;
  restrictedAt: string | null;
  restrictionReason: string | null;
  deletionScheduledAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  profileStatus: 'incomplete' | 'pending' | 'approved' | 'rejected' | null;
  profileRejectionReason: string | null;
  institution: { id: string; name: string; slug: string } | null;
  institutions: Array<{ id: string; name: string; slug: string }>;
}

export interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  walletAddress: string | null;
  profile: {
    status: 'incomplete' | 'pending' | 'approved' | 'rejected';
    firstName: string | null;
    lastName: string | null;
    documentType: string | null;
    documentNumber: string | null;
    birthDate: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    addressLine: string | null;
    profileCompletedAt: string | null;
    profileSubmittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    updatedAt: string | null;
  } | null;
}

export interface AdminUsersPayload {
  totals: {
    total: number;
    institutionAdmins: number;
    restricted: number;
    deleted: number;
    pendingVerification: number;
    deletionScheduled: number;
    profilePending?: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  data: AdminUser[];
}

export interface AdminAlert {
  id: string;
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  createdAt: string;
  resolved: boolean;
  resolvedAt: string | null;
}

export interface AdminAlertsPayload {
  totals: {
    open: number;
    errors: number;
    warnings: number;
  };
  data: AdminAlert[];
}

export interface AdminSuspensionRequest {
  id: string;
  alertId: string;
  requesterEmail: string;
  requesterName: string | null;
  requesterRole: string;
  targetType: string;
  targetId: string;
  institution: { id: string; name: string; status: string } | null;
  supportEmail: string | null;
  submittedAt: string;
  reviewed: boolean;
  reviewedAt: string | null;
  stillSuspended: boolean | null;
}

export interface AdminSuspensionRequestsPayload {
  totals: {
    total: number;
    open: number;
    reviewed: number;
  };
  data: AdminSuspensionRequest[];
}

export interface AdminCertificate {
  id: string;
  studentName: string;
  studentEmail: string;
  institutionName: string | null;
  achievementName: string;
  courseTitle: string | null;
  tokenId: string | null;
  txHash: string | null;
  issuedAt: string | null;
  createdAt: string;
  status: 'queued' | 'processing' | 'issued' | 'failed' | 'revoked';
}

export interface AdminCertificatesPayload {
  totals: {
    total: number;
    revoked: number;
    issuedToday: number;
  };
  summary: {
    byStatus: Array<{ status: AdminCertificate['status']; count: number }>;
    byInstitution: Array<{ institutionId: string; institutionName: string; count: number }>;
  };
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  data: AdminCertificate[];
}

export interface AdminBillingPlan {
  code: 'essential' | 'growth' | 'institutional' | 'scale' | 'enterprise';
  name: string;
  description?: string;
  monthlyTsc: number;
  monthlyPriceCents: number;
  launchDiscountBps?: number;
  extraTscPriceCents: number;
  minimumCommitmentMonths: number;
  pricingVersion?: string;
  active?: boolean;
}

export interface AdminTscPackage {
  code: 'initial' | 'growth' | 'institutional' | 'scale' | 'enterprise';
  name: string;
  tsc: number;
  priceCents: number;
  discountBps: number;
  validityMonths?: number;
  pricingVersion?: string;
  currency: 'USD';
  active?: boolean;
}

export interface AdminBillingCatalogPayload {
  tscPerCertificate: number;
  tscNominalValueCents: number;
  continuityReserveCents: number;
  packageValidityMonths: number;
  pricingVersion?: string;
  plans: AdminBillingPlan[];
  packages: AdminTscPackage[];
}

export const adminApi = {
  dashboard: (token: string) => apiRequest<AdminDashboard>('/v1/admin/dashboard', { token }),
  institutions: (token: string) =>
    apiRequest<AdminInstitutionsPayload>('/v1/admin/institutions', { token }),
  institution: (token: string, id: string) =>
    apiRequest<AdminInstitutionDetail>(`/v1/admin/institutions/${id}`, { token }),
  approveInstitution: (token: string, id: string) =>
    apiRequest<{ id: string; status: string; approvedAt: string | null }>(
      `/v1/admin/institutions/${id}/approve`,
      { method: 'POST', token },
    ),
  /**
   * Reintenta la acreditación on-chain en una red secundaria.
   *
   * Existe porque el RPC de HSK testnet se cae y vuelve: una acreditación
   * fallida suele ser una red que no respondió, no un error de datos.
   */
  accreditInstitution: (token: string, id: string, chainId: number) =>
    apiRequest<{
      chainId: number;
      status: 'confirmed' | 'failed' | 'skipped';
      txHash: string | null;
      error: string | null;
    }>(`/v1/admin/institutions/${id}/accredit/${chainId}`, { method: 'POST', token }),
  rejectInstitution: (token: string, id: string, body: { reason: string }) =>
    apiRequest<{
      id: string;
      status: string;
      rejectedAt: string | null;
      rejectionReason: string | null;
    }>(`/v1/admin/institutions/${id}/reject`, {
      method: 'POST',
      token,
      body,
    }),
  suspendInstitution: (token: string, id: string, body: { reason: string }) =>
    apiRequest<{
      id: string;
      status: string;
      suspendedAt: string | null;
      suspensionReason: string | null;
    }>(`/v1/admin/institutions/${id}/suspend`, {
      method: 'POST',
      token,
      body,
    }),
  reactivateInstitution: (token: string, id: string) =>
    apiRequest<{
      id: string;
      status: string;
      suspendedAt: string | null;
      suspensionReason: string | null;
    }>(`/v1/admin/institutions/${id}/reactivate`, {
      method: 'POST',
      token,
    }),
  users: (
    token: string,
    query: { page?: number; limit?: number; role?: string; status?: string; q?: string } = {},
  ) => apiRequest<AdminUsersPayload>('/v1/admin/users', { token, query }),
  user: (token: string, id: string) =>
    apiRequest<AdminUserDetail>(`/v1/admin/users/${id}`, { token }),
  restrictUser: (token: string, id: string, body: { reason: string }) =>
    apiRequest<{
      id: string;
      restricted: boolean;
      restrictedAt: string | null;
      restrictionReason: string | null;
    }>(`/v1/admin/users/${id}/restrict`, { method: 'POST', token, body }),
  unrestrictUser: (token: string, id: string) =>
    apiRequest<{
      id: string;
      restricted: boolean;
      restrictedAt: string | null;
      restrictionReason: string | null;
    }>(`/v1/admin/users/${id}/unrestrict`, { method: 'POST', token }),
  approveUserProfile: (token: string, id: string) =>
    apiRequest<{ id: string; userId: string; status: string }>(
      `/v1/admin/users/${id}/profile/approve`,
      { method: 'POST', token },
    ),
  rejectUserProfile: (token: string, id: string, body: { reason: string }) =>
    apiRequest<{ id: string; userId: string; status: string; rejectionReason: string | null }>(
      `/v1/admin/users/${id}/profile/reject`,
      { method: 'POST', token, body },
    ),
  deleteUser: (token: string, id: string) =>
    apiRequest<{ id: string; deleted: boolean }>(`/v1/admin/users/${id}`, {
      method: 'DELETE',
      token,
    }),
  alerts: (token: string) => apiRequest<AdminAlertsPayload>('/v1/admin/alerts', { token }),
  resolveAlert: (token: string, alertId: string, body: { note?: string } = {}) =>
    apiRequest<{ alertId: string; resolved: boolean; resolvedAt: string }>(
      `/v1/admin/alerts/${encodeURIComponent(alertId)}/resolve`,
      { method: 'POST', token, body },
    ),
  suspensionRequests: (token: string) =>
    apiRequest<AdminSuspensionRequestsPayload>('/v1/admin/suspension-requests', { token }),
  resolveSuspensionRequest: (token: string, requestId: string, body: { note?: string } = {}) =>
    apiRequest<{ requestId: string; reviewed: boolean; reviewedAt: string }>(
      `/v1/admin/suspension-requests/${encodeURIComponent(requestId)}/resolve`,
      { method: 'POST', token, body },
    ),
  certificates: (token: string, query: { page?: number; limit?: number } = {}) =>
    apiRequest<AdminCertificatesPayload>('/v1/admin/certificates', { token, query }),
  billingCatalog: (token: string) =>
    apiRequest<AdminBillingCatalogPayload>('/v1/admin/billing-catalog', { token }),
  updateBillingCatalog: (token: string, body: AdminBillingCatalogPayload) =>
    apiRequest<AdminBillingCatalogPayload>('/v1/admin/billing-catalog', {
      method: 'PUT',
      token,
      body,
    }),
};
