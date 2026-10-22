# Fase 3. Workflows mínimos

Una organización puede guardar una regla del estilo «si se resuelve un ticket urgente, asígnalo a esta persona» y ver si esa ejecución terminó bien o mal. El ticket se guarda antes. Si la regla falla, el ticket se queda.

## Qué se hizo y por qué

Las tablas `Workflow`, `WorkflowCondition`, `WorkflowAction` y `WorkflowExecution` ya estaban migradas y nadie las usaba. Sin un servicio, la automatización existía solo en el esquema.

Esta versión no es un motor genérico. No envía correo, no crea tareas, no interpreta grupos lógicos como OR y no usa cola. Esas acciones y operadores existen en el enum de Prisma, pero crear una regla con ellos responde 400. Así no se guarda una regla que después no se puede ejecutar.

El CRUD sigue el de las políticas SLA: listar, ver, crear, editar, activar y desactivar. Ver una regla incluye las últimas 20 ejecuciones, con `COMPLETED` o `FAILED` y el texto del error. El listado, si no se pide otra cosa, muestra solo las activas.

## Cuándo se dispara

`TicketService` llama a `WorkflowService.run` después de que la transacción del ticket ya hizo commit.

- Crear el ticket emite solo `TICKET_CREATED`.
- Cambiar el estado emite `TICKET_STATUS_CHANGED`. Si el destino es `RESOLVED`, emite `TICKET_RESOLVED` y no los dos.
- Cambiar `assignedToId` emite `TICKET_ASSIGNED`.
- El resto del PATCH (cliente, asunto, descripción, proyecto, categoría) emite `TICKET_UPDATED`.
- Si el mismo PATCH asigna y además cambia el asunto, salen los dos eventos.

La llamada lleva los ids que ya se están ejecutando y una profundidad. La acción corre como el usuario que creó la regla (`createdById`): el historial de estado y el audit del ticket quedan a su nombre. No hay un usuario de sistema.

## Cómo se decide si la regla aplica

Las condiciones van en AND. `logicalGroup` se guarda, pero no se usa como OR: si una condición falla, la regla no corre y no se crea fila de ejecución.

En esta versión los campos son `status`, `priority` y `assignedToId`. Los operadores son `EQUALS` y `NOT_EQUALS`. Para el asignado, el valor `""` o `"null"` significa «sin asignar».

## Qué puede hacer una acción

- `ASSIGN_USER`: `configuration.userId`. El usuario tiene que existir, estar activo y ser de la misma organización. Eso ya lo comprueba `TicketService.update`.
- `CHANGE_STATUS`: `configuration.status`. Tiene que ser una transición que `canTransition` ya permite. Si no lo es, la ejecución queda `FAILED` con el mensaje `The state change is not valid` y el estado del ticket no cambia.
- `CREATE_NOTIFICATION`: notificación `WORKFLOW_EXECUTED` al `userId` indicado, si es un usuario activo de la organización.

`SEND_EMAIL` y `CREATE_TASK` se rechazan al crear.

## Por qué un fallo no deshace el ticket

La escritura del ticket y el cierre de la regla son transacciones distintas. `run` atrapa el error de cada regla, guarda `WorkflowExecution` en `FAILED` y sigue con la siguiente. Ese error no se lanza al cliente: `POST` o `PATCH` del ticket responden el ticket ya guardado.

El cierre de cada regla (estado `COMPLETED` o `FAILED` más la fila `workflow.executed`) va en su propia transacción. El audit lleva el estado, el id del ticket y, si falló, el mensaje. No copia la configuración.

Si la regla A asigna un usuario y eso dispara la regla B, B corre en la misma petición, de forma síncrona. No hay reintentos ni cola.

## Reentrada y profundidad

Antes de ejecutar las acciones, el id de la regla entra en el conjunto y la profundidad sube uno. Si ese id ya está en el conjunto, se omite: no hay segunda ejecución ni segunda fila. Así una regla que cambia el estado no se llama a sí misma.

La profundidad de la petición HTTP es 0. Se ejecutan los niveles 0, 1 y 2. Al llegar a 3, las reglas que coincidirían no se ejecutan: se escribe `FAILED` con `Workflow depth limit reached` y se para esa cadena.

`WorkflowService` no importa `TicketService`. Recibe un objeto con `assign` y `changeStatus`. `TicketService` sí importa el servicio de workflows y le pasa esos dos métodos, que vuelven a `update` y `updateStatus` con el contexto nuevo. Hay dos instancias del servicio (la de `/workflows` y la de `/tickets`). No guardan estado: las dos usan Prisma.

## Permisos

`workflows.view`, `workflows.create`, `workflows.update` y `workflows.delete`. Desactivar usa el de delete, igual que las políticas SLA. Activar y editar usan update.

`OWNER` los recibe porque el seed le da el catálogo entero. `ADMIN` y `MANAGER` los tienen explícitos. `AGENT` y `USER` no: resuelven tickets, no definen reglas.

Una base que ya estaba sembrada no ve estos códigos hasta volver a ejecutar el seed.

## Cómo comprobarlo

```text
npx vitest run src/modules/workflows
npx vitest run
npx tsc --noEmit
```

En este cierre, el módulo tiene 8 pruebas: condición falsa, AND aunque el grupo lógico cambie, asignación aplicada, cambio de estado ilegal en `FAILED`, sin reentrada, una regla que falla y la siguiente sigue, corte a profundidad 3, y rechazo de `SEND_EMAIL`. La suite completa tiene 13 archivos y 86 pruebas, cero fallos. `tsc --noEmit` terminó sin errores.

A mano, con la API levantada y el seed aplicado de nuevo:

1. Entra con un usuario de Acme que tenga los permisos. El slug es `acme-corporation`. Usuarios y contraseñas están en `prisma/seed.ts`.
2. `POST /workflows` con disparador `TICKET_RESOLVED`, condición `priority` `EQUALS` `URGENT` y acción `ASSIGN_USER` hacia un usuario activo de esa organización.
3. Resuelve un ticket urgente. El asignado debe ser ese usuario. `GET /workflows/:id` muestra una ejecución `COMPLETED`.
4. Resuelve un ticket que no sea urgente. El asignado no cambia y no aparece una ejecución de esa regla.
5. Un usuario sin `workflows.view` recibe 403 en `GET /workflows`.
