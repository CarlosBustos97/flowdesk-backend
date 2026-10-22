# Fase 5. API keys

Se puede crear una clave, ver el secreto una sola vez y llamar a la API con `X-Api-Key`. La clave queda limitada a los permisos que se le dieron y a su organización. El login con bearer no cambia.

## Qué se hizo y por qué

`ApiKey` ya estaba migrada, pero `keyHash` no era único y nadie autenticaba con ella. Sin el índice único, dos filas podrían compartir hash y `findUnique` no sería una búsqueda segura. La migración `20261022193000_unique_api_key_hash` añade ese índice. El hash es SHA-256 en hexadecimal, el mismo cálculo que el de la sesión. En la base no se guarda el secreto.

El alta devuelve el secreto con prefijo `fdk_`. El listado y la revocación devuelven nombre, prefijo, scopes, caducidad y si está revocada. No devuelven el secreto ni el hash. `PATCH /api-keys/:id/revoke` no borra la fila: pone `revokedAt`, así se puede ver que existió.

Cada uso vigente actualiza `lastUsedAt`. Sirve para saber si esa clave sigue en uso antes de revocarla.

## Cómo entra una petición

`authGuard` mira primero `Authorization`. Si llega `Bearer`, sigue el camino de la sesión y no consulta la tabla de claves. Si no hay bearer y llega `X-Api-Key`, busca el hash.

La clave no autentica cuando no existe, está revocada, está caducada o quien la creó ya no está `ACTIVE`. Los cuatro casos responden 401 con `Invalid or revoked API key`. No hace falta distinguirlos al cliente.

Si la clave vale, `request.user` es quien la creó, pero `organizationId` es el de la clave. Aunque ese usuario tenga rol global, esta petición queda atada a la organización de la clave: `getScope` devuelve `ORGANIZATION`. Por eso una clave de la org A recibe 404 al pedir un ticket de la org B. El bearer de ese mismo usuario global sigue viendo lo que ya veía.

El permiso no sale del rol. `requirePermission` mira `scopes`. Si el código no está en la clave, responde 403 y no pregunta a los roles. Así una clave con solo `tickets.view` no hereda el resto de permisos de un admin.

Al crearla, cada scope tiene que ser un código de `PERMISSIONS` y el autor tiene que tenerlo. No se puede emitir una clave más fuerte que uno mismo. Hace falta al menos un scope.

`POST /auth/logout` con una clave no tiene sesión. Responde 401. La forma de cortar el acceso es revocar la clave.

## Auditoría

En la misma transacción del alta se escribe `api_key.created` con nombre, prefijo, scopes y caducidad. Al revocar, `api_key.revoked` con la fecha. El secreto y el hash no entran en el JSON.

## Permisos

`api_keys.view`, `api_keys.create` y `api_keys.revoke`. Los tienen `OWNER`, `ADMIN` y `MANAGER`. `AGENT` y `USER` no crean claves. Una base ya sembrada no tiene estos códigos hasta volver a ejecutar el seed.

## Cómo comprobarlo

```text
npx prisma migrate dev
npx vitest run src/modules/api-keys src/modules/auth/auth.guard.test.ts
npx vitest run
npx tsc --noEmit
```

En este cierre, el módulo y el guard cubren: el secreto solo en el alta, el listado sin secreto ni hash, la revocación auditada, el scope desconocido, el scope que el autor no tiene, la clave revocada y la caducada en 401, el bearer que no consulta la tabla de claves, el 403 si falta el scope, y el ticket de otra organización en 404 aunque el creador sea `OWNER`. La suite completa tiene 15 archivos y 100 pruebas, cero fallos. `tsc --noEmit` terminó sin errores.

`npx prisma generate` no pudo sustituir el binario del motor porque el archivo estaba bloqueado por otro proceso. Los tipos generados ya aceptan buscar por `keyHash`. Conviene cerrar el proceso que tenga abierto `query_engine-windows.dll.node` y volver a lanzar `npx prisma generate`, y aplicar la migración contra Postgres antes de probar a mano. No levanté la API contra la base.

A mano, con la migración aplicada y el seed de nuevo:

1. Entra con bearer. `POST /auth/login` sigue igual. El slug es `acme-corporation`. Usuarios y contraseñas están en `prisma/seed.ts`.
2. `POST /api-keys` con un nombre y `"scopes": ["tickets.view"]`. La respuesta trae `secret`. Guárdalo: no vuelve a salir.
3. `GET /api-keys`. Se ve el prefijo y no el secreto.
4. `GET /tickets/:id` con `X-Api-Key` y sin bearer. Un ticket de esa organización responde 200. Un ticket de otra organización responde 404.
5. La misma clave contra una ruta cuyo permiso no esté en `scopes` responde 403.
6. `PATCH /api-keys/:id/revoke`. La siguiente llamada con esa clave responde 401.
7. En `audit_logs`, `api_key.created` y `api_key.revoked` no contienen el secreto.
