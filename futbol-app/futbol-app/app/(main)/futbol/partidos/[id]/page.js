"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
// FUNCIONES DE FECHA FORZADAS A ZONA VENEZUELA
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

function EquipoColumna({ id, titulo, jugadores, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={`bg-white rounded-2xl p-5 shadow-sm border transition-colors ${isOver ? "border-emerald-500 bg-emerald-50/50" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-800">{titulo}</h2>
        {jugadores.length > 0 && <span className="text-xs font-semibold text-gray-400">Media: <span className="text-gray-700 font-bold">{promedioMedia(jugadores)}</span></span>}
      </div>
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

  const [cargando, setCargando] = useState(true);
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [goles, setGoles] = useState({});
  const [usuarioActual, setUsuarioActual] = useState(null);
  
  const [inscrito, setInscrito] = useState(false);
  const [inscripcionId, setInscripcionId] = useState(null);

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // ESTADOS GESTIÓN DE PAGO
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [formPago, setFormPago] = useState({
    monto: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });
  const [enviandoPago, setEnviandoPago] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const esCreador = usuarioActual?.id === partido?.created_by;
  const esPrivado = partido?.is_private || partido?.match_type === "privado";
  const costoInscripcion = (esPrivado || esCreador) ? 0 : (partido?.price_per_player ?? 0);

  const cuposTotales = 14; 
  const cuposMinimos = 10;
  const cuposOcupados = jugadores.length;
  const lleno = cuposOcupados >= cuposTotales;
  
  const miJugador = useMemo(() => jugadores.find((j) => j.user_id === usuarioActual?.id), [jugadores, usuarioActual]);
  const estaInscrito = !!miJugador || inscrito;

  const equipo1 = useMemo(() => jugadores.filter((j) => j.equipo === 1), [jugadores]);
  const equipo2 = useMemo(() => jugadores.filter((j) => j.equipo === 2), [jugadores]);
  const sinAsignar = useMemo(() => jugadores.filter((j) => j.equipo !== 1 && j.equipo !== 2), [jugadores]);

  const partidoIniciado = partido?.status === "en_curso" || partido?.status === "jugado";
  const modoDnd = partido?.status === "jugado" ? "resultado" : partido?.status === "en_curso" ? "jugando" : "armar";

  // HORAS RESTANTES PARA EL PARTIDO (POLÍTICA DE CANCELACIÓN DE 6 HORAS)
  const horasHastaPartido = useMemo(() => {
    if (!partido?.scheduled_at) return 999;
    const diffMs = new Date(partido.scheduled_at).getTime() - new Date().getTime();
    return diffMs / (1000 * 60 * 60);
  }, [partido]);

  // CÁLCULOS DE PAGOS Y ABONOS
  const calculosPagoReserva = useMemo(() => {
    const base = Number(partido?.total_price) || 10;
    const fee = Number(partido?.app_fee) || (base * 0.10);
    const totalCancha = base + fee;

    const historial = Array.isArray(partido?.payments_history) ? partido.payments_history : [];
    const totalAbonado = historial
      .filter((a) => a.status === "aprobado" || a.status === "pendiente")
      .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

    const restante = Math.max(0, totalCancha - totalAbonado);
    const estadoPago = partido?.payment_status || (totalAbonado > 0 ? "pendiente_aprobacion" : "pendiente");

    return { totalCancha, totalAbonado, restante, historial, estadoPago };
  }, [partido]);

  // RESULTADO Y MVP
  const resultadoInfo = useMemo(() => {
    if (partido?.status !== "jugado") return null;

    let g1 = 0;
    let g2 = 0;

    if (partido?.score_text && partido.score_text.includes("-")) {
      const partes = partido.score_text.split("-");
      g1 = Number(partes[0].trim()) || 0;
      g2 = Number(partes[1].trim()) || 0;
    } else {
      g1 = equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || Number(j.goles) || 0), 0);
      g2 = equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || Number(j.goles) || 0), 0);
    }

    let equipoGanador = 0;
    if (g1 > g2) equipoGanador = 1;
    else if (g2 > g1) equipoGanador = 2;

    const candidatosMvp = equipoGanador === 1 ? equipo1 : equipoGanador === 2 ? equipo2 : jugadores;

    let mvp = null;
    if (candidatosMvp.length > 0) {
      const ordenadosPorGoles = [...candidatosMvp].sort((a, b) => {
        const golesA = Number(goles[a.id]) ?? Number(a.goles) ?? 0;
        const golesB = Number(goles[b.id]) ?? Number(b.goles) ?? 0;
        return golesB - golesA;
      });

      const maxGoles = Number(goles[ordenadosPorGoles[0]?.id]) ?? Number(ordenadosPorGoles[0]?.goles) ?? 0;
      if (maxGoles > 0) {
        mvp = {
          ...ordenadosPorGoles[0],
          golesMvp: maxGoles,
        };
      }
    }

    return { g1, g2, equipoGanador, mvp };
  }, [partido, equipo1, equipo2, jugadores, goles]);

  useEffect(() => {
    if (!matchId || !supabase) return;

    cargarDatos();

    const channel = supabase
      .channel(`realtime-match-players-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_players", filter: `match_id=eq.${matchId}` },
        () => {
          cargarDatos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  async function cargarDatos() {
    if (!supabase || !matchId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUsuarioActual(user);

      const { data: partidoData, error: partidoError } = await supabase
        .from("matches")
        .select(`
          id, created_by, scheduled_at, status, is_private, price_per_player, total_price, app_fee, match_type, score_text, winner_team, payment_status, payments_history, payment_proof_urls,
          club:clubs(name, city, address, image_url),
          court:courts(name, sport_type)
        `)
        .eq("id", matchId)
        .maybeSingle();

      if (partidoError || !partidoData) {
        setCargando(false);
        return;
      }
      setPartido(partidoData);

      const { data: inscripciones } = await supabase
        .from("match_players")
        .select("id, user_id, team, goals")
        .eq("match_id", matchId);

      let listaInscripciones = [...(inscripciones || [])];

      if (partidoData.created_by) {
        const estaCreador = listaInscripciones.some(i => i.user_id === partidoData.created_by);
        if (!estaCreador) {
          listaInscripciones.push({
            id: `creador-${partidoData.created_by}`,
            user_id: partidoData.created_by,
            team: "A",
            goals: 0,
          });
        }
      }

      if (listaInscripciones.length > 0) {
        const idsUsuarios = Array.from(new Set(listaInscripciones.map((i) => i.user_id).filter(Boolean)));
        
        let perfilesGlobales = {};
        let perfilesFutbol = {};

        if (idsUsuarios.length > 0) {
          const { data: pGlobales } = await supabase
            .from("profiles")
            .select("id, nombre, apellido, avatar_url")
            .in("id", idsUsuarios);

          (pGlobales || []).forEach(p => { perfilesGlobales[p.id] = p; });

          const { data: pFutbol } = await supabase
            .from("futbol_profiles")
            .select("id, rating, partidos_jugados")
            .in("id", idsUsuarios);

          (pFutbol || []).forEach(p => { perfilesFutbol[p.id] = p; });
        }

        const listaEnriquecida = listaInscripciones.map(i => {
          const pGlob = perfilesGlobales[i.user_id];
          const fPerfil = perfilesFutbol[i.user_id];

          let nombreJugador = "Jugador";
          if (pGlob?.nombre || pGlob?.apellido) {
            nombreJugador = `${pGlob.nombre || ""} ${pGlob.apellido || ""}`.trim();
          } else if (i.user_id === user?.id) {
            nombreJugador = user.email ? user.email.split("@")[0] : "Mi Usuario";
          } else if (i.user_id === partidoData.created_by) {
            nombreJugador = "Organizador";
          } else if (i.user_id) {
            nombreJugador = `Jugador (${i.user_id.slice(0, 5)})`;
          }

          return {
            id: i.id,
            user_id: i.user_id,
            equipo: i.team === "B" ? 2 : 1,
            goles: Number(i.goals) || 0,
            nombre: nombreJugador,
            avatarUrl: pGlob?.avatar_url || null,
            media: fPerfil?.rating != null ? Math.round(Number(fPerfil.rating)) : 64,
            partidosJugados: fPerfil?.partidos_jugados ?? 0,
          };
        });

        setJugadores(listaEnriquecida);

        const golesIniciales = {};
        listaEnriquecida.forEach((j) => { golesIniciales[j.id] = j.goles; });
        setGoles(golesIniciales);

        if (user) {
          const miInsc = listaEnriquecida.find(i => i.user_id === user.id);
          setInscrito(!!miInsc);
          setInscripcionId(miInsc?.id && !miInsc.id.toString().startsWith("creador-") ? miInsc.id : null);
        }
      } else {
        setJugadores([]);
        setInscrito(false);
        setInscripcionId(null);
      }

    } catch (err) {
      console.error("Error al cargar detalle del partido:", err);
    } finally {
      setCargando(false);
    }
  }

  async function procesarInscripcion() {
    if (!usuarioActual) { router.push("/login"); return; }
    
    const yaEnLista = jugadores.some(j => j.user_id === usuarioActual.id);
    if (yaEnLista) {
      setMensaje("Ya estás registrado en este partido.");
      setInscrito(true);
      return;
    }

    setProcesando(true);
    setMensaje("");

    try {
      const { data: insData, error: insErr } = await supabase
        .from("match_players")
        .insert({
          match_id: partido.id,
          user_id: usuarioActual.id,
          team: "A",
          goals: 0
        })
        .select("id")
        .single();

      if (insErr) {
        console.error("Error BD Supabase al unirse:", insErr);
        setMensaje(`Error al unirte: ${insErr.message}`);
        setProcesando(false);
        return;
      }

      setInscripcionId(insData.id);
      setInscrito(true);
      setMensaje("¡Te has unido al partido con éxito!");
      await cargarDatos();
    } catch (err) {
      console.error("Excepción al unirse:", err);
      setMensaje(`Error: ${err.message || "No se pudo completar la inscripción"}`);
    } finally {
      setProcesando(false);
    }
  }

  async function cancelarInscripcion() {
    if (!confirm("¿Seguro que deseas cancelar tu inscripción?")) return;
    setProcesando(true);

    try {
      const { error } = await supabase
        .from("match_players")
        .delete()
        .match({ match_id: partido.id, user_id: usuarioActual.id });

      if (error) throw error;

      setInscrito(false);
      setInscripcionId(null);
      setJugadores(jugadores.filter(j => j.user_id !== usuarioActual.id));
      setMensaje("Inscripción cancelada con éxito.");
      await cargarDatos();
    } catch (err) {
      console.error("Error al cancelar:", err);
      setMensaje("Error al cancelar la inscripción.");
    } finally {
      setProcesando(false);
    }
  }

  // CANCELACIÓN DE RESERVA POR EL ORGANIZADOR (CON ALERTA DE 6 HORAS)
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
      const { error } = await supabase
        .from("matches")
        .update({ status: "cancelado" })
        .eq("id", matchId);

      if (error) throw error;

      alert("Reserva cancelada con éxito.");
      router.push("/futbol");
    } catch (err) {
      console.error("Error al cancelar reserva:", err);
      setMensaje("Error al cancelar la reserva.");
      setProcesando(false);
    }
  }

  async function asegurarEquiposAsignados(listaActual) {
    const sinEquipo = listaActual.filter((j) => j.equipo !== 1 && j.equipo !== 2);
    if (sinEquipo.length === 0) return listaActual;

    const conEquipo1 = listaActual.filter((j) => j.equipo === 1);
    const conEquipo2 = listaActual.filter((j) => j.equipo === 2);
    let suma1 = conEquipo1.reduce((acc, j) => acc + (j.media || 64), 0);
    let suma2 = conEquipo2.reduce((acc, j) => acc + (j.media || 64), 0);

    const ordenadosSin = [...sinEquipo].sort((a, b) => (b.media || 64) - (a.media || 64));
    const listaActualizada = [...listaActual];

    for (const j of ordenadosSin) {
      const equipoAsignado = suma1 <= suma2 ? 1 : 2;
      if (equipoAsignado === 1) suma1 += (j.media || 64);
      else suma2 += (j.media || 64);
      
      const idx = listaActualizada.findIndex((item) => item.id === j.id);
      if (idx !== -1) listaActualizada[idx].equipo = equipoAsignado;
      
      const teamLetter = equipoAsignado === 1 ? "A" : "B";
      await supabase.from("match_players").update({ team: teamLetter }).match({ match_id: matchId, user_id: j.user_id });
    }
    return listaActualizada;
  }

  async function cambiarEquipo(inscripcionIdTarget, nuevoEquipo) {
    setProcesando(true);
    const targetJugador = jugadores.find(j => j.id === inscripcionIdTarget);
    if (!targetJugador) { setProcesando(false); return; }

    const teamLetter = nuevoEquipo === 1 ? "A" : "B";
    await supabase.from("match_players").update({ team: teamLetter }).match({ match_id: matchId, user_id: targetJugador.user_id });
    setJugadores((prev) => prev.map((j) => (j.id === inscripcionIdTarget ? { ...j, equipo: nuevoEquipo } : j)));
    setProcesando(false);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    let targetEquipo;
    if (over.id === "equipo-1") targetEquipo = 1;
    else if (over.id === "equipo-2") targetEquipo = 2;
    else if (over.id === "equipo-null") targetEquipo = null;
    else return;

    const jugador = jugadores.find((j) => j.id === active.id);
    if (!jugador || jugador.equipo === targetEquipo) return;
    cambiarEquipo(jugador.id, targetEquipo);
  }

  async function sortearEquipos() {
    if (jugadores.length < cuposMinimos) { setMensaje(`Necesitas al menos ${cuposMinimos} jugadores.`); return; }
    setProcesando(true);
    setMensaje("");

    const { equipo1: eq1Ids, equipo2: eq2Ids } = balancearEquipos(jugadores);

    const updates = [
      ...eq1Ids.map((id) => {
        const j = jugadores.find(x => x.id === id);
        return supabase.from("match_players").update({ team: "A" }).match({ match_id: matchId, user_id: j?.user_id });
      }),
      ...eq2Ids.map((id) => {
        const j = jugadores.find(x => x.id === id);
        return supabase.from("match_players").update({ team: "B" }).match({ match_id: matchId, user_id: j?.user_id });
      }),
    ];
    await Promise.all(updates);
    
    const { data, error } = await supabase
      .from("matches")
      .update({ status: "programado" })
      .eq("id", matchId)
      .select();

    if (error) {
      console.error("Error BD al sortear:", error);
      setMensaje(`Error BD: ${error.message}`);
      setProcesando(false);
      return;
    }

    setJugadores((prev) => prev.map((j) => ({ ...j, equipo: eq1Ids.includes(j.id) ? 1 : 2 })));
    setMensaje("Equipos sorteados de forma equilibrada.");
    setProcesando(false);
  }

  async function comenzarPartido() {
    if (jugadores.length < cuposMinimos) { setMensaje(`Faltan jugadores para el mínimo (${cuposMinimos}).`); return; }
    setProcesando(true);
    setMensaje("");
    
    const listaConEquipos = await asegurarEquiposAsignados(jugadores);
    setJugadores(listaConEquipos);

    const { data, error } = await supabase
      .from("matches")
      .update({ status: "en_curso" })
      .eq("id", matchId)
      .select();

    if (error) {
      console.error("Error al comenzar partido:", error);
      setMensaje(`Error BD: ${error.message}`);
      setProcesando(false);
      return;
    }

    setPartido((prev) => ({ ...prev, status: "en_curso" }));
    setMensaje("¡El partido ha comenzado!");
    setProcesando(false);
  }

  async function finalizarPartido() {
    setProcesando(true);
    setMensaje("");

    const g1 = equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
    const g2 = equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);

    const updatesGoles = jugadores.map((j) => {
      const cantGoles = Number(goles[j.id]) || 0;
      return supabase
        .from("match_players")
        .update({ goals: cantGoles })
        .match({ match_id: matchId, user_id: j.user_id });
    });
    await Promise.all(updatesGoles);

    const ganador = g1 > g2 ? "A" : g2 > g1 ? "B" : "EMPATE";

    const { data: partidoActualizado, error: errorPartido } = await supabase
      .from("matches")
      .update({ status: "jugado", winner_team: ganador, score_text: `${g1} - ${g2}` })
      .eq("id", matchId)
      .select();

    if (errorPartido || !partidoActualizado || partidoActualizado.length === 0) { 
      setMensaje("Error BD: No tienes permisos para finalizar."); 
      setProcesando(false); 
      return; 
    }

    setPartido((prev) => ({ ...prev, status: "jugado", score_text: `${g1} - ${g2}` }));
    setJugadores((prev) => prev.map((j) => ({ ...j, goles: Number(goles[j.id]) || 0 })));
    setMensaje(`Partido finalizado: ${g1} - ${g2}`);
    setProcesando(false);
    await cargarDatos();
  }

  async function enviarAbonoExtra() {
    if (!usuarioActual || !partido) return;

    const montoValido = parseFloat(formPago.monto);
    if (isNaN(montoValido) || montoValido <= 0) {
      setMensaje("Ingresa un monto válido.");
      return;
    }

    if (formPago.metodoPago !== "efectivo" && !formPago.previewComprobante && !formPago.numReferencia.trim()) {
      setMensaje("Adjunta la imagen del comprobante o el número de referencia.");
      return;
    }

    try {
      setEnviandoPago(true);

      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", usuarioActual.id)
        .maybeSingle();

      const nombreUsuario = userProf ? `${userProf.nombre || ""} ${userProf.apellido || ""}`.trim() : usuarioActual.email;
      const telefonoUsuario = userProf?.telefono || "Sin teléfono";

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: usuarioActual.id,
        user_name: nombreUsuario,
        user_phone: telefonoUsuario,
        amount: montoValido,
        method: formPago.metodoPago,
        reference: formPago.numReferencia.trim() || "S/R",
        receipt_url: formPago.previewComprobante || null,
        status: formPago.metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const historialActual = Array.isArray(partido.payments_history) ? partido.payments_history : [];
      const historialNuevo = [...historialActual, nuevoAbono];

      const proofUrlsActuales = Array.isArray(partido.payment_proof_urls) ? partido.payment_proof_urls : [];
      const proofUrlsNuevas = formPago.previewComprobante
        ? [...proofUrlsActuales, formPago.previewComprobante]
        : proofUrlsActuales;

      const { error: updateErr } = await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_proof_urls: proofUrlsNuevas,
          payment_status: "pendiente_aprobacion",
        })
        .eq("id", partido.id);

      if (updateErr) throw updateErr;

      setModalPagoOpen(false);
      setMensaje("¡Comprobante enviado con éxito!");
      await cargarDatos();
    } catch (err) {
      console.error("Error enviando comprobante extra:", err);
      setMensaje("Error al adjuntar el comprobante.");
    } finally {
      setEnviandoPago(false);
    }
  }

  const handleSeleccionarImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMensaje("Por favor selecciona una imagen válida.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormPago((prev) => ({ ...prev, previewComprobante: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!partido) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-xl font-bold">Partido no encontrado</h1></div>;
  }

  const imagenCancha = partido.club?.image_url || "https://images.unsplash.com/photo-1518605368461-1ee7e53f090b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80";

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32 pt-4 md:pt-8">
      <main className="max-w-3xl mx-auto px-4 flex flex-col gap-6">
        
        {/* HERO BANNER */}
        <div className="relative h-64 md:h-80 w-full bg-gray-900 rounded-3xl overflow-hidden shadow-md border border-gray-100">
          <img src={imagenCancha} alt="Cancha" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-[#0B0C15]/40 to-transparent"></div>
          
          <div className="absolute top-4 left-4 z-10">
            <Link href="/futbol" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
          </div>

          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {esPrivado && (
              <span className="bg-white/95 text-indigo-800 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Privado
              </span>
            )}
            <span className={`bg-white/95 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md ${
              partido?.status === "jugado" ? "text-gray-500" :
              partido?.status === "en_curso" ? "text-blue-600" : 
              "text-emerald-800"
            }`}>
              {partido?.status === "jugado" ? "Finalizado" : 
               partido?.status === "en_curso" ? "En Curso" : 
               costoInscripcion === 0 ? "Gratis" : `$${costoInscripcion} USD`}
            </span>
          </div>

          <div className="absolute bottom-6 left-4 right-4 md:left-8 z-10">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{partido.court?.name}</h1>
            <div className="flex items-center gap-1.5 mt-2 opacity-90">
              <svg className="w-4 h-4 text-[#00FF9D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
              <p className="text-white text-sm font-medium">{partido.club?.city} • {partido.club?.name}</p>
            </div>
          </div>
        </div>

        {/* ORGANIZADOR: BANNER DE PAGO + ALERTA DE CANCELACIÓN DE 6 HORAS */}
        {esCreador && partido?.status !== "cancelado" && (
          <div className="space-y-4">
            
            {/* CARD DE ESTADO DE PAGO DE RESERVA */}
            <div className={`p-5 sm:p-6 rounded-3xl border flex flex-col space-y-4 shadow-sm transition-all ${
              calculosPagoReserva.restante === 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-amber-50/80 border-amber-200 text-amber-950"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${
                      calculosPagoReserva.restante === 0
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}>
                      {calculosPagoReserva.restante === 0
                        ? "✅ PAGO COMPLETO"
                        : calculosPagoReserva.totalAbonado > 0
                        ? "⏳ PAGO PARCIAL / EN REVISIÓN"
                        : "⚠️ RESERVA PENDIENTE DE PAGO"}
                    </span>
                  </div>

                  <h4 className="font-black text-base sm:text-lg">
                    Total Reserva: <span className="text-slate-900">${calculosPagoReserva.totalCancha.toFixed(2)} USD</span>
                  </h4>

                  <p className="text-xs font-semibold opacity-90">
                    Abonado: <span className="font-black text-emerald-700">${calculosPagoReserva.totalAbonado.toFixed(2)} USD</span> • 
                    Falta por Pagar: <span className="font-black text-rose-600">${calculosPagoReserva.restante.toFixed(2)} USD</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setFormPago((prev) => ({
                        ...prev,
                        monto: calculosPagoReserva.restante > 0 ? calculosPagoReserva.restante.toFixed(2) : "",
                      }));
                      setModalPagoOpen(true);
                    }}
                    className="bg-slate-900 hover:bg-black text-[#00FF9D] font-black text-xs uppercase px-4 py-3 rounded-2xl transition-all cursor-pointer shadow-md"
                  >
                    💳 Registrar Pago / Comprobante
                  </button>

                  <button
                    onClick={cancelarReservaOrganizador}
                    disabled={procesando}
                    className="bg-rose-500/10 hover:bg-rose-500 text-rose-700 hover:text-white border border-rose-200 font-black text-xs uppercase px-4 py-3 rounded-2xl transition-all cursor-pointer shadow-xs"
                  >
                    🚫 Cancelar Reserva
                  </button>
                </div>
              </div>

              {/* ALERTA DE POLÍTICA DE CANCELACIÓN (6 HORAS) */}
              <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
                horasHastaPartido < 6 
                  ? "bg-rose-100/90 text-rose-900 border-rose-200" 
                  : "bg-amber-100/70 text-amber-900 border-amber-200"
              }`}>
                <span className="text-base">⚠️</span>
                <span>
                  {horasHastaPartido < 6
                    ? "Quedan menos de 6 horas para el partido. Si cancelas ahora, tu abono/dinero no será reembolsado."
                    : "Política de Cancelación: Si cancelas con menos de 6 horas de anticipación, tu abono/pago no será reembolsado."}
                </span>
              </div>

            </div>

            {/* COMPARTIR ENLACE */}
            {!partidoIniciado && (
              <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">👑</span>
                    <h3 className="font-black text-indigo-900 text-base">Eres el organizador</h3>
                  </div>
                  <p className="text-indigo-700/80 text-xs font-medium">Copia y envía la URL a tus amigos para armar los equipos.</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setMensaje("Enlace copiado al portapapeles.");
                  }}
                  className="bg-indigo-600 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer shrink-0"
                >
                  Copiar Enlace
                </button>
              </div>
            )}

          </div>
        )}

        {mensaje && (
          <div className={`p-4 rounded-2xl text-sm font-bold text-center border ${mensaje.toLowerCase().includes("error") || mensaje.toLowerCase().includes("no se pudo") || mensaje.toLowerCase().includes("necesitas") || mensaje.toLowerCase().includes("faltan") ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>
            {mensaje}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</p>
              <p className="text-sm font-black text-gray-900 capitalize">{formatFechaCompleta(partido.scheduled_at)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora</p>
              <p className="text-sm font-black text-gray-900">{formatHora12(partido.scheduled_at)}</p>
            </div>
          </div>
        </div>

        {/* RESULTADO FINAL Y MVP */}
        {modoDnd === "resultado" && resultadoInfo && (
          <div className="space-y-4">
            
            <div className={`rounded-3xl p-6 text-center text-white shadow-xl border overflow-hidden relative ${
              resultadoInfo.equipoGanador === 1 ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 border-emerald-400/30" :
              resultadoInfo.equipoGanador === 2 ? "bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 border-indigo-500/30" :
              "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 border-amber-300/30"
            }`}>
              <span className="text-3xl block mb-1">
                {resultadoInfo.equipoGanador === 0 ? "🤝" : "🏆"}
              </span>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">
                {resultadoInfo.equipoGanador === 0 ? "Resultado Final" : "¡Equipo Ganador!"}
              </p>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mt-0.5">
                {resultadoInfo.equipoGanador === 1 ? "¡VICTORIA PARA EQUIPO 1!" :
                 resultadoInfo.equipoGanador === 2 ? "¡VICTORIA PARA EQUIPO 2!" :
                 "¡EMPATE ÉPICO!"}
              </h2>

              <div className="flex items-center justify-center gap-6 mt-5 bg-black/20 backdrop-blur-md rounded-2xl py-3 px-6 w-fit mx-auto border border-white/10">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-white/70">Equipo 1</span>
                  <span className="text-4xl font-black text-white">{resultadoInfo.g1}</span>
                </div>
                <span className="text-2xl font-black text-white/40">-</span>
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-white/70">Equipo 2</span>
                  <span className="text-4xl font-black text-white">{resultadoInfo.g2}</span>
                </div>
              </div>
            </div>

            {resultadoInfo.mvp && (
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-100/50 to-orange-500/10 border-2 border-amber-400/40 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full bg-amber-400 p-1 shadow-md">
                      <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center text-amber-300 font-black text-xl">
                        {resultadoInfo.mvp.avatarUrl ? (
                          <img src={resultadoInfo.mvp.avatarUrl} alt={resultadoInfo.mvp.nombre} className="w-full h-full object-cover" />
                        ) : (
                          iniciales(resultadoInfo.mvp.nombre)
                        )}
                      </div>
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-lg">⭐</span>
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-900 border border-amber-400/40 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-1">
                      <span>👑 MVP del Partido</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900">{resultadoInfo.mvp.nombre}</h3>
                    <p className="text-xs font-semibold text-gray-600">
                      Máximo anotador del equipo ganador
                    </p>
                  </div>
                </div>

                <div className="bg-amber-400 text-slate-950 px-5 py-2.5 rounded-2xl shadow-sm text-center shrink-0">
                  <span className="text-2xl font-black block leading-none">{resultadoInfo.mvp.golesMvp} ⚽</span>
                  <span className="text-[9px] font-black uppercase tracking-wider block mt-0.5">Goles</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          {!partidoIniciado ? (
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900">Jugadores</h3>
                <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${cuposOcupados >= cuposMinimos ? "text-emerald-500" : "text-gray-400"}`}>
                  {cuposOcupados} / {cuposTotales} Inscritos {cuposOcupados < cuposMinimos && `(Mínimo ${cuposMinimos})`}
                </p>
              </div>
              <div className="w-12 h-12 relative">
                <svg viewBox="0 0 36 36" className="w-full h-full text-gray-100 transform -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={lleno ? "#f43f5e" : "#00FF9D"} strokeWidth="4" strokeDasharray={`${(cuposOcupados/cuposTotales)*100}, 100`} />
                </svg>
              </div>
            </div>
          ) : (
            <div className="text-center mb-8">
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full mb-2 border border-blue-100">
                {modoDnd === "resultado" ? "Alineaciones Finales" : "Equipos Sorteados"}
              </span>
              <h3 className="text-2xl font-black text-gray-900 uppercase">Alineaciones</h3>
            </div>
          )}

          {esCreador && partido?.status !== "jugado" ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                {partidoIniciado && (
                  <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#0B0C15] text-[#00FF9D] rounded-full items-center justify-center font-black text-xs uppercase tracking-widest z-10 shadow-xl border-4 border-white">
                    VS
                  </div>
                )}

                <EquipoColumna id="equipo-1" titulo="Equipo 1 (A)" jugadores={equipo1}>
                  {equipo1.map((j) => (
                    <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [j.id]: e.target.value }))} onCambiarEquipo={() => cambiarEquipo(j.id, 2)} />
                  ))}
                </EquipoColumna>

                <EquipoColumna id="equipo-2" titulo="Equipo 2 (B)" jugadores={equipo2}>
                  {equipo2.map((j) => (
                    <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [j.id]: e.target.value }))} onCambiarEquipo={() => cambiarEquipo(j.id, 1)} />
                  ))}
                </EquipoColumna>
              </div>

              {sinAsignar.length > 0 && modoDnd !== "resultado" && (
                <div className="mt-4">
                  <EquipoColumna id="equipo-null" titulo={`Sin asignar (${sinAsignar.length})`} jugadores={sinAsignar}>
                    {sinAsignar.map((j) => (
                      <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [j.id]: e.target.value }))} />
                    ))}
                  </EquipoColumna>
                </div>
              )}

              {modoDnd !== "resultado" && (
                <div className="space-y-3 pt-6 border-t border-gray-100 mt-6">
                  {modoDnd === "armar" && (
                    <>
                      <button onClick={sortearEquipos} disabled={procesando || jugadores.length < cuposMinimos} className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                        🎲 Sortear equipos equilibrados
                      </button>
                      <button onClick={comenzarPartido} disabled={procesando || jugadores.length < cuposMinimos} className="w-full bg-[#00FF9D] text-[#0B0C15] font-black uppercase tracking-widest hover:bg-[#00e58d] py-3.5 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer">
                        {procesando ? "Procesando…" : "▶ Comenzar partido"}
                      </button>
                    </>
                  )}
                  {modoDnd === "jugando" && (
                    <button onClick={finalizarPartido} disabled={procesando} className="w-full bg-gray-900 hover:bg-black active:bg-gray-800 text-white font-bold py-3.5 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                      {procesando ? "Guardando resultados…" : "🏁 Finalizar partido"}
                    </button>
                  )}
                </div>
              )}
            </DndContext>

          ) : (
            <>
              {!partidoIniciado ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {jugadores.map((jugador) => (
                    <div key={jugador.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                        {jugador.avatarUrl ? <img src={jugador.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-lg">{jugador.nombre?.[0]?.toUpperCase()}</div>}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 leading-tight truncate">{jugador.nombre}</p>
                        {jugador.user_id === partido.created_by && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Organizador</span>}
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, cuposTotales - cuposOcupados) }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-gray-100 opacity-50">
                      <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0 flex items-center justify-center text-gray-300"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Libre</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative">
                  <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#0B0C15] text-[#00FF9D] rounded-full items-center justify-center font-black text-xs uppercase tracking-widest z-10 shadow-xl border-4 border-white">VS</div>
                  
                  <div className={`rounded-3xl p-5 border transition-all ${
                    resultadoInfo?.equipoGanador === 1 ? "bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-400/20" : "bg-gray-50 border-gray-100"
                  }`}>
                    <div className="flex items-center justify-between border-b-2 border-gray-200 pb-3 mb-4">
                      <h4 className="font-black text-gray-900 uppercase tracking-widest">Equipo 1</h4>
                      {resultadoInfo?.equipoGanador === 1 && <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2.5 py-0.5 rounded-full">👑 GANADOR</span>}
                    </div>
                    <div className="flex flex-col gap-2">
                      {equipo1.length > 0 ? equipo1.map((j) => (
                        <div key={j.id} className="flex justify-between items-center p-2 bg-white rounded-xl shadow-sm border border-gray-100">
                          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">{j.avatarUrl ? <img src={j.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 font-bold text-xs">{j.nombre?.[0]}</div>}</div><p className="text-sm font-bold text-gray-800">{j.nombre}</p></div>
                          {modoDnd === "resultado" && <span className="text-sm font-black text-emerald-800">{j.goles} ⚽</span>}
                        </div>
                      )) : <p className="text-xs text-center text-gray-400 font-bold py-2">Sin jugadores</p>}
                    </div>
                  </div>

                  <div className="flex sm:hidden justify-center my-[-1.5rem] relative z-10"><div className="w-10 h-10 bg-[#0B0C15] text-[#00FF9D] rounded-full flex items-center justify-center font-black text-xs uppercase tracking-widest shadow-xl border-4 border-white">VS</div></div>
                  
                  <div className={`rounded-3xl p-5 border transition-all ${
                    resultadoInfo?.equipoGanador === 2 ? "bg-indigo-950 text-white border-indigo-500/40 ring-2 ring-indigo-500/20" : "bg-gray-900 border-gray-800 text-white"
                  }`}>
                    <div className="flex items-center justify-between border-b-2 border-gray-700 pb-3 mb-4">
                      <h4 className="font-black uppercase tracking-widest">Equipo 2</h4>
                      {resultadoInfo?.equipoGanador === 2 && <span className="text-xs font-black text-amber-300 bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 rounded-full">👑 GANADOR</span>}
                    </div>
                    <div className="flex flex-col gap-2">
                      {equipo2.length > 0 ? equipo2.map((j) => (
                        <div key={j.id} className="flex justify-between items-center p-2 bg-gray-800 rounded-xl shadow-sm border border-gray-700">
                          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">{j.avatarUrl ? <img src={j.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-600 text-white font-bold text-xs">{j.nombre?.[0]}</div>}</div><p className="text-sm font-bold text-gray-100">{j.nombre}</p></div>
                          {modoDnd === "resultado" && <span className="text-sm font-black text-emerald-400">{j.goles} ⚽</span>}
                        </div>
                      )) : <p className="text-xs text-center text-gray-500 font-bold py-2">Sin jugadores</p>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* BARRA INFERIOR FLOTANTE */}
      {!partidoIniciado && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-slate-900/95 text-white backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-slate-800 z-40 flex items-center justify-between gap-3">
          {estaInscrito ? (
            <>
              <div className="flex items-center gap-2 pl-2">
                <span className="text-emerald-400 font-bold text-xs flex items-center gap-1">
                  <span>✅</span> {esCreador ? "Organizador Inscrito" : "Inscrito"}
                </span>
              </div>
              {!esCreador && (
                <button
                  onClick={cancelarInscripcion}
                  disabled={procesando}
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-black uppercase text-[11px] rounded-xl border border-rose-500/30 transition-all cursor-pointer"
                >
                  {procesando ? "Procesando..." : "Cancelar mi cupo"}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="pl-2">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  {esPrivado ? "Reserva Privada" : "Reserva tu cupo"}
                </span>
                <span className="text-xs font-black text-white">
                  {costoInscripcion === 0 ? "Gratis" : `$${costoInscripcion.toFixed(2)} USD`}
                </span>
              </div>
              <button
                onClick={procesarInscripcion}
                disabled={lleno || procesando}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  lleno
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-[#00FF9D] text-slate-950 hover:bg-emerald-400 shadow-sm"
                }`}
              >
                {procesando ? "Procesando..." : lleno ? "Partido Lleno" : "Unirme al Partido"}
              </button>
            </>
          )}
        </div>
      )}

      {/* MODAL GESTIÓN DE PAGO Y SUBIDA DE COMPROBANTES */}
      {modalPagoOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalPagoOpen(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Gestión de Pago de Reserva</h3>
                <p className="text-xs font-semibold text-slate-500">Cancha: {partido.court?.name}</p>
              </div>
              <button onClick={() => setModalPagoOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1">✕</button>
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

            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-900">Comprobantes Registrados ({calculosPagoReserva.historial.length}):</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {calculosPagoReserva.historial.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium text-center py-2 bg-slate-50 rounded-xl">Aún no hay comprobantes registrados.</p>
                ) : (
                  calculosPagoReserva.historial.map((ab, idx) => (
                    <div key={ab.id || idx} className="bg-slate-50 border p-2.5 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <p className="font-black text-slate-900">{ab.user_name || "Comprobante"}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{ab.method} • Ref: {ab.reference}</p>
                      </div>
                      <span className="font-black text-slate-900">${parseFloat(ab.amount || 0).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl space-y-3 text-xs font-bold">
              <h4 className="font-black text-emerald-950 uppercase">+ Adjuntar Nuevo Comprobante / Abono</h4>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Monto que Pagas ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formPago.monto}
                  onChange={(e) => setFormPago({ ...formPago, monto: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 outline-none"
                  placeholder="Ej. 11.00"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Método de Pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 En Sitio" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormPago({ ...formPago, metodoPago: m.id })}
                      className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        formPago.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {formPago.metodoPago !== "efectivo" && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Número de Referencia</label>
                    <input
                      type="text"
                      placeholder="Ej. #123456"
                      value={formPago.numReferencia}
                      onChange={(e) => setFormPago({ ...formPago, numReferencia: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Foto / Captura del Comprobante</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSeleccionarImagen}
                      className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs font-bold outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-900 file:text-[#00FF9D]"
                    />

                    {formPago.previewComprobante && (
                      <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-28 bg-slate-950 flex items-center justify-center">
                        <img src={formPago.previewComprobante} alt="Preview Comprobante" className="max-h-28 object-contain" />
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={enviarAbonoExtra}
                disabled={enviandoPago}
                className="w-full py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-xl shadow-md mt-1 cursor-pointer"
              >
                {enviandoPago ? "Enviando Comprobante..." : "+ Enviar Comprobante Adicional"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}