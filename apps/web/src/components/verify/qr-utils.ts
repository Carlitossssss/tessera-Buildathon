export type CertificateLookup = { tokenId: string } | { certificateId: string };

export function extractCertificateLookup(raw: string): CertificateLookup | null {
  const trimmed = raw.trim();

  if (/^\d+$/.test(trimmed)) return { tokenId: trimmed };

  try {
    const url = new URL(trimmed);
    const certificateId = url.searchParams.get('certificateId');
    if (
      certificateId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        certificateId,
      )
    ) {
      return { certificateId };
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && /^\d+$/.test(lastSegment)) {
      return { tokenId: lastSegment };
    }
  } catch {
    // no es URL válida, tratar como token directo si es numérico
    const cleaned = trimmed.replace(/[^\d]/g, '');
    if (cleaned) return { tokenId: cleaned };
  }

  return null;
}
