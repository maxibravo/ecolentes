import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { canUploadAttachment, seesAttachment } from '@ecolentes/shared';
import { AttachmentsService, decodeDataUrl } from '../src/attachments/attachments.service';

const jpeg = (extra = 10) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(extra)]);
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString('base64')}`;

describe('quién ve cada foto', () => {
  it('la del DNI la ven los que atienden a la persona', () => {
    expect(seesAttachment('OPERATOR', 'DNI_FRONT')).toBe(true);
    expect(seesAttachment('SOCIAL_DESK', 'DNI_BACK')).toBe(true);
    expect(seesAttachment('ADMIN', 'DNI_FRONT')).toBe(true);
  });

  it('no se la ven ni Dirección, ni la óptica, ni el oftalmólogo', () => {
    // Dirección aprueba sin saber de quién se trata y la óptica trabaja con la
    // graduación: una foto del documento no les hace falta para nada.
    expect(seesAttachment('DIRECTOR', 'DNI_FRONT')).toBe(false);
    expect(seesAttachment('OPTICIAN', 'DNI_FRONT')).toBe(false);
    expect(seesAttachment('OPHTHALMOLOGIST', 'DNI_BACK')).toBe(false);
  });

  it('la receta la ve además la óptica, que es la que fabrica', () => {
    expect(seesAttachment('OPTICIAN', 'PRESCRIPTION')).toBe(true);
    expect(seesAttachment('OPHTHALMOLOGIST', 'PRESCRIPTION')).toBe(true);
    // La receta suele tener escrito el nombre de la persona.
    expect(seesAttachment('DIRECTOR', 'PRESCRIPTION')).toBe(false);
  });

  it('la óptica mira fotos pero no carga ninguna', () => {
    expect(canUploadAttachment('OPTICIAN', 'PRESCRIPTION')).toBe(false);
    expect(canUploadAttachment('OPERATOR', 'PRESCRIPTION')).toBe(true);
  });
});

describe('decodeDataUrl', () => {
  it('acepta una foto de las que saca el teléfono', () => {
    const { mimeType, bytes } = decodeDataUrl(dataUrl('image/jpeg', jpeg()));
    expect(mimeType).toBe('image/jpeg');
    expect(bytes.length).toBe(13);
  });

  it('rechaza un archivo que no es una imagen', () => {
    expect(() => decodeDataUrl('data:application/pdf;base64,JVBERi0=')).toThrow(BadRequestException);
    expect(() => decodeDataUrl('cualquier cosa')).toThrow(BadRequestException);
  });

  it('no le cree al tipo que viene escrito: mira los primeros bytes', () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(() => decodeDataUrl(dataUrl('image/jpeg', png))).toThrow(
      'El archivo no es la imagen que dice ser',
    );
  });

  it('rechaza una imagen más grande que el tope', () => {
    const enorme = Buffer.concat([jpeg(), Buffer.alloc(6 * 1024 * 1024)]);
    expect(() => decodeDataUrl(dataUrl('image/jpeg', enorme))).toThrow(BadRequestException);
  });
});

function build(attachment: Record<string, unknown> | null) {
  const audit = { record: jest.fn() };
  const prisma = {
    attachment: { findUnique: jest.fn().mockResolvedValue(attachment) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new AttachmentsService(prisma as any, audit as any), audit };
}

const receta = {
  id: 'a1',
  kind: 'PRESCRIPTION',
  mimeType: 'image/jpeg',
  bytes: 10,
  storageKey: 'x.jpeg',
  createdAt: new Date(),
  case: { opticianId: 'optica-1' },
};

describe('AttachmentsService.read', () => {
  it('no le deja ver la receta a una óptica que no es la del expediente', async () => {
    const { service } = build(receta);

    await expect(
      service.read('a1', {
        id: 'u1',
        username: 'otra-optica',
        role: 'OPTICIAN',
        opticianId: 'optica-2',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no le deja ver la foto del DNI a Dirección', async () => {
    const { service } = build({ ...receta, kind: 'DNI_FRONT', case: null });

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service.read('a1', { id: 'u2', username: 'direccion', role: 'DIRECTOR' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
