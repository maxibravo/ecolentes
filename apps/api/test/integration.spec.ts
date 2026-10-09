import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { generateServiceKey, parseServiceKey } from '../src/integration/service-key';
import { ServiceClientGuard } from '../src/integration/service-client.guard';
import { IntegrationService } from '../src/integration/integration.service';

describe('claves de servicio', () => {
  it('arma una clave con prefijo reconocible y secreto aparte', () => {
    const { key, prefix, secret } = generateServiceKey();
    expect(key).toBe(`eco_${prefix}_${secret}`);
    expect(parseServiceKey(key)).toEqual({ prefix, secret });
  });

  it('vuelve a leer cualquier clave que emite', () => {
    // El secreto es base64url y a veces trae guiones bajos. Con pocas claves
    // esto pasa por casualidad, así que se prueban muchas.
    for (let i = 0; i < 200; i += 1) {
      const { key, prefix, secret } = generateServiceKey();
      expect(parseServiceKey(key)).toEqual({ prefix, secret });
    }
  });

  it('usa un prefijo sin guiones bajos, que son el separador', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateServiceKey().prefix).not.toContain('_');
    }
  });

  it('no emite dos claves iguales', () => {
    const claves = new Set(Array.from({ length: 50 }, () => generateServiceKey().key));
    expect(claves.size).toBe(50);
  });

  it('rechaza lo que no tiene la forma de una clave', () => {
    expect(parseServiceKey('')).toBeNull();
    expect(parseServiceKey('eco_solo-prefijo')).toBeNull();
    expect(parseServiceKey('otra_cosa_distinta')).toBeNull();
    // Un token de usuario no sirve acá, aunque sea válido en el resto de la API.
    expect(parseServiceKey('eyJhbGciOiJIUzI1NiJ9.abc.def')).toBeNull();
  });
});

type ClienteGuardado = {
  id: string;
  name: string;
  keyHash: string;
  active: boolean;
  revokedAt: Date | null;
};

function guardConClientes(clientes: Record<string, ClienteGuardado>) {
  const updates: unknown[] = [];
  const prisma = {
    serviceClient: {
      findUnique: async ({ where }: { where: { keyPrefix: string } }) =>
        clientes[where.keyPrefix] ?? null,
      update: async (args: unknown) => {
        updates.push(args);
        return null;
      },
    },
  };
  return { guard: new ServiceClientGuard(prisma as never), updates };
}

function contexto(headers: Record<string, string | undefined>) {
  const request: Record<string, unknown> = { headers };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never,
  };
}

describe('ServiceClientGuard', () => {
  it('deja pasar a un sistema con credencial válida y anota el uso', async () => {
    const { key, prefix, secret } = generateServiceKey();
    const { guard, updates } = guardConClientes({
      [prefix]: {
        id: 'cli-1',
        name: 'Sistema municipal',
        keyHash: await argon2.hash(secret),
        active: true,
        revokedAt: null,
      },
    });

    const { request, context } = contexto({ 'x-api-key': key });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.serviceClient).toEqual({ id: 'cli-1', name: 'Sistema municipal' });
    expect(updates).toHaveLength(1);
  });

  it('no deja pasar sin credencial', async () => {
    const { guard } = guardConClientes({});
    const { context } = contexto({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('no deja pasar con el secreto cambiado, aunque el prefijo exista', async () => {
    const { prefix, secret } = generateServiceKey();
    const { guard } = guardConClientes({
      [prefix]: {
        id: 'cli-1',
        name: 'Sistema municipal',
        keyHash: await argon2.hash(secret),
        active: true,
        revokedAt: null,
      },
    });

    const { context } = contexto({ 'x-api-key': `eco_${prefix}_otro-secreto` });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('no deja pasar una credencial dada de baja', async () => {
    const { key, prefix, secret } = generateServiceKey();
    const { guard } = guardConClientes({
      [prefix]: {
        id: 'cli-1',
        name: 'Sistema municipal',
        keyHash: await argon2.hash(secret),
        active: false,
        revokedAt: new Date(),
      },
    });

    const { context } = contexto({ 'x-api-key': key });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('lo que la API del municipio devuelve', () => {
  const cliente = { id: 'cli-1', name: 'Sistema municipal' };

  function servicio(opciones: {
    cases?: { createdAt: Date; pairs: number; stage?: string }[];
    deliveries?: { deliveredAt: Date; pairs: number }[];
  }) {
    const auditado: { entityId?: string | null; username?: string | null }[] = [];
    const prisma = {
      case: { findMany: async () => opciones.cases ?? [] },
      delivery: {
        findMany: async () =>
          (opciones.deliveries ?? []).map((d) => ({
            deliveredAt: d.deliveredAt,
            case: { pairs: d.pairs },
          })),
      },
    };
    const audit = {
      record: async (entry: { entityId?: string | null; username?: string | null }) => {
        auditado.push(entry);
      },
    };
    const reports = { summaryData: async (shareable: boolean) => ({ shareable }) };
    return {
      service: new IntegrationService(prisma as never, audit as never, reports as never),
      auditado,
    };
  }

  it('pide el resumen siempre en su versión compartible', async () => {
    const { service } = servicio({});
    await expect(service.summary(cliente)).resolves.toEqual({ shareable: true });
  });

  it('registra cada consulta a nombre del sistema que la hizo', async () => {
    const { service, auditado } = servicio({});
    await service.summary(cliente);
    expect(auditado).toHaveLength(1);
    expect(auditado[0].username).toBe('servicio:Sistema municipal');
    expect(auditado[0].entityId).toBe('resumen');
  });

  it('tapa los meses de uno y dos casos, como los barrios chicos', async () => {
    const ahora = new Date();
    const { service } = servicio({
      cases: [
        { createdAt: ahora, pairs: 1 },
        { createdAt: ahora, pairs: 1 },
      ],
      deliveries: [],
    });

    const { serie } = await service.monthly({ months: 1 }, cliente);
    expect(serie).toHaveLength(1);
    expect(serie[0].requests).toBeNull();
  });

  it('devuelve un mes sin movimiento como cero y no como tapado', async () => {
    const { service } = servicio({ cases: [], deliveries: [] });
    const { serie } = await service.monthly({ months: 1 }, cliente);
    expect(serie[0].requests).toBe(0);
    expect(serie[0].deliveries).toBe(0);
  });

  it('acota la cantidad de meses que se pueden pedir', async () => {
    const { service } = servicio({ cases: [], deliveries: [] });
    await expect(service.monthly({ months: 999 }, cliente)).resolves.toMatchObject({ months: 60 });
    await expect(service.monthly({ months: 0 }, cliente)).resolves.toMatchObject({ months: 12 });
    await expect(service.monthly({}, cliente)).resolves.toMatchObject({ months: 12 });
  });
});

describe('los anteojos se ocultan junto con los casos', () => {
  const cliente = { id: 'cli-1', name: 'Sistema municipal' };

  function servicioCon(cases: { createdAt: Date; pairs: number }[]) {
    const prisma = {
      case: { findMany: async () => cases },
      delivery: { findMany: async () => [] },
    };
    const audit = { record: async () => undefined };
    const reports = { summaryData: async () => ({}) };
    return new IntegrationService(prisma as never, audit as never, reports as never);
  }

  it('no deja ver la cantidad de anteojos de un mes con un solo caso', async () => {
    const ahora = new Date();
    // Un caso puede pedir varios pares, así que el número de anteojos pasaría
    // el umbral por su cuenta y confirmaría que ahí hubo alguien.
    const service = servicioCon([{ createdAt: ahora, pairs: 4 }]);
    const { serie } = await service.monthly({ months: 1 }, cliente);
    expect(serie[0].requests).toBeNull();
    expect(serie[0].requestedPairs).toBeNull();
  });

  it('deja ver los dos números cuando hay casos suficientes', async () => {
    const ahora = new Date();
    const service = servicioCon([
      { createdAt: ahora, pairs: 1 },
      { createdAt: ahora, pairs: 2 },
      { createdAt: ahora, pairs: 1 },
    ]);
    const { serie } = await service.monthly({ months: 1 }, cliente);
    expect(serie[0].requests).toBe(3);
    expect(serie[0].requestedPairs).toBe(4);
  });
});
