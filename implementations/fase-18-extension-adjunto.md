# Fase 18. Extensión del adjunto

El archivo en disco usa la extensión del tipo MIME permitido. El nombre que manda el cliente no decide esa extensión.

## Qué se hizo y por qué

`LocalStorage` tomaba la extensión con `extname(originalName)`. Un PNG llamado `evil.html` se guardaba como `.html`. No hay ruta de descarga, pero el nombre en disco no debe mentir el tipo.

`extensionForUpload` elige la extensión después de pasar `isAllowedMimeType`:

- `application/pdf` → `.pdf`
- `image/png` → `.png`
- `text/plain` → `.txt`
- `image/jpeg` conserva `.jpg` o `.jpeg` si el nombre ya termina así; si no, `.jpg`

`safeOriginalName` se queda con el último segmento, cambia `\` por `/` y recorta a 255 caracteres. Ese valor es el que se guarda en `originalName`. El MIME que no está en la lista sigue respondiendo 400 y no escribe el archivo.

## Cómo funciona

El servicio valida el ticket y el MIME. Si el tipo está permitido, calcula el nombre seguro y la extensión y se las pasa a `save`. `save` solo une un UUID con esa extensión. El nombre original no vuelve a entrar en el path.

## Cómo comprobarlo

```text
npx vitest run src/modules/attachments/attachment.service.test.ts
```

Un PNG llamado `evil.html` queda con `fileName` terminado en `.png` y `originalName` igual a `evil.html`. `text/html` responde 400 y no crea fila. `.jpeg` se conserva cuando el tipo es `image/jpeg`.
