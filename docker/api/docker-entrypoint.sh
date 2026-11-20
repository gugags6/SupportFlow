#!/bin/sh
# SupportFlow API container entrypoint:
#   1. apply pending Prisma migrations
#   2. optionally run the idempotent seed (SEED_DATABASE=true)
#   3. start the application
set -e

echo "[entrypoint] applying database migrations..."
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_DATABASE:-false}" = "true" ]; then
  echo "[entrypoint] seeding database (idempotent)..."
  node dist/prisma/seed.js
fi

exec "$@"
