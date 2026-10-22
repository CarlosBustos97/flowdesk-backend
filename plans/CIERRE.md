# Swagger de la API que ya existe

Guía ejecutable. Se trabaja **una fase cada vez**.

Al cerrar una fase:

1. Las pruebas de esa fase pasan.
2. Este archivo marca la fase como completada.
3. Hay un commit solo con lo de esa fase.
4. El reporte queda en `implementations/`.
5. No se arrastra trabajo de la fase siguiente.

Redis no se toca. Sigue siendo el `ping` de `GET /health/ready` y el argumento sin uso de `AuthService`. Fuera también: Helmet, rate limit, suites nuevas de negocio, tasks, miembros de proyecto, invitaciones, reset de contraseña, `Activity`, `ReportJob`, CRUD de organizaciones, correo, cola y hosting.

## Estado

- [x] **Fase 9.** Swagger: grupos y seguridad. Completada. Reporte: [implementations/fase-9-swagger.md](../implementations/fase-9-swagger.md).
- [ ] **Fase 10.** Swagger: respuestas.

## Qué hay hoy

Swagger está en `/api/docs`. Solo Health tiene `tags` y `response`. No hay `securitySchemes`. El plugin anuncia Organizations y Tasks, y no existen esas rutas. Sin esquema: `GET /auth/me`, `POST /auth/logout`, `GET /notifications/count-unread` y `PATCH /notifications/read-all`. El resto de rutas valida la petición y no declara la respuesta.

Si se añade `response`, Fastify deja fuera del JSON cualquier campo no declarado. Tickets y usuarios envían `{ success, data }`. Festivos y el listado de adjuntos envían el resultado del servicio. El alta de adjunto envía `{ message }`. El esquema copia ese envío.

## Decisión

Las respuestas documentan el JSON real y permiten propiedades de más, para no recortar la API. No se cambia el estado HTTP ni la forma del cuerpo.

## Fase 9. Swagger: grupos y seguridad

**Estado:** completada. Reporte: [implementations/fase-9-swagger.md](../implementations/fase-9-swagger.md).

Tags reales: Health, Authentication, Users, Customers, Projects, Tickets, Comments, Attachments, Notifications, SLA Calendars, SLA Policies, Workflows, Audit Logs, Reports, API Keys. Se quitan Organizations y Tasks.

`bearerAuth` en `Authorization` y `apiKeyAuth` en `X-Api-Key`. Todas las rutas menos Health declaran uno u otro. Esquemas nuevos para las cuatro rutas que no tienen. Sin `response` en esta fase.

**Prueba.** Con Prisma y Redis simulados, `app.swagger()` tiene tag y seguridad en cada operación menos Health. `npx vitest run` y `npx tsc --noEmit` en verde.

## Fase 10. Swagger: respuestas

**Estado:** pendiente.

Añadir `response` leyendo el `send` de cada controlador. Donde el cuerpo es `{ success, data }`, `data` acepta propiedades de más. Donde el servicio se envía tal cual, el esquema describe ese objeto con la misma regla.

**Prueba.** Un `app.inject` con Prisma simulado sobre un listado envuelto y sobre el listado de festivos. Las claves que el controlador ya manda siguen en el cuerpo. El spec incluye una respuesta 200 en cada operación.
