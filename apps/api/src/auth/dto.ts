import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1, { message: 'Ingresá tu usuario' })
  username!: string;

  @IsString()
  @MinLength(1, { message: 'Ingresá tu contraseña' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(10, { message: 'La contraseña nueva necesita al menos 10 caracteres' })
  newPassword!: string;
}
