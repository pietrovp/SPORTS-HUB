"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { supabase } from "../../../../../lib/supabaseClient";
import { cumpleRequisito } from "../../../../../lib/futbol/logros";

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
        {jugadores.length === 0 ? <p className="text-xs text-gray-300 text-center py-4 font-medium">Sin jugadores asignados</p> : children}
      </div>
    </div>
  );
}

export default function OrganizarPartido() {
  const router = useRouter();
  const params = useParams();
  const partidoId = params.id;

  const [partido, setPartido] = useState(null);
  const [inscritos, setInscritos] = useState([]);
  const [goles, setGoles] = useState({});
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [autorizado, setAutorizado] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function cargarTodo() {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCargando(false); return; }

    const { data: perfilUsuario } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!perfilUsuario?.is_admin) { setCargando(false); return; }

    setAutorizado(true);

    const { data: partidoData } = await supabase.from("partidos").select("*").eq("id", partidoId).single();
    setPartido(partidoData);

    const { data: inscripcionesData } = await supabase.from("partido_jugadores").select("id, user_id, goles, asistencias, equipo").eq("partido_id", partidoId);
    const idsUsuarios = (inscripcionesData || []).map((i) => i.user_id);

    let perfilesFutbol = [];
    let perfilesGenerales = [];

    if (idsUsuarios.length > 0) {
      const [{ data: fData }, { data: pData }] = await Promise.all([
        supabase.from("futbol_profiles").select("id, posicion, rating, partidos_jugados, goles").in("id", idsUsuarios),
        supabase.from("profiles").select("id, nombre, avatar_url").in("id", idsUsuarios),
      ]);
      perfilesFutbol = fData || [];
      perfilesGenerales = pData || [];
    }

    const lista = (inscripcionesData || []).map((i) => {
      const fPerfil = perfilesFutbol.find((p) => p.id === i.user_id);
      const pPerfil = perfilesGenerales.find((p) => p.id === i.user_id);

      return {
        id: i.id,
        usuario_id: i.user_id,
        nombre: pPerfil?.nombre || "Jugador",
        posicion: fPerfil?.posicion || "MED",
        media: fPerfil?.rating != null ? Math.round(Number(fPerfil.rating)) : 64,
        avatarUrl: pPerfil?.avatar_url || null,
        equipo: i.equipo ? Number(i.equipo) : null,
        goles: Number(i.goles) || 0,
        partidosJugados: fPerfil?.partidos_jugados ?? 0,
        golesTotal: fPerfil?.goles ?? 0,
      };
    });

    setInscritos(lista);

    const golesIniciales = {};
    lista.forEach((j) => { golesIniciales[j.id] = j.goles; });
    setGoles(golesIniciales);
    setCargando(false);
  }

  useEffect(() => { cargarTodo(); }, [partidoId]);

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
      let equipoAsignado = 1;
      if (suma1 <= suma2) { equipoAsignado = 1; suma1 += j.media; } 
      else { equipoAsignado = 2; suma2 += j.media; }

      const idx = listaActualizada.findIndex((item) => item.id === j.id);
      if (idx !== -1) listaActualizada[idx].equipo = equipoAsignado;

      await supabase.from("partido_jugadores").update({ equipo: equipoAsignado }).eq("id", j.id);
    }
    return listaActualizada;
  }

  async function cambiarEquipo(inscripcionId, nuevoEquipo) {
    setProcesando(true);
    await supabase.from("partido_jugadores").update({ equipo: nuevoEquipo }).eq("id", inscripcionId);
    setInscritos((prev) => prev.map((j) => (j.id === inscripcionId ? { ...j, equipo: nuevoEquipo } : j)));
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

    const jugador = inscritos.find((j) => j.id === active.id);
    if (!jugador || jugador.equipo === targetEquipo) return;
    cambiarEquipo(jugador.id, targetEquipo);
  }

  async function sortearEquipos() {
    if (inscritos.length < 2) { setMensaje("Necesitas al menos 2 jugadores."); return; }
    setProcesando(true); setMensaje("");

    const { equipo1, equipo2 } = balancearEquipos(inscritos);

    const updates = [
      ...equipo1.map((id) => supabase.from("partido_jugadores").update({ equipo: 1 }).eq("id", id)),
      ...equipo2.map((id) => supabase.from("partido_jugadores").update({ equipo: 2 }).eq("id", id)),
    ];
    await Promise.all(updates);
    await supabase.from("partidos").update({ estado: "equipos_listos" }).eq("id", partidoId);

    setInscritos((prev) => prev.map((j) => ({ ...j, equipo: equipo1.includes(j.id) ? 1 : 2 })));
    setPartido((prev) => ({ ...prev, estado: "equipos_listos" }));
    setMensaje("Equipos sorteados de forma equilibrada.");
    setProcesando(false);
  }

  async function comenzarPartido() {
    setProcesando(true); setMensaje("");
    const listaConEquipos = await asegurarEquiposAsignados(inscritos);
    setInscritos(listaConEquipos);
    
    const { error } = await supabase.from("partidos").update({ estado: "en_curso" }).eq("id", partidoId);
    if (error) { setMensaje("No se pudo iniciar el partido."); setProcesando(false); return; }
    
    setPartido((prev) => ({ ...prev, estado: "en_curso" }));
    setProcesando(false);
  }

  async function recalcularEstadisticasJugador(usuarioId) {
    try {
      const { data: historialPJ } = await supabase.from("partido_jugadores").select("id, partido_id, equipo, goles, asistencias").eq("user_id", usuarioId);
      if (!historialPJ || historialPJ.length === 0) return;

      const partidoIds = historialPJ.map((h) => h.partido_id).filter(Boolean);
      const { data: partidosData } = await supabase.from("partidos").select("id, goles_equipo1, goles_equipo2, estado, fecha").in("id", partidoIds);
      const partidosMap = new Map((partidosData || []).map((p) => [p.id, p]));

      const listaFinalizados = historialPJ.map((i) => ({ ...i, partido: partidosMap.get(i.partido_id) })).filter((i) => i.partido && i.partido.estado === "finalizado");

      const partidos_jugados = listaFinalizados.length;
      const goles_total = listaFinalizados.reduce((acc, i) => acc + (Number(i.goles) || 0), 0);
      const asistencias_total = listaFinalizados.reduce((acc, i) => acc + (Number(i.asistencias) || 0), 0);
      const max_goles_partido = listaFinalizados.reduce((acc, i) => Math.max(acc, Number(i.goles) || 0), 0);

      let victorias = 0, derrotas = 0, empates = 0, rachaActual = 0, racha_victorias_max = 0;

      listaFinalizados.sort((a, b) => new Date(a.partido?.fecha || 0).getTime() - new Date(b.partido?.fecha || 0).getTime()).forEach((i) => {
        const eq = Number(i.equipo);
        if (!eq) return;
        const g1 = Number(i.partido.goles_equipo1) || 0;
        const g2 = Number(i.partido.goles_equipo2) || 0;
        if (g1 === g2) { empates++; rachaActual = 0; return; }

        const gano = (eq === 1 && g1 > g2) || (eq === 2 && g2 > g1);
        if (gano) { victorias++; rachaActual++; racha_victorias_max = Math.max(racha_victorias_max, rachaActual); } 
        else { derrotas++; rachaActual = 0; }
      });

      const statsParaLogros = { partidos_jugados, goles_total, victorias, max_goles_partido, racha_victorias_max };

      // CÁLCULO DE LOGROS BLINDADO AL 100% EN JAVASCRIPT
      const { data: todosLosLogros } = await supabase.from("logros").select("*");
      const { data: yaDesbloqueados } = await supabase.from("user_logros").select("logro_id").eq("user_id", usuarioId);
      const idsDesbloqueados = new Set((yaDesbloqueados || []).map((d) => d.logro_id));

      const nuevosDesbloqueos = (todosLosLogros || []).filter((l) => l.activo && !idsDesbloqueados.has(l.id) && cumpleRequisito(l, statsParaLogros));
      
      if (nuevosDesbloqueos.length > 0) {
        await supabase.from("user_logros").upsert(nuevosDesbloqueos.map((l) => ({ user_id: usuarioId, logro_id: l.id })), { onConflict: "user_id,logro_id", ignoreDuplicates: true });
        
        // Agregamos localmente al Set para sumarles la media sin tener que hacer otra consulta
        nuevosDesbloqueos.forEach(l => idsDesbloqueados.add(l.id));
      }

      let bonoRatingTotal = 0;
      let bonosExtra = {};

      // Sumamos los puntos leyendo el Set directamente
      (todosLosLogros || []).forEach(l => {
         if (idsDesbloqueados.has(l.id)) {
             const stat = String(l.stat_mejora || "").toLowerCase().trim();
             const valor = Number(l.valor_mejora) || 0;
             if (["rating", "media_general", "ovr", "media"].includes(stat)) {
                bonoRatingTotal += valor;
             } else if (stat) {
                bonosExtra[stat] = (bonosExtra[stat] || 0) + valor;
             }
         }
      });

      const rating_final = Math.min(99, 64 + bonoRatingTotal);

      const updates = {
        id: usuarioId,
        partidos_jugados,
        goles: goles_total,
        asistencias: asistencias_total,
        victorias,
        derrotas,
        empates,
        rating: rating_final,
      };

      if (Object.keys(bonosExtra).length > 0) {
        const { data: perfilActual } = await supabase.from("futbol_profiles").select("ritmo, tiro, pase, regate, defensa, fisico").eq("id", usuarioId).maybeSingle();
        const baseStats = perfilActual || { ritmo: 64, tiro: 64, pase: 64, regate: 64, defensa: 64, fisico: 64 };
        for (const [key, val] of Object.entries(bonosExtra)) {
           if (key in baseStats) updates[key] = Math.min(99, (Number(baseStats[key]) || 64) + val);
        }
      }

      await supabase.from("futbol_profiles").upsert(updates, { onConflict: "id" });
    } catch (err) {
      console.error("Error recalculando stats:", err);
    }
  }

  async function guardarResultado(e) {
    e.preventDefault();
    setProcesando(true);
    setMensaje("Guardando goles y calculando logros...");

    const listaConEquipos = await asegurarEquiposAsignados(inscritos);
    setInscritos(listaConEquipos);

    for (const jugador of listaConEquipos) {
      const { error: updErr } = await supabase
        .from("partido_jugadores")
        .update({ goles: Number(goles[jugador.id]) || 0, equipo: jugador.equipo })
        .eq("id", jugador.id);

      if (updErr) {
        setMensaje(`Error guardando al jugador ${jugador.nombre}: ${updErr.message}`);
        setProcesando(false);
        return;
      }
    }

    const golesEquipo1 = listaConEquipos.filter((j) => j.equipo === 1).reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
    const golesEquipo2 = listaConEquipos.filter((j) => j.equipo === 2).reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);

    const { error: partidoError } = await supabase.from("partidos").update({ goles_equipo1: golesEquipo1, goles_equipo2: golesEquipo2, estado: "finalizado" }).eq("id", partidoId);

    if (partidoError) { setMensaje("Error al finalizar: " + partidoError.message); setProcesando(false); return; }

    const idsUnicos = [...new Set(listaConEquipos.map((j) => j.usuario_id))];
    for (const usuarioId of idsUnicos) { await recalcularEstadisticasJugador(usuarioId); }

    await cargarTodo();
    setMensaje("¡Listo! Resultado guardado y perfiles actualizados.");
    setProcesando(false);
  }

  if (cargando) return <div className="flex justify-center items-center min-h-[300px]"><div className="animate-spin text-4xl">⚽</div></div>;
  if (!autorizado) return <div className="flex flex-col items-center gap-4 py-16 text-center"><div className="text-5xl">🔒</div><h1 className="text-xl font-bold text-gray-800">Acceso denegado</h1><Link href={`/futbol/partido/${partidoId}`} className="text-emerald-600 text-sm hover:underline font-bold">Volver al partido</Link></div>;
  if (!partido) return <p className="text-sm text-gray-500">Partido no encontrado.</p>;

  const equipo1 = inscritos.filter((j) => j.equipo === 1);
  const equipo2 = inscritos.filter((j) => j.equipo === 2);
  const sinEquipo = inscritos.filter((j) => j.equipo !== 1 && j.equipo !== 2);
  const modo = partido.estado === "abierto" || partido.estado === "equipos_listos" ? "armar" : partido.estado === "en_curso" ? "jugando" : "resultado";

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <Link href={`/futbol/partido/${partidoId}`} className="text-sm text-emerald-600 hover:underline w-fit font-medium">← Volver al partido</Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{partido.cancha_lugar || partido.cancha || partido.titulo}</h1>
          <p className="text-sm text-gray-500">{partido.zona}</p>
        </div>
        {modo === "armar" && (
          <button onClick={sortearEquipos} disabled={procesando || inscritos.length < 2} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition shadow-sm">
            🎲 Sortear equipos
          </button>
        )}
      </div>

      {partido.estado === "finalizado" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Resultado final</p>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-gray-600">Equipo 1</span>
            <span className="text-5xl font-black text-emerald-800">{partido.goles_equipo1 ?? 0} - {partido.goles_equipo2 ?? 0}</span>
            <span className="text-sm font-semibold text-gray-600">Equipo 2</span>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {modo === "armar" && sinEquipo.length > 0 && (
          <EquipoColumna id="equipo-null" titulo={`Sin equipo asignado (${sinEquipo.length})`} jugadores={sinEquipo}>
            {sinEquipo.map((jugador) => <JugadorDraggable key={jugador.id} jugador={jugador} modo={modo} onCambiarEquipo={() => cambiarEquipo(jugador.id, 1)} />)}
          </EquipoColumna>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <EquipoColumna id="equipo-1" titulo={`Equipo 1 (${equipo1.length})`} jugadores={equipo1}>
            {equipo1.map((jugador) => <JugadorDraggable key={jugador.id} jugador={jugador} modo={modo} onCambiarEquipo={() => cambiarEquipo(jugador.id, 2)} valorGol={goles[jugador.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [jugador.id]: e.target.value }))} />)}
          </EquipoColumna>
          <EquipoColumna id="equipo-2" titulo={`Equipo 2 (${equipo2.length})`} jugadores={equipo2}>
            {equipo2.map((jugador) => <JugadorDraggable key={jugador.id} jugador={jugador} modo={modo} onCambiarEquipo={() => cambiarEquipo(jugador.id, 1)} valorGol={goles[jugador.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [jugador.id]: e.target.value }))} />)}
          </EquipoColumna>
        </div>
      </DndContext>

      {modo === "armar" && (
        <button onClick={comenzarPartido} disabled={procesando || inscritos.length === 0} className="rounded-xl py-3.5 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm">
          {procesando ? "Iniciando..." : "▶️ Comenzar partido"}
        </button>
      )}
      {partido.estado === "en_curso" && (
        <form onSubmit={guardarResultado}>
          <button type="submit" disabled={procesando} className="w-full rounded-xl py-3.5 text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition shadow-sm">
            {procesando ? "Calculando estadísticas..." : "🏁 Finalizar partido y guardar"}
          </button>
        </form>
      )}
      {mensaje && <p className={`text-sm text-center font-medium ${mensaje.includes("Error") ? "text-red-500" : "text-emerald-600"}`}>{mensaje}</p>}
    </div>
  );
}