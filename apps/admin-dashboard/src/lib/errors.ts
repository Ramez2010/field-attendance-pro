function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readObjectError(data: unknown): string | null {
  if (!isRecord(data)) return null;

  const nestedError = data.error;
  if (isRecord(nestedError)) {
    const nestedMessage = readObjectError(nestedError);
    if (nestedMessage) return nestedMessage;
  }

  const candidates = ['error', 'message', 'msg'];
  for (const key of candidates) {
    const value = asNonEmptyString(data[key]);
    if (value) return value;
  }

  return null;
}

function readDetailsAndHint(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const details = asNonEmptyString(data.details);
  const hint = asNonEmptyString(data.hint);
  return [details, hint].filter(Boolean).join(' ').trim() || null;
}

function formatUniqueViolation(message: string, details: string | null): string {
  const keyMatch = details?.match(/Key \((.+?)\)=\((.+?)\) already exists\./i);
  if (keyMatch) {
    const field = keyMatch[1].replaceAll('_', ' ');
    const value = keyMatch[2];
    return `${field} "${value}" already exists.`;
  }
  return 'A record with the same unique value already exists.';
}

function normalizeErrorMessage(rawMessage: string, code?: string | null, details?: string | null): string {
  const message = rawMessage.trim();
  const lower = message.toLowerCase();
  const normalizedCode = (code ?? '').toUpperCase();

  if (normalizedCode === '23505' || lower.includes('duplicate key value violates unique constraint')) {
    return formatUniqueViolation(message, details ?? null);
  }
  if (normalizedCode === '23503' || lower.includes('violates foreign key constraint')) {
    return 'This record is linked to other data and cannot be deleted or updated in this way.';
  }
  if (normalizedCode === '42501' || lower.includes('permission denied') || lower.includes('violates row-level security policy')) {
    return 'You do not have permission to perform this action.';
  }
  if (lower.includes('edge function returned a non-2xx status code')) {
    return 'Server request failed. Please try again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed') || lower.includes('load failed')) {
    return 'Network error. Check your internet connection and try again.';
  }
  if (lower.includes('request timed out')) {
    return 'The request took too long. Please try again.';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Invalid email or password.';
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return 'Email is not confirmed. Check your inbox and confirm your email first.';
  }
  if (lower.includes('no admin profile found for this login email')) {
    return 'This account can sign in, but it is not linked to an admin profile yet.';
  }
  if (lower.includes('employee_id is required for employee users')) {
    return 'Select an employee profile when role is Employee.';
  }
  if (lower.includes('cannot manage users outside your company')) {
    return 'You can only manage users in the selected company.';
  }
  if (lower.includes('supabase function environment is not configured')) {
    return 'Server user-management functions are not configured yet. Contact system administrator.';
  }
  if (lower.includes('could not find the') && lower.includes('function in the schema cache')) {
    return 'Required database function is not available. Contact system administrator.';
  }
  if (lower.includes('jwt expired') || lower.includes('token has expired')) {
    return 'Your session expired. Please sign in again.';
  }
  if (lower.includes('auth session missing')) {
    return 'Your session is missing. Please sign in again.';
  }

  return message;
}

async function readResponseError(response: Response): Promise<string | null> {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.clone().json();
      const message = readObjectError(payload);
      if (message) {
        const code = isRecord(payload) ? asNonEmptyString(payload.code) : null;
        const details = readDetailsAndHint(payload);
        return normalizeErrorMessage(message, code, details);
      }
    }

    const text = await response.clone().text();
    if (text.trim().length > 0) return normalizeErrorMessage(text);
  } catch {
    return null;
  }

  return null;
}

export async function getFriendlyErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (isRecord(error)) {
    const directMessage = readObjectError(error);
    if (directMessage) {
      const code = asNonEmptyString(error.code);
      const details = readDetailsAndHint(error);
      return normalizeErrorMessage(directMessage, code, details);
    }

    const maybeContext = error.context;
    if (maybeContext instanceof Response) {
      const contextMessage = await readResponseError(maybeContext);
      if (contextMessage) return contextMessage;
      return `Request failed with status ${maybeContext.status}`;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return normalizeErrorMessage(error.message);
  }

  return fallback;
}

export async function getUserErrorMessage(error: unknown, fallback: string): Promise<string> {
  return getFriendlyErrorMessage(error, fallback);
}
