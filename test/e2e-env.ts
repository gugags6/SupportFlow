import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Points the application at the dedicated test database. Loaded both by the
 * Jest global setup (migrations) and by every e2e test file.
 */
export function applyTestEnv(): string {
  config({ path: resolve(__dirname, '..', '.env'), quiet: true });

  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set. Copy .env.example to .env (see README).');
  }
  // Safety net: the e2e suite truncates tables, so never run it against a non-test database.
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests: database "${dbName}" does not end with "_test".`);
  }

  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  return url;
}

applyTestEnv();
