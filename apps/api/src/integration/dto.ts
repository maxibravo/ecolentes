import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MonthlyDto {
  /** Cuántos meses hacia atrás, contando el actual. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'months tiene que ser un número entero de meses' })
  @Min(1)
  @Max(60)
  months?: number;
}
