"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const CATEGORIAS_ORDEN = ["rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "open"];

function formatFechaLarga(fechaStr) {
  if (!fechaStr) return "";
  const d = parsearFechaVET(fechaStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 🇻🇪 HUSO HORARIO VENEZUELA (UTC-4)
function parsearFechaVET(fechaStr) {
  if (!fechaStr) return new Date();
  const cleanStr = fechaStr.replace(" ", "T").substring(0, 19);
  const isoVET = `${cleanStr.endsWith("Z") ? cleanStr.slice(0, -1) : cleanStr}-04:00`;
  return new Date(isoVET);
}

function calcularHorasFaltantesVET(scheduledAtStr) {
  if (!scheduledAtStr) return 0;
  const fechaPartido = parsearFechaVET(scheduledAtStr);
  const ahora = new Date();
  return (fechaPartido.getTime() - ahora.getTime()) / (1000 * 60 * 60);
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

function validarCompatibilidadCategorias(jugadores) {
  if (!jugadores || jugadores.length === 0) return false;
  
  const indices = jugadores
    .map((j) => {
      const cat = j.padel_profile?.categoria_oficial || categoriaDesdeRating(j.padel_profile?.rating);
      return CATEGORIAS_ORDEN.indexOf(cat);
    })
    .filter((idx) => idx !== -1);

  if (indices.length < jugadores.length) return false;

  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);

  return (maxIdx - minIdx) <= 1;
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

    return { valido: true, ganador: ganadorEsperado, esTiebreak: true };
  }

  return { valido: false, msg: "Set inválido. Ejemplos válidos: 6-4, 7-5 o 7-6" };
}

function calcularAjusteRatingSet({ ratingA1, ratingA2, ratingB1, ratingB2, juegosA, juegosB, fiabilidadJugador }) {
  const ratingEquipoA = (ratingA1 + ratingA2) / 2;
  const ratingEquipoB = (ratingB1 + ratingB2) / 2;

  const diffNivel = ratingEquipoB - ratingEquipoA;
  const probGanarA = 1 / (1 + Math.pow(10, diffNivel / 1.5));

  let kFactor = 0.08;
  if (fiabilidadJugador < 30) kFactor = 0.20;
  else if (fiabilidadJugador < 60) kFactor = 0.12;

  const esGanadorA = juegosA > juegosB;
  const resultadoRealA = esGanadorA ? 1 : 0;
  const diffJuegos = Math.abs(juegosA - juegosB);

  let factorDominancia = 1.0;
  if (diffJuegos >= 4) factorDominancia = 1.2;
  if (diffJuegos <= 2) factorDominancia = 0.9;

  let deltaA = kFactor * (resultadoRealA - probGanarA) * factorDominancia;
  let deltaB = -deltaA;

  return {
    deltaA: parseFloat(deltaA.toFixed(3)),
    deltaB: parseFloat(deltaB.toFixed(3)),
  };
}

function renderPaymentStatusBadge(status) {
  const st = (status || "").toString().toLowerCase().trim();

  if (st === "aprobado" || st === "liquidado") {
    return (
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
        ✓ Aprobado
      </span>
    );
  }
  if (st === "rechazado" || st === "cancelado") {
    return (
      <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-1 rounded-lg">
        ✕ Rechazado
      </span>
    );
  }
  if (st === "pago_en_sitio" || st === "pago_sitio") {
    return (
      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-1 rounded-lg animate-pulse">
        💵 Pago en Sitio
      </span>
    );
  }
  return (
    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-1 rounded-lg animate-pulse">
      ⏳ Pendiente
    </span>
  );
}

export default function PartidoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id;

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [user, setUser] = useState(null);
  const [tasaBCV, setTasaBCV] = useState(36.65);

  const [notificacion, setNotificacion] = useState(null);
  const [modalCancelOpen, setModalCancelOpen] = useState(false);
  const [imagenEngrande, setImagenEngrande] = useState(null);

  // DESPLEGABLE DE PAGOS
  const [pagosDesplegados, setPagosDesplegados] = useState(false);

  // MARCADOR EN TIEMPO REAL Y ESTADO DE PARTIDO INICIADO
  const [partidoIniciado, setPartidoIniciado] = useState(false);
  const [liveScore, setLiveScore] = useState({
    setActual: 1,
    puntosA: "0",
    puntosB: "0",
    esTiebreak: false,
    sets: [
      { gA: 0, gB: 0, tbA: 0, tbB: 0 },
      { gA: 0, gB: 0, tbA: 0, tbB: 0 },
      { gA: 0, gB: 0, tbA: 0, tbB: 0 },
    ],
    setsGanadosA: 0,
    setsGanadosB: 0,
    saque: "A",
    partidoTerminado: false,
  });

  // ESTADOS MODO 6 JUGADORES / SETS
  const [modalResultadoOpen, setModalResultadoOpen] = useState(false);
  const [setsRotacion, setSetsRotacion] = useState([
    { pA1: "", pA2: "", pB1: "", pB2: "", gA: 6, gB: 4, tbA: 0, tbB: 0 },
    { pA1: "", pA2: "", pB1: "", pB2: "", gA: 6, gB: 3, tbA: 0, tbB: 0 },
  ]);

  const [procesandoScore, setProcesandoScore] = useState(false);

  // GESTIÓN DE DUPLAS Y BÚSQUEDA DE JUGADORES
  const [modalAgregarJugadorOpen, setModalAgregarJugadorOpen] = useState(false);
  const [equipoObjetivoAdd, setEquipoObjetivoAdd] = useState("A");
  const [mostrarTerceraDupla, setMostrarTerceraDupla] = useState(false);

  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [usuariosEncontrados, setUsuariosEncontrados] = useState([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);
  const [procesandoJugador, setProcesandoJugador] = useState(false);

  // REGISTRO DE PAGOS EXTRAS
  const [formPagoExtra, setFormPagoExtra] = useState({
    monto: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });
  const [enviandoPagoExtra, setEnviandoPagoExtra] = useState(false);

  // EVALUACIÓN DE NIVEL
  const [evaluaciones, setEvaluaciones] = useState({});
  const [encuestaEnviada, setEncuestaEnviada] = useState(false);
  const [enviandoEncuesta, setEnviandoEncuesta] = useState(false);

  useEffect(() => {
    if (!matchId || !supabase) return;

    cargarDetallePartido();
    obtenerTasaBCV();
    suscripcionRealtimeLiveScore();

    const channelMatches = supabase
      .channel(`realtime-match-detail-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        () => cargarDetallePartido()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` },
        () => cargarDetallePartido()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelMatches);
    };
  }, [matchId]);

  function mostrarNotificacion(tipo, titulo, mensaje) {
    setNotificacion({ tipo, titulo, mensaje });
  }

  async function obtenerTasaBCV() {
    try {
      const res = await fetch("/api/bcv-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) setTasaBCV(parseFloat(data.usdRate));
      }
    } catch (e) {
      console.warn("Fallo obteniendo BCV:", e);
    }
  }

  function suscripcionRealtimeLiveScore() {
    const channel = supabase.channel(`match-live-${matchId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "score_update" }, (payload) => {
        if (payload.payload) {
          setLiveScore(payload.payload);
          setPartidoIniciado(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function transmitirLiveScore(nuevoEstado) {
    setLiveScore(nuevoEstado);
    setPartidoIniciado(true);
    const channel = supabase.channel(`match-live-${matchId}`);
    await channel.send({
      type: "broadcast",
      event: "score_update",
      payload: nuevoEstado,
    });
  }

  function sumarPuntoLive(equipo) {
    if (liveScore.partidoTerminado) return;

    let score = JSON.parse(JSON.stringify(liveScore));
    const setIdx = score.setActual - 1;
    let curSet = score.sets[setIdx] || { gA: 0, gB: 0, tbA: 0, tbB: 0 };

    if (score.esTiebreak) {
      if (equipo === "A") curSet.tbA++;
      else curSet.tbB++;

      const totalTb = curSet.tbA + curSet.tbB;
      if (totalTb % 2 === 1) {
        score.saque = score.saque === "A" ? "B" : "A";
      }

      if (curSet.tbA >= 7 && (curSet.tbA - curSet.tbB) >= 2) {
        curSet.gA = 7;
        curSet.gB = 6;
        score.esTiebreak = false;
        score.setsGanadosA++;
        finalizarONuevoSet(score);
      } else if (curSet.tbB >= 7 && (curSet.tbB - curSet.tbA) >= 2) {
        curSet.gB = 7;
        curSet.gA = 6;
        score.esTiebreak = false;
        score.setsGanadosB++;
        finalizarONuevoSet(score);
      }
    } else {
      let pA = score.puntosA;
      let pB = score.puntosB;

      if (equipo === "A") {
        if (pA === "0") pA = "15";
        else if (pA === "15") pA = "30";
        else if (pA === "30") pA = "40";
        else if (pA === "40") {
          if (pB === "40") pA = "VENTAJA";
          else if (pB === "VENTAJA") pB = "40";
          else return ganarJuego(score, "A");
        } else if (pA === "VENTAJA") return ganarJuego(score, "A");
      } else {
        if (pB === "0") pB = "15";
        else if (pB === "15") pB = "30";
        else if (pB === "30") pB = "40";
        else if (pB === "40") {
          if (pA === "40") pB = "VENTAJA";
          else if (pA === "VENTAJA") pA = "40";
          else return ganarJuego(score, "B");
        } else if (pB === "VENTAJA") return ganarJuego(score, "B");
      }

      score.puntosA = pA;
      score.puntosB = pB;
    }

    score.sets[setIdx] = curSet;
    transmitirLiveScore(score);
  }

  function ganarJuego(score, equipo) {
    const setIdx = score.setActual - 1;
    let curSet = score.sets[setIdx];

    if (equipo === "A") curSet.gA++;
    else curSet.gB++;

    score.puntosA = "0";
    score.puntosB = "0";
    score.saque = score.saque === "A" ? "B" : "A";

    const gA = curSet.gA;
    const gB = curSet.gB;

    if (gA === 6 && gB === 6) {
      score.esTiebreak = true;
      curSet.tbA = 0;
      curSet.tbB = 0;
    } else if ((gA >= 6 && (gA - gB) >= 2) || (gA === 7 && gB === 5)) {
      score.setsGanadosA++;
      finalizarONuevoSet(score);
    } else if ((gB >= 6 && (gB - gA) >= 2) || (gB === 7 && gA === 5)) {
      score.setsGanadosB++;
      finalizarONuevoSet(score);
    } else {
      score.sets[setIdx] = curSet;
    }

    transmitirLiveScore(score);
  }

  function finalizarONuevoSet(score) {
    score.puntosA = "0";
    score.puntosB = "0";

    if (score.setsGanadosA === 2 || score.setsGanadosB === 2) {
      score.partidoTerminado = true;
    } else if (score.setActual < 3) {
      score.setActual++;
    }
  }

  async function iniciarPartidoLive() {
    if (!puedeIniciarPartido) {
      return mostrarNotificacion("advertencia", "Cancha no Saldada", "No se puede iniciar el partido hasta que el valor base de la pista esté totalmente abonado y aprobado.");
    }

    try {
      setProcesandoScore(true);
      setPartidoIniciado(true);

      await supabase
        .from("matches")
        .update({ status: "en_progreso" })
        .eq("id", match.id);

      await transmitirLiveScore(liveScore);
      mostrarNotificacion("exito", "¡Partido Iniciado!", "El contador de puntos reglamentario se ha activado.");
    } catch (err) {
      console.error("Error al iniciar partido:", err);
      mostrarNotificacion("error", "Error", "No se pudo iniciar el marcador.");
    } finally {
      setProcesandoScore(false);
    }
  }

  async function cargarDetallePartido() {
    try {
      setLoading(true);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(`
          id, club_id, court_id, match_type, is_private, scheduled_at, status, category_restriction,
          gender_restriction, is_competitive, price_per_player, total_price, app_fee, created_by, winner_team,
          payment_status, payment_method, payment_proof_urls, payments_history, extra_items,
          score_proposed, score_submitted_by, score_status, score_confirmations, score_text,
          club:clubs ( name, city, address ),
          court:courts ( name )
        `)
        .eq("id", matchId)
        .maybeSingle();

      if (matchError || !matchData) {
        setMatch(null);
        return;
      }

      const { data: rawPlayers } = await supabase
        .from("match_players")
        .select("id, user_id, team, has_evaluated")
        .eq("match_id", matchId);

      const userIds = (rawPlayers || []).map((p) => p.user_id).filter(Boolean);

      let profilesMap = {};
      let padelProfilesMap = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nombre, apellido, avatar_url, email, telefono")
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

      if (matchData.status === "en_progreso") {
        setPartidoIniciado(true);
      }

      if (playersFormatted.some((p) => p.team === "C")) {
        setMostrarTerceraDupla(true);
      }

    } catch (err) {
      console.error(err);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }

  function abrirModalAddJugadorSlot(teamLetter) {
    setEquipoObjetivoAdd(teamLetter);
    setBusquedaUsuario("");
    setUsuariosEncontrados([]);
    setModalAgregarJugadorOpen(true);
  }

  async function buscarUsuariosSistema(query) {
    setBusquedaUsuario(query);
    if (!query.trim() || query.trim().length < 2) {
      return setUsuariosEncontrados([]);
    }

    try {
      setBuscandoUsuarios(true);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, telefono, email")
        .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

      if (profs && profs.length > 0) {
        const uIds = profs.map((p) => p.id);
        const { data: padelProfs } = await supabase
          .from("padel_profiles")
          .select("cuenta_id, categoria_oficial, rating")
          .in("cuenta_id", uIds);

        const padelMap = {};
        (padelProfs || []).forEach((pp) => { padelMap[pp.cuenta_id] = pp; });

        const combinados = profs.map((p) => ({
          ...p,
          categoria: padelMap[p.id]?.categoria_oficial || categoriaDesdeRating(padelMap[p.id]?.rating || 1.5)
        }));

        setUsuariosEncontrados(combinados);
      } else {
        setUsuariosEncontrados([]);
      }
    } catch (err) {
      console.error("Error buscando usuarios:", err);
    } finally {
      setBuscandoUsuarios(false);
    }
  }

  async function agregarJugadorAMatch(usuarioId) {
    if (!match) return;
    const jugadoresActuales = match.players || [];
    const limiteTotal = 6;
    
    if (jugadoresActuales.some((p) => p.user_id === usuarioId)) {
      return mostrarNotificacion("advertencia", "Ya Registrado", "Este usuario ya forma parte de esta reserva.");
    }

    if (jugadoresActuales.length >= limiteTotal) {
      return mostrarNotificacion("advertencia", "Límite Alcanzado", `Esta reserva cuenta con el máximo de ${limiteTotal} jugadores.`);
    }

    try {
      setProcesandoJugador(true);
      const { error } = await supabase.from("match_players").insert({
        match_id: match.id,
        user_id: usuarioId,
        team: equipoObjetivoAdd
      });

      if (error) throw error;

      setBusquedaUsuario("");
      setUsuariosEncontrados([]);
      setModalAgregarJugadorOpen(false);
      mostrarNotificacion("exito", "Jugador Agregado", "✅ Jugador añadido a la dupla correctamente.");
      await cargarDetallePartido();
    } catch (err) {
      mostrarNotificacion("error", "Error", "No se pudo agregar al jugador.");
    } finally {
      setProcesandoJugador(false);
    }
  }

  async function removerJugadorDeMatch(matchPlayerId) {
    try {
      setProcesandoJugador(true);
      const { error } = await supabase.from("match_players").delete().eq("id", matchPlayerId);
      if (error) throw error;

      mostrarNotificacion("info", "Jugador Removido", "Se ha quitado al jugador del partido.");
      await cargarDetallePartido();
    } catch (err) {
      mostrarNotificacion("error", "Error", "No se pudo eliminar al jugador.");
    } finally {
      setProcesandoJugador(false);
    }
  }

  async function agregarComprobanteExtraUser() {
    if (!match || !user) return;

    const montoValido = parseFloat(formPagoExtra.monto);
    if (isNaN(montoValido) || montoValido <= 0) {
      return mostrarNotificacion("error", "Monto Inválido", "Por favor ingresa un monto válido.");
    }

    if (formPagoExtra.metodoPago !== "efectivo" && !formPagoExtra.previewComprobante && !formPagoExtra.numReferencia.trim()) {
      return mostrarNotificacion("error", "Falta Comprobante", "Por favor adjunta la captura del comprobante o ingresa la referencia.");
    }

    try {
      setEnviandoPagoExtra(true);

      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", user.id)
        .maybeSingle();

      const nombreUsuarioCompleto = userProf 
        ? `${userProf.nombre} ${userProf.apellido}`.trim() 
        : user.email;

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: user.id,
        user_name: nombreUsuarioCompleto,
        user_phone: userProf?.telefono || "Sin teléfono",
        amount: montoValido,
        method: formPagoExtra.metodoPago,
        reference: formPagoExtra.numReferencia.trim() || "S/R",
        receipt_url: formPagoExtra.previewComprobante || null,
        status: formPagoExtra.metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const historialNuevo = [...historialActual, nuevoAbono];

      const proofUrlsActuales = Array.isArray(match.payment_proof_urls) ? match.payment_proof_urls : [];
      const proofUrlsNuevas = formPagoExtra.previewComprobante 
        ? [...proofUrlsActuales, formPagoExtra.previewComprobante] 
        : proofUrlsActuales;

      const { error: updateErr } = await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_proof_urls: proofUrlsNuevas,
          payment_status: "pendiente_aprobacion",
        })
        .eq("id", match.id);

      if (updateErr) throw updateErr;

      setFormPagoExtra({ monto: "", metodoPago: "pago_movil", numReferencia: "", previewComprobante: "" });
      mostrarNotificacion("exito", "Comprobante Enviado", "✅ ¡Nuevo comprobante adjuntado con éxito! El club lo revisará en recepción.");
      await cargarDetallePartido();
    } catch (err) {
      mostrarNotificacion("error", "Error", "Error al adjuntar el comprobante.");
    } finally {
      setEnviandoPagoExtra(false);
    }
  }

  function handleFinalizarPartidoClick() {
    if (!puedeFinalizarPartido) {
      return mostrarNotificacion(
        "advertencia",
        "Saldos Pendientes por Cobrar",
        `Para dar por terminado el partido, todos los consumos extra y la cancha deben estar 100% pagados ($${restanteGranTotal.toFixed(2)} USD restantes) y aprobados por la recepción del club.`
      );
    }

    if (liveScore.setActual > 1 || liveScore.sets[0].gA > 0 || liveScore.sets[0].gB > 0) {
      const setsCargados = liveScore.sets.slice(0, liveScore.setActual).map((s) => ({
        pA1: "", pA2: "", pB1: "", pB2: "",
        gA: s.gA, gB: s.gB, tbA: s.tbA, tbB: s.tbB
      }));
      if (setsCargados.length > 0) {
        setSetsRotacion(setsCargados);
      }
    }

    setModalResultadoOpen(true);
  }

  async function enviarPropuestaResultado(e) {
    e.preventDefault();
    if (!match || !user) return;

    if (match.created_by !== user.id) {
      return mostrarNotificacion("error", "Sin Permisos", "Solo el organizador del partido puede proponer el marcador.");
    }

    let marcadorTexto = "";
    let setsValidados = [];

    for (let i = 0; i < setsRotacion.length; i++) {
      const s = setsRotacion[i];
      const val = validarSet(s.gA, s.gB, s.tbA, s.tbB);
      if (!val.valido) {
        return mostrarNotificacion("error", `Error en Set ${i + 1}`, val.msg);
      }
      setsValidados.push({ ...s, ganador: val.ganador });
      marcadorTexto += `${i > 0 ? ", " : ""}${s.gA}-${s.gB}${val.esTiebreak ? `(${Math.min(s.tbA, s.tbB)})` : ""}`;
    }

    const ganadorFinal = setsRotacion[0].ganador;
    const esAmistoso = !match.is_competitive;

    const propuestaData = {
      winner: ganadorFinal,
      scoreText: marcadorTexto,
      sets: setsValidados,
      esRankedValido: elegibilidadRanked.elegible && match.is_competitive,
    };

    try {
      setProcesandoScore(true);

      const payloadUpdate = {
        score_proposed: propuestaData,
        score_submitted_by: user.id,
        score_text: marcadorTexto,
        winner_team: ganadorFinal,
        status: esAmistoso ? "jugado" : match.status,
        score_status: esAmistoso ? "confirmado" : "propuesto",
        score_confirmations: [user.id],
      };

      const { error } = await supabase
        .from("matches")
        .update(payloadUpdate)
        .eq("id", match.id);

      if (error) throw error;

      setModalResultadoOpen(false);
      await cargarDetallePartido();

      if (esAmistoso) {
        mostrarNotificacion("exito", "¡Partido Finalizado!", "El partido ha sido guardado con éxito en tu historial.");
      } else {
        mostrarNotificacion("exito", "Marcador Propuesto", "Resultado enviado. Esperando la confirmación de la pareja rival.");
      }
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
          .from("matches")
          .update({
            score_proposed: null,
            score_submitted_by: null,
            score_status: "impugnado",
            score_confirmations: [],
          })
          .eq("id", match.id);

        await cargarDetallePartido();
        mostrarNotificacion("info", "Marcador Rechazado", "Has rechazado el marcador propuesto.");
        return;
      }

      const propuesta = match.score_proposed;

      const { error: matchErr } = await supabase
        .from("matches")
        .update({
          status: "jugado",
          winner_team: propuesta.winner,
          score_status: "confirmado",
          score_text: propuesta.scoreText,
          score_confirmations: [...(match.score_confirmations || []), user.id],
        })
        .eq("id", match.id);

      if (matchErr) throw matchErr;

      if (propuesta.esRankedValido) {
        const deltasAcumulados = {};

        for (const s of propuesta.sets || []) {
          const pA1 = match.players.find((p) => p.user_id === s.pA1) || match.players[0];
          const pA2 = match.players.find((p) => p.user_id === s.pA2) || match.players[1];
          const pB1 = match.players.find((p) => p.user_id === s.pB1) || match.players[2];
          const pB2 = match.players.find((p) => p.user_id === s.pB2) || match.players[3];

          if (pA1 && pA2 && pB1 && pB2) {
            const { deltaA, deltaB } = calcularAjusteRatingSet({
              ratingA1: Number(pA1.padel_profile?.rating) || 1.5,
              ratingA2: Number(pA2.padel_profile?.rating) || 1.5,
              ratingB1: Number(pB1.padel_profile?.rating) || 1.5,
              ratingB2: Number(pB2.padel_profile?.rating) || 1.5,
              juegosA: Number(s.gA),
              juegosB: Number(s.gB),
              fiabilidadJugador: Number(pA1.padel_profile?.fiabilidad) || 20,
            });

            [pA1, pA2].forEach((p) => {
              deltasAcumulados[p.user_id] = (deltasAcumulados[p.user_id] || 0) + deltaA;
            });
            [pB1, pB2].forEach((p) => {
              deltasAcumulados[p.user_id] = (deltasAcumulados[p.user_id] || 0) + deltaB;
            });
          }
        }

        for (const [userId, deltaTotal] of Object.entries(deltasAcumulados)) {
          const playerObj = match.players.find((p) => p.user_id === userId);
          const rActual = Number(playerObj?.padel_profile?.rating) || 1.5;
          const nuevoRating = Math.max(1.0, parseFloat((rActual + deltaTotal).toFixed(2)));
          const nuevaCat = categoriaDesdeRating(nuevoRating);
          const fiabActual = Number(playerObj?.padel_profile?.fiabilidad) || 20;

          await supabase
            .from("padel_profiles")
            .update({
              rating: nuevoRating,
              categoria_oficial: nuevaCat,
              fiabilidad: Math.min(100, fiabActual + 3),
            })
            .eq("cuenta_id", userId);

          await supabase
            .from("match_players")
            .update({ rating_change: deltaTotal })
            .eq("match_id", match.id)
            .eq("user_id", userId);
        }
      }

      await cargarDetallePartido();
      mostrarNotificacion("exito", "¡Partido Finalizado!", propuesta.esRankedValido ? "Marcador aprobado y Rating actualizado." : "Marcador registrado en tu historial.");
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error", "No se pudo procesar la confirmación.");
    } finally {
      setProcesandoScore(false);
    }
  }

  async function ejecutarCancelacionConRegla6H() {
    if (!match || !user) return;

    const horasRestantes = calcularHorasFaltantesVET(match.scheduled_at);
    const esMayorA6Horas = horasRestantes >= 6;

    if (esMayorA6Horas) {
      try {
        setProcesandoScore(true);

        const { error } = await supabase
          .from("matches")
          .update({
            status: "cancelado_pendiente_reembolso",
            payment_status: "reembolso_pendiente",
          })
          .eq("id", match.id);

        if (error) throw error;

        setModalCancelOpen(false);
        mostrarNotificacion(
          "info",
          "Solicitud de Reembolso Enviada",
          "🔵 Tu reserva fue marcada como Reembolso Pendiente. Recepción devolverá el dinero abonado y liberará la cancha."
        );

        await cargarDetallePartido();
      } catch (err) {
        mostrarNotificacion("error", "Error", err.message || "Error al solicitar reembolso.");
      } finally {
        setProcesandoScore(false);
      }
    } else {
      try {
        setProcesandoScore(true);

        const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
        const totalAbonado = historialActual
          .filter((item) => item.status === "aprobado" || item.status === "pendiente")
          .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        const { data: userProf } = await supabase
          .from("profiles")
          .select("nombre, apellido, telefono")
          .eq("id", user.id)
          .maybeSingle();

        const clienteNom = userProf ? `${userProf.nombre} ${userProf.apellido}`.trim() : user.email;

        if (totalAbonado > 0) {
          const { data: ventaCancelacion } = await supabase
            .from("sales")
            .insert({
              club_id: match.club_id,
              cashier_id: user.id,
              total_amount: totalAbonado,
              payment_method: match.payment_method || "pago_movil",
              exchange_rate: tasaBCV,
            })
            .select("id")
            .single();

          if (ventaCancelacion) {
            await supabase.from("sales_items").insert({
              sale_id: ventaCancelacion.id,
              item_type: "ingreso_pista_cancelada",
              item_name: `🟢 Ingreso Pista Cancelada (<6h): ${match.court?.name || "Pista"}`,
              item_detail: `Cliente: ${clienteNom} | Tel: ${userProf?.telefono || "S/T"}`,
              quantity: 1,
              price_unit: totalAbonado,
            });
          }
        }

        await supabase.from("match_players").delete().eq("match_id", match.id);
        const { error: matchErr } = await supabase.from("matches").delete().eq("id", match.id);
        if (matchErr) throw matchErr;

        await supabase.from("padel_locks").delete().eq("court_id", match.court_id).eq("scheduled_at", match.scheduled_at);

        setModalCancelOpen(false);
        router.push("/padel/partidos");
      } catch (err) {
        mostrarNotificacion("error", "Error al Cancelar", err.message || "Ocurrió un error al anular la reserva.");
      } finally {
        setProcesandoScore(false);
      }
    }
  }

  const elegibilidadRanked = useMemo(() => {
    if (!match) return { elegible: false, razon: "Cargando datos..." };

    const jugadores = match.players || [];
    const totalEsperado = match.match_type === "amistoso" ? 6 : 4;

    const slotsIncompletos = jugadores.length < 4 || jugadores.some((j) => !j.user_id);
    if (slotsIncompletos) {
      return {
        elegible: false,
        razon: `Faltan usuarios registrados en la reserva (${jugadores.length}/${totalEsperado}).`,
      };
    }

    const compatibilidadCat = validarCompatibilidadCategorias(jugadores);
    if (!compatibilidadCat) {
      return {
        elegible: false,
        razon: "La diferencia de categorías entre los jugadores supera 1 nivel (máx. +/-1 cat.).",
      };
    }

    return { elegible: true, razon: "El partido cumple todos los requisitos para sumar/restar en el Ranking Oficial." };
  }, [match]);

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
        <h2 className="text-xl font-black text-slate-800">Partido No Encontrado</h2>
        <Link href="/padel/partidos" className="px-5 py-2.5 bg-slate-900 text-white text-xs font-black uppercase rounded-2xl">
          ← Volver
        </Link>
      </div>
    );
  }

  const miJugador = match?.players?.find((p) => p.user_id === user?.id);
  const soyCreadorVista = match?.created_by === user?.id;

  const historialAbonos = Array.isArray(match?.payments_history) ? match.payments_history : [];

  // 🧠 CÁLCULOS SEPARADOS DE PAGOS APROBADOS Y EXTRAS
  const precioBase = match?.total_price || 16;
  const feeApp = match?.app_fee || (match?.is_private ? 0 : precioBase * 0.10);
  const totalPistaConFee = precioBase + feeApp;

  const listExtras = Array.isArray(match?.extra_items) ? match.extra_items : [];

  // AGRUPADOR DE EXTRAS PARA LA UI (x5, x6)
  const extrasAgrupados = listExtras.reduce((acc, ex) => {
    const key = `${ex.name}_${ex.price}`;
    if (!acc[key]) {
      acc[key] = { name: ex.name, price: parseFloat(ex.price) || 0, qty: 0 };
    }
    acc[key].qty += 1;
    return acc;
  }, {});

  const listaExtrasAgrupados = Object.values(extrasAgrupados);
  const totalExtras = listExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);

  const totalGranEsperado = totalPistaConFee + totalExtras;

  const totalAbonadoAprobado = historialAbonos
    .filter((a) => a.status === "aprobado" || a.status === "liquidado")
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  const miAbonoHistorial = historialAbonos.filter((p) => p.user_id === user?.id);
  const miPagoPendiente = miAbonoHistorial.some((p) => p.status === "pendiente" || p.status === "pendiente_aprobacion");

  // REGLAS DIFERENCIADAS
  const canchaTotalmentePagada = totalAbonadoAprobado >= (totalPistaConFee - 0.05);
  const todoPagadoConExtras = totalAbonadoAprobado >= (totalGranEsperado - 0.05);

  const restanteGranTotal = Math.max(0, totalGranEsperado - totalAbonadoAprobado);

  const puedeIniciarPartido = canchaTotalmentePagada && !miPagoPendiente;
  const puedeFinalizarPartido = todoPagadoConExtras && !miPagoPendiente;

  const horasFaltantesActuales = calcularHorasFaltantesVET(match?.scheduled_at);

  const dupla1 = match?.players?.filter((p) => p.team === "A") || [];
  const dupla2 = match?.players?.filter((p) => p.team === "B") || [];
  const dupla3 = match?.players?.filter((p) => p.team === "C") || [];

  const estaEnHorarioOIniciado = partidoIniciado || horasFaltantesActuales <= 0.25;

  const propuestoPorMi = match?.score_submitted_by === user?.id;

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 space-y-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER DETALLE DE RESERVA */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <Link href="/padel/partidos" className="text-xs font-black uppercase text-blue-600 hover:underline block">
            ← Volver a Partidos
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                {match?.club?.name || "Complejo Deportivo"} • {match?.court?.name || "Pista"}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 capitalize">
                📅 {formatFechaLarga(match?.scheduled_at)}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 font-black text-xs px-3 py-1 rounded-full border border-blue-200">
                Cat. {match?.category_restriction || "Libre"}
              </span>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${
                match?.is_competitive ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-600"
              }`}>
                {match?.is_competitive ? "⚡ Modo Ranked" : "🔒 Privado"}
              </span>
            </div>
          </div>

          {/* ELEGIBILIDAD RANKED BANNER */}
          {match?.is_competitive && (
            <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
              elegibilidadRanked.elegible ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
            }`}>
              <div>
                <span className="font-black uppercase block text-[10px] tracking-wider">
                  {elegibilidadRanked.elegible ? "🟢 VÁLIDO PARA RANKING" : "⚠️ MODO RANKED EN PAUSA (SOLO EXHIBICIÓN)"}
                </span>
                <p className="mt-0.5">{elegibilidadRanked.razon}</p>
              </div>
            </div>
          )}
        </div>

        {/* 🟡 BANNER DE PROPUESTA DE MARCADOR PENDIENTE */}
        {match?.score_status === "propuesto" && match?.status !== "jugado" && (
          <div className="bg-amber-50 border-2 border-amber-300 p-5 rounded-3xl shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                  ⏳ Marcador Pendiente de Aprobar
                </span>
                <h3 className="text-lg font-black text-amber-950 mt-1">
                  Resultado Propuesto: <span className="text-blue-700">{match.score_text || match.score_proposed?.scoreText}</span>
                </h3>
                <p className="text-xs font-bold text-amber-800">
                  Ganador propuesto: <strong>Dupla {match.winner_team === "A" ? "1 (A)" : "2 (B)"}</strong>
                </p>
              </div>
            </div>

            {propuestoPorMi ? (
              <div className="bg-amber-100/70 p-3 rounded-2xl text-xs font-bold text-amber-900 flex items-center gap-2">
                <span>📩</span>
                <span>Enviaste esta propuesta de marcador. Esperando que un jugador rival la revise y apruebe.</span>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-amber-950">
                  El rival ha cargado este marcador. Haz clic en aprobar para dar por finalizado y confirmado el partido.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => responderPropuesta(true)}
                    disabled={procesandoScore}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all cursor-pointer"
                  >
                    ✓ Aprobar Resultado
                  </button>
                  <button
                    type="button"
                    onClick={() => responderPropuesta(false)}
                    disabled={procesandoScore}
                    className="px-5 py-3 bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
                  >
                    ✕ Rechazar / Impugnar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 💳 SECCIÓN 1: PAGOS Y COMPROBANTES (DESPLEGABLE ARRIBA) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setPagosDesplegados(!pagosDesplegados)}
            className="w-full p-5 bg-white hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer border-b border-slate-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💳</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                    Estado de Pago de la Reserva
                  </h3>
                  {miPagoPendiente && (
                    <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                      🟡 Tu Pago Sigue Pendiente de Aprobación
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold mt-0.5 text-slate-600">
                  {todoPagadoConExtras
                    ? "✅ Reserva y consumos extras totalmente pagados"
                    : miPagoPendiente
                    ? "🟡 Tu comprobante está en revisión por recepción"
                    : `Restante por pagar (Cancha + Extras): $${restanteGranTotal.toFixed(2)} USD`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-500">{pagosDesplegados ? "▲ Ocultar" : "▼ Desplegar"}</span>
            </div>
          </button>

          {pagosDesplegados && (
            <div className="p-5 bg-slate-50 space-y-4 border-t border-slate-100">
              
              {miPagoPendiente && (
                <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-2xl text-amber-900 text-xs font-bold flex items-center gap-3">
                  <span className="text-xl">⏳</span>
                  <div>
                    <p className="font-black">TU COMPROBANTE SIGUE PENDIENTE DE APROBACIÓN</p>
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                      El gerente del club está verificando tu transacción en recepción.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs font-bold">
                <div className="flex justify-between text-[#00FF9D]">
                  <span>Pista Base + Fee:</span>
                  <span className="font-black">${totalPistaConFee.toFixed(2)} USD</span>
                </div>

                {/* CONSUMOS EXTRAS AGRUPADOS (x5, x6) */}
                {listaExtrasAgrupados.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <span className="text-[10px] text-amber-300 uppercase font-black block">
                      Consumos Extras agregados desde Recepción:
                    </span>
                    {listaExtrasAgrupados.map((ex, i) => (
                      <div key={i} className="flex justify-between text-slate-300 text-[11px]">
                        <span>• {ex.name} <strong className="text-amber-400 font-bold">x{ex.qty}</strong></span>
                        <span>${(ex.price * ex.qty).toFixed(2)} USD</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-xs pt-2 border-t border-slate-800 font-black">
                  <span>Total Factura Gran Total:</span>
                  <span className="text-[#00FF9D]">${totalGranEsperado.toFixed(2)} USD</span>
                </div>

                <div className="flex justify-between text-xs pt-1 border-t border-slate-800/60 font-black">
                  <span className="text-emerald-400">Total Aprobado en Caja: ${totalAbonadoAprobado.toFixed(2)} USD</span>
                  <span className={restanteGranTotal > 0 ? "text-amber-400" : "text-slate-400"}>
                    Restante: ${restanteGranTotal.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* HISTORIAL DE PAGOS */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                  🧾 Historial de Pagos Registrados ({historialAbonos.length})
                </h4>
                {historialAbonos.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 bg-white p-3 rounded-xl text-center border border-slate-200">
                    Aún no hay comprobantes ni abonos registrados.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {historialAbonos.map((ab, idx) => {
                      const amountUsd = parseFloat(ab.amount) || 0;
                      const amountBs = amountUsd * tasaBCV;

                      return (
                        <div key={ab.id || idx} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-[#00FF9D]">
                                {ab.method ? ab.method.replace("_", " ") : "ABONO"}
                              </span>
                              <span className="text-xs font-black text-slate-800 truncate">{ab.user_name || "Cliente"}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                              Ref: <strong className="text-slate-800">{ab.reference || "S/R"}</strong>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-black block leading-none text-slate-900">
                                ${amountUsd.toFixed(2)} USD
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                                Bs. {amountBs.toFixed(2)}
                              </span>
                            </div>

                            {renderPaymentStatusBadge(ab.status)}

                            {ab.receipt_url && (
                              <button
                                type="button"
                                onClick={() => setImagenEngrande(ab.receipt_url)}
                                className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-100 overflow-hidden hover:border-blue-500 shrink-0 cursor-pointer"
                              >
                                <img src={ab.receipt_url} alt="Comprobante" className="w-full h-full object-cover" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FORMULARIO ADJUNTAR PAGO EXTRA */}
              <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl space-y-3">
                <h4 className="text-xs font-black text-blue-950 uppercase">➕ Adjuntar Nuevo Pago / Comprobante Extra</h4>
                <div className="space-y-2.5 text-xs font-bold text-slate-700">
                  <input
                    type="number"
                    step="0.01"
                    value={formPagoExtra.monto}
                    onChange={(e) => setFormPagoExtra({ ...formPagoExtra, monto: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 outline-none"
                    placeholder="Monto a Abonar ($)"
                  />
                  
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "pago_movil", label: "📱 Pago Móvil" },
                      { id: "zelle", label: "🇺🇸 Zelle" },
                      { id: "efectivo", label: "💵 En Sitio" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFormPagoExtra({ ...formPagoExtra, metodoPago: m.id })}
                        className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                          formPagoExtra.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {formPagoExtra.metodoPago !== "efectivo" && (
                    <>
                      <input
                        type="text"
                        placeholder="Número de Referencia *"
                        value={formPagoExtra.numReferencia}
                        onChange={(e) => setFormPagoExtra({ ...formPagoExtra, numReferencia: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSeleccionarImagen(e, (res) => setFormPagoExtra({ ...formPagoExtra, previewComprobante: res }))}
                        className="w-full bg-white border border-slate-200 rounded-xl p-1 text-xs"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={agregarComprobanteExtraUser}
                    disabled={enviandoPagoExtra}
                    className="w-full py-3 bg-[#0B0C15] text-[#00FF9D] font-black text-xs uppercase rounded-xl cursor-pointer"
                  >
                    {enviandoPagoExtra ? "Enviando..." : "✓ Enviar Comprobante Adicional"}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* 👥 SECCIÓN 2: DUPLAS Y JUGADORES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Estructura del Partido</span>
              <h3 className="text-base font-black text-slate-900">Duplas & Alineación en Pista</h3>
            </div>

            {!mostrarTerceraDupla && (
              <button
                type="button"
                onClick={() => setMostrarTerceraDupla(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase rounded-xl shadow-xs cursor-pointer self-start sm:self-auto"
              >
                + Agregar Tercera Dupla (Rotación 6p)
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div className="bg-slate-50/80 rounded-3xl border-2 border-slate-200 p-5 space-y-6 shadow-2xs">
              {/* DUPLA 1 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-wider">🎾 Dupla 1 (Pareja A)</span>
                </div>

                <div className="flex items-center justify-around sm:justify-start sm:gap-12 pt-2">
                  <PlayerCircleSlot
                    player={dupla1[0]}
                    teamLetter="A"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                  />

                  <span className="text-slate-300 font-black text-xl">+</span>

                  <PlayerCircleSlot
                    player={dupla1[1]}
                    teamLetter="A"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                  />
                </div>
              </div>

              {/* SEPARADOR VS */}
              <div className="flex items-center justify-center gap-3">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="bg-slate-900 text-white font-black text-xs px-3 py-1 rounded-full uppercase tracking-widest">
                  VS
                </span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              {/* DUPLA 2 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-wider">🎾 Dupla 2 (Pareja B)</span>
                </div>

                <div className="flex items-center justify-around sm:justify-start sm:gap-12 pt-2">
                  <PlayerCircleSlot
                    player={dupla2[0]}
                    teamLetter="B"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                  />

                  <span className="text-slate-300 font-black text-xl">+</span>

                  <PlayerCircleSlot
                    player={dupla2[1]}
                    teamLetter="B"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                  />
                </div>
              </div>
            </div>

            {/* DUPLA 3 */}
            {mostrarTerceraDupla && (
              <div className="bg-blue-50/50 rounded-3xl border-2 border-blue-200 p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-blue-950 tracking-wider">🔄 Dupla 3 (Rotación Pareja C)</span>
                  <button
                    type="button"
                    onClick={() => setMostrarTerceraDupla(false)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-700 uppercase"
                  >
                    Ocultar
                  </button>
                </div>

                <div className="flex items-center justify-around sm:justify-start sm:gap-12 pt-2">
                  <PlayerCircleSlot
                    player={dupla3[0]}
                    teamLetter="C"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                  />

                  <span className="text-blue-300 font-black text-xl">+</span>

                  <PlayerCircleSlot
                    player={dupla3[1]}
                    teamLetter="C"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 🔴 SECCIÓN 3: MARCADOR EN TIEMPO REAL (REGLAMENTARIO) */}
        {estaEnHorarioOIniciado && match?.status !== "jugado" ? (
          <div className="bg-slate-950 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-xs font-black uppercase tracking-widest text-[#00FF9D]">
                📡 MARCADOR DE PÁDEL EN VIVO
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase bg-blue-600 text-white px-2.5 py-0.5 rounded-md">
                  Set {liveScore.setActual} {liveScore.esTiebreak && "(TIE-BREAK)"}
                </span>
                <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full">
                  Saque: Dupla {liveScore.saque === "A" ? "1 (A)" : "2 (B)"}
                </span>
              </div>
            </div>

            {/* RESUMEN DE SETS */}
            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex justify-around text-xs font-bold">
              {liveScore.sets.map((s, idx) => (
                <div key={idx} className={`text-center ${idx + 1 === liveScore.setActual ? "text-[#00FF9D] font-black" : "text-slate-400"}`}>
                  <span className="text-[9px] uppercase block text-slate-500">Set {idx + 1}</span>
                  <span>{s.gA} - {s.gB}</span>
                  {s.tbA > 0 || s.tbB > 0 ? <span className="text-[9px] block text-slate-400">({Math.min(s.tbA, s.tbB)})</span> : null}
                </div>
              ))}
            </div>

            {/* MARCADOR DEL JUEGO ACTUAL */}
            {liveScore.partidoTerminado ? (
              <div className="bg-emerald-950/80 border-2 border-emerald-500 p-5 rounded-2xl text-center space-y-3">
                <span className="text-3xl block">🏆</span>
                <h4 className="text-sm font-black text-[#00FF9D] uppercase">Partido Finalizado en Vivo</h4>
                <p className="text-xs font-bold text-emerald-200">
                  Ganador: Dupla {liveScore.setsGanadosA === 2 ? "1 (Pareja A)" : "2 (Pareja B)"}
                </p>

                <button
                  type="button"
                  onClick={handleFinalizarPartidoClick}
                  className="px-6 py-3 bg-[#00FF9D] text-slate-950 font-black text-xs uppercase rounded-xl shadow-md hover:bg-emerald-400 cursor-pointer"
                >
                  🏁 Confirmar Marcador y Guardar Partido
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-xs font-black text-slate-400 block">DUPLA 1 (A)</span>
                    <p className="text-4xl font-black text-[#00FF9D]">
                      {liveScore.esTiebreak ? liveScore.sets[liveScore.setActual - 1]?.tbA || 0 : liveScore.puntosA}
                    </p>
                    <p className="text-xs font-bold text-slate-300">
                      Juegos en Set {liveScore.setActual}: <strong>{liveScore.sets[liveScore.setActual - 1]?.gA || 0}</strong>
                    </p>
                    
                    <button
                      type="button"
                      onClick={() => sumarPuntoLive("A")}
                      className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl cursor-pointer transition-colors"
                    >
                      + Punto Dupla 1
                    </button>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-xs font-black text-slate-400 block">DUPLA 2 (B)</span>
                    <p className="text-4xl font-black text-[#00FF9D]">
                      {liveScore.esTiebreak ? liveScore.sets[liveScore.setActual - 1]?.tbB || 0 : liveScore.puntosB}
                    </p>
                    <p className="text-xs font-bold text-slate-300">
                      Juegos en Set {liveScore.setActual}: <strong>{liveScore.sets[liveScore.setActual - 1]?.gB || 0}</strong>
                    </p>

                    <button
                      type="button"
                      onClick={() => sumarPuntoLive("B")}
                      className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase rounded-xl cursor-pointer transition-colors"
                    >
                      + Punto Dupla 2
                    </button>
                  </div>
                </div>

                {soyCreadorVista && (
                  <button
                    type="button"
                    onClick={handleFinalizarPartidoClick}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] border border-slate-800 font-black text-xs uppercase tracking-wider rounded-2xl shadow-md cursor-pointer"
                  >
                    🏁 Finalizar Partido y Guardar Resultado
                  </button>
                )}
              </div>
            )}
          </div>
        ) : match?.status !== "jugado" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-3 shadow-xs">
            <span className="text-3xl block">🎾</span>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-900 uppercase">El contador en vivo está desactivado</h4>
              <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto">
                Hora programada: <strong>{formatFechaLarga(match?.scheduled_at)}</strong>. Presiona el botón para comenzar a contar puntos en vivo.
              </p>
            </div>

            {!puedeIniciarPartido ? (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl max-w-md mx-auto text-amber-900 text-xs font-bold">
                ⚠️ Para iniciar el contador en tiempo real, el valor base de la pista debe estar saldado y aprobado por la recepción del club.
              </div>
            ) : (
              (miJugador || soyCreadorVista) && (
                <button
                  type="button"
                  onClick={iniciarPartidoLive}
                  disabled={procesandoScore}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer mt-2"
                >
                  ▶️ Comenzar Partido y Activar Marcador
                </button>
              )
            )}
          </div>
        )}

        {/* 🚨 BOTÓN DE ANULAR / CANCELAR RESERVA AL FINAL DE LA PÁGINA */}
        {soyCreadorVista && match?.status === "programado" && (
          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setModalCancelOpen(true)}
              className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs uppercase rounded-2xl shadow-sm transition-colors cursor-pointer"
            >
              🚨 Anular / Cancelar Reserva de Cancha (Regla 6h)
            </button>
          </div>
        )}

      </div>

      {/* MODAL CÁLCULO / CARGA DE MARCADOR */}
      {modalResultadoOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 my-6 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">Registrar Marcador Final</h3>
              <button type="button" onClick={() => setModalResultadoOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={enviarPropuestaResultado} className="space-y-4 text-xs font-bold">
              {setsRotacion.map((set, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-black text-slate-900 uppercase block">Set {idx + 1}</span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-1">Juegos Dupla 1 (A)</label>
                      <input
                        type="number"
                        value={set.gA}
                        onChange={(e) => {
                          const newSets = [...setsRotacion];
                          newSets[idx].gA = Number(e.target.value);
                          setSetsRotacion(newSets);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-center font-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-400 mb-1">Juegos Dupla 2 (B)</label>
                      <input
                        type="number"
                        value={set.gB}
                        onChange={(e) => {
                          const newSets = [...setsRotacion];
                          newSets[idx].gB = Number(e.target.value);
                          setSetsRotacion(newSets);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-center font-black"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="submit"
                disabled={procesandoScore}
                className="w-full py-4 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl cursor-pointer"
              >
                {procesandoScore ? "ENVIANDO..." : "GUARDAR Y FINALIZAR PARTIDO →"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BÚSQUEDA DE JUGADORES */}
      {modalAgregarJugadorOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalAgregarJugadorOpen(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Añadir Jugador a ({equipoObjetivoAdd === 'A' ? 'Dupla 1' : equipoObjetivoAdd === 'B' ? 'Dupla 2' : 'Dupla 3'})
              </h3>
              <button type="button" onClick={() => setModalAgregarJugadorOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Escribe nombre, apellido o email..."
                value={busquedaUsuario}
                onChange={(e) => buscarUsuariosSistema(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold outline-none"
              />

              {buscandoUsuarios && <p className="text-[10px] text-slate-400 font-bold">Buscando usuarios...</p>}

              {usuariosEncontrados.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y max-h-52 overflow-y-auto">
                  {usuariosEncontrados.map((u) => (
                    <div key={u.id} className="p-2.5 flex justify-between items-center text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-black text-slate-900 truncate">{u.nombre} {u.apellido}</p>
                        <p className="text-[9px] text-slate-400 truncate">{u.email} • <strong className="text-blue-600 uppercase">Cat: {u.categoria}</strong></p>
                      </div>
                      <button
                        type="button"
                        onClick={() => agregarJugadorAMatch(u.id)}
                        disabled={procesandoJugador}
                        className="px-3 py-1 bg-slate-900 text-[#00FF9D] font-black text-[10px] uppercase rounded-lg cursor-pointer shrink-0"
                      >
                        + Asignar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR REGLA 6H */}
      {modalCancelOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalCancelOpen(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-lg font-black text-slate-900">¿Anular Reserva de Cancha?</h3>

            <div className={`p-3.5 rounded-2xl text-xs font-bold text-left space-y-1 ${
              horasFaltantesActuales >= 6 ? "bg-sky-50 border border-sky-200 text-sky-900" : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}>
              <span className="text-[10px] uppercase font-black tracking-wider block">
                {horasFaltantesActuales >= 6 ? `🔵 Quedan ${horasFaltantesActuales.toFixed(1)}h (Más de 6h)` : `⚠️ Quedan ${Math.max(0, horasFaltantesActuales).toFixed(1)}h (Menos de 6h)`}
              </span>
              <p className="normal-case text-[11px]">
                {horasFaltantesActuales >= 6 
                  ? "Se marcará como Reembolso Pendiente. Pasa por recepción para recibir tu devolución."
                  : "Según las políticas del club, al cancelar con menos de 6 horas de anticipación NO HABRÁ DEVOLUCIÓN."}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setModalCancelOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-black text-xs rounded-2xl">
                Volver
              </button>
              <button onClick={ejecutarCancelacionConRegla6H} disabled={procesandoScore} className="flex-1 py-3 bg-rose-600 text-white font-black text-xs uppercase rounded-2xl">
                {procesandoScore ? "Anulando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX COMPROBANTE */}
      {imagenEngrande && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-4" onClick={() => setImagenEngrande(null)}>
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagenEngrande(null)}
              className="absolute -top-10 right-0 text-white font-black text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700 cursor-pointer"
            >
              ✕ Cerrar Vista
            </button>
            <img src={imagenEngrande} alt="Comprobante" className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl border border-slate-800" />
          </div>
        </div>
      )}

      {/* POPUP NOTIFICACIÓN */}
      {notificacion && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">{notificacion.titulo}</h3>
            <p className="text-xs font-semibold text-slate-500">{notificacion.mensaje}</p>
            <button onClick={() => setNotificacion(null)} className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-2xl">
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// COMPONENTE AUXILIAR CIRCULITO DE JUGADORES
function PlayerCircleSlot({ player, teamLetter, onAdd, onRemove, isCreator, currentUserId }) {
  if (player && player.user_id) {
    const nombre = player.profile ? player.profile.nombre : "Jugador";
    const cat = player.padel_profile?.categoria_oficial || categoriaDesdeRating(player.padel_profile?.rating);
    const inicial = nombre.charAt(0).toUpperCase();
    const esYo = player.user_id === currentUserId;

    return (
      <div className="flex flex-col items-center space-y-1.5 relative group">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0F172A] border-2 border-slate-700 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-md relative overflow-hidden">
          {player.profile?.avatar_url ? (
            <img src={player.profile.avatar_url} alt={nombre} className="w-full h-full object-cover" />
          ) : (
            <span>{inicial}</span>
          )}
        </div>
        <p className="text-xs font-black text-slate-900 truncate max-w-[90px] text-center">{nombre}</p>
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#00FF9D] text-slate-950 shadow-2xs">
          {cat}
        </span>
        {isCreator && !esYo && (
          <button
            type="button"
            onClick={() => onRemove(player.id)}
            className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 rounded-full text-xs font-black flex items-center justify-center shadow-md hover:bg-rose-600 cursor-pointer"
            title="Remover Jugador"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-1.5">
      <button
        type="button"
        onClick={() => onAdd(teamLetter)}
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-500 flex flex-col items-center justify-center transition-all cursor-pointer group shadow-2xs"
      >
        <span className="text-xl sm:text-2xl font-black text-slate-400 group-hover:text-emerald-600 group-hover:scale-110 transition-transform">+</span>
      </button>
      <p className="text-[11px] font-bold text-slate-400">Vacío</p>
    </div>
  );
}