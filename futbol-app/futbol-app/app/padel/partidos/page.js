"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

function formatFechaLarga(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function PadelPartidosPage() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [userCreditos, setUserCreditos] = useState(0);
  const [procesandoId, setProcesandoId] = useState(null);

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
          .single();
        setUserCreditos(prof?.creditos ?? 0);
      }

      // Cargar solo partidos ABIERTOS y PROGRAMADOS
      const { data, error } = await supabase
        .from("padel_matches")
        .select(`
          id, match_type, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player,
          club:padel_clubs ( name, city, address ),
          court:padel_courts ( name ),
          players:padel_match_players ( user_id, team )
        `)
        .eq("status", "programado")
        .eq("match_type", "abierto")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error("Error cargando partidos:", error);
    } finally {
      setLoading(false);
    }
  }

  // Unirse a un partido público directamente
  async function unirseAPartido(match) {
    if (!user) {
      alert("Debes iniciar sesión para unirte.");
      return;
    }

    const inscritos = match.players?.length || 0;
    if (inscritos >= 4) {
      alert("Este partido ya está lleno.");
      return;
    }

    if (match.players?.some((p) => p.user_id === user.id)) {
      alert("Ya formas parte de este partido.");
      return;
    }

    const costo = match.price_per_player || 4;
    if (userCreditos < costo) {
      alert(`⚠️ Saldo insuficiente (${costo} créditos requeridos). Recarga tu cuenta.`);
      return;
    }

    try {
      setProcesandoId(match.id);

      const nuevoSaldo = userCreditos - costo;
      await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", user.id);

      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        match_id: match.id,
        delta: -costo,
        reason: "unirse_partido_feed_padel",
        balance_after: nuevoSaldo
      });

      const teamAsignado = match.players?.filter((p) => p.team === "A").length < 2 ? "A" : "B";

      await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: user.id,
        team: teamAsignado
      });

      alert(`🎉 ¡Te has unido al partido! (-${costo} créditos)`);
      setUserCreditos(nuevoSaldo);
      await cargarPartidos();
    } catch (e) {
      console.error(e);
      alert("Error al unirte al partido.");
    } finally {
      setProcesandoId(null);
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
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">Sports Hub · Pádel</span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Partidos Abiertos</h1>
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
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
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

        {/* LISTADO DE PARTIDOS EN TARJETAS */}
        {partidosFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-3">
            <span className="text-4xl block">🎾</span>
            <h3 className="text-lg font-black text-slate-800">No hay partidos públicos abiertos con esos filtros</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
              ¡Sé el primero en abrir un partido en tu club favorito para que otros se unan!
            </p>
            <Link
              href="/padel/clubes"
              className="inline-block mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-black uppercase rounded-xl"
            >
              Ir a Clubes y Abrir Partido
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partidosFiltrados.map((match) => {
              const inscritos = match.players?.length || 0;
              const yaInscrito = match.players?.some((p) => p.user_id === user?.id);

              return (
                <div
                  key={match.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* BADGES Y ESTADO */}
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-blue-50 text-blue-700 font-black text-[10px] uppercase px-3 py-1 rounded-full border border-blue-200">
                        {match.category_restriction || "Libre"}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        match.is_competitive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"
                      }`}>
                        {match.is_competitive ? "⚡ Competitivo" : "🤝 Amistoso"}
                      </span>
                    </div>

                    {/* CLUB Y HORA */}
                    <h3 className="text-xl font-black text-slate-900">{match.club?.name || "Club de Pádel"}</h3>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                      📍 {match.club?.city || "Ubicación"} • {match.court?.name || "Pista"}
                    </p>

                    <div className="mt-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fecha y Hora</span>
                        <span className="text-xs font-black text-slate-800 capitalize">
                          📅 {formatFechaLarga(match.scheduled_at)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Precio / Jugador</span>
                        <span className="text-xs font-black text-blue-600">{match.price_per_player || 4} créditos</span>
                      </div>
                    </div>
                  </div>

                  {/* PROGRESO DE INSCRITOS (0/4, 1/4, 2/4...) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-extrabold">
                      <span className="text-slate-600">Jugadores confirmados:</span>
                      <span className="text-blue-600">{inscritos} / 4</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${(inscritos / 4) * 100}%` }}
                      />
                    </div>

                    {/* BOTÓN DE UNIRSE */}
                    <button
                      onClick={() => unirseAPartido(match)}
                      disabled={inscritos >= 4 || yaInscrito || procesandoId === match.id}
                      className={`w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all mt-2 ${
                        yaInscrito
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                          : inscritos >= 4
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95"
                      }`}
                    >
                      {procesandoId === match.id
                        ? "Procesando..."
                        : yaInscrito
                        ? "✓ Ya estás en este partido"
                        : inscritos >= 4
                        ? "Partido Lleno"
                        : `Unirme (+${match.price_per_player || 4} cr)`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}