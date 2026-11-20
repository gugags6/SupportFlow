#!/bin/sh
# Runs once, on first initialization of the PostgreSQL data volume.
# Creates "<POSTGRES_DB>_test", the isolated database used by the e2e test suite.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE "${POSTGRES_DB}_test";
EOSQL
