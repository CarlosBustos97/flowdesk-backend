# Fase 6. Aislamiento y concurrencia del SLA

Las lecturas de otra organización ya respondían 404, y una segunda evaluación del SLA en el mismo estado no crea otra alerta. El único cambio de comportamiento es una frase en el scheduler: `isRunning` no coordina varios procesos.

## Qué se probó

Un usuario de alcance `ORGANIZATION` pide un recurso de otra empresa. El servicio tiene que filtrar por `organizationId` y, si no está, responder 404. La prueba usa un doble que devuelve la fila solo cuando ese filtro falta. Si el servicio se olvida el filtro, la prueba deja de fallar con 404 y se ve el recurso ajeno.

Así quedan cubiertos el ticket, el comentario, el adjunto, el cliente, la notificación, el workflow y la API key. El audit y el informe no tienen un `GET` por id. En esos dos, la prueba comprueba que el listado y el resumen de la primera organización no incluyen filas de la segunda.

La segunda evaluación parte de un SLA que ya pasó a `BREACHED`. La primera llamada escribe una alerta. La segunda lee ese mismo estado, no es una transición nueva y `createMany` no vuelve a ejecutarse. El índice único `ticketSlaId + metric + type` con `skipDuplicates` sigue siendo la red por si dos evaluaciones se cruzan antes de guardar el estado.

## Qué no se tocó

Las 29 pruebas del calculador de horario laboral siguen pasando y ese archivo no se ha editado. No hay lock distribuido ni cola.

Estas carreras se revisaron y ninguna prueba de esta fase las mostró rotas, así que se quedan:

- El estado del SLA se calcula antes de la transacción y el update no compara el estado anterior.
- Abrir una pausa busca una pausa abierta y luego inserta. Dos llamadas a la vez pueden crear dos pausas.
- Una alerta que no se envió porque el ticket no tenía asignado no se reintenta cuando alguien lo asigna después.
- Volver a `WITHIN_SLA` no borra la alerta. El mismo par métrica y tipo no vuelve a notificar.

## El scheduler

```text
isRunning solo evita solapes dentro de este proceso. No coordina varias instancias.
```

Esa variable vive en la memoria del proceso que registró el plugin. Dos procesos pueden evaluar a la vez. El cierre de esta fase no lo cambia.

## Cómo comprobarlo

```text
npx vitest run src/modules/isolation src/modules/sla-policies/sla.due-sweep.test.ts src/modules/sla-policies/sla-business-hours.calculator.test.ts
npx vitest run
npx tsc --noEmit
```

En este cierre, el aislamiento tiene 9 pruebas y el barrido 13, incluida la segunda evaluación. El calculador sigue en 29. La suite completa tiene 16 archivos y 110 pruebas, cero fallos. `tsc --noEmit` terminó sin errores. No levanté la API contra Postgres.
