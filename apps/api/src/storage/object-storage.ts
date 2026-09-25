/**
 * Port for private object storage (S3-compatible).
 *
 * Domain code depends only on this interface — never on AWS SDK types.
 * One configurable adapter covers MinIO (dev) and DigitalOcean Spaces (prod).
 */
export interface ObjectHeadResult {
  contentLength: number;
  contentType: string | undefined;
}

export interface ObjectStoragePort {
  /**
   * Short-lived presigned PUT URL so the client uploads directly to storage.
   * The API never receives the binary body.
   */
  createPresignedPutUrl(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }): Promise<string>;

  /** Short-lived signed GET URL for authorized downloads. */
  getSignedGetUrl(input: {
    key: string;
    expiresInSeconds: number;
    /** Optional Content-Disposition for download filename. */
    responseContentDisposition?: string;
  }): Promise<string>;

  /** Metadata probe — null when the object does not exist. */
  head(key: string): Promise<ObjectHeadResult | null>;

  /**
   * Read up to `maxBytes` from the start of the object (magic-byte checks).
   * Returns null when the object is missing.
   */
  getPrefix(key: string, maxBytes: number): Promise<Buffer | null>;

  /** Best-effort delete. Implementations should throw on transport failure. */
  delete(key: string): Promise<void>;
}
