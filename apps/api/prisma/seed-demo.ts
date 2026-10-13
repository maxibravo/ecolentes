/**
 * Carga datos de ejemplo para mostrar el sistema andando: usuarios de cada rol,
 * una óptica, operativos y expedientes en todas las etapas. **Las personas, los
 * DNI, los teléfonos y las graduaciones son inventados**; los barrios son los de
 * San Miguel de Tucumán.
 *
 * No se corre solo. Hay que pedirlo:
 *   DEMO_SEED=si pnpm --filter @ecolentes/api prisma:seed-demo
 *
 * Borra y rehace los expedientes de ejemplo, así que nunca va a un ambiente con
 * datos reales.
 */
import { PrismaClient, type CaseStage } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  DEMO_CASES,
  DEMO_OPERATIONS,
  DEMO_OPTICIAN,
  DEMO_PEOPLE,
  DEMO_USERS,
  glassesKindsFromText,
  pairsFromText,
  parsePrescription,
  type DemoCase,
} from '@ecolentes/shared';
import { searchText } from '../src/common/search-text';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'ecolentes2026';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function main() {
  if (process.env.DEMO_SEED !== 'si' && process.env.DEMO_SEED !== 'yes') {
    console.error('Este seed carga datos inventados. Para correrlo: DEMO_SEED=si');
    process.exitCode = 1;
    return;
  }

  const optician = await prisma.optician.upsert({
    where: { name: DEMO_OPTICIAN.name },
    create: DEMO_OPTICIAN,
    update: DEMO_OPTICIAN,
  });

  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const users: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { username: u.username },
      create: {
        ...u,
        passwordHash,
        mustChangePassword: false,
        opticianId: u.role === 'OPTICIAN' ? optician.id : null,
      },
      update: { fullName: u.fullName, role: u.role, mustChangePassword: false },
    });
    users[u.role] = user.id;
  }

  const operations: Record<string, string> = {};
  for (const o of DEMO_OPERATIONS) {
    const found =
      (await prisma.operation.findFirst({ where: { name: o.name } })) ??
      (await prisma.operation.create({
        data: {
          name: o.name,
          date: daysAgo(o.daysAgo),
          ophthalmologistId: users.OPHTHALMOLOGIST ?? null,
        },
      }));
    operations[o.name] = found.id;
  }

  const people: Record<string, string> = {};
  for (const p of DEMO_PEOPLE) {
    const data = {
      firstName: p.firstName,
      lastName: p.lastName,
      searchName: searchText(p.lastName, p.firstName),
      birthDate: p.birthDate ? new Date(p.birthDate) : null,
      sex: p.sex ?? null,
      phone: p.phone ?? null,
      neighborhood: p.neighborhood,
      identityVerified: p.identityVerified ?? true,
      representativeName: p.representativeName ?? null,
      representativeBond: p.representativeBond ?? null,
      createdById: users.OPERATOR ?? null,
    };
    const person = await prisma.person.upsert({
      where: { dni: p.dni },
      create: { dni: p.dni, ...data },
      update: data,
    });
    people[p.dni] = person.id;
  }

  // Se rehacen desde cero para que correrlo dos veces no deje duplicados.
  const codes = DEMO_CASES.map((_, i) => `ECO-${String(i + 1).padStart(4, '0')}`);
  await prisma.case.deleteMany({ where: { code: { in: codes } } });

  // El número de anteojo corre aparte del de expediente: un expediente de
  // lejos y cerca son dos anteojos, y uno sin aprobar todavía no tiene ninguno.
  let glassesCode = 0;
  for (const [index, demo] of DEMO_CASES.entries()) {
    glassesCode = await createCase(
      codes[index]!,
      demo,
      people,
      operations,
      users,
      optician.id,
      glassesCode,
    );
  }

  console.log(`Listo: ${DEMO_CASES.length} expedientes de ejemplo.`);
  console.log(`Usuarios: ${DEMO_USERS.map((u) => u.username).join(', ')}`);
  console.log(`Contraseña de todos: ${DEMO_PASSWORD}`);
}

async function createCase(
  code: string,
  demo: DemoCase,
  people: Record<string, string>,
  operations: Record<string, string>,
  users: Record<string, string>,
  opticianId: string,
  glassesCode: number,
): Promise<number> {
  const personId = people[demo.dni]!;
  const stageSince = daysAgo(demo.daysInStage);

  const created = await prisma.case.create({
    data: {
      code,
      personId,
      stage: demo.stage,
      hold: demo.hold ?? null,
      holdNote: demo.holdNote ?? null,
      channel: demo.channel,
      socialNetwork: demo.socialNetwork ?? null,
      operationId: demo.operation ? operations[demo.operation] ?? null : null,
      opticianId,
      pairs: demo.prescription ? pairsFromText(demo.prescription) : 1,
      reason: demo.reason,
      stageSince,
      closedAt: demo.stage === 'CLOSED' ? stageSince : null,
      createdById: users.OPERATOR ?? null,
      createdAt: daysAgo(demo.daysInStage + 20),
    },
  });

  if (demo.prescription) {
    const parsed = parsePrescription(demo.prescription);
    await prisma.prescription.create({
      data: {
        caseId: created.id,
        rawText: demo.prescription,
        ...asDecimals(parsed),
        validatedById: users.OPHTHALMOLOGIST ?? null,
        validatedAt: daysAgo(demo.daysInStage + 14),
      },
    });
  }

  for (const [i, q] of (demo.quotes ?? []).entries()) {
    const isLast = i === (demo.quotes?.length ?? 0) - 1;
    await prisma.quote.create({
      data: {
        caseId: created.id,
        version: i + 1,
        opticianId,
        lenses: q.lenses,
        frame: q.frame,
        leadDays: q.leadDays ?? null,
        amount: q.amount ?? null,
        status: q.observedNote ? 'OBSERVED' : isLast && isPastApproval(demo.stage) ? 'APPROVED' : 'SUBMITTED',
        decidedById: q.observedNote || isPastApproval(demo.stage) ? users.DIRECTOR ?? null : null,
        decidedAt: q.observedNote || isPastApproval(demo.stage) ? daysAgo(demo.daysInStage + 6) : null,
        decisionNote: q.observedNote ?? null,
        createdAt: daysAgo(demo.daysInStage + 8 - i),
      },
    });
  }

  if (demo.delivery) {
    await prisma.delivery.create({
      data: {
        caseId: created.id,
        deliveredAt: daysAgo(demo.delivery.daysAgo),
        receivedBy: demo.delivery.receivedBy,
        isRepresentative: demo.delivery.isRepresentative ?? false,
        handedById: users.OPERATOR ?? null,
      },
    });
  }

  // Los anteojos existen desde que Dirección aprueba la propuesta.
  if (isPastApproval(demo.stage)) {
    for (const kind of glassesKindsFromText(demo.prescription ?? '')) {
      await prisma.glasses.create({
        data: {
          caseId: created.id,
          code: `ANT-${String(++glassesCode).padStart(4, '0')}`,
          kind,
          deliveredAt: demo.delivery ? daysAgo(demo.delivery.daysAgo) : null,
        },
      });
    }
  }

  // Un historial mínimo: la solicitud y la etapa en la que quedó.
  await prisma.caseEvent.createMany({
    data: [
      {
        caseId: created.id,
        toStage: 'REQUEST',
        note: 'Solicitud cargada',
        userId: users.OPERATOR ?? null,
        username: 'operador',
        occurredAt: daysAgo(demo.daysInStage + 20),
      },
      ...(demo.stage === 'REQUEST'
        ? []
        : [
            {
              caseId: created.id,
              toStage: demo.stage,
              note: demo.holdNote ?? null,
              userId: users.OPERATOR ?? null,
              username: 'operador',
              occurredAt: stageSince,
            },
          ]),
    ],
  });

  return glassesCode;
}

const PAST_APPROVAL: CaseStage[] = ['PRODUCTION', 'RECEIVED', 'READY_FOR_PICKUP', 'DELIVERED', 'CLOSED'];
function isPastApproval(stage: CaseStage): boolean {
  return PAST_APPROVAL.includes(stage);
}

/** Lo que se interpretó de la receta; null en lo que no se pudo leer. */
function asDecimals(parsed: ReturnType<typeof parsePrescription>): Record<string, number | null> {
  return {
    farRightSphere: parsed.farRightSphere,
    farRightCylinder: parsed.farRightCylinder,
    farRightAxis: parsed.farRightAxis,
    farLeftSphere: parsed.farLeftSphere,
    farLeftCylinder: parsed.farLeftCylinder,
    farLeftAxis: parsed.farLeftAxis,
    nearAddition: parsed.nearAddition,
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
