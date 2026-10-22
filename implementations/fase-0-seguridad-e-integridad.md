# Fase 0. Seguridad e integridad

Commit: `f6a402b` — `fix: scope SLA access, sessions and ticket reopen`.

La fase 0 está cerrada. No incluye la fase 1.

## Qué se hizo y por qué

Eran cuatro agujeros ya vistos en el código, todos en el camino de tickets y de sesión. Automatizar encima habría repetido el mismo fallo.

**El SLA deja de escribirse si el ticket no es tuyo.** `GET /tickets/:id/sla` exigía el permiso `tickets.view` y luego evaluaba por id. Evaluar no es una lectura: actualiza estados y puede crear una alerta y una notificación. Ahora el controlador usa el mismo alcance que el detalle del ticket. `findById` ya filtra por organización, salvo para el rol global. Si no encuentra el ticket, lanza 404 y `evaluateTicketSla` no llega a ejecutarse.

```139:157:src/modules/tickets/ticket.controller.ts
  async sla(
    request: FastifyRequest<{ Params: TicketShowParams }>,
    reply: FastifyReply,
  ) {
    /**
     * La evaluación escribe estados y puede crear alertas.
     * Primero se comprueba el mismo alcance que el detalle del ticket.
     * El scheduler no pasa por aquí: sigue llamando al servicio directamente.
     */
    await this.ticketService.findById(
      request.params.id,
      request.user.id,
      request.user.organizationId,
    );

    const result = await this.slaService.evaluateTicketSla(request.params.id);
```

El scheduler no pasa por esta ruta. Sigue llamando al servicio sin usuario y recorre todas las organizaciones. El filtro pertenece a la petición, que es quien tiene un usuario.

**El login ya no elige una fila al azar.** El email es único dentro de una organización, no en toda la base. Antes `findFirst` buscaba solo por email. Ahora el body lleva `organizationSlug`. Se busca la organización por ese slug, que sí es único, y el usuario por organización, email y status `ACTIVE`. Si el slug no existe, el usuario no está o la contraseña no coincide, la respuesta es siempre 401 `Invalid credentials`. Así no se dice cuál de los tres falló.

```15:34:src/modules/auth/auth.service.ts
  async login(
    email: string,
    password: string,
    organizationSlug: string,
  ): Promise<LoginResponse> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!organization) throw new AppError(401, "Invalid credentials");

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        organizationId: organization.id,
        status: "ACTIVE",
      },
    });
```

Cualquier cliente que hacía login solo con email y contraseña tiene que enviar también el slug. En el seed es `acme-corporation`.

**Un usuario que deja de estar activo pierde la sesión.** `DELETE /users/:id` ya borraba las sesiones. `PATCH` podía poner `SUSPENDED` o `INACTIVE` y el token seguía valiendo 24 horas, porque el guard solo miraba que la sesión no hubiera caducado. Ahora, si el status nuevo no es `ACTIVE`, el borrado ocurre en la misma transacción que el cambio. Y el guard rechaza la sesión si el usuario ya no está activo, por si la fila de sesión se quedó de antes.

```34:35:src/modules/auth/auth.guard.ts
  if (session.user.status !== UserStatus.ACTIVE)
    throw new AppError(401, "Invalid or expired session");
```

Cambiar solo el nombre no toca las sesiones. El borrado está en `UserService.update`:

```403:413:src/modules/users/user.service.ts
      /*
       * 6. Una sesión solo vale mientras el usuario sigue ACTIVE.
       *    DELETE /users/:id ya borraba las sesiones; el PATCH de status no.
       */
      if (data.status !== undefined && data.status !== UserStatus.ACTIVE) {
        await tx.session.deleteMany({
          where: {
            userId: existingUser.id,
          },
        });
      }
```

**Reabrir un ticket vuelve a poner la resolución en curso.** El ticket limpiaba `resolvedAt`, pero `TicketSla.resolvedAt` se quedaba puesto. Con la primera respuesta ya hecha, el barrido dejaba de mirar ese ticket y un segundo resolve no recalculaba nada. En la misma transacción del cambio de estado, si se pasa de `RESOLVED` a `IN_PROGRESS`, se anula solo `TicketSla.resolvedAt`.

```784:792:src/modules/tickets/ticket.service.ts
      if (
        existingTicket.status === TicketStatus.RESOLVED &&
        status === TicketStatus.IN_PROGRESS
      ) {
        await tx.ticketSla.updateMany({
          where: { ticketId: existingTicket.id },
          data: { resolvedAt: null },
        });
      }
```

`updateMany` no falla si ese ticket no tuviera fila de SLA. La primera respuesta y las alertas ya creadas se quedan. El estado `resolutionStatus` lo vuelve a calcular el barrido, o un `GET /tickets/:id/sla`, con el tiempo laboral que ya existía. No se mueven las fechas de vencimiento.

## Decisiones

- El slug es obligatorio. Hacer el email único en toda la base habría contradicho el esquema.
- El 401 del login es el mismo en todos los fallos.
- `OWNER` sigue pudiendo evaluar un ticket de otra organización, porque su scope es global. El 404 es para el resto de roles.
- No se tocó el calculador de horario ni la prueba rota del scheduler. Esa prueba es la fase 1.

## Cómo comprobarlo

Las 10 pruebas nuevas pasaron. `npx tsc --noEmit` también. La suite completa quedó en 74 pasadas y 1 fallida. La fallida es la de antes: `sla-scheduler.test.ts`, el caso «evalúa al arrancar». El doble no tiene `$transaction` y el servicio sí lo usa. No se arregló en este commit.

Para repetir solo lo de esta fase:

```text
npx vitest run src/modules/tickets/ticket.sla.access.test.ts src/modules/tickets/ticket.reopen.test.ts src/modules/auth/auth.guard.test.ts src/modules/auth/auth.service.test.ts src/modules/users/user.session.test.ts
```

La API no se levantó contra Postgres en este cierre. Con Compose, migraciones, seed y `npm run dev`:

1. `POST /auth/login` con email, contraseña y `"organizationSlug": "acme-corporation"`. Email y contraseña están en `USERS` de `prisma/seed.ts`. Sin slug, 400. Con un slug inventado, 401.
2. El 404 entre organizaciones no se puede ver solo con el seed: Acme es la única organización, y su admin es `OWNER`, que sí ve el resto. Hace falta un usuario no global y un ticket de otra org.
3. Entra con un agente, guarda el token y, con un admin, `PATCH /users/:id` con `{ "status": "SUSPENDED" }`. La siguiente petición con el token del agente responde 401.
4. Resuelve un ticket y llama a `PATCH /tickets/:id/reopen`. `tickets.resolvedAt` y `ticket_slas.resolvedAt` quedan vacíos. `firstResponseAt` del SLA no se borra.
