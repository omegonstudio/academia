#!/bin/sh
# Create the development materials bucket idempotently.
# Retries until MinIO accepts credentials (Compose may start this before ready).
set -eu

i=0
until mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "MinIO not ready after retries" >&2
    exit 1
  fi
  sleep 1
done

mc mb --ignore-existing "local/${MINIO_BUCKET}"
# Private bucket — no anonymous download policy.
mc anonymous set none "local/${MINIO_BUCKET}"
echo "MinIO bucket ready: ${MINIO_BUCKET}"
