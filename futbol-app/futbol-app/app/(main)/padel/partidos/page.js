"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PartidoPadelCard from "@/components/padel/PartidoPadelCard";

function formatFechaCorta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PadelPartidosPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [userCreditos, setUserCreditos] = useState(0);

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  useEffect(() => {
    cargarPartidos();
  }, []);

  async function cargarPartidos() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("creditos")
          .eq("id", authUser.id)
          .maybeSingle();
        setUserCreditos(prof?.creditos ?? 0);
      }

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
          id, club_id, court_id, match_type, is_private, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player, created_by, winner_team, score_status, score_text,
          club:clubs ( name, city, address ),
          court:courts ( name )
        `)
        .in("status", ["programado", "en_progreso", "jugado"])
        .order("scheduled_at", { ascending: false });

      if (matchesErr) throw matchesErr;

      // 🔴 FILTRADO ROBUTO DE VISIBILIDAD (SOPORTA PUBLICOS CREADOS POR CUALQUIERA)
      const partidosVisibles = (matchesData || []).filter((m) => {
        const typeStr = (m.match_type || "").toString().toLowerCase();
        const esPrivado = m.is_private === true || typeStr === "privado";
        
        // Si no es privado, ES PÚBLICO y todos los usuarios lo pueden ver
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
      let padelProfilesMap = {};

      if (allUserIds.length > 0) {
        const [{ data: profsData }, { data: padelProfsData }] = await Promise.all([
          supabase.from("profiles").select("id, nombre, apellido, avatar_url").in("id", allUserIds),
          supabase.from("padel_profiles").select("cuenta_id, rating, categoria_oficial").in("cuenta_id", allUserIds)
        ]);

        (profsData || []).forEach((p) => { profilesMap[p.id] = p; });
        (padelProfsData || []).forEach((pp) => { padelProfilesMap[pp.cuenta_id] = pp; });
      }

      const playersByMatch = {};
      (playersData || []).forEach((p) => {
        if (!playersByMatch[p.match_id]) playersByMatch[p.match_id] = [];
        playersByMatch[p.match_id].push({
          ...p,
          profile: profilesMap[p.user_id] || null,
          padel_profile: padelProfilesMap[p.user_id] || null,
        });
      });

      const partidosFinales = partidosVisibles.map((m) => ({
        ...m,
        players: playersByMatch[m.id] || [],
      })).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

      setMatches(partidosFinales);
    } catch (error) {
      console.error("Error cargando partidos:", error);
    } finally {
      setLoading(false);
    }
  }

  // 1. MIS PARTIDOS PRÓXIMOS
  const misPartidosProximos = useMemo(() => {
    if (!user) return [];
    return matches.filter((m) => {
      if (m.status === "jugado") return false;
      const soyCreador = m.created_by === user.id;
      const soyJugador = m.players?.some((p) => p.user_id === user.id);
      return soyCreador || soyJugador;
    });
  }, [matches, user]);

  // 2. PARTIDOS ABIERTOS DE LA COMUNIDAD (COMPARACIÓN INSENSIBLE A MAYÚSCULAS)
  const partidosAbiertos = useMemo(() => {
    return matches.filter((m) => {
      if (m.status === "jugado") return false;
      
      const typeStr = (m.match_type || "").toString().toLowerCase();
      const esPrivado = m.is_private === true || typeStr === "privado";
      if (esPrivado) return false;

      // Si el usuario ya está metido, no sale en descubrimientos de la comunidad
      if (user && m.players?.some((p) => p.user_id === user.id)) return false;

      // Normalización de categoría para comparación insensible
      if (filtroCategoria !== "todas") {
        const catMatch = (m.category_restriction || "").toString().toLowerCase().trim();
        const catFiltro = filtroCategoria.toLowerCase().trim();
        if (catMatch !== catFiltro && catMatch !== "libre") return false;
      }

      if (filtroTipo === "competitivo" && !m.is_competitive) return false;
      if (filtroTipo === "amistoso" && m.is_competitive) return false;

      return true;
    });
  }, [matches, user, filtroCategoria, filtroTipo]);

  // 3. HISTORIAL DE PARTIDOS JUGADOS ANTERIORMENTE
  const misPartidosJugados = useMemo(() => {
    if (!user) return [];
    return [...matches].filter((m) => {
      if (m.status !== "jugado") return false;
      const soyCreador = m.created_by === user.id;
      const soyJugador = m.players?.some((p) => p.user_id === user.id);
      return soyCreador || soyJugador;
    }).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  }, [matches, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">Sports Hub · Pádel</span>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Centro de Partidos 🎾</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Revisa tus reservas activas, partidos abiertos o tu historial de partidos jugados.
            </p>
          </div>

          <Link
            href="/padel/clubes"
            className="self-start md:self-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors"
          >
            + Reservar Cancha / Abrir Partido
          </Link>
        </div>

        {/* 1. SECCIÓN: MIS PRÓXIMOS PARTIDOS Y RESERVAS */}
        {user && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">📌</span>
                <h2 className="text-lg font-black text-slate-900">Mis Próximos Partidos y Reservas</h2>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {misPartidosProximos.length}
                </span>
              </div>
            </div>

            {misPartidosProximos.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-500">No tienes reservas activas ni partidos programados próximos.</p>
                <Link href="/padel/clubes" className="inline-block text-xs font-black text-blue-600 hover:underline">
                  👉 Ir a clubes para reservar una pista
                </Link>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-300">
                {misPartidosProximos.map((match) => (
                  <div key={match.id} className="w-[310px] sm:w-[350px] shrink-0 snap-start">
                    <PartidoPadelCard
                      match={match}
                      currentUser={user}
                      userCreditos={userCreditos}
                      onUpdate={cargarPartidos}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. SECCIÓN: PARTIDOS ABIERTOS DE LA COMUNIDAD */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <h2 className="text-lg font-black text-slate-900">Partidos Abiertos (Comunidad)</h2>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                {partidosAbiertos.length} disponibles
              </span>
            </div>

            {/* FILTROS RÁPIDOS */}
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-slate-400">Cat:</span>
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="todas">Todas</option>
                  {["7ma", "6ta", "5ta", "4ta", "3era", "2da", "Open"].map((c) => (
                    <option key={c} value={c.toLowerCase()}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-slate-400">Modo:</span>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="competitivo">⚡ Comp.</option>
                  <option value="amistoso">🤝 Amistosos</option>
                </select>
              </div>
            </div>
          </div>

          {/* SLIDER DE PARTIDOS ABIERTOS */}
          {partidosAbiertos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-300 space-y-3">
              <span className="text-3xl block">🎾</span>
              <h3 className="text-base font-black text-slate-800">No hay partidos públicos abiertos con esos filtros</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                ¡Sé el primero en abrir un partido en tu club favorito!
              </p>
              <Link
                href="/padel/clubes"
                className="inline-block mt-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-2xl"
              >
                Ir a Clubes
              </Link>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-300">
              {partidosAbiertos.map((match) => (
                <div key={match.id} className="w-[310px] sm:w-[350px] shrink-0 snap-start">
                  <PartidoPadelCard
                    match={match}
                    currentUser={user}
                    userCreditos={userCreditos}
                    onUpdate={cargarPartidos}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. HISTORIAL DE PARTIDOS JUGADOS ANTERIORMENTE */}
        {user && misPartidosJugados.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg">🏆</span>
              <h2 className="text-base font-black text-slate-900">Historial de Partidos Jugados Anteriores</h2>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                {misPartidosJugados.length}
              </span>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
              {misPartidosJugados.map((m) => {
                const soyGanador = m.winner_team && m.players?.some(p => p.user_id === user.id && p.team === m.winner_team);

                return (
                  <Link
                    key={m.id}
                    href={`/padel/partidos/${m.id}`}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors block"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 ${
                        soyGanador ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {soyGanador ? "👑" : "🎾"}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-900 truncate">
                            {m.club?.name || "Club"} • {m.court?.name || "Pista"}
                          </p>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {m.is_competitive ? "Ranked" : "Amistoso"}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 capitalize">
                          📅 {formatFechaCorta(m.scheduled_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <span className="text-xs font-black text-emerald-600 block">
                          {m.score_text || "Jugado"}
                        </span>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase">
                          Ganador: Dupla {m.winner_team === "A" ? "1 (A)" : "2 (B)"}
                        </span>
                      </div>
                      <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">
                        Ver Detalles →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}