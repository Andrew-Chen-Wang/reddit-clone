#!/usr/bin/env bash
# Idempotent Garage (local S3) initialization for ReadIt dev.
# Requires the reddit_clone_garage container to be running (docker-compose up -d).
# Creates the cluster layout, imports the fixed dev key from .env, and creates the media bucket.
set -euo pipefail

CONTAINER=reddit_clone_garage
BUCKET=readit-media

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ACCESS_KEY="$(grep '^S3_ACCESS_KEY_ID=' "$ROOT_DIR/.env" | cut -d= -f2)"
SECRET_KEY="$(grep '^S3_SECRET_ACCESS_KEY=' "$ROOT_DIR/.env" | cut -d= -f2)"

garage() {
  docker exec "$CONTAINER" /garage "$@"
}

NODE_ID="$(garage node id -q | cut -d@ -f1)"

if garage layout show | grep -q "$NODE_ID"; then
  echo "Layout already assigned"
else
  garage layout assign -z dc1 -c 10G "$NODE_ID"
  garage layout apply --version 1
fi

if garage key info "$ACCESS_KEY" >/dev/null 2>&1; then
  echo "Key already imported"
else
  garage key import --yes -n readit-dev "$ACCESS_KEY" "$SECRET_KEY"
fi

if garage bucket info "$BUCKET" >/dev/null 2>&1; then
  echo "Bucket already exists"
else
  garage bucket create "$BUCKET"
fi

garage bucket allow --read --write --owner "$BUCKET" --key "$ACCESS_KEY"
garage bucket website --allow "$BUCKET"
echo "Garage ready: bucket=$BUCKET key=$ACCESS_KEY"
