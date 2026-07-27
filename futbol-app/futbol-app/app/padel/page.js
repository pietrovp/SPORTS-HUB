"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import PartidoPadelCard from "../../components/padel/PartidoPadelCard";

const LABELS_CAT = {
  rookies: "Rookies",
  "7ma": "7ma",
  "6ta": "6ta",
  "5ta": "5ta",
  "4ta": "4ta",
  "3era": "3era",
  "2da": "2da",
  open: "Open",
};

export default function PadelHome() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userCreditos, setUserCreditos] = useState(0);
  const [padelProfile, setPadelProfile] = useState(null);
  const [partidosAbiertos, setPartidosAbiertos] = useState([]);
  
  // Ranking
  const [topRanking, setTopRanking] = useState([]);
  const [miPosicionRanking, setMiPosicionRanking] = useState(null);

  useEffect(() => {
    cargarHomePadel();
  }, []);

  async function cargarHomePadel() {
    try {
      setLoading(true);

      // 1. Cargar Usuario y Perfil de Pádel
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      let currentPadelProf = null;

      if (authUser) {
        const [{ data: prof }, { data: pProf }] = await Promise.all([
          supabase.from("profiles").select("creditos").eq("id", authUser.id).maybeSingle(),
          supabase.from("padel_profiles").select("rating, categoria_oficial, victorias, derrotas").eq("cuenta_id", authUser.id).maybeSingle(),
        ]);

        setUserCreditos(prof?.creditos ?? 0);
        currentPadelProf = pProf || null;
        setPadelProfile(currentPadelProf);
      }

      // 2. Cargar Próximos Partidos Abiertos
      const { data: matchesData } = await supabase
        .from("padel_matches")
        .select(`
          id, club_id, court_id, match_type, is_private, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player, created_by,
          club:padel_clubs ( name, city, address ),
          court:padel_courts ( name )
        `)
        .eq("status", "programado")
        .eq("match_type", "abierto")
        .order("scheduled_at", { ascending: true })
        .limit(6);

      const matchIds = (matchesData || []).map((m) => m.id);

      if (matchIds.length > 0) {
        const { data: playersData } = await supabase
          .from("padel_match_players")
          .select("id, match_id, user_id, team")
          .in("match_id", matchIds);

        const allUserIds = Array.from(new Set((playersData || []).map((p) => p.user_id).filter(Boolean)));

        let profilesMap = {};
        let padelProfilesMap = {};

        if (allUserIds.length > 0) {
          const [{ data: profsData }, { data: padelProfsData }] = await Promise.all([
            supabase.from("profiles").select("id, nombre, apellido, avatar_url").in("id", allUserIds),
            supabase.from("padel_profiles").select("cuenta_id, rating, categoria_oficial").in("cuenta_id", allUserIds),
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

        const partidosFormatted = (matchesData || []).map((m) => ({
          ...m,
          players: playersByMatch[m.id] || [],
        }));

        setPartidosAbiertos(partidosFormatted);
      } else {
        setPartidosAbiertos([]);
      }

      // 3. Cargar Top 4 Ranking General
      const { data: topData } = await supabase
        .from("padel_profiles")
        .select(`
          cuenta_id, rating, categoria_oficial, victorias,
          profile:cuenta_id ( nombre, apellido, avatar_url, ciudad )
        `)
        .order("rating", { ascending: false })
        .limit(4);

      setTopRanking(topData || []);

      // 4. Calcular Puesto Exacto del Usuario en el Ranking
      if (authUser && currentPadelProf) {
        const { count } = await supabase
          .from("padel_profiles")
          .select("*", { count: "exact", head: true })
          .gt("rating", currentPadelProf.rating || 0);

        const rankExacto = (count || 0) + 1;

        const { data: uProfile } = await supabase
          .from("profiles")
          .select("nombre, apellido, avatar_url, ciudad")
          .eq("id", authUser.id)
          .maybeSingle();

        setMiPosicionRanking({
          ...currentPadelProf,
          rank: rankExacto,
          profile: uProfile,
        });
      }

    } catch (err) {
      console.error("Error cargando home de pádel:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const top3 = topRanking.slice(0, 3);
  const cuartoJugadorGeneral = topRanking[3] || null;
  const usuarioFueraDelTop3 = miPosicionRanking && miPosicionRanking.rank > 3;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* 1. 🎾 HERO BANNER COMPACTO */}
        <div className="relative w-full bg-gradient-to-r from-[#0B0C2A] via-[#161848] to-[#0B0C2A] rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl border border-blue-500/20 overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-2 max-w-xl">
            <span className="bg-blue-500/30 border border-blue-400/30 text-blue-300 text-[10px] sm:text-xs font-black uppercase px-3.5 py-1 rounded-full tracking-wider inline-block">
              🎾 Comunidad Oficial de Pádel
            </span>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Encuentra partidos y sube en el <span className="text-[#00FF9D]">Ranking Oficial</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Suma puntos en cada juego competitivo, compite contra rivales de tu categoría y reserva pistas en los mejores clubes.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <Link
              href="/padel/clubes"
              className="flex-1 sm:flex-initial px-5 py-3.5 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all text-center active:scale-95"
            >
              ⚡ Reservar Pista
            </Link>
            <Link
              href="/padel/partidos"
              className="flex-1 sm:flex-initial px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all text-center"
            >
              🔍 Buscar Partidos
            </Link>
          </div>
        </div>

        {/* 2. 📅 SECCIÓN: PRÓXIMOS PARTIDOS ABIERTOS (SLIDER) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">Comunidad</span>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <span>🎾</span> Partidos Esperando Jugadores
              </h2>
            </div>
            <Link href="/padel/partidos" className="text-xs font-black text-blue-600 hover:underline">
              Ver Todos →
            </Link>
          </div>

          {partidosAbiertos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200 space-y-3">
              <span className="text-3xl block">🎾</span>
              <h3 className="text-base font-black text-slate-800">No hay partidos abiertos programados hoy</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
                Sé el primero en reservar una pista y abrir un partido para que otros se unan.
              </p>
              <Link
                href="/padel/clubes"
                className="inline-block px-5 py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-2xl"
              >
                + Abrir Partido en un Club
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
                    onUpdate={cargarHomePadel}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. GRID 2 COLUMNAS: TOP RANKING (3 + TÚ) + TU FICHA DE JUGADOR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* 🏆 COLUMNA IZQUIERDA: RANKING (TOP 3 + POSICIÓN DEL USUARIO EN 4TO LUGAR) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">Líderes</span>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                  <span>🏆</span> Top Ranking Regional
                </h3>
              </div>
              <Link href="/padel/ranking" className="text-xs font-black text-blue-600 hover:underline">
                Ver Tabla Completa →
              </Link>
            </div>

            {top3.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-4">Sin jugadores registrados aún.</p>
            ) : (
              <div className="space-y-2.5">
                
                {/* 🥇 🥈 🥉 DIBUJAR ÚNICAMENTE EL TOP 3 */}
                {top3.map((p, idx) => {
                  const nombre = p.profile ? `${p.profile.nombre} ${p.profile.apellido || ""}`.trim() : "Jugador";
                  const avatar = p.profile?.avatar_url;
                  const catLabel = LABELS_CAT[p.categoria_oficial] || "Rookies";
                  const medalla = idx === 0 ? "👑" : idx === 1 ? "🥈" : "🥉";

                  const esElUsuario = user && p.cuenta_id === user.id;

                  return (
                    <div
                      key={p.cuenta_id || idx}
                      className={`flex items-center justify-between p-3 rounded-2xl transition-colors ${
                        esElUsuario
                          ? "bg-blue-50/80 border-2 border-blue-400/50"
                          : "bg-slate-50 border border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 text-center font-black text-xs text-amber-600 shrink-0">
                          {medalla}
                        </span>

                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center overflow-hidden shrink-0">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            nombre.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                            <span>{nombre}</span>
                            {esElUsuario && (
                              <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase">
                                TÚ
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {p.profile?.ciudad || "Barquisimeto"} • {p.victorias || 0} victorias
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="bg-[#00FF9D] text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs block">
                          {Number(p.rating || 1.5).toFixed(2)} pts
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 block">
                          Cat. {catLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* 🎯 4º PUESTO: MOSTRAR POSICIÓN ACTUAL DEL USUARIO (SI NO ESTÁ EN EL TOP 3) O EL #4 DEL RANKING */}
                {usuarioFueraDelTop3 ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/90 border-2 border-blue-400/60 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 flex flex-col items-center justify-center shrink-0">
                        <span className="font-black text-xs text-blue-700">
                          #{miPosicionRanking.rank}
                        </span>
                        <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase">
                          TÚ
                        </span>
                      </div>

                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center overflow-hidden shrink-0 border-2 border-blue-400">
                        {miPosicionRanking.profile?.avatar_url ? (
                          <img src={miPosicionRanking.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (miPosicionRanking.profile?.nombre || "U").charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {miPosicionRanking.profile ? `${miPosicionRanking.profile.nombre} ${miPosicionRanking.profile.apellido || ""}`.trim() : "Tu Perfil"}
                        </p>
                        <p className="text-[10px] font-bold text-blue-600">
                          {miPosicionRanking.profile?.ciudad || "Tu Ciudad"} • {miPosicionRanking.victorias || 0} victorias
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="bg-[#00FF9D] text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs block">
                        {Number(miPosicionRanking.rating || 1.5).toFixed(2)} pts
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 block">
                        Cat. {LABELS_CAT[miPosicionRanking.categoria_oficial] || "Rookies"}
                      </span>
                    </div>
                  </div>
                ) : cuartoJugadorGeneral ? (
                  /* SI EL USUARIO YA ESTÁ EN EL TOP 3 O NO HA INICIADO SESIÓN, MOSTRAR EL #4 NORMAL */
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-center font-black text-xs text-slate-400 shrink-0">
                        #4
                      </span>

                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center overflow-hidden shrink-0">
                        {cuartoJugadorGeneral.profile?.avatar_url ? (
                          <img src={cuartoJugadorGeneral.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (cuartoJugadorGeneral.profile?.nombre || "J").charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {cuartoJugadorGeneral.profile ? `${cuartoJugadorGeneral.profile.nombre} ${cuartoJugadorGeneral.profile.apellido || ""}`.trim() : "Jugador"}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {cuartoJugadorGeneral.profile?.ciudad || "Barquisimeto"} • {cuartoJugadorGeneral.victorias || 0} victorias
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="bg-[#00FF9D] text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-xs block">
                        {Number(cuartoJugadorGeneral.rating || 1.5).toFixed(2)} pts
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 block">
                        Cat. {LABELS_CAT[cuartoJugadorGeneral.categoria_oficial] || "Rookies"}
                      </span>
                    </div>
                  </div>
                ) : null}

              </div>
            )}
          </div>

          {/* 🪪 COLUMNA DERECHA: TU FICHA DE JUGADOR */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#0B0C2A] via-[#161848] to-[#0B0C2A] rounded-3xl p-6 text-white shadow-xl border border-blue-500/20 space-y-5">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D]">
                Tu Ficha Oficial
              </span>
              <span className="text-xs font-bold text-blue-300">Pádel Profile</span>
            </div>

            {user && padelProfile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 p-0.5 shrink-0">
                    <div className="w-full h-full rounded-full bg-[#0B0C2A] overflow-hidden flex items-center justify-center font-black text-xl">
                      {user.email ? user.email[0].toUpperCase() : "U"}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white leading-tight">
                      Level {Number(padelProfile.rating || 1.5).toFixed(2)}
                    </h4>
                    <span className="bg-blue-500/30 text-blue-300 border border-blue-400/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full inline-block mt-1">
                      🎾 Categoría {LABELS_CAT[padelProfile.categoria_oficial] || "Rookies"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Victorias</span>
                    <span className="text-base font-black text-emerald-400">{padelProfile.victorias || 0} 🏆</span>
                  </div>
                  <div className="border-l border-white/10">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Derrotas</span>
                    <span className="text-base font-black text-rose-400">{padelProfile.derrotas || 0}</span>
                  </div>
                </div>

                <Link
                  href="/padel/perfil"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl block text-center transition-all shadow-md active:scale-95"
                >
                  📊 Ver Mi Gráfica y Estadísticas →
                </Link>
              </div>
            ) : user ? (
              <div className="space-y-3 text-center py-2">
                <p className="text-xs font-bold text-slate-300">
                  Aún no has completado tu evaluación inicial para activar tu rating.
                </p>
                <Link
                  href="/padel/perfil"
                  className="w-full py-3.5 bg-[#00FF9D] text-slate-950 font-black text-xs uppercase rounded-2xl block text-center shadow-lg"
                >
                  ⚡ Activar mi Perfil de Pádel
                </Link>
              </div>
            ) : (
              <div className="space-y-3 text-center py-2">
                <p className="text-xs font-bold text-slate-300">
                  Inicia sesión para llevar tu nivel, partidos y competir en el Ranking.
                </p>
                <Link
                  href="/login"
                  className="w-full py-3.5 bg-blue-600 text-white font-black text-xs uppercase rounded-2xl block text-center shadow-lg"
                >
                  Ingresar a mi Cuenta
                </Link>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}