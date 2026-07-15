// biometricAccess.js
// Single source of truth for who may see the FULL company biometric view
// (besides admins/directors).
//
// IMPORTANT: keep this list in sync with BIOMETRIC_FULL_EMAILS in
// backend/biometric.py. The backend enforces access; this list only decides
// what the UI shows. If they drift, a user can see the tab but get a 403.

export const BIOMETRIC_FULL_EMAILS = [
  'pardhasaradhi@showtimeconsulting.in',
  'khushboo@showtimeconsulting.in',
  'rs@showtimeconsulting.in',
  'alimpan@showtimeconsulting.in',
  'at@showtimeconsulting.in',
];

/** True for admins/directors, or anyone on the allow-list above. */
export function hasFullBiometricAccess(user, isAdmin) {
  if (isAdmin || user?.isAdmin) return true;
  const email = (user?.email || '').trim().toLowerCase();
  if (email && BIOMETRIC_FULL_EMAILS.includes(email)) return true;
  const designation = (user?.designation || '').toLowerCase();
  return designation.includes('director');
}
