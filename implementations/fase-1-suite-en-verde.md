# Fase 1. Suite en verde

La suite de Vitest vuelve a terminar sin fallos. No se ha cambiado el scheduler de producción ni el cálculo de SLA.

## Qué se hizo y por qué

La prueba «evalúa al arrancar y registra cuántos SLA procesó», en `src/plugins/sla-scheduler.test.ts`, esperaba que se actualizaran `ticket-1` y `ticket-2`. Recibía un array vacío.

El scheduler sí arrancaba y llamaba a `SlaService.evaluateDueTicketSlas`. Ese método, a su vez, llama a `evaluateTicketSla`. Desde que las alertas se escriben junto con el estado, esa evaluación hace el `update` dentro de `this.prisma.$transaction`. El doble de la prueba tenía `findMany`, `findUnique` y `update`, pero no `$transaction`. Al llamar a una función que no existía, la evaluación lanzaba un error. El scheduler lo captura, lo escribe en el log y sigue. Por eso `evaluated` se quedaba vacío y la aserción fallaba. No era un fallo del intervalo de 60 segundos ni del cálculo de horario.

La corrección está solo en el doble del caso de arranque. `$transaction` ejecuta el callback con el mismo objeto, igual que ya hace `sla.due-sweep.test.ts`. El `update` devuelve el ticket que `recordSlaAlert` espera (`id`, `organizationId`, `assignedToId`). `slaAlertEvent.createMany` existe y devuelve `count: 0`. En este caso los estados no cambian, así que la regla de alerta sale antes de crear una notificación. El método está en el doble para que la transacción no se rompa si la regla llega a llamarlo.

`sla-scheduler.ts` no se ha modificado. El intervalo, el candado `isRunning` y el registro del plugin siguen igual.

## Decisión

No se debilitó el `expect`. Sigue exigiendo `["ticket-1", "ticket-2"]` y un log con `processed: 2`. Si el doble hubiera devuelto un array vacío para “hacer pasar” la prueba, el arranque del scheduler dejaría de estar comprobado.

## Cómo funciona el arreglo

`evaluateDueTicketSlas` pide un lote. El doble devuelve dos filas. Para cada una, `evaluateTicketSla` lee el SLA, ve que la primera respuesta y la resolución ya están registradas, y abre la transacción solo para guardar los estados actuales. El `update` del doble anota el `ticketId`. Al terminar el lote corto, el sweep no pide otra página y devuelve `2`. El plugin escribe «Evaluación periódica de SLA completada».

Los otros cuatro casos del mismo archivo no pasan por `evaluateTicketSla`: `findMany` devuelve vacío o lanza. No necesitaban la transacción y siguen igual.

## Cómo comprobarlo

```text
npx vitest run
npx tsc --noEmit
```

En este cierre, Vitest terminó con 11 archivos y 75 pruebas pasadas, cero fallos. `tsc --noEmit` terminó sin errores. No se levantó la API ni Postgres: esta fase solo alinea la prueba con el contrato actual del servicio.
