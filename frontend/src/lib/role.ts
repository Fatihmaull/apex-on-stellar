/** Persist Provider / Trader role preference. */

export type AppRole = 'provider' | 'trader';

const KEY = 'apex.role';

export function getStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(KEY);
  if (v === 'provider' || v === 'trader') return v;
  return null;
}

export function setStoredRole(role: AppRole) {
  localStorage.setItem(KEY, role);
}

export function clearStoredRole() {
  localStorage.removeItem(KEY);
}
