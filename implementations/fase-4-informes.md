# Fase 4. Informes

`GET /reports/tickets-summary` responde, en la misma petición, cuántos tickets siguen abiertos y cuántos tienen el SLA de resolución en riesgo o vencido. Solo cuenta la organización de quien llama. No hay CSV, no se escribe en `ReportJob` y Redis no se convierte en una cola.

## Qué se hizo y por qué

El modelo `ReportJob` ya estaba migrado para un trabajo en segundo plano: tipo, parámetros, fichero y estado. Este cierre no lo necesita. El resumen es un `groupBy` sobre los tickets que ya están en la base. La respuesta sale antes de que el cliente corte la conexión, y no hay un worker que mantener.

La ruta pide el permiso `reports.view`. El servicio no abre el alcance global. Aunque el rol sea `OWNER`, el resumen usa `request.user.organizationId`. Un administrador de Acme no ve los tickets de otra empresa en este endpoint.

Quedan fuera los tickets `CLOSED`. Entran `OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER` y `RESOLVED`. El SLA de resolución solo cuenta `AT_RISK` y `BREACHED`, y solo si el ticket tampoco está cerrado: un ticket cerrado que venció el plazo no sigue hinchando el panel. Un ticket sin fila de SLA no entra en esos dos números.

La respuesta siempre trae las mismas claves, con cero cuando no hay filas. Así quien la lee no tiene que adivinar si un estado faltaba o venía en cero.

```json
{
  "byStatus": {
    "OPEN": 0,
    "IN_PROGRESS": 0,
    "WAITING_CUSTOMER": 0,
    "RESOLVED": 0
  },
  "byPriority": {
    "LOW": 0,
    "MEDIUM": 0,
    "HIGH": 0,
    "URGENT": 0
  },
  "resolutionSla": {
    "AT_RISK": 0,
    "BREACHED": 0
  }
}
```

## Cómo se calcula

`ReportService.ticketsSummary` lanza tres agrupaciones en una transacción de lectura:

1. Tickets de esa organización con estado distinto de `CLOSED`, agrupados por `status`.
2. Los mismos tickets, agrupados por `priority`.
3. Filas de `TicketSla` cuyo `resolutionStatus` es `AT_RISK` o `BREACHED` y cuyo ticket cumple el mismo filtro.

No hay parámetros de consulta. Un query string desconocido responde 400 por el esquema de la ruta.

## Permisos

`reports.view` lo reciben `OWNER` (el catálogo entero), `ADMIN` y `MANAGER`. `AGENT` y `USER` reciben 403: el resumen es de toda la organización, no de la cola de una persona.

Una base ya sembrada no tiene este código hasta volver a ejecutar el seed.

## Cómo comprobarlo

```text
npx vitest run src/modules/reports
npx vitest run
npx tsc --noEmit
```

En este cierre, el módulo tiene 4 pruebas. Una arma dos organizaciones: el resumen de la primera no cuenta el ticket abierto de la segunda, ni un ticket `CLOSED` con SLA `BREACHED`. La segunda organización solo ve lo suyo. Otra prueba llama a la ruta con `app.inject`: sin el permiso responde 403 `Insufficient permissions`; con el permiso, 200 y el resumen en cero. La suite completa tiene 14 archivos y 90 pruebas, cero fallos. `tsc --noEmit` terminó sin errores.

A mano, con la API levantada y el seed aplicado de nuevo:

1. Entra con un usuario de Acme que tenga `reports.view`. El slug es `acme-corporation`. Usuarios y contraseñas están en `prisma/seed.ts`.
2. `GET /reports/tickets-summary` con el bearer. Los números salen de los tickets no cerrados de esa organización.
3. Entra con un agente, que no tiene el permiso. La misma ruta responde 403.
4. En la base no aparece ninguna fila nueva en `report_jobs`.
