import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SocialNetwork } from '@prisma/client';

/** Lo que se carga desde el panel de redes, sin salir de la conversación. */
export class SocialIntakeDto {
  @IsString()
  @MinLength(7, { message: 'El DNI tiene entre 7 y 8 dígitos' })
  dni!: string;

  @IsString()
  @MinLength(2, { message: 'Falta el nombre' })
  firstName!: string;

  @IsString()
  @MinLength(2, { message: 'Falta el apellido' })
  lastName!: string;

  @IsEnum(SocialNetwork, { message: 'Elegí por qué red escribió' })
  socialNetwork!: SocialNetwork;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() neighborhood?: string;

  /** Lo que pidió la persona, en sus palabras. */
  @IsOptional() @IsString() reason?: string;

  /** Lo que haga falta recordar de la conversación. Queda en el historial. */
  @IsOptional() @IsString() notes?: string;

  /**
   * Cargar igual cuando la persona ya tiene un pedido en curso. Sin esto se
   * devuelve el expediente que ya existe, para no duplicarlo sin querer.
   */
  @IsOptional() @IsBoolean() force?: boolean;
}

/**
 * El formulario público. Pide lo mínimo para armar el pedido: nada clínico,
 * porque lo completa la persona sin nadie que le explique para qué sirve.
 */
export class PublicIntakeDto {
  @IsString()
  @MinLength(7, { message: 'Escribí tu DNI, sin puntos' })
  dni!: string;

  @IsString()
  @MinLength(2, { message: 'Escribí tu nombre' })
  firstName!: string;

  @IsString()
  @MinLength(2, { message: 'Escribí tu apellido' })
  lastName!: string;

  @IsString()
  @MinLength(6, { message: 'Dejá un teléfono donde te podamos ubicar' })
  phone!: string;

  @IsOptional() @IsString() neighborhood?: string;
  @IsOptional() @IsString() reason?: string;
}
