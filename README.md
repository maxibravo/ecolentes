# Ecolentes

Sistema de salud territorial de la Dirección de Salud de la Municipalidad de San Miguel de Tucumán.

Primer alcance: la ficha única de la persona (identificada por DNI, con su historial de atenciones) y el circuito de entrega de anteojos, de la solicitud a la entrega.

## Cómo levantarlo

Hace falta Node 22 o más, pnpm y Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up          # levanta PostgreSQL en Docker
pnpm db:generate    # genera el cliente de Prisma
pnpm dev            # API en :3000 y web en :5173
```

Para comprobar que anda: `curl http://localhost:3000/api/v1/health` devuelve `{"status":"ok"}`, y la web en http://localhost:5173 avisa si llega a la API.

## Cómo está organizado

```
apps/api         API en NestJS, con Prisma sobre PostgreSQL
apps/web         Interfaz en React con Vite
packages/shared  Tipos y constantes que usan los dos (roles, etapas, canales)
```

Las etapas del expediente, los roles y los canales de ingreso viven en `packages/shared`, para que la API y la interfaz no se vayan cada una por su lado.

## Datos

La base está vacía: los modelos del dominio llegan en la etapa siguiente.

**No se suben datos reales de vecinos a este repositorio**, ni en fixtures, ni en tests, ni en capturas. Son datos de salud. Lo que se necesite para probar se inventa.

## Dónde está el contexto

La guía del proyecto, el plan por etapas y la descripción de la planilla de relevamiento están en el proyecto de Claude, no en este repositorio.
