# Flash Cards (Inglés-Español)

Una aplicación full-stack de tarjetas de estudio con repetición espaciada, autenticación JWT, y generación de audio con IA.

## 🚀 Características Principales

- **Sistema de Autenticación**: Registro, login, y gestión de usuarios con JWT
- **Roles de Usuario**: Usuarios regulares y administradores con permisos diferenciados
- **Repetición Espaciada**: Algoritmo inteligente para optimizar el aprendizaje
- **Audio con IA**: Generación de pronunciación usando Google Gemini TTS
- **Interfaz Moderna**: React 19 con TailwindCSS y diseño responsivo
- **Gestión Avanzada**: Panel de administración para usuarios y tarjetas
- **Seguridad Robusta**: Hashing de contraseñas, validación, y almacenamiento seguro

## 📦 Instalación

1. Instala dependencias:
   ```bash
   npm install
   cd client && npm install
   ```

2. Configura variables de entorno (crear archivo `.env`):
   ```bash
   GEMINI_API_KEY=tu_clave_de_gemini
   JWT_SECRET=tu_secreto_jwt_super_seguro
   ```

3. Inicia el proyecto en modo desarrollo:
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
    - `GEMINI_API_KEY` (tu clave privada para generación de audio y tips)

## 🔐 Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (NO lo subas al repo):

```bash
# Clave API de Google Gemini (requerida)
GEMINI_API_KEY=tu_clave_de_gemini

# JWT Secret para autenticación (REQUERIDO para producción)
JWT_SECRET=tu_secreto_jwt_muy_seguro_y_largo_minimo_256_bits

# Configuración JWT opcional
JWT_EXPIRES_IN=24h

# Cloudflare R2 para almacenamiento de archivos (opcional)
R2_ACCESS_KEY_ID=tu_access_key
R2_SECRET_ACCESS_KEY=tu_secret_key
R2_BUCKET=tu_bucket
R2_ENDPOINT=https://tu-endpoint.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://tu-bucket.r2.dev
```

**⚠️ Seguridad Importante**:
- Nunca hagas commit del archivo `.env`
- En producción, usa un JWT_SECRET de al menos 256 bits
- Para producción, configura todas las variables en tu plataforma de hosting

## 📝 Scripts Útiles

- `npm run dev`: Modo desarrollo completo (backend + frontend)
- `npm run build`: Construye el frontend para producción
- `npm start`: Inicia solo el backend en modo producción
- `npm test`: Ejecuta todos los tests (backend + frontend)
- `npm run test:back`: Ejecuta tests del backend con Jest
- `npm run test:front`: Ejecuta tests del frontend
- `npm run test:e2e`: Ejecuta tests end-to-end con Playwright
- `npm run test:contracts`: Ejecuta tests de contrato (TDD)
- `npm run test:journeys`: Ejecuta tests de flujos de usuario
- `npm run test:performance`: Ejecuta tests de rendimiento
- `npm run test:accessibility`: Ejecuta tests de accesibilidad
- `npm run test:coverage`: Genera reportes de cobertura
- `npm run test:coverage:report`: Reporte completo de cobertura
- `npm run test:monitor`: Dashboard de monitoreo en tiempo real
- `npm run data:cleanup`: Limpia datos de prueba
- `npm run data:health`: Verifica salud del entorno de pruebas

## 🎯 Funcionalidades

### Para Usuarios
- **Registro/Login**: Sistema completo de autenticación con validación de contraseñas
- **Estudio Inteligente**: Repaso de tarjetas con algoritmo de repetición espaciada
- **Audio IA**: Pronunciación generada automáticamente con Google Gemini TTS
- **Progreso Personal**: Seguimiento individual del progreso de aprendizaje
- **Perfil de Usuario**: Gestión de cuenta personal y estadísticas

### Para Administradores
- **Gestión de Usuarios**: CRUD completo de usuarios con roles
- **Gestión de Tarjetas**: Crear, editar y eliminar tarjetas del sistema
- **Panel de Control**: Vista administrativa con métricas y gestión masiva
- **Control de Acceso**: Protección de rutas administrativas

## 🏗️ Arquitectura Técnica

```
flash-cards/
├── 📁 server/                  # Backend Express.js
│   ├── middleware/            # Middlewares de autenticación
│   ├── utils/                 # Utilidades (JWT, passwords, etc.)
│   ├── services/              # Servicios (Gemini TTS, etc.)
│   ├── config/                # Configuración de BD y migraciones
│   └── index.js               # Servidor principal
│
├── 📁 client/                 # Frontend React
│   ├── src/
│   │   ├── components/        # Componentes UI
│   │   ├── contexts/          # Contexts de React (Auth, etc.)
│   │   ├── pages/             # Páginas principales
│   │   ├── utils/             # Utilidades de cliente
│   │   └── tests/             # Tests E2E y unitarios
│   └── package.json
│
├── 📄 SECURITY_AUDIT.md       # Auditoria de seguridad completa
├── 📄 CLAUDE.md              # Documentación técnica detallada
└── 📄 README.md              # Este archivo
```

## 🔒 Seguridad

- **JWT Authentication**: Tokens seguros con expiración automática
- **Password Hashing**: bcrypt con 12 salt rounds
- **Input Validation**: Validación robusta en cliente y servidor
- **Role-Based Access**: Control granular de permisos
- **XSS Protection**: Almacenamiento seguro de tokens
- **Audit Trail**: Registro de acciones administrativas

**Puntuación de Seguridad**: 8.5/10 (Ver `SECURITY_AUDIT.md` para detalles)

## 🧪 Testing Integral

### Infraestructura de Testing Implementada
- **420+ Tests de Contrato**: Enfoque TDD con tests diseñados para fallar inicialmente
- **Tests E2E Completos**: Playwright con soporte multi-navegador
- **Tests de Rendimiento**: Benchmarks de carga y tiempo de respuesta
- **Tests de Accesibilidad**: Cumplimiento WCAG 2.1 AA
- **Tests de Casos Edge**: Manejo de errores y validaciones
- **CI/CD Automatizado**: Pipeline de GitHub Actions con testing en matriz
- **Monitoreo en Tiempo Real**: Dashboard de ejecución de tests
- **Documentación Completa**: Guías detalladas de testing

### Categorías de Tests

#### Tests de Contrato (420+ tests)
- **Propósito**: Enfoque TDD con tests que fallan primero (fase roja)
- **Cobertura**: Contratos de API, autenticación, operaciones CRUD
- **Ubicación**: `tests/e2e/contracts/`

#### Tests de Flujos de Usuario
- **Autenticación**: Flujos completos de registro e inicio de sesión
- **Gestión de Tarjetas**: Operaciones CRUD con interfaz
- **Sesiones de Aprendizaje**: Flujos de repetición espaciada
- **Dashboard Administrativo**: Flujos de gestión de usuarios

#### Tests de Rendimiento
- **Tests de Carga**: Simulación de usuarios concurrentes
- **Benchmarks de Rendimiento**: Validación de tiempos de respuesta
- **Monitoreo de Memoria**: Seguimiento de consumo de recursos

#### Tests de Accesibilidad
- **Cumplimiento WCAG 2.1**: Estándares AA de accesibilidad
- **Multi-navegador**: Testing en Chromium, Firefox, WebKit
- **Navegación por Teclado**: Accesibilidad completa por teclado

### Métricas de Cobertura
- **Statements**: Meta 90%+
- **Branches**: Meta 85%+
- **Functions**: Meta 90%+
- **Lines**: Meta 90%+

### Ejecución de Tests
```bash
# Ejecutar categorías específicas
npm run test:contracts     # Tests de contrato TDD
npm run test:journeys      # Tests de flujos de usuario
npm run test:performance   # Tests de rendimiento
npm run test:accessibility # Tests de accesibilidad

# Ejecución avanzada
npm run test:runner -- --suite=contracts --browser=chromium
npm run test:monitor --port=8080  # Dashboard en tiempo real
```

### Gestión de Datos de Prueba
```bash
npm run data:cleanup      # Limpieza completa
npm run data:health       # Verificación de salud
npm run data:seed         # Seeding de datos de prueba
```

### Documentación de Testing
- **[Guía de Testing E2E](docs/testing/e2e-testing-guide.md)**: Documentación completa de testing
- **[Reporte de Cobertura](docs/testing/test-coverage-report.md)**: Análisis y objetivos de cobertura
