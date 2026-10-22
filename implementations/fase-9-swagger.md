# Fase 9. Swagger: grupos y seguridad

`/api/docs` agrupa las rutas que existen y deja elegir Bearer o `X-Api-Key`. No hay respuestas nuevas en esta fase. Redis no se ha tocado.

## Qué se hizo y por qué

El plugin anunciaba Organizations y Tasks, y esas rutas no existen. Solo Health tenía tag. El resto salía suelto y sin forma de autorizar la petición desde la UI.

Cada esquema de ruta lleva ahora su tag y esta seguridad, en OR:

- `bearerAuth`: header `Authorization`, esquema Bearer.
- `apiKeyAuth`: header `X-Api-Key`.

Health no pide ninguna. Las cuatro rutas que no tenían esquema (`GET /auth/me`, `POST /auth/logout`, `GET /notifications/count-unread`, `PATCH /notifications/read-all`) tienen uno solo con tag y seguridad. No validan un cuerpo que la ruta no lee.

## Decisión

La seguridad se declara en el esquema de la ruta, no como seguridad global. Así Health queda fuera sin una excepción aparte. Las categorías de ticket usan el tag Tickets: no hay un grupo propio en el plan.

No se añadió `response`. Fastify, si lo ve, serializa solo los campos declarados y podría recortar el JSON. Eso es la fase 10.

## Cómo comprobarlo

```text
npx vitest run src/app.swagger.test.ts
npx tsc --noEmit
npx eslint .
```

Los tres terminan en cero. La suite queda en 17 archivos y 111 pruebas. El caso nuevo llama a `app.ready()` y luego a `app.swagger()`. Cada operación menos `/health` y `/health/ready` tiene tag y las dos opciones de seguridad. El spec no contiene Organizations ni Tasks.
