"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import PartidoPadelCard from "../../../components/padel/PartidoPadelCard";

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

      // Cargar partidos ABIERTOS con sus jugadores, profiles y padel_profiles
      const { data, error } = await supabase
        .from("padel_matches")
        .select(`
          id, match_type, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player,
          club:padel_clubs ( name, city, address ),
          court:padel_courts ( name ),
          players:padel_match_players ( 
            id, user_id, team,
            profile:profiles ( id, nombre, avatar_url ),
            padel_profile:padel_profiles!padel_match_players_user_id_fkey ( rating, categoria_oficial )
          )
        `)
        .eq("status", "programado")
        .eq("match_type", "abierto")
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.warn("Aviso al cargar relaciones extendidas, reintentando consulta básica...", error);
        
        // Consulta fallback si las FKeys extendidas no están linkeadas
        const { data: dataFallback } = await supabase
          .from("padel_matches")
          .select(`
            id, match_type, scheduled_at, status, category_restriction,
            gender_restriction, is_competitive, price_per_player,
            club:padel_clubs ( name, city, address ),
            court:padel_courts ( name ),
            players:padel_match_players ( id, user_id, team )
          `)
          .eq("status", "programado")
          .eq("match_type", "abierto")
          .order("scheduled_at", { ascending: true });

        setMatches(dataFallback || []);
      } else {
        setMatches(data || []);
      }
    } catch (error) {
      console.error("Error cargando partidos:", error);
    } finally {
      setLoading(false);
    }
  }

  // Filtrado de partidos
  const partidosFiltrados = matches.filter((m) => {
    if (filtroCategoria !== "todas" && m.category_restriction !== filtroCategoria) return false;
    if (filtroTipo === "competitivo" && !m.is_competitive) return false;
    if (filtroTipo === "amistoso" && m.is_competitive) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">Sports Hub · Pádel</span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Partidos Abiertos 🎾</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Únete a partidos organizados por otros jugadores en tu ciudad y suma puntos a tu rating.
            </p>
          </div>

          <Link
            href="/padel/clubes"
            className="self-start md:self-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors"
          >
            + Abrir Nuevo Partido
          </Link>
        </div>

        {/* FILTROS RÁPIDOS */}
        <div className="bg-white p-3.5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500">Categoría:</span>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="todas">Todas las categorías</option>
              {["Rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "Open"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-500">Modalidad:</span>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
            >
              <option value="todos">Todos los modos</option>
              <option value="competitivo">⚡ Competitivos</option>
              <option value="amistoso">🤝 Amistosos</option>
            </select>
          </div>
        </div>

        {/* LISTADO DE PARTIDOS EN TARJETAS NUEVAS */}
        {partidosFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-3">
            <span className="text-4xl block">🎾</span>
            <h3 className="text-lg font-black text-slate-800">No hay partidos públicos abiertos con esos filtros</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
              ¡Sé el primero en abrir un partido en tu club favorito para que otros se unan!
            </p>
            <Link
              href="/padel/clubes"
              className="inline-block mt-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-2xl"
            >
              Ir a Clubes y Abrir Partido
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {partidosFiltrados.map((match) => (
              <PartidoPadelCard
                key={match.id}
                match={match}
                currentUser={user}
                userCreditos={userCreditos}
                onUpdate={cargarPartidos}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}