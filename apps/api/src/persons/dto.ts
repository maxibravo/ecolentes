import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { Sex } from '@prisma/client';
import { isValidDni } from '../common/dni';

/**
 * Una fecha de nacimiento que pueda ser de una persona viva. Un año mal tipeado
 * (2206 por 2006) convierte a un adulto en menor o al revés, y de eso depende a
 * quién se le entregan los anteojos.
 */
@ValidatorConstraint({ name: 'birthDate' })
class BirthDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const hoy = new Date();
    const hace120 = new Date(hoy.getFullYear() - 120, hoy.getMonth(), hoy.getDate());
    return date <= hoy && date >= hace120;
  }
  defaultMessage(): string {
    return 'Revisá la fecha de nacimiento: no puede ser futura ni de hace más de 120 años';
  }
}

@ValidatorConstraint({ name: 'dni' })
class DniConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidDni(value);
  }
  defaultMessage(): string {
    return 'El DNI tiene que tener 7 u 8 dígitos';
  }
}

export class CreatePersonDto {
  @IsString()
  @Validate(DniConstraint)
  dni!: string;

  @IsString()
  @MinLength(2, { message: 'Ingresá el nombre' })
  firstName!: string;

  @IsString()
  @MinLength(2, { message: 'Ingresá el apellido' })
  lastName!: string;

  /** Preferida. Si en territorio sólo tienen la edad, se manda ageAtIntake. */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  @Validate(BirthDateConstraint)
  birthDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  ageAtIntake?: number;

  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  @IsOptional()
  @IsString()
  representativePhone?: string;

  @IsOptional()
  @IsString()
  representativeBond?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Edición parcial: todo es opcional, y lo que no viene no se toca.
 * El DNI no se cambia desde acá, porque identifica la ficha.
 */
export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Ingresá el nombre' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Ingresá el apellido' })
  lastName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  @Validate(BirthDateConstraint)
  birthDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  ageAtIntake?: number;

  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  representativeName?: string;

  @IsOptional()
  @IsString()
  representativePhone?: string;

  @IsOptional()
  @IsString()
  representativeBond?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SearchPersonDto {
  /** Texto libre: DNI, apellido o nombre. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  /** Cuántas fichas saltear, para traer la página siguiente. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}
