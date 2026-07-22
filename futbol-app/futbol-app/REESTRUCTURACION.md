# Reestructuración a Sports Hub (fútbol + pádel)

Este paquete contiene tu proyecto `futbol-app` reorganizado como un hub multideporte,
manteniendo TODO lo que ya tenías funcionando en fútbol. Resumen de lo que cambió:

## 1. Carpetas

Todo lo específico de fútbol se movió a su propio namespace, en vez de vivir en la
raíz del proyecto:

```
app/
  page.js                -> Hub (elegir Fútbol o Pádel)
  login/                 -> Alta / ingreso de la CUENTA núcleo (ya no pide nacionalidad/posición)
  perfil/                -> Perfil de CUENTA: nombre, correo, avatar del hub, y accesos a cada deporte
  actualizar-clave/
  api/futbol/bcv-rate/    -> (antes app/api/bcv-rate, específico de fútbol)

  futbol/
    page.js               -> Home de fútbol (antes app/futbol/page.js)
    perfil/               -> Carta de jugador + stats + logros (antes app/perfil/page.js)
    jugadores/            -> (antes app/jugadores)
    partido/[id]/         -> (antes app/partido/[id])
    creditos/             -> (antes app/creditos)
    admin/                -> (antes app/admin)

  padel/
    page.js               -> Home de pádel (reescrita, ya NO es una copia de fútbol)
    perfil/               -> Estadísticas de pádel (nuevo)

components/
  Navbar.js, CountryFlag.js, CountrySelect.js   -> compartidos entre deportes
  futbol/  -> PlayerCard, PartidoCard, AccionesPartido, EstadoMiPartido, LogroBadge
  padel/   -> PadelStatsCard (nuevo)

lib/
  supabaseClient.js, countries.js, cuentas.js   -> compartidos
  futbol/  -> logros.js, paymentHelpers.js

supabase/
  migrations/0001_cuenta_nucleo_y_perfiles_por_deporte.sql   -> nuevo, ver abajo
```

Ya corrí `npm install && next build` sobre esta versión y compila sin errores.

## 2. Base de datos (Supabase)

- Nueva tabla **`cuentas`**: la cuenta núcleo (1 fila por usuario de `auth.users`).
  Guarda nombre, correo, teléfono y el avatar del hub.
- La tabla **`perfiles`** se renombra a **`perfiles_futbol`** (sin perder datos: mismo
  `id`, mismas columnas). Todo tu código de fútbol sigue funcionando igual.
- Nueva tabla **`perfiles_padel`**: mismo patrón (`id` = id del usuario), con nivel,
  posición preferida, partidos jugados, victorias, derrotas y puntos.
- Un usuario nuevo, al registrarse, solo obtiene automáticamente su fila en `cuentas`.
  El perfil de fútbol y/o de pádel se crean **a demanda**, la primera vez que visita
  `/futbol/perfil` o `/padel/perfil` (ahí se le pide nacionalidad/posición o
  nivel/posición, según el deporte).

Corre el archivo `supabase/migrations/0001_cuenta_nucleo_y_perfiles_por_deporte.sql`
en el SQL Editor de Supabase. Es idempotente (se puede correr más de una vez sin
romper nada), pero **haz un respaldo antes** y lee la nota sobre el trigger existente
al principio del archivo.

## 3. Qué NO se tocó todavía (a propósito)

- La lógica interna de partidos, pagos, logros y admin de fútbol no cambió, solo se
  movió de carpeta.
- Pádel por ahora solo tiene "perfil + estadísticas". Reservas y partidos de pádel
  quedan para una siguiente fase, cuando definamos ese modelo de datos.
- Se corrigió, de paso, un bug que ya existía: `app/api/bcv-rate/page.js` era un
  archivo vacío que chocaba con `route.js` y rompía el build de producción. Se
  eliminó y el endpoint se movió a `app/api/futbol/bcv-rate/route.js`.
- El enlace roto "Registrarse" del hub (apuntaba a `/registro`, que no existía) ahora
  apunta a `/login?modo=registro`.

## 4. Cómo aplicar esto a tu repositorio real

1. Copia estas carpetas (`app`, `components`, `lib`, `supabase`) sobre tu repo local,
   reemplazando lo existente.
2. Revisa el diff con `git status` / `git diff` antes de commitear.
3. Corre la migración SQL en Supabase (ver punto 2).
4. `npm install && npm run build` para confirmar en tu máquina.
5. Prueba el flujo completo: registro -> crear perfil de fútbol -> crear perfil de
   pádel -> cerrar sesión -> volver a entrar.
