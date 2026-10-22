# Fase 8. Arranque local

El README describe el orden que se ejecutó, y `GET /health/ready` respondió 200. No hay Dockerfile ni una elección de hosting.

## Qué se hizo y por qué

Un README que inventa pasos no sirve para arrancar el proyecto. Se siguió el orden de Compose, variables, migraciones, seed y `npm run dev`, y solo se escribió lo que terminó bien.

`docker compose up -d` dejó Postgres 17 y Redis 8 en marcha. En esta máquina los contenedores ya existían y seguían healthy. `.env.example` pasó de cadenas vacías a los valores de Compose. Una cadena vacía no supera el esquema de `src/config/env.ts`: `DATABASE_URL`, `REDIS_URL` y `CORS_ORIGIN` tienen que tener contenido.

La base `flowdesk` ya tenía datos. Para la prueba se vació, `npx prisma migrate dev` aplicó las 10 migraciones y `npm run prisma:seed` cargó el ejemplo. `npm run dev` arrancó y `GET http://localhost:3000/health/ready` respondió 200, con `postgres` y `redis` en true. `GET /health` y `GET /api/docs` también respondieron 200.

Después se restauró el volcado de la base anterior. Tenía 4 usuarios y 22 tickets. Encima de esa restauración, `npx prisma migrate deploy` aplicó solo `20261022193000_unique_api_key_hash`, que todavía no estaba. No se volvió a ejecutar el seed sobre esos datos, así que el ticket de ejemplo no está en la base actual.

La API se dejó levantada con los valores de `.env.example`. Un segundo `GET /health/ready` volvió a responder 200.

## Decisiones

No se añadió un Dockerfile. No se construyó, así que el README no puede decir que la API arranca desde una imagen.

`CORS_ORIGIN` se documenta como obligatorio para arrancar. El plugin de CORS no está registrado en `src/app.ts`, y el valor no cambia las respuestas.

El seed ahora crea un cliente, un proyecto y un ticket abierto. El alta de ticket ya no va a cambiar en este cierre, y un ticket sin fila de SLA dejaría el ejemplo a medias. La fecha límite se calcula con `calculateSlaDueDates`, el mismo cálculo del servicio, usando el calendario que el propio seed acaba de guardar. La prioridad es `MEDIUM`, que es la de la política «Standard Support». Si el ticket ya existe, no se vuelve a crear.

Volver a ejecutar el seed reescribe `passwordHash` de los usuarios de `USERS`. Por eso no se lanzó sobre la base restaurada.

`npx prisma migrate dev` aplicó las migraciones y luego falló al regenerar el cliente: `EPERM` al renombrar `query_engine-windows.dll.node`. La API que ya estaba en marcha tenía ese archivo abierto. Con la API parada, `npx prisma generate` terminó bien. El README dice ese orden.

## Cómo está el arranque

`src/server.ts` construye la app, registra el scheduler y escucha en `env.PORT`. `GET /health` solo dice que el proceso responde. `GET /health/ready` hace `SELECT 1` y `redis.ping()`. Si uno falla, la respuesta es 503.

El seed sigue siendo una transacción. Al final busca el cliente por email y el proyecto por nombre. El ticket de ejemplo se busca por asunto. Así, una segunda ejecución no duplica esas tres filas.

## Cómo comprobarlo

Con Docker, una base vacía y `.env` como `.env.example`:

```text
docker compose up -d
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

`GET http://localhost:3000/health/ready` tiene que responder 200 y los dos checks en true.

El login usa `organizationSlug` `acme-corporation` y un usuario de `USERS` en `prisma/seed.ts`. En la base vacía, `GET /tickets` con ese bearer devolvió «Printer on floor 2 is offline» en estado `OPEN`.

Node de la comprobación: v21.5.0. No se ejecutó `npm install` otra vez.
