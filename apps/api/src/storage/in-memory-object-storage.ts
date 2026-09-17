import { randomUUID } from 'node:crypto';
import type { ObjectStoragePort } from './object-storage.js';

/**
 * In-memory ObjectStorage for unit/HTTP tests.
 * Does not talk to MinIO/S3.
 */
export function createInMemoryObjectStorage(): ObjectStoragePort & {
  objects: Map<string, { body: Buffer; contentType: string }>;
  put(key: string, body: Buffer, contentType: string): void;
} {
  const objects = new Map<string, { body: Buffer; contentType: string }>();

  return {
    objects,

    put(key, body, contentType) {
      objects.set(key, { body: Buffer.from(body), contentType });
    },

    async createPresignedPutUrl({ key, contentType }) {
      // Test URL encodes the key; HTTP tests simulate PUT by calling `put`.
      const token = randomUUID();
      return `https://storage.test/upload/${encodeURIComponent(key)}?token=${token}&ct=${encodeURIComponent(contentType)}`;
    },

    async getSignedGetUrl({ key, expiresInSeconds }) {
      if (!objects.has(key)) {
        throw new Error(`Object not found: ${key}`);
      }
      return `https://storage.test/download/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
    },

    async head(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        contentLength: object.body.length,
        contentType: object.contentType,
      };
    },

    async getPrefix(key, maxBytes) {
      const object = objects.get(key);
      if (!object) return null;
      return object.body.subarray(0, maxBytes);
    },

    async delete(key) {
      objects.delete(key);
    },
  };
}
