"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import PlayerCard from "../../../../components/futbol/PlayerCard";
import LogroBadge from "../../../../components/futbol/LogroBadge";
import { bonusLabel } from "../../../../lib/futbol/logros";
import Link from "next/link";
import { useParams } from "next/navigation";

// Funciones auxiliares para formato
function formatFechaCorta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "--";
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  if (isNaN(fechaNac.getTime())) return "--";
  
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const m = hoy.getMonth() - fechaNac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : "--";
}

export default function JugadorDetalle() {
  const params = useParams();
  const idJugador = params?.id;

  const [cargando, setCargando] = useState(true);
  const [dataJugador, setDataJugador] = useState(null);
  
  // 🔥 ESTADO DE PAGINACIÓN: Empezamos mostrando 3 partidos
  const [cantidadVisible, setCantidadVisible] = useState(3);

  useEffect(() => {
    if (!idJugador) return;

    async function cargarDatos() {
      const [{ data: fProfile }, { data: misInscripciones }, { data: logrosCatalogo }, { data: logrosUsuario }] =
        await Promise.all([
          supabase.from("futbol_profiles").select("*, profiles(nombre, apellido, pais, avatar_url, fecha_nacimiento)").eq("id", idJugador).maybeSingle(),
          supabase.from("partido_jugadores").select("partido_id, goles, equipo").eq("user_id", idJugador),
          supabase.from("logros").select("*").eq("activo", true).order("created_at", { ascending: true }),
          supabase.from("user_logros").select("logro_id").eq("user_id", idJugador),
        ]);

      if (!fProfile) {
        setDataJugador(null);
        setCargando(false);
        return;
      }

      // Extractor seguro
      const userData = Array.isArray(fProfile.profiles) ? fProfile.profiles[0] : (fProfile.profiles || {});

      // Mapeamos los datos personales
      const perfil = {
        ...fProfile,
        nombre: userData.nombre,
        apellido: userData.apellido,
        nacionalidad: userData.pais,
        avatar_url: userData.avatar_url,
        fecha_nacimiento: userData.fecha_nacimiento,
        posicion_preferida: fProfile.posicion,
        pierna_buena: fProfile.pierna_buena || "--",
      };

      // Cálculos de estadísticas
      const partidos_jugados = fProfile.partidos_jugados ?? 0;
      const goles_total = fProfile.goles ?? 0;
      const victorias = fProfile.victorias ?? 0;
      const derrotas = fProfile.derrotas ?? 0;
      
      const win_rate = partidos_jugados > 0 ? `${Math.round((victorias / partidos_jugados) * 100)}%` : "0%";
      const promedio_goles = partidos_jugados > 0 ? (goles_total / partidos_jugados).toFixed(2) : "0.00";
      const edad = calcularEdad(perfil.fecha_nacimiento);

      let mediaReal = fProfile.rating ? Math.round(Number(fProfile.rating)) : 64;
      if (mediaReal < 20) mediaReal = 64;

      const st = {
        media_general: mediaReal,
        ritmo: fProfile.ritmo ?? 64,
        tiro: fProfile.tiro ?? 64,
        pase: fProfile.pase ?? 64,
        regate: fProfile.regate ?? 64,
        defensa: fProfile.defensa ?? 64,
        fisico: fProfile.fisico ?? 64,
        partidos_jugados,
        goles_total,
        win_rate,
        promedio_goles,
        edad,
        victorias,
        derrotas
      };

      // Procesar Historial a prueba de fallos
      let historial = [];
      if (misInscripciones && misInscripciones.length > 0) {
        const misPartidoIds = misInscripciones.map(i => i.partido_id);

        const { data: partidosData } = await supabase
          .from("partidos")
          .select("*")
          .in("id", misPartidoIds);

        if (partidosData) {
          historial = partidosData.map((partido) => {
            const inscripcion = misInscripciones.find(i => String(i.partido_id) === String(partido.id));
            if (!inscripcion) return null;

            const g1 = partido.goles_equipo1 || 0;
            const g2 = partido.goles_equipo2 || 0;
            const eq = Number(inscripcion.equipo) || null;

            const estado = (partido.estado || "").toLowerCase().trim();
            const esFinalizado = estado === "finalizado" || estado === "terminado" || estado === "jugado";

            let esVictoria = false;
            let esEmpate = false;

            if (esFinalizado) {
              esEmpate = g1 === g2;
              if (eq === 1 && g1 > g2) esVictoria = true;
              if (eq === 2 && g2 > g1) esVictoria = true;
            }

            return {
              id: partido.id,
              cancha: partido.cancha_lugar || partido.titulo || partido.cancha || "Cancha",
              fecha: partido.fecha,
              hora: partido.hora,
              mis_goles: Number(inscripcion.goles) || 0,
              g1,
              g2,
              esVictoria,
              esEmpate,
              esFinalizado
            };
          }).filter(Boolean); // Filtramos nulos

          // Ordenar del más reciente al más antiguo
          historial.sort((a, b) => new Date(`${b.fecha}T${b.hora || "00:00:00"}`) - new Date(`${a.fecha}T${a.hora || "00:00:00"}`));
        }
      }

      // Logros
      const idsDesbloqueados = new Set((logrosUsuario || []).map((d) => d.logro_id));
      const logros = (logrosCatalogo || []).map((l) => ({
        ...l,
        nombre: l.titulo,
        desbloqueado: idsDesbloqueados.has(l.id),
      }));
      const logrosDesbloqueados = logros.filter((l) => l.desbloqueado).length;

      setDataJugador({ perfil, st, historial, logros, logrosDesbloqueados });
      setCargando(false);
    }

    cargarDatos();
  }, [idJugador]);

  if (cargando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!dataJugador) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <span className="text-5xl">👀</span>
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Jugador no encontrado</h1>
        <p className="text-gray-500 font-medium">Parece que este perfil ya no existe o fue eliminado.</p>
        <Link href="/futbol/jugadores" className="mt-2 px-8 py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-900 transition-colors shadow-lg">
          Volver a la comunidad
        </Link>
      </div>
    );
  }

  const { perfil, st, historial, logros, logrosDesbloqueados } = dataJugador;

  // 🔥 Filtramos los partidos a mostrar usando la cantidad visible
  const historialVisible = historial.slice(0, cantidadVisible);

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      <Link href="/futbol/jugadores" className="text-sm font-bold text-gray-500 hover:text-[#00FF9D] transition-colors w-fit">
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
            nacionalidad={perfil.nacionalidad || null}
          />
        </div>

        <div className="flex flex-col gap-6">
          
          {/* ESTADÍSTICAS GLOBALES */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-black text-gray-900 text-2xl leading-tight">
              {perfil.nombre || "Jugador"} {perfil.apellido || ""}
            </h2>
            <p className="text-gray-400 font-bold text-sm mt-0.5">
              {perfil.posicion_preferida || "MED"}
            </p>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Partidos Jugados</p>
                <p className="font-black text-gray-900 text-xl mt-0.5">{st.partidos_jugados}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Goles Totales</p>
                <p className="font-black text-emerald-600 text-xl mt-0.5">{st.goles_total} ⚽</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Promedio Goles</p>
                <p className="font-black text-gray-900 text-xl mt-0.5">{st.promedio_goles}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">% Victorias</p>
                <p className="font-black text-emerald-600 text-xl mt-0.5">{st.win_rate}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Edad</p>
                <p className="font-black text-gray-900 text-xl mt-0.5">{st.edad}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pierna Hábil</p>
                <p className="font-black text-gray-900 text-xl mt-0.5">{perfil.pierna_buena}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 col-span-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Récord de Carrera</p>
                  <p className="font-black text-gray-900 text-sm mt-0.5">
                    <span className="text-emerald-600">{st.victorias} Victorias</span> · <span className="text-red-500">{st.derrotas} Derrotas</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Posición</p>
                  <p className="font-black text-gray-900 text-sm mt-0.5">{perfil.posicion_preferida || "MED"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* LOGROS */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg">Logros</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                {logrosDesbloqueados}/{logros.length}
              </span>
            </div>

            {logros.length === 0 ? (
              <p className="text-sm font-bold text-gray-400 py-4 text-center">Todavía no hay logros disponibles.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

          {/* ÚLTIMOS PARTIDOS CON PAGINACIÓN */}
          <div className="space-y-4">
            <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg border-b border-gray-200/80 pb-3">
              Últimos partidos
            </h3>

            {historial.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
                <p className="text-gray-400 font-bold text-sm">Este jugador no tiene partidos registrados.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {historialVisible.map((partido, i) => (
                  <div
                    key={i}
                    className="bg-[#0B0C15] text-white rounded-3xl p-5 shadow-sm relative overflow-hidden flex items-center justify-between border border-gray-800"
                  >
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${
                      !partido.esFinalizado ? "bg-gray-600" :
                      partido.esEmpate ? "bg-yellow-400" : 
                      partido.esVictoria ? "bg-[#00FF9D]" : "bg-red-500"
                    }`}></div>

                    <div className="pl-3 pr-2 space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          !partido.esFinalizado ? "bg-gray-800 text-gray-400 border border-gray-700" :
                          partido.esEmpate ? "bg-yellow-400/20 text-yellow-400" : 
                          partido.esVictoria ? "bg-[#00FF9D]/20 text-[#00FF9D]" : "bg-red-500/20 text-red-400"
                        }`}>
                          {!partido.esFinalizado ? "Por jugar" : partido.esEmpate ? "Empate" : partido.esVictoria ? "Victoria" : "Derrota"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">{formatFechaCorta(partido.fecha)}</span>
                      </div>

                      <h3 className="font-black text-white text-base leading-tight uppercase truncate">{partido.cancha}</h3>
                      
                      <p className="text-xs text-gray-400 font-bold">
                        ⚽ <span className="text-white">{partido.mis_goles} {partido.mis_goles === 1 ? "Gol anotado" : "Goles anotados"}</span>
                      </p>
                    </div>

                    <div className="bg-[#121422] rounded-2xl px-4 py-2.5 border border-[#1f233a] text-center shrink-0 ml-auto flex flex-col justify-center">
                      {partido.esFinalizado ? (
                        <p className="text-xl font-black text-white tracking-wider">
                          {partido.g1}<span className="text-emerald-400 mx-1.5">-</span>{partido.g2}
                        </p>
                      ) : (
                        <p className="text-sm font-black text-gray-500 tracking-widest mt-1 mb-0.5">VS</p>
                      )}
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Resultado</p>
                    </div>
                  </div>
                ))}

                {/* BOTÓN CARGAR ANTERIORES */}
                {cantidadVisible < historial.length && (
                  <button
                    onClick={() => setCantidadVisible((prev) => prev + 3)}
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