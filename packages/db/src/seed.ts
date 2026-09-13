import './load-env.js';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { createDb } from './client.js';
import * as schema from './schema/index.js';
import { randomBytes } from 'node:crypto';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://tessera:tessera@localhost:5432/tessera';

async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function main() {
  const db = createDb({ connectionString: DATABASE_URL });
  console.log('Seeding datos de ejemplo...');

  async function seedUser(values: typeof schema.users.$inferInsert) {
    const normalizedValues = { ...values, email: values.email.toLowerCase() };
    const [created] = await db
      .insert(schema.users)
      .values(normalizedValues)
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const updateValues: Partial<typeof schema.users.$inferInsert> = {
      name: normalizedValues.name,
      passwordHash: normalizedValues.passwordHash,
      role: normalizedValues.role,
      emailVerifiedAt: normalizedValues.emailVerifiedAt,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(schema.users)
      .set(updateValues)
      .where(eq(schema.users.email, normalizedValues.email))
      .returning();
    if (updated) return updated;

    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedValues.email))
      .limit(1);

    if (!existing) {
      throw new Error(`No se pudo crear ni recuperar el usuario ${normalizedValues.email}`);
    }

    return existing;
  }

  async function seedInstitution(values: typeof schema.institutions.$inferInsert) {
    const [created] = await db
      .insert(schema.institutions)
      .values(values)
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    const [updated] = await db
      .update(schema.institutions)
      .set({
        name: values.name,
        status: values.status,
        plan: values.plan,
        monthlyCertQuota: values.monthlyCertQuota,
        approvedAt: values.approvedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.institutions.slug, values.slug))
      .returning();
    if (updated) return updated;

    const [existing] = await db
      .select()
      .from(schema.institutions)
      .where(eq(schema.institutions.slug, values.slug))
      .limit(1);

    if (!existing) {
      throw new Error(`No se pudo crear ni recuperar la institucion ${values.slug}`);
    }

    return existing;
  }

  const admin = await seedUser({
    email: 'admin@tessera.io',
    name: 'Tessera Admin',
    role: 'admin',
    passwordHash: await hashPassword('admin123'),
    emailVerifiedAt: new Date(),
  });
  void admin;

  const institution = await seedInstitution({
    name: 'Universidad Tecnologica de Ejemplo',
    slug: 'utec',
    walletAddress: '0x' + randomBytes(20).toString('hex'),
    status: 'approved',
    plan: 'pro',
    monthlyCertQuota: 1000,
    approvedAt: new Date(),
  });

  const institutionAdmin = await seedUser({
    email: 'institution@tessera.io',
    name: 'Admin Institucional Ejemplo',
    role: 'institution_admin',
    passwordHash: await hashPassword('institution123'),
    emailVerifiedAt: new Date(),
  });

  const teacher = await seedUser({
    email: 'teacher@tessera.io',
    name: 'Profesor Ejemplo',
    role: 'teacher',
    passwordHash: await hashPassword('teacher123'),
    emailVerifiedAt: new Date(),
  });

  const student = await seedUser({
    email: 'student@tessera.io',
    name: 'Estudiante Ejemplo',
    role: 'student',
    passwordHash: await hashPassword('student123'),
    emailVerifiedAt: new Date(),
    walletAddress: '0x' + randomBytes(20).toString('hex'),
  });
  void student;

  await db
    .insert(schema.institutionMembers)
    .values([
      { institutionId: institution.id, userId: institutionAdmin.id, memberRole: 'admin' },
      { institutionId: institution.id, userId: teacher.id, memberRole: 'teacher' },
    ])
    .onConflictDoNothing();

  console.log('Listo. Credenciales demo:');
  console.log('  Plataforma:  admin@tessera.io / admin123');
  console.log('  Institucion: institution@tessera.io / institution123');
  console.log('  Docente:     teacher@tessera.io / teacher123');
  console.log('  Estudiante:  student@tessera.io / student123');

  await db.$close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
