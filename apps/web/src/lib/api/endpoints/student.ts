import { apiRequest } from '../client';

// ─── Tipos compartidos ────────────────────────────────────────────────────────
export type StudentEnrollmentStatus = 'not_started' | 'in_progress' | 'completed';

export interface StudentDashboardCourse {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  thumbnailUrl: string | null;
  institutionName: string | null;
  institutionSlug: string | null;
  institutionLogoUrl: string | null;
  institutionStatus: 'pending' | 'approved' | 'suspended' | 'revoked' | null;
  institutionSuspensionReason: string | null;
  status: StudentEnrollmentStatus;
  startedAt: string | null;
  totalModules: number;
  completedModules: number;
  progressPct: number;
}

export interface StudentRecentActivity {
  attemptId: string;
  status: string;
  score: number | null;
  submittedAt: string | null;
  assessmentTitle: string;
  moduleTitle: string;
  courseTitle: string;
  enrollmentId: string;
}

export interface StudentDashboardData {
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    walletAddress: string | null;
    locale: string | null;
    emailVerifiedAt: string | null;
  };
  counts: {
    enrollments: number;
    inProgress: number;
    completed: number;
    notStarted: number;
    certificates: number;
    certificatesIssued: number;
    badges: number;
    pendingGrading: number;
  };
  avgFinalScore: number | null;
  activeCourses: StudentDashboardCourse[];
  recentActivity: StudentRecentActivity[];
}

export interface StudentCourseRow {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  courseDescription: string | null;
  thumbnailUrl: string | null;
  passingScore: number | null;
  institutionId: string | null;
  institutionName: string | null;
  institutionSlug: string | null;
  institutionLogoUrl: string | null;
  institutionStatus: 'pending' | 'approved' | 'suspended' | 'revoked' | null;
  institutionSuspensionReason: string | null;
  enrollmentSource: string | null;
  startedAt: string | null;
  completedAt: string | null;
  finalScore: number | null;
  status: StudentEnrollmentStatus;
  totalModules: number;
  completedModules: number;
  inProgressModules: number;
  progressPct: number;
  createdAt: string;
}

export interface StudentCertificateRow {
  id: string;
  status: 'queued' | 'processing' | 'issued' | 'failed' | 'revoked';
  achievementName: string;
  achievementDescription: string | null;
  grade: number | null;
  tokenId: string | null;
  txHash: string | null;
  tokenUri: string | null;
  ipfsCid: string | null;
  arweaveTxId: string | null;
  issuedAt: string | null;
  revokedAt: string | null;
  studentWallet: string | null;
  failureReason: string | null;
  institutionId: string;
  institutionName: string | null;
  institutionSlug: string | null;
  institutionLogoUrl: string | null;
  courseId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
  /** Pagina publica de la credencial, la que se comparte con un empleador. */
  verifyUrl?: string | null;
  /**
   * Cada red donde vive la credencial. La primera es la de emision, que
   * determina su validez; las demas son replicas del mismo contenido con su
   * propio numero de token.
   */
  networks?: {
    chainId: number;
    name: string;
    role: 'issuance' | 'mirror';
    status: string;
    tokenId: string | null;
    nftUrl: string | null;
    txUrl: string | null;
  }[];
}

export interface StudentBadgeRow {
  id: string;
  collectionId: string;
  collectionName: string;
  collectionDescription: string | null;
  imageUrl: string | null;
  institutionName: string | null;
  institutionSlug: string | null;
  studentWallet: string | null;
  amount: number;
  txHash: string | null;
  issuedAt: string;
  tokenUri: string | null;
}

export interface StudentWalletData {
  walletAddress: string | null;
  custodyMode: 'tessera' | 'none';
  network: string;
  chainId: number;
  counts: { certificates: number; badges: number };
  certificates: Array<{
    id: string;
    tokenId: string | null;
    achievementName: string;
    txHash: string | null;
    issuedAt: string | null;
  }>;
}

export interface StudentProfileData {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  locale: 'es' | 'en' | 'pt' | null;
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  stats: { enrollments: number; completed: number; certificates: number };
}

export interface StudentProfileUpdate {
  name?: string;
  locale?: 'es' | 'en' | 'pt';
  avatarUrl?: string | null;
}

// ─── Cliente ─────────────────────────────────────────────────────────────────
export const studentApi = {
  dashboard: (token: string) =>
    apiRequest<{ data: StudentDashboardData }>('/v1/me/student/dashboard', { token }),
  courses: (token: string) =>
    apiRequest<{
      data: StudentCourseRow[];
      totals: { total: number; inProgress: number; completed: number; notStarted: number };
    }>('/v1/me/student/courses', { token }),
  certificates: (token: string) =>
    apiRequest<{ data: StudentCertificateRow[] }>('/v1/me/student/certificates', { token }),
  badges: (token: string) =>
    apiRequest<{ data: StudentBadgeRow[] }>('/v1/me/student/badges', { token }),
  wallet: (token: string) =>
    apiRequest<{ data: StudentWalletData }>('/v1/me/student/wallet', { token }),
  profile: (token: string) =>
    apiRequest<{ data: StudentProfileData }>('/v1/me/student/profile', { token }),
  updateProfile: (token: string, body: StudentProfileUpdate) =>
    apiRequest<{
      data: Pick<StudentProfileData, 'id' | 'name' | 'email' | 'avatarUrl' | 'locale'>;
    }>('/v1/me/student/profile', { method: 'PATCH', token, body }),
  redeemCode: (token: string, code: string) =>
    apiRequest<{
      enrollmentId: string;
      courseId: string;
      courseSlug: string;
      alreadyEnrolled: boolean;
    }>('/v1/public/courses/redeem-code', { method: 'POST', token, body: { code } }),
};
