# Partidos BQTO — proyecto inicial

Este es el punto de partida de la web app. Todavía no está conectada a una
base de datos real: los partidos que ves son datos de ejemplo (`lib/mockData.js`),
para que puedan ver y tocar la app desde ya.

## Qué hay armado hasta ahora

- **Página principal** (`/`) — lista de partidos disponibles con cupos y precio
- **Login** (`/login`) — formulario de registro (todavía sin conectar)
- **Perfil** (`/perfil`) — perfil de jugador con historial (vacío por ahora)
- **Admin** (`/admin`) — formulario para publicar partidos (todavía sin conectar)

Nada se guarda todavía — es el "esqueleto" visual y de navegación. El
siguiente paso técnico es conectar Supabase (la base de datos) para que el
registro, los partidos y las inscripciones sean reales.

## Cómo correr esto en tu computadora

No necesitas saber programar para hacer esto, solo seguir los pasos:

### 1. Instalar Node.js
Node es el programa que permite correr la app en tu computadora.
Ve a https://nodejs.org y descarga la versión "LTS" (la recomendada).
Instálalo como cualquier programa (Siguiente, Siguiente, Finalizar).

### 2. Instalar un editor de código (opcional pero recomendado)
Descarga Visual Studio Code: https://code.visualstudio.com
Te sirve para ver y editar los archivos del proyecto más adelante.

### 3. Abrir una terminal en esta carpeta
- En Windows: abre la carpeta del proyecto, haz clic derecho dentro de ella
  y selecciona "Abrir en Terminal" (o "Open in Terminal").
- En Mac: abre la app "Terminal", escribe `cd ` (con un espacio) y luego
  arrastra la carpeta del proyecto a la ventana, y presiona Enter.

### 4. Instalar las dependencias
En la terminal, escribe y presiona Enter:
```
npm install
```
Esto descarga todas las piezas que la app necesita para funcionar
(puede tardar 1-2 minutos).

### 5. Correr la app
```
npm run dev
```
Cuando termine, abre tu navegador y entra a: http://localhost:3000

Ya deberías ver la lista de partidos de ejemplo funcionando.

## Siguiente paso: conectar la base de datos real (Supabase)

1. Crea una cuenta gratis en https://supabase.com
2. Crea un nuevo proyecto (elige una contraseña y guárdala)
3. Dentro del proyecto, ve a "Project Settings" → "API"
4. Copia la "Project URL" y la "anon public key"
5. En la carpeta del proyecto, copia el archivo `.env.local.example` y
   renómbralo a `.env.local`
6. Pega ahí los dos valores que copiaste
7. Reinicia la app (`Ctrl+C` en la terminal, luego `npm run dev` de nuevo)

A partir de ahí, ya se puede empezar a reemplazar los datos de ejemplo
(`lib/mockData.js`) por datos reales guardados en Supabase — ese sería
nuestro siguiente paso a trabajar juntos.

## Estructura de carpetas (para orientarse)

```
futbol-app/
├── app/                  → cada carpeta aquí es una página de la app
│   ├── page.js           → página principal (lista de partidos)
│   ├── login/page.js     → página de registro
│   ├── perfil/page.js    → página de perfil de jugador
│   ├── admin/page.js     → página para crear partidos (uso interno)
│   └── layout.js         → estructura compartida por todas las páginas
├── components/           → piezas reutilizables (tarjeta de partido, barra de navegación)
├── lib/
│   ├── mockData.js       → datos de ejemplo (se reemplaza después)
│   └── supabaseClient.js → conexión a la base de datos real
└── .env.local.example    → plantilla para las claves de Supabase
```

## Actualización: ya conectado a Supabase

Las páginas principal, login, admin y perfil ahora leen y escriben datos
reales en Supabase (ya no usan datos de ejemplo). Para que funcione,
asegúrate de haber corrido el script SQL que crea las tablas `partidos`,
`inscripciones` y `perfiles` (Claude te lo dio en el chat), y de tener
tu archivo `.env.local` con las claves de tu proyecto.

Flujo para probarlo:
1. Ve a `/login` y crea una cuenta
2. Ve a `/admin` y publica un partido de prueba
3. Ve a `/` (inicio) y deberías ver ese partido — dale a "Unirme y pagar"
4. Ve a `/perfil` para ver tus datos
