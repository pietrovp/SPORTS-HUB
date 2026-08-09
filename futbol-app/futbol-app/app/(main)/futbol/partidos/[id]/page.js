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
import { cumpleRequisito } from "@/lib/futbol/logros";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatFechaCompleta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function formatHora12(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  const horas = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = horas >= 12 ? "PM" : "AM";
  const h12 = horas % 12 || 12;
  return `${h12}:${m} ${ampm}`;
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

  // CÁLCULO DEL RESULTADO FINAL Y MVP
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

    let equipoGanador = 0; // 0 = Empate, 1 = Equipo 1, 2 = Equipo 2
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
          *,
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

      // INCLUIDA LA COLUMNA "goals" EN LA CONSULTA SELECT
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
      if (costoInscripcion > 0) {
        const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", usuarioActual.id).single();
        const creditosActuales = perfil?.creditos || 0;

        if (creditosActuales < costoInscripcion) {
          setMensaje(`No tienes créditos suficientes.`);
          setProcesando(false);
          return;
        }

        const nuevoBalance = creditosActuales - costoInscripcion;
        await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", usuarioActual.id);
        await supabase.from("credit_ledger").insert({ user_id: usuarioActual.id, match_id: partido.id, delta: -costoInscripcion, reason: "join_public_match", balance_after: nuevoBalance });
      }

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

      if (costoInscripcion > 0) {
        const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", usuarioActual.id).single();
        const nuevoBalance = (perfil?.creditos || 0) + costoInscripcion;
        await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", usuarioActual.id);
        await supabase.from("credit_ledger").insert({ user_id: usuarioActual.id, match_id: partido.id, delta: costoInscripcion, reason: "cancel_match_join", balance_after: nuevoBalance });
      }

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

    if (!data || data.length === 0) {
      setMensaje("Error: Tu usuario no coincide con el organizador (created_by) de este partido.");
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

    if (!data || data.length === 0) {
      setMensaje("Error: No estás registrado en la base de datos como el creador (created_by) de esta cancha.");
      setProcesando(false);
      return;
    }

    setPartido((prev) => ({ ...prev, status: "en_curso" }));
    setMensaje("¡El partido ha comenzado!");
    setProcesando(false);
  }

  async function recalcularEstadisticasJugador(uid, inscripcionesVivas, partidoEnVivo) {
    try {
      const { data: historialPJ } = await supabase
        .from("match_players")
        .select("id, match_id, team, goals")
        .eq("user_id", uid);

      if (!historialPJ || historialPJ.length === 0) return;

      const partidoIds = historialPJ.map((h) => h.match_id).filter(Boolean);
      
      const { data: partidosData } = await supabase
        .from("matches")
        .select("id, score_text, status, is_private, created_at, winner_team")
        .in("id", partidoIds);
      
      const partidosMap = new Map((partidosData || []).map((p) => [p.id, p]));

      const listaLimpia = [];
      
      for (const i of historialPJ) {
         const pDataDB = partidosMap.get(i.match_id);
         if (!pDataDB) continue; 

         const esLive = i.match_id === partidoEnVivo.id;
         
         const esPrivadoMatch = esLive ? partidoEnVivo.is_private : pDataDB.is_private;
         const estado = esLive ? partidoEnVivo.status : pDataDB.status;

         if (esPrivadoMatch) continue; 
         if (!esLive && estado !== "jugado") continue;

         const golesJugador = esLive ? (inscripcionesVivas[i.id]?.goles || 0) : (Number(i.goals) || 0);
         const equipoJugador = esLive ? (inscripcionesVivas[i.id]?.equipo || null) : (i.team === "A" ? 1 : i.team === "B" ? 2 : null);
         
         if (!equipoJugador) continue; 
         
         let gano = false;
         let esEmpate = false;

         if (esLive) {
           gano = (equipoJugador === 1 && partidoEnVivo.ganador === "A") || (equipoJugador === 2 && partidoEnVivo.ganador === "B");
           esEmpate = partidoEnVivo.ganador === "EMPATE";
         } else {
           gano = (equipoJugador === 1 && pDataDB.winner_team === "A") || (equipoJugador === 2 && pDataDB.winner_team === "B");
           esEmpate = pDataDB.winner_team === "EMPATE";
         }

         const fechaRealDB = new Date(pDataDB.created_at).getTime();

         listaLimpia.push({
           fechaRealDB,
           goles: golesJugador,
           esEmpate,
           gano,
           esLive
         });
      }
      
      listaLimpia.sort((a,b) => a.fechaRealDB - b.fechaRealDB);
      
      const partidos_jugados = listaLimpia.length;
      const goles_total = listaLimpia.reduce((acc, p) => acc + p.goles, 0);
      const victorias = listaLimpia.filter(p => p.gano).length;
      const derrotas = listaLimpia.filter(p => !p.gano && !p.esEmpate).length;
      const empates = listaLimpia.filter(p => p.esEmpate).length;

      const { data: todosLosLogros } = await supabase.from("logros").select("*").eq("activo", true);
      const { data: yaDesbloqueados } = await supabase.from("user_logros").select("logro_id").eq("user_id", uid);
      
      const idsDesbloqueados = new Set((yaDesbloqueados || []).map((d) => d.logro_id));
      const nuevosDesbloqueos = [];
      
      for (const logro of (todosLosLogros || [])) {
         if (idsDesbloqueados.has(logro.id)) continue;
         
         const timestampCreacionLogro = new Date(logro.created_at).getTime();
         
         const partidosValidosParaEsteLogro = listaLimpia.filter(p => {
           return p.esLive || p.fechaRealDB >= timestampCreacionLogro;
         });
         
         let rachaMax = 0;
         let rachaActual = 0;
         partidosValidosParaEsteLogro.forEach(p => {
           if (p.gano) { rachaActual++; rachaMax = Math.max(rachaMax, rachaActual); }
           else { rachaActual = 0; }
         });
         
         const statsParaLogro = {
            partidos_jugados: partidosValidosParaEsteLogro.length,
            goles_total: partidosValidosParaEsteLogro.reduce((acc, p) => acc + p.goles, 0),
            victorias: partidosValidosParaEsteLogro.filter(p => p.gano).length,
            max_goles_partido: partidosValidosParaEsteLogro.reduce((acc, p) => Math.max(acc, p.goles), 0),
            racha_victorias_max: rachaMax
         };
         
         if (cumpleRequisito(logro, statsParaLogro)) {
           nuevosDesbloqueos.push(logro);
         }
      }

      if (nuevosDesbloqueos.length > 0) {
        await supabase.from("user_logros").insert(
          nuevosDesbloqueos.map((l) => ({ user_id: uid, logro_id: l.id }))
        );
        nuevosDesbloqueos.forEach((l) => idsDesbloqueados.add(l.id));
      }

      const { data: perfilActualBase } = await supabase.from("futbol_profiles").select("rating, ritmo, tiro, pase, regate, defensa, fisico").eq("id", uid).single();
      let bonoRatingTotal = 0;
      const bonosExtra = {};

      (todosLosLogros || []).forEach((l) => {
        if (idsDesbloqueados.has(l.id)) {
          const stat = String(l.stat_mejora || "").toLowerCase().trim().replace(/\s+/g, "_");
          const valor = Number(l.valor_mejora) || 0;
          if (["rating", "media_general", "ovr", "media", "overall"].includes(stat)) { bonoRatingTotal += valor; } 
          else if (stat) { bonosExtra[stat] = (bonosExtra[stat] || 0) + valor; }
        }
      });

      const rating_final = Math.min(99, 64 + bonoRatingTotal);
      
      const updates = { 
        partidos_jugados, 
        goles: goles_total, 
        victorias, 
        derrotas, 
        empates, 
        rating: rating_final 
      };

      if (perfilActualBase && Object.keys(bonosExtra).length > 0) {
        const camposExtra = ["ritmo", "tiro", "pase", "regate", "defensa", "fisico"];
        camposExtra.forEach((campo) => {
          if (bonosExtra[campo] != null) updates[campo] = Math.min(99, (Number(perfilActualBase[campo]) || 50) + bonosExtra[campo]);
        });
      }

      await supabase.from("futbol_profiles").update(updates).eq("id", uid);
    } catch (err) { console.error(err); }
  }

  async function finalizarPartido() {
    setProcesando(true);
    setMensaje("");

    const g1 = equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
    const g2 = equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);

    // GUARDAR GOLES INDIVIDUALES EN BD CON PROMISE.ALL
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

    setJugadores((prev) =>
      prev.map((j) => ({ ...j, goles: Number(goles[j.id]) || 0 }))
    );
    setPartido((prev) => ({ ...prev, status: "jugado", score_text: `${g1} - ${g2}` }));

    if (!esPrivado) {
      const inscripcionesVivas = {};
      jugadores.forEach((j) => { 
        inscripcionesVivas[j.id] = {
          goles: Number(goles[j.id]) || 0,
          equipo: Number(j.equipo)
        }; 
      });
      
      const partidoEnVivo = {
        id: matchId,
        ganador: ganador,
        status: "jugado",
        is_private: false
      };

      const idsUnicos = [...new Set(jugadores.map((j) => j.user_id))];
      await Promise.all(idsUnicos.map((uid) => recalcularEstadisticasJugador(uid, inscripcionesVivas, partidoEnVivo)));
      setMensaje(`Partido finalizado y Stats actualizadas: ${g1} - ${g2}`);
    } else {
      setMensaje(`Partido Privado finalizado: ${g1} - ${g2} (No suma a las Stats)`);
    }

    setProcesando(false);
    await cargarDatos();
  }

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

        {/* CREADOR / ENLACE DE COMPARTIR */}
        {esCreador && esPrivado && !partidoIniciado && (
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">👑</span>
                <h3 className="font-black text-indigo-900 text-lg">Eres el organizador</h3>
              </div>
              <p className="text-indigo-700/80 text-sm font-medium">Copia y envía la URL de esta página a tus amigos para que se unan gratis a tu partido.</p>
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
              <p className="text-sm font-black text-gray-900">{formatFechaCompleta(partido.scheduled_at)}</p>
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

        {/* DISEÑO MEJORADO DE RESULTADO FINAL Y MVP */}
        {modoDnd === "resultado" && resultadoInfo && (
          <div className="space-y-4">
            
            {/* BANNER PRINCIPAL DE GANADOR */}
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

            {/* TARJETA DESTACADA DEL MVP */}
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
                  
                  {/* COLUMNA EQUIPO 1 */}
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
                  
                  {/* COLUMNA EQUIPO 2 */}
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
              {sinAsignar.length > 0 && partidoIniciado && (
                <div className="mt-6 bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
                  <h4 className="font-black text-center text-yellow-800 text-xs uppercase tracking-widest mb-3">Sin equipo asignado</h4>
                  <div className="flex flex-wrap justify-center gap-2">
                    {sinAsignar.map((jugador) => (
                      <div key={jugador.id} className="flex items-center gap-2 p-1.5 bg-white rounded-lg shadow-sm border border-yellow-200">
                        <p className="text-xs font-bold text-gray-800">{jugador.nombre || "Usuario"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* BARRA INFERIOR DE ACCIÓN FLOTANTE */}
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
    </div>
  );
}