/**
 * Da de alta, lista o revoca las credenciales con las que otro sistema consulta
 * la API. La clave se muestra una sola vez, cuando se crea.
 *
 *   pnpm api:credencial alta "Sistema municipal"
 *   pnpm api:credencial lista
 *   pnpm api:credencial baja "Sistema municipal"
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { generateServiceKey } from '../src/integration/service-key';

const prisma = new PrismaClient();

async function alta(name: string) {
  const existing = await prisma.serviceClient.findUnique({ where: { name } });
  if (existing) {
    console.error(
      `Ya existe una credencial para "${name}". Si se perdió la clave, dala de baja y creá otra.`,
    );
    process.exitCode = 1;
    return;
  }

  const { key, prefix, secret } = generateServiceKey();
  await prisma.serviceClient.create({
    data: { name, keyPrefix: prefix, keyHash: await argon2.hash(secret) },
  });

  console.log(`Credencial creada para "${name}".`);
  console.log('');
  console.log(`  ${key}`);
  console.log('');
  console.log('Se muestra una sola vez: no queda guardada, sólo su hash.');
  console.log('Se manda en el encabezado X-API-Key. Por un canal seguro, no por chat.');
}

async function lista() {
  const clients = await prisma.serviceClient.findMany({ orderBy: { createdAt: 'asc' } });
  if (clients.length === 0) {
    console.log('No hay ninguna credencial de servicio.');
    return;
  }
  for (const c of clients) {
    const estado = c.revokedAt ? `dada de baja el ${fecha(c.revokedAt)}` : 'activa';
    const uso = c.lastUsedAt ? `último uso ${fecha(c.lastUsedAt)}` : 'nunca se usó';
    console.log(`${c.name} · ${c.keyPrefix}… · ${estado} · ${uso}`);
  }
}

async function baja(name: string) {
  const client = await prisma.serviceClient.findUnique({ where: { name } });
  if (!client) {
    console.error(`No hay ninguna credencial para "${name}".`);
    process.exitCode = 1;
    return;
  }
  await prisma.serviceClient.update({
    where: { id: client.id },
    data: { active: false, revokedAt: new Date() },
  });
  console.log(`La credencial de "${name}" dejó de servir desde ahora.`);
}

function fecha(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);
  const nombre = resto.join(' ').trim();

  if (comando === 'lista') return lista();
  if ((comando === 'alta' || comando === 'baja') && nombre) {
    return comando === 'alta' ? alta(nombre) : baja(nombre);
  }

  console.error('Uso: alta "<nombre>" | lista | baja "<nombre>"');
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
