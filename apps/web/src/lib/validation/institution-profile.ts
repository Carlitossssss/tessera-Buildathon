export interface InstitutionProfileValues {
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
}

export type InstitutionProfileErrors = Partial<Record<keyof InstitutionProfileValues, string>>;

const REQUIRED_FIELDS: Array<keyof InstitutionProfileValues> = [
  'name',
  'website',
  'description',
  'country',
  'legalName',
  'taxId',
  'addressLine',
  'city',
  'stateRegion',
  'contactName',
  'contactEmail',
  'contactPhone',
  'accreditationId',
];

const FIELD_LABELS: Record<keyof InstitutionProfileValues, string> = {
  name: 'Nombre comercial',
  website: 'Sitio web',
  description: 'Descripción',
  country: 'País',
  legalName: 'Razón social',
  taxId: 'Identificación fiscal',
  addressLine: 'Dirección institucional',
  city: 'Ciudad',
  stateRegion: 'Provincia / Región',
  postalCode: 'Código postal',
  contactName: 'Responsable institucional',
  contactEmail: 'Email de contacto',
  contactPhone: 'Teléfono de contacto',
  accreditationId: 'Registro / acreditación',
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateInstitutionProfile(values: InstitutionProfileValues) {
  const errors: InstitutionProfileErrors = {};
  const trimmed = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()]),
  ) as InstitutionProfileValues;

  for (const field of REQUIRED_FIELDS) {
    if (!trimmed[field]) {
      errors[field] = `${FIELD_LABELS[field]} es obligatorio`;
    }
  }

  if (trimmed.name && trimmed.name.length < 2) errors.name = 'Mínimo 2 caracteres';
  if (trimmed.legalName && trimmed.legalName.length < 2) errors.legalName = 'Mínimo 2 caracteres';
  if (trimmed.taxId && trimmed.taxId.length < 2) errors.taxId = 'Mínimo 2 caracteres';
  if (trimmed.addressLine && trimmed.addressLine.length < 2) {
    errors.addressLine = 'Mínimo 2 caracteres';
  }
  if (trimmed.city && trimmed.city.length < 2) errors.city = 'Mínimo 2 caracteres';
  if (trimmed.stateRegion && trimmed.stateRegion.length < 2) {
    errors.stateRegion = 'Mínimo 2 caracteres';
  }
  if (trimmed.contactName && trimmed.contactName.length < 2) {
    errors.contactName = 'Mínimo 2 caracteres';
  }
  if (trimmed.accreditationId && trimmed.accreditationId.length < 2) {
    errors.accreditationId = 'Mínimo 2 caracteres';
  }
  if (trimmed.website && !isHttpUrl(trimmed.website)) {
    errors.website = 'Ingresa una URL válida con http:// o https://';
  }
  if (trimmed.description && trimmed.description.length < 20) {
    errors.description = 'Describe la institución con al menos 20 caracteres';
  }
  if (trimmed.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.contactEmail)) {
    errors.contactEmail = 'Ingresa un email válido';
  }
  if (trimmed.contactPhone && !/^\+?[0-9\s().-]{6,60}$/.test(trimmed.contactPhone)) {
    errors.contactPhone = 'Usa sólo números y signos + ( ) . -';
  }

  return errors;
}

export function hasInstitutionProfileErrors(errors: InstitutionProfileErrors) {
  return Object.keys(errors).length > 0;
}

export function sanitizeInstitutionPhone(value: string) {
  return value.replace(/[^0-9+\s().-]/g, '').replace(/(?!^)\+/g, '');
}

export function sanitizeInstitutionContactName(value: string) {
  return value.replace(/[0-9]/g, '');
}
