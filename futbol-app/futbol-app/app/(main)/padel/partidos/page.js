"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PartidoPadelCard from "@/components/padel/PartidoPadelCard";

export default function PadelPartidosPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [userCreditos, setUserCreditos] = useState(0);

  // Filtros para partidos abiertos
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

      // 1. IDs de partidos donde el usuario ya participa
      let misPartidosIds = [];
      if (authUser) {
        const { data: misJugadoresData } = await supabase
          .from("match_players")
          .select("match_id")
          .eq("user_id", authUser.id);
        misPartidosIds = (misJugadoresData || []).map((m) => m.match_id).filter(Boolean);
      }

      // 2. Consultar partidos programados Y jugados (Para no perder el historial)
      const { data: matchesData, error: matchesErr } = await supabase
        .from("matches")
        .select(`
          id, club_id, court_id, match_type, is_private, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player, created_by, winner_team, score_status, score_text,
          club:clubs ( name, city, address ),
          court:courts ( name )
        `)
        .in("status", ["programado", "jugado"])
        .order("scheduled_at", { ascending: true });

      if (matchesErr) throw matchesErr;

      // Partidos visibles (Públicos O Privados donde el usuario es creador/jugador)
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

      // 3. Jugadores e hidratación de perfiles
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
      }));

      setMatches(partidosFinales);
    } catch (error) {
      console.error("Error cargando partidos:", error);
    } finally {
      setLoading(false);
    }
  }

  // 1. MIS PARTIDOS Y RESERVAS (Programados y Jugados donde participo)
  const misPartidos = useMemo(() => {
    if (!user) return [];
    return matches.filter((m) => {
      const soyCreador = m.created_by === user.id;
      const soyJugador = m.players?.some((p) => p.user_id === user.id);
      return soyCreador || soyJugador;
    });
  }, [matches, user]);

  // 2. PARTIDOS ABIERTOS DE LA COMUNIDAD (Públicos y Programados donde NO estoy)
  const partidosAbiertos = useMemo(() => {
    return matches.filter((m) => {
      if (m.status !== "programado") return false; // Sólo mostrar programados en abiertos
      const esPrivado = m.is_private || m.match_type === "privado";
      if (esPrivado) return false;

      // Excluir los que ya estoy metido
      if (user && m.players?.some((p) => p.user_id === user.id)) return false;

      // Filtros
      if (filtroCategoria !== "todas" && m.category_restriction !== filtroCategoria) return false;
      if (filtroTipo === "competitivo" && !m.is_competitive) return false;
      if (filtroTipo === "amistoso" && m.is_competitive) return false;

      return true;
    });
  }, [matches, user, filtroCategoria, filtroTipo]);

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
              Revisa tus reservas activas y partidos jugados, o únete a partidos abiertos.
            </p>
          </div>

          <Link
            href="/padel/clubes"
            className="self-start md:self-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors"
          >
            + Reservar Cancha / Abrir Partido
          </Link>
        </div>

        {/* 1. SECCIÓN: MIS PARTIDOS Y RESERVAS (SLIDER HORIZONTAL) */}
        {user && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">📌</span>
                <h2 className="text-lg font-black text-slate-900">Mis Partidos y Reservas</h2>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                  {misPartidos.length}
                </span>
              </div>
            </div>

            {misPartidos.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center border border-dashed border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-500">No tienes reservas activas ni partidos programados.</p>
                <Link href="/padel/clubes" className="inline-block text-xs font-black text-blue-600 hover:underline">
                  👉 Ir a clubes para reservar una pista
                </Link>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-300">
                {misPartidos.map((match) => (
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

        {/* 2. SECCIÓN: PARTIDOS ABIERTOS DE LA COMUNIDAD (SLIDER HORIZONTAL) */}
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
                  {["Rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "Open"].map((c) => (
                    <option key={c} value={c}>{c}</option>
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

      </div>
    </div>
  );
}