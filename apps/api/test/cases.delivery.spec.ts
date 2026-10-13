import { BadRequestException } from '@nestjs/common';
import { CasesService } from '../src/cases/cases.service';

const author = { id: 'u1', username: 'operador', role: 'OPERATOR' as const };

/** Un expediente listo para entregar, de la persona que se indique. */
function build(person: Record<string, unknown>) {
  const audit = { record: jest.fn(), historyFor: jest.fn() };
  const upsert = jest.fn().mockResolvedValue({
    caseId: 'c1',
    deliveredAt: new Date('2026-10-13T12:00:00Z'),
    receivedBy: 'Daniela Villagra',
  });
  const updateMany = jest.fn().mockResolvedValue({ count: 2 });
  const prisma: Record<string, unknown> = {
    case: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'c1', personId: 'p1', stage: 'READY_FOR_PICKUP', opticianId: null }),
      update: jest.fn().mockResolvedValue({ id: 'c1', stage: 'DELIVERED' }),
    },
    person: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'p1', ...person }) },
    delivery: { upsert, findUnique: jest.fn().mockResolvedValue({ caseId: 'c1' }) },
    glasses: { updateMany },
    caseEvent: { create: jest.fn() },
    // moveStage mueve el expediente y escribe el evento en una transacción.
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new CasesService(prisma as any, audit as any);
  return { service, upsert, updateMany };
}

const entrega = {
  deliveredAt: '2026-10-13T12:00:00Z',
  receivedBy: 'Daniela Villagra',
};

describe('entrega de los anteojos de un menor', () => {
  it('no deja entregárselos al propio chico sin decir por qué', async () => {
    const { service } = build({ birthDate: new Date('2015-08-07') });

    await expect(
      service.registerDelivery('c1', { ...entrega, isRepresentative: false }, author),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('los entrega al tutor y guarda su DNI como respaldo', async () => {
    const { service, upsert } = build({ birthDate: new Date('2015-08-07') });

    await service.registerDelivery(
      'c1',
      { ...entrega, isRepresentative: true, receivedByDni: '27.884.102' },
      author,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ receivedByDni: '27884102', isRepresentative: true }),
      }),
    );
  });

  it('se los puede entregar al chico si queda escrito el motivo', async () => {
    const { service, upsert } = build({ birthDate: new Date('2015-08-07') });

    await service.registerDelivery(
      'c1',
      { ...entrega, isRepresentative: false, note: 'Vino solo al CAC, la madre autorizó' },
      author,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ note: 'Vino solo al CAC, la madre autorizó' }),
      }),
    );
  });

  it('una ficha sin fecha de nacimiento no frena la entrega', async () => {
    // No se sabe si es menor: acá se deja entregar, porque frenar la entrega de
    // la mayoría de los expedientes por un dato faltante sería peor.
    const { service, upsert } = build({ birthDate: null, ageAtIntake: null });

    await service.registerDelivery('c1', { ...entrega, receivedBy: 'Mirta Juárez' }, author);

    expect(upsert).toHaveBeenCalled();
  });

  it('un adulto retira sin que se le pida nada', async () => {
    const { service, upsert } = build({ birthDate: new Date('1984-03-11') });

    await service.registerDelivery('c1', { ...entrega, receivedBy: 'Mirta Juárez' }, author);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ receivedByDni: null }) }),
    );
  });

  it('deja los anteojos marcados como entregados', async () => {
    const { service, updateMany } = build({ birthDate: new Date('1984-03-11') });

    await service.registerDelivery('c1', entrega, author);

    expect(updateMany).toHaveBeenCalledWith({
      where: { caseId: 'c1' },
      data: { deliveredAt: new Date('2026-10-13T12:00:00Z') },
    });
  });
});
