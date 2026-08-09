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

function iniciales(nombre) {
  return (nombre || "J").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function promedioMedia(lista) {
  if (!lista.length) return 0;
  return Math.round(lista.reduce((acc, j) => acc + (j.media || 64), 0) / lista.length);
}

function JugadorCard({ jugador, modo, onCambiarEquipo, valorGol, onGolChange, dragHandleProps, isDragging }) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl border p-3 transition-shadow ${isDragging ? "shadow-lg ring-2 ring-emerald-500/40 border-emerald-500/30" : "shadow-sm border-slate-100"}`}>
      {modo === "armar" && (
        <button {...dragHandleProps} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 touch-none p-1 -ml-1 shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-5" fill="currentColor"><circle cx="8" cy="6" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="6" r="1.5" /><circle cx="16" cy="12" r="1.5" /><circle cx="16" cy="18" r="1.5" /></svg>
        </button>
      )}

      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-black text-emerald-800 shrink-0 overflow-hidden">
        {jugador.avatarUrl ? <img src={jugador.avatarUrl} alt={jugador.nombre} className="w-full h-full object-cover" /> : iniciales(jugador.nombre)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{jugador.nombre}</p>
        <span className="inline-block mt-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
          Rating: {jugador.media || 64}
        </span>
      </div>

      {modo === "armar" && onCambiarEquipo && (
        <button onClick={onCambiarEquipo} className="text-sm font-semibold text-slate-300 hover:text-emerald-600 shrink-0 p-1">⇄</button>
      )}

      {modo === "jugando" && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Goles</span>
          <input type="number" min="0" value={valorGol ?? 0} onChange={onGolChange} className="w-12 rounded-lg border border-slate-200 px-2 py-1 text-sm font-bold text-center bg-slate-50 focus:bg-white" />
        </div>
      )}

      {modo === "resultado" && (
        <span className="text-sm font-black text-emerald-800 shrink-0">{jugador.goles || 0} ⚽</span>
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
    <div ref={setNodeRef} className={`bg-white rounded-2xl p-5 shadow-sm border transition-colors ${isOver ? "border-emerald-500 bg-emerald-50/50" : "border-slate-100"}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-slate-800">{titulo}</h2>
        {jugadores.length > 0 && <span className="text-xs font-semibold text-slate-400">Media: <span className="text-slate-700 font-bold">{promedioMedia(jugadores)}</span></span>}
      </div>
      <div className="flex flex-col gap-2 min-h-[70px]">
        {jugadores.length === 0 ? <p className="text-xs text-slate-300 text-center py-4 font-medium">Sin jugadores</p> : children}
      </div>
    </div>
  );
}

export default function FutbolPartidoDetallePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params?.id;

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [user, setUser] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [goles, setGoles] = useState({});

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (matchId) cargarDetallePartido();
  }, [matchId]);

  async function cargarDetallePartido() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(`
          *,
          club:clubs(name, city, address, image_url),
          court:courts(name, sport_type)
        `)
        .eq("id", matchId)
        .single();

      if (matchError || !matchData) {
        setMatch(null);
        return;
      }

      setMatch(matchData);

      // Cargar jugadores inscritos en este partido
      const { data: rawPlayers } = await supabase
        .from("match_players")
        .select("id, user_id, team, goals")
        .eq("match_id", matchId);

      const userIds = (rawPlayers || []).map((p) => p.user_id).filter(Boolean);

      let profilesMap = {};
      let futbolProfilesMap = {};

      if (userIds.length > 0) {
        const { data: profsData } = await supabase
          .from("profiles")
          .select("id, nombre, apellido, avatar_url")
          .in("id", userIds);

        (profsData || []).forEach((p) => { profilesMap[p.id] = p; });

        const { data: futProfsData } = await supabase
          .from("futbol_profiles")
          .select("id, rating")
          .in("id", userIds);

        (futProfsData || []).forEach((fp) => { futbolProfilesMap[fp.id] = fp; });
      }

      const listaEnriquecida = (rawPlayers || []).map((p) => {
        const prof = profilesMap[p.user_id];
        const futProf = futbolProfilesMap[p.user_id];

        return {
          id: p.id,
          user_id: p.user_id,
          equipo: p.team === "A" ? 1 : p.team === "B" ? 2 : null,
          goles: Number(p.goals) || 0,
          nombre: prof ? `${prof.nombre || ""} ${prof.apellido || ""}`.trim() : "Jugador",
          avatarUrl: prof?.avatar_url || null,
          media: futProf?.rating ? Math.round(Number(futProf.rating)) : 64,
        };
      });

      setJugadores(listaEnriquecida);

      const golesInit = {};
      listaEnriquecida.forEach((j) => { golesInit[j.id] = j.goles; });
      setGoles(golesInit);

    } catch (err) {
      console.error(err);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }

  const miJugador = jugadores.find((j) => j.user_id === user?.id);
  const estaInscrito = !!miJugador;
  const esCreador = match?.created_by === user?.id;

  const equipo1 = jugadores.filter((j) => j.equipo === 1);
  const equipo2 = jugadores.filter((j) => j.equipo === 2);
  const sinAsignar = jugadores.filter((j) => j.equipo !== 1 && j.equipo !== 2);

  const modoDnd = match?.status === "jugado" ? "resultado" : match?.status === "en_curso" ? "jugando" : "armar";

  async function unirseAlPartido() {
    if (!user) { router.push("/login"); return; }
    try {
      setProcesando(true);
      const { error } = await supabase
        .from("match_players")
        .insert({ match_id: match.id, user_id: user.id, team: null });

      if (error) throw error;

      await cargarDetallePartido();
      setMensaje("¡Te has unido al partido!");
    } catch (e) {
      setMensaje("Error al unirse: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function salirDelPartido() {
    if (!miJugador) return;
    try {
      setProcesando(true);
      await supabase.from("match_players").delete().eq("id", miJugador.id);
      await cargarDetallePartido();
      setMensaje("Has salido del partido.");
    } catch (e) {
      setMensaje("Error al salir: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEquipo(playerId, nuevoEquipoNum) {
    const teamLetter = nuevoEquipoNum === 1 ? "A" : nuevoEquipoNum === 2 ? "B" : null;
    await supabase.from("match_players").update({ team: teamLetter }).eq("id", playerId);
    setJugadores((prev) => prev.map((j) => (j.id === playerId ? { ...j, equipo: nuevoEquipoNum } : j)));
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

  async function finalizarPartido() {
    try {
      setProcesando(true);
      const g1 = equipo1.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);
      const g2 = equipo2.reduce((acc, j) => acc + (Number(goles[j.id]) || 0), 0);

      for (const j of jugadores) {
        await supabase.from("match_players").update({ goals: Number(goles[j.id]) || 0 }).eq("id", j.id);
      }

      const ganador = g1 > g2 ? "A" : g2 > g1 ? "B" : "EMPATE";

      await supabase
        .from("matches")
        .update({
          status: "jugado",
          winner_team: ganador,
          score_text: `${g1} - ${g2}`
        })
        .eq("id", match.id);

      await cargarDetallePartido();
      setMensaje(`Partido finalizado: ${g1} - ${g2}`);
    } catch (e) {
      setMensaje("Error al finalizar: " + e.message);
    } finally {
      setProcesando(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!match) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-xl font-bold">Partido no encontrado</h1></div>;
  }

  const imagenCancha = match.club?.image_url || "https://images.unsplash.com/photo-1518605368461-1ee7e53f090b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80";

  return (
    <div className="min-h-screen bg-slate-50/50 pb-32 pt-4 md:pt-8">
      <main className="max-w-3xl mx-auto px-4 flex flex-col gap-6">

        {/* HERO BANNER DE LA CANCHA */}
        <div className="relative h-64 md:h-80 w-full bg-slate-900 rounded-3xl overflow-hidden shadow-md border border-slate-100">
          <img src={imagenCancha} alt="Cancha" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-[#0B0C15]/40 to-transparent"></div>

          <div className="absolute top-4 left-4 z-10">
            <Link href="/futbol" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
          </div>

          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <span className={`bg-white/95 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md ${
              match?.status === "jugado" ? "text-slate-500" : "text-emerald-800"
            }`}>
              {match?.status === "jugado" ? "Finalizado" : `$${match.total_price || 30} USD`}
            </span>
          </div>

          <div className="absolute bottom-6 left-4 right-4 md:left-8 z-10">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
              ⚽ {match.court?.name || "Cancha de Fútbol"}
            </h1>
            <p className="text-white text-sm font-medium mt-2">
              📍 {match.club?.name} — {match.club?.address}, {match.club?.city}
            </p>
          </div>
        </div>

        {mensaje && (
          <div className="p-4 rounded-2xl text-sm font-bold text-center border bg-emerald-50 text-emerald-800 border-emerald-200">
            {mensaje}
          </div>
        )}

        {/* ALINEACIONES Y DRAG & DROP */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full mb-1">
              Fútbol 100% Unificado
            </span>
            <h3 className="text-2xl font-black text-slate-900 uppercase">Alineaciones de la Caimana</h3>
          </div>

          {esCreador && match?.status !== "jugado" ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                <EquipoColumna id="equipo-1" titulo="Equipo 1 (A)" jugadores={equipo1}>
                  {equipo1.map((j) => (
                    <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles({ ...goles, [j.id]: e.target.value })} onCambiarEquipo={() => cambiarEquipo(j.id, 2)} />
                  ))}
                </EquipoColumna>

                <EquipoColumna id="equipo-2" titulo="Equipo 2 (B)" jugadores={equipo2}>
                  {equipo2.map((j) => (
                    <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles({ ...goles, [j.id]: e.target.value })} onCambiarEquipo={() => cambiarEquipo(j.id, 1)} />
                  ))}
                </EquipoColumna>
              </div>

              {sinAsignar.length > 0 && (
                <div className="mt-4">
                  <EquipoColumna id="equipo-null" titulo={`Sin Asignar (${sinAsignar.length})`} jugadores={sinAsignar}>
                    {sinAsignar.map((j) => (
                      <JugadorDraggable key={j.id} jugador={j} modo={modoDnd} valorGol={goles[j.id]} onGolChange={(e) => setGoles({ ...goles, [j.id]: e.target.value })} />
                    ))}
                  </EquipoColumna>
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <button onClick={finalizarPartido} disabled={procesando} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-md">
                  🏁 Finalizar Partido y Guardar Resultado
                </button>
              </div>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border">
                <h4 className="font-black text-slate-900 uppercase border-b pb-2 mb-3">Equipo 1 (A)</h4>
                {equipo1.map((j) => (
                  <div key={j.id} className="p-2 bg-white rounded-xl mb-1 text-xs font-bold text-slate-800 flex justify-between">
                    <span>{j.nombre}</span>
                    {modoDnd === "resultado" && <span>{j.goles} ⚽</span>}
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border">
                <h4 className="font-black text-slate-900 uppercase border-b pb-2 mb-3">Equipo 2 (B)</h4>
                {equipo2.map((j) => (
                  <div key={j.id} className="p-2 bg-white rounded-xl mb-1 text-xs font-bold text-slate-800 flex justify-between">
                    <span>{j.nombre}</span>
                    {modoDnd === "resultado" && <span>{j.goles} ⚽</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </main>

      {/* BARRA INFERIOR DE ACCIÓN */}
      {match.status !== "jugado" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-40">
          <div className="max-w-3xl mx-auto flex gap-3">
            {estaInscrito ? (
              <button onClick={salirDelPartido} disabled={procesando} className="w-full py-4 bg-rose-50 text-rose-600 font-black uppercase tracking-widest rounded-2xl text-xs border border-rose-100">
                Salir de la Caimana
              </button>
            ) : (
              <button onClick={unirseAlPartido} disabled={procesando} className="w-full py-4 bg-slate-900 text-[#00FF9D] font-black uppercase tracking-widest rounded-2xl text-xs shadow-md">
                + Unirme a esta Caimana
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}