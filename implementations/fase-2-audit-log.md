# Fase 2. Audit log

Queda un registro de las escrituras importantes de usuarios, tickets y comentarios. No sustituye al historial de estado del ticket, ni a las alertas SLA, ni a los comentarios, ni al log de la aplicación.

## Qué se hizo y por qué

La tabla `AuditLog` ya estaba migrada y nadie escribía en ella. Sin esas filas no se puede reconstruir quién cambió un recurso cuando el proceso ya no está en marcha: el log de Pino desaparece con el servidor.

`AuditLogService.record` sigue el mismo contrato que `NotificationService.create`: recibe los datos y el cliente de la transacción que ya abrió el servicio. Si el audit falla, la escritura de negocio también se deshace. No hay métodos de update ni de delete. Una fila de auditoría no se corrige; se añade otra.

`GET /audit-logs` lista con paginación y el permiso `audit_logs.view`. El filtro usa `getScope`. Un usuario de organización solo ve su organización. `OWNER`, que en el seed es global, ve todas. La ruta no filtra por el usuario que consulta: es el rastro de la organización, no la bandeja personal. Las notificaciones sí se filtran por usuario; esto no.

## Dónde se escribe

Dentro de la transacción que ya existía, o en una nueva cuando la operación todavía no la tenía:

- Alta de usuario: `user.created`. El alta pasó a ir en transacción para que el usuario y la fila salgan juntos. `newValues` lleva nombre, email, status y organización. No lleva la contraseña ni `passwordHash`.
- Edición de usuario: `user.updated`, solo con los campos que cambian (nombre, email, status). Si llega un `roleId`, se guarda el rol nuevo.
- Desactivar por `DELETE /users/:id`: `user.disabled`, de status anterior a `INACTIVE`.
- Alta de ticket: `ticket.created`.
- Cambio de asignado: `ticket.assigned`, con el id anterior y el nuevo. Si el mismo PATCH también cambia asunto, cliente u otros campos, eso va en otra fila `ticket.updated`.
- Cambio de estado (`start`, `pending`, `resolve`, `close`, `reopen`): `ticket.status_changed`. El historial `TicketStatusHistory` sigue existiendo; el audit dice quién disparó la acción.
- Alta de comentario: `comment.created`, con el ticket y si es interno. No se copia el texto: el comentario ya lo guarda.
- Borrado de comentario: `comment.deleted`, ahora dentro de una transacción. Antes el borrado era un update suelto.

Editar el texto de un comentario no se audita. El plan de esta fase pedía alta y borrado, no la edición.

IP y user agent se dejan vacíos. Los servicios no reciben la petición HTTP y no merece la pena atravesar todos los controladores para llenar dos columnas.

## Decisiones

- El permiso lo tienen `OWNER` (porque recibe todo el catálogo), `ADMIN` y `MANAGER`. `AGENT` y `USER` no leen el rastro. Quien resuelve tickets no necesita ver cambios de otros usuarios.
- La contraseña no entra en el JSON. La prueba de alta busca el texto de la clave y la palabra `passwordHash` en la fila y no los encuentra.
- No se usa la tabla `Activity`. Sigue sin escritor.

## Cómo funciona una escritura

`UserService.update` compara el body con el usuario que ya estaba. Si el nombre cambió, `oldValues` y `newValues` llevan solo `name`. Luego llama a `record` con el `tx` de la misma transacción que actualiza al usuario y, si hace falta, borra sus sesiones. O se guardan las dos cosas o ninguna.

El listado hace `findMany` y `count` en una transacción de lectura, ordenado por `createdAt` descendente, con `page` y `limit` como el resto de listados.

## Cómo comprobarlo

```text
npx vitest run src/modules/audit-logs
npx vitest run
npx tsc --noEmit
```

En este cierre, el módulo tiene 3 pruebas pasadas. La suite completa tiene 12 archivos y 78 pruebas, cero fallos. `tsc --noEmit` terminó sin errores.

A mano, con la API levantada y el seed aplicado de nuevo para que exista el permiso `audit_logs.view`:

1. Entra como admin de Acme (`OWNER` en el seed).
2. `PATCH /users/:id` cambiando el nombre de otro usuario.
3. `GET /audit-logs`. Debe aparecer `user.updated` con el nombre anterior y el nuevo, y la organización de Acme.
4. Un `GET /tickets/:id` no crea fila.
5. Un usuario sin el permiso recibe 403.
