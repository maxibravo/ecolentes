import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CaseHold, CaseStage, IntakeChannel } from '@prisma/client';

export class CreateCaseDto {
  @IsString()
  personId!: string;

  @IsEnum(IntakeChannel)
  channel!: IntakeChannel;

  @IsOptional()
  @IsString()
  operationId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PrescriptionDto {
  @IsString()
  @MinLength(3, { message: 'Escribí la graduación como figura en la receta' })
  rawText!: string;

  /** Si se mandan, pisan lo que se interpretó del texto. */
  @IsOptional() @IsNumber() farRightSphere?: number;
  @IsOptional() @IsNumber() farRightCylinder?: number;
  @IsOptional() @IsInt() @Min(0) @Max(180) farRightAxis?: number;
  @IsOptional() @IsNumber() farLeftSphere?: number;
  @IsOptional() @IsNumber() farLeftCylinder?: number;
  @IsOptional() @IsInt() @Min(0) @Max(180) farLeftAxis?: number;
  @IsOptional() @IsNumber() nearAddition?: number;
}

export class QuoteDto {
  @IsString()
  @MinLength(2, { message: 'Indicá los cristales' })
  lenses!: string;

  @IsString()
  @MinLength(2, { message: 'Indicá el armazón' })
  frame!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DecideQuoteDto {
  @IsBoolean()
  approve!: boolean;

  /** Obligatorio al observar: la óptica tiene que saber qué corregir. */
  @IsOptional()
  @IsString()
  note?: string;
}

export class MoveStageDto {
  @IsEnum(CaseStage)
  to!: CaseStage;

  @IsOptional()
  @IsString()
  note?: string;
}

export class DeliveryDto {
  @IsDateString()
  deliveredAt!: string;

  @IsString()
  @MinLength(3, { message: 'Anotá quién recibió los anteojos' })
  receivedBy!: string;

  @IsOptional()
  @IsBoolean()
  isRepresentative?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class HoldDto {
  @IsEnum(CaseHold)
  hold!: CaseHold;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ListCasesDto {
  @IsOptional()
  @IsEnum(CaseStage)
  stage?: CaseStage;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  q?: string;

  /** Sólo los que pasaron el plazo de su etapa. */
  @IsOptional()
  @IsString()
  overdue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}
