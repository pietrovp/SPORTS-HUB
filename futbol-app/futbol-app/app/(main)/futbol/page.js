"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// COMPONENTE VISUAL MEJORADO PARA AVATARES DE JUGADORES
function AvataresJugadores({ jugadores = [], cuposTotales = 14 }) {
  const maxVisibles = 4;
  const inscritosCount = jugadores.length;
  const visibles = jugadores.slice(0, maxVisibles);
  const sobrantes = Math.max(0, inscritosCount - maxVisibles);

  // Círculos vacíos con opacidad decreciente (60%, 40%, 20%)
  const vaciosAMostrar = Math.max(0, maxVisibles - visibles.length);
  const opacidades = ["opacity-60", "opacity-40", "opacity-20"];

  return (
    <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex -space-x-3 shrink-0">
          {/* Avatares reales de jugadores inscritos */}
          {visibles.map((j, idx) => (
            <div
              key={j.id || idx}
              className="w-10 h-10 rounded-full bg-slate-900 text-[#00FF9D] ring-2 ring-white flex items-center justify-center font-black text-xs overflow-hidden shadow-sm shrink-0 z-10"
              title={j.profile?.nombre || j.nombre || "Jugador"}
            >
              {j.profile?.avatar_url || j.avatarUrl ? (
                <img
                  src={j.profile?.avatar_url || j.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                ((j.profile?.nombre || j.nombre || "J")[0]).toUpperCase()
              )}
            </div>
          ))}

          {/* Círculos punteados con opacidad progresiva */}
          {Array.from({ length: vaciosAMostrar }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className={`w-10 h-10 rounded-full bg-slate-100/60 border-2 border-dashed border-slate-300 text-slate-300 flex items-center justify-center shrink-0 ${
                opacidades[i] || "opacity-20"
              }`}
            >
              <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          ))}
        </div>

        {/* Badge para mostrar cuántos jugadores adicionales hay */}
        {sobrantes > 0 && (
          <span className="text-[11px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0 shadow-2xs ml-1">
            +{sobrantes}
          </span>
        )}
      </div>

      <div className="text-right shrink-0">
        <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">INSCRITOS</span>
        <span className="text-sm font-black text-slate-900">{inscritosCount}/{cuposTotales}</span>
      </div>
    </div>
  );
}

// TARJETA DE PARTIDO CON FORMATO HORARIO EN ZONA CARACAS
function TarjetaFutbolPartido({ match, esHistorial = false }) {
  const esPrivado = match.is_private || match.match_type === "privado";
  const dateObj = new Date(match.scheduled_at);

  // Formato forzado a la zona horaria de Venezuela (America/Caracas)
  const fechaFormat = dateObj.toLocaleDateString("es-VE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Caracas",
  });

  const horaFormat = dateObj.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Caracas",
  }).toUpperCase();

  const enCurso = match.status === "en_curso";
  const finalizado = match.status === "jugado";

  return (
    <div className={`w-[310px] sm:w-[350px] shrink-0 snap-start rounded-3xl border p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
      finalizado 
        ? "bg-slate-900 border-slate-800 text-white" 
        : enCurso 
        ? "bg-gradient-to-b from-blue-50/50 to-white border-blue-200 ring-2 ring-blue-500/20" 
        : "bg-white border-slate-200"
    }`}>
      <div className="space-y-3">
        <div className="flex justify-between items-start gap-2">
          <span className={`text-[10px] font-black uppercase tracking-wider ${finalizado ? "text-slate-400" : "text-emerald-600"}`}>
            {match.club?.name || "Complejo Deportivo"}
          </span>
          <div className="flex gap-1">
            {esPrivado && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                🔒 Privado
              </span>
            )}
            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
              finalizado ? "bg-emerald-400/20 text-emerald-300 border border-emerald-500/30" :
              enCurso ? "bg-blue-500 text-white animate-pulse" :
              "bg-slate-100 text-slate-700"
            }`}>
              {finalizado ? "🏆 Finalizado" : enCurso ? "▶ En Curso" : match.price_per_player === 0 || esPrivado ? "Gratis" : `$${match.price_per_player} USD`}
            </span>
          </div>
        </div>

        <h3 className={`text-base font-black truncate ${finalizado ? "text-white" : "text-slate-900"}`}>
          ⚽ {match.court?.name || "Cancha de Fútbol"}
        </h3>

        <div className={`p-2.5 rounded-2xl border flex justify-between items-center text-xs font-bold ${
          finalizado ? "bg-slate-800/80 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-100 text-slate-700"
        }`}>
          <span className="capitalize">📅 {fechaFormat}</span>
          <span>⏰ {horaFormat}</span>
        </div>

        {finalizado ? (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 text-center space-y-1">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Resultado Final</span>
            <span className="text-2xl font-black text-[#00FF9D] tracking-tight">{match.score_text || "Finalizado"}</span>
          </div>
        ) : (
          <AvataresJugadores jugadores={match.players || []} cuposTotales={14} />
        )}
      </div>

      <Link
        href={`/futbol/partidos/${match.id}`}
        className={`w-full py-3 font-black text-xs uppercase tracking-wider rounded-2xl text-center block transition-colors shadow-xs ${
          finalizado
            ? "bg-slate-800 hover:bg-slate-700 text-[#00FF9D] border border-slate-700"
            : enCurso
            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            : "bg-slate-900 hover:bg-slate-800 text-[#00FF9D]"
        }`}
      >
        {finalizado ? "📊 Ver Resumen y MVP" : enCurso ? "▶ Ver Partido En Vivo" : "Ver Alineación →"}
      </Link>
    </div>
  );
}

export default function FutbolPartidosPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    cargarPartidos();
  }, []);

  async function cargarPartidos() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      let misPartidosIds = [];
      if (authUser) {
        const { data: misJugadoresData } = await supabase
          .from("match_players")
          .select("match_id")
          .eq("user_id", authUser.id);
        misPartidosIds = (misJugadoresData || []).map((m) => m.match_id).filter(Boolean);
      }

      const { data: matchesData, error: matchesErr } = await supabase
        .from("matches")
        .select(`
          id, club_id, court_id, match_type, is_private, scheduled_at, status,
          price_per_player, total_price, created_by, winner_team, score_text,
          club:clubs ( name, city, address ),
          court:courts!inner ( name, sport_type )
        `)
        .eq("court.sport_type", "futbol")
        .in("status", ["programado", "en_curso", "jugado"])
        .order("scheduled_at", { ascending: true });

      if (matchesErr) throw matchesErr;

      const partidosVisibles = (matchesData || []).filter((m) => {
        const esPrivado = m.is_private || m.match_type === "privado";
        if (!esPrivado) return true;
        if (!authUser) return false;
        return m.created_by === authUser.id || misPartidosIds.includes(m.id);
      });

      const matchIds = partidosVisibles.map((m) => m.id);

      if (matchIds.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const { data: playersData } = await supabase
        .from("match_players")
        .select("id, match_id, user_id, team")
        .in("match_id", matchIds);

      const allUserIds = Array.from(new Set((playersData || []).map((p) => p.user_id).filter(Boolean)));

      let profilesMap = {};
      if (allUserIds.length > 0) {
        const { data: profsData } = await supabase
          .from("profiles")
          .select("id, nombre, apellido, avatar_url")
          .in("id", allUserIds);

        (profsData || []).forEach((p) => { profilesMap[p.id] = p; });
      }

      const playersByMatch = {};
      (playersData || []).forEach((p) => {
        if (!playersByMatch[p.match_id]) playersByMatch[p.match_id] = [];
        playersByMatch[p.match_id].push({
          ...p,
          profile: profilesMap[p.user_id] || null,
        });
      });

      const partidosFinales = partidosVisibles.map((m) => ({
        ...m,
        players: playersByMatch[m.id] || [],
      }));

      setMatches(partidosFinales);
    } catch (error) {
      console.error("Error cargando partidos de fútbol:", error);
    } finally {
      setLoading(false);
    }
  }

  const misPartidosActivos = useMemo(() => {
    if (!user) return [];
    return matches.filter((m) => {
      if (m.status === "jugado") return false;
      const soyCreador = m.created_by === user.id;
      const soyJugador = m.players?.some((p) => p.user_id === user.id);
      return soyCreador || soyJugador;
    });
  }, [matches, user]);

  const partidosAbiertos = useMemo(() => {
    return matches.filter((m) => {
      if (m.status !== "programado") return false;
      const esPrivado = m.is_private || m.match_type === "privado";
      if (esPrivado) return false;
      if (user && m.players?.some((p) => p.user_id === user.id)) return false;
      return true;
    });
  }, [matches, user]);

  const historialPartidos = useMemo(() => {
    return matches.filter((m) => m.status === "jugado");
  }, [matches]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Sports Hub · Fútbol</span>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Centro de Partidos ⚽</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Revisa tus reservas activas, caimanas o únete a partidos abiertos de la comunidad.
            </p>
          </div>

          <Link
            href="/futbol/clubes"
            className="self-start md:self-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors"
          >
            + Reservar Cancha / Abrir Partido
          </Link>
        </div>

        {user && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">📌</span>
                <h2 className="text-lg font-black text-slate-900">Mis Partidos y Reservas Activas</h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {misPartidosActivos.length}
                </span>
              </div>
            </div>

            {misPartidosActivos.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-500">No tienes reservas activas ni caimanas programadas.</p>
                <Link href="/futbol/clubes" className="inline-block text-xs font-black text-emerald-600 hover:underline">
                  👉 Ir a clubes para reservar una cancha
                </Link>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
                {misPartidosActivos.map((match) => (
                  <TarjetaFutbolPartido key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-lg">🌐</span>
            <h2 className="text-lg font-black text-slate-900">Partidos Abiertos (Comunidad)</h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
              {partidosAbiertos.length} disponibles
            </span>
          </div>

          {partidosAbiertos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-300 space-y-3 max-w-xl mx-auto">
              <span className="text-3xl block">⚽</span>
              <h3 className="text-base font-black text-slate-800">No hay partidos públicos abiertos actualmente</h3>
              <p className="text-xs text-slate-400 font-medium">
                ¡Reserva una cancha en tu complejo favorito y organiza la caimana!
              </p>
              <Link
                href="/futbol/clubes"
                className="inline-block mt-2 px-5 py-2.5 bg-slate-900 text-[#00FF9D] text-xs font-black uppercase tracking-wider rounded-2xl shadow-md"
              >
                Ir a Clubes
              </Link>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
              {partidosAbiertos.map((match) => (
                <TarjetaFutbolPartido key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>

        {historialPartidos.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg">🏆</span>
              <h2 className="text-lg font-black text-slate-900">Historial de Partidos Anteriores</h2>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                {historialPartidos.length} jugados
              </span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
              {historialPartidos.map((match) => (
                <TarjetaFutbolPartido key={match.id} match={match} esHistorial={true} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}