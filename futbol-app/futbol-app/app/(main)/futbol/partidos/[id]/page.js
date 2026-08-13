"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// ==========================================
// FUNCIONES AUXILIARES Y DE FECHA (ZONA CARACAS)
// ==========================================
function formatFechaCompleta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Caracas",
  });
}

function formatHora12(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Caracas",
  }).toUpperCase();
}

function obtenerFormatoFutbol(capacity) {
  const cap = parseInt(capacity, 10);
  if (cap === 10) return "Fútbol 5";
  if (cap === 12) return "Fútbol 6";
  if (cap === 14) return "Fútbol 7";
  if (cap === 16) return "Fútbol 8";
  if (cap === 18) return "Fútbol 9";
  if (cap === 22) return "Fútbol 11";
  if (cap > 0) return `Fútbol ${Math.floor(cap / 2)}`;
  return "Fútbol";
}

function obtenerPrecioCupoReal(partido) {
  if (!partido) return 0;
  
  const capBD = Number(partido.court?.capacity) || 12;
  const basePriceDB = Number(partido.total_price) || 0;
  const feeDB = Number(partido.app_fee) || (basePriceDB * 0.10);
  const pricePerPlayerDB = Number(partido.price_per_player) || 0;

  if (basePriceDB >= 5) {
    const totalConFee = basePriceDB + feeDB;
    return totalConFee / capBD;
  }

  if (pricePerPlayerDB >= 0.50) {
    return pricePerPlayerDB;
  }

  const precioNormalCancha = Number(partido.court?.price_normal) || 10;
  const totalEstimado = precioNormalCancha * 1.10;
  return totalEstimado / capBD;
}

function iniciales(nombre) {
  return (nombre || "J").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function promedioMedia(lista) {
  if (!lista.length) return 0;
  return Math.round(lista.reduce((acc, j) => acc + (j.media || 64), 0) / lista.length);
}

function balancearEquipos(jugadores) {
  const ordenados = [...jugadores].sort((a, b) => (b.media || 64) - (a.media || 64));
  const equipo1 = [];
  const equipo2 = [];
  let suma1 = 0;
  let suma2 = 0;

  ordenados.forEach((j) => {
    if (suma1 <= suma2) {
      equipo1.push(j.id);
      suma1 += (j.media || 64);
    } else {
      equipo2.push(j.id);
      suma2 += (j.media || 64);
    }
  });

  return { equipo1, equipo2 };
}

function JugadorCard({ jugador, modo, onCambiarEquipo, valorGol, onGolChange, dragHandleProps, isDragging }) {
  const esNuevo = jugador.partidosJugados === 0;

  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl border p-3 transition-shadow ${isDragging ? "shadow-lg ring-2 ring-emerald-500/40 border-emerald-500/30" : "shadow-sm border-gray-100"}`}>
      {modo === "armar" && (
        <button {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 touch-none p-1 -ml-1 shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-5" fill="currentColor"><circle cx="8" cy="6" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="6" r="1.5" /><circle cx="16" cy="12" r="1.5" /><circle cx="16" cy="18" r="1.5" /></svg>
        </button>
      )}

      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-800 shrink-0 overflow-hidden">
        {jugador.avatarUrl ? <img src={jugador.avatarUrl} alt={jugador.nombre} className="w-full h-full object-cover" /> : iniciales(jugador.nombre)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800 truncate">{jugador.nombre}</p>
        {esNuevo ? (
          <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 rounded-full px-2 py-0.5">NUEVO</span>
        ) : (
          <span className="inline-block mt-1 text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{jugador.partidosJugados} PJ</span>
        )}
      </div>

      {modo === "armar" && onCambiarEquipo && (
        <button onClick={onCambiarEquipo} className="text-sm font-semibold text-gray-300 hover:text-emerald-600 shrink-0 p-1 cursor-pointer">⇄</button>
      )}

      {modo === "jugando" && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-400 font-bold uppercase">Goles</span>
          <input type="number" min="0" value={valorGol ?? 0} onChange={onGolChange} className="w-12 rounded-lg border border-gray-200 px-2 py-1 text-sm font-bold text-center bg-gray-50 focus:bg-white" />
        </div>
      )}

      {modo === "resultado" && (
        <span className="text-sm font-black text-emerald-800 shrink-0">{jugador.goles} ⚽</span>
      )}
    </div>
  );
}

function JugadorDraggable({ jugador, modo, onCambiarEquipo, valorGol, onGolChange }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: jugador.id, disabled: modo !== "armar" });
  const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : "auto", position: "relative" } : undefined;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      <JugadorCard jugador={jugador} modo={modo} onCambiarEquipo={onCambiarEquipo} valorGol={valorGol} onGolChange={onGolChange} dragHandleProps={{ ...attributes, ...listeners }} isDragging={isDragging} />
    </div>
  );
}

function EquipoColumna({ id, titulo, jugadores, onEliminar, victorias, onModificarWin, modo, esMultiEquipo, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const partidoEnCurso = modo === "jugando";
  const partidoNoIniciado = modo === "armar";

  return (
    <div ref={setNodeRef} className={`bg-white rounded-2xl p-5 shadow-sm border transition-colors ${isOver ? "border-emerald-500 bg-emerald-50/50" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-bold text-gray-800 truncate">{titulo}</h2>
          {onEliminar && modo === "armar" && (
            <button
              type="button"
              onClick={onEliminar}
              className="bg-rose-500 hover:bg-rose-600 text-white font-black text-[9px] uppercase px-2.5 py-1 rounded-xl transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              Borrar Equipo
            </button>
          )}
        </div>
        {jugadores.length > 0 && <span className="text-xs font-semibold text-gray-400 shrink-0">Media: <span className="text-gray-700 font-bold">{promedioMedia(jugadores)}</span></span>}
      </div>

      {esMultiEquipo && modo !== "resultado" && (
        <div className={`p-2.5 rounded-xl mb-3 flex items-center justify-between text-xs font-bold transition-all ${
          partidoEnCurso 
            ? "bg-slate-900 text-white shadow-xs border border-emerald-500/50" 
            : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60"
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{partidoEnCurso ? "🏆" : "🔒"}</span>
            <span className={`font-black uppercase text-[10px] tracking-wider ${partidoEnCurso ? "text-[#00FF9D]" : "text-slate-500"}`}>
              {partidoEnCurso ? "Victorias / Retas" : "Victorias (Partido no iniciado)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onModificarWin(-1)}
              disabled={partidoNoIniciado}
              className={`w-6 h-6 rounded-md flex items-center justify-center font-black transition-all ${
                partidoNoIniciado
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              }`}
            >
              -
            </button>
            <span className={`text-base font-black px-1 ${partidoEnCurso ? "text-white" : "text-slate-500"}`}>
              {victorias || 0}
            </span>
            <button
              type="button"
              onClick={() => onModificarWin(1)}
              disabled={partidoNoIniciado}
              className={`w-6 h-6 rounded-md flex items-center justify-center font-black transition-all ${
                partidoNoIniciado
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-[#00FF9D] text-slate-950 hover:bg-emerald-400 cursor-pointer"
              }`}
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 min-h-[70px]">
        {jugadores.length === 0 ? <p className="text-xs text-gray-300 text-center py-4 font-medium">Sin jugadores</p> : children}
      </div>
    </div>
  );
}

export default function FutbolPartidoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id;

  const [mounted, setMounted] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [goles, setGoles] = useState({});
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [equiposList, setEquiposList] = useState([1, 2]);
  const [wins, setWins] = useState({ 1: 0, 2: 0 });

  const [inscrito, setInscrito] = useState(false);
  const [tasaBCV, setTasaBCV] = useState(36.65);

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // ESTADOS PAGO ORGANIZADOR
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [formPago, setFormPago] = useState({
    monto: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });
  const [enviandoPago, setEnviandoPago] = useState(false);

  // ESTADOS PAGO JUGADOR AL UNIRSE
  const [modalUnirmePagoOpen, setModalUnirmePagoOpen] = useState(false);
  const [monedaUnirme, setMonedaUnirme] = useState("USD");
  const [formUnirmePago, setFormUnirmePago] = useState({
    monto: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });
  const [enviandoUnirmePago, setEnviandoUnirmePago] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setMounted(true);
  }, []);

  const esCreador = usuarioActual?.id === partido?.created_by;
  const esPrivado = partido?.is_private || partido?.match_type === "privado";

  const cuposTotales = partido?.court?.capacity || 12; 
  const cuposMinimos = 6;

  // CÁLCULO DE PRECIO DEL CUPO INDIVIDUAL
  const costoCupoIndividual = useMemo(() => {
    if (esPrivado || esCreador) return 0;
    return obtenerPrecioCupoReal(partido);
  }, [partido, esPrivado, esCreador]);

  // FILTRAR JUGADORES CONFIRMADOS Y PENDIENTES DE PAGO
  const { jugadoresConfirmados, jugadoresPendientes } = useMemo(() => {
    const historial = Array.isArray(partido?.payments_history) ? partido.payments_history : [];

    const confirmados = [];
    const pendientes = [];

    jugadores.forEach((j) => {
      if (j.user_id === partido?.created_by || esPrivado) {
        confirmados.push({ ...j, pagoStatus: "aprobado" });
        return;
      }

      const abonoUser = historial.find((a) => a.user_id === j.user_id);
      
      if (abonoUser) {
        if (abonoUser.status === "aprobado" || abonoUser.status === "liquidado" || abonoUser.status === "pago_en_sitio") {
          confirmados.push({ ...j, pagoStatus: "aprobado" });
        } else if (abonoUser.status === "pendiente" || abonoUser.status === "pendiente_aprobacion") {
          pendientes.push({ ...j, pagoStatus: "pendiente", abono: abonoUser });
        } else {
          pendientes.push({ ...j, pagoStatus: "rechazado", abono: abonoUser });
        }
      } else {
        confirmados.push({ ...j, pagoStatus: "aprobado" });
      }
    });

    return { jugadoresConfirmados: confirmados, jugadoresPendientes: pendientes };
  }, [jugadores, partido, esPrivado]);

  const miJugadorInfo = useMemo(() => {
    return jugadores.find((j) => j.user_id === usuarioActual?.id);
  }, [jugadores, usuarioActual]);

  const miEstadoPago = useMemo(() => {
    if (!usuarioActual || !partido) return null;
    if (esCreador || esPrivado) return "aprobado";

    const historial = Array.isArray(partido.payments_history) ? partido.payments_history : [];
    const miAbono = historial.find((a) => a.user_id === usuarioActual.id);
    
    if (!miAbono) return miJugadorInfo ? "aprobado" : null;
    return miAbono.status;
  }, [usuarioActual, partido, esCreador, esPrivado, miJugadorInfo]);

  const estaInscrito = !!miJugadorInfo || inscrito;
  const cuposOcupados = jugadoresConfirmados.length;
  const lleno = cuposOcupados >= cuposTotales;

  const equipo1 = useMemo(() => jugadoresConfirmados.filter((j) => j.equipo === 1), [jugadoresConfirmados]);
  const equipo2 = useMemo(() => jugadoresConfirmados.filter((j) => j.equipo === 2), [jugadoresConfirmados]);
  const sinAsignar = useMemo(() => jugadoresConfirmados.filter((j) => !equiposList.includes(j.equipo)), [jugadoresConfirmados, equiposList]);

  const partidoIniciado = partido?.status === "en_curso" || partido?.status === "jugado";
  const modoDnd = partido?.status === "jugado" ? "resultado" : partido?.status === "en_curso" ? "jugando" : "armar";

  const horasHastaPartido = useMemo(() => {
    if (!partido?.scheduled_at) return 999;
    const diffMs = new Date(partido.scheduled_at).getTime() - new Date().getTime();
    return diffMs / (1000 * 60 * 60);
  }, [partido]);

  const calculosPagoReserva = useMemo(() => {
    const base = Number(partido?.total_price) || 30;
    const fee = Number(partido?.app_fee) || (base * 0.10);
    const totalCancha = base + fee;

    const historial = Array.isArray(partido?.payments_history) ? partido.payments_history : [];
    const totalAbonado = historial
      .filter((a) => a.status === "aprobado" || a.status === "pendiente")
      .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

    const restante = Math.max(0, totalCancha - totalAbonado);
    return { totalCancha, totalAbonado, restante, historial };
  }, [partido]);

  const tablaPosiciones = useMemo(() => {
    return equiposList.map((eqNum) => {
      const integrantes = jugadoresConfirmados.filter(j => j.equipo === eqNum);
      const victorias = wins[eqNum] || 0;
      const golesTotales = integrantes.reduce((acc, j) => acc + (Number(goles[j.id]) || Number(j.goles) || 0), 0);
      const mediaPromedio = promedioMedia(integrantes);

      return {
        eqNum,
        victorias,
        golesTotales,
        mediaPromedio,
        integrantes,
      };
    }).sort((a, b) => {
      if (b.victorias !== a.victorias) return b.victorias - a.victorias;
      if (b.golesTotales !== a.golesTotales) return b.golesTotales - a.golesTotales;
      return b.mediaPromedio - a.mediaPromedio;
    });
  }, [equiposList, jugadoresConfirmados, wins, goles]);

  const resultadoInfo = useMemo(() => {
    if (partido?.status !== "jugado") return null;

    let g1 = equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || Number(j.goles) || 0), 0);
    let g2 = equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || Number(j.goles) || 0), 0);

    let equipoGanador = 0;
    if (g1 > g2) equipoGanador = 1;
    else if (g2 > g1) equipoGanador = 2;

    let mvp = null;
    if (jugadoresConfirmados.length > 0) {
      const ordenadosPorGoles = [...jugadoresConfirmados].sort((a, b) => (Number(goles[b.id]) || Number(b.goles) || 0) - (Number(goles[a.id]) || Number(a.goles) || 0));
      const maxGoles = Number(goles[ordenadosPorGoles[0]?.id]) || Number(ordenadosPorGoles[0]?.goles) || 0;
      if (maxGoles > 0) {
        mvp = { ...ordenadosPorGoles[0], golesMvp: maxGoles };
      }
    }

    return { g1, g2, equipoGanador, mvp };
  }, [partido, equipo1, equipo2, jugadoresConfirmados, goles]);

  useEffect(() => {
    obtenerTasaBCV();
    if (!matchId || !supabase) return;
    cargarDatos();

    const channel = supabase
      .channel(`realtime-match-players-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` }, () => cargarDatos())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => cargarDatos())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  async function obtenerTasaBCV() {
    try {
      const res = await fetch("/api/bcv-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) return setTasaBCV(parseFloat(data.usdRate));
      }
      const resFallback = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
      if (resFallback.ok) {
        const dataFallback = await resFallback.json();
        if (dataFallback?.promedio) return setTasaBCV(parseFloat(dataFallback.promedio));
      }
    } catch (e) {
      console.warn("Fallo al obtener Tasa BCV", e);
    }
  }

  async function cargarDatos() {
    if (!supabase || !matchId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUsuarioActual(user);

      const { data: partidoData } = await supabase
        .from("matches")
        .select(`
          id, created_by, scheduled_at, status, is_private, price_per_player, total_price, app_fee, match_type, score_text, winner_team, payment_status, payments_history, payment_proof_urls,
          club:clubs(name, city, address, phone, amenities),
          court:courts(name, sport_type, capacity, price_normal)
        `)
        .eq("id", matchId)
        .maybeSingle();

      if (!partidoData) return setCargando(false);
      setPartido(partidoData);

      if (partidoData.score_text) {
        try {
          const parsed = JSON.parse(partidoData.score_text);
          if (parsed && typeof parsed === "object" && parsed.wins) {
            setWins(parsed.wins);
          }
        } catch (e) {}
      }

      const { data: inscripciones } = await supabase
        .from("match_players")
        .select("id, user_id, team, goals")
        .eq("match_id", matchId);

      let listaInscripciones = [...(inscripciones || [])];

      if (partidoData.created_by && !listaInscripciones.some(i => i.user_id === partidoData.created_by)) {
        listaInscripciones.push({
          id: `creador-${partidoData.created_by}`,
          user_id: partidoData.created_by,
          team: "A",
          goals: 0,
        });
      }

      if (listaInscripciones.length > 0) {
        const idsUsuarios = Array.from(new Set(listaInscripciones.map((i) => i.user_id).filter(Boolean)));
        let perfilesGlobales = {};
        let perfilesFutbol = {};

        if (idsUsuarios.length > 0) {
          const { data: pGlobales } = await supabase.from("profiles").select("id, nombre, apellido, avatar_url").in("id", idsUsuarios);
          (pGlobales || []).forEach(p => { perfilesGlobales[p.id] = p; });

          const { data: pFutbol } = await supabase.from("futbol_profiles").select("id, rating, partidos_jugados").in("id", idsUsuarios);
          (pFutbol || []).forEach(p => { perfilesFutbol[p.id] = p; });
        }

        const listaEnriquecida = listaInscripciones.map(i => {
          const pGlob = perfilesGlobales[i.user_id];
          const fPerfil = perfilesFutbol[i.user_id];
          let numEq = i.team === "B" || i.team === "2" ? 2 : 1;

          return {
            id: i.id,
            user_id: i.user_id,
            equipo: numEq,
            goles: Number(i.goals) || 0,
            nombre: pGlob?.nombre ? `${pGlob.nombre} ${pGlob.apellido || ""}`.trim() : (i.user_id === partidoData.created_by ? "Organizador" : "Jugador"),
            avatarUrl: pGlob?.avatar_url || null,
            media: fPerfil?.rating != null ? Math.round(Number(fPerfil.rating)) : 64,
            partidosJugados: fPerfil?.partidos_jugados ?? 0,
          };
        });

        setJugadores(listaEnriquecida);

        const maxEqActual = Math.max(...listaEnriquecida.map(j => j.equipo), 2);
        setEquiposList(Array.from({ length: maxEqActual }, (_, idx) => idx + 1));

        const golesIniciales = {};
        listaEnriquecida.forEach((j) => { golesIniciales[j.id] = j.goles; });
        setGoles(golesIniciales);

        if (user) {
          const miInsc = listaEnriquecida.find(i => i.user_id === user.id);
          setInscrito(!!miInsc);
        }
      } else {
        setJugadores([]);
        setInscrito(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  const agregarEquipoExtra = () => {
    const nuevoNum = equiposList.length + 1;
    setEquiposList((prev) => [...prev, nuevoNum]);
    setWins((prev) => ({ ...prev, [nuevoNum]: 0 }));
  };

  async function eliminarEquipoExtra(eqNum) {
    if (equiposList.length <= 2 || eqNum <= 2) return;
    setProcesando(true);

    try {
      const afectados = jugadores.filter(j => j.equipo === eqNum);
      if (afectados.length > 0) {
        await Promise.all(
          afectados.map(j =>
            supabase.from("match_players").update({ team: "A" }).match({ match_id: matchId, user_id: j.user_id })
          )
        );
      }

      setJugadores(prev => prev.map(j => (j.equipo === eqNum ? { ...j, equipo: 1 } : j)));
      setEquiposList(prev => prev.filter(num => num !== eqNum));
      setWins(prev => {
        const copy = { ...prev };
        delete copy[eqNum];
        return copy;
      });
      setMensaje(`Equipo ${eqNum} eliminado. Los jugadores fueron movidos al Equipo 1.`);
    } catch (err) {
      console.error("Error al eliminar equipo extra:", err);
      setMensaje("Error eliminando el equipo.");
    } finally {
      setProcesando(false);
    }
  }

  const modificarWin = (eqNum, delta) => {
    setWins(prev => ({
      ...prev,
      [eqNum]: Math.max(0, (prev[eqNum] || 0) + delta)
    }));
  };

  async function cambiarEquipo(inscripcionIdTarget, nuevoEquipo) {
    setProcesando(true);
    const targetJugador = jugadores.find(j => j.id === inscripcionIdTarget);
    if (!targetJugador) return setProcesando(false);

    const teamLetter = nuevoEquipo === 2 ? "B" : "A";
    await supabase.from("match_players").update({ team: teamLetter }).match({ match_id: matchId, user_id: targetJugador.user_id });
    setJugadores((prev) => prev.map((j) => (j.id === inscripcionIdTarget ? { ...j, equipo: nuevoEquipo } : j)));
    setProcesando(false);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    
    let targetEquipo = null;
    if (over.id.startsWith("equipo-")) {
      const parts = over.id.split("-");
      if (parts[1] !== "null") targetEquipo = parseInt(parts[1], 10);
    }

    const jugador = jugadoresConfirmados.find((j) => j.id === active.id);
    if (!jugador || jugador.equipo === targetEquipo) return;
    cambiarEquipo(jugador.id, targetEquipo);
  }

  async function sortearEquipos() {
    if (jugadoresConfirmados.length < cuposMinimos) return setMensaje(`Necesitas al menos ${cuposMinimos} jugadores confirmados.`);
    setProcesando(true);
    const { equipo1: eq1Ids, equipo2: eq2Ids } = balancearEquipos(jugadoresConfirmados);

    const updates = [
      ...eq1Ids.map((id) => supabase.from("match_players").update({ team: "A" }).match({ match_id: matchId, user_id: jugadoresConfirmados.find(x => x.id === id)?.user_id })),
      ...eq2Ids.map((id) => supabase.from("match_players").update({ team: "B" }).match({ match_id: matchId, user_id: jugadoresConfirmados.find(x => x.id === id)?.user_id })),
    ];
    await Promise.all(updates);

    setJugadores((prev) => prev.map((j) => ({ ...j, equipo: eq1Ids.includes(j.id) ? 1 : 2 })));
    setMensaje("Equipos sorteados de forma equilibrada.");
    setProcesando(false);
  }

  async function comenzarPartido() {
    setProcesando(true);
    await supabase.from("matches").update({ status: "en_curso" }).eq("id", matchId);
    setPartido((prev) => ({ ...prev, status: "en_curso" }));
    setMensaje("¡El partido ha comenzado!");
    setProcesando(false);
  }

  async function finalizarPartido() {
    setProcesando(true);

    await Promise.all(
      jugadoresConfirmados.map((j) =>
        supabase.from("match_players").update({ goals: Number(goles[j.id]) || 0 }).match({ match_id: matchId, user_id: j.user_id })
      )
    );

    let scorePayload = "";
    let ganadorFinal = "EMPATE";

    if (equiposList.length > 2) {
      const topTeam = tablaPosiciones[0];
      ganadorFinal = `EQUIPO ${topTeam.eqNum}`;
      scorePayload = JSON.stringify({
        mode: "triangular",
        wins,
        topTeam: topTeam.eqNum,
      });
    } else {
      const g1 = equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
      const g2 = equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
      ganadorFinal = g1 > g2 ? "A" : g2 > g1 ? "B" : "EMPATE";
      scorePayload = `${g1} - ${g2}`;
    }

    await supabase.from("matches").update({ status: "jugado", winner_team: ganadorFinal, score_text: scorePayload }).eq("id", matchId);

    try {
      const userIds = jugadoresConfirmados.map(j => j.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: dbProfiles } = await supabase.from("futbol_profiles").select("*").in("id", userIds);
        const profilesMap = {};
        (dbProfiles || []).forEach(p => { profilesMap[p.id] = p; });

        const { data: catLogros } = await supabase.from("logros").select("*");
        const userLogrosToInsert = [];

        for (const j of jugadoresConfirmados) {
          if (!j.user_id) continue;
          const currentP = profilesMap[j.user_id] || { id: j.user_id, partidos_jugados: 0, goles: 0, victorias: 0, derrotas: 0, rating: 64 };

          const pjGoles = Number(goles[j.id]) || Number(j.goles) || 0;
          const newPj = (currentP.partidos_jugados || 0) + 1;
          const newGoles = (currentP.goles || 0) + pjGoles;

          let esGano = false;
          let esPerdio = false;

          if (ganadorFinal !== "EMPATE") {
            if (equiposList.length > 2) {
              const topTeamNum = tablaPosiciones[0]?.eqNum;
              if (j.equipo === topTeamNum) esGano = true;
              else esPerdio = true;
            } else {
              if ((ganadorFinal === "A" && j.equipo === 1) || (ganadorFinal === "B" && j.equipo === 2)) {
                esGano = true;
              } else {
                esPerdio = true;
              }
            }
          }

          const newWins = (currentP.victorias || 0) + (esGano ? 1 : 0);
          const newLosses = (currentP.derrotas || 0) + (esPerdio ? 1 : 0);

          let ratingBoost = 0;
          if (esGano) ratingBoost += 1;
          if (resultadoInfo?.mvp && resultadoInfo.mvp.user_id === j.user_id) ratingBoost += 1.5;
          ratingBoost += Math.min(pjGoles * 0.5, 3);
          const newRating = Math.min(99, Math.max(50, (Number(currentP.rating) || 64) + ratingBoost));

          await supabase.from("futbol_profiles").upsert({
            id: j.user_id,
            partidos_jugados: newPj,
            goles: newGoles,
            victorias: newWins,
            derrotas: newLosses,
            rating: newRating
          });

          if (catLogros && catLogros.length > 0) {
            for (const l of catLogros) {
              const tituloLower = (l.titulo || "").toLowerCase();
              const descLower = (l.descripcion || "").toLowerCase();

              let cumple = false;
              if (tituloLower.includes("debut") || descLower.includes("primer partido") || descLower.includes("1 partido")) if (newPj >= 1) cumple = true;
              if (tituloLower.includes("gol") || descLower.includes("primer gol") || descLower.includes("1 gol")) if (newGoles >= 1) cumple = true;
              if (descLower.includes("5 gol") || descLower.includes("cinco gol")) if (newGoles >= 5) cumple = true;
              if (descLower.includes("10 gol") || descLower.includes("diez gol")) if (newGoles >= 10) cumple = true;
              if (descLower.includes("victoria") || descLower.includes("ganar")) if (newWins >= 1) cumple = true;
              if (tituloLower.includes("mvp") || descLower.includes("mvp")) if (resultadoInfo?.mvp && resultadoInfo.mvp.user_id === j.user_id) cumple = true;

              if (cumple) {
                userLogrosToInsert.push({ user_id: j.user_id, logro_id: l.id });
              }
            }
          }
        }

        if (userLogrosToInsert.length > 0) {
          await supabase.from("user_logros").upsert(userLogrosToInsert, { onConflict: "user_id,logro_id" });
        }
      }
    } catch (eErr) {
      console.error("Error actualizando estadísticas:", eErr);
    }

    setPartido((prev) => ({ ...prev, status: "jugado", score_text: scorePayload }));
    setMensaje("¡Reserva y partido finalizados con éxito!");
    setProcesando(false);
    await cargarDatos();
  }

  const handleClicUnirme = () => {
    if (!usuarioActual) return router.push("/login");

    if (costoCupoIndividual > 0) {
      setFormUnirmePago({
        monto: costoCupoIndividual.toFixed(2),
        metodoPago: "pago_movil",
        numReferencia: "",
        previewComprobante: "",
      });
      setMonedaUnirme("USD");
      setModalUnirmePagoOpen(true);
    } else {
      confirmarUnirseSinPago();
    }
  };

  async function confirmarUnirseSinPago() {
    setProcesando(true);
    try {
      const teamLetra = (equipo1.length <= equipo2.length) ? "A" : "B";
      await supabase.from("match_players").insert({ match_id: partido.id, user_id: usuarioActual.id, team: teamLetra, goals: 0 });
      setInscrito(true);
      setMensaje("¡Te has unido al partido con éxito!");
      await cargarDatos();
    } catch (err) {
      setMensaje("Error al unirte al partido.");
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarUnirseConPago(e) {
    e.preventDefault();
    if (!usuarioActual || !partido) return;

    const valIngresado = parseFloat(formUnirmePago.monto);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return setMensaje("Ingresa un monto de pago válido.");
    }

    if (formUnirmePago.metodoPago !== "efectivo" && !formUnirmePago.previewComprobante && !formUnirmePago.numReferencia.trim()) {
      return setMensaje("Por favor adjunta el comprobante o número de referencia.");
    }

    try {
      setEnviandoUnirmePago(true);
      
      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", usuarioActual.id)
        .maybeSingle();

      const nombreCompleto = userProf
        ? `${userProf.nombre || ''} ${userProf.apellido || ''}`.trim()
        : usuarioActual.email;

      const montoUSD = monedaUnirme === "VES" ? valIngresado / tasaBCV : valIngresado;

      const nuevoAbonoCupo = {
        id: `pay-cupo-${Date.now()}`,
        user_id: usuarioActual.id,
        user_name: nombreCompleto,
        user_phone: userProf?.telefono || "Sin teléfono",
        amount: montoUSD,
        method: formUnirmePago.metodoPago,
        reference: formUnirmePago.numReferencia.trim() || (monedaUnirme === "VES" ? `Bs. ${valIngresado.toFixed(2)}` : "Cupo Partido Abierto"),
        receipt_url: formUnirmePago.previewComprobante || null,
        status: formUnirmePago.metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const historialNuevo = [...(partido.payments_history || []), nuevoAbonoCupo];

      const { error: errMatch } = await supabase
        .from("matches")
        .update({ 
          payments_history: historialNuevo,
          payment_status: "pendiente_aprobacion"
        })
        .eq("id", partido.id);

      if (errMatch) throw errMatch;

      const teamLetra = (equipo1.length <= equipo2.length) ? "A" : "B";

      const { error: errPlayer } = await supabase
        .from("match_players")
        .insert({
          match_id: partido.id,
          user_id: usuarioActual.id,
          team: teamLetra,
          goals: 0
        });

      if (errPlayer) throw errPlayer;

      setInscrito(true);
      setModalUnirmePagoOpen(false);
      setMensaje("¡Comprobante enviado con éxito! Tu cupo está en revisión de pago.");
      await cargarDatos();

    } catch (err) {
      console.error("Error al unirse al partido:", err);
      setMensaje(err.message || "Error al procesar la inscripción.");
    } finally {
      setEnviandoUnirmePago(false);
    }
  }

  async function cancelarInscripcion() {
    if (!confirm("¿Seguro que deseas cancelar tu inscripción?")) return;
    setProcesando(true);
    await supabase.from("match_players").delete().match({ match_id: partido.id, user_id: usuarioActual.id });
    setInscrito(false);
    await cargarDatos();
    setProcesando(false);
  }

  async function cancelarReservaOrganizador() {
    if (!partido || !usuarioActual) return;
    const esMenorA6Horas = horasHastaPartido < 6;
    let mensajeConfirmacion = "¿Estás seguro de que deseas cancelar y anular esta reserva de cancha?";

    if (esMenorA6Horas) {
      mensajeConfirmacion = "⚠️ ATENCIÓN: Falta menos de 6 horas para la reserva. Según nuestras políticas, si cancelas ahora TU DINERO / ABONO NO SERÁ REEMBOLSADO.\n\n¿Deseas cancelar la reserva y liberar la cancha de todos modos?";
    }

    if (!confirm(mensajeConfirmacion)) return;

    setProcesando(true);
    try {
      await supabase.from("matches").update({ status: "cancelado" }).eq("id", matchId);
      alert("Reserva cancelada con éxito.");
      router.push("/futbol");
    } catch (err) {
      setMensaje("Error al cancelar la reserva.");
      setProcesando(false);
    }
  }

  async function enviarAbonoExtra() {
    if (!usuarioActual || !partido) return;
    const montoValido = parseFloat(formPago.monto);
    if (isNaN(montoValido) || montoValido <= 0) return setMensaje("Ingresa un monto válido.");

    try {
      setEnviandoPago(true);
      const { data: userProf } = await supabase.from("profiles").select("nombre, apellido, telefono").eq("id", usuarioActual.id).maybeSingle();

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: usuarioActual.id,
        user_name: userProf ? `${userProf.nombre} ${userProf.apellido}`.trim() : usuarioActual.email,
        amount: montoValido,
        method: formPago.metodoPago,
        reference: formPago.numReferencia.trim() || "S/R",
        receipt_url: formPago.previewComprobante || null,
        status: formPago.metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const historialNuevo = [...(partido.payments_history || []), nuevoAbono];
      await supabase.from("matches").update({ payments_history: historialNuevo, payment_status: "pendiente_aprobacion" }).eq("id", partido.id);

      setModalPagoOpen(false);
      setMensaje("Comprobante enviado.");
      await cargarDatos();
    } catch (err) {
      setMensaje("Error enviando comprobante.");
    } finally {
      setEnviandoPago(false);
    }
  }

  const handleSeleccionarImagen = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMensaje("Por favor selecciona una imagen válida.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (cargando) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" /></div>;
  if (!partido) return <div className="p-8 text-center"><h1 className="text-xl font-bold">Partido no encontrado</h1></div>;

  const numIngresadoUnirme = parseFloat(formUnirmePago.monto) || 0;
  const equivalenteUnirme = monedaUnirme === "USD" ? numIngresadoUnirme * tasaBCV : numIngresadoUnirme / tasaBCV;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32 pt-4 md:pt-8 font-sans">
      <main className="max-w-3xl mx-auto px-4 flex flex-col gap-6">
        
        {/* HERO BANNER CON INFORMACIÓN COMPLETA DE LA CANCHA Y CLUB */}
        <div className="relative w-full min-h-[280px] md:min-h-[320px] bg-gray-900 rounded-3xl overflow-hidden shadow-xl border border-gray-100 flex flex-col justify-between p-6 sm:p-8">
          <img
            src={partido.club?.image_url || "https://images.unsplash.com/photo-1518605368461-1ee7e53f090b"}
            alt={partido.court?.name || "Cancha"}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-[#0B0C15]/60 to-black/30"></div>

          {/* BARRA SUPERIOR DEL BANNER */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <Link href="/futbol" className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border border-white/10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#00FF9D]/20 text-[#00FF9D] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-[#00FF9D]/30 backdrop-blur-md">
                ⚽ {obtenerFormatoFutbol(partido.court?.capacity)} ({partido.court?.capacity || 12} Jug.)
              </span>
              {esPrivado && (
                <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-indigo-500/30 backdrop-blur-md">
                  🔒 Privado
                </span>
              )}
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md backdrop-blur-md ${
                partido?.status === "jugado" ? "bg-gray-800 text-gray-300" : partido?.status === "en_curso" ? "bg-blue-600 text-white animate-pulse" : "bg-white text-emerald-900"
              }`}>
                {partido?.status === "jugado" ? "Finalizado" : partido?.status === "en_curso" ? "En Curso" : costoCupoIndividual === 0 ? "Gratis" : `$${costoCupoIndividual.toFixed(2)} USD / Cupo`}
              </span>
            </div>
          </div>

          {/* INFORMACIÓN DEL COMPLEJO DENTRO DEL BANNER */}
          <div className="relative z-10 space-y-2 mt-auto pt-6">
            <span className="bg-[#00FF9D] text-slate-950 text-[9px] font-black uppercase px-2.5 py-1 rounded-md shadow-xs inline-block">
              📍 {partido.club?.name || "Complejo Deportivo"}
            </span>

            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
              {partido.court?.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-300 pt-1">
              <span>📍 {partido.club?.address || "Dirección en sede"}, {partido.club?.city}</span>
              {(partido.club?.phone || partido.club?.telefono) && (
                <span className="text-[#00FF9D] font-black">📞 Recepción: {partido.club.phone || partido.club.telefono}</span>
              )}
            </div>
          </div>
        </div>

        {/* FEEDBACK DE PAGO DE CUPO INDIVIDUAL O RESERVA */}
        {estaInscrito && !esCreador && !esPrivado && (
          <div>
            {miEstadoPago === "pendiente" || miEstadoPago === "pendiente_aprobacion" ? (
              <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-3xl flex items-center gap-3.5 shadow-xs">
                <span className="text-3xl animate-pulse shrink-0">⏳</span>
                <div>
                  <h4 className="font-black text-amber-950 text-xs sm:text-sm uppercase tracking-wide">Tu comprobante está en revisión</h4>
                  <p className="text-xs font-semibold text-amber-800 mt-0.5">
                    Enviaste el pago de tu cupo (<strong>${costoCupoIndividual.toFixed(2)} USD</strong>). Una vez que recepción lo apruebe, ingresarás formalmente a la alineación oficial.
                  </p>
                </div>
              </div>
            ) : miEstadoPago === "aprobado" || miEstadoPago === "pago_en_sitio" || miEstadoPago === "liquidado" ? (
              <div className="bg-emerald-50 border-2 border-emerald-300 p-4 rounded-3xl flex items-center gap-3.5 shadow-xs">
                <span className="text-3xl shrink-0">✅</span>
                <div>
                  <h4 className="font-black text-emerald-950 text-xs sm:text-sm uppercase tracking-wide">¡Tu cupo está 100% Pagado y Aprobado!</h4>
                  <p className="text-xs font-bold text-emerald-800 mt-0.5">
                    Tu pago individual ha sido validado correctamente. Ya estás en la alineación oficial del partido.
                  </p>
                </div>
              </div>
            ) : miEstadoPago === "rechazado" ? (
              <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-3xl flex items-center gap-3.5 shadow-xs">
                <span className="text-3xl shrink-0">❌</span>
                <div>
                  <h4 className="font-black text-rose-950 text-xs sm:text-sm uppercase tracking-wide">Comprobante rechazado por recepción</h4>
                  <p className="text-xs font-bold text-rose-800 mt-0.5">
                    La recepción no pudo validar tu pago anterior. Intenta unirte nuevamente e ingresa un número de referencia válido.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ORGANIZADOR Y ESTADO DE RECAUDACIÓN (CLARO PARA PARTIDOS PÚBLICOS) */}
        {esCreador && partido?.status !== "cancelado" && (
          <div className="space-y-4">
            <div className={`p-5 sm:p-6 rounded-3xl border flex flex-col space-y-4 shadow-sm transition-all ${
              calculosPagoReserva.restante === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-950" : "bg-blue-50/80 border-blue-200 text-slate-950"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border bg-blue-100 text-blue-900 border-blue-300">
                    {esPrivado ? (calculosPagoReserva.restante === 0 ? "✅ PAGO COMPLETO" : "⚠️ RESERVA PENDIENTE") : "🌐 RECAUDACIÓN PARTIDO PÚBLICO"}
                  </span>

                  <h4 className="font-black text-base sm:text-lg">
                    {esPrivado ? "Total Reserva: " : "Meta Total de Cancha: "}
                    <span className="text-slate-900">${calculosPagoReserva.totalCancha.toFixed(2)} USD</span>
                  </h4>

                  <p className="text-xs font-semibold opacity-90">
                    Abonado Comunidad: <span className="font-black text-emerald-700">${calculosPagoReserva.totalAbonado.toFixed(2)} USD</span> 
                    {!esPrivado && (
                      <span className="text-slate-500 font-bold block sm:inline sm:ml-2">
                        (A medida que los jugadores se unan, sus cupos de ${costoCupoIndividual.toFixed(2)} irán sumando aquí)
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button onClick={() => setModalPagoOpen(true)} className="bg-slate-900 text-[#00FF9D] font-black text-xs uppercase px-4 py-3 rounded-2xl cursor-pointer">
                    💳 Registrar Pago Extra
                  </button>
                  <button onClick={cancelarReservaOrganizador} disabled={procesando} className="bg-rose-500/10 text-rose-700 hover:bg-rose-500 hover:text-white border border-rose-200 font-black text-xs uppercase px-4 py-3 rounded-2xl transition-all cursor-pointer">
                    🚫 Cancelar Reserva
                  </button>
                </div>
              </div>

              <div className={`p-3 rounded-2xl text-xs font-bold border ${horasHastaPartido < 6 ? "bg-rose-100 text-rose-900 border-rose-200" : "bg-blue-100 text-blue-900 border-blue-200"}`}>
                ⚠️ {horasHastaPartido < 6 ? "Faltan menos de 6h. Si cancelas ahora, tu dinero no será reembolsado." : "Política: Cancelaciones con menos de 6h de anticipación no se reembolsan."}
              </div>
            </div>

            {!partidoIniciado && (
              <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-black text-indigo-900 text-base">👑 Eres el organizador</h3>
                  <p className="text-indigo-700/80 text-xs font-medium">Comparte el enlace a tus amigos para armar los equipos.</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); setMensaje("Enlace copiado."); }} className="bg-indigo-600 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl cursor-pointer">
                  Copiar Enlace
                </button>
              </div>
            )}
          </div>
        )}

        {mensaje && <div className="p-4 rounded-2xl text-sm font-bold text-center border bg-emerald-50 text-emerald-800 border-emerald-200">{mensaje}</div>}

        {/* DETALLES DE FECHA Y HORA */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</p>
              <p className="text-sm font-black text-gray-900 capitalize">{formatFechaCompleta(partido.scheduled_at)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora</p>
              <p className="text-sm font-black text-gray-900">{formatHora12(partido.scheduled_at)}</p>
            </div>
          </div>
        </div>

        {/* JUGADORES EN PROCESO DE VALIDACIÓN DE PAGO */}
        {jugadoresPendientes.length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-amber-200 pb-2">
              <h4 className="text-xs font-black uppercase text-amber-900 flex items-center gap-1.5">
                <span>⏳</span> En Validación de Pago ({jugadoresPendientes.length})
              </h4>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Pendientes por Recepción
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {jugadoresPendientes.map((j) => (
                <div key={j.id} className="bg-white p-2.5 rounded-2xl border border-amber-200 flex justify-between items-center text-xs font-bold shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-slate-900">{j.nombre}</span>
                  </div>
                  <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    Comprobante Enviado
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABLA DE POSICIONES Y RESULTADOS AL FINALIZAR */}
        {modoDnd === "resultado" && (
          <div className="space-y-4 font-sans">
            <style>{`
              @keyframes lightSweep {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(100%); }
                100% { transform: translateX(100%); }
              }
              .animate-sweep {
                animation: lightSweep 2.5s infinite;
              }
            `}</style>

            {equiposList.length > 2 ? (
              <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-6">
                <div className="text-center space-y-1">
                  <span className="text-xs font-black uppercase text-[#00FF9D] tracking-widest bg-[#00FF9D]/10 px-3 py-1 rounded-full border border-[#00FF9D]/20">
                    🏆 Torneo de Retas Finalizado
                  </span>
                  <h2 className="text-2xl font-black text-white">
                    {tablaPosiciones[0] ? `¡CAMPEÓN: EQUIPO ${tablaPosiciones[0].eqNum}! 🎉` : "Tabla Final de Posiciones"}
                  </h2>
                </div>

                <div className="space-y-3">
                  {tablaPosiciones.map((item, index) => {
                    const medallas = ["🥇 1° LUGAR - CAMPEÓN", "🥈 2° LUGAR", "🥉 3° LUGAR"];
                    const medalText = medallas[index] || `${index + 1}° LUGAR`;
                    const borderStyle = index === 0 ? "border-[#00FF9D] bg-emerald-950/40" : index === 1 ? "border-slate-400 bg-slate-800/40" : "border-amber-700 bg-amber-950/20";

                    return (
                      <div key={item.eqNum} className={`p-4 rounded-2xl border-2 ${borderStyle} space-y-2`}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-[#00FF9D] uppercase tracking-wider">{medalText}</span>
                          <span className="text-xs font-bold text-slate-400">Media Equipo: {item.mediaPromedio}</span>
                        </div>

                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <h3 className="text-lg font-black text-white">Equipo {item.eqNum}</h3>
                          <div className="flex items-center gap-4 text-xs font-black">
                            <span className="text-[#00FF9D]">{item.victorias} Wins 🏆</span>
                            <span className="text-slate-300">{item.golesTotales} Goles ⚽</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {item.integrantes.map(j => (
                            <span key={j.id} className="text-[10px] font-bold bg-slate-800 text-slate-200 px-2 py-1 rounded-lg border border-slate-700">
                              {j.nombre} ({j.goles} ⚽)
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              resultadoInfo && (
                <div className="rounded-3xl p-6 text-center text-white shadow-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500/30 space-y-3 relative overflow-hidden">
                  <div className="inline-block bg-[#00FF9D] text-slate-950 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
                    {resultadoInfo.equipoGanador === 1 
                      ? "🏆 ¡VICTORIA DEL EQUIPO 1!" 
                      : resultadoInfo.equipoGanador === 2 
                        ? "🏆 ¡VICTORIA DEL EQUIPO 2!" 
                        : "🤝 EMPATE APASIONANTE"}
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 pt-2">
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Equipo 1</span>
                      <span className="text-4xl sm:text-5xl font-black text-white">{resultadoInfo.g1}</span>
                    </div>
                    <span className="text-2xl font-black text-[#00FF9D] mt-4">-</span>
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Equipo 2</span>
                      <span className="text-4xl sm:text-5xl font-black text-white">{resultadoInfo.g2}</span>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* RECONOCIMIENTO MVP INDIVIDUAL */}
            {resultadoInfo?.mvp && (
              <div className="relative overflow-hidden bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 text-amber-950 shadow-xl flex items-center justify-between">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-sweep pointer-events-none" />

                <div className="flex items-center gap-3.5 z-10">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-950 text-[#00FF9D] font-black text-2xl flex items-center justify-center border-2 border-amber-300 shadow-md overflow-hidden shrink-0">
                    {resultadoInfo.mvp.avatarUrl ? (
                      <img src={resultadoInfo.mvp.avatarUrl} alt={resultadoInfo.mvp.nombre} className="w-full h-full object-cover" />
                    ) : (
                      "👑"
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full shadow-xs">
                        👑 MVP DEL PARTIDO
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-black text-amber-950 leading-tight mt-1">{resultadoInfo.mvp.nombre}</h3>
                    <p className="text-xs font-extrabold text-amber-900/80">Máximo anotador del encuentro</p>
                  </div>
                </div>

                <div className="text-right z-10 shrink-0">
                  <span className="text-2xl sm:text-4xl font-black text-amber-950 block leading-none">{resultadoInfo.mvp.golesMvp} ⚽</span>
                  <span className="text-[10px] font-black uppercase text-amber-900/80 block mt-1">Goles Totales</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTENEDOR DE JUGADORES CONFIRMADOS EN LA ALINEACIÓN */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="text-lg font-black text-gray-900">Alineaciones y Equipos</h3>
              <p className="text-xs font-bold text-gray-400">{cuposOcupados} / {cuposTotales} Jugadores Confirmados</p>
            </div>
            {esCreador && esPrivado && modoDnd !== "resultado" && (
              <button onClick={agregarEquipoExtra} className="px-3.5 py-2 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl cursor-pointer">
                + Agregar Equipo {equiposList.length + 1}
              </button>
            )}
          </div>

          {esCreador && partido?.status !== "jugado" ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {equiposList.map((eqNum) => (
                  <EquipoColumna
                    key={eqNum}
                    id={`equipo-${eqNum}`}
                    titulo={`Equipo ${eqNum}`}
                    jugadores={jugadoresConfirmados.filter(j => j.equipo === eqNum)}
                    onEliminar={(equiposList.length > 2 && eqNum > 2) ? () => eliminarEquipoExtra(eqNum) : null}
                    victorias={wins[eqNum] || 0}
                    onModificarWin={(delta) => modificarWin(eqNum, delta)}
                    modo={modoDnd}
                    esMultiEquipo={equiposList.length > 2}
                  >
                    {jugadoresConfirmados.filter(j => j.equipo === eqNum).map((j) => (
                      <JugadorDraggable
                        key={j.id}
                        jugador={j}
                        modo={modoDnd}
                        valorGol={goles[j.id]}
                        onGolChange={(e) => setGoles({ ...goles, [j.id]: e.target.value })}
                        onCambiarEquipo={() => cambiarEquipo(j.id, eqNum === 1 ? 2 : 1)}
                      />
                    ))}
                  </EquipoColumna>
                ))}
              </div>

              {sinAsignar.length > 0 && (
                <div className="mt-4">
                  <EquipoColumna id="equipo-null" titulo={`Sin Asignar (${sinAsignar.length})`} jugadores={sinAsignar} modo={modoDnd}>
                    {sinAsignar.map((j) => (
                      <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles({ ...goles, [j.id]: e.target.value })} />
                    ))}
                  </EquipoColumna>
                </div>
              )}

              <div className="space-y-3 pt-6 border-t mt-6">
                {modoDnd === "armar" && (
                  <>
                    <button onClick={sortearEquipos} disabled={procesando || jugadoresConfirmados.length < cuposMinimos} className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                      🎲 Sortear equipos equilibrados
                    </button>
                    <button onClick={comenzarPartido} disabled={procesando || jugadoresConfirmados.length < cuposMinimos} className="w-full bg-[#00FF9D] text-slate-950 font-black uppercase tracking-widest hover:bg-[#00e58d] py-3.5 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer">
                      {procesando ? "Procesando…" : "▶ Comenzar partido"}
                    </button>
                  </>
                )}
                {modoDnd === "jugando" && (
                  <button onClick={finalizarPartido} disabled={procesando} className="w-full bg-slate-900 hover:bg-black active:bg-gray-800 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                    {procesando ? "Guardando resultados…" : "🏁 Finalizar partido"}
                  </button>
                )}
              </div>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {equiposList.map((eqNum) => (
                <div key={eqNum} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h4 className="font-black text-xs uppercase text-slate-900">Equipo {eqNum}</h4>
                    {equiposList.length > 2 && (
                      <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {wins[eqNum] || 0} Wins 🏆
                      </span>
                    )}
                  </div>
                  {jugadoresConfirmados.filter(j => j.equipo === eqNum).map(j => (
                    <div key={j.id} className="bg-white p-2.5 rounded-xl border border-slate-100 flex justify-between items-center text-xs font-bold shadow-2xs">
                      <span>{j.nombre}</span>
                      {modoDnd === "resultado" && <span>{j.goles} ⚽</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* BARRA INFERIOR FLOTANTE CON PAGO / CONFIRMACIÓN DE ACCIÓN */}
      {!partidoIniciado && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-slate-900/95 text-white backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-800 z-40 flex items-center justify-between gap-3">
          {estaInscrito ? (
            <>
              <div className="flex items-center gap-2 pl-2">
                <span className={`text-xs font-bold flex items-center gap-1.5 ${
                  miEstadoPago === "pendiente" || miEstadoPago === "pendiente_aprobacion"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}>
                  <span>{miEstadoPago === "pendiente" || miEstadoPago === "pendiente_aprobacion" ? "⏳" : "✅"}</span>
                  <span>
                    {esCreador 
                      ? "Organizador" 
                      : (miEstadoPago === "pendiente" || miEstadoPago === "pendiente_aprobacion")
                        ? "Pago en Revisión"
                        : "Confirmado en Alineación"}
                  </span>
                </span>
              </div>
              {!esCreador && (
                <button onClick={cancelarInscripcion} disabled={procesando} className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-black uppercase text-[11px] rounded-xl border border-rose-500/30 transition-all cursor-pointer">
                  {procesando ? "Procesando..." : "Cancelar mi cupo"}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="pl-2">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">{esPrivado ? "Reserva Privada" : "Reserva tu cupo"}</span>
                <span className="text-xs font-black text-white">{costoCupoIndividual === 0 ? "Gratis" : `$${costoCupoIndividual.toFixed(2)} USD`}</span>
              </div>
              <button onClick={handleClicUnirme} disabled={lleno || procesando} className="px-5 py-2.5 bg-[#00FF9D] text-slate-950 font-black text-xs uppercase rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer">
                {procesando ? "Procesando..." : lleno ? "Partido Lleno" : "Unirme al Partido"}
              </button>
            </>
          )}
        </div>
      )}

      {/* MODAL PAGO JUGADOR AL UNIRSE AL PARTIDO */}
      {mounted && modalUnirmePagoOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 font-sans" onClick={() => setModalUnirmePagoOpen(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ⚽ Unirme a Partido Público
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">{partido.court?.name}</h3>
                <p className="text-xs font-bold text-slate-500">{partido.club?.name}</p>
              </div>
              <button onClick={() => setModalUnirmePagoOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1 cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs font-bold shadow-md">
              <div className="flex justify-between text-[#00FF9D]">
                <span>Tu Cupo Individual (Con Comisión):</span>
                <span className="font-black">${costoCupoIndividual.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-2 text-[10px]">
                <span>Equivalente en Bolívares (Tasa BCV):</span>
                <span className="text-slate-200 font-black">~Bs. {(costoCupoIndividual * tasaBCV).toFixed(2)} VES</span>
              </div>
            </div>

            <form onSubmit={confirmarUnirseConPago} className="space-y-3.5 text-xs font-bold text-slate-700">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-black uppercase text-slate-500">Monto Aportado ({monedaUnirme === "USD" ? "$" : "Bs."})</label>
                  <div className="flex bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => {
                        if (monedaUnirme !== "USD") {
                          const val = parseFloat(formUnirmePago.monto) || 0;
                          setFormUnirmePago({ ...formUnirmePago, monto: val > 0 ? (val / tasaBCV).toFixed(2) : "" });
                          setMonedaUnirme("USD");
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${monedaUnirme === "USD" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"}`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (monedaUnirme !== "VES") {
                          const val = parseFloat(formUnirmePago.monto) || 0;
                          setFormUnirmePago({ ...formUnirmePago, monto: val > 0 ? (val * tasaBCV).toFixed(2) : "" });
                          setMonedaUnirme("VES");
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${monedaUnirme === "VES" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"}`}
                    >
                      Bs. VES
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.01"
                  value={formUnirmePago.monto}
                  onChange={(e) => setFormUnirmePago({ ...formUnirmePago, monto: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-base font-black text-slate-900 outline-none"
                  required
                />

                {numIngresadoUnirme > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900 mt-1.5">
                    <span>🧮 Conversión:</span>
                    <span>
                      {monedaUnirme === "USD"
                        ? `Bs. ${equivalenteUnirme.toFixed(2)} VES`
                        : `$${equivalenteUnirme.toFixed(2)} USD`}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1.5">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 En Sitio" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormUnirmePago({ ...formUnirmePago, metodoPago: m.id })}
                      className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                        formUnirmePago.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {formUnirmePago.metodoPago !== "efectivo" && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      N° de Referencia / ID Transacción *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 123456"
                      value={formUnirmePago.numReferencia}
                      onChange={(e) => setFormUnirmePago({ ...formUnirmePago, numReferencia: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Adjuntar Captura / Comprobante (Opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSeleccionarImagen(e, (img) => setFormUnirmePago({ ...formUnirmePago, previewComprobante: img }))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-1 text-xs outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-900 file:text-[#00FF9D]"
                    />

                    {formUnirmePago.previewComprobante && (
                      <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-24 bg-slate-950 flex items-center justify-center">
                        <img src={formUnirmePago.previewComprobante} alt="Preview Comprobante" className="max-h-24 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={enviandoUnirmePago}
                className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black uppercase text-xs tracking-wider rounded-2xl shadow-md mt-2 cursor-pointer transition-all hover:bg-slate-800"
              >
                {enviandoUnirmePago ? "Enviando..." : "✓ Confirmar Pago y Unirme"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL PAGO ORGANIZADOR */}
      {modalPagoOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalPagoOpen(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Gestión de Pago de Reserva</h3>
                <p className="text-xs font-semibold text-slate-500">Cancha: {partido.court?.name}</p>
              </div>
              <button onClick={() => setModalPagoOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1 cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs font-bold">
              <div className="flex justify-between text-[#00FF9D]">
                <span>Total Reserva Cancha:</span>
                <span className="font-black">${calculosPagoReserva.totalCancha.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Abonado:</span>
                <span>${calculosPagoReserva.totalAbonado.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-amber-400 font-black border-t border-slate-800 pt-2">
                <span>Restante por Pagar:</span>
                <span>${calculosPagoReserva.restante.toFixed(2)} USD</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-3 text-xs font-bold">
              <h4 className="font-black text-emerald-950 uppercase">+ Adjuntar Nuevo Comprobante / Abono</h4>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Monto que Pagas ($)</label>
                <input type="number" step="0.01" value={formPago.monto} onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })} className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 outline-none" placeholder="Ej. 11.00" />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Método de Pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 En Sitio" },
                  ].map((m) => (
                    <button key={m.id} type="button" onClick={() => setFormPago({ ...formPago, metodoPago: m.id })} className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border cursor-pointer ${formPago.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {formPago.metodoPago !== "efectivo" && (
                <>
                  <input type="text" placeholder="Número de Referencia" value={formPago.numReferencia} onChange={(e) => setFormPago({ ...formPago, numReferencia: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold outline-none" />
                  <input type="file" accept="image/*" onChange={(e) => handleSeleccionarImagen(e, (img) => setFormPago((prev) => ({ ...prev, previewComprobante: img })))} className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs font-bold outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-slate-900 file:text-[#00FF9D]" />
                </>
              )}

              <button type="button" onClick={enviarAbonoExtra} disabled={enviandoPago} className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shadow-md cursor-pointer">
                {enviandoPago ? "Enviando..." : "+ Enviar Comprobante Adicional"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}