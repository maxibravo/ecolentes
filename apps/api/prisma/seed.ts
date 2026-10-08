/**
 * Crea el primer usuario administrador, que después da de alta a los demás.
 * Se corre una vez por ambiente: `pnpm --filter @ecolentes/api prisma:seed`.
 */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin';

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`El usuario "${username}" ya existe. No se cambió nada.`);
    return;
  }

  // Si no se pasa una contraseña, se genera una y se muestra una sola vez.
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');

  await prisma.user.create({
    data: {
      username,
      passwordHash: await argon2.hash(password),
      fullName: process.env.ADMIN_FULL_NAME ?? 'Administrador',
      role: Role.ADMIN,
      mustChangePassword: true,
    },
  });

  console.log(`Usuario administrador creado: ${username}`);
  if (generated) {
    console.log(`Contraseña: ${password}`);
    console.log('Anotala ahora. No se vuelve a mostrar y hay que cambiarla al entrar.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
