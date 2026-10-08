import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, type Person } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { normalizeDni } from '../common/dni';
import { searchText } from '../common/search-text';
import type { AuthenticatedUser } from '../common/current-user';
import type { CreatePersonDto, SearchPersonDto, UpdatePersonDto } from './dto';

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Busca por DNI o por nombre. Es lo que se usa antes de crear una ficha,
   * para no terminar con la misma persona cargada dos veces.
   */
  async search(params: SearchPersonDto) {
    const take = params.take ?? 20;
    const q = params.q?.trim();
    const where: Prisma.PersonWhereInput = {};

    if (q) {
      const digits = normalizeDni(q);
      where.OR = [
        ...(digits.length >= 3 ? [{ dni: { contains: digits } }] : []),
        // Contra searchName, que no tiene acentos: "juarez" encuentra a Juárez.
        { searchName: { contains: searchText(q) } },
      ];
    }
    if (params.neighborhood) {
      where.neighborhood = { equals: params.neighborhood, mode: Prisma.QueryMode.insensitive };
    }

    return this.prisma.person.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take,
    });
  }

  /** La ficha exacta de un DNI, o null. La usa el formulario de carga. */
  async findByDni(dni: string): Promise<Person | null> {
    return this.prisma.person.findUnique({ where: { dni: normalizeDni(dni) } });
  }

  async findById(id: string, viewer: AuthenticatedUser): Promise<Person> {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) throw new NotFoundException('No existe esa ficha');

    await this.audit.record({
      action: AuditAction.VIEW,
      entity: 'Person',
      entityId: person.id,
      userId: viewer.id,
      username: viewer.username,
    });

    return person;
  }

  async create(dto: CreatePersonDto, author: AuthenticatedUser): Promise<Person> {
    const dni = normalizeDni(dto.dni);

    const existing = await this.prisma.person.findUnique({ where: { dni } });
    if (existing) {
      throw new ConflictException({
        message: 'Ya existe una ficha con ese DNI',
        personId: existing.id,
      });
    }

    const person = await this.prisma.person.create({
      data: {
        ...this.toData(dto),
        dni,
        createdById: author.id,
      },
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entity: 'Person',
      entityId: person.id,
      userId: author.id,
      username: author.username,
    });

    return person;
  }

  async update(id: string, dto: UpdatePersonDto, author: AuthenticatedUser): Promise<Person> {
    const before = await this.prisma.person.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('No existe esa ficha');

    const person = await this.prisma.person.update({
      where: { id },
      data: this.toPatchData(dto, before),
    });

    const changes = diff(before, person);
    if (Object.keys(changes).length > 0) {
      await this.audit.record({
        action: AuditAction.UPDATE,
        entity: 'Person',
        entityId: person.id,
        userId: author.id,
        username: author.username,
        changes,
      });
    }

    return person;
  }

  history(personId: string) {
    return this.audit.historyFor('Person', personId);
  }

  /** Alta: lo que no vino queda vacío, porque la ficha no existía. */
  private toData(dto: CreatePersonDto) {
    return {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      searchName: searchText(dto.lastName, dto.firstName),
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      ageAtIntake: dto.ageAtIntake ?? null,
      // La edad sólo sirve si se sabe cuándo se tomó.
      ageTakenAt: dto.ageAtIntake != null ? new Date() : null,
      sex: dto.sex ?? null,
      phone: clean(dto.phone),
      address: clean(dto.address),
      neighborhood: clean(dto.neighborhood),
      representativeName: clean(dto.representativeName),
      representativePhone: clean(dto.representativePhone),
      representativeBond: clean(dto.representativeBond),
      notes: clean(dto.notes),
    };
  }

  /**
   * Edición: sólo toca los campos que vinieron. Si se armara el objeto
   * completo, una edición parcial borraría el teléfono o el barrio que
   * alguien cargó antes, sin que nadie se entere.
   */
  private toPatchData(dto: UpdatePersonDto, before: Person): Prisma.PersonUpdateInput {
    const data: Prisma.PersonUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      data.searchName = searchText(dto.lastName ?? before.lastName, dto.firstName ?? before.firstName);
    }
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.ageAtIntake !== undefined) {
      data.ageAtIntake = dto.ageAtIntake;
      data.ageTakenAt = dto.ageAtIntake != null ? new Date() : null;
    }
    if (dto.sex !== undefined) data.sex = dto.sex;
    if (dto.phone !== undefined) data.phone = clean(dto.phone);
    if (dto.address !== undefined) data.address = clean(dto.address);
    if (dto.neighborhood !== undefined) data.neighborhood = clean(dto.neighborhood);
    if (dto.representativeName !== undefined) {
      data.representativeName = clean(dto.representativeName);
    }
    if (dto.representativePhone !== undefined) {
      data.representativePhone = clean(dto.representativePhone);
    }
    if (dto.representativeBond !== undefined) {
      data.representativeBond = clean(dto.representativeBond);
    }
    if (dto.notes !== undefined) data.notes = clean(dto.notes);

    return data;
  }
}

/** Qué cambió, para dejarlo en la auditoría sin guardar la ficha entera. */
function diff(before: Person, after: Person): Prisma.JsonObject {
  const changes: Prisma.JsonObject = {};
  // searchName se deriva del nombre: anotarlo sería repetir el mismo cambio.
  const skip = new Set(['updatedAt', 'createdAt', 'id', 'searchName']);

  for (const key of Object.keys(after) as (keyof Person)[]) {
    if (skip.has(key)) continue;
    const previous = before[key];
    const current = after[key];
    const same =
      previous instanceof Date && current instanceof Date
        ? previous.getTime() === current.getTime()
        : previous === current;
    if (!same) changes[key] = { de: serialize(previous), a: serialize(current) };
  }
  return changes;
}

function serialize(value: unknown): Prisma.JsonValue {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value as Prisma.JsonValue;
}

/** Texto vacío y texto en blanco se guardan como "sin dato". */
function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
