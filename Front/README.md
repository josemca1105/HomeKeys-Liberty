# HomeKeys Liberty - Frontend

Aplicación web privada para la gestión de captaciones inmobiliarias de HomeKeys Liberty.

## Estado actual

- Login conectado a la API real.
- Sesión persistida en `sessionStorage` y validada con `GET /users/me`.
- Expiración automática según el token JWT.
- Logout con revocación en el servidor y limpieza local.
- Dashboard privado con datos reales del usuario.
- Navegación privada de Inicio y Captaciones.
- Listado de captaciones con búsqueda, filtros, orden y paginación.
- Detalle de captación con galería, propietario, características y ubicación.
- Fotografías privadas mediante peticiones autenticadas y Object URLs.
- Tipos generados desde el contrato OpenAPI del backend.
- Bloqueo visual cuando `mustChangePassword` está activo.
- Diseño responsive con prioridad en Android e iPhone.
- Áreas táctiles de al menos 48 px y soporte para safe areas.
- Avisos de éxito con cierre automático y contador visible.
- Los errores de credenciales se limpian al editar los campos.
- Diseño con la identidad visual de HomeKeys Liberty.

## Requisitos

- Node.js 20 o superior.
- npm.
- Backend de HomeKeys Liberty disponible en `http://localhost:3000`.

El servidor de desarrollo de Vite redirige `/api` hacia `http://127.0.0.1:3000`, por lo que el backend no necesita estar expuesto a la red local ni modificar `CORS_ORIGINS`.

## Configuración local

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
}
npm install
npm run dev
```

La aplicación se ejecuta por defecto en `http://localhost:5173`.

## Probar en el teléfono

1. Inicia el backend en su terminal:

```powershell
cd C:\Users\jmgam\OneDrive\Documentos\Programacion\HomeKeys-Liberty\Back
npm run dev
```

2. Inicia el frontend exponiéndolo a la red local:

```powershell
cd C:\Users\jmgam\OneDrive\Documentos\Programacion\HomeKeys-Liberty\Front
npm run dev:mobile
```

3. Obtén la IPv4 de la PC:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object InterfaceAlias, IPAddress
```

4. Abre en el teléfono, usando la misma Wi-Fi:

```text
http://IP-DE-LA-PC:5173
```

Solo el puerto `5173` debe estar permitido en el Firewall. Las peticiones a `/api` viajan al backend local mediante el proxy de Vite. El teléfono nunca necesita alcanzar `localhost:3000`.

Este proxy es una herramienta de desarrollo y vista previa. En producción, el servidor web debe redirigir `/api` al backend o configurarse una URL absoluta para la API.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | Ruta relativa para el proxy de desarrollo o URL absoluta de la API. |
| `VITE_APP_NAME` | `HomeKeys Liberty` | Nombre visible de la aplicación. |

Con `VITE_API_BASE_URL=/api/v1`, las peticiones son del mismo origen y CORS no interviene. Para consumir la API directamente, se puede usar una URL absoluta y configurar `CORS_ORIGINS` en el backend.

Las variables `VITE_*` son públicas y quedan incluidas en el bundle. No deben contener secretos.

## Rutas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/login` | Pública | Inicio de sesión. Redirige al Dashboard si ya existe una sesión válida. |
| `/dashboard` | Privada | Panel principal con la información del usuario autenticado. |
| `/captaciones` | Privada | Inventario, búsqueda, filtros, orden y paginación. |
| `/captaciones/:id` | Privada | Detalle, galería y datos de una captación accesible. |
| `/` | Redirección | Lleva a Login o Dashboard según la sesión. |
| Otras rutas | Redirección | Llevan al Login con aviso o al Dashboard si hay sesión. |

## Captaciones

- ADMIN consulta todas las captaciones y puede filtrar por agente.
- PARTNER consulta únicamente las captaciones que el backend le autoriza.
- Los filtros se conservan en la URL para mantener el estado al volver del detalle.
- Las imágenes se descargan con Bearer token, se convierten en Object URLs y se revocan al desmontar.
- Las imágenes de tarjetas se cargan al acercarse al viewport.
- Los importes y áreas se reciben como strings Decimal y se formatean sin operar monetariamente con ellos.
- La ubicación enlaza a OpenStreetMap externamente. MapLibre + OpenFreeMap se incorporará en una rama posterior.

## Comportamiento de sesión

- El token se guarda en `sessionStorage`.
- La sesión se restaura consultando `GET /users/me`.
- Un token inválido, revocado o expirado elimina la sesión y muestra el aviso correspondiente.
- La API continúa siendo la autoridad de autorización.
- No hay refresh token en esta etapa.
- Un usuario con cambio de contraseña pendiente no puede acceder al contenido normal del Dashboard.
- El autofocus se omite para evitar que el teclado móvil se abra al cargar Login.
- La interfaz respeta `safe-area-inset-top` y `safe-area-inset-bottom`.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo en localhost. |
| `npm run dev:mobile` | Expone Vite a la red local para probar desde un teléfono. |
| `npm run build` | Ejecuta TypeScript y genera el bundle de producción. |
| `npm run preview` | Sirve localmente el bundle de producción. |
| `npm run typecheck` | Comprueba los tipos sin generar archivos. |
| `npm run lint` | Ejecuta Oxlint. |
| `npm test` | Ejecuta las pruebas con Vitest. |
| `npm run test:watch` | Ejecuta las pruebas en modo interactivo. |
| `npm run test:coverage` | Genera el reporte de cobertura. |
| `npm run generate:api` | Genera `src/api/generated/schema.d.ts` desde `../Back/openapi.yaml`. |

## Estructura

```text
src/
├── api/                    # Cliente HTTP, token y errores de API
├── app/                    # Providers, router, guards y QueryClient
├── assets/
│   └── brand/              # Logo e identidad visual
├── components/
│   ├── brand/              # Componentes de marca
│   ├── feedback/           # Estados de carga
│   ├── images/             # Imágenes autenticadas con Bearer
│   ├── layout/             # Shell de la aplicación autenticada
│   └── ui/                 # Componentes compartidos
├── config/                 # Validación de variables de entorno
├── features/
│   ├── auth/               # Login, sesión y protección de rutas
│   ├── dashboard/          # Panel principal
│   └── properties/         # Captaciones: API, filtros, listado y detalle
├── hooks/                  # Hooks compartidos
├── lib/                    # Utilidades de JWT, clases y usuarios
├── test/                   # Setup, MSW, fixtures y helpers
├── App.tsx
├── index.css
└── main.tsx
```

## Pruebas actuales

Las pruebas cubren:

- Login correcto con redirección al Dashboard.
- Credenciales inválidas sin abandonar el Login.
- Acceso directo a una ruta privada sin sesión.
- Restauración de una sesión válida.
- Redirección al Dashboard al abrir Login con sesión activa.
- Rechazo de tokens expirados.
- Logout con confirmación.
- Bloqueo por cambio de contraseña pendiente.
- Renderizado accesible del botón compartido.
- Cierre automático de avisos de éxito con contador.
- Pausa del contador mientras el aviso recibe interacción.
- Cierre manual de advertencias.
- Limpieza del error de credenciales al editar el formulario.
- Interpretación, serialización y saneamiento de filtros de captaciones.
- Listado de captaciones y envío de filtros a la API.
- Alcance de PARTNER sin consultar el directorio de usuarios.
- Detalle de captación y estado de no encontrada.
- Descarga autenticada de fotografías y liberación de Object URLs.
