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
