import { z } from 'zod';

export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Direccion Ethereum invalida');

export const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Tx hash invalido');

export const emailSchema = z.string().email().toLowerCase();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const studentSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(200),
  externalId: z.string().max(200).optional(),
  walletAddress: ethereumAddressSchema.optional(),
});

export const achievementSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  grade: z.number().min(0).max(100).optional(),
  courseId: z.string().uuid().optional(),
  completedAt: z.string().datetime(),
});

export const issueCertificateSchema = z.object({
  student: studentSchema,
  achievement: achievementSchema,
  templateId: z.string().uuid().optional(),
  badgeCollectionId: z.string().uuid().optional(),
  callbackUrl: z.string().url().optional(),
  idempotencyKey: z.string().max(200).optional(),
});

export const revokeCertificateSchema = z.object({
  reason: z.enum([
    'fraud_detected',
    'incorrect_data',
    'duplicated',
    'institution_request',
    'student_request',
    'other',
  ]),
  reasonText: z.string().min(1).max(2000),
  publicReason: z.boolean().default(true),
});

export const verifyCertificateSchema = z
  .object({
    tokenId: z.string().optional(),
    txHash: txHashSchema.optional(),
    certificateId: z.string().uuid().optional(),
  })
  .refine((d) => d.tokenId || d.txHash || d.certificateId, {
    message: 'tokenId, txHash o certificateId es requerido',
  });

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
});

export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
