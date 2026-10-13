import { ATTACHMENT_KINDS, type AttachmentKind } from '@ecolentes/shared';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * Tope de lo que entra por el cuerpo del pedido. La imagen viaja en base64, que
 * ocupa un tercio más que el archivo, y hay que dejar lugar para eso.
 */
export const MAX_DATA_URL_LENGTH = 8 * 1024 * 1024;

export class UploadAttachmentDto {
  @IsIn(Object.keys(ATTACHMENT_KINDS))
  kind!: AttachmentKind;

  /** La ficha de la persona, para las fotos del DNI. */
  @IsOptional()
  @IsUUID()
  personId?: string;

  /** El expediente, para la receta. */
  @IsOptional()
  @IsUUID()
  caseId?: string;

  /** `data:image/jpeg;base64,…`, que es lo que devuelve el navegador. */
  @IsString()
  @MaxLength(MAX_DATA_URL_LENGTH, {
    message: 'La imagen es demasiado grande. Sacala de nuevo con menos resolución',
  })
  dataUrl!: string;
}
