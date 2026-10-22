# Fase 17. Helmet y límite del login

Las respuestas llevan cabeceras de Helmet y `POST /auth/login` acepta 10 intentos por minuto desde la misma IP. Redis no entra en el conteo.

## Qué se hizo y por qué

`@fastify/helmet` ya estaba en las dependencias y no se registraba. Sin esas cabeceras, el navegador no aplica las protecciones básicas. Se registra con `contentSecurityPolicy: false` porque la política por defecto rompe `/api/docs`.

El login no tenía tope. Se añade `@fastify/rate-limit` con `global: false` y el contador en memoria del proceso, solo en `POST /auth/login`: 10 peticiones por minuto por IP. Health y el resto de rutas no cuentan. No hay variable nueva y no se usa Redis. Si hay varias instancias, cada una cuenta aparte; el scheduler ya es de un solo proceso.

El manejador de errores convertía cualquier error que no fuera `AppError` en 500. El 429 del límite habría desaparecido. Un status entre 400 y 499 que ya trae el error se responde con ese status.

## Decisión

El límite es por IP, no por email. Va en `onRequest`, antes de saber si la cuenta existe. No se reenvía `X-Forwarded-For`: sin proxy de confianza, la IP es la de la conexión.

## Cómo comprobarlo

```text
npx vitest run src/app.login-limit.test.ts
```

Las 10 primeras responden 401. La 11 responde 429. `GET /health` responde 200 y trae `x-content-type-options: nosniff`. `GET /api/docs/` responde 200.
