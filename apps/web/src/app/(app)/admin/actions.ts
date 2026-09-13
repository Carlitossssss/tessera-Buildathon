'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminApi } from '@/lib/api/endpoints/admin';
import { ApiError } from '@/lib/api/client';
import { auth } from '@/server/auth';

async function token() {
  const session = await auth();
  if (!session?.accessToken) throw new Error('UNAUTHENTICATED');
  return session.accessToken;
}

function revalidateInstitutionWorkspace() {
  revalidatePath('/institution');
  revalidatePath('/institution/courses');
  revalidatePath('/institution/certificates');
  revalidatePath('/institution/badges');
  revalidatePath('/student');
  revalidatePath('/student/courses');
  revalidatePath('/teacher');
  revalidatePath('/teacher/courses');
  revalidatePath('/teacher/students');
  revalidatePath('/teacher/grading');
}

export async function approveInstitutionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('institutionId') ?? '').trim();
  let synced = false;
  try {
    if (!id) return;
    await adminApi.approveInstitution(await token(), id);
    revalidatePath('/admin/institutions');
    revalidatePath(`/admin/institutions/${id}`);
    revalidateInstitutionWorkspace();
    synced = true;
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Could not approve the institution';
    if (id) redirect(`/admin/institutions/${id}?error=${encodeURIComponent(message)}`);
    throw new Error(message);
  }
  if (synced) redirect(`/admin/institutions/${id}?synced=1`);
}

/**
 * Retries on-chain accreditation on an audit network.
 *
 * The HSK testnet RPC is intermittent, so a failed accreditation is usually
 * resolved by retrying a few minutes later. Without this button the whole
 * institution would need to be re-approved to retry it.
 */
export async function accreditInstitutionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('institutionId') ?? '').trim();
  const chainId = Number(formData.get('chainId') ?? 0);
  if (!id || !chainId) return;

  try {
    const result = await adminApi.accreditInstitution(await token(), id, chainId);
    revalidatePath(`/admin/institutions/${id}`);
    if (result.status !== 'confirmed') {
      redirect(
        `/admin/institutions/${id}?error=${encodeURIComponent(result.error ?? 'Could not accredit')}`,
      );
    }
  } catch (err) {
    // redirect() throws to interrupt the render; it is not a failure.
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    const message = err instanceof ApiError ? err.message : 'Could not accredit the institution';
    redirect(`/admin/institutions/${id}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/admin/institutions/${id}?accredited=1`);
}

export async function rejectInstitutionAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('institutionId') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    if (!id) return;
    await adminApi.rejectInstitution(await token(), id, { reason });
    revalidatePath('/admin/institutions');
    revalidatePath(`/admin/institutions/${id}`);
    revalidateInstitutionWorkspace();
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not reject the institution');
  }
}

export async function suspendInstitutionAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('institutionId') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    if (!id) return;
    await adminApi.suspendInstitution(await token(), id, { reason });
    revalidatePath('/admin/institutions');
    revalidatePath(`/admin/institutions/${id}`);
    revalidateInstitutionWorkspace();
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not suspend the institution');
  }
}

export async function toggleInstitutionSuspensionAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('institutionId') ?? '').trim();
    const currentStatus = String(formData.get('status') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    if (!id) return;
    if (currentStatus === 'suspended') {
      await adminApi.reactivateInstitution(await token(), id);
    } else {
      await adminApi.suspendInstitution(await token(), id, { reason });
    }
    revalidatePath('/admin/institutions');
    revalidatePath(`/admin/institutions/${id}`);
    revalidateInstitutionWorkspace();
  } catch (err) {
    throw new Error(
      err instanceof ApiError ? err.message : 'Could not change the institution status',
    );
  }
}

export async function toggleUserRestrictionAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('userId') ?? '').trim();
    const restricted = String(formData.get('restricted') ?? '') === 'true';
    const reason = String(formData.get('reason') ?? '').trim();
    if (!id) return;
    if (restricted) {
      await adminApi.unrestrictUser(await token(), id);
    } else {
      await adminApi.restrictUser(await token(), id, { reason });
    }
    revalidatePath('/admin/users');
  } catch (err) {
    throw new Error(
      err instanceof ApiError ? err.message : 'Could not change the user status',
    );
  }
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('userId') ?? '').trim();
    if (!id) return;
    await adminApi.deleteUser(await token(), id);
    revalidatePath('/admin/users');
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not delete the user');
  }
}

export async function approveUserProfileAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('userId') ?? '').trim();
    if (!id) return;
    await adminApi.approveUserProfile(await token(), id);
    revalidatePath('/admin/users');
    revalidatePath('/student');
    revalidatePath('/student/profile');
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not approve the profile');
  }
}

export async function rejectUserProfileAction(formData: FormData): Promise<void> {
  try {
    const id = String(formData.get('userId') ?? '').trim();
    const reason = String(formData.get('reason') ?? '').trim();
    if (!id) return;
    await adminApi.rejectUserProfile(await token(), id, { reason });
    revalidatePath('/admin/users');
    revalidatePath('/student');
    revalidatePath('/student/profile');
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not reject the profile');
  }
}

export async function resolveAdminAlertAction(formData: FormData): Promise<void> {
  try {
    const alertId = String(formData.get('alertId') ?? '').trim();
    if (!alertId) return;
    await adminApi.resolveAlert(await token(), alertId);
    revalidatePath('/admin/alerts');
    revalidatePath('/admin');
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not resolve the alert');
  }
}

export async function resolveSuspensionRequestAction(formData: FormData): Promise<void> {
  try {
    const requestId = String(formData.get('requestId') ?? '').trim();
    if (!requestId) return;
    await adminApi.resolveSuspensionRequest(await token(), requestId);
    revalidatePath('/admin/suspension-requests');
    revalidatePath('/admin');
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'Could not mark as reviewed');
  }
}

export async function updateBillingCatalogAction(formData: FormData): Promise<void> {
  let saved = false;
  try {
    const tscPerCertificate = Number(formData.get('tscPerCertificate') ?? 0);
    const tscNominalValueCents = Math.round(Number(formData.get('tscNominalValueUsd') ?? 0) * 100);
    const continuityReserveCents = Math.round(
      Number(formData.get('continuityReserveUsd') ?? 0) * 100,
    );
    const packageValidityMonths = Number(formData.get('packageValidityMonths') ?? 12);
    const planCodes = ['essential', 'growth', 'institutional', 'scale', 'enterprise'] as const;
    const packageCodes = ['initial', 'growth', 'institutional', 'scale', 'enterprise'] as const;

    const plans = planCodes.map((code) => ({
      code,
      name: String(formData.get(`plan.${code}.name`) ?? '').trim(),
      description: String(formData.get(`plan.${code}.description`) ?? '').trim(),
      monthlyTsc: Number(formData.get(`plan.${code}.monthlyTsc`) ?? 0),
      monthlyPriceCents: Math.round(
        Number(formData.get(`plan.${code}.monthlyPriceUsd`) ?? 0) * 100,
      ),
      launchDiscountBps: Math.round(
        Number(formData.get(`plan.${code}.launchDiscountPct`) ?? 0) * 100,
      ),
      extraTscPriceCents: Number(formData.get(`plan.${code}.extraTscPriceUsd`) ?? 0) * 100,
      minimumCommitmentMonths: Number(formData.get(`plan.${code}.minimumCommitmentMonths`) ?? 12),
      active: formData.get(`plan.${code}.active`) === 'on',
    }));

    const packages = packageCodes.map((code) => ({
      code,
      name: String(formData.get(`package.${code}.name`) ?? '').trim(),
      tsc: Number(formData.get(`package.${code}.tsc`) ?? 0),
      priceCents: Math.round(Number(formData.get(`package.${code}.priceUsd`) ?? 0) * 100),
      discountBps: Math.round(Number(formData.get(`package.${code}.discountPct`) ?? 0) * 100),
      currency: 'USD' as const,
      active: formData.get(`package.${code}.active`) === 'on',
    }));

    await adminApi.updateBillingCatalog(await token(), {
      tscPerCertificate,
      tscNominalValueCents,
      continuityReserveCents,
      packageValidityMonths,
      plans,
      packages,
    });
    revalidatePath('/admin/plans');
    revalidatePath('/pricing');
    revalidatePath('/instituciones');
    revalidatePath('/institution/credits');
    revalidatePath('/institution/plan');
    revalidatePath('/institution/wallet');
    saved = true;
  } catch (err) {
    throw new Error(err instanceof ApiError ? err.message : 'No se pudo actualizar planes');
  }
  if (saved) redirect('/admin/plans?saved=1');
}
