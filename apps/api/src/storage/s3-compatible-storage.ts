import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStoragePort } from './object-storage.js';

export interface S3CompatibleStorageConfig {
  endpoint: string;
  /**
   * Endpoint used when signing PUT/GET URLs for browsers.
   * Must match the Host the client will call (SigV4 binds the host).
   * Defaults to `endpoint` (correct for Spaces).
   */
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function buildClient(
  endpoint: string,
  config: Omit<S3CompatibleStorageConfig, 'endpoint' | 'publicEndpoint'>,
): S3Client {
  return new S3Client({
    endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/**
 * Single S3-compatible adapter for MinIO (dev) and DigitalOcean Spaces (prod).
 *
 * Server-side ops use `endpoint` (e.g. http://minio:9000 inside Compose).
 * Presigned URLs are signed with `publicEndpoint` when set (e.g.
 * http://127.0.0.1:9000) so SigV4 Host matches what the browser sends —
 * rewriting the URL after signing would invalidate the signature.
 */
export function createS3CompatibleStorage(
  config: S3CompatibleStorageConfig,
): ObjectStoragePort {
  const opsClient = buildClient(config.endpoint, config);
  const signingClient = buildClient(
    config.publicEndpoint ?? config.endpoint,
    config,
  );
  const bucket = config.bucket;

  return {
    async createPresignedPutUrl({
      key,
      contentType,
      contentLength,
      expiresInSeconds,
    }) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      return getSignedUrl(signingClient, command, {
        expiresIn: expiresInSeconds,
      });
    },

    async getSignedGetUrl({
      key,
      expiresInSeconds,
      responseContentDisposition,
    }) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: responseContentDisposition,
      });
      return getSignedUrl(signingClient, command, {
        expiresIn: expiresInSeconds,
      });
    },

    async head(key) {
      try {
        const result = await opsClient.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key }),
        );
        return {
          contentLength: result.ContentLength ?? 0,
          contentType: result.ContentType,
        };
      } catch (error: unknown) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async getPrefix(key, maxBytes) {
      try {
        const result = await opsClient.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
          }),
        );
        if (!result.Body) return Buffer.alloc(0);
        const bytes = await result.Body.transformToByteArray();
        return Buffer.from(bytes);
      } catch (error: unknown) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async delete(key) {
      await opsClient.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    },
  };
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  const status =
    '$metadata' in error &&
    error.$metadata &&
    typeof error.$metadata === 'object' &&
    'httpStatusCode' in error.$metadata
      ? Number(error.$metadata.httpStatusCode)
      : undefined;
  return (
    name === 'NotFound' ||
    name === 'NoSuchKey' ||
    name === 'NotFoundError' ||
    status === 404
  );
}
