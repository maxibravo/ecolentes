import { CaseStage } from '@prisma/client';
import { ReportsService } from '../src/reports/reports.service';

const operador = { id: 'u1', username: 'operador', role: 'OPERATOR' as const };
const director = { id: 'u2', username: 'direccion', role: 'DIRECTOR' as const };

const hoy = new Date();

type Pair = { code: string; kind: 'LEJOS' | 'CERCA' };

function caseWith(over: {
  id: string;
  code: string;
  stage: CaseStage;
  pairs: number;
  glasses: Pair[];
  neighborhood?: string | null;
}) {
  return {
    hold: null,
    stageSince: hoy,
    optician: { name: 'Óptica Central' },
    person: {
      firstName: 'Thiago',
      lastName: 'Villagra',
      dni: '55123456',
      neighborhood: over.neighborhood ?? 'Villa 9 de Julio',
    },
    ...over,
  };
}

function build(cases: ReturnType<typeof caseWith>[]) {
  const findMany = jest.fn().mockResolvedValue(cases);
  const audit = { record: jest.fn() };
  const prisma = { case: { findMany } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new ReportsService(prisma as any, audit as any), findMany, audit };
}

describe('ReportsService.pending', () => {
  it('cuenta los pares por anteojo y separa los controlados de los que acaban de llegar', async () => {
    const { service } = build([
      caseWith({
        id: 'c1',
        code: 'ECO-0001',
        stage: CaseStage.READY_FOR_PICKUP,
        pairs: 2,
        glasses: [
          { code: 'ANT-0001', kind: 'LEJOS' },
          { code: 'ANT-0002', kind: 'CERCA' },
        ],
      }),
      caseWith({
        id: 'c2',
        code: 'ECO-0002',
        stage: CaseStage.RECEIVED,
        pairs: 1,
        glasses: [{ code: 'ANT-0003', kind: 'LEJOS' }],
      }),
      caseWith({
        id: 'c3',
        code: 'ECO-0003',
        stage: CaseStage.PRODUCTION,
        pairs: 1,
        glasses: [{ code: 'ANT-0004', kind: 'LEJOS' }],
      }),
    ]);

    const report = await service.pending(operador);

    expect(report.totals.readyPairs).toBe(2);
    expect(report.totals.readyCases).toBe(1);
    expect(report.totals.toCheckPairs).toBe(1);
    expect(report.totals.toCheckCases).toBe(1);
    // En el municipio están los dos grupos juntos, no los de la óptica.
    expect(report.totals.inHousePairs).toBe(3);
    expect(report.totals.atOpticianPairs).toBe(1);
  });

  it('pide sólo los anteojos sin entregar, para que no se cuente dos veces un par ya entregado', async () => {
    const { service, findMany } = build([]);

    await service.pending(operador);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          glasses: expect.objectContaining({ where: { deliveredAt: null } }),
        }),
      }),
    );
  });

  it('lista cada par con su código, al lado de su expediente', async () => {
    const { service } = build([
      caseWith({
        id: 'c1',
        code: 'ECO-0004',
        stage: CaseStage.READY_FOR_PICKUP,
        pairs: 2,
        glasses: [
          { code: 'ANT-0007', kind: 'LEJOS' },
          { code: 'ANT-0008', kind: 'CERCA' },
        ],
      }),
    ]);

    const report = await service.pending(operador);
    const row = report.byNeighborhood[0]!.rows[0]!;

    expect(report.byNeighborhood[0]!.neighborhood).toBe('Villa 9 de Julio');
    expect(row.glasses.map((pair) => pair.code)).toEqual(['ANT-0007', 'ANT-0008']);
    expect(row.person).toEqual({ name: 'Villagra, Thiago', dni: '55123456' });
  });

  it('cuenta los pares declarados cuando el expediente no tiene anteojos numerados', async () => {
    // Expedientes viejos, de antes de que los anteojos tuvieran código: tienen
    // que seguir apareciendo en la lista de la caja.
    const { service } = build([
      caseWith({
        id: 'c1',
        code: 'ECO-0005',
        stage: CaseStage.READY_FOR_PICKUP,
        pairs: 2,
        glasses: [],
      }),
    ]);

    const report = await service.pending(operador);

    expect(report.totals.readyPairs).toBe(2);
    expect(report.byNeighborhood[0]!.rows[0]!.pairs).toBe(2);
  });

  it('no le muestra a Dirección a quién le corresponde cada par', async () => {
    const { service } = build([
      caseWith({
        id: 'c1',
        code: 'ECO-0006',
        stage: CaseStage.RECEIVED,
        pairs: 1,
        glasses: [{ code: 'ANT-0009', kind: 'LEJOS' }],
      }),
    ]);

    const report = await service.pending(director);

    expect(report.nominal).toBe(false);
    expect(report.byNeighborhood[0]!.rows[0]!.person).toBeNull();
    // El código del anteojo sí: es lo que se cuenta contra la caja.
    expect(report.byNeighborhood[0]!.rows[0]!.glasses[0]!.code).toBe('ANT-0009');
  });
});
