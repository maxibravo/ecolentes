import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Marca una ruta accesible sin token, como el login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
