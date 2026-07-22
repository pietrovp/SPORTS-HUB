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

    const { data: perfilUsuario } = await supabase.from("perfiles").select("is_admin").eq("id", user.id).single();
    if (!perfilUsuario?.is_admin) { setCargando(false); return; }

    setAutorizado(true);

    const { data: partidoData } = await supabase.from("partidos").select("*").eq("id", partidoId).single();
    setPartido(partidoData);

    const { data: inscripcionesData } = await supabase.from("inscripciones").select("id, user_id, goles, asistencias, equipo").eq("partido_id", partidoId);
    const idsUsuarios = (inscripcionesData || []).map((i) => i.user_id);

    let perfilesFutbol = [];
    let perfilesGenerales = [];

    if (idsUsuarios.length > 0) {
      const [{ data: fData }, { data: pData }] = await Promise.all([
        supabase.from("futbol_profiles").select("id, posicion, media, partidos_jugados, goles").in("id", idsUsuarios),
        supabase.from("perfiles").select("id, nombre, avatar_url").in("id", idsUsuarios),
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
        media: fPerfil?.media != null ? Math.round(Number(fPerfil.media)) : 64,
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

      await supabase.from("inscripciones").update({ equipo: equipoAsignado }).eq("id", j.id);
    }
    return listaActualizada;
  }

  async function cambiarEquipo(inscripcionId, nuevoEquipo) {
    setProcesando(true);
    await supabase.from("inscripciones").update({ equipo: nuevoEquipo }).eq("id", inscripcionId);
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
      ...equipo1.map((id) => supabase.from("inscripciones").update({ equipo: 1 }).eq("id", id)),
      ...equipo2.map((id) => supabase.from("inscripciones").update({ equipo: 2 }).eq("id", id)),
    ];
    await Promise.all(updates);

    setInscritos((prev) => prev.map((j) => ({
      ...j,
      equipo: equipo1.includes(j.id) ? 1 : equipo2.includes(j.id) ? 2 : null,
    })));
    setProcesando(false);
  }

  async function guardarResultadoParcial() {
    setProcesando(true);
    const updates = inscritos.map((j) => supabase.from("inscripciones").update({ goles: Number(goles[j.id]) || 0 }).eq("id", j.id));
    await Promise.all(updates);
    setMensaje("Resultado guardado.");
    setProcesando(false);
  }

  async function iniciarPartido() {
    setProcesando(true); setMensaje("");

    const listaAsignada = await asegurarEquiposAsignados(inscritos);
    setInscritos(listaAsignada);

    const { error } = await supabase.from("partidos").update({ estado: "en_curso" }).eq("id", partidoId);
    if (error) { setMensaje("No se pudo iniciar el partido."); setProcesando(false); return; }

    setPartido((prev) => ({ ...prev, estado: "en_curso" }));
    setProcesando(false);
  }

  // FIX: recibe los goles del partido actual directamente para evitar race condition
  async function recalcularEstadisticasJugador(usuarioId, golesPartidoActualPorInscripcionId) {
    try {
      const { data: historialPJ } = await supabase
        .from("inscripciones")
        .select("id, partido_id, equipo, goles, asistencias")
        .eq("user_id", usuarioId);

      if (!historialPJ || historialPJ.length === 0) return;

      const partidoIds = historialPJ.map((h) => h.partido_id).filter(Boolean);
      const { data: partidosData } = await supabase
        .from("partidos")
        .select("id, goles_equipo1, goles_equipo2, estado, fecha")
        .in("id", partidoIds);
      const partidosMap = new Map((partidosData || []).map((p) => [p.id, p]));

      const listaFinalizados = historialPJ
        .map((i) => {
          const partidoDB = partidosMap.get(i.partido_id);
          const golesReales =
            golesPartidoActualPorInscripcionId && golesPartidoActualPorInscripcionId[i.id] != null
              ? Number(golesPartidoActualPorInscripcionId[i.id])
              : Number(i.goles) || 0;
          return { ...i, goles: golesReales, partido: partidoDB };
        })
        .filter((i) => {
          if (!i.partido) return false;
          if (i.partido.estado === "finalizado") return true;
          if (i.partido_id === partidoId) return true;
          return false;
        });

      const partidos_jugados = listaFinalizados.length;
      const goles_total = listaFinalizados.reduce((acc, i) => acc + (Number(i.goles) || 0), 0);
      const asistencias_total = listaFinalizados.reduce((acc, i) => acc + (Number(i.asistencias) || 0), 0);
      const max_goles_partido = listaFinalizados.reduce((acc, i) => Math.max(acc, Number(i.goles) || 0), 0);

      let victorias = 0, derrotas = 0, empates = 0, rachaActual = 0, racha_victorias_max = 0;

      listaFinalizados
        .sort((a, b) => new Date(a.partido?.fecha || 0).getTime() - new Date(b.partido?.fecha || 0).getTime())
        .forEach((i) => {
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

      const { data: perfilActualBase } = await supabase
        .from("futbol_profiles")
        .select("media, ritmo, tiro, pase, regate, defensa, fisico")
        .eq("id", usuarioId)
        .single();

      const { data: todosLosLogros } = await supabase.from("logros").select("*");
      const { data: yaDesbloqueados } = await supabase
        .from("user_logros")
        .select("logro_id")
        .eq("user_id", usuarioId);

      const idsDesbloqueados = new Set((yaDesbloqueados || []).map((d) => d.logro_id));

      const nuevosDesbloqueos = (todosLosLogros || []).filter(
        (l) => l.activo && !idsDesbloqueados.has(l.id) && cumpleRequisito(l, statsParaLogros)
      );

      if (nuevosDesbloqueos.length > 0) {
        await supabase.from("user_logros").upsert(
          nuevosDesbloqueos.map((l) => ({ user_id: usuarioId, logro_id: l.id })),
          { onConflict: "user_id,logro_id", ignoreDuplicates: true }
        );
        nuevosDesbloqueos.forEach((l) => idsDesbloqueados.add(l.id));
      }

      let bonoRatingTotal = 0;
      let bonosExtra = {};

      (todosLosLogros || []).forEach((l) => {
        if (idsDesbloqueados.has(l.id)) {
          const stat = String(l.stat_mejora || "").toLowerCase().trim().replace(/\s+/g, "_");
          const valor = Number(l.valor_mejora) || 0;
          if (["rating", "media_general", "ovr", "media", "overall"].includes(stat)) {
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
        media: rating_final,
      };

      if (Object.keys(bonosExtra).length > 0) {
        const perfilBase = perfilActualBase || {};
        const camposExtra = ["ritmo", "tiro", "pase", "regate", "defensa", "fisico"];
        camposExtra.forEach((campo) => {
          if (bonosExtra[campo] != null) {
            updates[campo] = Math.min(99, (Number(perfilBase[campo]) || 50) + bonosExtra[campo]);
          }
        });
      }

      await supabase.from("futbol_profiles").upsert(updates, { onConflict: "id" });

    } catch (err) {
      console.error("Error recalculando estadísticas:", err);
    }
  }

  async function finalizarPartido() {
    setProcesando(true); setMensaje("");

    const golesEquipo1 = inscritos.filter((j) => j.equipo === 1).reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
    const golesEquipo2 = inscritos.filter((j) => j.equipo === 2).reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);

    const golesActualesPorInscripcion = {};
    inscritos.forEach((j) => {
      golesActualesPorInscripcion[j.id] = Number(goles[j.id]) || 0;
    });

    const actualizacionesInscripciones = inscritos.map((j) =>
      supabase
        .from("inscripciones")
        .update({ goles: Number(goles[j.id]) || 0 })
        .eq("id", j.id)
    );

    await Promise.all([
      ...actualizacionesInscripciones,
      supabase
        .from("partidos")
        .update({ estado: "finalizado", goles_equipo1: golesEquipo1, goles_equipo2: golesEquipo2 })
        .eq("id", partidoId),
    ]);

    const idsUnicos = [...new Set(inscritos.map((j) => j.usuario_id).filter(Boolean))];
    await Promise.all(idsUnicos.map((uid) => recalcularEstadisticasJugador(uid, golesActualesPorInscripcion)));

    setPartido((prev) => ({ ...prev, estado: "finalizado", goles_equipo1: golesEquipo1, goles_equipo2: golesEquipo2 }));
    setInscritos((prev) => prev.map((j) => ({ ...j, goles: Number(goles[j.id]) || 0 })));
    setMensaje("Partido finalizado y estadísticas actualizadas.");
    setProcesando(false);
  }

  const equipo1 = inscritos.filter((j) => j.equipo === 1);
  const equipo2 = inscritos.filter((j) => j.equipo === 2);
  const sinEquipo = inscritos.filter((j) => j.equipo !== 1 && j.equipo !== 2);

  if (cargando) return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>;
  if (!autorizado) return <main className="min-h-screen flex items-center justify-center text-red-500">No autorizado</main>;
  if (!partido) return <main className="min-h-screen flex items-center justify-center text-gray-500">Partido no encontrado</main>;

  const estado = partido.estado;

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-700 tracking-wide">Organizar partido</p>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">{partido.nombre || "Partido"}</h1>
          </div>
          <Link href={`/futbol/partido/${partidoId}`} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-100">Volver</Link>
        </div>

        {mensaje && <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-800">{mensaje}</div>}

        {estado === "pendiente" && (
          <>
            <div className="flex flex-wrap gap-3">
              <button onClick={sortearEquipos} disabled={procesando} className="px-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-60">Sortear equipos</button>
              <button onClick={iniciarPartido} disabled={procesando || inscritos.length < 2} className="px-4 py-3 rounded-2xl bg-gray-900 text-white font-bold shadow-sm hover:bg-black disabled:opacity-60">Iniciar partido</button>
            </div>

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid md:grid-cols-3 gap-4">
                <EquipoColumna id="equipo-null" titulo="Sin equipo" jugadores={sinEquipo}>
                  {sinEquipo.map((jugador) => (
                    <JugadorDraggable key={jugador.id} jugador={jugador} modo="armar" onCambiarEquipo={() => cambiarEquipo(jugador.id, jugador.equipo === 1 ? 2 : 1)} />
                  ))}
                </EquipoColumna>

                <EquipoColumna id="equipo-1" titulo="Equipo 1" jugadores={equipo1}>
                  {equipo1.map((jugador) => (
                    <JugadorDraggable key={jugador.id} jugador={jugador} modo="armar" onCambiarEquipo={() => cambiarEquipo(jugador.id, 2)} />
                  ))}
                </EquipoColumna>

                <EquipoColumna id="equipo-2" titulo="Equipo 2" jugadores={equipo2}>
                  {equipo2.map((jugador) => (
                    <JugadorDraggable key={jugador.id} jugador={jugador} modo="armar" onCambiarEquipo={() => cambiarEquipo(jugador.id, 1)} />
                  ))}
                </EquipoColumna>
              </div>
            </DndContext>
          </>
        )}

        {estado === "en_curso" && (
          <div className="grid md:grid-cols-2 gap-4">
            <EquipoColumna id="equipo-1" titulo={`Equipo 1 · ${equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0)} goles`} jugadores={equipo1}>
              {equipo1.map((jugador) => (
                <JugadorCard key={jugador.id} jugador={jugador} modo="jugando" valorGol={goles[jugador.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [jugador.id]: e.target.value }))} />
              ))}
            </EquipoColumna>

            <EquipoColumna id="equipo-2" titulo={`Equipo 2 · ${equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0)} goles`} jugadores={equipo2}>
              {equipo2.map((jugador) => (
                <JugadorCard key={jugador.id} jugador={jugador} modo="jugando" valorGol={goles[jugador.id]} onGolChange={(e) => setGoles((prev) => ({ ...prev, [jugador.id]: e.target.value }))} />
              ))}
            </EquipoColumna>

            <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
              <button onClick={guardarResultadoParcial} disabled={procesando} className="px-4 py-3 rounded-2xl bg-white border border-gray-200 font-bold text-gray-800 shadow-sm hover:bg-gray-100 disabled:opacity-60">Guardar</button>
              <button onClick={finalizarPartido} disabled={procesando} className="px-4 py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-60">Finalizar partido</button>
            </div>
          </div>
        )}

        {estado === "finalizado" && (
          <div className="grid md:grid-cols-2 gap-4">
            <EquipoColumna id="equipo-1" titulo={`Equipo 1 · ${partido.goles_equipo1 || 0} goles`} jugadores={equipo1}>
              {equipo1.map((jugador) => (
                <JugadorCard key={jugador.id} jugador={jugador} modo="resultado" />
              ))}
            </EquipoColumna>

            <EquipoColumna id="equipo-2" titulo={`Equipo 2 · ${partido.goles_equipo2 || 0} goles`} jugadores={equipo2}>
              {equipo2.map((jugador) => (
                <JugadorCard key={jugador.id} jugador={jugador} modo="resultado" />
              ))}
            </EquipoColumna>
          </div>
        )}
      </div>
    </main>
  );
}
