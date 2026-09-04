import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'vw_';

export interface GeneratedApiKey {
  plaintext: string;
  hash: string;
  prefix: string;
}

/** Generates a new shop-connection API key. Only the hash is ever persisted. */
export function generateApiKey(): GeneratedApiKey {
  const plaintext = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { plaintext, hash: hashApiKey(plaintext), prefix: plaintext.slice(0, 10) };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}
