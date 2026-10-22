# Plan para terminar FlowDesk Backend

Guía ejecutable. Se trabaja **una fase cada vez**. No se empieza la siguiente hasta que Carlos lo pida.

Al cerrar una fase:

1. Las pruebas de esa fase pasan.
2. Este archivo marca la fase como completada y resume el resultado.
3. Hay un commit solo con lo de esa fase.
4. El reporte de la fase se guarda en `implementations/`, con el nombre de la fase. El de la fase 0 es [implementations/fase-0-seguridad-e-integridad.md](../implementations/fase-0-seguridad-e-integridad.md). Cada uno explica qué se hizo, por qué, qué decisiones importan, cómo funciona el código y cómo probarlo.
5. No se arrastra trabajo de la fase siguiente.

Para continuar, pide por ejemplo: «ejecuta la fase 1».

## Cómo está organizado el código

Se mantiene lo que ya existe. No se reescribe el cálculo de horario laboral ni las alertas SLA.

- Rutas, controlador, servicio, esquema JSON de Fastify y tipos. Zod solo valida el entorno.
- `authGuard` y `requirePermission` en la ruta. El filtro de organización vive en el servicio, con `getScope`.
- Las escrituras compuestas van en `prisma.$transaction`.
- Errores con `AppError`. Mensajes de error en inglés. Comentarios de servicio en español, solo donde la operación lo necesita.
- Pruebas Vitest junto al módulo, con dobles en memoria y nombres en español.
- Redis sigue siendo el `ping` de `/health/ready`. No se añade una cola.

Fuera de este cierre: tasks, correo, invitaciones, reset de contraseña, preferencias de notificación, rate limit, Helmet y elegir un hosting.

## Estado de las fases

- [x] **Fase 0.** Seguridad e integridad. Completada.
- [x] **Fase 1.** Dejar Vitest en verde (prueba del scheduler). Completada.
- [x] **Fase 2.** Audit log. Completada.
- [x] **Fase 3.** Workflows mínimos. Completada.
- [x] **Fase 4.** Informes por consulta, sin cola. Completada.
- [x] **Fase 5.** API keys. Completada.
- [x] **Fase 6.** Revisión integral y concurrencia del SLA. Completada.
- [x] **Fase 7.** ESLint y CI. Completada.
- [ ] **Fase 8.** README y arranque local.

## Decisiones ya tomadas

1. El login exige `organizationSlug`. El email sigue siendo único por organización, no en toda la base.
2. Reabrir un ticket pone `TicketSla.resolvedAt` a null. La primera respuesta y las alertas ya creadas se quedan. El barrido recalcula el estado.
3. Un workflow que falle no deshará el ticket. Se registra `FAILED` después del commit. Fase 3.
4. Los informes son consultas en la petición. `ReportJob` se queda sin usar. Fase 4.
5. Las API keys entran en la fase 5. Si hay que recortar alcance, esa fase es la primera que puede esperar. Workflows y audit log no.
6. El scheduler es de un solo proceso. La concurrencia entre procesos se revisa en la fase 6, no se resuelve ahora.

---

## Fase 0. Seguridad e integridad

**Estado:** completada. Reporte: [implementations/fase-0-seguridad-e-integridad.md](../implementations/fase-0-seguridad-e-integridad.md).

**Prioridad:** P0. Hacía falta antes de automatizar tickets.

**Objetivo.** Un usuario no escribe el SLA de otra organización, no inicia sesión en la cuenta equivocada, no conserva el acceso al dejar de estar activo y no deja un ticket reabierto fuera del SLA.

**Qué se hizo.**

- `TicketController.sla` llama a `TicketService.findById` antes de `evaluateTicketSla`. Si el ticket no está en el alcance, responde 404 y no escribe. El scheduler no pasa por el controlador y sigue evaluando todas las organizaciones.
- `POST /auth/login` exige `organizationSlug`. Se busca la organización por slug y el usuario por esa organización, email y status `ACTIVE`. Slug inexistente, usuario inexistente y contraseña incorrecta responden 401 con el mismo mensaje.
- `UserService.update` borra las sesiones, dentro de la misma transacción, cuando el status nuevo no es `ACTIVE`. `authGuard` rechaza la sesión si el usuario ya no está `ACTIVE`.
- Al pasar de `RESOLVED` a `IN_PROGRESS`, la misma transacción pone `TicketSla.resolvedAt` a null. No toca `firstResponseAt` ni `SlaAlertEvent`.

**Fuera de esta fase.** La prueba del scheduler que ya fallaba. Carreras del sweep, pausas duplicadas, Helmet y rate limit.

**Archivos.** `ticket.controller.ts`, `ticket.service.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.schema.ts`, `auth.types.ts`, `auth.guard.ts`, `user.service.ts`, y las pruebas nuevas junto a esos módulos.

**Verificación hecha en el cierre.** `npx tsc --noEmit` terminó bien. Vitest: 74 pasadas y 1 fallida. La fallida es la de antes, `sla-scheduler.test.ts`, «evalúa al arrancar y registra cuántos SLA procesó». Las 10 pruebas nuevas de esta fase pasan. No se ha levantado la API contra Postgres.

### Cómo probarla

Automático, desde la raíz del repo:

```text
npx vitest run src/modules/tickets/ticket.sla.access.test.ts src/modules/tickets/ticket.reopen.test.ts src/modules/auth/auth.guard.test.ts src/modules/auth/auth.service.test.ts src/modules/users/user.session.test.ts
```

Tienen que pasar las 10. La suite completa sigue con el fallo conocido del scheduler hasta la fase 1.

A mano, con la API levantada (`docker compose up -d`, migraciones, seed y `npm run dev`):

1. Login. `POST /auth/login` con email, contraseña y `"organizationSlug": "acme-corporation"`. El email y la contraseña están en `USERS` de `prisma/seed.ts`. Sin el slug, la validación responde 400. Con un slug inventado, 401.
2. SLA de otro tenant. Hace falta una segunda organización, porque el seed solo crea Acme. Con un usuario de Acme y el id de un ticket de la otra, `GET /tickets/:id/sla` y el header `Authorization: Bearer <token>` deben responder 404. Con un ticket de Acme, 200. El rol OWNER del seed es global: ese usuario sí puede evaluar un ticket de otra organización. Para ver el 404, el usuario no puede ser OWNER.
3. Sesión. Entra como un agente, copia el token y, con un admin, `PATCH /users/:id` con `{ "status": "SUSPENDED" }`. La siguiente llamada con el token del agente responde 401.
4. Reapertura. Resuelve un ticket y luego `PATCH /tickets/:id/reopen`. En la base, `tickets.resolvedAt` y `ticket_slas.resolvedAt` quedan vacíos. `ticket_slas.firstResponseAt` no se borra si ya tenía valor.

---

## Fase 1. Suite en verde

**Estado:** completada. Reporte: [implementations/fase-1-suite-en-verde.md](../implementations/fase-1-suite-en-verde.md).

**Prioridad:** P1. No es un bug de producción. Hace falta para ver regresiones.

**Objetivo.** `npx vitest run` termina sin fallos.

**Estado del código.** `SlaService.evaluateTicketSla` escribe dentro de `prisma.$transaction`. El doble de `src/plugins/sla-scheduler.test.ts` no define `$transaction` ni `slaAlertEvent.createMany`. Por eso el caso de arranque recibe `[]`. `sla.due-sweep.test.ts` sí simula la transacción.

**Alcance.** Completar ese doble. No cambiar el intervalo de 60 segundos ni `sla-scheduler.ts`, salvo que la prueba demuestre un fallo real del plugin.

**Tareas.**

1. Leer el caso que falla y el `$transaction` de `sla.due-sweep.test.ts`. Añadir al doble lo que el servicio llama ahora, sin copiar la suite entera. Pequeña.
2. Ejecutar `npx vitest run`. El caso de arranque debe ver `ticket-1` y `ticket-2`. Si falta otro método, se añade al doble. No se cambia el `expect` para que acepte un array vacío.

**Cómo probarla.** `npx vitest run`. Cero fallos. El número de pruebas será 75 o más si no se borra ninguna.

**Cierre.** Suite verde. Commit de esta fase. No se toca el cálculo SLA.

---

## Fase 2. Audit log

**Estado:** completada. Reporte: [implementations/fase-2-audit-log.md](../implementations/fase-2-audit-log.md).

**Prioridad:** P1.

**Objetivo.** Saber quién cambió un usuario, un ticket o un comentario. No se usa `Activity`, ni el historial de estado, ni `SlaAlertEvent`, ni el log de Pino.

**Estado del código.** El modelo `AuditLog` ya está migrado. Nadie escribe en la tabla.

**Alcance.** `AuditLogService.record(tx, input)`, igual que `NotificationService.create`. Se llama dentro de las transacciones que ya existen. `GET /audit-logs` paginado, permiso `audit_logs.view`, filtro con `getScope`. Acciones: alta y edición de usuario, desactivar, alta de ticket, cambio de estado, asignación, alta y borrado de comentario. `oldValues` y `newValues` solo con campos que la API ya devuelve. Nunca `passwordHash`, tokens ni claves. IP y user agent se dejan vacíos.

**Tareas.**

1. Módulo `src/modules/audit-logs/` y registro en `src/app.ts`. Permiso en `permissions.ts` y en el seed.
2. Llamar a `record` desde users, tickets y comments. Si un update o delete de comentario no tiene transacción, la escritura y el audit entran en una.
3. Pruebas: la fila guarda org, usuario y acción; otra org no la lista; la contraseña no aparece.

**Cómo probarla.**

```text
npx vitest run src/modules/audit-logs
```

A mano: cambia el nombre de un usuario y `GET /audit-logs` con su token. Debe salir una fila de ese cambio y ninguna de otra organización. Un `GET` de un ticket no crea fila.

**Cierre.** No existe update ni delete del audit log en el servicio. Commit.

---

## Fase 3. Workflows mínimos

**Estado:** completada. Reporte: [implementations/fase-3-workflows.md](../implementations/fase-3-workflows.md).

**Prioridad:** P1. Es la fase grande. Depende de la 2.

**Objetivo.** Una organización puede definir «si un ticket urgente se resuelve, asígnalo a esta persona» y ver si la ejecución terminó bien o mal.

**Estado del código.** Tablas y enums ya migrados. No hay servicio ni llamadas desde `TicketService`.

**Reglas de la v1.**

- Un cambio de estado emite `TICKET_STATUS_CHANGED`. Si el destino es `RESOLVED`, emite `TICKET_RESOLVED` y no los dos. Cambiar el asignado emite `TICKET_ASSIGNED`. El resto del PATCH emite `TICKET_UPDATED`. Crear emite solo `TICKET_CREATED`.
- Condiciones en AND. Operadores: `EQUALS` y `NOT_EQUALS`. Campos: `status`, `priority`, `assignedToId`. El resto de operadores se rechazan al crear la regla con 400.
- Acciones: `ASSIGN_USER`, `CHANGE_STATUS` y `CREATE_NOTIFICATION`. `SEND_EMAIL` y `CREATE_TASK` se rechazan al crear.
- Después del commit del ticket. Cada regla en su transacción. Si falla, el ticket se queda y `WorkflowExecution` pasa a `FAILED`.
- La llamada lleva los ids ya en ejecución. El mismo workflow no se vuelve a ejecutar. Se corta a profundidad 3.

**Tareas.** CRUD al estilo de las políticas SLA. `WorkflowService.run`. Engancharlo en create, update y updateStatus. Auditar la ejecución con la fase 2. Pruebas: condición falsa, asignación aplicada, cambio de estado ilegal en `FAILED`, sin reentrada, y dos reglas donde una falla y la otra sigue.

**Cómo probarla.** `npx vitest run src/modules/workflows`. A mano: crea la regla, resuelve un ticket urgente y comprueba el asignado y una fila `COMPLETED`. Una condición que no coincide no cambia el ticket.

**Cierre.** Esas pruebas pasan junto con las anteriores. Commit.

---

## Fase 4. Informes

**Estado:** completada. Reporte: [implementations/fase-4-informes.md](../implementations/fase-4-informes.md).

**Objetivo.** `GET /reports/tickets-summary`: tickets no cerrados por estado y por prioridad, y SLA de resolución en `AT_RISK` o `BREACHED`, solo de la organización del solicitante.

**Alcance.** Permiso `reports.view`. Sin CSV, sin `ReportJob` y sin cola.

**Cómo probarla.** Prueba con dos organizaciones: el resumen de la primera no cuenta tickets de la segunda. Un usuario sin permiso recibe 403. `npx vitest run` del módulo.

**Cierre.** Commit. El README futuro dirá que `ReportJob` no se usa.

---

## Fase 5. API keys

**Estado:** completada. Reporte: [implementations/fase-5-api-keys.md](../implementations/fase-5-api-keys.md).

**Objetivo.** Crear una clave, verla completa una sola vez, y llamar a la API con `X-Api-Key`, limitada a unos permisos y a su organización.

**Alcance.** Hash SHA-256, como la sesión. `keyHash` único (migración pequeña). Listar y revocar. Scopes con códigos de `PERMISSIONS`. Revocada o caducada: 401. Scope ausente: 403. El bearer de sesión sigue igual. Sin rate limit.

**Cómo probarla.** El POST de creación devuelve el secreto. Un GET posterior no lo trae. Clave revocada: 401. Clave de la org A contra un ticket de la org B: 404. Login con bearer sigue entrando.

**Cierre.** Esas pruebas pasan. Commit.

---

## Fase 6. Revisión y concurrencia del SLA

**Estado:** completada. Reporte: [implementations/fase-6-aislamiento-y-concurrencia.md](../implementations/fase-6-aislamiento-y-concurrencia.md).

**Objetivo.** Probar el aislamiento de los módulos ya hechos y las carreras que se dejaron anotadas. Corregir solo lo que una prueba demuestre mal.

**Incluye.** 404 entre organizaciones en ticket, comentario, adjunto, cliente, notificación, workflow, audit, informe y API key. Segunda evaluación en el mismo estado: no crea otra alerta. Una frase en `sla-scheduler.ts`: `isRunning` no coordina varios procesos.

**No incluye.** Un lock distribuido, una cola, ni cambios al algoritmo de tiempo laboral.

**Cómo probarla.** `npx vitest run` y `npx tsc --noEmit`, los dos en verde. Las pruebas del calculador de horario siguen pasando sin haber editado ese archivo.

**Cierre.** Commit solo si hubo un arreglo demostrable o el comentario del scheduler. Si no hubo cambios de código, se marca la fase y no se hace un commit vacío.

---

## Fase 7. CI y lint

**Estado:** completada. Reporte: [implementations/fase-7-eslint.md](../implementations/fase-7-eslint.md). No hay remoto, así que no hay workflow.

**Objetivo.** `npm run lint` tiene configuración. Si el remoto es GitHub, un workflow ejecuta `npm ci`, `npx tsc --noEmit` y `npx vitest run`, sin Postgres.

**Cuidado.** No ejecutar `prettier --write .`. Si ESLint pide reformatear decenas de archivos, se ajusta la config para fallar en problemas reales y no se mezcla un diff de estilo con esta fase.

**Cómo probarla.** En local, `npx tsc --noEmit`, `npx vitest run` y `npx eslint .` terminan con exit 0.

**Cierre.** Commit de la config y, si aplica, del workflow.

---

## Fase 8. Arranque local

**Estado:** pendiente.

**Objetivo.** Un README con el orden real: Compose, variables de `.env.example`, `prisma migrate dev`, seed, `npm run dev`, y la lista de lo que el proyecto no incluye.

**Cómo probarla.** Seguir el README en una base limpia hasta que `GET /health/ready` responda 200. No documentar un paso que no se haya ejecutado.

**Opcional.** Dockerfile de la API. No elegir hosting aquí. El seed puede crear un cliente, un proyecto y un ticket de ejemplo cuando el alta de ticket ya no vaya a cambiar.

**Cierre.** Commit del README y de lo que se haya añadido para que esos pasos funcionen.

## Backend terminado cuando

Vitest y `tsc --noEmit` están en verde. El SLA, el audit y el informe no cruzan organizaciones. Un usuario que deja de estar `ACTIVE` pierde el bearer. El login distingue la organización. Reabrir un ticket vuelve a poner la resolución del SLA en curso. Hay al menos un workflow que deja `COMPLETED` o `FAILED`. Las escrituras críticas dejan un `AuditLog` sin secretos. Una API key solo muestra el secreto al crearla. El README levanta el entorno local. El scheduler queda descrito como un solo proceso.

No hace falta un despliegue público, una cola, tasks, correo ni un porcentaje de cobertura.
