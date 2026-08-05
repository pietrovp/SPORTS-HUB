"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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

function categoriaDesdeRating(r) {
  const num = Number(r) || 1.0;
  if (num < 2.0) return "rookies";
  if (num < 3.0) return "7ma";
  if (num < 4.0) return "6ta";
  if (num < 4.8) return "5ta";
  if (num < 5.5) return "4ta";
  if (num < 6.2) return "3era";
  if (num < 7.0) return "2da";
  return "open";
}

function validarSet(gA, gB, tbA = 0, tbB = 0) {
  const a = parseInt(gA, 10);
  const b = parseInt(gB, 10);
  const tA = parseInt(tbA, 10) || 0;
  const tB = parseInt(tbB, 10) || 0;

  if (isNaN(a) || isNaN(b)) return { valido: false, msg: "Ingresa los juegos de ambos equipos" };

  if ((a === 6 && b <= 4) || (b === 6 && a <= 4)) {
    return { valido: true, ganador: a > b ? "A" : "B" };
  }

  if ((a === 7 && b === 5) || (b === 7 && a === 5)) {
    return { valido: true, ganador: a > b ? "A" : "B" };
  }

  if ((a === 7 && b === 6) || (b === 7 && a === 6)) {
    const ganadorEsperado = a === 7 ? "A" : "B";
    const maxTb = Math.max(tA, tB);
    const diffTb = Math.abs(tA - tB);

    if (maxTb < 7) return { valido: false, msg: "El Tie-break requiere al menos 7 puntos" };
    if (diffTb < 2) return { valido: false, msg: "El Tie-break requiere diferencia mínima de 2 puntos" };
    if ((ganadorEsperado === "A" && tA <= tB) || (ganadorEsperado === "B" && tB <= tA)) {
      return { valido: false, msg: `El ganador de 7 juegos (${ganadorEsperado}) debe ganar el Tie-break` };
    }

    return { valido: true, ganador: ganadorEsperado, esTiebreak: true };
  }

  return { valido: false, msg: "Set inválido. Ejemplos válidos: 6-4, 7-5 o 7-6" };
}

// 🧠 ALGORITMO MODO "MARATÓN": CONSTANCIA A LARGO PLAZO
function calcularAjusteRatingDinámico({
  ratingJugador,
  ratingCompanero,
  ratingRival1,
  ratingRival2,
  esGanador,
  diffGamesTotal,
  fiabilidadActual
}) {
  const miParejaRating = (ratingJugador + ratingCompanero) / 2;
  const rivalesRating = (ratingRival1 + ratingRival2) / 2;

  const diffNivel = rivalesRating - miParejaRating;
  const probGanarMiPareja = 1 / (1 + Math.pow(10, diffNivel / 1.5)); 

  let kFactor = 0.08;
  
  if (fiabilidadActual < 30) {
    kFactor = 0.25;
  } else if (fiabilidadActual < 60) {
    kFactor = 0.15;
  }

  let factorDominancia = 1.0;
  if (diffGamesTotal >= 10) {
    factorDominancia = 1.25;
  } else if (diffGamesTotal >= 6) {
    factorDominancia = 1.10;
  } else if (diffGamesTotal <= 2) {
    factorDominancia = 0.85;
  }

  if (esGanador && probGanarMiPareja > 0.75) {
    factorDominancia = 1.0; 
  }

  const resultadoReal = esGanador ? 1 : 0;
  let cambioNeto = kFactor * (resultadoReal - probGanarMiPareja) * factorDominancia;

  if (esGanador) {
    cambioNeto = Math.max(0.01, cambioNeto);
    cambioNeto = Math.min(0.18, cambioNeto);
  } else {
    cambioNeto = Math.min(-0.01, cambioNeto);
    cambioNeto = Math.max(-0.18, cambioNeto);
  }

  return parseFloat(cambioNeto.toFixed(2));
}

export default function PartidoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id;

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [user, setUser] = useState(null);

  const [notificacion, setNotificacion] = useState(null);
  const [modalCancelOpen, setModalCancelOpen] = useState(false);

  // Estados Marcador
  const [modalResultadoOpen, setModalResultadoOpen] = useState(false);
  const [set1A, setSet1A] = useState(6);
  const [set1B, setSet1B] = useState(4);
  const [tb1A, setTb1A] = useState(0);
  const [tb1B, setTb1B] = useState(0);

  const [set2A, setSet2A] = useState(6);
  const [set2B, setSet2B] = useState(3);
  const [tb2A, setTb2A] = useState(0);
  const [tb2B, setTb2B] = useState(0);

  const [usarSet3, setUsarSet3] = useState(false);
  const [set3A, setSet3A] = useState(6);
  const [set3B, setSet3B] = useState(4);
  const [tb3A, setTb3A] = useState(0);
  const [tb3B, setTb3B] = useState(0);

  const [procesandoScore, setProcesandoScore] = useState(false);

  // 📝 Estados para la Encuesta de Nivel Post-Partido
  const [evaluaciones, setEvaluaciones] = useState({});
  const [encuestaEnviada, setEncuestaEnviada] = useState(false);
  const [enviandoEncuesta, setEnviandoEncuesta] = useState(false);

  useEffect(() => {
    if (matchId) cargarDetallePartido();
  }, [matchId]);

  function mostrarNotificacion(tipo, titulo, mensaje) {
    setNotificacion({ tipo, titulo, mensaje });
  }

  async function cargarDetallePartido() {
    try {
      setLoading(true);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      const { data: matchData, error: matchError } = await supabase
        .from("padel_matches")
        .select(`
          id, match_type, is_private, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player, total_price, created_by, winner_team,
          score_proposed, score_submitted_by, score_status, score_confirmations, score_text,
          club:padel_clubs ( name, city, address ),
          court:padel_courts ( name )
        `)
        .eq("id", matchId)
        .maybeSingle();

      if (matchError || !matchData) {
        setMatch(null);
        return;
      }

      // 🛑 AQUÍ SE AÑADIÓ "has_evaluated" AL SELECT
      const { data: rawPlayers } = await supabase
        .from("padel_match_players")
        .select("id, user_id, team, has_evaluated")
        .eq("match_id", matchId);

      const userIds = (rawPlayers || []).map((p) => p.user_id).filter(Boolean);

      let profilesMap = {};
      let padelProfilesMap = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nombre, apellido, avatar_url")
          .in("id", userIds);

        (profilesData || []).forEach((prof) => {
          profilesMap[prof.id] = prof;
        });

        const { data: padelProfilesData } = await supabase
          .from("padel_profiles")
          .select("cuenta_id, rating, fiabilidad, victorias, derrotas, categoria_oficial")
          .in("cuenta_id", userIds);

        (padelProfilesData || []).forEach((pp) => {
          padelProfilesMap[pp.cuenta_id] = pp;
        });
      }

      const playersFormatted = (rawPlayers || []).map((p) => ({
        ...p,
        profile: profilesMap[p.user_id] || null,
        padel_profile: padelProfilesMap[p.user_id] || null,
      }));

      setMatch({
        ...matchData,
        players: playersFormatted,
      });

      // Validar si el usuario actual ya había enviado la encuesta según la Base de Datos
      if (authUser) {
        const miJugadorDb = playersFormatted.find((p) => p.user_id === authUser.id);
        
        if (miJugadorDb?.has_evaluated) {
          setEncuestaEnviada(true);
        } else {
          // Si no la ha enviado, inicializamos respuestas por defecto ("adecuado")
          const otros = playersFormatted.filter((p) => p.user_id !== authUser.id && p.user_id);
          const inicial = {};
          otros.forEach((p) => {
            inicial[p.user_id] = "adecuado";
          });
          setEvaluaciones(inicial);
        }
      }

    } catch (err) {
      console.error(err);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }

  // 📝 ENVIAR ENCUESTA DE NIVEL DE JUGADORES
  async function enviarEncuestaNivel() {
    if (!user || !match) return;

    try {
      setEnviandoEncuesta(true);

      for (const [targetUserId, opinion] of Object.entries(evaluaciones)) {
        const targetPlayer = match.players?.find((p) => p.user_id === targetUserId);
        if (!targetPlayer) continue;

        const pProf = targetPlayer.padel_profile;
        let fiabilidadActual = Number(pProf?.fiabilidad) || 20;
        let ratingActual = Number(pProf?.rating) || 1.50;

        if (opinion === "adecuado") {
          // Aumenta la fiabilidad por confirmación de la comunidad (+2%)
          fiabilidadActual = Math.min(100, fiabilidadActual + 2);
        } else if (opinion === "mas_nivel") {
          // Ligero ajuste de aceleración de rating
          ratingActual = Math.min(7.0, parseFloat((ratingActual + 0.04).toFixed(2)));
          fiabilidadActual = Math.min(100, fiabilidadActual + 1);
        } else if (opinion === "menor_nivel") {
          // Ligero ajuste a la baja
          ratingActual = Math.max(1.0, parseFloat((ratingActual - 0.04).toFixed(2)));
          fiabilidadActual = Math.min(100, fiabilidadActual + 1);
        }

        const nuevaCat = categoriaDesdeRating(ratingActual);

        await supabase
          .from("padel_profiles")
          .update({
            fiabilidad: fiabilidadActual,
            rating: ratingActual,
            categoria_oficial: nuevaCat,
          })
          .eq("cuenta_id", targetUserId);
      }

      // 🛑 AQUÍ MARCAMOS EN LA BD QUE ESTE USUARIO YA LLENÓ SU ENCUESTA PARA ESTE PARTIDO
      await supabase
        .from("padel_match_players")
        .update({ has_evaluated: true })
        .eq("match_id", match.id)
        .eq("user_id", user.id);

      // Recompensa al usuario que respondió la encuesta (+2% de fiabilidad en su perfil)
      const { data: miPProf } = await supabase
        .from("padel_profiles")
        .select("fiabilidad")
        .eq("cuenta_id", user.id)
        .maybeSingle();

      if (miPProf) {
        await supabase
          .from("padel_profiles")
          .update({ fiabilidad: Math.min(100, (miPProf.fiabilidad || 20) + 2) })
          .eq("cuenta_id", user.id);
      }

      setEncuestaEnviada(true);
      mostrarNotificacion("exito", "¡Gracias por evaluar!", "Tus respuestas ayudan a mantener la precisión y fiabilidad del Ranking.");
    } catch (err) {
      console.error("Error guardando encuesta:", err);
      mostrarNotificacion("error", "Error", "No se pudieron guardar las evaluaciones.");
    } finally {
      setEnviandoEncuesta(false);
    }
  }

  async function enviarPropuestaResultado(e) {
    e.preventDefault();
    if (!match || !user) return;

    // Validación de seguridad adicional
    if (match.created_by !== user.id) {
      return mostrarNotificacion("error", "Sin Permisos", "Solo el organizador del partido puede proponer el marcador.");
    }

    const val1 = validarSet(set1A, set1B, tb1A, tb1B);
    if (!val1.valido) return mostrarNotificacion("error", "Error en Set 1", val1.msg);

    const val2 = validarSet(set2A, set2B, tb2A, tb2B);
    if (!val2.valido) return mostrarNotificacion("error", "Error en Set 2", val2.msg);

    let setsGanadosA = (val1.ganador === "A" ? 1 : 0) + (val2.ganador === "A" ? 1 : 0);
    let setsGanadosB = (val1.ganador === "B" ? 1 : 0) + (val2.ganador === "B" ? 1 : 0);

    let val3 = null;
    if (setsGanadosA === 1 && setsGanadosB === 1) {
      if (!usarSet3) {
        return mostrarNotificacion("advertencia", "Tercer Set Requerido", "El partido está empatado 1-1 en sets. Debes activar el 3er Set.");
      }
      val3 = validarSet(set3A, set3B, tb3A, tb3B);
      if (!val3.valido) return mostrarNotificacion("error", "Error en Set 3", val3.msg);
      if (val3.ganador === "A") setsGanadosA++; else setsGanadosB++;
    }

    const ganadorFinal = setsGanadosA > setsGanadosB ? "A" : "B";

    const totalJuegosA = Number(set1A) + Number(set2A) + (val3 ? Number(set3A) : 0);
    const totalJuegosB = Number(set1B) + Number(set2B) + (val3 ? Number(set3B) : 0);
    const diffGamesTotal = Math.abs(totalJuegosA - totalJuegosB);

    const str1 = `${set1A}-${set1B}${val1.esTiebreak ? `(${Math.min(tb1A, tb1B)})` : ""}`;
    const str2 = `${set2A}-${set2B}${val2.esTiebreak ? `(${Math.min(tb2A, tb2B)})` : ""}`;
    const str3 = val3 ? `, ${set3A}-${set3B}${val3.esTiebreak ? `(${Math.min(tb3A, tb3B)})` : ""}` : "";
    const marcadorTexto = `${str1}, ${str2}${str3}`;

    const propuestaData = {
      winner: ganadorFinal,
      scoreText: marcadorTexto,
      diffGamesTotal,
      sets: [
        { a: set1A, b: set1B, tbA: tb1A, tbB: tb1B },
        { a: set2A, b: set2B, tbA: tb2A, tbB: tb2B },
        ...(val3 ? [{ a: set3A, b: set3B, tbA: tb3A, tbB: tb3B }] : []),
      ]
    };

    try {
      setProcesandoScore(true);

      const { error } = await supabase
        .from("padel_matches")
        .update({
          score_proposed: propuestaData,
          score_submitted_by: user.id,
          score_status: "propuesto",
          score_confirmations: [user.id],
          score_text: marcadorTexto,
        })
        .eq("id", match.id);

      if (error) throw error;

      setModalResultadoOpen(false);
      await cargarDetallePartido();
      mostrarNotificacion("exito", "Marcador Propuesto", "Resultado enviado. Esperando la confirmación de la pareja rival.");
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error de Envío", "No se pudo proponer el marcador.");
    } finally {
      setProcesandoScore(false);
    }
  }

  async function responderPropuesta(aprobar) {
    if (!match || !user) return;

    try {
      setProcesandoScore(true);

      if (!aprobar) {
        await supabase
          .from("padel_matches")
          .update({
            score_proposed: null,
            score_submitted_by: null,
            score_status: "impugnado",
            score_confirmations: [],
          })
          .eq("id", match.id);

        await cargarDetallePartido();
        mostrarNotificacion("info", "Marcador Rechazado", "Has rechazado el marcador propuesto. Se habilitó nuevamente la carga.");
        return;
      }

      const propuesta = match.score_proposed;
      const ganador = propuesta.winner;
      const diffGamesTotal = propuesta.diffGamesTotal || 4;

      const { error: matchErr } = await supabase
        .from("padel_matches")
        .update({
          status: "jugado",
          winner_team: ganador,
          score_status: "confirmado",
          score_confirmations: [...(match.score_confirmations || []), user.id],
        })
        .eq("id", match.id);

      if (matchErr) throw matchErr;

      if (match.is_competitive) {
        const parejaA = match.players?.filter((p) => p.team === "A") || [];
        const parejaB = match.players?.filter((p) => p.team === "B") || [];

        const rA1 = Number(parejaA[0]?.padel_profile?.rating) || 1.50;
        const rA2 = Number(parejaA[1]?.padel_profile?.rating) || 1.50;
        const rB1 = Number(parejaB[0]?.padel_profile?.rating) || 1.50;
        const rB2 = Number(parejaB[1]?.padel_profile?.rating) || 1.50;

        for (const player of match.players || []) {
          const esParejaA = player.team === "A";
          const esGanador = player.team === ganador;

          const ratingSelf = Number(player.padel_profile?.rating) || 1.50;

          let ratingPartner = 1.50;
          if (esParejaA) {
            const comp = parejaA.find((p) => p.user_id !== player.user_id);
            ratingPartner = Number(comp?.padel_profile?.rating) || rA1;
          } else {
            const comp = parejaB.find((p) => p.user_id !== player.user_id);
            ratingPartner = Number(comp?.padel_profile?.rating) || rB1;
          }

          const ratingRiv1 = esParejaA ? rB1 : rA1;
          const ratingRiv2 = esParejaA ? rB2 : rA2;

          const fiabilidadActual = Number(player.padel_profile?.fiabilidad) || 20;

          const delta = calcularAjusteRatingDinámico({
            ratingJugador: ratingSelf,
            ratingCompanero: ratingPartner,
            ratingRival1: ratingRiv1,
            ratingRival2: ratingRiv2,
            esGanador,
            diffGamesTotal,
            fiabilidadActual,
          });

          const nuevoRating = Math.max(1.0, parseFloat((ratingSelf + delta).toFixed(2)));
          const nuevaCat = categoriaDesdeRating(nuevoRating);

          const nuevaFiabilidad = Math.min(100, fiabilidadActual + 3); 
          const nVics = (player.padel_profile?.victorias || 0) + (esGanador ? 1 : 0);
          const nDerr = (player.padel_profile?.derrotas || 0) + (esGanador ? 0 : 1);

          await supabase
            .from("padel_profiles")
            .update({
              rating: nuevoRating,
              categoria_oficial: nuevaCat,
              fiabilidad: nuevaFiabilidad,
              victorias: nVics,
              derrotas: nDerr,
            })
            .eq("cuenta_id", player.user_id);

          await supabase
            .from("padel_match_players")
            .update({ rating_change: delta })
            .eq("match_id", match.id)
            .eq("user_id", player.user_id);
        }
      }

      await cargarDetallePartido();
      mostrarNotificacion("exito", "¡Partido Finalizado!", `Marcador aprobado. Los niveles han sido ajustados.`);
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error de Procesamiento", "No se pudo procesar la respuesta.");
    } finally {
      setProcesandoScore(false);
    }
  }

  async function confirmarCancelacionVista() {
    if (!user || !match) return;

    try {
      setProcesandoScore(true);

      const matchTime = new Date(match.scheduled_at).getTime();
      const nowTime = new Date().getTime();
      const diffHoras = (matchTime - nowTime) / (1000 * 60 * 60);
      const esReembolsable = diffHoras > 10;

      const soyCreador = match.created_by === user.id;
      const esPrivado = match.is_private || match.match_type === "privado";
      const costoIndividual = match.price_per_player || 4;
      const costoTotalCancha = match.total_price || 16;

      if (soyCreador || esPrivado) {
        await supabase.from("padel_matches").update({ status: "cancelado" }).eq("id", match.id);

        if (esReembolsable) {
          for (const p of match.players || []) {
            if (!p.user_id) continue;
            const montoDevolver = esPrivado && p.user_id === user.id ? costoTotalCancha : costoIndividual;

            const { data: pProfile } = await supabase.from("profiles").select("creditos").eq("id", p.user_id).maybeSingle();
            const nuevoSaldo = (pProfile?.creditos || 0) + montoDevolver;

            await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", p.user_id);
            await supabase.from("credit_ledger").insert({
              user_id: p.user_id,
              match_id: match.id,
              delta: montoDevolver,
              reason: "reembolso_cancelacion_partido_padel",
              balance_after: nuevoSaldo,
            });
          }
        }
      } else {
        await supabase.from("padel_match_players").delete().eq("match_id", match.id).eq("user_id", user.id);

        if (esReembolsable) {
          const { data: prof } = await supabase.from("profiles").select("creditos").eq("id", user.id).maybeSingle();
          const nuevoSaldo = (prof?.creditos || 0) + costoIndividual;

          await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", user.id);
          await supabase.from("credit_ledger").insert({
            user_id: user.id,
            match_id: match.id,
            delta: costoIndividual,
            reason: "reembolso_salida_partido_padel",
            balance_after: nuevoSaldo,
          });
        }
      }

      router.push("/padel/partidos");
    } catch (e) {
      console.error(e);
      alert("No se pudo cancelar la reserva.");
    } finally {
      setProcesandoScore(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match || match.status === "cancelado") {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center space-y-4">
        <span className="text-4xl">🚫</span>
        <h2 className="text-xl font-black text-slate-800">Partido Cancelado o No Encontrado</h2>
        <Link href="/padel/partidos" className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black uppercase rounded-2xl">
          ← Volver a Partidos
        </Link>
      </div>
    );
  }

  const parejaA = match.players?.filter((p) => p.team === "A") || [];
  const parejaB = match.players?.filter((p) => p.team === "B") || [];
  const totalJugadores = match.players?.length || 0;
  const partidoLleno = totalJugadores >= 4;

  const miJugador = match.players?.find((p) => p.user_id === user?.id);
  const soyDeParejaA = miJugador?.team === "A";
  const soyDeParejaB = miJugador?.team === "B";
  const soyCreadorVista = match.created_by === user?.id;

  const otrosJugadores = match.players?.filter((p) => p.user_id !== user?.id && p.user_id) || [];

  const matchTimeVista = new Date(match.scheduled_at).getTime();
  const nowTimeVista = new Date().getTime();
  const horasFaltantesVista = (matchTimeVista - nowTimeVista) / (1000 * 60 * 60);
  const esReembolsableVista = horasFaltantesVista > 10;

  const propuestoPorMiEquipo =
    (soyDeParejaA && match.players?.find((p) => p.user_id === match.score_submitted_by)?.team === "A") ||
    (soyDeParejaB && match.players?.find((p) => p.user_id === match.score_submitted_by)?.team === "B");

  const v1 = validarSet(set1A, set1B, tb1A, tb1B);
  const v2 = validarSet(set2A, set2B, tb2A, tb2B);
  const v3 = usarSet3 ? validarSet(set3A, set3B, tb3A, tb3B) : { valido: true };

  const creadorObj = match.players?.find((p) => p.user_id === match.created_by);
  const nombreCreador = creadorObj?.profile?.nombre || "Organizador";

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 relative">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER DEL DETALLE */}
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
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-1">
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block">
                🏆 Partido Finalizado Oficialmente — Ganador: Pareja {match.winner_team}
              </span>
              <p className="text-sm font-black text-emerald-950">
                Marcador: {match.score_text}
              </p>
            </div>
          )}
        </div>

        {/* ALERTA / BANNER SI HAY PROPUESTA PENDIENTE */}
        {match.status !== "jugado" && match.score_status === "propuesto" && (
          <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-3xl shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-200/80 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  ⏳ Marcador Propuesto - Aprobación Pendiente
                </span>
                <p className="text-lg font-black text-amber-950 mt-0.5">
                  Marcador: <strong className="text-blue-700">{match.score_text}</strong>
                </p>
              </div>
              <span className="bg-amber-200/80 text-amber-900 text-xs font-black px-3 py-1 rounded-full">
                Ganador: Pareja {match.score_proposed?.winner}
              </span>
            </div>

            {propuestoPorMiEquipo ? (
              <p className="text-xs font-bold text-amber-800">
                📩 Tu pareja/equipo envió este resultado. Esperando que la pareja rival confirme para oficializar el partido.
              </p>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-amber-900">
                  La pareja rival ha cargado el resultado. ¿Estás de acuerdo con el marcador?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => responderPropuesta(true)}
                    disabled={procesandoScore}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all active:scale-95"
                  >
                    ✅ Aprobar y Confirmar
                  </button>
                  <button
                    onClick={() => responderPropuesta(false)}
                    disabled={procesandoScore}
                    className="px-5 py-3 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-95"
                  >
                    ❌ Rechazar / Impugnar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ALINEACIÓN DE PISTA */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-center text-xs font-black uppercase tracking-widest text-slate-400">
            Alineación de Pista
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
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
                          <p className="text-[10px] font-bold text-blue-500">Esperando jugador...</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
                          <p className="text-[10px] font-bold text-blue-500">Esperando jugador...</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ACCIONES DE BOTÓN DE CARGA DE MARCADOR */}
          {match.status !== "jugado" && match.score_status !== "propuesto" && (
            <div className="pt-4 border-t border-slate-100 text-center space-y-3">
              {soyCreadorVista ? (
                /* SOLO EL CREADOR PUEDE CARGAR EL MARCADOR */
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
                    ? "📝 Cargar Resultado del Partido"
                    : `⏳ Esperando a 4 jugadores para finalizar (${totalJugadores}/4)`}
                </button>
              ) : (
                /* MENSAJE PARA LOS OTROS TRES JUGADORES */
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-xs font-bold text-slate-600 max-w-md mx-auto">
                  📌 Solo el organizador del partido (<strong className="text-slate-900">{nombreCreador}</strong>) tiene permisos para cargar el marcador inicial. Una vez enviado, podrás confirmarlo aquí.
                </div>
              )}

              {/* BOTÓN DISCRETO DE CANCELAR */}
              {(miJugador || soyCreadorVista) && match.status === "programado" && (
                <div>
                  <button
                    onClick={() => setModalCancelOpen(true)}
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline transition-colors py-1 px-3"
                  >
                    🚫 Cancelar mi reserva de este partido
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 📊 SECCIÓN: ENCUESTA DE EVALUACIÓN DE NIVEL (SÓLO SI EL PARTIDO YA SE JUGÓ) */}
        {match.status === "jugado" && miJugador && otrosJugadores.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">
                Comunidad & Fiabilidad
              </span>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                <span>🎯</span> Evaluemos el Nivel Real del Partido
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                ¿Qué tal jugaron tus compañeros y rivales? Tu opinión ajusta la fiabilidad de sus perfiles y recalibra las categorías oficiales.
              </p>
            </div>

            {encuestaEnviada ? (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center space-y-1">
                <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block">
                  🎉 ¡Evaluación Registrada con Éxito!
                </span>
                <p className="text-xs font-bold text-emerald-900">
                  Ganaste <strong className="text-emerald-950">+2% de Fiabilidad</strong> por contribuir a la comunidad.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="space-y-3">
                  {otrosJugadores.map((p) => {
                    const nombreStr = p.profile ? `${p.profile.nombre} ${p.profile.apellido || ""}`.trim() : "Jugador";
                    const actualRating = p.padel_profile?.rating ? Number(p.padel_profile.rating).toFixed(2) : "1.50";
                    const actualOpinion = evaluaciones[p.user_id] || "adecuado";

                    return (
                      <div key={p.user_id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-black flex items-center justify-center overflow-hidden shrink-0 text-xs">
                            {p.profile?.avatar_url ? (
                              <img src={p.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              nombreStr.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900">{nombreStr}</p>
                            <span className="text-[10px] font-bold text-slate-400">
                              Nivel registrado: {actualRating}
                            </span>
                          </div>
                        </div>

                        {/* SELECTOR DE NIVEL */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setEvaluaciones({ ...evaluaciones, [p.user_id]: "menor_nivel" })}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                              actualOpinion === "menor_nivel"
                                ? "bg-rose-600 text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            📉 Menor
                          </button>

                          <button
                            type="button"
                            onClick={() => setEvaluaciones({ ...evaluaciones, [p.user_id]: "adecuado" })}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                              actualOpinion === "adecuado"
                                ? "bg-emerald-600 text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            🟢 Adecuado
                          </button>

                          <button
                            type="button"
                            onClick={() => setEvaluaciones({ ...evaluaciones, [p.user_id]: "mas_nivel" })}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                              actualOpinion === "mas_nivel"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            ⚡ Mayor
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={enviarEncuestaNivel}
                  disabled={enviandoEncuesta}
                  className="w-full py-3.5 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {enviandoEncuesta ? "ENVIANDO EVALUACIONES..." : "ENVIAR EVALUACIÓN DE JUGADORES →"}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL MARCADOR */}
      {modalResultadoOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 my-6">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">Registrar Marcador</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">Reglamento oficial de sets de Pádel</p>
              </div>
              <button onClick={() => setModalResultadoOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center">
                ✕
              </button>
            </div>

            <form onSubmit={enviarPropuestaResultado} className="space-y-5 text-xs font-bold">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-900 uppercase">Set 1</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${v1.valido ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {v1.valido ? `Válido (Gana Pareja ${v1.ganador})` : "Marcador incompleto"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Juegos Pareja A</label>
                    <select value={set1A} onChange={(e) => setSet1A(Number(e.target.value))} className="w-full bg-white border p-2 rounded-xl text-center font-black text-sm">
                      {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} juegos</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Juegos Pareja B</label>
                    <select value={set1B} onChange={(e) => setSet1B(Number(e.target.value))} className="w-full bg-white border p-2 rounded-xl text-center font-black text-sm">
                      {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} juegos</option>)}
                    </select>
                  </div>
                </div>

                {((set1A === 7 && set1B === 6) || (set1A === 6 && set1B === 7)) && (
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3 bg-amber-50/60 p-2.5 rounded-xl">
                    <div>
                      <label className="text-[9px] font-black text-amber-800 block mb-1">Tie-Break Pts A</label>
                      <input type="number" min="0" value={tb1A} onChange={(e) => setTb1A(Number(e.target.value))} className="w-full bg-white border border-amber-300 p-1.5 rounded-lg text-center font-black" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-amber-800 block mb-1">Tie-Break Pts B</label>
                      <input type="number" min="0" value={tb1B} onChange={(e) => setTb1B(Number(e.target.value))} className="w-full bg-white border border-amber-300 p-1.5 rounded-lg text-center font-black" />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-900 uppercase">Set 2</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${v2.valido ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {v2.valido ? `Válido (Gana Pareja ${v2.ganador})` : "Marcador incompleto"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Juegos Pareja A</label>
                    <select value={set2A} onChange={(e) => setSet2A(Number(e.target.value))} className="w-full bg-white border p-2 rounded-xl text-center font-black text-sm">
                      {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} juegos</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Juegos Pareja B</label>
                    <select value={set2B} onChange={(e) => setSet2B(Number(e.target.value))} className="w-full bg-white border p-2 rounded-xl text-center font-black text-sm">
                      {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} juegos</option>)}
                    </select>
                  </div>
                </div>

                {((set2A === 7 && set2B === 6) || (set2A === 6 && set2B === 7)) && (
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3 bg-amber-50/60 p-2.5 rounded-xl">
                    <div>
                      <label className="text-[9px] font-black text-amber-800 block mb-1">Tie-Break Pts A</label>
                      <input type="number" min="0" value={tb2A} onChange={(e) => setTb2A(Number(e.target.value))} className="w-full bg-white border border-amber-300 p-1.5 rounded-lg text-center font-black" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-amber-800 block mb-1">Tie-Break Pts B</label>
                      <input type="number" min="0" value={tb2B} onChange={(e) => setTb2B(Number(e.target.value))} className="w-full bg-white border border-amber-300 p-1.5 rounded-lg text-center font-black" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-blue-50/60 p-3 rounded-2xl border border-blue-100">
                <span className="text-xs font-bold text-blue-900">¿Jugaron 3er Set (Desempate)?</span>
                <button
                  type="button"
                  onClick={() => setUsarSet3(!usarSet3)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${usarSet3 ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}
                >
                  {usarSet3 ? "Sí (Set 3 Activado)" : "+ Agregar Set 3"}
                </button>
              </div>

              {usarSet3 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-900 uppercase">Set 3</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${v3.valido ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {v3.valido ? `Válido (Gana Pareja ${v3.ganador})` : "Marcador incompleto"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Juegos Pareja A</label>
                      <select value={set3A} onChange={(e) => setSet3A(Number(e.target.value))} className="w-full bg-white border p-2 rounded-xl text-center font-black text-sm">
                        {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} juegos</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Juegos Pareja B</label>
                      <select value={set3B} onChange={(e) => setSet3B(Number(e.target.value))} className="w-full bg-white border p-2 rounded-xl text-center font-black text-sm">
                        {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} juegos</option>)}
                      </select>
                    </div>
                  </div>

                  {((set3A === 7 && set3B === 6) || (set3A === 6 && set3B === 7)) && (
                    <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3 bg-amber-50/60 p-2.5 rounded-xl">
                      <div>
                        <label className="text-[9px] font-black text-amber-800 block mb-1">Tie-Break Pts A</label>
                        <input type="number" min="0" value={tb3A} onChange={(e) => setTb3A(Number(e.target.value))} className="w-full bg-white border border-amber-300 p-1.5 rounded-lg text-center font-black" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-amber-800 block mb-1">Tie-Break Pts B</label>
                        <input type="number" min="0" value={tb3B} onChange={(e) => setTb3B(Number(e.target.value))} className="w-full bg-white border border-amber-300 p-1.5 rounded-lg text-center font-black" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={procesandoScore || !v1.valido || !v2.valido || !v3.valido}
                className="w-full py-4 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl disabled:opacity-50 transition-all active:scale-95"
              >
                {procesandoScore ? "ENVIANDO..." : "PROPONER MARCADOR AL RIVAL →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR EN DETALLE */}
      {modalCancelOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalCancelOpen(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                {soyCreadorVista ? "¿Cancelar Partido Completo?" : "¿Salir del Partido?"}
              </h3>
              <p className="text-xs text-slate-500 font-bold">
                {formatFechaLarga(match.scheduled_at)}
              </p>
            </div>

            <div className={`p-3.5 rounded-2xl text-xs font-bold text-left space-y-1 ${
              esReembolsableVista ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider">Política de Cancelación</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${esReembolsableVista ? "bg-emerald-200 text-emerald-950" : "bg-amber-200 text-amber-950"}`}>
                  Faltan {horasFaltantesVista.toFixed(1)}h
                </span>
              </div>

              {esReembolsableVista ? (
                <p className="normal-case text-[11px]">
                  ✅ <strong>Faltan más de 10 horas.</strong> Tus créditos invertidos serán devueltos a tu saldo inmediatamente.
                </p>
              ) : (
                <p className="normal-case text-[11px]">
                  ⚠️ <strong>Faltan menos de 10 horas.</strong> La reserva se cancelará pero <u>tus créditos no serán reembolsados</u>.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalCancelOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-2xl"
              >
                Volver
              </button>
              <button
                onClick={confirmarCancelacionVista}
                disabled={procesandoScore}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase rounded-2xl shadow-md"
              >
                {procesandoScore ? "Procesando..." : "Sí, Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notificacion && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl bg-blue-100 text-blue-600">
              {notificacion.tipo === "exito" ? "🎉" : notificacion.tipo === "error" ? "⚠️" : "ℹ️"}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{notificacion.titulo}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">{notificacion.mensaje}</p>
            </div>
            <button
              onClick={() => setNotificacion(null)}
              className="w-full py-3.5 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase rounded-2xl"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}