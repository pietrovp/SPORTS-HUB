"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

function formatFechaLarga(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PartidoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id;

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [user, setUser] = useState(null);

  // Modal Cargar Marcador
  const [modalResultadoOpen, setModalResultadoOpen] = useState(false);
  const [set1A, setSet1A] = useState("6");
  const [set1B, setSet1B] = useState("4");
  const [set2A, setSet2A] = useState("6");
  const [set2B, setSet2B] = useState("3");
  const [set3A, setSet3A] = useState("0");
  const [set3B, setSet3B] = useState("0");
  const [guardandoScore, setGuardandoScore] = useState(false);

  useEffect(() => {
    if (matchId) {
      cargarDetallePartido();
    }
  }, [matchId]);

  async function cargarDetallePartido() {
    try {
      setLoading(true);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      // 1. Obtener Datos del Partido + Club + Pista
      const { data: matchData, error: matchError } = await supabase
        .from("padel_matches")
        .select(`
          id, match_type, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player, created_by, winner_team,
          club:padel_clubs ( name, city, address ),
          court:padel_courts ( name )
        `)
        .eq("id", matchId)
        .maybeSingle();

      if (matchError || !matchData) {
        console.error("Error al consultar partido:", matchError);
        setMatch(null);
        return;
      }

      // 2. Obtener Jugadores Inscritos
      const { data: rawPlayers, error: playersError } = await supabase
        .from("padel_match_players")
        .select("id, user_id, team")
        .eq("match_id", matchId);

      if (playersError) {
        console.error("Error al cargar jugadores:", playersError);
      }

      const userIds = (rawPlayers || []).map((p) => p.user_id).filter(Boolean);

      let profilesMap = {};
      let padelProfilesMap = {};

      if (userIds.length > 0) {
        // 3. Obtener Perfiles de Usuario (Nombre, Avatar)
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nombre, apellido, avatar_url")
          .in("id", userIds);

        (profilesData || []).forEach((prof) => {
          profilesMap[prof.id] = prof;
        });

        // 4. Obtener Perfiles de Pádel (Rating)
        const { data: padelProfilesData } = await supabase
          .from("padel_profiles")
          .select("cuenta_id, rating, categoria_oficial")
          .in("cuenta_id", userIds);

        (padelProfilesData || []).forEach((pp) => {
          padelProfilesMap[pp.cuenta_id] = pp;
        });
      }

      // 5. Ensamblar la información
      const playersFormatted = (rawPlayers || []).map((p) => ({
        ...p,
        profile: profilesMap[p.user_id] || null,
        padel_profile: padelProfilesMap[p.user_id] || null,
      }));

      setMatch({
        ...matchData,
        players: playersFormatted,
      });
    } catch (err) {
      console.error("Error general en detalle de partido:", err);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }

  // Finalizar Partido y Calcular Rating
  async function finalizarPartido(e) {
    e.preventDefault();
    if (!match) return;

    try {
      setGuardandoScore(true);

      // 1. Calcular Pareja Ganadora por Sets
      let setsA = 0;
      let setsB = 0;

      if (parseInt(set1A) > parseInt(set1B)) setsA++; else if (parseInt(set1B) > parseInt(set1A)) setsB++;
      if (parseInt(set2A) > parseInt(set2B)) setsA++; else if (parseInt(set2B) > parseInt(set2A)) setsB++;
      if (parseInt(set3A) > 0 || parseInt(set3B) > 0) {
        if (parseInt(set3A) > parseInt(set3B)) setsA++; else if (parseInt(set3B) > parseInt(set3A)) setsB++;
      }

      const ganador = setsA > setsB ? "A" : "B";

      // 2. Actualizar estado del partido en BD
      const { error: errMatch } = await supabase
        .from("padel_matches")
        .update({
          status: "jugado",
          winner_team: ganador,
        })
        .eq("id", match.id);

      if (errMatch) throw errMatch;

      // 3. Ajustar Ratings de los Jugadores (solo si es Competitivo)
      if (match.is_competitive) {
        for (const player of match.players || []) {
          const esGanador = player.team === ganador;
          const ratingActual = Number(player.padel_profile?.rating) || 1.50;
          
          // +0.15 por victoria / -0.10 por derrota
          const delta = esGanador ? 0.15 : -0.10;
          const nuevoRating = Math.max(1.0, parseFloat((ratingActual + delta).toFixed(2)));

          await supabase
            .from("padel_profiles")
            .update({ rating: nuevoRating })
            .eq("cuenta_id", player.user_id);
        }
      }

      setModalResultadoOpen(false);
      await cargarDetallePartido();
      alert(`🎉 ¡Partido finalizado con éxito! Ganó la Pareja ${ganador}. Se han actualizado los ratings.`);
    } catch (err) {
      console.error("Error al finalizar partido:", err);
      alert("No se pudo guardar el resultado.");
    } finally {
      setGuardandoScore(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center space-y-4">
        <span className="text-4xl">🎾</span>
        <h2 className="text-xl font-black text-slate-800">Partido no encontrado</h2>
        <p className="text-xs text-slate-500 font-semibold">
          El partido no existe o fue eliminado de la base de datos.
        </p>
        <Link
          href="/padel/partidos"
          className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black uppercase rounded-2xl"
        >
          ← Volver a Partidos
        </Link>
      </div>
    );
  }

  const parejaA = match.players?.filter((p) => p.team === "A") || [];
  const parejaB = match.players?.filter((p) => p.team === "B") || [];
  const totalJugadores = match.players?.length || 0;
  const partidoLleno = totalJugadores >= 4;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* CABECERA */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3">
          <Link href="/padel/partidos" className="text-xs font-black uppercase text-blue-600 hover:underline block">
            ← Volver a Partidos
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                {match.club?.name || "Club de Pádel"} • {match.court?.name || "Pista Central"}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 capitalize">
                📅 {formatFechaLarga(match.scheduled_at)}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 font-black text-xs px-3 py-1 rounded-full border border-blue-200">
                {match.category_restriction || "Libre"}
              </span>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${
                match.is_competitive ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-600"
              }`}>
                {match.is_competitive ? "⚡ Competitivo" : "🤝 Amistoso"}
              </span>
            </div>
          </div>

          {match.status === "jugado" && (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center">
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block">
                🏆 Partido Finalizado — Ganador: Pareja {match.winner_team}
              </span>
            </div>
          )}
        </div>

        {/* GRILLA DE ENFRENTAMIENTO (PAREJA A VS PAREJA B) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
            Alineación de Pista
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            
            {/* PAREJA A */}
            <div className={`p-5 rounded-3xl border-2 space-y-4 ${
              match.winner_team === "A" ? "border-amber-400 bg-amber-50/30" : "border-slate-100 bg-slate-50/50"
            }`}>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="font-black text-sm text-slate-900">Pareja A</span>
                {match.winner_team === "A" && <span className="text-xs font-black text-amber-600">👑 Ganadores</span>}
              </div>

              <div className="space-y-3">
                {[0, 1].map((idx) => {
                  const player = parejaA[idx];
                  const tienePerfil = !!player?.profile;

                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center overflow-hidden shrink-0">
                        {player?.profile?.avatar_url ? (
                          <img src={player.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          player?.profile?.nombre?.charAt(0) || "+"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {tienePerfil ? `${player.profile.nombre} ${player.profile.apellido || ""}`.trim() : "Cupo Disponible"}
                        </p>
                        {tienePerfil ? (
                          <p className="text-[10px] font-bold text-slate-400">
                            Rating: {player?.padel_profile?.rating ? Number(player.padel_profile.rating).toFixed(2) : "1.50"}
                          </p>
                        ) : (
                          <p className="text-[10px] font-bold text-blue-500">
                            Esperando jugador...
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PAREJA B */}
            <div className={`p-5 rounded-3xl border-2 space-y-4 ${
              match.winner_team === "B" ? "border-amber-400 bg-amber-50/30" : "border-slate-100 bg-slate-50/50"
            }`}>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="font-black text-sm text-slate-900">Pareja B</span>
                {match.winner_team === "B" && <span className="text-xs font-black text-amber-600">👑 Ganadores</span>}
              </div>

              <div className="space-y-3">
                {[0, 1].map((idx) => {
                  const player = parejaB[idx];
                  const tienePerfil = !!player?.profile;

                  return (
                    <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black flex items-center justify-center overflow-hidden shrink-0">
                        {player?.profile?.avatar_url ? (
                          <img src={player.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          player?.profile?.nombre?.charAt(0) || "+"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {tienePerfil ? `${player.profile.nombre} ${player.profile.apellido || ""}`.trim() : "Cupo Disponible"}
                        </p>
                        {tienePerfil ? (
                          <p className="text-[10px] font-bold text-slate-400">
                            Rating: {player?.padel_profile?.rating ? Number(player.padel_profile.rating).toFixed(2) : "1.50"}
                          </p>
                        ) : (
                          <p className="text-[10px] font-bold text-blue-500">
                            Esperando jugador...
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* BOTÓN REGISTRAR RESULTADO (DESHABILITADO HASTA QUE HAYA 4 JUGADORES) */}
          {match.status !== "jugado" && (
            <div className="pt-4 border-t border-slate-100 text-center">
              <button
                onClick={() => partidoLleno && setModalResultadoOpen(true)}
                disabled={!partidoLleno}
                className={`px-6 py-3.5 font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg ${
                  partidoLleno
                    ? "bg-[#0B1120] text-[#00FF9D] hover:bg-slate-900 active:scale-95 cursor-pointer"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                }`}
              >
                {partidoLleno
                  ? "📝 Cargar Resultado y Finalizar"
                  : `⏳ Esperando a 4 jugadores para finalizar (${totalJugadores}/4)`}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* MODAL REGISTRAR MARCADOR */}
      {modalResultadoOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Registrar Marcador</h3>
              <button onClick={() => setModalResultadoOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={finalizarPartido} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-3 gap-3 text-center">
                <span className="text-[10px] uppercase text-slate-400 font-black">Set</span>
                <span className="text-slate-900 font-black">Pareja A</span>
                <span className="text-slate-900 font-black">Pareja B</span>

                {/* Set 1 */}
                <span className="self-center">Set 1</span>
                <input type="number" value={set1A} onChange={(e) => setSet1A(e.target.value)} className="bg-slate-50 border p-2 rounded-xl text-center font-black" />
                <input type="number" value={set1B} onChange={(e) => setSet1B(e.target.value)} className="bg-slate-50 border p-2 rounded-xl text-center font-black" />

                {/* Set 2 */}
                <span className="self-center">Set 2</span>
                <input type="number" value={set2A} onChange={(e) => setSet2A(e.target.value)} className="bg-slate-50 border p-2 rounded-xl text-center font-black" />
                <input type="number" value={set2B} onChange={(e) => setSet2B(e.target.value)} className="bg-slate-50 border p-2 rounded-xl text-center font-black" />

                {/* Set 3 */}
                <span className="self-center">Set 3 (Opc)</span>
                <input type="number" value={set3A} onChange={(e) => setSet3A(e.target.value)} className="bg-slate-50 border p-2 rounded-xl text-center font-black" />
                <input type="number" value={set3B} onChange={(e) => setSet3B(e.target.value)} className="bg-slate-50 border p-2 rounded-xl text-center font-black" />
              </div>

              <button
                type="submit"
                disabled={guardandoScore}
                className="w-full py-3.5 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase rounded-2xl shadow-md transition-all"
              >
                {guardandoScore ? "Guardando..." : "Confirmar Resultado 🏆"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}