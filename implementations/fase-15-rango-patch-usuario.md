# Fase 15. Rango en el PATCH de usuario

`PATCH /users/:id` usa la misma regla que desactivar. Un admin ya no puede suspender al owner ni cambiarle el email o el rol.

## Qué se hizo y por qué

`canDisableUser` ya decía quién puede desactivar a quién: un admin no se desactiva, no toca a un owner y no toca a otro admin. `DELETE /users/:id` la llamaba. `update` no. Con `users.update`, el mismo admin hacía `PATCH` con `status: SUSPENDED`, borraba las sesiones y podía cambiar el email.

Ahora, si el objetivo es otro usuario, `update` exige `canDisableUser` antes de mirar el email o el rol. Si es uno mismo y el status cambia, responde 403 con el mismo mensaje que desactivarse. Cambiar el propio nombre sigue permitido. El rol nuevo sigue pasando por `canAssignRole`.

## Decisión

El 403 de otro usuario dice `You cannot update this user`, no el de desactivar. El PATCH puede cambiar nombre o email, no solo el status. El de uno mismo reutiliza `You cannot disable yourself`.

## Cómo comprobarlo

```text
npx vitest run src/modules/users/user.session.test.ts
```

Pasan 4 pruebas. Suspender a quien `canDisableUser` rechaza no abre la transacción ni borra sesiones. Cambiarse el propio status tampoco. Suspender a un agente, con el permiso, sigue borrando las sesiones.
