import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentKind, AuditAction, Prisma } from '@prisma/client';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_TYPES,
  attachmentBelongsToPerson,
  canUploadAttachment,
  seesAttachment,
} from '@ecolentes/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/current-user';
import type { UploadAttachmentDto } from './dto';

/** Lo que se devuelve de una imagen sin mandar la imagen. */
const METADATA = {
  id: true,
  kind: true,
  mimeType: true,
  bytes: true,
  createdAt: true,
  personId: true,
  caseId: true,
} satisfies Prisma.AttachmentSelect;

export type AttachmentMetadata = Prisma.AttachmentGetPayload<{ select: typeof METADATA }>;

/** Las primeras firmas de cada formato, para no creerle al navegador. */
const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/webp': (b) =>
    b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Dónde quedan los archivos. Fuera de la base, porque una base con fotos
   * adentro se vuelve impracticable de respaldar, y fuera de la carpeta que
   * sirve la web, porque estas imágenes no se piden por URL: se piden por la
   * API, que es la que sabe quién puede verlas.
   */
  private get directory(): string {
    return resolve(process.env.UPLOADS_DIR ?? 'uploads');
  }

  /**
   * Guarda una foto. Si ya había una del mismo tipo, la reemplaza: sacarla de
   * nuevo es lo que se hace cuando salió movida, y dos fotos del mismo DNI no
   * le sirven a nadie.
   */
  async upload(dto: UploadAttachmentDto, author: AuthenticatedUser): Promise<AttachmentMetadata> {
    const kind = dto.kind as AttachmentKind;
    if (!canUploadAttachment(author.role, kind)) {
      throw new ForbiddenException('Tu rol no puede cargar esta imagen');
    }

    const target = await this.resolveTarget(dto, kind);
    const { bytes, mimeType } = decodeDataUrl(dto.dataUrl);

    await mkdir(this.directory, { recursive: true });
    const storageKey = `${randomUUID()}.${mimeType.replace('image/', '')}`;
    await writeFile(join(this.directory, storageKey), bytes, { mode: 0o600 });

    try {
      const saved = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.attachment.findMany({ where: { ...target, kind } });
        if (previous.length > 0) {
          await tx.attachment.deleteMany({ where: { id: { in: previous.map((a) => a.id) } } });
        }
        const created = await tx.attachment.create({
          data: {
            kind,
            ...target,
            mimeType,
            bytes: bytes.length,
            storageKey,
            uploadedById: author.id,
          },
          select: METADATA,
        });
        return { created, previous };
      });

      // Los archivos de las fotos reemplazadas se borran después de que la base
      // confirmó el cambio: al revés, un error dejaría una ficha apuntando a un
      // archivo que ya no está.
      await Promise.all(saved.previous.map((old) => this.removeFile(old.storageKey)));

      await this.audit.record({
        action: AuditAction.CREATE,
        entity: 'Attachment',
        entityId: saved.created.id,
        userId: author.id,
        username: author.username,
        changes: { tipo: kind, reemplazó: saved.previous.length },
      });

      return saved.created;
    } catch (error) {
      await this.removeFile(storageKey);
      throw error;
    }
  }

  /** La imagen en sí. Cada vez que alguien la mira queda registrado. */
  async read(id: string, viewer: AuthenticatedUser) {
    const found = await this.prisma.attachment.findUnique({
      where: { id },
      include: { case: { select: { opticianId: true } } },
    });
    if (!found) throw new NotFoundException('No existe esa imagen');
    this.assertCanSee(found.kind, found.case?.opticianId ?? null, viewer);

    let bytes: Buffer;
    try {
      bytes = await readFile(join(this.directory, found.storageKey));
    } catch (error) {
      this.logger.error(`Falta el archivo de la imagen ${found.id}`, error as Error);
      throw new NotFoundException('La imagen quedó registrada pero el archivo no está');
    }

    await this.audit.record({
      action: AuditAction.VIEW,
      entity: 'Attachment',
      entityId: found.id,
      userId: viewer.id,
      username: viewer.username,
      changes: { tipo: found.kind },
    });

    return {
      id: found.id,
      kind: found.kind,
      mimeType: found.mimeType,
      bytes: found.bytes,
      createdAt: found.createdAt,
      dataUrl: `data:${found.mimeType};base64,${bytes.toString('base64')}`,
    };
  }

  /**
   * Qué imágenes hay, sin las imágenes: es lo que acompaña al expediente y a la
   * ficha. Lo que el rol no puede ver no se tacha en la pantalla, no se manda.
   */
  async listFor(
    where: Prisma.AttachmentWhereInput,
    viewer: AuthenticatedUser,
  ): Promise<AttachmentMetadata[]> {
    const found = await this.prisma.attachment.findMany({
      where,
      select: METADATA,
      orderBy: { kind: 'asc' },
    });
    return found.filter((a) => seesAttachment(viewer.role, a.kind));
  }

  private assertCanSee(
    kind: AttachmentKind,
    caseOpticianId: string | null,
    viewer: AuthenticatedUser,
  ) {
    if (!seesAttachment(viewer.role, kind)) {
      throw new ForbiddenException('Tu rol no puede ver esta imagen');
    }
    // La óptica ve la receta de los expedientes que está fabricando, no la de
    // los de otra óptica.
    if (viewer.role === 'OPTICIAN' && (!viewer.opticianId || caseOpticianId !== viewer.opticianId)) {
      throw new ForbiddenException('Ese expediente no es de tu óptica');
    }
  }

  /** A qué se engancha la imagen, y que exista: la foto sola no es nada. */
  private async resolveTarget(dto: UploadAttachmentDto, kind: AttachmentKind) {
    if (attachmentBelongsToPerson(kind)) {
      if (!dto.personId) throw new BadRequestException('Falta la ficha de la persona');
      const person = await this.prisma.person.findUnique({ where: { id: dto.personId } });
      if (!person) throw new NotFoundException('No existe esa ficha de persona');
      return { personId: dto.personId };
    }
    if (!dto.caseId) throw new BadRequestException('Falta el expediente');
    const found = await this.prisma.case.findUnique({ where: { id: dto.caseId } });
    if (!found) throw new NotFoundException('No existe ese expediente');
    return { caseId: dto.caseId };
  }

  private async removeFile(storageKey: string) {
    try {
      await rm(join(this.directory, storageKey), { force: true });
    } catch (error) {
      // Un archivo que quedó sin borrar no rompe nada: ya no lo nombra ninguna
      // ficha. Se anota para poder limpiarlo después.
      this.logger.warn(`No se pudo borrar el archivo ${storageKey}: ${String(error)}`);
    }
  }
}

/** Separa el tipo y los bytes de un `data:…;base64,…`, y desconfía de los dos. */
export function decodeDataUrl(dataUrl: string): { bytes: Buffer; mimeType: string } {
  const match = /^data:([a-z/+-]+);base64,(.+)$/is.exec(dataUrl.trim());
  if (!match) throw new BadRequestException('Eso no es una imagen');

  const mimeType = match[1]!.toLowerCase();
  if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new BadRequestException('Sólo se pueden cargar fotos en JPG, PNG o WEBP');
  }

  const bytes = Buffer.from(match[2]!, 'base64');
  if (bytes.length === 0) throw new BadRequestException('La imagen llegó vacía');
  if (bytes.length > ATTACHMENT_MAX_BYTES) {
    throw new BadRequestException('La imagen es demasiado grande. Sacala con menos resolución');
  }
  // El tipo lo dice quien sube el archivo, así que no alcanza: se mira adentro.
  if (!SIGNATURES[mimeType]!(bytes)) {
    throw new BadRequestException('El archivo no es la imagen que dice ser');
  }

  return { bytes, mimeType };
}
