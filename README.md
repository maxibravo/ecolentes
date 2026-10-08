# Ecolentes

Sistema de salud territorial de la Dirección de Salud de la Municipalidad de San Miguel de Tucumán.

Primer alcance: la ficha única de la persona (identificada por DNI, con su historial de atenciones) y el circuito de entrega de anteojos, de la solicitud a la entrega.

## Cómo levantarlo

### Todo en Docker

Hace falta sólo Docker.

```bash
cp .env.example .env     # poner un JWT_SECRET: openssl rand -base64 48
pnpm docker:up           # o: docker compose up --build -d
docker compose exec api pnpm --filter @ecolentes/api prisma:seed
```

La web queda en http://localhost:8080 y la API en http://localhost:3000. La API
aplica las migraciones sola al arrancar; el último comando crea el primer usuario
administrador y muestra su contraseña una sola vez.

`pnpm docker:logs` muestra los registros y `pnpm docker:down` baja todo.

### Para desarrollar

Hace falta Node 22 o más, pnpm y Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up          # levanta PostgreSQL en Docker
pnpm db:generate    # genera el cliente de Prisma
pnpm db:migrate     # crea las tablas
pnpm db:seed        # crea el primer usuario administrador
pnpm dev            # API en :3000 y web en :5173
```

El seed muestra la contraseña del administrador una sola vez. Al entrar, el sistema
pide cambiarla.

Para comprobar que anda: `curl http://localhost:3000/api/v1/health` devuelve `{"status":"ok"}`, y la web en http://localhost:5173 avisa si llega a la API.

## Cómo está organizado

```
apps/api         API en NestJS, con Prisma sobre PostgreSQL
apps/web         Interfaz en React con Vite
packages/shared  Tipos y constantes que usan los dos (roles, etapas, canales)
```

Las etapas del expediente, los roles y los canales de ingreso viven en `packages/shared`, para que la API y la interfaz no se vayan cada una por su lado.

## Por dónde entran los pedidos

Un pedido puede llegar de territorio (relevamiento, tráiler, CAC, escuela), de un
pedido individual o de concejales, o por fuera: redes y formulario público.

- **Panel de redes**: quien atiende WhatsApp, Facebook e Instagram carga el pedido
  sin salir de la conversación. No hay integración con Meta; esto la reemplaza.
  Si la persona ya tiene un pedido abierto, avisa antes de abrir otro.
- **Formulario público** (`/solicitud`): el link que se le pasa a quien prefiere
  escribir sus datos. No pide usuario, así que **responde siempre lo mismo**,
  exista o no un pedido para ese DNI, y no devuelve el número de expediente: con
  cualquier otra respuesta el link serviría para averiguar quién pidió anteojos.
  Lo que entra por ahí queda con la identidad sin verificar hasta que alguien de
  Salud hable con la persona.

## Reportes

`/api/v1/reportes` tiene el resumen, el padrón de entregas, los pendientes de
entrega y el detalle por persona. Quién ve nombres y quién no se decide en la API,
no en la pantalla: Dirección y la óptica reciben los totales sin identidad, y el
reporte por persona directamente se les niega.

El resumen tiene una **vista para compartir** que oculta los números de uno y dos
casos: en un barrio chico, un 1 alcanza para saber de quién se habla. Es la versión
que puede salir hacia el sistema del municipio.

## Versión de demostración

`pnpm --filter @ecolentes/web demo` arma un único HTML que corre entero en el
navegador, con un servidor de mentira y datos inventados, para mostrar el circuito
sin levantar nada. Los datos de ejemplo están en `packages/shared/src/demo-data.ts`
y los carga también `prisma:seed-demo` (pide `DEMO_SEED=si` para no correrse solo).

## Datos

El DNI identifica a la persona. Los nombres se guardan además sin acentos y en
minúscula (`searchName`), para que buscar "juarez" encuentre a Juárez: nadie
escribe el acento cuando está atendiendo.

El DNI se guarda sin puntos, así `31.620.034` y `31620034` son la misma ficha. Antes de crear una ficha hay que buscar: si el DNI ya existe,
la API devuelve 409 con el id de la que ya está cargada.

Cada acceso y cada cambio a una ficha quedan registrados con quién y cuándo. Una
edición sólo toca los campos que manda; lo que no viene no se pisa.

**No se suben datos reales de vecinos a este repositorio**, ni en fixtures, ni en tests, ni en capturas. Son datos de salud. Lo que se necesite para probar se inventa.

## Dónde está el contexto

La guía del proyecto, el plan por etapas y la descripción de la planilla de relevamiento están en el proyecto de Claude, no en este repositorio.
