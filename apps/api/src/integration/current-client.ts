import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedClient } from './service-client.guard';

/** El sistema que está consultando, puesto por ServiceClientGuard. */
export const CurrentClient = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedClient => {
    const request = context
      .switchToHttp()
      .getRequest<{ serviceClient?: AuthenticatedClient }>();
    if (!request.serviceClient) {
      throw new Error('CurrentClient se usó en una ruta sin ServiceClientGuard');
    }
    return request.serviceClient;
  },
);

export type { AuthenticatedClient };
