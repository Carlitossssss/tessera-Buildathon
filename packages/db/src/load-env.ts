import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(currentDir, '..');
const workspaceRoot = resolve(packageDir, '..', '..');

for (const envPath of [
  resolve(workspaceRoot, '.env.local'),
  resolve(workspaceRoot, '.env'),
  resolve(packageDir, '.env.local'),
  resolve(packageDir, '.env'),
]) {
  config({ path: envPath, override: false });
}
