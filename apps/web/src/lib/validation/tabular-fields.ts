export type TabularFieldKind = 'text' | 'email' | 'wallet' | 'date' | 'score';

export interface TabularValidationResult {
  [cell: string]: string;
}

const FIELD_ALIASES: Record<Exclude<TabularFieldKind, 'text'>, string[]> = {
  email: ['email', 'correo'],
  wallet: ['wallet', 'billetera', 'direccion'],
  date: ['fecha', 'date', 'nacimiento', 'birth'],
  score: ['puntaje', 'nota', 'grade', 'score'],
};

export function normalizeTabularColumn(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function inferTabularFieldKind(column: string): TabularFieldKind {
  const normalized = normalizeTabularColumn(column);
  for (const [kind, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias))) return kind as TabularFieldKind;
  }
  return 'text';
}

export function acceptNumericValue(value: string, min = 0, max = 100) {
  if (value === '') return value;
  if (!/^\d+$/.test(value)) return null;
  const numeric = Number(value);
  return numeric >= min && numeric <= max ? value : null;
}

export function validateCertificateRows(
  rows: Record<string, string>[],
  columns: string[],
): TabularValidationResult {
  const errors: TabularValidationResult = {};
  if (!rows.length) return errors;

  const nameColumn = findColumn(columns, ['nombre', 'name', 'estudiante']);
  const emailColumn = findColumn(columns, FIELD_ALIASES.email);
  const walletColumn = findColumn(columns, FIELD_ALIASES.wallet);
  const dateColumn = findColumn(columns, FIELD_ALIASES.date);
  const scoreColumn = findColumn(columns, FIELD_ALIASES.score);

  if (!nameColumn) errors['form:nombre'] = 'Falta una columna para el nombre.';
  if (!emailColumn) errors['form:email'] = 'Falta una columna para el email.';

  rows.forEach((row, index) => {
    if (nameColumn && !row[nameColumn]?.trim()) {
      errors[`${index}:${nameColumn}`] = 'El nombre es obligatorio.';
    }
    if (emailColumn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[emailColumn]?.trim() ?? '')) {
      errors[`${index}:${emailColumn}`] = 'Ingresa un email válido.';
    }
    if (
      walletColumn &&
      row[walletColumn]?.trim() &&
      !/^0x[a-fA-F0-9]{40}$/.test(row[walletColumn]!.trim())
    ) {
      errors[`${index}:${walletColumn}`] = 'Debe ser una wallet 0x de 40 caracteres.';
    }
    if (dateColumn && row[dateColumn]?.trim()) {
      if (!isIsoDate(row[dateColumn]!)) {
        errors[`${index}:${dateColumn}`] = 'Ingresa una fecha válida.';
      } else if (row[dateColumn]! > todayIsoDate()) {
        errors[`${index}:${dateColumn}`] = 'La fecha no puede ser posterior a hoy.';
      }
    }
    if (scoreColumn && row[scoreColumn]?.trim() && acceptNumericValue(row[scoreColumn]!) === null) {
      errors[`${index}:${scoreColumn}`] = 'El puntaje debe estar entre 0 y 100.';
    }
  });

  return errors;
}

function findColumn(columns: string[], aliases: string[]) {
  return columns.find((column) => {
    const normalized = normalizeTabularColumn(column);
    return aliases.some((alias) => normalized.includes(normalizeTabularColumn(alias)));
  });
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

function todayIsoDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
