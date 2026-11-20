import { execSync } from 'child_process';
import { resolve } from 'path';
import { applyTestEnv } from './e2e-env';

/** Applies all Prisma migrations to the test database before the e2e suite runs. */
export default function globalSetup(): void {
  applyTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
}
