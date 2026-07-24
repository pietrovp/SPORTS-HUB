import { supabase } from "../../../../lib/supabaseClient";
import PlayerCard from "../../../../components/futbol/PlayerCard";
import LogroBadge from "../../../../components/futbol/LogroBadge";
import { bonusLabel } from "../../../../lib/futbol/logros";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getResultadoPartido(equipoJugador, goles1, goles2, estado) {
  if (estado !== "finalizado") return null;
  if (!equipoJugador) return null;

  if (goles1 === goles2) return "empate";

  const ganoEquipo1 = goles1 > goles2;

  if ((equipoJugador === 1 && ganoEquipo1) || (equipoJugador === 2 && !ganoEquipo1)) {
    return "victoria";
  }

  return "derrota";
}

function getResultadoStyles(resultado) {
  if (resultado === "victoria") {
    return {
      card: "bg-green-50 border-green-100",
      badge: "bg-green-100 text-green-700",
      label: "Victoria",
    };
  }

  if (resultado === "derrota") {
    return {
      card: "bg-red-50 border-red-100",
      badge: "bg-red-100 text-red-700",
      label: "Derrota",
    };
  }

  if (resultado === "empate") {
    return {
      card: "bg-yellow-50 border-yellow-100",
      badge: "bg-yellow-100 text-yellow-700",
      label: "Empate",
    };
  }

  return {
    card: "bg-white border-gray-100",
    badge: "bg-gray-100 text-gray-600",
    label: "Sin resultado",
  };
}

export default async function JugadorDetalle({ params }) {
  if (!supabase) return notFound();

  // CORRECCIÓN: Tablas actualizadas (futbol_profiles, profiles, user_logros)
  const [{ data: fProfile }, { data: historialRaw }, { data: logrosCatalogo }, { data: logrosUsuario }] =
    await Promise.all([
      supabase.from("futbol_profiles").select("*, profiles(nombre, pais, avatar_url)").eq("id", params.id).maybeSingle(),
      supabase
        .from("partido_jugadores")
        .select(
          "partido_id, goles, asistencias, equipo, partidos(cancha, fecha, hora, estado, goles_equipo1, goles_equipo2)"
        )
        .eq("usuario_id", params.id)
        .order("partido_id", { ascending: false })
        .limit(10),
      supabase.from("logros").select("*").eq("activo", true).order("created_at", { ascending: true }),
      supabase.from("user_logros").select("logro_id").eq("user_id", params.id),
    ]);

  if (!fProfile) return notFound();

  // Mapeamos los datos para mantener las variables de tu frontend intactas
  const perfil = {
    ...fProfile,
    nombre: fProfile.profiles?.nombre,
    nacionalidad: fProfile.profiles?.pais,
    avatar_url: fProfile.profiles?.avatar_url,
    posicion_preferida: fProfile.posicion,
    goles_total: fProfile.goles || 0,
  };

  const historial = (historialRaw || []).map((h) => {
    const resultado = getResultadoPartido(
      h.equipo,
      h.partidos?.goles_equipo1 ?? 0,
      h.partidos?.goles_equipo2 ?? 0,
      h.partidos?.estado
    );

    return {
      ...h,
      resultado,
      styles: getResultadoStyles(resultado),
    };
  });

  // CORRECCIÓN DE ESTADÍSTICAS: 
  // Ahora usamos rating como media_general y lo formateamos.
  // Si no hay rating o es muy bajo (como el de pádel), lo forzamos a 64 para fútbol.
  let mediaReal = perfil.rating ? Math.round(Number(perfil.rating)) : 64;
  if (mediaReal < 20) mediaReal = 64; // Prevención para no mezclar escalas de pádel

  const st = {
    media_general: mediaReal,
    ritmo: perfil.ritmo ?? 64,
    tiro: perfil.tiro ?? 64,
    pase: perfil.pase ?? 64,
    regate: perfil.regate ?? 64,
    defensa: perfil.defensa ?? 64,
    fisico: perfil.fisico ?? 64,
    partidos_jugados: perfil.partidos_jugados ?? 0,
    goles_total: perfil.goles_total ?? 0,
    asistencias_total: perfil.asistencias_total ?? 0,
  };

  const idsDesbloqueados = new Set((logrosUsuario || []).map((d) => d.logro_id));
  const logros = (logrosCatalogo || []).map((l) => ({
    ...l,
    nombre: l.titulo, // Ajuste al nombre de la columna en BD
    desbloqueado: idsDesbloqueados.has(l.id),
  }));
  const logrosDesbloqueados = logros.filter((l) => l.desbloqueado).length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <Link href="/futbol/jugadores" className="text-sm text-cancha-verde hover:underline">
        ← Volver a jugadores
      </Link>

      <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
        <div className="flex justify-center md:sticky md:top-6">
          <PlayerCard
            size="lg"
            nombre={perfil.nombre || "Jugador"}
            posicion={perfil.posicion_preferida || "MED"}
            media={st.media_general}
            stats={{
              ritmo: st.ritmo,
              tiro: st.tiro,
              pase: st.pase,
              regate: st.regate,
              defensa: st.defensa,
              fisico: st.fisico,
            }}
            avatar={perfil.avatar_url}
            nacionalidad={perfil.nacionalidad || null}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-bold text-gray-800 text-lg">{perfil.nombre || "Jugador"}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {perfil.posicion_preferida || "Sin posición"}
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: "Partidos", value: st.partidos_jugados },
                { label: "Goles", value: st.goles_total },
                { label: "Asistencias", value: st.asistencias_total },
              ].map(({ label, value }) => (
                <div key={label} className="bg-cancha-gris rounded-xl p-3 text-center">
                  <div className="font-black text-cancha-verdeoscuro text-xl">{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Logros</h3>
              <span className="text-xs font-bold text-cancha-verdeoscuro bg-cancha-gris rounded-full px-2.5 py-1">
                {logrosDesbloqueados}/{logros.length}
              </span>
            </div>

            {logros.length === 0 ? (
              <p className="text-sm text-gray-400">Todavía no hay logros disponibles.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {logros.map((l) => (
                  <LogroBadge
                    key={l.id}
                    label={l.nombre}
                    desc={l.descripcion}
                    bonus={bonusLabel(l)}
                    desbloqueado={l.desbloqueado}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-card p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Últimos partidos</h3>

            {!historial || historial.length === 0 ? (
              <p className="text-sm text-gray-400">Sin partidos jugados aún.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {historial.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between text-sm py-3 px-3 rounded-xl border ${h.styles.card}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-700">{h.partidos?.cancha}</p>

                        {h.resultado && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${h.styles.badge}`}>
                            {h.styles.label}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-1">
                        {h.partidos?.fecha} · {h.partidos?.hora}
                      </p>

                      {h.partidos?.estado === "finalizado" && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Resultado: {h.partidos?.goles_equipo1 ?? 0} - {h.partidos?.goles_equipo2 ?? 0}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs shrink-0">
                      <span className="font-bold text-cancha-verde">{h.goles || 0} ⚽</span>
                      <span className="font-bold text-blue-500">{h.asistencias || 0} 🎯</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}