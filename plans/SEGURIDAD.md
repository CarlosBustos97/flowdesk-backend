# Barrido de seguridad

Guía ejecutable. Se trabaja **una fase cada vez**.

Al cerrar una fase:

1. Las pruebas de esa fase pasan.
2. Este archivo marca la fase como completada.
3. Hay un commit solo con lo de esa fase.
4. El reporte queda en `implementations/`.
5. No se arrastra trabajo de la fase siguiente.

Redis no se toca. Sigue siendo el `ping` de `GET /health/ready`. No se reabren las carreras del SLA, ni tasks, invitaciones, reset de contraseña, correo o hosting.

## Estado

- [x] **Fase 15.** Rango en el PATCH de usuario. Completada. Reporte: [implementations/fase-15-rango-patch-usuario.md](../implementations/fase-15-rango-patch-usuario.md).
- [x] **Fase 16.** Mismo 401 en el login y en la sesión. Completada. Reporte: [implementations/fase-16-login-401.md](../implementations/fase-16-login-401.md).
- [ ] **Fase 17.** Helmet y límite del login.
- [ ] **Fase 18.** Extensión del adjunto.

## Qué se revisó

Rutas con `authGuard` salvo `POST /auth/login`, `GET /health` y `GET /health/ready`. El SQL de health es un `SELECT 1` parametrizado. Las claves de API comprueban revocación, caducidad, usuario activo y scopes. Los comentarios internos se filtran. El hash de la contraseña no sale en las respuestas. El adjunto corta a 10 MB y borra el archivo si la fila no se guarda. Asignar desde un workflow pasa por el servicio de tickets.

## Fallo a corregir

`DELETE /users/:id` llama a `canDisableUser`: un admin no se desactiva, no desactiva a un owner y no desactiva a otro admin. `UserService.update` no llama a ese método. Un admin con `users.update` puede suspender al owner, borrar sus sesiones y cambiarle el email o el rol.

El login responde 401 antes de `bcrypt.compare` si la organización o el usuario no existen. Una sesión caducada dice `Session expired` y una inválida dice `Invalid or expired session`.

`@fastify/helmet` está instalado y no se registra. No hay límite en `POST /auth/login`. La extensión del adjunto sale del nombre que manda el cliente.

## Fase 15. Rango en el PATCH de usuario

**Estado:** completada. Reporte: [implementations/fase-15-rango-patch-usuario.md](../implementations/fase-15-rango-patch-usuario.md).

Si el objetivo es otro usuario, `update` exige `canDisableUser` antes de cambiar nombre, email, status o rol. Si es uno mismo, un cambio de status responde 403. El cambio de rol sigue pasando por `canAssignRole`.

**Prueba.** Admin contra un owner: 403 y ninguna sesión borrada. Admin contra un agente: las sesiones se borran. Uno mismo con status: 403.

## Fase 16. Mismo 401 en el login y en la sesión

**Estado:** completada. Reporte: [implementations/fase-16-login-401.md](../implementations/fase-16-login-401.md).

Si falta la organización o el usuario, `login` ejecuta `bcrypt.compare` contra un hash fijo y luego responde `Invalid credentials`. Sesión ausente, caducada o de usuario no activo responden `Invalid or expired session`.

## Fase 17. Helmet y límite del login

**Estado:** pendiente.

Helmet con `contentSecurityPolicy: false`. `@fastify/rate-limit` solo en memoria y solo en `POST /auth/login`: 10 peticiones por minuto por IP. Sin Redis.

**Prueba.** La petición 11 responde 429. `GET /health` no entra. Hay un header de Helmet. `GET /api/docs` sigue en 200.

## Fase 18. Extensión del adjunto

**Estado:** pendiente.

La extensión guardada sale del MIME permitido: pdf, jpg o jpeg, png, txt. `originalName` es el nombre base, recortado a 255. Un PNG llamado `evil.html` se guarda con extensión de imagen. Un MIME fuera de la lista sigue en 400.
