"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cumpleRequisito } from "../../../../lib/futbol/logros";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function formatFechaCompleta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function formatHora12(hora24) {
  if (!hora24) return "";
  const [h, m] = hora24.split(":");
  const horas = parseInt(h, 10);
  const ampm = horas >= 12 ? "PM" : "AM";
  const h12 = horas % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function iniciales(nombre) {
  return (nombre || "J").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function promedioMedia(lista) {
  if (!lista.length) return 0;
  return Math.round(lista.reduce((acc, j) => acc + j.media, 0) / lista.length);
}

function balancearEquipos(jugadores) {
  const ordenados = [...jugadores].sort((a, b) => b.media - a.media);
  const equipo1 = [];
  const equipo2 = [];
  let suma1 = 0;
  let suma2 = 0;

  ordenados.forEach((j) => {
    if (suma1 <= suma2) {
      equipo1.push(j.id);
      suma1 += j.media;
    } else {
      equipo2.push(j.id);
      suma2 += j.media;
    }
  });

  return { equipo1, equipo2 };
}

// ==========================================
// COMPONENTES DRAG & DROP
// ==========================================
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
        <button onClick={onCambiarEquipo} className="text-sm font-semibold text-gray-300 hover:text-emerald-600 shrink-0 p-1">⇄</button>
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

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function PartidoDetalle({ params }) {
  const router = useRouter();
  const { id } = params;

  const [cargando, setCargando] = useState(true);
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [goles, setGoles] = useState({});
  const [usuarioActual, setUsuarioActual] = useState(null);
  
  const [inscrito, setInscrito] = useState(false);
  const [inscripcionId, setInscripcionId] = useState(null);

  const [accesoConcedido, setAccesoConcedido] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    async function cargarDatos() {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      setUsuarioActual(user);

      const { data: partidoData, error: partidoError } = await supabase
        .from("partidos")
        .select("*, sedes(imagen_url, direccion)")
        .eq("id", id)
        .single();

      if (partidoError || !partidoData) {
        setCargando(false);
        return;
      }
      setPartido(partidoData);

      const { data: inscripciones } = await supabase
        .from("partido_jugadores")
        .select("id, user_id, equipo, goles, asistencias, profiles(nombre, avatar_url)")
        .eq("partido_id", id);

      let estoyInscrito = false;

      if (inscripciones && inscripciones.length > 0) {
        const idsUsuarios = inscripciones.map(i => i.user_id);
        
        const { data: fData } = await supabase
          .from("futbol_profiles")
          .select("id, posicion, rating, partidos_jugados, goles")
          .in("id", idsUsuarios);

        const listaEnriquecida = inscripciones.map(i => {
          const fPerfil = fData?.find(f => f.id === i.user_id);
          return {
            id: i.id,
            user_id: i.user_id,
            equipo: Number(i.equipo) || null,
            goles: Number(i.goles) || 0,
            asistencias: Number(i.asistencias) || 0,
            profiles: i.profiles,
            nombre: i.profiles?.nombre || "Jugador",
            avatarUrl: i.profiles?.avatar_url || null,
            media: fPerfil?.rating != null ? Math.round(Number(fPerfil.rating)) : 64,
            partidosJugados: fPerfil?.partidos_jugados ?? 0,
          };
        });

        setJugadores(listaEnriquecida);

        const golesIniciales = {};
        listaEnriquecida.forEach((j) => { golesIniciales[j.id] = j.goles; });
        setGoles(golesIniciales);

        if (user) {
          const miInscripcion = listaEnriquecida.find(i => i.user_id === user.id);
          estoyInscrito = !!miInscripcion;
          setInscrito(estoyInscrito);
          setInscripcionId(miInscripcion?.id || null);
        }
      }

      const esCreador = user?.id === partidoData.creador_id;
      if (partidoData.tipo_acceso !== "privado" || esCreador || estoyInscrito) {
        setAccesoConcedido(true);
      }

      setCargando(false);
    }

    cargarDatos();
  }, [id]);

  const esCreador = usuarioActual?.id === partido?.creador_id;
  const cuposTotales = partido?.cupos_totales || 14;
  const cuposMinimos = partido?.cupos_minimos || 10;
  const cuposOcupados = jugadores.length;
  const lleno = cuposOcupados >= cuposTotales;
  const partidoIniciado = partido?.estado === "en_curso" || partido?.estado === "finalizado";
  const modoDnd = partido?.estado === "finalizado" ? "resultado" : partido?.estado === "en_curso" ? "jugando" : "armar";

  async function procesarInscripcion() {
    if (!usuarioActual) { router.push("/login"); return; }
    setProcesando(true);
    setMensaje("");
    const costoInscripcion = partido.precio_creditos ?? 0;

    const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", usuarioActual.id).single();
    const creditosActuales = perfil?.creditos || 0;

    if (creditosActuales < costoInscripcion) {
      setMensaje(`No tienes créditos suficientes.`);
      setProcesando(false);
      return;
    }

    const nuevoBalance = creditosActuales - costoInscripcion;
    await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", usuarioActual.id);
    
    if (costoInscripcion > 0) {
      await supabase.from("credit_ledger").insert({ user_id: usuarioActual.id, partido_id: partido.id, delta: -costoInscripcion, reason: partido.tipo_acceso === "privado" ? "join_private_match" : "join_public_match", balance_after: nuevoBalance });
    }

    const { data: nuevaInscripcion, error } = await supabase.from("partido_jugadores").insert({ partido_id: partido.id, user_id: usuarioActual.id }).select("id").single();

    if (!error) {
      setInscrito(true);
      setInscripcionId(nuevaInscripcion.id);
      setMensaje("¡Te has unido al partido con éxito!");
      const nuevoJugadorLocal = { id: nuevaInscripcion.id, user_id: usuarioActual.id, equipo: null, goles: 0, nombre: perfil?.nombre || "Jugador", avatarUrl: perfil?.avatar_url || null, profiles: perfil, media: 64, partidosJugados: 0 };
      setJugadores([...jugadores, nuevoJugadorLocal]);
    } else {
      setMensaje("Hubo un error al unirte.");
    }
    setProcesando(false);
  }

  async function cancelarInscripcion() {
    if (!confirm("¿Seguro que deseas cancelar tu inscripción?")) return;
    setProcesando(true);

    const { error } = await supabase.from("partido_jugadores").delete().eq("id", inscripcionId);
    if (!error) {
      const costoInscripcion = partido.precio_creditos ?? 0;
      if (costoInscripcion > 0) {
        const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", usuarioActual.id).single();
        const nuevoBalance = (perfil?.creditos || 0) + costoInscripcion;
        await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", usuarioActual.id);
        await supabase.from("credit_ledger").insert({ user_id: usuarioActual.id, partido_id: partido.id, delta: costoInscripcion, reason: "cancel_match_join", balance_after: nuevoBalance });
      }
      setInscrito(false);
      setInscripcionId(null);
      setJugadores(jugadores.filter(j => j.id !== inscripcionId));
      setMensaje("Inscripción cancelada. Créditos devueltos.");
    }
    setProcesando(false);
  }

  async function asegurarEquiposAsignados(listaActual) {
    const sinEquipo = listaActual.filter((j) => j.equipo !== 1 && j.equipo !== 2);
    if (sinEquipo.length === 0) return listaActual;

    const conEquipo1 = listaActual.filter((j) => j.equipo === 1);
    const conEquipo2 = listaActual.filter((j) => j.equipo === 2);
    let suma1 = conEquipo1.reduce((acc, j) => acc + j.media, 0);
    let suma2 = conEquipo2.reduce((acc, j) => acc + j.media, 0);

    const ordenadosSin = [...sinEquipo].sort((a, b) => b.media - a.media);
    const listaActualizada = [...listaActual];

    for (const j of ordenadosSin) {
      const equipoAsignado = suma1 <= suma2 ? 1 : 2;
      if (equipoAsignado === 1) suma1 += j.media;
      else suma2 += j.media;
      const idx = listaActualizada.findIndex((item) => item.id === j.id);
      if (idx !== -1) listaActualizada[idx].equipo = equipoAsignado;
      await supabase.from("partido_jugadores").update({ equipo: equipoAsignado }).eq("id", j.id);
    }
    return listaActualizada;
  }

  async function cambiarEquipo(inscripcionId, nuevoEquipo) {
    setProcesando(true);
    await supabase.from("partido_jugadores").update({ equipo: nuevoEquipo }).eq("id", inscripcionId);
    setJugadores((prev) => prev.map((j) => (j.id === inscripcionId ? { ...j, equipo: nuevoEquipo } : j)));
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

    const { equipo1, equipo2 } = balancearEquipos(jugadores);

    const updates = [
      ...equipo1.map((id) => supabase.from("partido_jugadores").update({ equipo: 1 }).eq("id", id)),
      ...equipo2.map((id) => supabase.from("partido_jugadores").update({ equipo: 2 }).eq("id", id)),
    ];
    await Promise.all(updates);
    
    const { data, error } = await supabase.from("partidos").update({ estado: "equipos_listos" }).eq("id", id).select();
    if (error || !data || data.length === 0) {
      setMensaje("Error BD (RLS): No tienes permisos para sortear.");
      setProcesando(false);
      return;
    }

    setJugadores((prev) => prev.map((j) => ({ ...j, equipo: equipo1.includes(j.id) ? 1 : 2 })));
    setPartido((prev) => ({ ...prev, estado: "equipos_listos" }));
    setMensaje("Equipos sorteados de forma equilibrada.");
    setProcesando(false);
  }

  async function comenzarPartido() {
    if (jugadores.length < cuposMinimos) { setMensaje(`Faltan jugadores para el mínimo (${cuposMinimos}).`); return; }
    setProcesando(true);
    setMensaje("");
    
    const listaConEquipos = await asegurarEquiposAsignados(jugadores);
    setJugadores(listaConEquipos);

    const { data, error } = await supabase.from("partidos").update({ estado: "en_curso" }).eq("id", id).select();
    if (error || !data || data.length === 0) { 
      setMensaje("Error BD (RLS): No tienes permisos para iniciar."); 
      setProcesando(false); 
      return; 
    }

    setPartido((prev) => ({ ...prev, estado: "en_curso" }));
    setProcesando(false);
  }

  // --- MOTOR DE ESTADÍSTICAS 100% BLINDADO Y APLANADO ---
  async function recalcularEstadisticasJugador(uid, inscripcionesVivas, partidoEnVivo) {
    try {
      // 1. Buscamos todas las inscripciones del jugador en la historia
      const { data: historialPJ } = await supabase
        .from("partido_jugadores")
        .select("id, partido_id, equipo, goles, asistencias")
        .eq("user_id", uid);

      if (!historialPJ || historialPJ.length === 0) return;

      const partidoIds = historialPJ.map((h) => h.partido_id).filter(Boolean);
      
      // 2. Traemos todos los partidos correspondientes (Sin joins para evitar bugs)
      const { data: partidosData } = await supabase
        .from("partidos")
        .select("id, goles_equipo1, goles_equipo2, estado, tipo_acceso, created_at")
        .in("id", partidoIds);
      
      const partidosMap = new Map((partidosData || []).map((p) => [p.id, p]));

      // 3. APLANAMOS LA LISTA para no dejar márgenes de error
      const listaLimpia = [];
      
      for (const i of historialPJ) {
         const pDataDB = partidosMap.get(i.partido_id);
         if (!pDataDB) continue; 

         const esLive = i.partido_id === partidoEnVivo.id;
         
         const tipoAcceso = esLive ? partidoEnVivo.tipo_acceso : pDataDB.tipo_acceso;
         const estado = esLive ? partidoEnVivo.estado : pDataDB.estado;

         if (tipoAcceso === "privado") continue;
         if (!esLive && estado !== "finalizado") continue;

         // Datos inyectados si es el partido en vivo (evita latencia de base de datos)
         const golesJugador = esLive ? (inscripcionesVivas[i.id]?.goles || 0) : (Number(i.goles) || 0);
         const equipoJugador = esLive ? (inscripcionesVivas[i.id]?.equipo || null) : (Number(i.equipo) || null);
         
         if (!equipoJugador) continue;
         
         const g1 = esLive ? partidoEnVivo.goles_equipo1 : (Number(pDataDB.goles_equipo1) || 0);
         const g2 = esLive ? partidoEnVivo.goles_equipo2 : (Number(pDataDB.goles_equipo2) || 0);
         
         const esEmpate = g1 === g2;
         const gano = (equipoJugador === 1 && g1 > g2) || (equipoJugador === 2 && g2 > g1);

         const fechaRealDB = new Date(pDataDB.created_at).getTime();

         listaLimpia.push({
           fechaRealDB,
           goles: golesJugador,
           esEmpate,
           gano,
           esLive
         });
      }
      
      // Ordenamos cronológicamente
      listaLimpia.sort((a,b) => a.fechaRealDB - b.fechaRealDB);
      
      // 4. Calculamos las estadísticas GLOBALES del jugador
      const partidos_jugados = listaLimpia.length;
      const goles_total = listaLimpia.reduce((acc, p) => acc + p.goles, 0);
      const victorias = listaLimpia.filter(p => p.gano).length;
      const derrotas = listaLimpia.filter(p => !p.gano && !p.esEmpate).length;
      const empates = listaLimpia.filter(p => p.esEmpate).length;
      const asistencias_total = historialPJ.reduce((acc, i) => acc + (Number(i.asistencias) || 0), 0);

      // 5. Evaluamos la obtención de LOGROS
      const { data: todosLosLogros } = await supabase.from("logros").select("*").eq("activo", true);
      const { data: yaDesbloqueados } = await supabase.from("user_logros").select("logro_id").eq("user_id", uid);
      
      const idsDesbloqueados = new Set((yaDesbloqueados || []).map((d) => d.logro_id));
      const nuevosDesbloqueos = [];
      
      for (const logro of (todosLosLogros || [])) {
         if (idsDesbloqueados.has(logro.id)) continue;
         
         const timestampCreacionLogro = new Date(logro.created_at).getTime();
         
         // Filtramos los partidos: Solo cuentan los que sucedieron DESPUÉS de que se creó el logro
         const partidosValidosParaEsteLogro = listaLimpia.filter(p => {
           return p.esLive || p.fechaRealDB >= timestampCreacionLogro;
         });
         
         let rachaMax = 0;
         let rachaActual = 0;
         partidosValidosParaEsteLogro.forEach(p => {
           if (p.gano) { rachaActual++; rachaMax = Math.max(rachaMax, rachaActual); }
           else { rachaActual = 0; }
         });
         
         // Preparamos el objeto para la función de validación
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

      // Guardamos los logros de forma segura con INSERT (sin Upsert conflictivo)
      if (nuevosDesbloqueos.length > 0) {
        await supabase.from("user_logros").insert(
          nuevosDesbloqueos.map((l) => ({ user_id: uid, logro_id: l.id }))
        );
        nuevosDesbloqueos.forEach((l) => idsDesbloqueados.add(l.id));
      }

      // 6. Calculamos mejoras y actualizamos el perfil de fútbol
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
        asistencias: asistencias_total, 
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

    const golesEquipo1 = jugadores.filter((j) => j.equipo === 1).reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
    const golesEquipo2 = jugadores.filter((j) => j.equipo === 2).reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);

    const updateGolesPromises = jugadores.map((j) => supabase.from("partido_jugadores").update({ goles: Number(goles[j.id]) || 0 }).eq("id", j.id));
    await Promise.all(updateGolesPromises);

    const { data: partidoActualizado, error: errorPartido } = await supabase
      .from("partidos")
      .update({ estado: "finalizado", goles_equipo1: golesEquipo1, goles_equipo2: golesEquipo2 })
      .eq("id", id)
      .select();

    if (errorPartido || !partidoActualizado || partidoActualizado.length === 0) { 
      setMensaje("Error BD (RLS): No tienes permisos para finalizar."); 
      setProcesando(false); 
      return; 
    }

    if (partido.tipo_acceso !== "privado") {
      const inscripcionesVivas = {};
      jugadores.forEach((j) => { 
        inscripcionesVivas[j.id] = {
          goles: Number(goles[j.id]) || 0,
          equipo: Number(j.equipo)
        }; 
      });
      
      const partidoEnVivo = {
        id: id,
        goles_equipo1: golesEquipo1,
        goles_equipo2: golesEquipo2,
        estado: "finalizado",
        tipo_acceso: partido.tipo_acceso
      };

      const idsUnicos = [...new Set(jugadores.map((j) => j.user_id))];
      await Promise.all(idsUnicos.map((uid) => recalcularEstadisticasJugador(uid, inscripcionesVivas, partidoEnVivo)));
      setMensaje(`Partido Público finalizado. Stats actualizadas. ${golesEquipo1} - ${golesEquipo2}`);
    } else {
      setMensaje(`Partido Privado finalizado. ${golesEquipo1} - ${golesEquipo2} (No suma a las Stats)`);
    }

    setPartido((prev) => ({ ...prev, estado: "finalizado", goles_equipo1: golesEquipo1, goles_equipo2: golesEquipo2 }));
    setJugadores((prev) => prev.map((j) => ({ ...j, goles: Number(goles[j.id]) || 0 })));
    setProcesando(false);
  }

  // ==========================================
  // RENDER PRINCIPAL
  // ==========================================
  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!partido) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-xl font-bold">Partido no encontrado</h1></div>;
  }

  if (!accesoConcedido) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-xl text-center border border-gray-100">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Cancha Privada</h1>
          <p className="text-sm text-gray-500 font-medium mb-8">Ingresa el PIN de acceso que te compartió el organizador.</p>
          
          <input 
            type="text" 
            maxLength={6}
            placeholder="PIN"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value.toUpperCase())}
            className="w-full text-center text-3xl font-black tracking-[0.2em] bg-gray-50 border-2 border-gray-200 rounded-2xl py-4 focus:outline-none focus:border-[#00FF9D] focus:ring-2 focus:ring-[#00FF9D]/20 transition-all uppercase mb-4"
          />
          {errorPassword && <p className="text-xs font-bold text-red-500 mb-4 bg-red-50 py-2 rounded-lg">{errorPassword}</p>}
          
          <button 
            onClick={() => {
              if (passwordInput === partido.password) { setAccesoConcedido(true); } 
              else { setErrorPassword("PIN incorrecto. Revisa e intenta de nuevo."); }
            }}
            className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-gray-900 transition-colors"
          >
            Desbloquear Partido
          </button>
          <Link href="/futbol" className="block mt-6 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const imagenCancha = partido.sedes?.imagen_url || partido.imagen_url || "https://images.unsplash.com/photo-1518605368461-1ee7e53f090b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80";
  const equipo1 = jugadores.filter(j => j.equipo === 1);
  const equipo2 = jugadores.filter(j => j.equipo === 2);
  const sinAsignar = jugadores.filter(j => j.equipo !== 1 && j.equipo !== 2);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32 pt-4 md:pt-8">
      <main className="max-w-3xl mx-auto px-4 flex flex-col gap-6">
        
        <div className="relative h-64 md:h-80 w-full bg-gray-900 rounded-3xl overflow-hidden shadow-md border border-gray-100">
          <img src={imagenCancha} alt="Cancha" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-[#0B0C15]/40 to-transparent"></div>
          
          <div className="absolute top-4 left-4 z-10">
            <Link href="/futbol" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
          </div>

          <div className="absolute top-4 right-4 z-10 flex gap-2">
            {partido.tipo_acceso === "privado" && (
              <span className="bg-white/95 text-indigo-800 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Privado
              </span>
            )}
            <span className={`bg-white/95 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md ${
              partido?.estado === "finalizado" ? "text-gray-500" :
              partido?.estado === "en_curso" ? "text-blue-600" : 
              "text-emerald-800"
            }`}>
              {partido?.estado === "finalizado" ? "Finalizado" : 
               partido?.estado === "en_curso" ? "En Curso" : 
               partido.precio_creditos === 0 ? "Gratis" : `${partido.precio_creditos} créditos`}
            </span>
          </div>

          <div className="absolute bottom-6 left-4 right-4 md:left-8 z-10">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{partido.cancha_lugar}</h1>
            <div className="flex items-center gap-1.5 mt-2 opacity-90">
              <svg className="w-4 h-4 text-[#00FF9D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
              <p className="text-white text-sm font-medium">{partido.zona} • {partido.sedes?.direccion}</p>
            </div>
          </div>
        </div>

        {esCreador && partido.tipo_acceso === "privado" && !partidoIniciado && (
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">👑</span>
                <h3 className="font-black text-indigo-900 text-lg">Eres el organizador</h3>
              </div>
              <p className="text-indigo-700/80 text-sm font-medium">Comparte este PIN con tus amigos para que entren gratis.</p>
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-2xl px-6 py-4 flex flex-col items-center justify-center shrink-0 shadow-sm">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">PIN DE ACCESO</span>
              <span className="text-3xl font-black text-indigo-900 tracking-[0.2em]">{partido.password}</span>
            </div>
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
              <p className="text-sm font-black text-gray-900">{formatFechaCompleta(partido.fecha)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora</p>
              <p className="text-sm font-black text-gray-900">{formatHora12(partido.hora)}</p>
            </div>
          </div>
        </div>

        {modoDnd === "resultado" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center space-y-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resultado final</p>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500 mb-1">Equipo 1</p>
                <p className="text-5xl font-black text-gray-900">{partido.goles_equipo1 ?? 0}</p>
              </div>
              <p className="text-2xl font-black text-gray-300">-</p>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500 mb-1">Equipo 2</p>
                <p className="text-5xl font-black text-gray-900">{partido.goles_equipo2 ?? 0}</p>
              </div>
            </div>
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
              <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full mb-2 border border-blue-100">Equipos Sorteados</span>
              <h3 className="text-2xl font-black text-gray-900 uppercase">Alineaciones</h3>
            </div>
          )}

          {esCreador && partido?.estado !== "finalizado" ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                
                {partidoIniciado && (
                  <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#0B0C15] text-[#00FF9D] rounded-full items-center justify-center font-black text-xs uppercase tracking-widest z-10 shadow-xl border-4 border-white">
                    VS
                  </div>
                )}

                <EquipoColumna id="equipo-1" titulo="Equipo 1" jugadores={equipo1}>
                  {equipo1.map((j) => (
                    <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [j.id]: e.target.value }))} onCambiarEquipo={() => cambiarEquipo(j.id, 2)} />
                  ))}
                </EquipoColumna>

                <EquipoColumna id="equipo-2" titulo="Equipo 2" jugadores={equipo2}>
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
                      <button onClick={sortearEquipos} disabled={procesando || jugadores.length < cuposMinimos} className="w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        🎲 Sortear equipos equilibrados
                      </button>
                      <button onClick={comenzarPartido} disabled={procesando || jugadores.length < cuposMinimos} className="w-full bg-[#00FF9D] text-[#0B0C15] font-black uppercase tracking-widest hover:bg-[#00e58d] py-3.5 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400">
                        {procesando ? "Procesando…" : "▶ Comenzar partido"}
                      </button>
                    </>
                  )}
                  {modoDnd === "jugando" && (
                    <button onClick={finalizarPartido} disabled={procesando} className="w-full bg-gray-900 hover:bg-black active:bg-gray-800 text-white font-bold py-3.5 px-4 rounded-2xl text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
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
                        {jugador.user_id === partido.creador_id && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Organizador</span>}
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: cuposTotales - cuposOcupados }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-gray-100 opacity-50">
                      <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0 flex items-center justify-center text-gray-300"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Libre</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative">
                  <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-[#0B0C15] text-[#00FF9D] rounded-full items-center justify-center font-black text-xs uppercase tracking-widest z-10 shadow-xl border-4 border-white">VS</div>
                  <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5">
                    <h4 className="font-black text-center text-gray-900 uppercase tracking-widest border-b-2 border-gray-200 pb-3 mb-4">Equipo 1</h4>
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
                  <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5">
                    <h4 className="font-black text-center text-white uppercase tracking-widest border-b-2 border-gray-700 pb-3 mb-4">Equipo 2</h4>
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

      {!partidoIniciado && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
          <div className="max-w-3xl mx-auto flex gap-3">
            {inscrito ? (
              <button onClick={cancelarInscripcion} disabled={procesando} className="flex-1 bg-red-50 text-red-600 font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-red-100 transition-colors disabled:opacity-50 text-sm border border-red-100">Cancelar Inscripción</button>
            ) : (
              <button onClick={procesarInscripcion} disabled={lleno || procesando} className={`flex-1 font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm ${lleno ? "bg-gray-100 text-gray-400" : "bg-[#0B0C15] text-[#00FF9D] hover:bg-gray-900 shadow-lg shadow-gray-900/20"}`}>
                {procesando ? "..." : lleno ? "Partido Lleno" : "Unirme al Partido"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}