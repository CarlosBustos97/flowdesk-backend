# Fase 10. Swagger: respuestas

Cada operación del spec declara el cuerpo que el controlador ya enviaba. El JSON no se recorta. Redis no se ha tocado.

## Qué se hizo y por qué

Sin `response`, Swagger no enseña qué devuelve la ruta. Con un `response` estrecho, Fastify serializa solo los campos declarados y el cliente pierde datos. El esquema nuevo dice la forma real y deja pasar el resto.

La mayoría de controladores envían `{ success, data }`. Ese esquema declara `success` y acepta cualquier otra propiedad, así que `data` sale entero: objeto, lista o número. Las altas usan 201, que es el estado que ya respondían.

Tres rutas no usan ese sobre:

- `GET /sla-calendars/:id/holidays` devuelve un array. El esquema es un array de objetos abiertos.
- `POST` de un festivo devuelve el festivo, no `{ success, data }`.
- Los adjuntos devuelven `{ data, pagination }`, `{ message }` al subir, y `{ message }` al borrar.

## Decisión

No se unificó el sobre. Cambiar el JSON habría sido un cambio de API, y esta fase solo documenta. Los campos concretos de `data` no se listan uno a uno: si se listan y falta uno, Fastify lo borra de la respuesta.

## Cómo comprobarlo

```text
npx vitest run src/app.swagger.test.ts
npx tsc --noEmit
npx eslint .
```

Los tres terminan en cero. La suite queda en 17 archivos y 112 pruebas.

`GET /customers` con Prisma simulado sigue devolviendo `success`, el nombre `Northwind`, el email y `pagination.total`. `GET /sla-calendars/:id/holidays` sigue devolviendo el array con `name` y `date`. El spec tiene una respuesta 200 o 201 en cada operación.
