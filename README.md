# Flash Cards (Inglés-Español)

## Instalación

1. Instala dependencias:
   ```bash
   npm install
   cd client && npm install
   ```
2. Corre el proyecto:
   ```bash
   npm run dev
   ```

## Despliegue en Render

1. Haz push de tu código a GitHub.
2. Crea un nuevo servicio web en [Render](https://render.com/), conecta tu repositorio y Render detectará el archivo `render.yaml`.
3. Render instalará dependencias, construirá el frontend y levantará el backend automáticamente.
4. Configura las variables de entorno necesarias en el dashboard de Render:
    - `NODE_ENV=production`
    - `PORT=10000` (o el puerto que Render asigne)
    - `ELEVENLABS_API_KEY` (tu clave privada, si usas audio)

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (NO lo subas al repo):

```
ELEVENLABS_API_KEY=tu_clave
```

## Scripts útiles

- `npm run dev`: modo desarrollo (frontend y backend)
- `npm run build`: construye el frontend (React)
- `npm start`: inicia el backend en producción

## Funcionalidades
- Home: repaso de tarjetas con efectos y botones "Lo sé"/"No lo sé" (memoria espaciada)
- Admin: CRUD de tarjetas (crear, editar, borrar)
- Navegación entre Home/Admin

## Estructura
- `/server`: Backend Express (API tarjetas)
- `/client`: Frontend React
