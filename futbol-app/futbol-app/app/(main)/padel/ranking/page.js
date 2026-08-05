"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Banderas por código de país
const BANDERAS_PAIS = {
  VE: "🇻🇪",
  AR: "🇦🇷",
  CO: "🇨🇴",
  CL: "🇨🇱",
  ES: "🇪🇸",
  MX: "🇲🇽",
  US: "🇺🇸",
  OTRO: "🌍",
};

const CATEGORIAS = [
  { value: "todas", label: "Todas las categorías" },
  { value: "rookies", label: "Rookies" },
  { value: "7ma", label: "7ma Categoría" },
  { value: "6ta", label: "6ta Categoría" },
  { value: "5ta", label: "5ta Categoría" },
  { value: "4ta", label: "4ta Categoría" },
  { value: "3era", label: "3era Categoría" },
  { value: "2da", label: "2da Categoría" },
  { value: "open", label: "Open (Profesional)" },
];

export default function PadelRankingPage() {
  const [loading, setLoading] = useState(true);
  const [jugadores, setJugadores] = useState([]);
  const [user, setUser] = useState(null);

  // Filtros
  const [filtroPais, setFiltroPais] = useState("todos");
  const [filtroCiudad, setFiltroCiudad] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarRanking();
  }, []);

  async function cargarRanking() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      // Cargar perfiles de pádel unidos con profiles global
      const { data, error } = await supabase
        .from("padel_profiles")
        .select(`
          id, cuenta_id, rating, categoria_oficial, fiabilidad,
          posicion, mano_habil,
          profiles:cuenta_id ( id, nombre, apellido, avatar_url, pais, ciudad )
        `);

      if (error) throw error;

      // Cargar partidos para estadísticas de victorias
      const { data: matchPlayers } = await supabase
        .from("padel_match_players")
        .select(`user_id, team, match:padel_matches!inner(status, winner_team)`);

      const statsMap = {};
      (matchPlayers || []).forEach((row) => {
        if (row.match?.status === "jugado") {
          const uid = row.user_id;
          if (!statsMap[uid]) statsMap[uid] = { pj: 0, vic: 0 };
          statsMap[uid].pj += 1;
          if (row.match.winner_team === row.team) {
            statsMap[uid].vic += 1;
          }
        }
      });

      const listaFormateada = (data || []).map((item) => {
        const uid = item.cuenta_id;
        const st = statsMap[uid] || { pj: 0, vic: 0 };
        const pct = st.pj > 0 ? Math.round((st.vic / st.pj) * 100) : 0;

        return {
          id: item.id,
          cuenta_id: uid,
          nombre: `${item.profiles?.nombre || "Jugador"} ${item.profiles?.apellido || ""}`.trim(),
          avatar_url: item.profiles?.avatar_url || null,
          pais: item.profiles?.pais || "VE",
          ciudad: item.profiles?.ciudad || "Sin especificar",
          rating: Number(item.rating) || 1.50,
          categoria: item.categoria_oficial || "rookies",
          partidos_jugados: st.pj,
          victorias: st.vic,
          pct_victorias: pct,
        };
      });

      setJugadores(listaFormateada);
    } catch (err) {
      console.error("Error al cargar ranking:", err);
    } finally {
      setLoading(false);
    }
  }

  // 🔥 Lista de ciudades dinámicas filtradas por el país seleccionado
  const ciudadesDisponibles = useMemo(() => {
    const setC = new Set();
    jugadores.forEach((j) => {
      if (filtroPais !== "todos" && j.pais !== filtroPais) return;
      if (j.ciudad && j.ciudad !== "Sin especificar") setC.add(j.ciudad);
    });
    return Array.from(setC).sort();
  }, [jugadores, filtroPais]);

  // Manejar cambio de país y resetear ciudad si es necesario
  function manejarCambioPais(nuevoPais) {
    setFiltroPais(nuevoPais);
    setFiltroCiudad("todas");
  }

  // FILTRADO Y ORDENAMIENTO DE JUGADORES
  const rankingFiltrado = useMemo(() => {
    const list = jugadores.filter((j) => {
      if (filtroPais !== "todos" && j.pais !== filtroPais) return false;
      if (filtroCiudad !== "todas" && j.ciudad?.toLowerCase() !== filtroCiudad.toLowerCase()) return false;
      if (filtroCategoria !== "todas" && j.categoria !== filtroCategoria) return false;
      if (busqueda.trim() && !j.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.victorias !== a.victorias) return b.victorias - a.victorias;
      return b.pct_victorias - a.pct_victorias;
    });
  }, [jugadores, filtroPais, filtroCiudad, filtroCategoria, busqueda]);

  // Posición del usuario actual
  const puestoUsuario = useMemo(() => {
    if (!user) return null;
    const index = rankingFiltrado.findIndex((j) => j.cuenta_id === user.id);
    return index !== -1 ? { puesto: index + 1, datos: rankingFiltrado[index] } : null;
  }, [rankingFiltrado, user]);

  const top1 = rankingFiltrado[0] || null;
  const top2 = rankingFiltrado[1] || null;
  const top3 = rankingFiltrado[2] || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-blue-600">
              Sports Hub · Pádel
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Ranking Oficial 🏆
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5">
              Clasificación general basada en Rating Playtomic y victorias.
            </p>
          </div>

          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="🔍 Buscar jugador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">País</label>
            <select
              value={filtroPais}
              onChange={(e) => manejarCambioPais(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="todos">🌐 Todos los países</option>
              <option value="VE">🇻🇪 Venezuela</option>
              <option value="AR">🇦🇷 Argentina</option>
              <option value="CO">🇨🇴 Colombia</option>
              <option value="CL">🇨🇱 Chile</option>
              <option value="ES">🇪🇸 España</option>
              <option value="MX">🇲🇽 México</option>
              <option value="US">🇺🇸 USA</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Ciudad</label>
            <select
              value={filtroCiudad}
              onChange={(e) => setFiltroCiudad(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="todas">📍 Todas las ciudades</option>
              {ciudadesDisponibles.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Categoría</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              {CATEGORIAS.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* MI POSICIÓN DESTACADA */}
        {puestoUsuario && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white p-3.5 sm:p-4.5 rounded-2xl sm:rounded-3xl shadow-md flex items-center justify-between gap-2 overflow-hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xs sm:text-lg text-emerald-300 shrink-0">
                #{puestoUsuario.puesto}
              </span>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-200 truncate">Tu posición actual</p>
                <p className="text-xs sm:text-sm font-black truncate">{puestoUsuario.datos.nombre}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-blue-200 block">Rating</span>
              <span className="text-sm sm:text-lg font-black text-[#00FF9D]">{puestoUsuario.datos.rating.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 👑 PODIO TOP 3 */}
        {rankingFiltrado.length >= 3 && (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-4 items-end pt-5 pb-2">
            
            {/* #2 SEGUNDO LUGAR (PLATA) */}
            {top2 && (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-4 border border-slate-200 shadow-sm text-center flex flex-col items-center justify-between min-h-[180px] sm:min-h-[220px] relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-slate-800 font-black text-[9px] sm:text-[10px] px-2 sm:px-3 py-0.5 rounded-full border border-slate-300 whitespace-nowrap shadow-sm">
                  🥈 #2
                </span>

                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 border-2 border-slate-300 p-0.5 mt-2 sm:mt-3 overflow-hidden shadow-sm shrink-0">
                  {top2.avatar_url ? (
                    <img src={top2.avatar_url} alt={top2.nombre} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-800 text-white font-black text-sm sm:text-xl flex items-center justify-center">
                      {top2.nombre.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="w-full min-w-0 px-0.5 my-1">
                  <h3 className="text-[11px] sm:text-sm font-black text-slate-900 truncate w-full">{top2.nombre}</h3>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate w-full mt-0.5">
                    {BANDERAS_PAIS[top2.pais]} {top2.ciudad}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl w-full py-1 sm:py-2 px-1">
                  <span className="text-xs sm:text-sm font-black text-blue-600 block">{top2.rating.toFixed(2)}</span>
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase text-slate-400 block truncate">{top2.categoria}</span>
                </div>
              </div>
            )}

            {/* #1 PRIMER LUGAR (ORO - CENTRO DESTACADO) */}
            {top1 && (
              <div className="bg-gradient-to-b from-amber-500/10 via-white to-white rounded-2xl sm:rounded-[2.5rem] p-2.5 sm:p-5 border-2 border-amber-400 shadow-lg sm:shadow-xl text-center flex flex-col items-center justify-between min-h-[210px] sm:min-h-[260px] relative transform -translate-y-1.5 sm:-translate-y-2">
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[9px] sm:text-xs px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-md tracking-wider whitespace-nowrap">
                  👑 #1 TOP
                </span>

                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-amber-400 border-2 sm:border-4 border-amber-300 p-0.5 mt-2 sm:mt-3 overflow-hidden shadow-md shrink-0">
                  {top1.avatar_url ? (
                    <img src={top1.avatar_url} alt={top1.nombre} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-900 text-amber-300 font-black text-base sm:text-2xl flex items-center justify-center">
                      {top1.nombre.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="w-full min-w-0 px-0.5 my-1">
                  <h3 className="text-xs sm:text-base font-black text-slate-900 truncate w-full">{top1.nombre}</h3>
                  <p className="text-[9px] sm:text-xs font-bold text-slate-500 truncate w-full mt-0.5">
                    {BANDERAS_PAIS[top1.pais]} {top1.ciudad}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200/80 rounded-xl sm:rounded-2xl w-full py-1 sm:py-2 px-1">
                  <span className="text-sm sm:text-lg font-black text-amber-600 block">{top1.rating.toFixed(2)}</span>
                  <span className="text-[8px] sm:text-[10px] font-black uppercase text-amber-800 block truncate">{top1.categoria}</span>
                </div>
              </div>
            )}

            {/* #3 TERCER LUGAR (BRONCE) */}
            {top3 && (
              <div className="bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-4 border border-slate-200 shadow-sm text-center flex flex-col items-center justify-between min-h-[180px] sm:min-h-[220px] relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-800/10 text-amber-800 font-black text-[9px] sm:text-[10px] px-2 sm:px-3 py-0.5 rounded-full border border-amber-800/20 whitespace-nowrap shadow-sm">
                  🥉 #3
                </span>

                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-100 border-2 border-amber-700/30 p-0.5 mt-2 sm:mt-3 overflow-hidden shadow-sm shrink-0">
                  {top3.avatar_url ? (
                    <img src={top3.avatar_url} alt={top3.nombre} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-800 text-white font-black text-sm sm:text-xl flex items-center justify-center">
                      {top3.nombre.charAt(0)}
                    </div>
                  )}
                </div>

                <div className="w-full min-w-0 px-0.5 my-1">
                  <h3 className="text-[11px] sm:text-sm font-black text-slate-900 truncate w-full">{top3.nombre}</h3>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate w-full mt-0.5">
                    {BANDERAS_PAIS[top3.pais]} {top3.ciudad}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl w-full py-1 sm:py-2 px-1">
                  <span className="text-xs sm:text-sm font-black text-blue-600 block">{top3.rating.toFixed(2)}</span>
                  <span className="text-[8px] sm:text-[9px] font-bold uppercase text-slate-400 block truncate">{top3.categoria}</span>
                </div>
              </div>
            )}

          </div>
        )}

        {/* LISTA COMPLETA DE JUGADORES ENUMERADA */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Posición / Jugador</span>
            <span>Rating / Stats</span>
          </div>

          {rankingFiltrado.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-400 text-xs font-bold space-y-2">
              <span className="text-3xl block">🎾</span>
              <p className="text-sm font-black text-slate-800">No hay jugadores para esta selección</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rankingFiltrado.map((jugador, index) => {
                const puesto = index + 1;
                const esYo = user?.id === jugador.cuenta_id;

                return (
                  <div
                    key={jugador.id}
                    className={`p-3 sm:p-4 flex items-center justify-between gap-2.5 transition-colors ${
                      esYo ? "bg-blue-50/80 font-bold" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      
                      {/* Puesto */}
                      <span className={`w-6 sm:w-8 text-center text-xs sm:text-sm font-black shrink-0 ${
                        puesto === 1 ? "text-amber-500" : puesto === 2 ? "text-slate-400" : puesto === 3 ? "text-amber-700" : "text-slate-400"
                      }`}>
                        #{puesto}
                      </span>

                      {/* Avatar */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-black text-slate-700 text-xs">
                        {jugador.avatar_url ? (
                          <img src={jugador.avatar_url} alt={jugador.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span>{jugador.nombre.charAt(0)}</span>
                        )}
                      </div>

                      {/* Nombre y Ubicación */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {jugador.nombre}
                          </p>
                          {esYo && (
                            <span className="bg-blue-600 text-white text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full shrink-0">
                              Tú
                            </span>
                          )}
                        </div>

                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate mt-0.5">
                          {BANDERAS_PAIS[jugador.pais]} {jugador.ciudad} • <span className="uppercase text-blue-600 font-extrabold">{jugador.categoria}</span>
                        </p>
                      </div>

                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs sm:text-base font-black text-slate-900">
                        {jugador.rating.toFixed(2)} <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">lvl</span>
                      </p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5">
                        <span className="text-emerald-600">{jugador.victorias}V</span> - <span className="text-slate-500">{jugador.partidos_jugados - jugador.victorias}D</span> ({jugador.pct_victorias}%)
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}