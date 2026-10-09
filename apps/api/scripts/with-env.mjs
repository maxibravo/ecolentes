/**
 * Corre un comando con las variables del `.env` de la raíz del monorepo.
 *
 * Hace falta porque el `.env` vive en la raíz (es uno solo para todo) pero
 * estos comandos corren desde `apps/api`, y el CLI de Prisma busca el archivo
 * al lado del schema. Sin esto, `pnpm db:migrate` sobre un clon recién hecho
 * falla diciendo que falta DATABASE_URL.
 *
 *   node scripts/with-env.mjs prisma migrate dev
 *
 * Si no hay `.env` sigue igual, con lo que haya en el entorno: así funciona
 * dentro de Docker, donde las variables las pone docker compose y no hay
 * archivo. Lo que ya está en el entorno gana sobre el archivo.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');

try {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = raw.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {
  // Sin archivo se sigue con lo que haya en el entorno.
}

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Uso: node scripts/with-env.mjs <comando> [args...]');

const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
