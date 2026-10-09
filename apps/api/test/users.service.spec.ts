import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService, generatePassword } from '../src/users/users.service';

const admin = { id: 'admin-1', username: 'admin', role: Role.ADMIN, opticianId: null };

type Guardado = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  active: boolean;
  opticianId: string | null;
};

function servicio(opciones: {
  users?: Guardado[];
  opticians?: { id: string; name: string }[];
}) {
  const users = opciones.users ?? [];
  const creados: unknown[] = [];
  const actualizados: { where: { id: string }; data: Record<string, unknown> }[] = [];

  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) =>
        users.find((u) => (where.id ? u.id === where.id : u.username === where.username)) ?? null,
      findMany: async () => users,
      count: async ({ where }: { where: { id: { not: string } } }) =>
        users.filter((u) => u.role === Role.ADMIN && u.active && u.id !== where.id.not).length,
      create: async (args: { data: unknown }) => {
        creados.push(args.data);
        return { id: 'nuevo', ...(args.data as object) };
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        actualizados.push(args);
        return { id: args.where.id, ...args.data };
      },
    },
    optician: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        (opciones.opticians ?? []).find((o) => o.id === where.id) ?? null,
      findMany: async () => opciones.opticians ?? [],
    },
  };
  const audit = { record: async () => undefined };
  return {
    service: new UsersService(prisma as never, audit as never),
    creados,
    actualizados,
  };
}

describe('contraseñas de un solo uso', () => {
  it('usa un alfabeto sin caracteres que se confunden al dictarlos', () => {
    // Una sola contraseña no alcanza: un carácter de más en el alfabeto
    // aparecería recién cada varias decenas de intentos.
    for (let i = 0; i < 200; i += 1) {
      const password = generatePassword();
      expect(password).toHaveLength(12);
      expect(password).not.toMatch(/[0O1lIB8]/);
    }
  });

  it('no repite la misma contraseña', () => {
    const generadas = new Set(Array.from({ length: 200 }, generatePassword));
    expect(generadas.size).toBe(200);
  });
});

describe('alta de usuarios', () => {
  it('crea el usuario pidiendo que cambie la contraseña al entrar', async () => {
    const { service, creados } = servicio({});
    const { user, password } = await service.create(
      { username: 'jperez', fullName: 'Juana Pérez', role: Role.OPERATOR },
      admin,
    );

    expect(password).toHaveLength(12);
    expect(user).toBeTruthy();
    expect(creados[0]).toMatchObject({ username: 'jperez', mustChangePassword: true });
    // La contraseña no se guarda en claro en ningún lado.
    expect(JSON.stringify(creados[0])).not.toContain(password);
  });

  it('normaliza el nombre de usuario, para que no haya dos que parezcan uno', async () => {
    const { service, creados } = servicio({});
    await service.create(
      { username: '  JPerez  ', fullName: 'Juana Pérez', role: Role.OPERATOR },
      admin,
    );
    expect(creados[0]).toMatchObject({ username: 'jperez' });
  });

  it('no deja repetir un nombre de usuario', async () => {
    const { service } = servicio({
      users: [
        {
          id: 'u1',
          username: 'jperez',
          fullName: 'Juana Pérez',
          role: Role.OPERATOR,
          active: true,
          opticianId: null,
        },
      ],
    });
    await expect(
      service.create({ username: 'jperez', fullName: 'Otra Juana', role: Role.OPERATOR }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('exige la óptica cuando el perfil es Óptica', async () => {
    const { service } = servicio({ opticians: [{ id: 'op-1', name: 'Óptica Centro' }] });
    await expect(
      service.create({ username: 'optica1', fullName: 'Mostrador', role: Role.OPTICIAN }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);

    const { user } = await service.create(
      {
        username: 'optica1',
        fullName: 'Mostrador',
        role: Role.OPTICIAN,
        opticianId: 'op-1',
      },
      admin,
    );
    expect(user).toBeTruthy();
  });

  it('no le cuelga una óptica a un perfil que no es Óptica', async () => {
    const { service, creados } = servicio({ opticians: [{ id: 'op-1', name: 'Óptica Centro' }] });
    await service.create(
      { username: 'jperez', fullName: 'Juana Pérez', role: Role.OPERATOR, opticianId: 'op-1' },
      admin,
    );
    expect(creados[0]).toMatchObject({ opticianId: null });
  });
});

describe('cambios sobre un usuario', () => {
  const otroAdmin: Guardado = {
    id: 'admin-2',
    username: 'admin2',
    fullName: 'Otro Administrador',
    role: Role.ADMIN,
    active: true,
    opticianId: null,
  };
  const yo: Guardado = {
    id: 'admin-1',
    username: 'admin',
    fullName: 'Administrador',
    role: Role.ADMIN,
    active: true,
    opticianId: null,
  };

  it('no deja que un administrador se dé de baja a sí mismo', async () => {
    const { service } = servicio({ users: [yo, otroAdmin] });
    await expect(service.update('admin-1', { active: false }, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('no deja que un administrador se cambie el perfil a sí mismo', async () => {
    const { service } = servicio({ users: [yo, otroAdmin] });
    await expect(
      service.update('admin-1', { role: Role.OPERATOR }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no deja quedarse sin ningún administrador activo', async () => {
    // Si se va el último, no queda nadie que pueda volver a dar de alta usuarios.
    const { service } = servicio({ users: [otroAdmin] });
    await expect(
      service.update('admin-2', { role: Role.OPERATOR }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deja cambiar el perfil de un administrador si queda otro', async () => {
    const { service, actualizados } = servicio({ users: [yo, otroAdmin] });
    await service.update('admin-2', { role: Role.OPERATOR }, admin);
    expect(actualizados[0].data).toMatchObject({ role: Role.OPERATOR });
  });

  it('le saca la óptica a quien deja de ser Óptica', async () => {
    const optico: Guardado = {
      id: 'u-op',
      username: 'optica1',
      fullName: 'Mostrador',
      role: Role.OPTICIAN,
      active: true,
      opticianId: 'op-1',
    };
    const { service, actualizados } = servicio({
      users: [optico],
      opticians: [{ id: 'op-1', name: 'Óptica Centro' }],
    });
    await service.update('u-op', { role: Role.OPERATOR }, admin);
    expect(actualizados[0].data).toMatchObject({ optician: { disconnect: true } });
  });

  it('la contraseña nueva vuelve a pedir que la cambien al entrar', async () => {
    const { service, actualizados } = servicio({ users: [yo] });
    const { password } = await service.resetPassword('admin-1', admin);
    expect(password).toHaveLength(12);
    expect(actualizados[0].data).toMatchObject({ mustChangePassword: true });
  });
});
