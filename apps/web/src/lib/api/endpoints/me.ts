import { apiRequest } from '../client';

export interface DashboardStats {
  certificates: {
    issuedTotal: number;
    issuedThisMonth: number;
    queued: number;
    failed: number;
    revoked: number;
  };
  students: number;
  teamMembers: number;
}

export interface WalletInfo {
  walletAddress: string;
  network: string;
  chainAvailable: boolean;
  issuerOnly: true;
}

export interface InstitutionMembership {
  institution: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    website: string | null;
    country: string | null;
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
    /** Lock de Unlock que se propone al crear cursos y contenido del portal. */
    defaultLockAddress: string | null;
    defaultLockChainId: number | null;
    status: 'pending' | 'approved' | 'suspended' | 'revoked';
    plan: 'starter' | 'pro' | 'pro_extended' | 'enterprise';
    monthlyCertQuota: number;
    certIssuedThisMonth: number;
    createdAt: string;
    approvedAt: string | null;
    suspendedAt: string | null;
    suspensionReason: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
  };
  membership: {
    institutionId: string;
    userId: string;
    memberRole: string;
  };
}

export interface InstitutionCertificate {
  id: string;
  status: 'queued' | 'processing' | 'issued' | 'failed' | 'revoked';
  studentName: string;
  studentEmail: string;
  achievementName: string;
  grade: number | null;
  tokenId: string | null;
  txHash: string | null;
  transactionUrl: string | null;
  issuedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  failureReason: string | null;
}

export interface InstitutionCertificateDetail extends InstitutionCertificate {
  studentWallet: string | null;
  achievementDescription: string | null;
  courseId: string | null;
  courseTitle: string | null;
  templateId: string | null;
  templateName: string | null;
  blockNumber: string | null;
  arweaveTxId: string | null;
  ipfsCid: string | null;
  tokenUri: string | null;
  imageUrl: string | null;
  imageIpfsCid: string | null;
  downloadUrl: string | null;
  transactionUrl: string | null;
  contractUrl: string;
  /** Red principal + replicas. La principal decide si el certificado existe. */
  chains?: CertificateChain[];
}

export interface CertificateChain {
  chainId: number;
  name: string;
  role: 'primary' | 'mirror';
  status: string;
  tokenId: string | null;
  explorerUrl: string | null;
  failureReason?: string | null;
  attempts?: number;
}

export interface PaginatedCerts {
  page: number;
  limit: number;
  total: number;
  data: InstitutionCertificate[];
}

export interface IssueCertificatePayload {
  student: {
    email: string;
    name: string;
    externalId?: string;
    walletAddress?: string;
  };
  achievement: {
    name: string;
    description?: string;
    grade?: number;
    courseId?: string;
    completedAt: string;
  };
  templateId?: string;
  badgeCollectionId?: string;
  callbackUrl?: string;
  idempotencyKey?: string;
}

export interface IssueCertificateResult {
  certificateId: string;
  jobId: string;
  status: string;
  estimatedCompletionSeconds?: number;
  trackingUrl?: string;
  idempotent?: boolean;
}

export type CourseVisibility =
  | 'public_free'
  | 'public_paid'
  | 'private_code'
  | 'hybrid'
  | 'token_gated';

export interface CourseRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  visibility: CourseVisibility;
  accessCode: string | null;
  priceCents: number;
  currency: string;
  passingScore: number;
  durationHours: string | null;
  autoIssueEnabled: boolean;
  createdAt: string;
  enrollments: number;
  /** Lock de Unlock que concede la matrícula. Sólo en visibility 'token_gated'. */
  lockAddress: string | null;
  lockChainId: number | null;
  /** Módulos abiertos como muestra antes de exigir la membresía. */
  previewModuleCount: number;
  /**
   * Si el acceso concedido caduca con la membresía.
   *
   * 'perpetual' es pago único: quien entró conserva el curso. 'subscription'
   * revalida el Lock al abrir el material, que es lo que hace de Unlock una
   * suscripción de verdad. Opcional porque las respuestas anteriores a la
   * columna no lo traen, y ausente equivale a pago único.
   */
  accessMode?: 'perpetual' | 'subscription';
}

export type ModuleContentType = 'video' | 'article' | 'quiz' | 'assignment' | 'live';

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  contentType: ModuleContentType;
  content: Record<string, unknown> | null;
  weight: number;
  isRequired: boolean;
  /** Lock propio del módulo, para material premium dentro de un curso abierto. */
  lockAddress: string | null;
  lockChainId: number | null;
  createdAt: string;
}

export interface CourseTeacher {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  walletAddress: string | null;
  avatarUrl: string | null;
  assignmentRole: 'owner' | 'assistant';
  assignedAt: string;
}

export interface CourseDetail {
  course: CourseRow & {
    institutionId: string;
    thumbnailUrl: string | null;
    templateId: string | null;
    badgeCollectionId: string | null;
    updatedAt: string;
  };
  modules: CourseModule[];
  teachers: CourseTeacher[];
  metrics: {
    enrollments: number;
    completed: number;
    inProgress: number;
    avgScore: number | null;
    certificatesIssued: number;
  };
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  email: string;
  studentEmail: string | null;
  studentName: string | null;
  name: string | null;
  walletAddress: string | null;
  avatarUrl: string | null;
  source: 'manual' | 'payment' | 'api';
  startedAt: string | null;
  completedAt: string | null;
  finalScore: number | null;
  createdAt: string;
  completedModules: number;
  inProgressModules: number;
}

export interface CourseEnrollmentList {
  totals: { totalModules: number; requiredModules: number; enrollments: number };
  data: CourseEnrollment[];
}

export type ModuleProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface EnrollmentProgressEntry {
  moduleId: string;
  title: string;
  orderIndex: number;
  weight: number;
  isRequired: boolean;
  contentType: ModuleContentType;
  status: ModuleProgressStatus | null;
  score: number | null;
  note: string | null;
  startedAt: string | null;
  completedAt: string | null;
  progressId: string | null;
  updatedAt: string | null;
  assessments: Array<{
    id: string;
    moduleId: string;
    title: string;
    type: AssessmentType;
    attempts: Array<{
      id: string;
      assessmentId: string;
      attemptNumber: number;
      status: AttemptStatus;
      answers: Record<string, unknown>;
      score: number | null;
      startedAt: string | null;
      submittedAt: string | null;
      gradedAt: string | null;
    }>;
  }>;
}

export interface EnrollmentProgress {
  enrollment: {
    id: string;
    courseId: string;
    userId: string;
    studentEmail: string | null;
    studentName: string | null;
    enrollmentSource: string;
    startedAt: string | null;
    completedAt: string | null;
    finalScore: number | null;
    createdAt: string;
  };
  modules: EnrollmentProgressEntry[];
}

export interface StudentRow {
  userId: string | null;
  email: string;
  name: string | null;
  wallet: string | null;
  totalIssued: number;
  totalAll: number;
  enrollments: number;
  courses: Array<{ id: string; title: string }>;
  firstSeen: string;
  lastSeen: string;
}

export interface PaginatedStudents {
  page: number;
  limit: number;
  total: number;
  data: StudentRow[];
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  memberRole: string;
  createdAt: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  profileStatus: 'incomplete' | 'pending' | 'approved' | 'rejected' | null;
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
  profileApprovedAt: string | null;
}

export interface BadgeCollectionRow {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  maxSupply: number | null;
  onchainCollectionId: string | null;
  createdAt: string;
  minted: number;
}

export interface CertTemplateRow {
  id: string;
  name: string;
  backgroundUrl: string | null;
  layout: Record<string, unknown> | null;
  createdAt: string;
  usage: number;
}

export interface PublicCourseListEntry {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  visibility: CourseVisibility;
  durationHours: string | null;
  thumbnailUrl: string | null;
  institutionId: string;
  institutionName: string;
  institutionSlug: string;
  modulesCount: number;
}

export interface PublicCourseDetail {
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    priceCents: number;
    currency: string;
    visibility: CourseVisibility;
    durationHours: string | null;
    thumbnailUrl: string | null;
    passingScore: number;
  };
  institution: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
  };
  /**
   * Membresía de Unlock que abre el curso. Sólo viene en los token_gated;
   * en el resto es null y la página se comporta como siempre.
   */
  membership: {
    lockAddress: string;
    chainId: number;
    network: string;
    checkoutUrl: string;
    previewModuleCount: number;
    lockInfo: {
      name: string | null;
      keyPriceWei: string | null;
      expirationDuration: number | null;
    } | null;
  } | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    orderIndex: number;
    contentType: ModuleContentType;
    weight: number;
    isRequired: boolean;
    /** Visible sin membresía. El resto exige llave válida. */
    previewable: boolean;
  }>;
}

export interface TopicRow {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  contentType: string;
  content: Record<string, unknown> | null;
  orderIndex: number;
  /** No viaja en el payload del curso, que selecciona campo a campo. */
  createdAt?: string;

  /**
   * Material y portada.
   *
   * Del material solo se dice SI existe, nunca dónde: las claves de
   * almacenamiento se quedan en el servidor porque describen cómo está
   * organizado y no le sirven de nada al navegador. El archivo se pide por su
   * ruta protegida, que vuelve a comprobar la membresía.
   */
  hasMaterial?: boolean;
  hasPreview?: boolean;
  hasCover?: boolean;
  /**
   * Claves de almacenamiento.
   *
   * El payload del estudiante nunca las manda —dice sólo SI hay material, no
   * dónde vive—, pero el listado del panel institucional devuelve la fila
   * entera, y ahí el creador necesita saber si un temario ya tiene archivo y
   * portada para no volver a subirlos a ciegas.
   */
  assetKey?: string | null;
  coverKey?: string | null;
  assetMimeType?: string | null;
  assetByteSize?: number | null;
  assetPreviewSeconds?: number | null;
  /** Duración del material: se muestra sobre la portada y no revela contenido. */
  assetDurationSeconds?: number | null;
  /** Dimensiones de la portada, para reservar el hueco antes de que cargue. */
  coverWidth?: number | null;
  coverHeight?: number | null;
  /**
   * Permiso de lectura de la portada, firmado por el API.
   *
   * La portada se pinta con `<img>`, y un `<img>` no manda cabecera
   * `Authorization`: el navegador la pide por su cuenta. Este permiso viaja en
   * la URL para que el servidor sepa quién pregunta y pueda decidir, con las
   * mismas reglas de siempre, si entrega la nítida o la difuminada.
   */
  coverToken?: string | null;
  /**
   * Permiso para abrir el archivo completo.
   *
   * Va aparte del de la portada: el de la miniatura viaja a la vista en cada
   * `<img>`, así que no debe servir para descargar el vídeo. El servidor
   * vuelve a comprobar el acceso antes de entregar nada; esto sólo dice quién
   * pide.
   */
  materialToken?: string | null;
}

/**
 * Material de un temario, tal como viaja a la API.
 *
 * Los archivos van en base64 porque el resto del cliente habla JSON y añadir
 * multipart sólo para esta llamada obligaría a duplicar el manejo de errores
 * y de autenticación. El coste es un tercio más de peso, ya contemplado en el
 * límite propio que tiene esa ruta.
 */
/**
 * Lo que la cadena dice de un Lock.
 *
 * `status` es el veredicto y los tres casos significan cosas distintas:
 *
 *   ok             responde como Lock y su dueño es la institución.
 *   foreign-owner  es un Lock, pero cobra a otra wallet. No se bloquea —se
 *                  puede desplegar desde una wallet personal a propósito—
 *                  pero hay que avisarlo: es el error caro de esta pantalla.
 *   not-a-lock     la dirección existe pero no es un Lock: no abrirá nada.
 *   unreadable     no se pudo leer. Puede ser el RPC, no la dirección, así
 *                  que no se culpa a quien la pegó.
 */
export interface LockVerification {
  status: 'ok' | 'foreign-owner' | 'not-a-contract' | 'not-a-lock' | 'unreadable';
  address: string;
  chainId: number;
  network: string | null;
  name: string | null;
  /** Ya formateado: "0.001 ETH", o "Gratis" si el Lock no cobra. */
  price: string | null;
  /** Ya formateado: "1 mes", "No vence". */
  duration: string | null;
  keysSold: number | null;
  keyCap: string | null;
  version: number | null;
  owner: string | null;
  /** La wallet con la que se comparó el dueño. */
  institutionWallet: string;
  checkoutUrl: string;
}

export interface TopicMaterialBody {
  /** Archivo completo en base64, sin el prefijo `data:`. */
  data: string;
  mimeType: string;
  /** Muestra gratuita, si el creador la sube. Nunca se deriva del original. */
  preview?: string;
  previewSeconds?: number;
  /** Portada: lo único que ve quien todavía no tiene llave. */
  cover?: string;
  coverMimeType?: string;
  /** Duración del material; se muestra sobre la portada y no revela contenido. */
  durationSeconds?: number;
}

export interface TopicWriteBody {
  title: string;
  description?: string | null;
  contentType?: string;
  content?: Record<string, unknown> | null;
}

export type AssessmentType = 'multiple_choice' | 'true_false' | 'essay';
export type AssessmentScope = 'topic' | 'module';

export interface AssessmentRow {
  id: string;
  moduleId: string;
  topicId: string | null;
  scope: AssessmentScope;
  type: AssessmentType;
  title: string;
  description: string | null;
  weight: number;
  maxScore: number;
  passingScore: number;
  attemptsAllowed: number;
  timeLimitMin: number | null;
  orderIndex: number;
  createdAt: string;
}

export interface AssessmentWriteBody {
  type: AssessmentType;
  scope?: AssessmentScope;
  topicId?: string | null;
  title: string;
  description?: string | null;
  weight?: number;
  maxScore?: number;
  passingScore?: number;
  attemptsAllowed?: number;
  timeLimitMin?: number | null;
}

export type QuestionKind = 'single' | 'boolean' | 'text';
export interface QuestionOption {
  id: string;
  label: string;
}
export interface AssessmentQuestionRow {
  id: string;
  assessmentId: string;
  prompt: string;
  kind: QuestionKind;
  options: QuestionOption[] | null;
  correctAnswer: unknown;
  points: number;
  orderIndex: number;
}
export interface QuestionWriteBody {
  prompt: string;
  kind: QuestionKind;
  options?: QuestionOption[] | null;
  correctAnswer?: unknown;
  points?: number;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'graded';
export interface AttemptRow {
  id: string;
  enrollmentId: string;
  assessmentId: string;
  attemptNumber: number;
  status: AttemptStatus;
  answers: Record<string, unknown>;
  score: number | null;
  gradedBy: string | null;
  gradedAt: string | null;
  feedback: string | null;
  startedAt: string;
  submittedAt: string | null;
}

export interface LearnQuestionPublic {
  id: string;
  assessmentId: string;
  prompt: string;
  kind: QuestionKind;
  options: QuestionOption[] | null;
  points: number;
  orderIndex: number;
}

export interface LearnAssessment extends AssessmentRow {
  questions: LearnQuestionPublic[];
  attempts: AttemptRow[];
}

/**
 * Membresía de Unlock que abre un módulo de pago.
 *
 * `price` y `durationSeconds` se leen del Lock on-chain, así que pueden faltar
 * si el RPC no respondió. El `checkoutUrl` no depende de esa lectura: se
 * construye con la dirección y la red, de modo que el camino de compra sigue
 * existiendo aunque el precio no se haya podido mostrar.
 */
export interface LearnModuleGate {
  lockAddress: string;
  chainId: number;
  network: string;
  checkoutUrl: string;
  name: string | null;
  /** Precio ya formateado con su moneda, p. ej. "0.01 ETH". */
  price: string | null;
  /** Duración de la membresía en segundos. 0 significa que no expira. */
  durationSeconds: number | null;
}

export interface LearnModule {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  weight: number;
  isRequired: boolean;
  /** Lock que abre este módulo, o null si es de acceso libre. */
  gate?: LearnModuleGate | null;
  /**
   * Si el estudiante ya puede abrir este módulo.
   *
   * Va aparte de `gate` porque responden preguntas distintas: aquélla es
   * «cuánto cuesta», ésta es «¿ya lo pagué?». Sin ella el muro se pintaba
   * también para quien tenía la llave, y comprar la membresía no quitaba el
   * candado.
   */
  hasAccess?: boolean;
  topics: TopicRow[];
  assessments: LearnAssessment[];
  progress: {
    id: string;
    status: ModuleProgressStatus;
    score: number | null;
    completedAt: string | null;
    startedAt: string | null;
  } | null;
}

export interface LearnCoursePayload {
  enrollment: {
    id: string;
    status: 'not_started' | 'in_progress' | 'completed';
    startedAt: string | null;
    completedAt: string | null;
    finalScore: number | null;
    /** Membresía de Unlock que concedió la matrícula, si entró por ahí. */
    membership: {
      wallet: string | null;
      lockAddress: string;
      chainId: number | null;
      keyExpiresAt: string | null;
    } | null;
  };
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    passingScore: number;
    /** Membresía que abre el curso entero, si es token-gated. */
    gate?: LearnModuleGate | null;
  };
  modules: LearnModule[];
}

export const meApi = {
  stats: (token: string) => apiRequest<DashboardStats>('/v1/me/stats', { token }),
  wallet: (token: string) => apiRequest<WalletInfo>('/v1/me/wallet', { token }),
  institution: (token: string) =>
    apiRequest<InstitutionMembership>('/v1/me/institution', { token }),
  updateInstitution: (
    token: string,
    body: Partial<{
      name: string;
      website: string;
      description: string;
      country: string;
      legalName: string;
      taxId: string;
      addressLine: string;
      city: string;
      stateRegion: string;
      postalCode: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      accreditationId: string;
      /** Lock por defecto. null en ambos para desconfigurarlo. */
      defaultLockAddress: string | null;
      defaultLockChainId: number | null;
    }>,
  ) =>
    apiRequest<InstitutionMembership['institution']>('/v1/me/institution', {
      method: 'PATCH',
      token,
      body,
    }),
  certificates: (
    token: string,
    query: { page?: number; limit?: number; status?: string; studentEmail?: string } = {},
  ) => apiRequest<PaginatedCerts>('/v1/me/certificates', { token, query }),
  certificate: (token: string, id: string) =>
    apiRequest<InstitutionCertificateDetail>(`/v1/me/certificates/${id}`, { token }),
  /** Reintenta la replica en una red espejo. No altera el certificado original. */
  retryMirror: (token: string, id: string, chainId: number) =>
    apiRequest<{ chainId: number; status: string; tokenId: string | null; error: string | null }>(
      `/v1/me/certificates/${id}/mirrors/${chainId}/retry`,
      { method: 'POST', token },
    ),
  issueCertificates: (token: string, body: IssueCertificatePayload | IssueCertificatePayload[]) =>
    apiRequest<{ data: IssueCertificateResult[] }>('/v1/me/certificates/issue', {
      method: 'POST',
      token,
      body,
    }),

  // Cursos
  courses: (token: string) => apiRequest<{ data: CourseRow[] }>('/v1/me/courses', { token }),
  createCourse: (
    token: string,
    body: {
      title: string;
      slug: string;
      description?: string;
      priceCents?: number;
      currency?: string;
      passingScore?: number;
      durationHours?: number;
      autoIssueEnabled?: boolean;
      templateId?: string | null;
      status?: 'draft' | 'published' | 'archived';
      visibility?: CourseVisibility;
      /** Sólo para visibility 'token_gated'. */
      lockAddress?: string | null;
      lockChainId?: number | null;
      previewModuleCount?: number;
    },
  ) => apiRequest<CourseRow>('/v1/me/courses', { method: 'POST', token, body }),
  updateCourse: (
    token: string,
    id: string,
    body: Partial<{
      title: string;
      slug: string;
      description: string;
      priceCents: number;
      currency: string;
      passingScore: number;
      durationHours: number;
      autoIssueEnabled: boolean;
      templateId: string | null;
      status: 'draft' | 'published' | 'archived';
      visibility: CourseVisibility;
      /** Sólo para visibility 'token_gated'. */
      lockAddress: string | null;
      lockChainId: number | null;
      previewModuleCount: number;
    }>,
  ) => apiRequest<CourseRow>(`/v1/me/courses/${id}`, { method: 'PATCH', token, body }),
  regenerateAccessCode: (token: string, id: string) =>
    apiRequest<{ accessCode: string | null }>(`/v1/me/courses/${id}/access-code/regenerate`, {
      method: 'POST',
      token,
    }),

  // Catálogo público (sin token)
  publicCourses: () => apiRequest<{ data: PublicCourseListEntry[] }>('/v1/public/courses', {}),
  publicCourseDetail: (slug: string, institutionSlug: string) =>
    apiRequest<PublicCourseDetail>(`/v1/public/courses/${encodeURIComponent(slug)}`, {
      query: { institution: institutionSlug },
    }),
  redeemCourseCode: (token: string, code: string) =>
    apiRequest<{
      enrollmentId: string;
      courseId: string;
      courseSlug: string;
      alreadyEnrolled: boolean;
    }>('/v1/public/courses/redeem-code', { method: 'POST', token, body: { code } }),
  enrollPublicFreeCourse: (token: string, courseId: string) =>
    apiRequest<{
      enrollmentId: string;
      courseId: string;
      courseSlug: string;
      alreadyEnrolled: boolean;
    }>(`/v1/public/courses/${courseId}/enroll`, { method: 'POST', token }),

  /**
   * Matrícula por membresía de Unlock. El servidor vuelve a comprobar la
   * llave on-chain: esta llamada no concede nada por sí sola.
   */
  enrollCourseWithMembership: (
    token: string,
    courseId: string,
    body: { wallet: string; signature: string; issuedAt: number },
  ) =>
    apiRequest<{
      enrollmentId: string;
      courseId: string;
      courseSlug: string;
      alreadyEnrolled: boolean;
      membership?: { wallet: string; network: string; expiresAt: string | null };
    }>(`/v1/public/courses/${courseId}/enroll-with-membership`, {
      method: 'POST',
      token,
      body,
    }),

  // Topics
  listTopics: (token: string, moduleId: string) =>
    apiRequest<{ data: TopicRow[] }>(`/v1/me/modules/${moduleId}/topics`, { token }),
  createTopic: (token: string, moduleId: string, body: TopicWriteBody) =>
    apiRequest<{ data: TopicRow }>(`/v1/me/modules/${moduleId}/topics`, {
      method: 'POST',
      token,
      body,
    }),
  updateTopic: (token: string, topicId: string, body: Partial<TopicWriteBody>) =>
    apiRequest<{ data: TopicRow }>(`/v1/me/topics/${topicId}`, {
      method: 'PATCH',
      token,
      body,
    }),
  deleteTopic: (token: string, topicId: string) =>
    apiRequest<null>(`/v1/me/topics/${topicId}`, { method: 'DELETE', token }),

  /**
   * Sube el material de un temario y, con él, su portada.
   *
   * La portada es lo único que ve quien todavía no tiene llave, así que viaja
   * en la misma petición que el archivo: subir material sin portada deja el
   * temario invisible en el curso, y no hay razón para separarlos en dos
   * pasos que se pueden olvidar a la mitad.
   */
  uploadTopicMaterial: (token: string, topicId: string, body: TopicMaterialBody) =>
    apiRequest<{ data: TopicRow }>(`/v1/me/topics/${topicId}/material`, {
      method: 'POST',
      token,
      body,
    }),
  deleteTopicMaterial: (token: string, topicId: string) =>
    apiRequest<{ data: TopicRow }>(`/v1/me/topics/${topicId}/material`, {
      method: 'DELETE',
      token,
    }),

  /**
   * Lee un Lock contra la cadena, sin guardar nada.
   *
   * Existe para que la pantalla pueda mostrar qué es ese contrato —precio,
   * duración, dueño, llaves vendidas— antes de que la institución confirme.
   * Hasta ahora pegar una dirección era un acto de fe: la tarjeta decía
   * "configurado" sin haber leído una sola función del Lock.
   */
  verifyLock: (token: string, body: { lockAddress: string; lockChainId: number }) =>
    apiRequest<{ data: LockVerification }>('/v1/me/lock/verify', {
      method: 'POST',
      token,
      body,
    }),

  // Assessments
  listAssessments: (token: string, moduleId: string) =>
    apiRequest<{ data: AssessmentRow[] }>(`/v1/me/modules/${moduleId}/assessments`, { token }),
  createAssessment: (token: string, moduleId: string, body: AssessmentWriteBody) =>
    apiRequest<{ data: AssessmentRow }>(`/v1/me/modules/${moduleId}/assessments`, {
      method: 'POST',
      token,
      body,
    }),
  updateAssessment: (token: string, assessmentId: string, body: Partial<AssessmentWriteBody>) =>
    apiRequest<{ data: AssessmentRow }>(`/v1/me/assessments/${assessmentId}`, {
      method: 'PATCH',
      token,
      body,
    }),
  deleteAssessment: (token: string, assessmentId: string) =>
    apiRequest<null>(`/v1/me/assessments/${assessmentId}`, { method: 'DELETE', token }),

  // Questions
  listQuestions: (token: string, assessmentId: string) =>
    apiRequest<{ data: AssessmentQuestionRow[] }>(`/v1/me/assessments/${assessmentId}/questions`, {
      token,
    }),
  createQuestion: (token: string, assessmentId: string, body: QuestionWriteBody) =>
    apiRequest<{ data: AssessmentQuestionRow }>(`/v1/me/assessments/${assessmentId}/questions`, {
      method: 'POST',
      token,
      body,
    }),
  updateQuestion: (token: string, questionId: string, body: Partial<QuestionWriteBody>) =>
    apiRequest<{ data: AssessmentQuestionRow }>(`/v1/me/questions/${questionId}`, {
      method: 'PATCH',
      token,
      body,
    }),
  deleteQuestion: (token: string, questionId: string) =>
    apiRequest<null>(`/v1/me/questions/${questionId}`, { method: 'DELETE', token }),

  // Learn (estudiante)
  learnCourse: (token: string, enrollmentId: string) =>
    apiRequest<{ data: LearnCoursePayload }>(`/v1/me/learn/courses/${enrollmentId}`, { token }),
  startAttempt: (token: string, assessmentId: string) =>
    apiRequest<{ data: AttemptRow }>(`/v1/me/learn/assessments/${assessmentId}/start`, {
      method: 'POST',
      token,
    }),
  submitAttempt: (token: string, attemptId: string, answers: Record<string, unknown>) =>
    apiRequest<{ data: AttemptRow }>(`/v1/me/learn/attempts/${attemptId}/submit`, {
      method: 'POST',
      token,
      body: { answers },
    }),
  updateLearnModuleProgress: (
    token: string,
    moduleId: string,
    body: { status: 'in_progress' | 'completed' },
  ) =>
    apiRequest<{ ok: true }>(`/v1/me/learn/modules/${moduleId}/progress`, {
      method: 'POST',
      token,
      body,
    }),

  getCourse: (token: string, id: string) =>
    apiRequest<CourseDetail>(`/v1/me/courses/${id}`, { token }),
  archiveCourse: (token: string, id: string) =>
    apiRequest<CourseRow>(`/v1/me/courses/${id}/archive`, { method: 'POST', token }),
  deleteCourse: (token: string, id: string) =>
    apiRequest<null>(`/v1/me/courses/${id}`, { method: 'DELETE', token }),

  // Modules
  listModules: (token: string, courseId: string) =>
    apiRequest<{ data: CourseModule[] }>(`/v1/me/courses/${courseId}/modules`, { token }),
  createModule: (
    token: string,
    courseId: string,
    body: {
      title: string;
      description?: string;
      contentType?: ModuleContentType;
      content?: Record<string, unknown>;
      weight?: number;
      isRequired?: boolean;
      /** Lock propio del módulo. null en ambos para quitarlo. */
      lockAddress?: string | null;
      lockChainId?: number | null;
    },
  ) =>
    apiRequest<CourseModule>(`/v1/me/courses/${courseId}/modules`, {
      method: 'POST',
      token,
      body,
    }),
  updateModule: (
    token: string,
    courseId: string,
    moduleId: string,
    body: Partial<{
      title: string;
      description: string;
      contentType: ModuleContentType;
      content: Record<string, unknown>;
      weight: number;
      isRequired: boolean;
      /** Lock propio del módulo. null en ambos para quitarlo. */
      lockAddress: string | null;
      lockChainId: number | null;
    }>,
  ) =>
    apiRequest<CourseModule>(`/v1/me/courses/${courseId}/modules/${moduleId}`, {
      method: 'PATCH',
      token,
      body,
    }),
  deleteModule: (token: string, courseId: string, moduleId: string) =>
    apiRequest<null>(`/v1/me/courses/${courseId}/modules/${moduleId}`, {
      method: 'DELETE',
      token,
    }),
  reorderModules: (token: string, courseId: string, order: string[]) =>
    apiRequest<{ ok: true }>(`/v1/me/courses/${courseId}/modules/reorder`, {
      method: 'POST',
      token,
      body: { order },
    }),

  // Course teachers
  listCourseTeachers: (token: string, courseId: string) =>
    apiRequest<{ data: CourseTeacher[] }>(`/v1/me/courses/${courseId}/teachers`, { token }),
  assignCourseTeacher: (
    token: string,
    courseId: string,
    body: { userId: string; assignmentRole?: 'owner' | 'assistant' },
  ) =>
    apiRequest<CourseTeacher>(`/v1/me/courses/${courseId}/teachers`, {
      method: 'POST',
      token,
      body,
    }),
  unassignCourseTeacher: (token: string, courseId: string, assignmentId: string) =>
    apiRequest<null>(`/v1/me/courses/${courseId}/teachers/${assignmentId}`, {
      method: 'DELETE',
      token,
    }),

  // Enrollments
  listCourseEnrollments: (token: string, courseId: string) =>
    apiRequest<CourseEnrollmentList>(`/v1/me/courses/${courseId}/enrollments`, { token }),
  enrollStudent: (token: string, courseId: string, body: { email: string; name?: string }) =>
    apiRequest<CourseEnrollment>(`/v1/me/courses/${courseId}/enrollments`, {
      method: 'POST',
      token,
      body,
    }),
  removeEnrollment: (token: string, courseId: string, enrollmentId: string) =>
    apiRequest<null>(`/v1/me/courses/${courseId}/enrollments/${enrollmentId}`, {
      method: 'DELETE',
      token,
    }),

  // Enrollment progress
  getEnrollmentProgress: (token: string, courseId: string, enrollmentId: string) =>
    apiRequest<EnrollmentProgress>(
      `/v1/me/courses/${courseId}/enrollments/${enrollmentId}/progress`,
      { token },
    ),
  updateModuleProgress: (
    token: string,
    courseId: string,
    enrollmentId: string,
    moduleId: string,
    body: { status: ModuleProgressStatus; score?: number; note?: string },
  ) =>
    apiRequest<{
      progress: { id: string; status: ModuleProgressStatus };
      enrollmentCompleted: boolean;
      finalScore: number | null;
    }>(`/v1/me/courses/${courseId}/enrollments/${enrollmentId}/progress/${moduleId}`, {
      method: 'PATCH',
      token,
      body,
    }),

  // Estudiantes
  students: (token: string, query: { page?: number; limit?: number } = {}) =>
    apiRequest<PaginatedStudents>('/v1/me/students', { token, query }),

  // Team
  team: (token: string) => apiRequest<{ data: TeamMember[] }>('/v1/me/team', { token }),
  teamInvitations: (token: string, query: { page?: number; limit?: number } = {}) =>
    apiRequest<{
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      data: TeamInvitationHistory[];
    }>('/v1/me/team/invitations', { token, query }),
  inviteTeamMember: (
    token: string,
    body: {
      email: string;
      memberRole: 'admin' | 'teacher' | 'reviewer';
      courseId?: string;
    },
  ) =>
    apiRequest<{
      invitationId: string;
      email: string;
      name: string | null;
      memberRole: string;
      courseId: string | null;
      courseTitle: string | null;
      existingUser: boolean;
      expiresAt: string;
      createdAt: string;
      inviteUrl: string | null;
    }>('/v1/me/team/invite', { method: 'POST', token, body }),
  updateTeamMember: (
    token: string,
    memberId: string,
    body: { memberRole: 'admin' | 'teacher' | 'reviewer' },
  ) => apiRequest<TeamMember>(`/v1/me/team/${memberId}`, { method: 'PATCH', token, body }),
  removeTeamMember: (token: string, memberId: string) =>
    apiRequest<null>(`/v1/me/team/${memberId}`, { method: 'DELETE', token }),

  // Plan
  requestPlanChange: (
    token: string,
    body: { targetPlan: 'starter' | 'pro' | 'pro_extended'; note?: string },
  ) =>
    apiRequest<{
      ok: true;
      mode: 'manual';
      currentPlan: string;
      targetPlan: string;
      contactEmail: string;
      message: string;
    }>('/v1/me/plan/request-change', { method: 'POST', token, body }),

  // Badges
  badgeCollections: (token: string) =>
    apiRequest<{ data: BadgeCollectionRow[] }>('/v1/me/badge-collections', { token }),
  createBadgeCollection: (
    token: string,
    body: { name: string; description?: string; imageUrl?: string; maxSupply?: number },
  ) =>
    apiRequest<BadgeCollectionRow>('/v1/me/badge-collections', {
      method: 'POST',
      token,
      body,
    }),

  // Templates
  templates: (token: string) =>
    apiRequest<{ data: CertTemplateRow[] }>('/v1/me/templates', { token }),
  createTemplate: (
    token: string,
    body: { name: string; backgroundUrl?: string; layout?: Record<string, unknown> },
  ) => apiRequest<CertTemplateRow>('/v1/me/templates', { method: 'POST', token, body }),
  updateTemplate: (
    token: string,
    id: string,
    body: { name?: string; backgroundUrl?: string; layout?: Record<string, unknown> },
  ) => apiRequest<CertTemplateRow>(`/v1/me/templates/${id}`, { method: 'PUT', token, body }),
  deleteTemplate: (token: string, id: string) =>
    apiRequest<{ deleted: boolean; id: string }>(`/v1/me/templates/${id}`, {
      method: 'DELETE',
      token,
    }),

  // Analytics
  analyticsOverview: (token: string) =>
    apiRequest<AnalyticsOverview>('/v1/me/analytics/overview', { token }),

  // Revenue
  revenueSummary: (token: string) =>
    apiRequest<RevenueSummary>('/v1/me/revenue/summary', { token }),

  // Creditos
  credits: (token: string) => apiRequest<CreditsOverview>('/v1/me/credits', { token }),
  creditBundles: (token: string) =>
    apiRequest<{ bundles: CreditBundleDto[] }>('/v1/me/credits/bundles', { token }),
  startCheckout: (token: string, bundleCode: string) =>
    apiRequest<CheckoutResponse>('/v1/me/credits/checkout', {
      method: 'POST',
      token,
      body: { bundleCode },
    }),
  startSubscriptionCheckout: (token: string, planCode: SubscriptionPlanCode) =>
    apiRequest<SubscriptionCheckoutResponse>('/v1/me/subscriptions/checkout', {
      method: 'POST',
      token,
      body: { planCode },
    }),
  subscriptionCatalog: (token: string) =>
    apiRequest<{ plans: SubscriptionPlanDto[] }>('/v1/me/subscriptions/catalog', { token }),
  subscriptions: (token: string) =>
    apiRequest<{ subscriptions: SubscriptionEntitlementDto[] }>('/v1/me/subscriptions', { token }),
  cancelSubscription: (token: string, subscriptionId: string) =>
    apiRequest<{ cancelled: boolean; idempotent: boolean }>(
      `/v1/me/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { method: 'POST', token },
    ),

  // ─── Teacher (rol docente) ─────────────────────────────────────────────────
  teacherDashboard: (token: string) =>
    apiRequest<{ data: TeacherDashboard }>('/v1/me/teacher/dashboard', { token }),
  teacherInstitutions: (token: string) =>
    apiRequest<{ data: TeacherInstitutionRow[] }>('/v1/me/teacher/institutions', { token }),
  teacherCourses: (token: string) =>
    apiRequest<{ data: TeacherCourseRow[] }>('/v1/me/teacher/courses', { token }),
  teacherStudents: (token: string, query: { courseId?: string; search?: string } = {}) =>
    apiRequest<{ data: TeacherStudentRow[]; totals: { enrollments: number; students: number } }>(
      '/v1/me/teacher/students',
      { token, query },
    ),
  teacherStudentDetail: (token: string, enrollmentId: string) =>
    apiRequest<{ data: TeacherStudentDetail }>(`/v1/me/teacher/students/${enrollmentId}`, {
      token,
    }),
  teacherGradingQueue: (
    token: string,
    query: { courseId?: string; status?: 'submitted' | 'graded' | 'all' } = {},
  ) =>
    apiRequest<{
      data: TeacherGradingItem[];
      totals: { pending: number; graded: number };
    }>('/v1/me/teacher/grading-queue', { token, query }),
  teacherAttempt: (token: string, attemptId: string) =>
    apiRequest<{ data: TeacherAttemptDetail }>(`/v1/me/teacher/attempts/${attemptId}`, { token }),
  teacherGradeAttempt: (
    token: string,
    attemptId: string,
    body: { score: number; feedback?: string | null },
  ) =>
    apiRequest<{ data: AttemptRow }>(`/v1/me/teacher/attempts/${attemptId}/grade`, {
      method: 'POST',
      token,
      body,
    }),
  teacherUpdateModuleProgress: (
    token: string,
    enrollmentId: string,
    moduleId: string,
    body: {
      status: 'not_started' | 'in_progress' | 'completed';
      score?: number | null;
      note?: string | null;
    },
  ) =>
    apiRequest<{ ok: true }>(
      `/v1/me/teacher/enrollments/${enrollmentId}/modules/${moduleId}/progress`,
      { method: 'PATCH', token, body },
    ),
};

// ─── Tipos teacher ───────────────────────────────────────────────────────────

export interface TeacherDashboard {
  counts: {
    courses: number;
    publishedCourses: number;
    students: number;
    activeStudents: number;
    completedStudents: number;
    pendingGrading: number;
    modules: number;
    assessments: number;
  };
  avgFinalScore: number | null;
  avgPassingRate: number | null;
  recentActivity: Array<{
    attemptId: string;
    status: AttemptStatus;
    score: number | null;
    submittedAt: string | null;
    assessmentTitle: string;
    assessmentType: AssessmentType | null;
    courseTitle: string;
    courseId: string | null;
    studentEmail: string | null;
    studentName: string | null;
    enrollmentId: string | null;
  }>;
}

export interface TeacherInstitutionRow {
  id: string;
  institutionId: string;
  memberRole: string;
  createdAt: string;
  name: string;
  slug: string;
  status: 'pending' | 'approved' | 'suspended' | 'revoked';
  country: string | null;
  website: string | null;
  courseCount: number;
}

export interface TeamInvitationHistory {
  id: string;
  email: string;
  name: string | null;
  memberRole: string;
  courseId: string | null;
  courseTitle: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
}

export interface TeacherCourseRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  visibility: CourseVisibility;
  priceCents: number;
  currency: string;
  passingScore: number;
  autoIssueEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  institutionName: string;
  institutionStatus: 'pending' | 'approved' | 'suspended' | 'revoked';
  institutionSuspensionReason: string | null;
  modules: number;
  enrollments: number;
  completed: number;
  inProgress: number;
  avgScore: number | null;
  pendingGrading: number;
}

export interface TeacherStudentRow {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  source: string;
  startedAt: string | null;
  completedAt: string | null;
  finalScore: number | null;
  createdAt: string;
  pendingGrading: number;
}

export interface TeacherStudentDetail {
  enrollment: {
    id: string;
    courseId: string;
    userId: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
    source: string;
    startedAt: string | null;
    completedAt: string | null;
    finalScore: number | null;
    createdAt: string;
  };
  course: {
    id: string;
    title: string;
    slug: string;
    passingScore: number;
  };
  modules: Array<{
    id: string;
    title: string;
    orderIndex: number;
    weight: number;
    isRequired: boolean;
    progress: {
      id: string;
      status: ModuleProgressStatus;
      score: number | null;
      note: string | null;
      startedAt: string | null;
      completedAt: string | null;
    } | null;
    assessments: Array<{
      id: string;
      title: string;
      type: AssessmentType;
      weight: number;
      maxScore: number;
      passingScore: number;
      attempts: Array<{
        id: string;
        attemptNumber: number;
        status: AttemptStatus;
        score: number | null;
        submittedAt: string | null;
        gradedAt: string | null;
      }>;
    }>;
  }>;
}

export interface TeacherGradingItem {
  attemptId: string;
  enrollmentId: string;
  status: AttemptStatus;
  score: number | null;
  submittedAt: string | null;
  gradedAt: string | null;
  attemptNumber: number;
  assessment: {
    id: string;
    title: string;
    maxScore: number;
    passingScore: number;
    weight: number;
  } | null;
  module: { id: string; title: string } | null;
  course: { id: string; title: string; slug: string } | null;
  student: {
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
}

export interface TeacherAttemptDetail {
  attempt: {
    id: string;
    attemptNumber: number;
    status: AttemptStatus;
    score: number | null;
    feedback: string | null;
    startedAt: string;
    submittedAt: string | null;
    gradedAt: string | null;
    gradedBy: string | null;
  };
  assessment: {
    id: string;
    title: string;
    type: AssessmentType;
    description: string | null;
    weight: number;
    maxScore: number;
    passingScore: number;
  };
  module: { id: string; title: string };
  course: { id: string; title: string; slug: string } | null;
  enrollment: {
    id: string;
    userId: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  questions: Array<{
    id: string;
    prompt: string;
    kind: QuestionKind;
    options: QuestionOption[] | null;
    points: number;
    orderIndex: number;
    correctAnswer: unknown;
    studentAnswer: unknown;
  }>;
  history: Array<{
    id: string;
    attemptNumber: number;
    status: AttemptStatus;
    score: number | null;
    submittedAt: string | null;
    gradedAt: string | null;
  }>;
}

export interface AnalyticsCourseRow {
  id: string;
  title: string;
  currency: string;
  priceCents: number;
  enrollments: number;
  completions: number;
  completionRate: number;
  revenueCents: number;
}

export interface AnalyticsOverview {
  kpis: {
    issuedThisMonth: number;
    issuedMonthDeltaPct: number;
    activeStudents30d: number;
    activeStudentsDeltaPct: number;
    activeCourses: number;
    totalCourses: number;
    completionRate: number;
  };
  courses: AnalyticsCourseRow[];
  series: { day: string; issued: number }[];
}

export interface RevenuePeriod {
  month: string;
  currency: string;
  paidCount: number;
  grossCents: number;
  processorFeeCents: number;
  tesseraFeeCents: number;
  institutionPayoutCents: number;
}

export interface RevenueSummary {
  plan: 'starter' | 'pro' | 'pro_extended' | 'enterprise';
  activePlanCode: SubscriptionPlanCode | null;
  monetizationEnabled: boolean;
  splits: { processorFeePct: number; tesseraSharePct: number; institutionSharePct: number };
  currency: string;
  currentMonth: {
    grossCents: number;
    processorFeeCents: number;
    tesseraFeeCents: number;
    institutionPayoutCents: number;
    paidCount: number;
  } | null;
  periods: RevenuePeriod[];
}

export interface CreditBundleDto {
  code: string;
  name: string;
  tsc: number;
  priceCents: number;
  currency: 'USD';
  discountBps: number;
  validityMonths: number;
  pricingVersion: string;
  highlight?: 'recommended' | 'best_value';
}

export interface CreditLedgerEntry {
  id: string;
  delta: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  bundleCode: string | null;
  unitCostCents: number | null;
  currency: string | null;
  note: string | null;
  createdAt: string;
}

export interface CreditsOverview {
  balance: number;
  tscPerCertificate: number;
  lowBalance: boolean;
  emittedThisMonth: number;
  emittedLast30Days: number;
  avgDailyConsumption: number;
  daysRemaining: number | null;
  lastPurchase: {
    createdAt: string;
    tsc: number;
    bundleCode: string | null;
    unitCostCents: number | null;
    currency: string | null;
  } | null;
  ledger: CreditLedgerEntry[];
}

export interface CheckoutResponse {
  mode: 'stripe';
  checkoutUrl: string;
  paymentOrderId: string;
  providerOrderId: string;
}

export type SubscriptionPlanCode =
  | 'essential'
  | 'growth'
  | 'institutional'
  | 'scale'
  | 'enterprise';

export interface SubscriptionPlanDto {
  code: SubscriptionPlanCode;
  name: string;
  description: string;
  monthlyTsc: number;
  monthlyPriceCents: number;
  launchDiscountBps: number;
  extraTscPriceCents: number;
  minimumCommitmentMonths: number;
  pricingVersion: string;
  active?: boolean;
}

export interface SubscriptionCheckoutResponse {
  checkoutUrl: string;
  paymentOrderId: string;
  providerOrderId: string;
}

export interface SubscriptionEntitlementDto {
  providerSubscriptionId: string;
  planCode: SubscriptionPlanCode;
  monthlyTsc: number;
  status: string;
  currentPeriodEnd: string | null;
}
