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
# poner un JWT_SECRET de verdad:
openssl rand -base64 48

pnpm install
pnpm db:up          # levanta PostgreSQL en Docker
pnpm db:generate    # genera el cliente de Prisma
pnpm db:migrate     # crea las tablas
pnpm db:seed        # crea el primer usuario administrador
pnpm dev            # API en :3000 y web en :5173
```

Después de traer cambios que tocan `apps/api/prisma/schema.prisma`, hay que
correr `pnpm db:migrate`: crea las tablas nuevas en la base y regenera el cliente
de Prisma. Sin eso la API no compila y los errores hablan de campos que "no
existen" en tipos de Prisma (por ejemplo `'glasses' does not exist in type
'CaseInclude'`), porque el cliente generado es el de antes. `pnpm dev` regenera
el cliente al arrancar, así que ese caso sólo queda si falta la migración.

El seed muestra la contraseña del administrador una sola vez. Al entrar, el sistema
pide cambiarla.

Para comprobar que anda: `curl http://localhost:3000/api/v1/health` devuelve `{"status":"ok"}`, y la web en http://localhost:5173 avisa si llega a la API.

Para ver el sistema con datos y no con la base vacía, en lugar de `pnpm db:seed`:

```bash
DEMO_SEED=si pnpm db:seed-demo
```

Crea un usuario por rol (`operador`, `oftalmologo`, `optica`, `direccion`, `redes`
y `admin`, contraseña `ecolentes2026`) y expedientes de ejemplo en todas las etapas. Los datos
son inventados; los barrios son los de San Miguel de Tucumán.

Si la máquina ya tiene otro PostgreSQL escuchando en el 5432, el nuestro no se
puede alcanzar aunque el contenedor esté sano: `localhost` entra al que ya estaba
y ahí el usuario `ecolentes` no existe (Prisma lo informa como
`P1010: User was denied access`). Se resuelve moviendo el nuestro de puerto, con
`POSTGRES_PORT` en el `.env` y el mismo puerto en el `DATABASE_URL`:

```bash
POSTGRES_PORT=5434
DATABASE_URL=postgresql://ecolentes:ecolentes@localhost:5434/ecolentes?schema=public
```

Lo mismo vale para `WEB_DEV_PORT` (la web mientras se desarrolla), `WEB_PORT`
(la web en Docker) y `API_PORT`, si el 5173, el 8080 o el 3000 están ocupados.
Al cambiar `API_PORT` hay que mover también `WEB_API_URL`, que es por donde la
web busca a la API. Adentro de Docker los servicios se siguen hablando por sus
puertos de siempre.

El `.env` es uno solo y vive en la raíz, aunque la API y Prisma corran desde
`apps/api`: de eso se encarga `apps/api/scripts/with-env.mjs`, y lo que ya esté
en el entorno le gana al archivo. `packages/shared` se compila antes de arrancar,
porque la API y la web lo consumen desde su `dist/`, que no está en el repositorio.

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

## Los anteojos y su código

Un expediente puede terminar en dos anteojos: el de lejos y el de cerca se
fabrican y se entregan por separado, y la gente pregunta por uno sin el otro.
Por eso cada par tiene su propio código, `ANT-0042`, aparte del número de
expediente `ECO-0042`.

Los anteojos se crean cuando Dirección aprueba la propuesta de la óptica, que es
cuando el anteojo empieza a existir como objeto. La búsqueda de la bandeja
entiende los dos códigos, así que alcanza con el papelito que tiene la persona.

## Menores de edad

Los anteojos de un menor se le entregan a su padre, madre o tutor: la pantalla de
entrega ya viene marcada así y pide el nombre y el DNI de quien retira, que queda
en el expediente como respaldo. Si igual los retira el propio chico, se puede,
pero hay que escribir por qué y eso queda escrito también. Una ficha sin fecha de
nacimiento ni edad no frena la entrega, pero tampoco afirma que la persona sea
mayor: la pantalla lo dice.

## Reportes

`/api/v1/reportes` tiene el resumen, el padrón de entregas, los pendientes de
entrega y el detalle por persona. Quién ve nombres y quién no se decide en la API,
no en la pantalla: Dirección y la óptica reciben los totales sin identidad, y el
reporte por persona directamente se les niega.

El resumen tiene una **vista para compartir** que oculta los números de uno y dos
casos: en un barrio chico, un 1 alcanza para saber de quién se habla. Es la versión
que puede salir hacia el sistema del municipio.

## Usuarios

El administrador da de alta a los demás desde la pestaña **Usuarios**, eligiendo
el perfil. El sistema genera la contraseña y la muestra una sola vez: quien la
recibe la cambia al entrar, así nadie más la conoce, ni siquiera quien dio el
alta. Si alguien la olvida, el administrador emite otra; nunca puede ver la
anterior.

Los usuarios **no se borran, se dan de baja**: borrarlos dejaría sin autor los
expedientes y la auditoría que ya firmaron. Un administrador no puede darse de
baja ni cambiarse el perfil a sí mismo, y el sistema no se queda sin ningún
administrador activo, porque después no habría cómo volver a administrarlo.

El perfil Óptica obliga a elegir a qué óptica pertenece: sin eso vería los
expedientes de todas.

## API para el sistema del municipio

`/api/v1/integracion` es lo que consume el sistema general del municipio. Sólo
devuelve totales, nunca personas, y la supresión de los números chicos está
adentro del código y no en un parámetro: desde afuera no hay forma de pedir el
dato sin ocultar. Son tres consultas y una de prueba:

```
GET /api/v1/integracion/estado              comprueba que la credencial anda
GET /api/v1/integracion/resumen             el resumen, en su versión compartible
GET /api/v1/integracion/por-mes?months=12   pedidos y entregas mes a mes
GET /api/v1/integracion/etapas              en qué etapa está cada expediente
```

No entra con usuario y contraseña: cada sistema tiene su propia credencial, que
viaja en el encabezado `X-API-Key`. Así se puede revocar sin tocar a ninguna
persona, y en la auditoría se ve qué sistema consultó qué y cuándo.

```bash
pnpm api:credencial alta "Sistema municipal"   # muestra la clave una sola vez
pnpm api:credencial lista
pnpm api:credencial baja "Sistema municipal"
```

La clave no se guarda, sólo su hash: si se pierde, se da de baja y se emite
otra. Se entrega por un canal seguro, no por chat.

## Versión de demostración

`pnpm --filter @ecolentes/web demo` arma un único HTML que corre entero en el
navegador, con un servidor de mentira y datos inventados, para mostrar el circuito
sin levantar nada. Los datos de ejemplo están en `packages/shared/src/demo-data.ts`
y los carga también `prisma:seed-demo` (pide `DEMO_SEED=si` para no correrse solo).

## Datos

La pantalla de Personas es una tabla que filtra mientras se escribe, sin botón:
sirve para el DNI y para el apellido, y cada fila muestra lo que antes había que
entrar a buscar ficha por ficha (si alguna vez pidió anteojos, cuántos recibió,
qué expediente tiene en curso y hace cuánto está en esa etapa).

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
