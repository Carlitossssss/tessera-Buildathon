import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import argon2 from 'argon2';
import { and, eq, gte, isNull } from '@tessera/db';
import { schema } from '@tessera/db';
import { getDb } from '../../lib/db.js';
import { env } from '../../config/env.js';
import { errors } from '@tessera/shared/errors';
import { sendEmail } from '../../services/email.js';
import { provisionCustodialWallet } from '../../services/custodial-wallet.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const registerSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
    name: z.string().min(2).max(200).optional(),
    fullName: z.string().min(2).max(200).optional(),
    institutionName: z.string().min(2).max(200).optional(),
    plan: z.enum(['starter', 'pro', 'pro_extended']).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.name && !value.fullName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fullName'],
        message: 'El nombre es requerido',
      });
    }
  });

const pendingRegistrationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('student'),
    email: z.string().email(),
    fullName: z.string().min(2).max(200),
    passwordHash: z.string().min(1),
  }),
  z.object({
    kind: z.literal('institution'),
    email: z.string().email(),
    fullName: z.string().min(2).max(200),
    passwordHash: z.string().min(1),
    institutionName: z.string().min(2).max(200),
    plan: z.enum(['starter', 'pro', 'pro_extended']),
  }),
]);

const teacherInviteRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  password: z.string().min(8).max(128),
});

const userProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(120),
  lastName: z.string().trim().min(2).max(120),
  documentType: z.string().trim().min(2).max(40),
  documentNumber: z.string().trim().min(2).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(60)
    .regex(/^\+?[0-9\s().-]{6,60}$/),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  city: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(2).max(240),
});

function validateBirthDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  return date <= today;
}

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.com.ar',
  'yahoo.com.mx',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'fastmail.com',
  'hey.com',
  'tutanota.com',
  'tuta.io',
  'yandex.com',
  'yandex.ru',
  'outlook.es',
  'hotmail.es',
  'hotmail.com.ar',
  'live.com.ar',
]);

function isInstitutionalEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && domain.includes('.') && !PERSONAL_EMAIL_DOMAINS.has(domain));
}

function createInstitutionSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 84);

  const suffix = randomBytes(3).toString('hex');
  return `${base || 'institucion'}-${suffix}`;
}

/**
 * Wallet emisora de una institucion.
 *
 * Antes devolvia randomBytes(20): una direccion con forma valida pero sin
 * clave privada detras, que nadie podia controlar. Eso rompia dos cosas que no
 * fallaban al crear la cuenta sino mucho despues:
 *
 *  - approveInstitutionOnchain la registra en TesseraRegistry, dejando
 *    aprobada on-chain una direccion inexistente.
 *  - mirrorCertificate la usa como emisor al replicar certificados.
 *
 * Ahora es una wallet custodiada de verdad: la clave se genera y se guarda en
 * OpenBao, igual que la de un estudiante. La institucion puede reclamarla
 * despues; la direccion aprobada corresponde a una llave que existe.
 */
async function createInstitutionIssuerWallet(): Promise<string> {
  return provisionCustodialWallet();
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? fullName.trim(), lastName: null };
  }
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(' '),
  };
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createEmailCode() {
  return randomBytes(3).readUIntBE(0, 3).toString().padStart(8, '0').slice(0, 6);
}

function durationMs(value: string) {
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 4 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = (match[2] ?? 'ms').toLowerCase();
  const multiplier =
    unit === 'd'
      ? 24 * 60 * 60 * 1000
      : unit === 'h'
        ? 60 * 60 * 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 's'
            ? 1000
            : 1;
  return amount * multiplier;
}

async function buildSessionPayload(
  app: FastifyInstance,
  user: {
    id: string;
    email: string;
    role: 'admin' | 'institution_admin' | 'teacher' | 'student' | 'api_client';
    restricted: boolean;
    restrictedAt: Date | null;
  },
) {
  const db = getDb();
  let restrictionReason: string | null = null;
  try {
    const [restriction] = await db
      .select({ reason: schema.users.restrictionReason })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1);
    restrictionReason = restriction?.reason ?? null;
  } catch {
    restrictionReason = null;
  }

  const membership =
    user.role === 'institution_admin' || user.role === 'teacher'
      ? await db.query.institutionMembers.findFirst({
          where: eq(schema.institutionMembers.userId, user.id),
        })
      : null;
  const institutionId = membership?.institutionId ?? null;
  const tokenExpiresAt = new Date(Date.now() + durationMs(env.JWT_EXPIRES_IN));
  const token = app.jwt.sign(
    { sub: user.id, role: user.role, email: user.email, institutionId },
    {
      expiresIn: env.JWT_EXPIRES_IN,
      iss: env.AUTH_URL,
      aud: env.API_PUBLIC_URL,
      algorithm: 'HS256',
    },
  );
  return {
    token,
    tokenExpiresAt: tokenExpiresAt.toISOString(),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      institutionId,
      restricted: user.restricted,
      restrictedAt: user.restrictedAt,
      restrictionReason,
    },
  };
}

async function sendVerificationCode(
  email: string,
  payload?: z.infer<typeof pendingRegistrationSchema>,
) {
  const db = getDb();
  const code = createEmailCode();
  const normalizedEmail = email.toLowerCase();
  const expiresAt = new Date(Date.now() + 12 * 60 * 1000);
  await db
    .update(schema.verificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.verificationTokens.identifier, normalizedEmail),
        eq(schema.verificationTokens.purpose, 'registration_email_verification'),
        isNull(schema.verificationTokens.consumedAt),
      ),
    );
  await db.insert(schema.verificationTokens).values({
    identifier: normalizedEmail,
    tokenHash: hashToken(code),
    purpose: payload ? 'registration_email_verification' : 'email_verification',
    payload,
    expiresAt,
  });
  await sendEmail({
    to: email,
    subject: 'Tu código de verificación Tessera',
    text: `Tu código de verificación Tessera es ${code}. Expira en 12 minutos.`,
    html: `<p>Tu código de verificación Tessera es <strong>${code}</strong>.</p><p>Expira en 12 minutos.</p>`,
    tags: { type: 'email_verification' },
  });
  return expiresAt;
}

export default async function authRoutes(app: FastifyInstance) {
  app.get(
    '/v1/auth/team-invitations/:token',
    {
      preHandler: [app.rateLimit({ max: 20, timeWindow: 60 * 1000 })],
      schema: {
        tags: ['Auth'],
        description: 'Devuelve los datos públicos de una invitación al equipo académico.',
      },
    },
    async (req) => {
      const { token } = req.params as { token: string };
      const db = getDb();
      const invitation = await db.query.teamInvitations.findFirst({
        where: and(
          eq(schema.teamInvitations.tokenHash, hashToken(token)),
          gte(schema.teamInvitations.expiresAt, new Date()),
        ),
      });
      if (!invitation) throw errors.notFound('Invitación no encontrada o expirada');

      const [institution, course, user] = await Promise.all([
        db.query.institutions.findFirst({
          columns: { id: true, name: true, slug: true },
          where: eq(schema.institutions.id, invitation.institutionId),
        }),
        invitation.courseId
          ? db.query.courses.findFirst({
              columns: { id: true, title: true, slug: true },
              where: eq(schema.courses.id, invitation.courseId),
            })
          : null,
        db.query.users.findFirst({
          columns: { id: true, email: true, role: true },
          where: eq(schema.users.email, invitation.email),
        }),
      ]);

      const roleAllowed = !user || user.role === 'teacher' || user.role === 'institution_admin';
      return {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        memberRole: invitation.memberRole,
        expiresAt: invitation.expiresAt,
        existingUser: Boolean(user),
        roleAllowed,
        institution,
        course,
      };
    },
  );

  app.post(
    '/v1/auth/team-invitations/:token/register',
    {
      preHandler: [app.rateLimit({ max: 5, timeWindow: 12 * 60 * 1000 })],
      schema: {
        tags: ['Auth'],
        body: teacherInviteRegisterSchema,
        description: 'Crea una cuenta de equipo académico desde una invitación por email.',
      },
    },
    async (req, reply) => {
      const { token } = req.params as { token: string };
      const body = teacherInviteRegisterSchema.parse(req.body);
      const db = getDb();
      const invitation = await db.query.teamInvitations.findFirst({
        where: and(
          eq(schema.teamInvitations.tokenHash, hashToken(token)),
          gte(schema.teamInvitations.expiresAt, new Date()),
        ),
      });
      if (!invitation) throw errors.notFound('Invitación no encontrada o expirada');

      const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, invitation.email),
      });
      if (existing) {
        throw errors.conflict('Esta cuenta ya existe. Inicia sesión para aceptar la invitación.');
      }

      const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id });
      const profileName = splitFullName(body.fullName);
      const walletAddress = await provisionCustodialWallet();
      const created = await db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values({
            email: invitation.email,
            name: body.fullName,
            passwordHash,
            role: 'teacher',
            walletAddress,
            emailVerifiedAt: new Date(),
          })
          .returning();

        await tx.insert(schema.userProfiles).values({
          userId: user!.id,
          firstName: profileName.firstName,
          lastName: profileName.lastName,
          status: 'incomplete',
        });

        const [membership] = await tx
          .insert(schema.institutionMembers)
          .values({
            institutionId: invitation.institutionId,
            userId: user!.id,
            memberRole: invitation.memberRole,
          })
          .returning();

        let courseAssignmentId: string | null = null;
        if (invitation.courseId) {
          const [assignment] = await tx
            .insert(schema.courseTeachers)
            .values({
              courseId: invitation.courseId,
              userId: user!.id,
              assignmentRole: invitation.memberRole === 'reviewer' ? 'assistant' : 'owner',
            })
            .returning();
          courseAssignmentId = assignment?.id ?? null;
        }

        await tx
          .update(schema.teamInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(schema.teamInvitations.id, invitation.id));

        return {
          id: user!.id,
          email: user!.email,
          name: user!.name,
          role: user!.role,
          institutionId: invitation.institutionId,
          memberId: membership!.id,
          courseId: invitation.courseId,
          courseAssignmentId,
        };
      });

      reply.status(201);
      return created;
    },
  );

  app.post(
    '/v1/auth/team-invitations/:token/accept',
    {
      preHandler: [
        app.requireAuth(['teacher', 'institution_admin']),
        app.rateLimit({ max: 10, timeWindow: 60 * 1000 }),
      ],
      schema: {
        tags: ['Auth'],
        description: 'Acepta una invitación al equipo académico con una cuenta existente.',
      },
    },
    async (req) => {
      const { token } = req.params as { token: string };
      const db = getDb();
      const invitation = await db.query.teamInvitations.findFirst({
        where: and(
          eq(schema.teamInvitations.tokenHash, hashToken(token)),
          gte(schema.teamInvitations.expiresAt, new Date()),
        ),
      });
      if (!invitation) throw errors.notFound('Invitación no encontrada o expirada');
      if (invitation.email !== req.auth!.email.toLowerCase()) {
        throw errors.forbidden('La invitación pertenece a otro email');
      }

      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, req.auth!.userId),
      });
      if (!user || (user.role !== 'teacher' && user.role !== 'institution_admin')) {
        throw errors.conflict('Esta cuenta no puede aceptar invitaciones del equipo académico');
      }
      const walletAddress = user.walletAddress ?? (await provisionCustodialWallet());

      if (invitation.courseId) {
        const course = await db.query.courses.findFirst({
          columns: { id: true },
          where: and(
            eq(schema.courses.id, invitation.courseId),
            eq(schema.courses.institutionId, invitation.institutionId),
          ),
        });
        if (!course) throw errors.notFound('Curso invitado no encontrado');
      }

      if (invitation.acceptedAt) {
        const repaired = await db.transaction(async (tx) => {
          if (!user.walletAddress) {
            await tx
              .update(schema.users)
              .set({ walletAddress, updatedAt: new Date() })
              .where(eq(schema.users.id, user.id));
          }
          const existingMembership = await tx.query.institutionMembers.findFirst({
            where: and(
              eq(schema.institutionMembers.institutionId, invitation.institutionId),
              eq(schema.institutionMembers.userId, user.id),
            ),
          });
          const membership =
            existingMembership ??
            (
              await tx
                .insert(schema.institutionMembers)
                .values({
                  institutionId: invitation.institutionId,
                  userId: user.id,
                  memberRole: invitation.memberRole,
                })
                .returning()
            )[0]!;

          let assignmentId: string | null = null;
          if (invitation.courseId) {
            const existingAssignment = await tx.query.courseTeachers.findFirst({
              where: and(
                eq(schema.courseTeachers.courseId, invitation.courseId),
                eq(schema.courseTeachers.userId, user.id),
              ),
            });
            if (existingAssignment) {
              assignmentId = existingAssignment.id;
            } else {
              const [assignment] = await tx
                .insert(schema.courseTeachers)
                .values({
                  courseId: invitation.courseId,
                  userId: user.id,
                  assignmentRole: invitation.memberRole === 'reviewer' ? 'assistant' : 'owner',
                })
                .returning();
              assignmentId = assignment?.id ?? null;
            }
          }

          return { memberId: membership.id, courseAssignmentId: assignmentId };
        });
        return {
          institutionId: invitation.institutionId,
          memberId: repaired.memberId,
          courseId: invitation.courseId,
          courseAssignmentId: repaired.courseAssignmentId,
          alreadyAccepted: true,
        };
      }

      const accepted = await db.transaction(async (tx) => {
        if (!user.walletAddress) {
          await tx
            .update(schema.users)
            .set({ walletAddress, updatedAt: new Date() })
            .where(eq(schema.users.id, user.id));
        }
        const existingMembership = await tx.query.institutionMembers.findFirst({
          where: and(
            eq(schema.institutionMembers.institutionId, invitation.institutionId),
            eq(schema.institutionMembers.userId, user.id),
          ),
        });

        const membership =
          existingMembership ??
          (
            await tx
              .insert(schema.institutionMembers)
              .values({
                institutionId: invitation.institutionId,
                userId: user.id,
                memberRole: invitation.memberRole,
              })
              .returning()
          )[0]!;

        let courseAssignmentId: string | null = null;
        if (invitation.courseId) {
          const existingAssignment = await tx.query.courseTeachers.findFirst({
            where: and(
              eq(schema.courseTeachers.courseId, invitation.courseId),
              eq(schema.courseTeachers.userId, user.id),
            ),
          });
          if (!existingAssignment) {
            const [assignment] = await tx
              .insert(schema.courseTeachers)
              .values({
                courseId: invitation.courseId,
                userId: user.id,
                assignmentRole: invitation.memberRole === 'reviewer' ? 'assistant' : 'owner',
              })
              .returning();
            courseAssignmentId = assignment?.id ?? null;
          } else {
            courseAssignmentId = existingAssignment.id;
          }
        }

        await tx
          .update(schema.teamInvitations)
          .set({ acceptedAt: new Date() })
          .where(eq(schema.teamInvitations.id, invitation.id));

        return {
          institutionId: invitation.institutionId,
          memberId: membership.id,
          courseId: invitation.courseId,
          courseAssignmentId,
        };
      });

      return accepted;
    },
  );

  app.post(
    '/v1/auth/register',
    {
      preHandler: [
        app.rateLimit({
          max: 5,
          timeWindow: 12 * 60 * 1000,
          keyGenerator: (req) => `auth:${req.ip}`,
        }),
      ],
      schema: {
        description: 'Registra un nuevo usuario estudiante',
        tags: ['Auth'],
        body: registerSchema,
      },
    },
    async (req) => {
      const { email, password, name, fullName, institutionName, plan } = registerSchema.parse(
        req.body,
      );
      const normalizedEmail = email.toLowerCase();
      const resolvedName = name ?? fullName!;
      const db = getDb();

      const existing = await db.query.users.findFirst({
        columns: { id: true },
        where: eq(schema.users.email, normalizedEmail),
      });
      if (existing) throw errors.conflict('El email ya esta registrado');

      if (institutionName) {
        if (!isInstitutionalEmail(email)) {
          throw errors.validation({
            email: ['Usa un email institucional para crear un workspace.'],
          });
        }
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const payload = pendingRegistrationSchema.parse(
        institutionName
          ? {
              kind: 'institution',
              email: normalizedEmail,
              fullName: resolvedName,
              passwordHash,
              institutionName,
              plan: plan ?? 'starter',
            }
          : {
              kind: 'student',
              email: normalizedEmail,
              fullName: resolvedName,
              passwordHash,
            },
      );

      const expiresAt = await sendVerificationCode(normalizedEmail, payload);

      return {
        pendingVerification: true,
        email: normalizedEmail,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  app.post(
    '/v1/auth/verify-email',
    {
      preHandler: [app.rateLimit({ max: 8, timeWindow: 15 * 60 * 1000 })],
      schema: {
        description: 'Verifica un email usando el código enviado por Resend.',
        tags: ['Auth'],
        body: z.object({
          email: z.string().trim().email(),
          code: z.string().regex(/^\d{6}$/),
        }),
      },
    },
    async (req) => {
      const { email, code } = z
        .object({ email: z.string().trim().email(), code: z.string().regex(/^\d{6}$/) })
        .parse(req.body);
      const db = getDb();
      const normalizedEmail = email.toLowerCase();
      const registrationToken = await db.query.verificationTokens.findFirst({
        where: and(
          eq(schema.verificationTokens.identifier, normalizedEmail),
          eq(schema.verificationTokens.tokenHash, hashToken(code)),
          eq(schema.verificationTokens.purpose, 'registration_email_verification'),
          isNull(schema.verificationTokens.consumedAt),
          gte(schema.verificationTokens.expiresAt, new Date()),
        ),
      });

      if (registrationToken) {
        const payloadResult = pendingRegistrationSchema.safeParse(registrationToken.payload);
        if (!payloadResult.success || payloadResult.data.email !== normalizedEmail) {
          throw errors.badRequest('Código inválido o expirado');
        }

        const existing = await db.query.users.findFirst({
          columns: { id: true },
          where: eq(schema.users.email, normalizedEmail),
        });
        if (existing) throw errors.conflict('El email ya esta registrado');

        const payload = payloadResult.data;
        if (payload.kind === 'institution' && !isInstitutionalEmail(payload.email)) {
          throw errors.validation({
            email: ['Usa un email institucional para crear un workspace.'],
          });
        }
        // Las wallets se provisionan ANTES de abrir la transaccion: crearlas
        // dentro mantendria abierta la conexion mientras se escribe en
        // OpenBao, y un fallo alli dejaria la transaccion colgada.
        const studentWallet =
          payload.kind === 'student' ? await provisionCustodialWallet() : undefined;
        const institutionWallet =
          payload.kind === 'institution' ? await createInstitutionIssuerWallet() : undefined;

        const created = await db.transaction(async (tx) => {
          await tx
            .update(schema.verificationTokens)
            .set({ consumedAt: new Date() })
            .where(eq(schema.verificationTokens.id, registrationToken.id));

          if (payload.kind === 'institution') {
            const [institution] = await tx
              .insert(schema.institutions)
              .values({
                name: payload.institutionName,
                slug: createInstitutionSlug(payload.institutionName),
                walletAddress: institutionWallet!,
                status: 'pending',
                plan: payload.plan,
              })
              .returning();

            const [user] = await tx
              .insert(schema.users)
              .values({
                email: payload.email,
                name: payload.fullName,
                passwordHash: payload.passwordHash,
                role: 'institution_admin',
                emailVerifiedAt: new Date(),
              })
              .returning();

            await tx.insert(schema.institutionMembers).values({
              institutionId: institution!.id,
              userId: user!.id,
              memberRole: 'admin',
            });

            return {
              id: user!.id,
              email: user!.email,
              name: user!.name,
              role: user!.role,
              institutionId: institution!.id,
            };
          }

          const [user] = await tx
            .insert(schema.users)
            .values({
              email: payload.email,
              name: payload.fullName,
              passwordHash: payload.passwordHash,
              role: 'student',
              walletAddress: studentWallet,
              emailVerifiedAt: new Date(),
            })
            .returning();

          const profileName = splitFullName(payload.fullName);
          await tx.insert(schema.userProfiles).values({
            userId: user!.id,
            firstName: profileName.firstName,
            lastName: profileName.lastName,
            status: 'incomplete',
          });

          return {
            id: user!.id,
            email: user!.email,
            name: user!.name,
            role: user!.role,
            institutionId: null,
          };
        });

        return { ok: true, created: true, ...created };
      }

      const token = await db.query.verificationTokens.findFirst({
        where: and(
          eq(schema.verificationTokens.identifier, normalizedEmail),
          eq(schema.verificationTokens.tokenHash, hashToken(code)),
          eq(schema.verificationTokens.purpose, 'email_verification'),
          isNull(schema.verificationTokens.consumedAt),
          gte(schema.verificationTokens.expiresAt, new Date()),
        ),
      });
      if (!token) throw errors.badRequest('Código inválido o expirado');

      await db
        .update(schema.verificationTokens)
        .set({ consumedAt: new Date() })
        .where(eq(schema.verificationTokens.id, token.id));
      await db
        .update(schema.users)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.users.email, normalizedEmail));

      return { ok: true, created: false };
    },
  );

  app.post(
    '/v1/auth/login',
    {
      preHandler: [
        app.rateLimit({
          max: 5,
          timeWindow: 12 * 60 * 1000,
          keyGenerator: (req) => `auth:${req.ip}`,
        }),
      ],
      schema: {
        description: 'Login del dashboard institucional. Devuelve JWT segun JWT_EXPIRES_IN.',
        tags: ['Public API', 'Auth'],
        body: loginSchema,
      },
    },
    async (req) => {
      const { email, password } = loginSchema.parse(req.body);
      const db = getDb();
      const user = await db.query.users.findFirst({
        columns: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
          restricted: true,
          restrictedAt: true,
        },
        where: eq(schema.users.email, email.toLowerCase()),
      });
      if (!user?.passwordHash) throw errors.unauthorized('Credenciales invalidas');
      const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
      if (!ok) throw errors.unauthorized('Credenciales invalidas');

      return buildSessionPayload(app, user);
    },
  );

  app.post(
    '/v1/auth/refresh',
    {
      preHandler: [app.requireAuth(), app.rateLimit({ max: 20, timeWindow: 60 * 1000 })],
      schema: {
        description: 'Renueva el JWT mientras el token actual todavia es valido.',
        tags: ['Public API', 'Auth'],
      },
    },
    async (req) => {
      const db = getDb();
      const user = await db.query.users.findFirst({
        columns: {
          id: true,
          email: true,
          role: true,
          restricted: true,
          restrictedAt: true,
          deletedAt: true,
        },
        where: eq(schema.users.id, req.auth!.userId),
      });
      if (!user || user.deletedAt) throw errors.unauthorized();
      return buildSessionPayload(app, user);
    },
  );

  app.post(
    '/v1/auth/restricted-appeal',
    {
      preHandler: [
        app.requireAuth(),
        app.rateLimit({ max: 1, timeWindow: 10 * 24 * 60 * 60 * 1000 }),
      ],
      schema: {
        tags: ['Public API', 'Auth'],
        description: 'Envia una solicitud de revision para una cuenta suspendida.',
        body: z.object({
          message: z.string().trim().min(20).max(2000),
        }),
      },
    },
    async (req) => {
      const { message } = z
        .object({ message: z.string().trim().min(20).max(2000) })
        .parse(req.body);
      const supportEmail = env.EMAIL_REPLY_TO || 'support@tessera.io';
      const suspendedAt = req.auth!.restrictedAt
        ? new Date(req.auth!.restrictedAt).toISOString()
        : 'No registrada';

      await sendEmail({
        to: supportEmail,
        subject: `Solicitud de revisión de cuenta suspendida: ${req.auth!.email}`,
        text: [
          `Usuario: ${req.auth!.email}`,
          `ID: ${req.auth!.userId}`,
          `Rol: ${req.auth!.role}`,
          `Suspendida: ${suspendedAt}`,
          `Motivo informado: ${req.auth!.restrictionReason ?? 'Sin motivo registrado'}`,
          '',
          'Justificación del usuario:',
          message,
        ].join('\n'),
        html: `
          <p><strong>Usuario:</strong> ${req.auth!.email}</p>
          <p><strong>ID:</strong> ${req.auth!.userId}</p>
          <p><strong>Rol:</strong> ${req.auth!.role}</p>
          <p><strong>Suspendida:</strong> ${suspendedAt}</p>
          <p><strong>Motivo informado:</strong> ${req.auth!.restrictionReason ?? 'Sin motivo registrado'}</p>
          <hr />
          <p><strong>Justificación del usuario:</strong></p>
          <p>${message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br />')}</p>
        `,
        tags: { type: 'restricted_appeal' },
      });

      await getDb().insert(schema.auditLog).values({
        actorType: 'user',
        actorId: req.auth!.userId,
        action: 'restricted_appeal.submitted',
        targetType: req.auth!.role === 'institution_admin' ? 'institution' : 'user',
        targetId: req.auth!.institutionId ?? req.auth!.userId,
        metadata: {
          email: req.auth!.email,
          role: req.auth!.role,
          institutionId: req.auth!.institutionId,
          supportEmail,
        },
      });

      return { ok: true };
    },
  );

  app.get(
    '/v1/auth/me',
    {
      preHandler: [app.requireAuth(), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Auth'],
        description: 'Devuelve la sesion actual a partir del JWT',
      },
    },
    async (req) => {
      const db = getDb();
      const profile =
        req.auth!.role === 'student' || req.auth!.role === 'teacher'
          ? await db.query.userProfiles.findFirst({
              where: eq(schema.userProfiles.userId, req.auth!.userId),
            })
          : null;
      return { user: { ...req.auth, profile } };
    },
  );

  app.patch(
    '/v1/auth/profile',
    {
      preHandler: [app.requireAuth(['student', 'teacher']), app.rateLimit()],
      schema: {
        tags: ['Public API', 'Auth'],
        description: 'Actualiza el perfil detallado de estudiantes y docentes.',
        body: userProfileSchema,
      },
    },
    async (req) => {
      const body = userProfileSchema.parse(req.body);
      if (!validateBirthDate(body.birthDate)) {
        throw errors.validation({ birthDate: ['La fecha de nacimiento no puede ser futura.'] });
      }
      const db = getDb();
      const now = new Date();
      const status = req.auth!.role === 'teacher' ? 'approved' : 'pending';
      const [profile] = await db
        .insert(schema.userProfiles)
        .values({
          userId: req.auth!.userId,
          ...body,
          status,
          profileCompletedAt: now,
          profileSubmittedAt: now,
          approvedAt: status === 'approved' ? now : null,
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.userProfiles.userId,
          set: {
            ...body,
            status,
            profileCompletedAt: now,
            profileSubmittedAt: now,
            approvedAt: status === 'approved' ? now : null,
            rejectedAt: null,
            rejectionReason: null,
            updatedAt: now,
          },
        })
        .returning();

      await db
        .update(schema.users)
        .set({ name: `${body.firstName} ${body.lastName}`, updatedAt: now })
        .where(eq(schema.users.id, req.auth!.userId));

      return { data: profile };
    },
  );
}
