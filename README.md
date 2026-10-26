# FlowDesk Backend

Backend del portafolio personal de Carlos Bustos ([carlosbustos97.github.io](https://carlosbustos97.github.io/)). API de tickets de soporte: SLA en horario laboral, workflows, audit log, un informe de tickets y API keys.

Comprobado con Node v21.5.0. Las dependencias ya estaban en `node_modules`; no se ha vuelto a ejecutar `npm install`.

## Arranque

Desde la raíz del repo, con Docker en marcha:

```text
docker compose up -d
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

`docker compose up -d` deja Postgres 17 en el puerto 5432 y Redis 8 en el 6379. Usuario, contraseña y base de datos son `flowdesk`, los mismos que en `docker-compose.yml`.

`.env.example` tiene los valores con los que arrancó la API:

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://flowdesk:flowdesk@localhost:5432/flowdesk?schema=public
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

Si no tienes `.env`, copia ese archivo. `CORS_ORIGIN` no puede ir vacío: el esquema de entorno lo exige al arrancar. La API no registra el plugin de CORS, así que ese valor todavía no cambia las respuestas.

`npx prisma migrate dev`, sobre una base vacía, aplicó las 10 migraciones de `prisma/migrations`. Si al final aparece `EPERM` al renombrar `node_modules/.prisma/client/query_engine-windows.dll.node`, la API tiene ese archivo abierto. Párala y ejecuta `npx prisma generate`. Con la API parada, ese comando terminó bien.

`npm run dev` escucha en el puerto 3000. El scheduler de SLA arranca con el servidor, en este proceso.

`GET http://localhost:3000/health/ready` respondió 200:

```json
{"success":true,"status":"ready","checks":{"postgres":true,"redis":true}}
```

`GET /health` y `GET /api/docs` también respondieron 200.

## Datos de ejemplo

`npm run prisma:seed` crea la organización `acme-corporation`, los roles, los permisos, el calendario y la política SLA «Standard Support» (prioridad `MEDIUM`), y los usuarios de `USERS` en `prisma/seed.ts`. El email y la contraseña están en ese archivo.

También crea el cliente Northwind Office (`support@northwind.test`), el proyecto Office support y el ticket abierto «Printer on floor 2 is offline», con su fila de SLA. La fecha límite sale del mismo cálculo de horario laboral que usa el alta de un ticket.

Volver a ejecutar el seed actualiza los permisos y vuelve a escribir la contraseña de los usuarios de `USERS`.

El login comprobado fue `POST /auth/login` con `organizationSlug` `acme-corporation` y un usuario de `USERS`. Con el bearer, `GET /tickets` devolvió ese ticket en estado `OPEN`.

## Qué no incluye este repo

- No hay Dockerfile de la API ni una elección de hosting. Compose solo levanta Postgres y Redis.
- No hay workflow de GitHub.
- Redis solo responde al `ping` de `/health/ready`. No hay cola. `ReportJob` no se usa; el informe es `GET /reports/tickets-summary`.
- No hay módulos HTTP de tasks, correo, invitaciones, reset de contraseña ni preferencias de notificación. Esas tablas siguen en el esquema.
- No hay rate limit. `@fastify/helmet` está en las dependencias y no está registrado.
- El scheduler es de un solo proceso. `isRunning` no coordina varias instancias.
- Al crear un workflow se rechazan las acciones `SEND_EMAIL` y `CREATE_TASK`, y cualquier operador que no sea `EQUALS` o `NOT_EQUALS`.
