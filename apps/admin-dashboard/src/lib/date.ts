import { format } from 'date-fns';

export function formatDateTime(value: string) {
  return format(new Date(value), 'yyyy-MM-dd HH:mm');
}

export function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export function endOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
}
