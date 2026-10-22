# Fase 16. Mismo 401 en el login y en la sesión

Una cuenta que no existe tarda lo mismo que una contraseña mala, y una sesión caducada no se distingue de una inválida.

## Qué se hizo y por qué

`login` respondía 401 en cuanto no encontraba la organización o el usuario, sin llamar a `bcrypt.compare`. Comparar un hash cuesta tiempo. Quien midiera la respuesta sabía si el slug y el email existían, aunque el mensaje fuera el mismo.

Ahora siempre hay una comparación. Si no hay usuario, se usa un hash fijo generado al cargar el módulo, `bcrypt.hashSync("flowdesk-login-dummy", 12)`. Después, si falta la organización, el usuario o la contraseña, el 401 es `Invalid credentials`.

En el guard, la sesión caducada decía `Session expired`. Ausente o de un usuario que ya no está `ACTIVE` decía `Invalid or expired session`. Las tres quedan en ese segundo mensaje. No se borra la fila caducada: solo deja de delatar que el token existió.

## Decisión

No se mide el tiempo en la prueba. Se espía `bcrypt.compare` y se comprueba que se llamó con la contraseña y un hash bcrypt. Un umbral de milisegundos fallaría según la máquina.

Redis sigue sin usarse. El argumento de `AuthService` no cambia.

## Cómo comprobarlo

```text
npx vitest run src/modules/auth/auth.service.test.ts src/modules/auth/auth.guard.test.ts
```

Pasan 12 pruebas. Slug inexistente y email inexistente llaman a `compare` y responden 401. La sesión con `expiresAt` en el pasado usa `Invalid or expired session`.
