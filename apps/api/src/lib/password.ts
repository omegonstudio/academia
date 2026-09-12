import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

// promisify resolves to scrypt's 3-argument overload, which drops the options
// object, so the options-carrying signature is restated here.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * scrypt from node:crypto is used instead of argon2/bcrypt so the image needs
 * no native build toolchain. Parameters are stored alongside the derived key,
 * which lets them be raised later without invalidating existing hashes.
 */
const COST = 16_384; // N
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** scrypt needs maxmem above the default once N*r*128 grows. */
const MAX_MEM = 64 * 1024 * 1024;

const ALGORITHM = 'scrypt';

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: cost,
    r: blockSize,
    p: parallelism,
    maxmem: MAX_MEM,
  });
}

/** Encoded as `scrypt$N$r$p$salt$key`, all binary parts base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM);

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

/**
 * Compares a candidate password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash, so a corrupted row
 * denies access instead of taking the endpoint down.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 6) return false;

  const [algorithm, costRaw, blockSizeRaw, parallelismRaw, saltRaw, keyRaw] =
    parts as [string, string, string, string, string, string];

  if (algorithm !== ALGORITHM) return false;

  const cost = Number(costRaw);
  const blockSize = Number(blockSizeRaw);
  const parallelism = Number(parallelismRaw);
  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelism)
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(keyRaw, 'base64url');
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = await derive(password, salt, cost, blockSize, parallelism);
    if (actual.length !== expected.length) return false;

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
