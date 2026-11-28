export const VERSION = '1.0.0';
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;
export function fail(code, detail = '') {
  const error = new Error(detail || code);
  error.code = code;
  throw error;
}
export function invariant(test, code) { if (!test) fail(code); }
export function canonical(value, integersOnly = true) {
  if (Array.isArray(value)) return '[' + value.map(v => canonical(v, integersOnly)).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    invariant(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'INVALID_JSON');
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], integersOnly)).join(',') + '}';
  }
  invariant(value === null || ['boolean','string'].includes(typeof value) ||
    (Number.isFinite(value) && (!integersOnly || Number.isSafeInteger(value))), 'INVALID_JSON');
  return JSON.stringify(value);
}
export async function sha256(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const result = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(result, byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function eventHash(event) {
  const {payload_hash, ...rest} = event;
  return sha256(canonical(rest));
}
export function scopeKey(s) {
  invariant(s && ['local_practice','demo','lms_client'].includes(s.origin) && SAFE_ID.test(s.profileId) &&
    SAFE_ID.test(s.environment) && typeof s.profileId === 'string' && typeof s.environment === 'string','INVALID_SCOPE');
  return [s.origin,s.environment,s.profileId].join('|');
}
export const now = () => new Date().toISOString();
