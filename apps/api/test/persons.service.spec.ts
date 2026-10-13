import { ConflictException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PersonsService } from '../src/persons/persons.service';

const author = { id: 'u1', username: 'operador', role: 'OPERATOR' as const };

function build(personFindUnique: jest.Mock, personCreate = jest.fn(), personUpdate = jest.fn()) {
  const audit = { record: jest.fn(), historyFor: jest.fn() };
  const prisma = {
    person: { findUnique: personFindUnique, create: personCreate, update: personUpdate },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new PersonsService(prisma as any, audit as any);
  return { service, audit, personCreate, personUpdate };
}

describe('PersonsService.create', () => {
  it('no crea una segunda ficha para el mismo DNI y devuelve la que ya existe', async () => {
    const { service } = build(jest.fn().mockResolvedValue({ id: 'p1', dni: '31620034' }));

    await expect(
      service.create({ dni: '31.620.034', firstName: 'Carolina', lastName: 'Rojas' }, author),
    ).rejects.toMatchObject({
      response: { personId: 'p1' },
    });
  });

  it('guarda el DNI sin puntos aunque venga con el formato de la planilla', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p2' });
    const { service } = build(jest.fn().mockResolvedValue(null), create);

    await service.create({ dni: '24.059.914', firstName: 'Claudia', lastName: 'D Mayo' }, author);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dni: '24059914' }) }),
    );
  });

  it('deja registro de quién creó la ficha', async () => {
    const { service, audit } = build(
      jest.fn().mockResolvedValue(null),
      jest.fn().mockResolvedValue({ id: 'p3' }),
    );

    await service.create({ dni: '9876543', firstName: 'Ana', lastName: 'Gómez' }, author);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entity: 'Person',
        entityId: 'p3',
        userId: 'u1',
      }),
    );
  });

  it('sólo guarda la edad junto con la fecha en que se tomó', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p4' });
    const { service } = build(jest.fn().mockResolvedValue(null), create);

    await service.create(
      { dni: '9876543', firstName: 'Ana', lastName: 'Gómez', ageAtIntake: 44 },
      author,
    );

    const data = create.mock.calls[0][0].data;
    expect(data.ageAtIntake).toBe(44);
    expect(data.ageTakenAt).toBeInstanceOf(Date);
  });
});

describe('ConflictException', () => {
  it('es el error que usa el formulario para ofrecer abrir la ficha existente', async () => {
    const { service } = build(jest.fn().mockResolvedValue({ id: 'p1' }));
    await expect(
      service.create({ dni: '31620034', firstName: 'A', lastName: 'B' }, author),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PersonsService.update', () => {
  const stored = {
    id: 'p1',
    dni: '31620034',
    firstName: 'Carolina',
    lastName: 'Rojas',
    phone: '3815551234',
    neighborhood: 'B ALBERDI',
    birthDate: null,
    ageAtIntake: 44,
  };

  it('no borra los datos que la edición no manda', async () => {
    const update = jest.fn().mockResolvedValue({ ...stored, firstName: 'Carolina del Huerto' });
    const { service } = build(jest.fn().mockResolvedValue(stored), jest.fn(), update);

    await service.update('p1', { firstName: 'Carolina del Huerto' }, author);

    const data = update.mock.calls[0][0].data;
    // searchName acompaña al nombre: es lo que se busca cuando nadie escribe
    // los acentos, y tiene que quedar al día con el apellido que ya estaba.
    expect(data).toEqual({ firstName: 'Carolina del Huerto', searchName: 'rojas carolina del huerto' });
    expect(data).not.toHaveProperty('phone');
    expect(data).not.toHaveProperty('neighborhood');
  });

  it('recalcula searchName sin acentos cuando cambia el apellido', async () => {
    const update = jest.fn().mockResolvedValue({ ...stored, lastName: 'Ibáñez' });
    const { service } = build(jest.fn().mockResolvedValue(stored), jest.fn(), update);

    await service.update('p1', { lastName: 'Ibáñez' }, author);

    expect(update.mock.calls[0][0].data.searchName).toBe('ibanez carolina');
  });

  it('no toca searchName cuando la edición no cambia el nombre', async () => {
    const update = jest.fn().mockResolvedValue({ ...stored, phone: '3815550000' });
    const { service } = build(jest.fn().mockResolvedValue(stored), jest.fn(), update);

    await service.update('p1', { phone: '3815550000' }, author);

    expect(update.mock.calls[0][0].data).not.toHaveProperty('searchName');
  });

  it('deja vaciar un campo a propósito cuando llega en blanco', async () => {
    const update = jest.fn().mockResolvedValue({ ...stored, phone: null });
    const { service } = build(jest.fn().mockResolvedValue(stored), jest.fn(), update);

    await service.update('p1', { phone: '  ' }, author);

    expect(update.mock.calls[0][0].data).toEqual({ phone: null });
  });

  it('anota en la auditoría sólo lo que realmente cambió', async () => {
    const update = jest.fn().mockResolvedValue({ ...stored, phone: '3819998888' });
    const { service, audit } = build(jest.fn().mockResolvedValue(stored), jest.fn(), update);

    await service.update('p1', { phone: '3819998888' }, author);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        changes: { phone: { de: '3815551234', a: '3819998888' } },
      }),
    );
  });
});

describe('PersonsService.search', () => {
  /** El buscador con una ficha y los expedientes que se le indiquen. */
  function buildSearch(person: Record<string, unknown>, cases: unknown[]) {
    const audit = { record: jest.fn(), historyFor: jest.fn() };
    const findMany = jest.fn().mockResolvedValue(cases);
    const personFindMany = jest.fn().mockResolvedValue([{ id: 'p1', dni: '47220185', ...person }]);
    const prisma = { person: { findMany: personFindMany }, case: { findMany } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { service: new PersonsService(prisma as any, audit as any), findMany, personFindMany };
  }

  const caso = (over: Record<string, unknown> = {}) => ({
    id: 'c1',
    code: 'ECO-0001',
    personId: 'p1',
    stage: 'READY_FOR_PICKUP',
    hold: null,
    pairs: 2,
    stageSince: new Date('2026-10-01T12:00:00Z'),
    createdAt: new Date('2026-09-01T12:00:00Z'),
    glasses: [
      { code: 'ANT-0001', kind: 'LEJOS', deliveredAt: null },
      { code: 'ANT-0002', kind: 'CERCA', deliveredAt: null },
    ],
    ...over,
  });

  it('dice que nunca pidió anteojos cuando no tiene ningún expediente', async () => {
    const { service } = buildSearch({ birthDate: new Date('1984-03-11') }, []);

    const [row] = await service.search({ q: '472' });

    expect(row!.summary).toMatchObject({ cases: 0, pairsRequested: 0, pairsDelivered: 0 });
    expect(row!.summary.openCase).toBeNull();
  });

  it('trae el expediente en curso con su etapa y sus anteojos', async () => {
    const { service } = buildSearch({ birthDate: new Date('2015-08-07') }, [caso()]);

    const [row] = await service.search({ q: '47220185' });

    expect(row!.summary.isMinor).toBe(true);
    expect(row!.summary.openCase).toMatchObject({ code: 'ECO-0001', stage: 'READY_FOR_PICKUP' });
    expect(row!.summary.openCase!.glasses.map((g) => g.code)).toEqual(['ANT-0001', 'ANT-0002']);
    expect(row!.summary.pairsRequested).toBe(2);
    expect(row!.summary.pairsDelivered).toBe(0);
  });

  it('cuenta los pares entregados y no muestra el expediente cerrado como en curso', async () => {
    const entregado = new Date('2026-08-20T12:00:00Z');
    const { service } = buildSearch({ birthDate: new Date('1984-03-11') }, [
      caso({
        stage: 'CLOSED',
        glasses: [
          { code: 'ANT-0001', kind: 'LEJOS', deliveredAt: entregado },
          { code: 'ANT-0002', kind: 'CERCA', deliveredAt: entregado },
        ],
      }),
    ]);

    const [row] = await service.search({});

    expect(row!.summary.openCase).toBeNull();
    expect(row!.summary.pairsDelivered).toBe(2);
    expect(row!.summary.lastDeliveryAt).toEqual(entregado);
  });

  it('pide los expedientes de todas las fichas en una sola consulta', async () => {
    const { service, findMany } = buildSearch({ birthDate: null, ageAtIntake: null }, [caso()]);

    await service.search({ q: 'juarez' });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId: { in: ['p1'] } } }),
    );
  });

  it('sin fecha de nacimiento ni edad no afirma que sea mayor', async () => {
    const { service } = buildSearch({ birthDate: null, ageAtIntake: null }, []);

    const [row] = await service.search({});

    expect(row!.summary.isMinor).toBeNull();
    expect(row!.summary.age).toBeNull();
  });

  it('ordena por el nombre sin acentos, para que Ávila no quede al final', async () => {
    const { service, personFindMany } = buildSearch({ birthDate: null, ageAtIntake: null }, []);

    await service.search({});

    expect(personFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { searchName: 'asc' } }),
    );
  });

  it('trae la página que se le pide', async () => {
    const { service, personFindMany } = buildSearch({ birthDate: null, ageAtIntake: null }, []);

    await service.search({ skip: 50, take: 26 });

    expect(personFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 26 }));
  });

  it('sin página pedida arranca de la primera', async () => {
    const { service, personFindMany } = buildSearch({ birthDate: null, ageAtIntake: null }, []);

    await service.search({});

    expect(personFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });
});
