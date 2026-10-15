// Prints local-only anon and service-role JWTs signed with the local JWT secret.
// These keys only work against the local test stack.
import { createHmac } from 'node:crypto';

export const LOCAL_JWT_SECRET = 'local-only-jwt-secret-for-tests-0123456789abcdef';

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', LOCAL_JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 5;
export const anonKey = sign({ iss: 'local', role: 'anon', exp });
export const serviceKey = sign({ iss: 'local', role: 'service_role', exp });

if (process.argv[1] && process.argv[1].endsWith('keys.mjs')) {
  const which = process.argv[2];
  if (which === 'anon') process.stdout.write(anonKey);
  else if (which === 'service') process.stdout.write(serviceKey);
  else if (which === 'secret') process.stdout.write(LOCAL_JWT_SECRET);
}
