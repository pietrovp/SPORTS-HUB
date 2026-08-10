"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const CATEGORIAS_ORDEN = ["rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "open"];

const PRESETS_DUPLA_1 = [
  { label: "6 - 0", gA: 6, gB: 0 },
  { label: "6 - 1", gA: 6, gB: 1 },
  { label: "6 - 2", gA: 6, gB: 2 },
  { label: "6 - 3", gA: 6, gB: 3 },
  { label: "6 - 4", gA: 6, gB: 4 },
  { label: "7 - 5", gA: 7, gB: 5 },
  { label: "7 - 6 (TB)", gA: 7, gB: 6 },
];

const PRESETS_DUPLA_2 = [
  { label: "0 - 6", gA: 0, gB: 6 },
  { label: "1 - 6", gA: 1, gB: 6 },
  { label: "2 - 6", gA: 2, gB: 6 },
  { label: "3 - 6", gA: 3, gB: 6 },
  { label: "4 - 6", gA: 4, gB: 6 },
  { label: "5 - 7", gA: 5, gB: 7 },
  { label: "6 - 7 (TB)", gA: 6, gB: 7 },
];

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
      let catRaw = j.padel_profile?.categoria_oficial || categoriaDesdeRating(j.padel_profile?.rating);
      if (!catRaw) return -1;
      let cat = catRaw.toString().toLowerCase().trim();
      if (cat === "3ra") cat = "3era";
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

  const [pagosDesplegados, setPagosDesplegados] = useState(false);

  // ESTADO DE PARTIDO
  const [partidoIniciado, setPartidoIniciado] = useState(false);

  // ESTADOS CARGA DE MARCADOR
  const [modalResultadoOpen, setModalResultadoOpen] = useState(false);
  const [setsRotacion, setSetsRotacion] = useState([
    { pA1: "", pA2: "", pB1: "", pB2: "", gA: 6, gB: 4, tbA: 0, tbB: 0 },
    { pA1: "", pA2: "", pB1: "", pB2: "", gA: 6, gB: 3, tbA: 0, tbB: 0 },
  ]);

  const [procesandoScore, setProcesandoScore] = useState(false);

  // GESTIÓN DE JUGADORES
  const [modalAgregarJugadorOpen, setModalAgregarJugadorOpen] = useState(false);
  const [equipoObjetivoAdd, setEquipoObjetivoAdd] = useState("A");
  const [mostrarTerceraDupla, setMostrarTerceraDupla] = useState(false);

  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [usuariosEncontrados, setUsuariosEncontrados] = useState([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);
  const [procesandoJugador, setProcesandoJugador] = useState(false);

  // REGISTRO PAGOS EXTRAS
  const [formPagoExtra, setFormPagoExtra] = useState({
    monto: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });
  const [enviandoPagoExtra, setEnviandoPagoExtra] = useState(false);

  useEffect(() => {
    if (!matchId || !supabase) return;

    cargarDetallePartido();
    obtenerTasaBCV();

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

  async function iniciarPartido() {
    if (!puedeIniciarPartido) {
      return mostrarNotificacion(
        "advertencia",
        "Cancha no Saldada",
        "No se puede iniciar el partido hasta que la tarifa base de la pista esté abonada y aprobada por recepción."
      );
    }

    try {
      setProcesandoScore(true);
      setPartidoIniciado(true);
      const { error } = await supabase
        .from("matches")
        .update({ status: "en_progreso" })
        .eq("id", match.id);

      if (error) throw error;

      mostrarNotificacion("exito", "¡Partido Iniciado!", "El partido ha comenzado. Al terminar, recuerden cargar el marcador final.");
      await cargarDetallePartido();
    } catch (err) {
      console.error("Error al iniciar partido:", err);
      mostrarNotificacion("error", "Error", "No se pudo cambiar el estado del partido.");
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
        .select("id, user_id, team, has_evaluated, rating_change")
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
      mostrarNotificacion("exito", "Comprobante Enviado", "✅ ¡Nuevo comprobante adjuntado con éxito!");
      await cargarDetallePartido();
    } catch (err) {
      mostrarNotificacion("error", "Error", "Error al adjuntar el comprobante.");
    } finally {
      setEnviandoPagoExtra(false);
    }
  }

  function handleFinalizarPartidoClick() {
    setModalResultadoOpen(true);
  }

  function seleccionarPresetSet(setIndex, gA, gB) {
    const nuevosSets = [...setsRotacion];
    nuevosSets[setIndex].gA = gA;
    nuevosSets[setIndex].gB = gB;

    if ((gA === 7 && gB === 6) || (gA === 6 && gB === 7)) {
      if (nuevosSets[setIndex].tbA === 0 && nuevosSets[setIndex].tbB === 0) {
        nuevosSets[setIndex].tbA = gA === 7 ? 7 : 5;
        nuevosSets[setIndex].tbB = gB === 7 ? 7 : 5;
      }
    } else {
      nuevosSets[setIndex].tbA = 0;
      nuevosSets[setIndex].tbB = 0;
    }

    setSetsRotacion(nuevosSets);
  }

  function toggleAgregarQuitarSet3() {
    if (setsRotacion.length === 2) {
      setSetsRotacion([
        ...setsRotacion,
        { pA1: "", pA2: "", pB1: "", pB2: "", gA: 6, gB: 4, tbA: 0, tbB: 0 }
      ]);
    } else {
      setSetsRotacion(setsRotacion.slice(0, 2));
    }
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
      
      let setStr = `${s.gA}-${s.gB}`;
      if (val.esTiebreak) {
        const tbMin = Math.min(Number(s.tbA), Number(s.tbB));
        setStr += `(${tbMin})`;
      }
      marcadorTexto += `${i > 0 ? ", " : ""}${setStr}`;
    }

    let setsGanadosA = 0;
    let setsGanadosB = 0;
    setsValidados.forEach((s) => {
      if (s.ganador === "A") setsGanadosA++;
      else setsGanadosB++;
    });

    const ganadorFinal = setsGanadosA >= setsGanadosB ? "A" : "B";
    const esRankedRealValido = elegibilidadRanked.elegible && match.is_competitive;
    const esAmistosoOExhibicion = !esRankedRealValido;

    const propuestaData = {
      winner: ganadorFinal,
      scoreText: marcadorTexto,
      sets: setsValidados,
      esRankedValido: esRankedRealValido,
    };

    try {
      setProcesandoScore(true);

      const debeFinalizarYa = esAmistosoOExhibicion && todoPagadoConExtras;

      const payloadUpdate = {
        score_proposed: propuestaData,
        score_submitted_by: user.id,
        score_text: marcadorTexto,
        winner_team: ganadorFinal,
        status: debeFinalizarYa ? "jugado" : match.status,
        score_status: esAmistosoOExhibicion ? "confirmado" : "propuesto",
        score_confirmations: [user.id],
      };

      const { error } = await supabase
        .from("matches")
        .update(payloadUpdate)
        .eq("id", match.id);

      if (error) throw error;

      setModalResultadoOpen(false);
      await cargarDetallePartido();

      if (debeFinalizarYa) {
        mostrarNotificacion("exito", "¡Partido Finalizado!", "El marcador se guardó correctamente y el partido se cerró oficialmente.");
      } else if (esAmistosoOExhibicion && !todoPagadoConExtras) {
        mostrarNotificacion("info", "Marcador Guardado (Pago Pendiente)", "El marcador se guardó con éxito. El partido se cerrará en tu historial cuando recepción apruebe el saldo pendiente.");
      } else {
        mostrarNotificacion("exito", "Marcador Propuesto", "Marcador guardado. Esperando confirmación de la pareja rival.");
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

      const propuesta = match.score_proposed || {};
      const marcadorFinalStr = propuesta.scoreText || match.score_text;
      const debeFinalizarOficial = todoPagadoConExtras;

      const { error: matchErr } = await supabase
        .from("matches")
        .update({
          status: debeFinalizarOficial ? "jugado" : match.status,
          winner_team: propuesta.winner,
          score_status: "confirmado",
          score_text: marcadorFinalStr,
          score_confirmations: [...(match.score_confirmations || []), user.id],
        })
        .eq("id", match.id);

      if (matchErr) throw matchErr;

      // ACTUALIZAR ELO INCLUSO SI NO SE HA FINALIZADO ADMINISTRATIVAMENTE AÚN
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
      if (debeFinalizarOficial) {
        mostrarNotificacion("exito", "¡Partido Finalizado!", "Marcador aprobado y guardado en tu historial.");
      } else {
        mostrarNotificacion("info", "Marcador Confirmado (Pago Pendiente)", "Marcador confirmado por ambas duplas. El partido se cerrará definitivamente en cuanto recepción apruebe el pago pendiente.");
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacion("error", "Error", "No se pudo procesar la confirmación.");
    } finally {
      setProcesandoScore(false);
    }
  }

  async function cerrarPartidoAdministrativamente() {
    try {
      setProcesandoScore(true);
      const { error } = await supabase.from("matches").update({ status: "jugado" }).eq("id", match.id);
      if (error) throw error;
      await cargarDetallePartido();
      mostrarNotificacion("exito", "¡Partido Cerrado!", "Se han validado los pagos y el partido ha finalizado oficialmente.");
    } catch (err) {
      mostrarNotificacion("error", "Error", "No se pudo cerrar el partido administrativamente.");
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

  const precioBase = match?.total_price || 16;
  const feeApp = match?.app_fee || (match?.is_private ? 0 : precioBase * 0.10);
  const totalPistaConFee = precioBase + feeApp;

  const listExtras = Array.isArray(match?.extra_items) ? match.extra_items : [];

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

  const canchaTotalmentePagada = totalAbonadoAprobado >= (totalPistaConFee - 0.05);
  const todoPagadoConExtras = totalAbonadoAprobado >= (totalGranEsperado - 0.05);

  const restanteGranTotal = Math.max(0, totalGranEsperado - totalAbonadoAprobado);

  const puedeIniciarPartido = canchaTotalmentePagada && !miPagoPendiente;
  const puedeFinalizarPartido = todoPagadoConExtras && !miPagoPendiente;

  const horasFaltantesActuales = calcularHorasFaltantesVET(match?.scheduled_at);

  const dupla1 = match?.players?.filter((p) => p.team === "A") || [];
  const dupla2 = match?.players?.filter((p) => p.team === "B") || [];
  const dupla3 = match?.players?.filter((p) => p.team === "C") || [];

  const propuestoPorMi = match?.score_submitted_by === user?.id;

  const esRankedRealValido = match?.is_competitive && (match?.score_proposed?.esRankedValido ?? elegibilidadRanked.elegible);

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

            {/* DYNAMIC BADGE */}
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 font-black text-xs px-3 py-1 rounded-full border border-blue-200">
                Cat. {match?.category_restriction || "Libre"}
              </span>
              
              {(() => {
                if (!match?.is_competitive) {
                  return (
                    <span className="bg-slate-100 text-slate-600 text-xs font-black px-3 py-1 rounded-full border border-slate-200">
                      🤝 Modo Amistoso
                    </span>
                  );
                }
                if (match?.status === "jugado") {
                  return esRankedRealValido ? (
                    <span className="bg-emerald-50 text-emerald-800 text-xs font-black px-3 py-1 rounded-full border border-emerald-200">
                      ⚡ Ranked Oficial
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-800 text-xs font-black px-3 py-1 rounded-full border border-amber-200">
                      🤝 Modo Exhibición
                    </span>
                  );
                }
                
                const jugadoresActuales = match?.players || [];
                const faltanJugadores = jugadoresActuales.length < 4 || jugadoresActuales.some((j) => !j.user_id);
                
                if (faltanJugadores) {
                  return (
                    <span className="bg-amber-50 text-amber-800 text-xs font-black px-3 py-1 rounded-full border border-amber-200">
                      ⚠️ Ranked (Faltan Jugadores)
                    </span>
                  );
                }
                
                return elegibilidadRanked.elegible ? (
                  <span className="bg-emerald-50 text-emerald-800 text-xs font-black px-3 py-1 rounded-full border border-emerald-200">
                    🟢 Ranked Confirmado
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-800 text-xs font-black px-3 py-1 rounded-full border border-amber-200">
                    🤝 Exhibición (Cat. Incompatibles)
                  </span>
                );
              })()}
            </div>
          </div>

          {/* ELEGIBILIDAD RANKED BANNER */}
          {match?.is_competitive && match?.status !== "jugado" && (
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

        {/* 🏆 BANNER DE PARTIDO FINALIZADO ("JUGADO") */}
        {match?.status === "jugado" && (
          <div className="bg-slate-950 border-2 border-emerald-500 p-6 rounded-3xl shadow-xl text-white space-y-4 text-center">
            <div className="flex justify-center items-center gap-2">
              <span className="text-3xl">🏆</span>
              <span className="bg-emerald-500/20 text-[#00FF9D] text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-500/50">
                PARTIDO FINALIZADO OFICIALMENTE
              </span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                👑 GANADORES: DUPLA {match.winner_team === "A" ? "1 (PAREJA A)" : "2 (PAREJA B)"}
              </h2>
              <p className="text-emerald-400 font-black text-xl tracking-wider mt-2">
                Marcador Final: {match.score_text || "Resultado Registrado"}
              </p>
            </div>

            {esRankedRealValido ? (
              <p className="text-[11px] text-emerald-400 font-bold">
                ⚡ Los puntos y categorías de los jugadores han sido recalculados en el Ranking Oficial.
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 font-bold">
                🤝 Partido de Exhibición/Amistoso finalizado correctamente. No afectó el Ranking Oficial.
              </p>
            )}
          </div>
        )}

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
                  El rival ha cargado este marcador. Haz clic en aprobar para confirmar el resultado del partido.
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

        {/* 🟢 BANNER DE MARCADOR CONFIRMADO PERO PENDIENTE DE PAGO */}
        {match?.score_status === "confirmado" && match?.status !== "jugado" && (
          <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-3xl shadow-md space-y-3 text-center">
            <span className="text-3xl block">⏳</span>
            <h3 className="text-lg font-black text-emerald-950">Marcador Confirmado</h3>
            <p className="text-xs font-bold text-emerald-800 max-w-md mx-auto">
              El resultado ({match.score_text}) ha sido guardado y validado. Sin embargo, hay un saldo de <strong className="text-rose-600">${restanteGranTotal.toFixed(2)} USD</strong> pendiente por cobrar. 
              La recepción del club debe aprobar los pagos para dar el partido por liquidado y cerrado oficialmente.
            </p>
            
            {puedeFinalizarPartido && soyCreadorVista && (
              <button
                type="button"
                onClick={cerrarPartidoAdministrativamente}
                disabled={procesandoScore}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all cursor-pointer mt-2"
              >
                🏁 Validar Pagos y Cerrar Partido Oficialmente
              </button>
            )}
          </div>
        )}

        {/* 💳 SECCIÓN 1: PAGOS Y COMPROBANTES */}
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

            {!mostrarTerceraDupla && match?.status !== "jugado" && (
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
              <div className={`space-y-3 p-3 rounded-2xl transition-colors ${
                match?.status === "jugado" && match?.winner_team === "A" ? "bg-amber-100/60 border border-amber-300" : ""
              }`}>
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                    🎾 Dupla 1 (Pareja A) {match?.status === "jugado" && match?.winner_team === "A" && "👑 GANADORES"}
                  </span>
                </div>

                <div className="flex flex-row items-start justify-center gap-8 sm:gap-16 pt-3 w-full mx-auto">
                  <PlayerCircleSlot
                    player={dupla1[0]}
                    teamLetter="A"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                    isGamePlayed={match?.status === "jugado"}
                  />

                  <span className="text-slate-300 font-black text-xl mt-4">+</span>

                  <PlayerCircleSlot
                    player={dupla1[1]}
                    teamLetter="A"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                    isGamePlayed={match?.status === "jugado"}
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
              <div className={`space-y-3 p-3 rounded-2xl transition-colors ${
                match?.status === "jugado" && match?.winner_team === "B" ? "bg-amber-100/60 border border-amber-300" : ""
              }`}>
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                    🎾 Dupla 2 (Pareja B) {match?.status === "jugado" && match?.winner_team === "B" && "👑 GANADORES"}
                  </span>
                </div>

                <div className="flex flex-row items-start justify-center gap-8 sm:gap-16 pt-3 w-full mx-auto">
                  <PlayerCircleSlot
                    player={dupla2[0]}
                    teamLetter="B"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                    isGamePlayed={match?.status === "jugado"}
                  />

                  <span className="text-slate-300 font-black text-xl mt-4">+</span>

                  <PlayerCircleSlot
                    player={dupla2[1]}
                    teamLetter="B"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                    isGamePlayed={match?.status === "jugado"}
                  />
                </div>
              </div>
            </div>

            {/* DUPLA 3 */}
            {mostrarTerceraDupla && (
              <div className="bg-blue-50/50 rounded-3xl border-2 border-blue-200 p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                  <span className="text-xs font-black uppercase text-blue-950 tracking-wider">🔄 Dupla 3 (Rotación Pareja C)</span>
                  {match?.status !== "jugado" && (
                    <button
                      type="button"
                      onClick={() => setMostrarTerceraDupla(false)}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-700 uppercase"
                    >
                      Ocultar
                    </button>
                  )}
                </div>

                <div className="flex flex-row items-start justify-center gap-8 sm:gap-16 pt-3 w-full mx-auto">
                  <PlayerCircleSlot
                    player={dupla3[0]}
                    teamLetter="C"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                    isGamePlayed={match?.status === "jugado"}
                  />

                  <span className="text-blue-300 font-black text-xl mt-4">+</span>

                  <PlayerCircleSlot
                    player={dupla3[1]}
                    teamLetter="C"
                    onAdd={abrirModalAddJugadorSlot}
                    onRemove={removerJugadorDeMatch}
                    isCreator={soyCreadorVista}
                    currentUserId={user?.id}
                    isGamePlayed={match?.status === "jugado"}
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 🚀 BOTÓN DE ACCIÓN: INICIAR / CARGAR MARCADOR */}
        {match?.status !== "jugado" && !["propuesto", "confirmado"].includes(match?.score_status) && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-3 shadow-xs">
            <span className="text-3xl block">🎾</span>
            
            {partidoIniciado || match?.status === "en_progreso" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-[#00FF9D] uppercase bg-slate-900 py-1 px-3 rounded-full inline-block">
                    ⚡ PARTIDO EN PROGRESO
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto">
                    Pueden cargar el marcador final en cualquier momento para no olvidarlo.
                  </p>
                </div>

                {soyCreadorVista && (
                  <button
                    type="button"
                    onClick={() => setModalResultadoOpen(true)}
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all cursor-pointer"
                  >
                    🏁 Registrar / Cargar Marcador Final
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900 uppercase">El partido aún no ha sido iniciado</h4>
                  <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto">
                    Hora programada: <strong>{formatFechaLarga(match?.scheduled_at)}</strong> (Venezuela).
                  </p>
                </div>

                {!puedeIniciarPartido ? (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl max-w-md mx-auto text-amber-900 text-xs font-bold">
                    ⚠️ Para iniciar el partido, el valor base de la pista debe estar abonado y aprobado por la recepción del club.
                  </div>
                ) : (
                  (miJugador || soyCreadorVista) && (
                    <button
                      type="button"
                      onClick={iniciarPartido}
                      disabled={procesandoScore}
                      className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer mt-2"
                    >
                      ▶️ Iniciar Partido
                    </button>
                  )
                )}
              </div>
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

      {/* MODAL CÁLCULO / CARGA DE MARCADOR MEJORADO */}
      {modalResultadoOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 my-6 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Registro Rápido de Puntos</span>
                <h3 className="text-lg font-black text-slate-900">Registrar Marcador Final</h3>
              </div>
              <button type="button" onClick={() => setModalResultadoOpen(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={enviarPropuestaResultado} className="space-y-5 text-xs font-bold">
              {setsRotacion.map((set, idx) => {
                const esTiebreakActivo = (set.gA === 7 && set.gB === 6) || (set.gA === 6 && set.gB === 7);

                return (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                      <span className="font-black text-slate-900 uppercase">Set {idx + 1}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Selecciona el resultado:</span>
                    </div>

                    {/* PRESETS DUPLA 1 */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase text-blue-600 block">Dupla 1 Gana:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESETS_DUPLA_1.map((p) => {
                          const activo = set.gA === p.gA && set.gB === p.gB;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => seleccionarPresetSet(idx, p.gA, p.gB)}
                              className={`px-3 py-2 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                                activo ? "bg-slate-900 text-[#00FF9D] shadow-md border border-slate-900" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-200"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* PRESETS DUPLA 2 */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[9px] font-black uppercase text-rose-600 block">Dupla 2 Gana:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESETS_DUPLA_2.map((p) => {
                          const activo = set.gA === p.gA && set.gB === p.gB;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => seleccionarPresetSet(idx, p.gA, p.gB)}
                              className={`px-3 py-2 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                                activo ? "bg-slate-900 text-[#00FF9D] shadow-md border border-slate-900" : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-200"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DESPLEGABLE AUTOMÁTICO DE TIE-BREAK */}
                    {esTiebreakActivo && (
                      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-300 space-y-3 text-amber-950 mt-3 animate-in fade-in zoom-in-95">
                        <span className="text-[10px] font-black uppercase tracking-wider block text-amber-900 text-center">
                          🎾 Puntos del Tie-Break (Requerido para el desempate)
                        </span>
                        <div className="flex items-center gap-4 justify-center">
                          <div className="flex-1 max-w-[100px]">
                            <label className="block text-[9px] font-bold text-slate-500 mb-1 text-center">TB Dupla 1 (A)</label>
                            <input
                              type="number"
                              min="0"
                              value={set.tbA}
                              onChange={(e) => {
                                const newSets = [...setsRotacion];
                                newSets[idx].tbA = Number(e.target.value);
                                setSetsRotacion(newSets);
                              }}
                              className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-center font-black text-slate-900 outline-none shadow-sm"
                            />
                          </div>
                          <span className="font-black text-slate-400 text-xl mt-3">-</span>
                          <div className="flex-1 max-w-[100px]">
                            <label className="block text-[9px] font-bold text-slate-500 mb-1 text-center">TB Dupla 2 (B)</label>
                            <input
                              type="number"
                              min="0"
                              value={set.tbB}
                              onChange={(e) => {
                                const newSets = [...setsRotacion];
                                newSets[idx].tbB = Number(e.target.value);
                                setSetsRotacion(newSets);
                              }}
                              className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-center font-black text-slate-900 outline-none shadow-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* BOTÓN PARA AGREGAR / REMOVER SET 3 */}
              <button
                type="button"
                onClick={toggleAgregarQuitarSet3}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase rounded-xl border border-slate-300 cursor-pointer transition-colors shadow-sm"
              >
                {setsRotacion.length === 2 ? "+ Agregar Set 3 (Desempate)" : "✕ Remover Set 3"}
              </button>

              <button
                type="submit"
                disabled={procesandoScore}
                className="w-full py-4 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl cursor-pointer hover:bg-slate-900 transition-colors"
              >
                {procesandoScore ? "ENVIANDO..." : "GUARDAR MARCADOR DEL PARTIDO →"}
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
            <button onClick={() => setNotificacion(null)} className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-2xl cursor-pointer">
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// COMPONENTE AUXILIAR CIRCULITO DE JUGADORES
function PlayerCircleSlot({ player, teamLetter, onAdd, onRemove, isCreator, currentUserId, isGamePlayed }) {
  if (player && player.user_id) {
    const nombre = player.profile ? player.profile.nombre : "Jugador";
    const cat = player.padel_profile?.categoria_oficial || categoriaDesdeRating(player.padel_profile?.rating);
    const inicial = nombre.charAt(0).toUpperCase();
    const esYo = player.user_id === currentUserId;
    const deltaRating = player.rating_change;

    return (
      <div className="flex flex-col items-center space-y-1.5 relative group shrink-0">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0F172A] border-2 border-slate-700 text-white font-black text-xl sm:text-2xl flex items-center justify-center shadow-md relative overflow-hidden">
          {player.profile?.avatar_url ? (
            <img src={player.profile.avatar_url} alt={nombre} className="w-full h-full object-cover" />
          ) : (
            <span>{inicial}</span>
          )}
        </div>
        <p className="text-xs font-black text-slate-900 truncate max-w-[100px] text-center">{nombre}</p>
        
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#00FF9D] text-slate-950 shadow-2xs">
            {cat}
          </span>
          {isGamePlayed && deltaRating !== undefined && deltaRating !== null && (
            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
              deltaRating > 0 ? "bg-emerald-100 text-emerald-800" : deltaRating < 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-600"
            }`}>
              {deltaRating > 0 ? `+${deltaRating}` : deltaRating} Rating
            </span>
          )}
        </div>

        {isCreator && !esYo && !isGamePlayed && (
          <button
            type="button"
            onClick={() => onRemove(player.id)}
            className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 rounded-full text-xs font-black flex items-center justify-center shadow-md hover:bg-rose-600 cursor-pointer z-10"
            title="Remover Jugador"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  if (isGamePlayed) return null;

  return (
    <div className="flex flex-col items-center space-y-1.5 shrink-0">
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