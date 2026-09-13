'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/server/auth';
import { apiKeysApi, type ApiKeyScope } from '@/lib/api/endpoints/api-keys';
import { webhooksApi, type WebhookEvent } from '@/lib/api/endpoints/webhooks';
import {
  meApi,
  type IssueCertificatePayload,
  type LockVerification,
  type SubscriptionPlanCode,
  type TopicMaterialBody,
} from '@/lib/api/endpoints/me';
import { ApiError } from '@/lib/api/client';

async function token() {
  const session = await auth();
  if (!session?.accessToken) throw new Error('UNAUTHENTICATED');
  return session.accessToken;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

// ─── API Keys ──────────────────────────────────────────────────────────────────
const VALID_SCOPES: ApiKeyScope[] = [
  'certificates:read',
  'certificates:write',
  'badges:read',
  'badges:write',
  'courses:read',
  'courses:write',
  'wallet:read',
];

export async function createApiKeyAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; key: string; name: string; prefix: string }>> {
  try {
    const t = await token();
    const name = String(formData.get('name') ?? '').trim();
    const scopes = formData
      .getAll('scopes')
      .map(String)
      .filter((s) => (VALID_SCOPES as string[]).includes(s)) as ApiKeyScope[];
    const expiresInRaw = formData.get('expiresInDays');
    const expiresInDays = expiresInRaw ? Number(expiresInRaw) : undefined;

    if (name.length < 2) return { ok: false, error: 'El nombre es requerido' };
    if (scopes.length === 0) return { ok: false, error: 'Selecciona al menos un scope' };

    const created = await apiKeysApi.create(t, {
      name,
      scopes,
      ...(expiresInDays && Number.isFinite(expiresInDays) ? { expiresInDays } : {}),
    });
    revalidatePath('/institution/api-keys');
    return {
      ok: true,
      data: { id: created.id, key: created.key, name: created.name, prefix: created.prefix },
    };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear API key' };
  }
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult> {
  try {
    const t = await token();
    await apiKeysApi.revoke(t, id);
    revalidatePath('/institution/api-keys');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al revocar' };
  }
}

// ─── Certificates ─────────────────────────────────────────────────────────────
export async function issueCertificatesAction(
  payloads: IssueCertificatePayload[],
): Promise<ActionResult<{ count: number }>> {
  try {
    if (payloads.length === 0) return { ok: false, error: 'No hay certificados para emitir' };
    const t = await token();
    let count = 0;
    for (let index = 0; index < payloads.length; index += 100) {
      const chunk = payloads.slice(index, index + 100);
      const result = await meApi.issueCertificates(t, chunk);
      count += result.data.length;
    }
    revalidatePath('/institution/certificates');
    revalidatePath('/institution');
    return { ok: true, data: { count } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al emitir certificados',
    };
  }
}

// ─── Webhooks ──────────────────────────────────────────────────────────────────
const VALID_EVENTS: WebhookEvent[] = [
  'certificate.issued',
  'certificate.failed',
  'certificate.revoked',
  'badge.issued',
  'credits.low_balance',
  'payment.received',
];

export async function createWebhookAction(
  formData: FormData,
): Promise<ActionResult<{ id: string; secret: string; url: string }>> {
  try {
    const t = await token();
    const url = String(formData.get('url') ?? '').trim();
    const events = formData
      .getAll('events')
      .map(String)
      .filter((e) => (VALID_EVENTS as string[]).includes(e)) as WebhookEvent[];

    if (!/^https?:\/\//.test(url)) return { ok: false, error: 'URL inválida' };
    if (events.length === 0) return { ok: false, error: 'Selecciona al menos un evento' };

    const created = await webhooksApi.create(t, { url, events });
    revalidatePath('/institution/webhooks');
    return { ok: true, data: { id: created.id, secret: created.secret, url: created.url } };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear webhook' };
  }
}

export async function deleteWebhookAction(id: string): Promise<ActionResult> {
  try {
    const t = await token();
    await webhooksApi.remove(t, id);
    revalidatePath('/institution/webhooks');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al eliminar' };
  }
}

// ─── Settings ──────────────────────────────────────────────────────────────────
export async function updateInstitutionAction(formData: FormData): Promise<ActionResult> {
  try {
    const t = await token();
    const body: Record<string, string> = {};
    const name = String(formData.get('name') ?? '').trim();
    const website = String(formData.get('website') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const country = String(formData.get('country') ?? '').trim();
    const legalName = String(formData.get('legalName') ?? '').trim();
    const taxId = String(formData.get('taxId') ?? '').trim();
    const addressLine = String(formData.get('addressLine') ?? '').trim();
    const city = String(formData.get('city') ?? '').trim();
    const stateRegion = String(formData.get('stateRegion') ?? '').trim();
    const postalCode = String(formData.get('postalCode') ?? '').trim();
    const contactName = String(formData.get('contactName') ?? '').trim();
    const contactEmail = String(formData.get('contactEmail') ?? '').trim();
    const contactPhone = String(formData.get('contactPhone') ?? '').trim();
    const accreditationId = String(formData.get('accreditationId') ?? '').trim();
    if (name) body.name = name;
    if (website) body.website = website;
    if (description) body.description = description;
    if (country) body.country = country.toUpperCase();
    if (legalName) body.legalName = legalName;
    if (taxId) body.taxId = taxId;
    if (addressLine) body.addressLine = addressLine;
    if (city) body.city = city;
    if (stateRegion) body.stateRegion = stateRegion;
    if (postalCode) body.postalCode = postalCode;
    if (contactName) body.contactName = contactName;
    if (contactEmail) body.contactEmail = contactEmail;
    if (contactPhone) body.contactPhone = contactPhone;
    if (accreditationId) body.accreditationId = accreditationId;

    await meApi.updateInstitution(t, body);
    revalidatePath('/institution/settings');
    revalidatePath('/institution');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al guardar' };
  }
}

// ─── Courses ───────────────────────────────────────────────────────────────────
function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const VALID_VISIBILITIES = [
  'public_free',
  'public_paid',
  'private_code',
  'hybrid',
  'token_gated',
] as const;

/**
 * Datos del Lock para un curso con membresía.
 *
 * Sólo se envían cuando la visibilidad es 'token_gated'. En cualquier otro
 * modo se omiten para no dejar un Lock guardado que ya no decide nada.
 */
function lockFields(formData: FormData, visibility: CourseVisibility) {
  if (visibility !== 'token_gated') return {};

  const lockAddress = String(formData.get('lockAddress') ?? '').trim();
  const lockChainId = Number(formData.get('lockChainId') ?? 0);
  const previewRaw = formData.get('previewModuleCount');
  const previewModuleCount = previewRaw === null ? 1 : Number(previewRaw);

  return {
    lockAddress,
    lockChainId,
    previewModuleCount: Math.max(0, Math.min(50, Number.isFinite(previewModuleCount) ? previewModuleCount : 1)),
  };
}
type CourseVisibility = (typeof VALID_VISIBILITIES)[number];

function parseVisibility(
  raw: unknown,
  fallback: CourseVisibility = 'private_code',
): CourseVisibility {
  const v = String(raw ?? fallback);
  return (VALID_VISIBILITIES as readonly string[]).includes(v) ? (v as CourseVisibility) : fallback;
}

export async function createCourseAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const slugInput = String(formData.get('slug') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const priceUsd = Number(formData.get('priceUsd') ?? 0);
    const passingScore = Number(formData.get('passingScore') ?? 70);
    const durationHours = Number(formData.get('durationHours') ?? 0);
    const status = String(formData.get('status') ?? 'draft') as 'draft' | 'published';
    const autoIssueEnabled = String(formData.get('autoIssueEnabled') ?? 'on') === 'on';
    const visibility = parseVisibility(formData.get('visibility'));

    if (title.length < 2) return { ok: false, error: 'El título es requerido' };

    const created = await meApi.createCourse(t, {
      title,
      slug: slugify(slugInput || title) || `curso-${Date.now()}`,
      description: description || undefined,
      priceCents: Math.max(0, Math.round(priceUsd * 100)),
      passingScore: Math.max(0, Math.min(100, passingScore)),
      autoIssueEnabled,
      status,
      visibility,
      ...lockFields(formData, visibility),
      ...(durationHours > 0 ? { durationHours } : {}),
    });
    revalidatePath('/institution/courses');
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear curso' };
  }
}

export async function updateCourseAction(
  courseId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const slugInput = String(formData.get('slug') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const priceUsd = Number(formData.get('priceUsd') ?? 0);
    const passingScore = Number(formData.get('passingScore') ?? 70);
    const durationHours = Number(formData.get('durationHours') ?? 0);
    const status = String(formData.get('status') ?? 'draft') as 'draft' | 'published' | 'archived';
    const autoIssueEnabled = String(formData.get('autoIssueEnabled') ?? '') === 'on';
    const visibility = parseVisibility(formData.get('visibility'));
    const templateId = String(formData.get('templateId') ?? '').trim();
    if (title.length < 2) return { ok: false, error: 'El título es requerido' };

    await meApi.updateCourse(t, courseId, {
      title,
      slug: slugify(slugInput || title),
      description: description || undefined,
      priceCents: Math.max(0, Math.round(priceUsd * 100)),
      passingScore: Math.max(0, Math.min(100, passingScore)),
      autoIssueEnabled,
      templateId: templateId || null,
      status,
      visibility,
      ...lockFields(formData, visibility),
      ...(durationHours > 0 ? { durationHours } : {}),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    revalidatePath('/institution/courses');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al actualizar curso',
    };
  }
}

export async function archiveCourseAction(courseId: string): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.archiveCourse(t, courseId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    revalidatePath('/institution/courses');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al archivar curso' };
  }
}

export async function deleteCourseAction(courseId: string): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteCourse(t, courseId);
    revalidatePath('/institution/courses');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al eliminar curso' };
  }
}

export async function regenerateAccessCodeAction(
  courseId: string,
): Promise<ActionResult<{ accessCode: string | null }>> {
  try {
    const t = await token();
    const result = await meApi.regenerateAccessCode(t, courseId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true, data: { accessCode: result.accessCode } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al regenerar código',
    };
  }
}

// ─── Módulos ───────────────────────────────────────────────────────────────────
const VALID_MODULE_TYPES = ['video', 'article', 'quiz', 'assignment', 'live'] as const;


/**
 * Lock propio de un módulo, para material premium dentro de un curso abierto.
 *
 * Si el interruptor está apagado se envían ambos campos en null, de modo que
 * quitar la membresía de un módulo que ya la tenía funcione igual que ponerla.
 */
function moduleLockFields(formData: FormData) {
  const gated = String(formData.get('moduleGated') ?? '') === 'on';
  if (!gated) return { lockAddress: null, lockChainId: null };

  const lockAddress = String(formData.get('lockAddress') ?? '').trim();
  const lockChainId = Number(formData.get('lockChainId') ?? 0);
  return { lockAddress, lockChainId };
}

export async function createModuleAction(
  courseId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const contentTypeRaw = String(formData.get('contentType') ?? 'article');
    const weight = Number(formData.get('weight') ?? 0);
    const isRequired = String(formData.get('isRequired') ?? 'on') === 'on';

    if (title.length < 2) return { ok: false, error: 'El título es requerido' };
    if (!(VALID_MODULE_TYPES as readonly string[]).includes(contentTypeRaw)) {
      return { ok: false, error: 'Tipo de contenido inválido' };
    }

    await meApi.createModule(t, courseId, {
      title,
      ...(description ? { description } : {}),
      contentType: contentTypeRaw as (typeof VALID_MODULE_TYPES)[number],
      weight: Math.max(0, Math.min(100, weight)),
      isRequired,
      ...moduleLockFields(formData),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear módulo' };
  }
}

export async function updateModuleAction(
  courseId: string,
  moduleId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const contentTypeRaw = String(formData.get('contentType') ?? 'article');
    const weight = Number(formData.get('weight') ?? 0);
    const isRequired = String(formData.get('isRequired') ?? '') === 'on';
    if (title.length < 2) return { ok: false, error: 'El título es requerido' };
    if (!(VALID_MODULE_TYPES as readonly string[]).includes(contentTypeRaw)) {
      return { ok: false, error: 'Tipo de contenido inválido' };
    }
    await meApi.updateModule(t, courseId, moduleId, {
      title,
      description: description || undefined,
      contentType: contentTypeRaw as (typeof VALID_MODULE_TYPES)[number],
      weight: Math.max(0, Math.min(100, weight)),
      isRequired,
      ...moduleLockFields(formData),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al actualizar módulo',
    };
  }
}

export async function deleteModuleAction(
  courseId: string,
  moduleId: string,
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteModule(t, courseId, moduleId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al eliminar módulo' };
  }
}

export async function reorderModulesAction(
  courseId: string,
  order: string[],
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.reorderModules(t, courseId, order);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al reordenar' };
  }
}

// ─── Asignar docentes a curso ─────────────────────────────────────────────────
export async function assignCourseTeacherAction(
  courseId: string,
  userId: string,
  assignmentRole: 'owner' | 'assistant' = 'owner',
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.assignCourseTeacher(t, courseId, { userId, assignmentRole });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al asignar docente' };
  }
}

export async function unassignCourseTeacherAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.unassignCourseTeacher(t, courseId, assignmentId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al desasignar' };
  }
}

// ─── Inscripciones ────────────────────────────────────────────────────────────
export async function enrollStudentAction(
  courseId: string,
  formData: FormData,
): Promise<ActionResult<{ enrollmentId: string }>> {
  try {
    const t = await token();
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();
    const name = String(formData.get('name') ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Email inválido' };
    }
    const created = await meApi.enrollStudent(t, courseId, {
      email,
      ...(name ? { name } : {}),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true, data: { enrollmentId: created.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al inscribir estudiante',
    };
  }
}

export async function removeEnrollmentAction(
  courseId: string,
  enrollmentId: string,
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.removeEnrollment(t, courseId, enrollmentId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al cancelar inscripción',
    };
  }
}

export async function getEnrollmentProgressAction(courseId: string, enrollmentId: string) {
  try {
    const t = await token();
    const data = await meApi.getEnrollmentProgress(t, courseId, enrollmentId);
    return { ok: true as const, data };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof ApiError ? err.message : 'Error al cargar avance',
    };
  }
}

export async function setModuleProgressAction(
  courseId: string,
  enrollmentId: string,
  moduleId: string,
  status: 'not_started' | 'in_progress' | 'completed',
  score?: number,
  note?: string,
): Promise<ActionResult<{ enrollmentCompleted: boolean; finalScore: number | null }>> {
  try {
    const t = await token();
    const result = await meApi.updateModuleProgress(t, courseId, enrollmentId, moduleId, {
      status,
      ...(typeof score === 'number' ? { score } : {}),
      ...(note ? { note } : {}),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return {
      ok: true,
      data: { enrollmentCompleted: result.enrollmentCompleted, finalScore: result.finalScore },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al actualizar avance',
    };
  }
}

// ─── Badge collections ─────────────────────────────────────────────────────────
export async function createBadgeCollectionAction(formData: FormData): Promise<ActionResult> {
  try {
    const t = await token();
    const name = String(formData.get('name') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const imageUrl = String(formData.get('imageUrl') ?? '').trim();
    const maxSupplyRaw = formData.get('maxSupply');
    const maxSupply = maxSupplyRaw ? Number(maxSupplyRaw) : undefined;

    if (name.length < 2) return { ok: false, error: 'El nombre es requerido' };

    await meApi.createBadgeCollection(t, {
      name,
      ...(description ? { description } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(maxSupply && Number.isFinite(maxSupply) ? { maxSupply } : {}),
    });
    revalidatePath('/institution/badges');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear colección' };
  }
}

// ─── Templates ─────────────────────────────────────────────────────────────────
export async function createTemplateAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const t = await token();
    const name = String(formData.get('name') ?? '').trim();
    const backgroundUrl = String(formData.get('backgroundUrl') ?? '').trim();
    const layout = parseTemplateLayout(formData.get('layout'));
    if (name.length < 2) return { ok: false, error: 'El nombre es requerido' };
    const row = await meApi.createTemplate(t, {
      name,
      ...(backgroundUrl ? { backgroundUrl } : {}),
      ...(layout ? { layout } : {}),
    });
    revalidatePath('/institution/templates');
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear plantilla' };
  }
}

export async function updateTemplateAction(
  templateId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const t = await token();
    const name = String(formData.get('name') ?? '').trim();
    const backgroundUrl = String(formData.get('backgroundUrl') ?? '').trim();
    const layout = parseTemplateLayout(formData.get('layout'));
    if (name.length < 2) return { ok: false, error: 'El nombre es requerido' };
    const row = await meApi.updateTemplate(t, templateId, {
      name,
      ...(backgroundUrl ? { backgroundUrl } : {}),
      ...(layout ? { layout } : {}),
    });
    revalidatePath('/institution/templates');
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al actualizar plantilla',
    };
  }
}

export async function deleteTemplateAction(templateId: string): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteTemplate(t, templateId);
    revalidatePath('/institution/templates');
    revalidatePath('/institution/certificates/new');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al eliminar plantilla',
    };
  }
}

function parseTemplateLayout(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ─── Equipo ────────────────────────────────────────────────────────────────────
const VALID_MEMBER_ROLES = ['admin', 'teacher', 'reviewer'] as const;
type MemberRole = (typeof VALID_MEMBER_ROLES)[number];

export async function inviteTeamMemberAction(formData: FormData): Promise<
  ActionResult<{
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
  }>
> {
  try {
    const t = await token();
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();
    const memberRoleRaw = String(formData.get('memberRole') ?? 'teacher').trim();
    const courseId = String(formData.get('courseId') ?? '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: 'Email inválido' };
    }
    if (!(VALID_MEMBER_ROLES as readonly string[]).includes(memberRoleRaw)) {
      return { ok: false, error: 'Rol inválido' };
    }
    const memberRole = memberRoleRaw as MemberRole;

    const created = await meApi.inviteTeamMember(t, {
      email,
      memberRole,
      ...(courseId ? { courseId } : {}),
    });
    revalidatePath('/institution/team');
    if (courseId) revalidatePath(`/institution/courses/${courseId}`);
    return {
      ok: true,
      data: {
        invitationId: created.invitationId,
        email: created.email,
        name: created.name,
        memberRole: created.memberRole,
        courseId: created.courseId,
        courseTitle: created.courseTitle,
        existingUser: created.existingUser,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
        inviteUrl: created.inviteUrl,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al invitar miembro' };
  }
}

export async function updateTeamMemberRoleAction(
  memberId: string,
  memberRole: MemberRole,
): Promise<ActionResult> {
  try {
    if (!(VALID_MEMBER_ROLES as readonly string[]).includes(memberRole)) {
      return { ok: false, error: 'Rol inválido' };
    }
    const t = await token();
    await meApi.updateTeamMember(t, memberId, { memberRole });
    revalidatePath('/institution/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al actualizar rol' };
  }
}

export async function removeTeamMemberAction(memberId: string): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.removeTeamMember(t, memberId);
    revalidatePath('/institution/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al quitar miembro' };
  }
}

// ─── Creditos ──────────────────────────────────────────────────────────────────
export async function buyCreditsAction(formData: FormData): Promise<
  ActionResult<{
    mode: 'stripe';
    checkoutUrl: string;
    paymentOrderId: string;
    providerOrderId: string;
  }>
> {
  try {
    const t = await token();
    const bundleCode = String(formData.get('bundleCode') ?? '').trim();
    if (!bundleCode) return { ok: false, error: 'Bundle inválido' };
    const result = await meApi.startCheckout(t, bundleCode);
    revalidatePath('/institution/credits');
    revalidatePath('/institution');
    return {
      ok: true,
      data: result,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al iniciar la compra',
    };
  }
}

const STRIPE_SUBSCRIPTION_PLAN_BY_UI_PLAN = {
  essential: 'essential',
  growth: 'growth',
  institutional: 'institutional',
  scale: 'scale',
} as const satisfies Record<string, SubscriptionPlanCode>;

export async function startSubscriptionCheckoutAction(
  formData: FormData,
): Promise<ActionResult<{ checkoutUrl: string; paymentOrderId: string; providerOrderId: string }>> {
  try {
    const targetPlan = String(formData.get('targetPlan') ?? '').trim();
    const planCode =
      STRIPE_SUBSCRIPTION_PLAN_BY_UI_PLAN[
        targetPlan as keyof typeof STRIPE_SUBSCRIPTION_PLAN_BY_UI_PLAN
      ];
    if (!planCode) return { ok: false, error: 'Este plan requiere coordinación comercial' };
    const result = await meApi.startSubscriptionCheckout(await token(), planCode);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al iniciar la suscripción',
    };
  }
}

export async function cancelSubscriptionAction(subscriptionId: string): Promise<ActionResult> {
  try {
    await meApi.cancelSubscription(await token(), subscriptionId);
    revalidatePath('/institution/plan');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al cancelar la suscripción',
    };
  }
}


// ─── Temarios ──────────────────────────────────────────────────────────────────
export async function createTopicAction(
  courseId: string,
  moduleId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const contentText = String(formData.get('content') ?? '').trim();
    if (title.length < 2) return { ok: false, error: 'El título es requerido' };
    await meApi.createTopic(t, moduleId, {
      title,
      ...(description ? { description } : {}),
      contentType: 'text',
      content: contentText ? { text: contentText } : null,
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear temario' };
  }
}

export async function updateTopicAction(
  courseId: string,
  topicId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const contentText = String(formData.get('content') ?? '').trim();
    if (title.length < 2) return { ok: false, error: 'El título es requerido' };
    await meApi.updateTopic(t, topicId, {
      title,
      description: description || null,
      content: contentText ? { text: contentText } : null,
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al actualizar temario',
    };
  }
}

export async function deleteTopicAction(courseId: string, topicId: string): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteTopic(t, topicId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al eliminar temario',
    };
  }
}

/**
 * Sube el material de un temario y su portada.
 *
 * Hasta ahora la API tenía la ruta y nadie podía llamarla: el formulario de
 * temario sólo ofrecía título, descripción y texto. Sin subida no hay portada,
 * sin portada no hay muro de pago, y toda la previsualización del material
 * bloqueado quedaba inalcanzable desde el producto.
 *
 * Los archivos llegan como `File` dentro del FormData y se convierten a base64
 * aquí, en el servidor, y no en el navegador: así el archivo no se duplica en
 * memoria del cliente ni pasa por el estado de React.
 */
export async function uploadTopicMaterialAction(
  courseId: string,
  topicId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();

    const file = formData.get('material');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: 'Elegí el archivo del material.' };
    }

    // El tipo se valida también en la API, que es donde manda. Aquí se
    // comprueba antes para no subir megas por la red y recibir el rechazo
    // después.
    const kind = materialKindOf(file.type);
    if (!kind) {
      return { ok: false, error: 'El material debe ser un vídeo, un audio o un PDF.' };
    }
    if (file.size > MAX_MATERIAL_BYTES) {
      return {
        ok: false,
        error: `El archivo pesa ${formatMegabytes(file.size)}. El máximo es ${formatMegabytes(MAX_MATERIAL_BYTES)}.`,
      };
    }

    const body: TopicMaterialBody = {
      data: await fileToBase64(file),
      mimeType: file.type,
    };

    // Portada: obligatoria en la práctica para vídeo y audio, porque es lo
    // único que ve quien no tiene llave. De un PDF se deriva sola en el
    // servidor, así que ahí es opcional de verdad.
    const cover = formData.get('cover');
    if (cover instanceof File && cover.size > 0) {
      if (!COVER_MIME_TYPES.includes(cover.type)) {
        return { ok: false, error: 'La portada debe ser JPEG, PNG, WebP o AVIF.' };
      }
      if (cover.size > MAX_COVER_BYTES) {
        return {
          ok: false,
          error: `La portada pesa ${formatMegabytes(cover.size)}. El máximo es ${formatMegabytes(MAX_COVER_BYTES)}.`,
        };
      }
      body.cover = await fileToBase64(cover);
      body.coverMimeType = cover.type;
    } else if (kind !== 'document') {
      return {
        ok: false,
        error: 'Subí una portada: es lo único que ve quien todavía no tiene la membresía.',
      };
    }

    const preview = formData.get('preview');
    if (preview instanceof File && preview.size > 0) {
      if (preview.size > MAX_MATERIAL_BYTES) {
        return { ok: false, error: 'La muestra pesa demasiado.' };
      }
      body.preview = await fileToBase64(preview);
    }

    const durationRaw = String(formData.get('durationSeconds') ?? '').trim();
    if (durationRaw) {
      const duration = Number(durationRaw);
      if (Number.isFinite(duration) && duration > 0) {
        body.durationSeconds = Math.round(duration);
      }
    }

    await meApi.uploadTopicMaterial(t, topicId, body);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al subir el material',
    };
  }
}

export async function deleteTopicMaterialAction(
  courseId: string,
  topicId: string,
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteTopicMaterial(t, topicId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al quitar el material',
    };
  }
}

/** Tope del material. Coincide con el límite propio de esa ruta en la API. */
const MAX_MATERIAL_BYTES = 64 * 1024 * 1024;
/** Tope de la portada. Es una imagen: más que esto es un original sin reducir. */
const MAX_COVER_BYTES = 12 * 1024 * 1024;

const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Misma clasificación que hace la API, para avisar antes de subir. */
function materialKindOf(mimeType: string): 'video' | 'audio' | 'document' | null {
  const mime = mimeType.toLowerCase().trim();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';
  return null;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function fileToBase64(file: File): Promise<string> {
  return Buffer.from(await file.arrayBuffer()).toString('base64');
}

// ─── Evaluaciones ──────────────────────────────────────────────────────────────
const VALID_ASSESSMENT_TYPES = ['multiple_choice', 'true_false', 'essay'] as const;

export async function createAssessmentAction(
  courseId: string,
  moduleId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const t = await token();
    const type = String(formData.get('type') ?? '');
    if (!(VALID_ASSESSMENT_TYPES as readonly string[]).includes(type)) {
      return { ok: false, error: 'Tipo de evaluación inválido' };
    }
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const weight = Number(formData.get('weight') ?? 0);
    const maxScore = Number(formData.get('maxScore') ?? 100);
    const passingScore = Number(formData.get('passingScore') ?? 60);
    const attemptsAllowed = Number(formData.get('attemptsAllowed') ?? 1);
    const timeLimitRaw = String(formData.get('timeLimitMin') ?? '').trim();
    const timeLimitMin = timeLimitRaw ? Number(timeLimitRaw) : null;
    const topicIdRaw = String(formData.get('topicId') ?? '').trim();
    if (title.length < 2) return { ok: false, error: 'El título es requerido' };
    const created = await meApi.createAssessment(t, moduleId, {
      type: type as (typeof VALID_ASSESSMENT_TYPES)[number],
      scope: topicIdRaw ? 'topic' : 'module',
      topicId: topicIdRaw || null,
      title,
      ...(description ? { description } : {}),
      weight: Math.max(0, Math.min(100, weight)),
      maxScore: Math.max(1, Math.min(1000, maxScore)),
      passingScore: Math.max(0, Math.min(100, passingScore)),
      attemptsAllowed: Math.max(1, Math.min(10, attemptsAllowed)),
      timeLimitMin:
        timeLimitMin == null || Number.isNaN(timeLimitMin)
          ? null
          : Math.max(1, Math.min(600, timeLimitMin)),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true, data: { id: created.data.id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al crear evaluación',
    };
  }
}

export async function updateAssessmentAction(
  courseId: string,
  assessmentId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const t = await token();
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const weight = Number(formData.get('weight') ?? 0);
    const maxScore = Number(formData.get('maxScore') ?? 100);
    const passingScore = Number(formData.get('passingScore') ?? 60);
    const attemptsAllowed = Number(formData.get('attemptsAllowed') ?? 1);
    const timeLimitRaw = String(formData.get('timeLimitMin') ?? '').trim();
    const timeLimitMin = timeLimitRaw ? Number(timeLimitRaw) : null;
    if (title.length < 2) return { ok: false, error: 'El título es requerido' };
    await meApi.updateAssessment(t, assessmentId, {
      title,
      description: description || null,
      weight: Math.max(0, Math.min(100, weight)),
      maxScore: Math.max(1, Math.min(1000, maxScore)),
      passingScore: Math.max(0, Math.min(100, passingScore)),
      attemptsAllowed: Math.max(1, Math.min(10, attemptsAllowed)),
      timeLimitMin:
        timeLimitMin == null || Number.isNaN(timeLimitMin)
          ? null
          : Math.max(1, Math.min(600, timeLimitMin)),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al actualizar evaluación',
    };
  }
}

export async function deleteAssessmentAction(
  courseId: string,
  assessmentId: string,
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteAssessment(t, assessmentId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al eliminar evaluación',
    };
  }
}

export async function createQuestionAction(
  courseId: string,
  assessmentId: string,
  payload: {
    prompt: string;
    kind: 'single' | 'boolean' | 'text';
    options?: Array<{ id: string; label: string }>;
    correctAnswer?: unknown;
    points?: number;
  },
): Promise<ActionResult> {
  try {
    const t = await token();
    if (!payload.prompt || payload.prompt.trim().length < 2) {
      return { ok: false, error: 'El enunciado es requerido' };
    }
    await meApi.createQuestion(t, assessmentId, {
      prompt: payload.prompt.trim(),
      kind: payload.kind,
      options: payload.options ?? null,
      correctAnswer: payload.correctAnswer ?? null,
      points: Math.max(1, Math.min(100, payload.points ?? 1)),
    });
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiError ? err.message : 'Error al crear pregunta' };
  }
}

export async function deleteQuestionAction(
  courseId: string,
  questionId: string,
): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.deleteQuestion(t, questionId);
    revalidatePath(`/institution/courses/${courseId}`);
    revalidatePath(`/teacher/courses/${courseId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al eliminar pregunta',
    };
  }
}

/**
 * Lee un Lock contra la cadena, sin guardar nada.
 *
 * Es lo que permite que la pantalla muestre qué es ese contrato —precio,
 * duración, dueño, llaves vendidas— antes de que la institución confirme.
 * Hasta ahora pegar una dirección era un acto de fe: la tarjeta decía
 * "configurado" sin haber leído una sola función del Lock, así que una
 * dirección con la forma correcta pero inexistente dejaba el curso imposible
 * de matricular sin que nadie se enterara.
 */
export async function verifyLockAction(input: {
  lockAddress: string;
  lockChainId: number;
}): Promise<ActionResult<LockVerification>> {
  try {
    const t = await token();
    const res = await meApi.verifyLock(t, input);
    return { ok: true, data: res.data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'No se pudo leer el Lock',
    };
  }
}

/**
 * Guarda (o quita) el Lock por defecto de la institución.
 *
 * Se configura una vez y lo heredan los cursos con membresía y el portal, para
 * no tener que pegar la dirección en cada uno. Pasar ambos campos en null lo
 * desconfigura; la API exige que vayan siempre juntos.
 */
export async function saveDefaultLockAction(input: {
  lockAddress: string | null;
  lockChainId: number | null;
}): Promise<ActionResult> {
  try {
    const t = await token();
    await meApi.updateInstitution(t, {
      defaultLockAddress: input.lockAddress,
      defaultLockChainId: input.lockChainId,
    });
    // El valor se propone en los formularios de curso y de portal, así que
    // ambos deben rehacerse tras el cambio.
    revalidatePath('/institution/portal');
    revalidatePath('/institution/courses');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.message : 'Error al guardar el Lock',
    };
  }
}
