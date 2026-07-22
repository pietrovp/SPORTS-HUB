import { supabase } from "./supabaseClient";

/**
 * Devuelve la cuenta núcleo (tabla `cuentas`) del usuario autenticado.
 * Si no existe (por ejemplo, un usuario creado antes de esta migración),
 * la crea con los datos básicos disponibles en auth.users.
 */
export async function getOrCrearCuenta(user) {
  if (!supabase || !user) return null;

  const { data: existente, error } = await supabase
    .from("cuentas")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error leyendo cuenta:", error);
    return null;
  }

  if (existente) return existente;

  const { data: creada, error: errorCrear } = await supabase
    .from("cuentas")
    .insert({
      id: user.id,
      correo: user.email,
      nombre: user.user_metadata?.nombre || null,
    })
    .select()
    .single();

  if (errorCrear) {
    console.error("Error creando cuenta:", errorCrear);
    return null;
  }

  return creada;
}

/**
 * Revisa, sin crear nada, si la cuenta ya tiene perfil de fútbol y/o pádel.
 * Útil para decidir qué mostrar en el hub y en el navbar.
 */
export async function tienePerfiles(userId) {
  if (!supabase || !userId) return { futbol: false, padel: false };

  const [{ data: pf }, { data: pp }] = await Promise.all([
    supabase.from("perfiles_futbol").select("id").eq("id", userId).maybeSingle(),
    supabase.from("perfiles_padel").select("id").eq("id", userId).maybeSingle(),
  ]);

  return { futbol: !!pf, padel: !!pp };
}
