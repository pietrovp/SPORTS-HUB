"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlayerCard from "@/components/futbol/PlayerCard";
import LogroBadge from "@/components/futbol/LogroBadge";
import { bonusLabel } from "@/lib/futbol/logros";
import Link from "next/link";
import { useParams } from "next/navigation";

function formatFechaCorta(fechaStr) {
  if (!fechaStr) return "";

  const fecha = new Date(fechaStr);

  if (Number.isNaN(fecha.getTime())) return "";

  return fecha.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "--";

  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);

  if (Number.isNaN(fechaNac.getTime())) return "--";

  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const diferenciaMes = hoy.getMonth() - fechaNac.getMonth();

  if (
    diferenciaMes < 0 ||
    (diferenciaMes === 0 && hoy.getDate() < fechaNac.getDate())
  ) {
    edad--;
  }

  return edad >= 0 ? edad : "--";
}

function obtenerMarcador(scoreText) {
  if (!scoreText) {
    return { g1: 0, g2: 0 };
  }

  const partes = String(scoreText)
    .split("-")
    .map((valor) => Number(valor.trim()));

  return {
    g1: Number.isFinite(partes[0]) ? partes[0] : 0,
    g2: Number.isFinite(partes[1]) ? partes[1] : 0,
  };
}

function estaFinalizado(status) {
  const estado = String(status || "").toLowerCase().trim();

  return ["jugado", "finalizado", "terminado"].includes(estado);
}

export default function JugadorDetalle() {
  const params = useParams();
  const idJugador = params?.id;

  const [cargando, setCargando] = useState(true);
  const [dataJugador, setDataJugador] = useState(null);
  const [cantidadVisible, setCantidadVisible] = useState(3);

  useEffect(() => {
    if (!idJugador || !supabase) return;

    let componenteActivo = true;

    async function cargarDatos() {
      setCargando(true);

      try {
        const [
          { data: fProfile, error: perfilError },
          { data: misInscripciones, error: inscripcionesError },
          { data: logrosCatalogo, error: logrosError },
          { data: logrosUsuario, error: userLogrosError },
        ] = await Promise.all([
          supabase
            .from("futbol_profiles")
            .select(`
              *,
              profiles (
                nombre,
                apellido,
                pais,
                avatar_url,
                fecha_nacimiento
              )
            `)
            .eq("id", idJugador)
            .maybeSingle(),

          supabase
            .from("match_players")
            .select("id, match_id, user_id, team, goals")
            .eq("user_id", idJugador),

          supabase
            .from("logros")
            .select("*")
            .eq("activo", true)
            .order("created_at", { ascending: true }),

          supabase
            .from("user_logros")
            .select("id, user_id, logro_id, fecha_obtenido")
            .eq("user_id", idJugador),
        ]);

        if (perfilError) {
          console.error("Error cargando perfil:", perfilError);
          throw perfilError;
        }

        if (inscripcionesError) {
          console.error(
            "Error cargando inscripciones:",
            inscripcionesError
          );
        }

        if (logrosError) {
          console.error("Error cargando catálogo de logros:", logrosError);
        }

        if (userLogrosError) {
          console.error(
            "Error cargando logros desbloqueados:",
            userLogrosError
          );
        }

        if (!fProfile) {
          if (componenteActivo) {
            setDataJugador(null);
          }
          return;
        }

        const userData = Array.isArray(fProfile.profiles)
          ? fProfile.profiles[0] || {}
          : fProfile.profiles || {};

        const perfil = {
          ...fProfile,
          nombre: userData.nombre || "",
          apellido: userData.apellido || "",
          nacionalidad: userData.pais || null,
          avatar_url: userData.avatar_url || null,
          fecha_nacimiento: userData.fecha_nacimiento || null,
          posicion_preferida: fProfile.posicion || "MED",
          pierna_buena: fProfile.pierna_buena || "--",
        };

        const partidosJugados =
          Number(fProfile.partidos_jugados) || 0;

        const golesTotal = Number(fProfile.goles) || 0;
        const victorias = Number(fProfile.victorias) || 0;
        const derrotas = Number(fProfile.derrotas) || 0;

        const winRate =
          partidosJugados > 0
            ? `${Math.round((victorias / partidosJugados) * 100)}%`
            : "0%";

        const promedioGoles =
          partidosJugados > 0
            ? (golesTotal / partidosJugados).toFixed(2)
            : "0.00";

        const mediaReal = Number.isFinite(Number(fProfile.rating))
  ? Math.round(Number(fProfile.rating))
  : 64;

        const st = {
          media_general: Math.round(mediaReal),
          ritmo: Number(fProfile.ritmo) || 64,
          tiro: Number(fProfile.tiro) || 64,
          pase: Number(fProfile.pase) || 64,
          regate: Number(fProfile.regate) || 64,
          defensa: Number(fProfile.defensa) || 64,
          fisico: Number(fProfile.fisico) || 64,
          partidos_jugados: partidosJugados,
          goles_total: golesTotal,
          win_rate: winRate,
          promedio_goles: promedioGoles,
          edad: calcularEdad(perfil.fecha_nacimiento),
          victorias,
          derrotas,
        };

        let historial = [];

        const inscripcionesValidas = (
          misInscripciones || []
        ).filter((item) => item.match_id);

        if (inscripcionesValidas.length > 0) {
          const idsPartidos = [
            ...new Set(
              inscripcionesValidas.map((item) => item.match_id)
            ),
          ];

          const { data: partidosData, error: partidosError } =
            await supabase
              .from("matches")
              .select(`
                id,
                scheduled_at,
                status,
                score_text,
                winner_team,
                location_name,
                court:courts (
                  name,
                  sport_type
                ),
                club:clubs (
                  name,
                  city
                )
              `)
              .in("id", idsPartidos);

          if (partidosError) {
            console.error(
              "Error cargando historial de partidos:",
              partidosError
            );
          }

          historial = (partidosData || [])
            .map((partido) => {
              const inscripcion = inscripcionesValidas.find(
                (item) =>
                  String(item.match_id) === String(partido.id)
              );

              if (!inscripcion) return null;

              const { g1, g2 } = obtenerMarcador(
                partido.score_text
              );

              const equipoJugador = String(
                inscripcion.team || ""
              )
                .trim()
                .toUpperCase();

              const finalizado = estaFinalizado(partido.status);

              const ganador = String(
                partido.winner_team || ""
              )
                .trim()
                .toUpperCase();

              const empate =
                finalizado && ganador === "EMPATE";

              const victoria =
                finalizado &&
                !empate &&
                ganador !== "" &&
                equipoJugador === ganador;

              const derrota =
                finalizado && !empate && !victoria;

              return {
                id: partido.id,
                cancha:
                  partido.court?.name ||
                  partido.location_name ||
                  "Cancha",
                club:
                  partido.club?.name ||
                  "Complejo deportivo",
                fecha: partido.scheduled_at,
                team: equipoJugador,
                mis_goles: Number(inscripcion.goals) || 0,
                g1,
                g2,
                esVictoria: victoria,
                esEmpate: empate,
                esDerrota: derrota,
                esFinalizado: finalizado,
              };
            })
            .filter(Boolean);

          historial.sort(
            (a, b) =>
              new Date(b.fecha).getTime() -
              new Date(a.fecha).getTime()
          );
        }

        const idsDesbloqueados = new Set(
          (logrosUsuario || []).map((item) =>
            String(item.logro_id)
          )
        );

        const logros = (logrosCatalogo || []).map((logro) => ({
          ...logro,
          nombre: logro.titulo || "Logro",
          desbloqueado: idsDesbloqueados.has(
            String(logro.id)
          ),
        }));

        const logrosDesbloqueados = logros.filter(
          (logro) => logro.desbloqueado
        ).length;

        if (!componenteActivo) return;

        setDataJugador({
          perfil,
          st,
          historial,
          logros,
          logrosDesbloqueados,
        });
      } catch (error) {
        console.error("Error general cargando jugador:", error);

        if (componenteActivo) {
          setDataJugador(null);
        }
      } finally {
        if (componenteActivo) {
          setCargando(false);
        }
      }
    }

    cargarDatos();

    return () => {
      componenteActivo = false;
    };
  }, [idJugador]);

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!dataJugador) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <span className="text-5xl">👀</span>

        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
          Jugador no encontrado
        </h1>

        <p className="text-gray-500 font-medium">
          Parece que este perfil ya no existe o fue eliminado.
        </p>

        <Link
          href="/futbol/jugadores"
          className="mt-2 px-8 py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg"
        >
          Volver a la comunidad
        </Link>
      </div>
    );
  }

  const {
    perfil,
    st,
    historial,
    logros,
    logrosDesbloqueados,
  } = dataJugador;

  const historialVisible = historial.slice(
    0,
    cantidadVisible
  );

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      <Link
        href="/futbol/jugadores"
        className="text-sm font-bold text-gray-500 hover:text-[#00FF9D] transition-colors w-fit"
      >
        ← Volver a jugadores
      </Link>

      <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
        <div className="flex justify-center md:sticky md:top-6">
          <PlayerCard
            size="lg"
            nombre={perfil.nombre || "Jugador"}
            apellido={perfil.apellido || ""}
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
            nacionalidad={perfil.nacionalidad}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-black text-gray-900 text-2xl leading-tight">
              {perfil.nombre || "Jugador"}{" "}
              {perfil.apellido || ""}
            </h2>

            <p className="text-gray-400 font-bold text-sm mt-0.5">
              {perfil.posicion_preferida || "MED"}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Partidos Jugados
                </p>
                <p className="font-black text-gray-900 text-xl mt-0.5">
                  {st.partidos_jugados}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Goles Totales
                </p>
                <p className="font-black text-emerald-600 text-xl mt-0.5">
                  {st.goles_total} ⚽
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Promedio Goles
                </p>
                <p className="font-black text-gray-900 text-xl mt-0.5">
                  {st.promedio_goles}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  % Victorias
                </p>
                <p className="font-black text-emerald-600 text-xl mt-0.5">
                  {st.win_rate}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Edad
                </p>
                <p className="font-black text-gray-900 text-xl mt-0.5">
                  {st.edad}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Pierna Hábil
                </p>
                <p className="font-black text-gray-900 text-xl mt-0.5">
                  {perfil.pierna_buena}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 col-span-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Récord de Carrera
                  </p>

                  <p className="font-black text-gray-900 text-sm mt-0.5">
                    <span className="text-emerald-600">
                      {st.victorias} Victorias
                    </span>{" "}
                    ·{" "}
                    <span className="text-red-500">
                      {st.derrotas} Derrotas
                    </span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Posición
                  </p>

                  <p className="font-black text-gray-900 text-sm mt-0.5">
                    {perfil.posicion_preferida || "MED"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg">
                Logros
              </h3>

              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                {logrosDesbloqueados}/{logros.length}
              </span>
            </div>

            {logros.length === 0 ? (
              <p className="text-sm font-bold text-gray-400 py-4 text-center">
                Todavía no hay logros disponibles.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {logros.map((logro) => (
                  <LogroBadge
                    key={logro.id}
                    label={logro.nombre}
                    desc={logro.descripcion}
                    bonus={bonusLabel(logro)}
                    desbloqueado={logro.desbloqueado}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg border-b border-gray-200/80 pb-3">
              Últimos partidos
            </h3>

            {historial.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
                <p className="text-gray-400 font-bold text-sm">
                  Este jugador no tiene partidos registrados.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {historialVisible.map((partido) => (
                  <div
                    key={partido.id}
                    className="bg-[#0B0C15] text-white rounded-3xl p-5 shadow-sm relative overflow-hidden flex items-center justify-between border border-gray-800"
                  >
                    <div
                      className={`absolute top-0 left-0 w-1.5 h-full ${
                        !partido.esFinalizado
                          ? "bg-gray-600"
                          : partido.esEmpate
                            ? "bg-yellow-400"
                            : partido.esVictoria
                              ? "bg-[#00FF9D]"
                              : "bg-red-500"
                      }`}
                    />

                    <div className="pl-3 pr-2 space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            !partido.esFinalizado
                              ? "bg-gray-800 text-gray-400 border border-gray-700"
                              : partido.esEmpate
                                ? "bg-yellow-400/20 text-yellow-400"
                                : partido.esVictoria
                                  ? "bg-[#00FF9D]/20 text-[#00FF9D]"
                                  : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {!partido.esFinalizado
                            ? "Por jugar"
                            : partido.esEmpate
                              ? "Empate"
                              : partido.esVictoria
                                ? "Victoria"
                                : "Derrota"}
                        </span>

                        <span className="text-[10px] text-gray-400 font-bold">
                          {formatFechaCorta(partido.fecha)}
                        </span>
                      </div>

                      <p className="text-[10px] text-gray-500 font-bold uppercase">
                        {partido.club}
                      </p>

                      <h3 className="font-black text-white text-base leading-tight uppercase truncate">
                        {partido.cancha}
                      </h3>

                      <p className="text-xs text-gray-400 font-bold">
                        ⚽{" "}
                        <span className="text-white">
                          {partido.mis_goles}{" "}
                          {partido.mis_goles === 1
                            ? "Gol anotado"
                            : "Goles anotados"}
                        </span>
                      </p>
                    </div>

                    <div className="bg-[#121422] rounded-2xl px-4 py-2.5 border border-[#1f233a] text-center shrink-0 ml-auto">
                      {partido.esFinalizado ? (
                        <p className="text-xl font-black text-white tracking-wider">
                          {partido.g1}
                          <span className="text-emerald-400 mx-1.5">
                            -
                          </span>
                          {partido.g2}
                        </p>
                      ) : (
                        <p className="text-sm font-black text-gray-500 tracking-widest mt-1 mb-0.5">
                          VS
                        </p>
                      )}

                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                        Resultado
                      </p>
                    </div>
                  </div>
                ))}

                {cantidadVisible < historial.length && (
                  <button
                    onClick={() =>
                      setCantidadVisible((prev) => prev + 3)
                    }
                    className="w-full mt-2 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-500 font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
                  >
                    Cargar anteriores
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}