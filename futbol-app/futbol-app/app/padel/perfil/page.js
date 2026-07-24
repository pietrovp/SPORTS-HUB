"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import PadelRecentActivity from "./PadelRecentActivity";

const CATEGORY_OPTIONS = {
  principiante: ["rookies", "7ma"],
  intermedio: ["6ta"],
  avanzado: ["5ta", "4ta"],
  profesional: ["3era", "2da", "open"],
};

const DEFAULT_PROFILE = {
  nivel_base: "principiante",
  categoria_solicitada: "rookies",
  categoria_oficial: "rookies",
  estado_categoria: "pendiente",
  rating: 1.50,
  fiabilidad: 20,
  posicion: "drive",
  posicion_preferida: "lado_derecho",
  mano_habil: "derecha",
  genero: "masculino",
  edad: 25,
  horario_preferido: "noche",
  dia_preferido: "fin_de_semana",
  tipo_partido_preferido: ["amistoso"],
};

const LABELS = {
  nivel_base: {
    principiante: "Principiante",
    intermedio: "Intermedio",
    avanzado: "Avanzado",
    profesional: "Profesional",
  },
  categoria: {
    rookies: "Rookies",
    "7ma": "7ma",
    "6ta": "6ta",
    "5ta": "5ta",
    "4ta": "4ta",
    "3era": "3era",
    "2da": "2da",
    open: "Open",
  },
  estado_categoria: {
    pendiente: "En revisión",
    aprobada: "Aprobada",
    rechazada: "Rechazada",
    ajustada: "Ajustada",
  },
  posicion: {
    drive: "Drive",
    reves: "Revés",
    ambos: "Ambos lados",
  },
  mano_habil: {
    derecha: "Derecha",
    izquierda: "Izquierda",
    ambidiestro: "Ambidiestro",
  },
  genero: {
    masculino: "Masculino",
    femenino: "Femenino",
    otro: "Otro",
  },
  horario_preferido: {
    manana: "Mañana",
    tarde: "Tarde",
    noche: "Noche",
    indistinto: "Indistinto",
  },
  dia_preferido: {
    semana: "Entre semana",
    fin_de_semana: "Fin de semana",
    indistinto: "Indistinto",
  },
  tipo_partido_preferido: {
    amistoso: "Amistoso",
    competitivo: "Competitivo",
    mixto: "Mixto",
  },
};

const TIPOS_VALIDOS = ["amistoso", "competitivo", "mixto"];
const NIVELES_VALIDOS = ["principiante", "intermedio", "avanzado", "profesional"];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// ==========================================
// CÁLCULOS DE RATING Y PROGRESO (ESTILO PLAYTOMIC)
// ==========================================
function getInfoRating(ratingVal) {
  const r = Number(ratingVal) || 1.0;
  if (r < 2.0) return { catActual: "Rookies", nextCat: "7ma", floor: 1.0, ceiling: 2.0 };
  if (r < 3.0) return { catActual: "7ma", nextCat: "6ta", floor: 2.0, ceiling: 3.0 };
  if (r < 4.0) return { catActual: "6ta", nextCat: "5ta", floor: 3.0, ceiling: 4.0 };
  if (r < 5.0) return { catActual: "5ta", nextCat: "3era", floor: 4.0, ceiling: 5.0 };
  if (r < 6.0) return { catActual: "3era", nextCat: "Open", floor: 5.0, ceiling: 6.0 };
  return { catActual: "Open", nextCat: "MAX", floor: 6.0, ceiling: 7.0 };
}

function calcProgresoPorcentaje(ratingVal) {
  const r = Number(ratingVal) || 1.0;
  const info = getInfoRating(r);
  if (info.nextCat === "MAX") return 100;
  const pct = Math.min(Math.max(((r - info.floor) / (info.ceiling - info.floor)) * 100, 0), 100);
  return Math.round(pct);
}

function getEtiquetaFiabilidad(fiabilidadVal) {
  const f = Number(fiabilidadVal) || 0;
  if (f < 35) return { texto: "Baja (Calibrando)", color: "text-amber-400" };
  if (f < 70) return { texto: "Media", color: "text-cyan-300" };
  return { texto: "Alta (Estable)", color: "text-emerald-400" };
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extraerTipos(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => extraerTipos(item));
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed !== value) return extraerTipos(parsed);
    return value
      .split(",")
      .map((item) => item.trim().replace(/^"+|"+$/g, ""))
      .filter(Boolean);
  }
  return [];
}

function normalizarTiposPartido(value) {
  const tipos = extraerTipos(value)
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => TIPOS_VALIDOS.includes(item));
  const unicos = [...new Set(tipos)];
  return unicos.length > 0 ? unicos : ["amistoso"];
}

function normalizeMatchRelation(match) {
  if (!match) return null;
  return Array.isArray(match) ? match[0] : match;
}

function normalizeNivelBase(value) {
  const nivel = String(value || "").trim().toLowerCase();
  if (NIVELES_VALIDOS.includes(nivel)) return nivel;
  if (nivel === "competitivo") return "profesional";
  return "principiante";
}

function normalizeCategoria(value, nivelBase) {
  const nivel = normalizeNivelBase(nivelBase);
  const permitidas = CATEGORY_OPTIONS[nivel] || CATEGORY_OPTIONS.principiante;
  const categoria = String(value || "").trim().toLowerCase();

  if (permitidas.includes(categoria)) return categoria;
  if (categoria === "principiante") return "rookies";
  if (categoria === "intermedio") return "6ta";
  if (categoria === "avanzado") return "5ta";
  if (categoria === "profesional") return "3era";
  if (categoria === "competitivo") return "3era";

  return permitidas[0];
}

function normalizeEstadoCategoria(value) {
  const estado = String(value || "").trim().toLowerCase();
  if (["pendiente", "aprobada", "rechazada", "ajustada"].includes(estado)) return estado;
  return "pendiente";
}

export default function PadelPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [baseProfile, setBaseProfile] = useState(null);
  const [padelProfile, setPadelProfile] = useState(null);
  const [matchesData, setMatchesData] = useState([]);
  const [editando, setEditando] = useState(false);
  const [modalInfoOpen, setModalInfoOpen] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    try {
      setLoading(true);
      setErrorMsg("");
      setMensaje("");

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authUser) {
        setErrorMsg("No hay una sesión activa.");
        setLoading(false);
        return;
      }

      setUser(authUser);

      const [{ data: profileData, error: profileError }, { data: padelData, error: padelError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
          supabase.from("padel_profiles").select("*").eq("id", authUser.id).maybeSingle(),
        ]);

      if (profileError) throw profileError;
      if (padelError) throw padelError;

      setBaseProfile(profileData || null);

      let finalPadel = padelData;

      if (!finalPadel) {
        const insertPayload = {
          id: authUser.id,
          nivel_base: DEFAULT_PROFILE.nivel_base,
          categoria_solicitada: DEFAULT_PROFILE.categoria_solicitada,
          categoria_oficial: DEFAULT_PROFILE.categoria_oficial,
          estado_categoria: DEFAULT_PROFILE.estado_categoria,
          rating: DEFAULT_PROFILE.rating,
          fiabilidad: DEFAULT_PROFILE.fiabilidad,
          posicion: DEFAULT_PROFILE.posicion,
          posicion_preferida: DEFAULT_PROFILE.posicion_preferida,
          mano_habil: DEFAULT_PROFILE.mano_habil,
          genero: DEFAULT_PROFILE.genero,
          edad: DEFAULT_PROFILE.edad,
          horario_preferido: DEFAULT_PROFILE.horario_preferido,
          dia_preferido: DEFAULT_PROFILE.dia_preferido,
          tipo_partido_preferido: DEFAULT_PROFILE.tipo_partido_preferido,
        };

        const { data: created, error: createError } = await supabase
          .from("padel_profiles")
          .insert(insertPayload)
          .select()
          .single();

        if (createError) throw createError;
        finalPadel = created;
      }

      const nivelBaseNormalizado = normalizeNivelBase(finalPadel?.nivel_base || finalPadel?.nivel);
      const categoriaSolicitada = normalizeCategoria(
        finalPadel?.categoria_solicitada || finalPadel?.categoria || finalPadel?.nivel,
        nivelBaseNormalizado
      );
      const categoriaOficial = normalizeCategoria(
        finalPadel?.categoria_oficial || finalPadel?.categoria || finalPadel?.nivel,
        nivelBaseNormalizado
      );
      const estadoCategoria = normalizeEstadoCategoria(finalPadel?.estado_categoria);
      const tiposNormalizados = normalizarTiposPartido(finalPadel?.tipo_partido_preferido);

      finalPadel = {
        ...finalPadel,
        nivel_base: nivelBaseNormalizado,
        categoria_solicitada: categoriaSolicitada,
        categoria_oficial: categoriaOficial,
        estado_categoria: estadoCategoria,
        rating: Number(finalPadel?.rating) || 1.50,
        fiabilidad: Number(finalPadel?.fiabilidad) || 20,
        tipo_partido_preferido: tiposNormalizados,
      };

      setPadelProfile(finalPadel);
      setForm({
        nivel_base: nivelBaseNormalizado,
        categoria_solicitada: categoriaSolicitada,
        categoria_oficial: categoriaOficial,
        estado_categoria: estadoCategoria,
        rating: finalPadel.rating,
        fiabilidad: finalPadel.fiabilidad,
        posicion: finalPadel.posicion || DEFAULT_PROFILE.posicion,
        posicion_preferida: finalPadel.posicion_preferida || DEFAULT_PROFILE.posicion_preferida,
        mano_habil: finalPadel.mano_habil || DEFAULT_PROFILE.mano_habil,
        genero: finalPadel.genero || DEFAULT_PROFILE.genero,
        edad: finalPadel.edad || DEFAULT_PROFILE.edad,
        horario_preferido: finalPadel.horario_preferido || DEFAULT_PROFILE.horario_preferido,
        dia_preferido: finalPadel.dia_preferido || DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido: tiposNormalizados,
      });

      const { data: playedMatches, error: matchesError } = await supabase
        .from("padel_match_players")
        .select(`
          id,
          team,
          joined_at,
          match:padel_matches!inner (
            id,
            status,
            winner_team,
            team_a_score,
            team_b_score,
            scheduled_at
          )
        `)
        .eq("user_id", authUser.id)
        .eq("match.status", "jugado")
        .order("scheduled_at", { referencedTable: "match", ascending: false });

      if (matchesError) throw matchesError;
      setMatchesData(playedMatches || []);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo cargar el perfil de pádel.");
    } finally {
      setLoading(false);
    }
  }

  async function guardarCambios() {
    if (!user) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setMensaje("");

      const nivelBase = normalizeNivelBase(form.nivel_base);
      const categoriaSolicitada = normalizeCategoria(form.categoria_solicitada, nivelBase);
      const tiposNormalizados = normalizarTiposPartido(form.tipo_partido_preferido);

      const payload = {
        nivel_base: nivelBase,
        categoria_solicitada: categoriaSolicitada,
        estado_categoria: "pendiente",
        posicion: form.posicion,
        posicion_preferida: form.posicion_preferida,
        mano_habil: form.mano_habil,
        genero: form.genero,
        edad: Number(form.edad) || 25,
        horario_preferido: form.horario_preferido,
        dia_preferido: form.dia_preferido,
        tipo_partido_preferido: tiposNormalizados,
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      const perfilNormalizado = {
        ...data,
        nivel_base: normalizeNivelBase(data?.nivel_base),
        categoria_solicitada: normalizeCategoria(data?.categoria_solicitada, data?.nivel_base),
        categoria_oficial: normalizeCategoria(data?.categoria_oficial, data?.nivel_base),
        estado_categoria: normalizeEstadoCategoria(data?.estado_categoria),
        rating: Number(data?.rating) || padelProfile?.rating || 1.50,
        fiabilidad: Number(data?.fiabilidad) || padelProfile?.fiabilidad || 20,
        tipo_partido_preferido: normalizarTiposPartido(data?.tipo_partido_preferido),
      };

      setPadelProfile(perfilNormalizado);
      setForm({
        nivel_base: perfilNormalizado.nivel_base || DEFAULT_PROFILE.nivel_base,
        categoria_solicitada: perfilNormalizado.categoria_solicitada || DEFAULT_PROFILE.categoria_solicitada,
        categoria_oficial: perfilNormalizado.categoria_oficial || DEFAULT_PROFILE.categoria_oficial,
        estado_categoria: perfilNormalizado.estado_categoria || DEFAULT_PROFILE.estado_categoria,
        rating: perfilNormalizado.rating,
        fiabilidad: perfilNormalizado.fiabilidad,
        posicion: perfilNormalizado.posicion || DEFAULT_PROFILE.posicion,
        posicion_preferida: perfilNormalizado.posicion_preferida || DEFAULT_PROFILE.posicion_preferida,
        mano_habil: perfilNormalizado.mano_habil || DEFAULT_PROFILE.mano_habil,
        genero: perfilNormalizado.genero || DEFAULT_PROFILE.genero,
        edad: perfilNormalizado.edad || DEFAULT_PROFILE.edad,
        horario_preferido: perfilNormalizado.horario_preferido || DEFAULT_PROFILE.horario_preferido,
        dia_preferido: perfilNormalizado.dia_preferido || DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido: perfilNormalizado.tipo_partido_preferido,
      });

      setEditando(false);
      setMensaje("Perfil actualizado correctamente.");
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  const estadisticas = useMemo(() => {
    const normalizedMatches = (matchesData || [])
      .map((row) => {
        const match = normalizeMatchRelation(row.match);
        if (!match || match.status !== "jugado") return null;
        return {
          team: row.team,
          winnerTeam: match.winner_team,
          scheduledAt: match.scheduled_at,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    const partidos = normalizedMatches.length;
    const victorias = normalizedMatches.filter(
      (match) => match.winnerTeam && match.winnerTeam === match.team
    ).length;
    const derrotas = Math.max(partidos - victorias, 0);
    const porcentajeVictorias = partidos > 0 ? Math.round((victorias / partidos) * 100) : 0;

    let rachaActual = 0;
    let mejorRacha = 0;

    for (const match of normalizedMatches) {
      const gano = match.winnerTeam && match.winnerTeam === match.team;
      if (gano) {
        rachaActual += 1;
        if (rachaActual > mejorRacha) mejorRacha = rachaActual;
      } else {
        rachaActual = 0;
      }
    }

    return { partidos, victorias, derrotas, porcentajeVictorias, racha: mejorRacha };
  }, [matchesData]);

  function toggleTipoPartido(tipo) {
    setForm((prev) => {
      const actual = normalizarTiposPartido(prev.tipo_partido_preferido);
      const exists = actual.includes(tipo);
      const next = exists ? actual.filter((item) => item !== tipo) : [...actual, tipo];
      return {
        ...prev,
        tipo_partido_preferido: next.length > 0 ? next : ["amistoso"],
      };
    });
  }

  const categoriasDisponibles = CATEGORY_OPTIONS[normalizeNivelBase(form.nivel_base)] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-64 rounded-3xl bg-slate-200" />
          <div className="h-64 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );
  }

  // Nombre y Apellido completo
  const nombreStr = baseProfile?.nombre || user?.user_metadata?.nombre || user?.email?.split("@")[0] || "Jugador";
  const apellidoStr = baseProfile?.apellido || "";
  const nombreCompleto = `${nombreStr} ${apellidoStr}`.trim();
  const inicial = nombreStr.charAt(0).toUpperCase();

  const categoriaOficialLabel = LABELS.categoria[padelProfile?.categoria_oficial] || "Rookies";

  const manoLabel = LABELS.mano_habil[padelProfile?.mano_habil] || "Derecha";
  const posicionBaseLabel = LABELS.posicion[padelProfile?.posicion] || "Drive";
  const generoLabel = LABELS.genero[padelProfile?.genero] || "Masculino";
  const edadVal = padelProfile?.edad || 25;
  const nacionalidadVal = baseProfile?.nacionalidad || "🇻🇪 VE";

  // RATING Y PROGRESO
  const ratingActual = padelProfile?.rating || 1.50;
  const fiabilidadVal = padelProfile?.fiabilidad || 20;
  const infoRating = getInfoRating(ratingActual);
  const progresoPct = calcProgresoPorcentaje(ratingActual);
  const fiabilidadInfo = getEtiquetaFiabilidad(fiabilidadVal);

  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* NOTIFICACIONES */}
        {mensaje && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex justify-between items-center shadow-sm">
            <span>✅ {mensaje}</span>
            <button onClick={() => setMensaje("")} className="text-emerald-600 hover:text-emerald-950">✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800 flex justify-between items-center shadow-sm">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-600 hover:text-rose-950">✕</button>
          </div>
        )}

        {/* ==================================================== */}
        {/* VISTA PRINCIPAL ESTILO FUTBOL (2 COLUMNAS RE-BALANCEADAS) */}
        {/* ==================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ========================================= */}
          {/* COLUMNA IZQUIERDA: CARTA DE JUGADOR PÁDEL (MÁS ANCHA Y LEGBLE) */}
          {/* ========================================= */}
          <div className="lg:col-span-5 w-full flex flex-col items-center">
            
            <div className="w-full bg-gradient-to-b from-[#0B0C2A] via-[#161848] to-[#0B0C2A] rounded-[2.5rem] p-6 md:p-8 text-white text-center shadow-xl border border-blue-500/20 relative overflow-hidden flex flex-col items-center justify-between min-h-[460px]">
              
              {/* Resplandor de fondo */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Avatar circular ampliado */}
              <div className="relative my-3 z-10">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 p-1 shadow-[0_0_30px_rgba(59,130,246,0.4)]">
                  <div className="w-full h-full rounded-full bg-[#0B0C2A] overflow-hidden flex items-center justify-center">
                    {baseProfile?.avatar_url ? (
                      <img src={baseProfile.avatar_url} alt={nombreCompleto} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl md:text-5xl font-black text-white">{inicial}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nombre completo y Categoria */}
              <div className="z-10 w-full flex flex-col items-center">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">{nombreCompleto}</h2>
                
                {/* Etiqueta Categoría */}
                <div className="mt-2.5 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Categoría</span>
                  <span className="bg-blue-500/25 border border-blue-400/40 text-blue-300 text-xs md:text-sm font-black uppercase px-5 py-1.5 rounded-full shadow-md tracking-wider">
                    🎾 {categoriaOficialLabel}
                  </span>
                </div>
              </div>

              {/* 🔥 BLOQUE DE LEVEL & BARRA DE PROGRESO (AMPLIADO Y MÁS CLARO) */}
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 my-4 z-10 text-left">
                <div className="flex justify-between items-center mb-2 font-bold">
                  <span className="text-gray-300 text-xs md:text-sm">
                    Nivel: <strong className="text-cyan-300 text-base md:text-lg font-black">{ratingActual.toFixed(2)}</strong>
                  </span>
                  <span className="text-[#00FF9D] text-xs md:text-sm uppercase font-black tracking-wider">
                    PRÓX: {infoRating.nextCat} ({infoRating.ceiling.toFixed(2)})
                  </span>
                </div>

                {/* Barra de progreso más alta */}
                <div className="w-full bg-slate-800 rounded-full h-3 md:h-3.5 overflow-hidden border border-white/10 p-0.5">
                  <div 
                    className="bg-gradient-to-r from-blue-500 via-cyan-400 to-[#00FF9D] h-full rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(0,255,157,0.5)]" 
                    style={{ width: `${progresoPct}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs text-gray-300 mt-2.5 font-bold uppercase tracking-wider">
                  <span>Fiabilidad: <strong className={fiabilidadInfo.color}>{fiabilidadInfo.texto} ({fiabilidadVal}%)</strong></span>
                  <span className="text-gray-300">{progresoPct}% a ascenso</span>
                </div>
              </div>

              {/* Footer de la carta: Nacionalidad | Posición | Mano (AMPLIADO) */}
              <div className="w-full grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-center z-10">
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">NACIONALIDAD</p>
                  <p className="text-sm md:text-base font-black text-amber-300 truncate mt-0.5">{nacionalidadVal}</p>
                </div>
                <div className="border-x border-white/10">
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">POSICIÓN</p>
                  <p className="text-sm md:text-base font-black text-cyan-300 mt-0.5">{posicionBaseLabel}</p>
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">MANO</p>
                  <p className="text-sm md:text-base font-black text-emerald-300 mt-0.5">{manoLabel}</p>
                </div>
              </div>

            </div>

            {/* Botón de Editar bajo la carta */}
            <button
              onClick={() => setEditando(!editando)}
              className="mt-4 w-full py-4 bg-white border border-gray-200 text-gray-800 font-black text-xs md:text-sm uppercase tracking-wider rounded-2xl shadow-sm hover:bg-gray-50 transition-all text-center"
            >
              {editando ? "Cerrar Edición" : "✏️ EDITAR MI FICHA DE JUGADOR"}
            </button>

            {/* PREGUNTA / BOTÓN INFORMATIVO SOBRE EL NIVEL */}
            <button
              onClick={() => setModalInfoOpen(true)}
              className="mt-2 text-xs md:text-sm font-extrabold text-slate-500 hover:text-blue-600 flex items-center gap-2 transition-colors py-2 px-3 rounded-full hover:bg-slate-100"
            >
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">ℹ️</span>
              <span>¿Cómo funciona el nivel y los ascensos?</span>
            </button>

          </div>

          {/* ========================================= */}
          {/* COLUMNA DERECHA: GRILLA DE ESTADÍSTICAS   */}
          {/* ========================================= */}
          <div className="lg:col-span-7 space-y-6">

            {/* MODO EDICIÓN FORMULARIO */}
            {editando ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Editar Preferencias de Juego</h3>
                
                <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-2xl border border-amber-200 font-medium">
                  💡 Si cambias tu categoría solicitada, un administrador la revisará antes de hacerla oficial. Tu nivel dinámico se actualizará jugando partidos competitivos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 font-bold text-slate-500 uppercase text-[10px]">Nivel base</label>
                    <select
                      value={form.nivel_base}
                      onChange={(e) => {
                        const nextNivel = e.target.value;
                        const catInicial = (CATEGORY_OPTIONS[nextNivel] || CATEGORY_OPTIONS.principiante)[0];
                        setForm((prev) => ({ ...prev, nivel_base: nextNivel, categoria_solicitada: catInicial }));
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="principiante">Principiante</option>
                      <option value="intermedio">Intermedio</option>
                      <option value="avanzado">Avanzado</option>
                      <option value="profesional">Profesional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-bold text-slate-500 uppercase text-[10px]">Categoría solicitada</label>
                    <select
                      value={normalizeCategoria(form.categoria_solicitada, form.nivel_base)}
                      onChange={(e) => setForm((prev) => ({ ...prev, categoria_solicitada: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    >
                      {categoriasDisponibles.map((cat) => (
                        <option key={cat} value={cat}>{LABELS.categoria[cat]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-bold text-slate-500 uppercase text-[10px]">Mano hábil</label>
                    <select
                      value={form.mano_habil}
                      onChange={(e) => setForm((prev) => ({ ...prev, mano_habil: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="derecha">Derecha</option>
                      <option value="izquierda">Izquierda</option>
                      <option value="ambidiestro">Ambidiestro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-bold text-slate-500 uppercase text-[10px]">Posición en Pista</label>
                    <select
                      value={form.posicion}
                      onChange={(e) => setForm((prev) => ({ ...prev, posicion: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="drive">Drive (Lado Derecho)</option>
                      <option value="reves">Revés (Lado Izquierdo)</option>
                      <option value="ambos">Ambos Lados</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-bold text-slate-500 uppercase text-[10px]">Género</label>
                    <select
                      value={form.genero}
                      onChange={(e) => setForm((prev) => ({ ...prev, genero: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    >
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 font-bold text-slate-500 uppercase text-[10px]">Edad</label>
                    <input
                      type="number"
                      min="10"
                      max="99"
                      value={form.edad}
                      onChange={(e) => setForm((prev) => ({ ...prev, edad: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={guardarCambios}
                    disabled={saving}
                    className="flex-1 rounded-2xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(false)}
                    className="px-5 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              /* MODO VISUALIZACIÓN: GRILLA DE BLOQUES IDÉNTICA A FÚTBOL */
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">{nombreCompleto}</h1>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Jugador de Pádel • Level {ratingActual.toFixed(2)} ({categoriaOficialLabel})
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                  
                  {/* Bloque 1: Partidos Jugados */}
                  <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PARTIDOS JUGADOS</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">{estadisticas.partidos}</p>
                  </div>

                  {/* Bloque 2: Victorias Totales */}
                  <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">VICTORIAS TOTALES</p>
                    <p className="text-2xl font-black text-slate-900 mt-2 flex items-center gap-1">
                      {estadisticas.victorias} <span className="text-lg">🏆</span>
                    </p>
                  </div>

                  {/* Bloque 3: % Victorias */}
                  <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">% VICTORIAS</p>
                    <p className="text-2xl font-black text-emerald-600 mt-2">{estadisticas.porcentajeVictorias}%</p>
                  </div>

                  {/* Bloque 4: Racha */}
                  <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">MEJOR RACHA</p>
                    <p className="text-2xl font-black text-amber-500 mt-2 flex items-center gap-1">
                      {estadisticas.racha} <span className="text-lg">🔥</span>
                    </p>
                  </div>

                  {/* Bloque 5: Edad */}
                  <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">EDAD</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">{edadVal}</p>
                  </div>

                  {/* Bloque 6: Género */}
                  <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">GÉNERO</p>
                    <p className="text-lg font-black text-slate-900 mt-2">{generoLabel}</p>
                  </div>

                </div>

                {/* Bloque Inferior: Récord de Carrera */}
                <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">RÉCORD DE CARRERA</p>
                    <p className="text-sm font-black mt-1">
                      <span className="text-emerald-600">{estadisticas.victorias} Victorias</span>
                      <span className="text-slate-300 mx-2">•</span>
                      <span className="text-rose-500">{estadisticas.derrotas} Derrotas</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">POSICIÓN</p>
                    <p className="text-sm font-black text-slate-900">{posicionBaseLabel}</p>
                  </div>
                </div>

              </div>
            )}

            {/* ACTIVIDAD RECIENTE ABAJO */}
            <PadelRecentActivity />

          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* MODAL EXPLICATIVO: SISTEMA DE NIVEL Y ASCENSOS       */}
      {/* ==================================================== */}
      {modalInfoOpen && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setModalInfoOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Sports Hub Pádel</span>
                <h3 className="text-xl font-black text-slate-900">¿Cómo funciona el Nivel?</h3>
              </div>
              <button 
                onClick={() => setModalInfoOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="space-y-4 text-xs text-slate-600 leading-relaxed max-h-[65vh] overflow-y-auto pr-1">
              
              {/* Sección 1 */}
              <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100">
                <p className="font-extrabold text-blue-900 text-sm mb-1">⚡ 1. Tu Rating Numérico</p>
                <p>
                  Tu habilidad se mide con un número continuo (ej: <strong>2.65</strong>). Cada victoria en partidos competitivos suma puntos y cada derrota resta.
                </p>
              </div>

              {/* Sección 2 */}
              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                <p className="font-extrabold text-emerald-900 text-sm mb-1">🏆 2. Ascenso Automático de Categoría</p>
                <p className="mb-2">
                  No necesitas pedir la subida a un admin. Cuando tu barra llega al 100%, ¡asciendes automáticamente!
                </p>
                <div className="grid grid-cols-2 gap-1.5 font-bold text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border border-emerald-200/60">
                  <div>• 1.00 – 1.99: <span className="text-blue-600">Rookies</span></div>
                  <div>• 2.00 – 2.99: <span className="text-blue-600">7ma</span></div>
                  <div>• 3.00 – 3.99: <span className="text-blue-600">6ta</span></div>
                  <div>• 4.00 – 4.99: <span className="text-blue-600">5ta / 4ta</span></div>
                  <div>• 5.00 – 5.99: <span className="text-blue-600">3era / 2da</span></div>
                  <div>• 6.00 +: <span className="text-blue-600">Open</span></div>
                </div>
              </div>

              {/* Sección 3 */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="font-extrabold text-slate-900 text-sm mb-1">🎯 3. Puntuación de Fiabilidad</p>
                <p>
                  Al principio tu fiabilidad es baja (ej: 20%), por lo que tu nivel sube o baja más rápido. A medida que juegas más partidos, tu nivel se vuelve estable y preciso.
                </p>
              </div>

              {/* Sección 4 */}
              <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 text-amber-900">
                <p className="font-extrabold text-sm mb-1">🤝 Competitivo vs. Amistoso</p>
                <p>
                  Solo los partidos marcados como <strong>Competitivos</strong> alteran tu rating. Los <strong>Amistosos</strong> te permiten jugar sin riesgo de perder puntos.
                </p>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="pt-2">
              <button
                onClick={() => setModalInfoOpen(false)}
                className="w-full py-3 bg-slate-900 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider hover:bg-slate-800 transition-colors shadow-md"
              >
                ¡Entendido, a jugar!
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}