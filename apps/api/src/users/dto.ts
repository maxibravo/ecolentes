import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  /**
   * Con el que entra al sistema. Sin espacios ni acentos, porque se escribe en
   * un teclado de celular apurado y tiene que ser el mismo siempre.
   */
  @IsString()
  @MinLength(3, { message: 'El usuario necesita al menos 3 caracteres' })
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'El usuario va en minúscula, sin espacios ni acentos',
  })
  username!: string;

  @IsString()
  @MinLength(3, { message: 'Escribí el nombre y el apellido' })
  fullName!: string;

  @IsEnum(Role, { message: 'Elegí un perfil de la lista' })
  role!: Role;

  /** Sólo para el perfil Óptica: a qué óptica pertenece. */
  @IsOptional()
  @IsString()
  opticianId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Escribí el nombre y el apellido' })
  fullName?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Elegí un perfil de la lista' })
  role?: Role;

  @IsOptional()
  @IsString()
  opticianId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
