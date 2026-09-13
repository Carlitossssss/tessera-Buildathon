import { apiRequest, ApiError } from '@/lib/api/client';

export { ApiError };

export interface SessionUser {
  id: string;
  userId?: string;
  email: string;
  role: 'admin' | 'institution_admin' | 'teacher' | 'student';
  institutionId?: string | null;
  name?: string | null;
  restricted?: boolean;
  restrictedAt?: string | null;
  restrictionReason?: string | null;
  profile?: UserProfile | null;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  addressLine: string | null;
  status: 'incomplete' | 'pending' | 'approved' | 'rejected';
  profileCompletedAt: string | null;
  profileSubmittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

export interface UserProfileInput {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  phone: string;
  country: string;
  city: string;
  addressLine: string;
}

export interface LoginResponse {
  token: string;
  tokenExpiresAt: string;
  user: {
    id: string;
    email: string;
    role: SessionUser['role'];
    institutionId?: string | null;
    restricted?: boolean;
    restrictedAt?: string | null;
    restrictionReason?: string | null;
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  institutionName?: string;
  plan?: string;
}

export interface RegisterResponse {
  pendingVerification: true;
  email: string;
  expiresAt: string;
}

export interface VerifyEmailResponse {
  ok: true;
  created?: boolean;
  id?: string;
  email?: string;
  name?: string | null;
  role?: SessionUser['role'];
  institutionId?: string | null;
}

export interface TeacherInvitation {
  id: string;
  email: string;
  name: string | null;
  memberRole: string;
  expiresAt: string;
  existingUser: boolean;
  roleAllowed: boolean;
  institution: { id: string; name: string; slug: string } | null;
  course: { id: string; title: string; slug: string } | null;
}

export interface TeacherInvitationAcceptResponse {
  institutionId: string;
  memberId: string;
  courseId: string | null;
  courseAssignmentId: string | null;
  alreadyAccepted?: boolean;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResponse>('/v1/auth/login', { method: 'POST', body: { email, password } }),
  refresh: (token: string) =>
    apiRequest<LoginResponse>('/v1/auth/refresh', { method: 'POST', token }),
  register: (input: RegisterInput) =>
    apiRequest<RegisterResponse>('/v1/auth/register', { method: 'POST', body: input }),
  verifyEmail: (email: string, code: string) =>
    apiRequest<VerifyEmailResponse>('/v1/auth/verify-email', {
      method: 'POST',
      body: { email, code },
    }),
  teacherInvitation: (token: string) =>
    apiRequest<TeacherInvitation>(`/v1/auth/team-invitations/${encodeURIComponent(token)}`),
  registerTeacherFromInvite: (token: string, body: { fullName: string; password: string }) =>
    apiRequest<
      TeacherInvitationAcceptResponse & {
        id: string;
        email: string;
        name: string | null;
        role: 'teacher';
      }
    >(`/v1/auth/team-invitations/${encodeURIComponent(token)}/register`, {
      method: 'POST',
      body,
    }),
  acceptTeacherInvitation: (token: string, authToken: string) =>
    apiRequest<TeacherInvitationAcceptResponse>(
      `/v1/auth/team-invitations/${encodeURIComponent(token)}/accept`,
      {
        method: 'POST',
        token: authToken,
      },
    ),
  sendRestrictedAppeal: (token: string, message: string) =>
    apiRequest<{ ok: true }>('/v1/auth/restricted-appeal', {
      method: 'POST',
      token,
      body: { message },
    }),
  updateProfile: (token: string, body: UserProfileInput) =>
    apiRequest<{ data: UserProfile }>('/v1/auth/profile', {
      method: 'PATCH',
      token,
      body,
    }),
  me: async (token: string) => {
    const payload = await apiRequest<{ user: SessionUser }>('/v1/auth/me', { token });
    return { user: { ...payload.user, id: payload.user.id ?? payload.user.userId } };
  },
};
