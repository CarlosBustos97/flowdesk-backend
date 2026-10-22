# Fase 7. ESLint

`npm run lint` ya tiene configuración y termina en cero. No hay workflow de GitHub: este repositorio no tiene remoto.

## Qué se hizo y por qué

ESLint 9 exige `eslint.config.js`. Sin ese archivo, `npx eslint .` salía con error antes de mirar el código. El script `npm run lint` ya apuntaba a `eslint .`; le faltaba la config.

Las reglas son las recomendadas de ESLint y de typescript-eslint. No se ha pasado Prettier. Un nombre que empieza por `_` no cuenta como variable sin usar: el código lo usa para vaciar un stream de un archivo que se va a rechazar.

El primer pase marcó 11 avisos en 7 archivos, no un reescrito de estilo. Se quitaron imports que nadie usaba y un `let` que nunca se reasignaba pasó a `const`.

## TypeScript 7 y el linter

TypeScript 7.0 no publica la API que typescript-eslint importa, y ese paquete se niega a arrancar si el paquete `typescript` es la 7. La guía de TypeScript para este hueco es tener las dos a la vez:

- `typescript` queda como alias de `@typescript/typescript6`. Es la API 6.0 que lee el linter. El binario se llama `tsc6`.
- `@typescript/native` es el compilador 7.0.2. `npx tsc` sigue siendo esa versión.

`npx tsc --version` responde `Version 7.0.2`. El typecheck del proyecto no ha cambiado de compilador.

## CI

`git remote` no devuelve ningún remoto, así que no se ha añadido un workflow. Cuando el repo esté en GitHub, el workflow puede ser `npm ci`, `npx prisma generate` (el cliente no está en git y `tsc` lo necesita), `npx tsc --noEmit` y `npx vitest run`. Sin Postgres.

## Cómo comprobarlo

```text
npx eslint .
npx tsc --noEmit
npx vitest run
```

Los tres terminan con exit 0. `npx tsc --version` es 7.0.2. La suite sigue en 16 archivos y 110 pruebas. No se ha ejecutado `prettier --write`.
