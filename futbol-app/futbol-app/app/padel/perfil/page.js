"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import PadelRecentActivity from "./PadelRecentActivity";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = {
  principiante: ["rookies", "7ma"],
  intermedio:   ["6ta"],
  avanzado:     ["5ta", "4ta"],
  profesional:  ["3era", "2da", "open"],
};

const DEFAULT_PROFILE = {
  nivel_base:              "principiante",
  categoria_solicitada:    "rookies",
  categoria_oficial:       "rookies",
  estado_categoria:        "pendiente",
  rating:                  1.50,
  fiabilidad:              20,
  posicion:                "drive",
  posicion_preferida:      "lado_derecho",
  mano_habil:              "derecha",
  genero:                  "masculino",
  edad:                    25,
  horario_preferido:       "noche",
  dia_preferido:           "fin_de_semana",
  tipo_partido_preferido:  ["amistoso"],
};

const LABELS = {
  nivel_base: {
    principiante: "Principiante",
    intermedio:   "Intermedio",
    avanzado:     "Avanzado",
    profesional:  "Profesional",
  },
  categoria: {
    rookies: "Rookies", "7ma": "7ma", "6ta": "6ta",
    "5ta": "5ta", "4ta": "4ta", "3era": "3era", "2da": "2da", open: "Open",
  },
  estado_categoria: {
    pendiente: "En revisión", aprobada: "Aprobada",
    rechazada: "Rechazada",  ajustada: "Ajustada",
  },
  posicion:   { drive: "Drive", reves: "Revés", ambos: "Ambos lados" },
  mano_habil: { derecha: "Derecha", izquierda: "Izquierda", ambidiestro: "Ambidiestro" },
  genero:     { masculino: "Masculino", femenino: "Femenino", otro: "Otro" },
};

const TIPOS_VALIDOS   = ["amistoso", "competitivo", "mixto"];
const NIVELES_VALIDOS = ["principiante", "intermedio", "avanzado", "profesional"];

// ─── ONBOARDING STEPS ────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    id: 0,
    titulo: "En la siguiente escala, ¿dónde te colocarías?",
    campo: "q_nivel_escala",
    opciones: [
      { label: "Iniciación",  value: "iniciacion", peso: 0   },
      { label: "Intermedio",  value: "intermedio", peso: 1.5 },
      { label: "Avanzado",    value: "avanzado",   peso: 3.0 },
      { label: "Profesional", value: "profesional",peso: 5.0 },
    ],
  },
  {
    id: 1,
    titulo: "¿Cuántos años llevas practicando pádel o algún deporte de raqueta?",
    campo: "q_anios",
    opciones: [
      { label: "Nunca he jugado previamente", value: "nunca",  peso: 0   },
      { label: "Menos de un año",             value: "menos1", peso: 0.3 },
      { label: "Entre 1 y 3 años",            value: "1a3",    peso: 0.7 },
      { label: "Entre 3 y 5 años",            value: "3a5",    peso: 1.2 },
      { label: "Más de 5 años",               value: "mas5",   peso: 1.8 },
    ],
  },
  {
    id: 2,
    titulo: "¿Cuál es el nivel al que compites cuando juegas partidos competitivos?",
    campo: "q_competicion",
    opciones: [
      { label: "Sólo partidos entre amigos", value: "amigos",   peso: 0   },
      { label: "Torneos amistosos",          value: "torneos",  peso: 0.4 },
      { label: "Ligas amateur",              value: "amateur",  peso: 0.9 },
      { label: "Competiciones federadas",    value: "federado", peso: 1.5 },
    ],
  },
  {
    id: 3,
    titulo: "¿Has recibido o recibes formación en pádel?",
    campo: "q_formacion",
    opciones: [
      { label: "No",               value: "no",     peso: 0   },
      { label: "Sí, en el pasado", value: "pasado", peso: 0.2 },
      { label: "Sí, actualmente",  value: "actual", peso: 0.4 },
    ],
  },
  {
    id: 4,
    titulo: "En la volea...",
    campo: "q_volea",
    opciones: [
      { label: "Casi no subo a la red",                                       value: "v1", peso: 0   },
      { label: "No me siento seguro/a en la red, cometo demasiados errores",  value: "v2", peso: 0.3 },
      { label: "Logro volear de derecha y de revés con alguna dificultad",    value: "v3", peso: 0.6 },
      { label: "Tengo buena colocación en la red y voleo con seguridad",      value: "v4", peso: 1.0 },
      { label: "Voleo con profundidad y potencia",                            value: "v5", peso: 1.5 },
    ],
  },
  {
    id: 5,
    titulo: "En los rebotes...",
    campo: "q_rebotes",
    opciones: [
      { label: "No sé cómo leer los rebotes, golpeo antes del rebote",                        value: "r1", peso: 0   },
      { label: "Intento, con dificultad, golpear los rebotes en la pared de fondo",            value: "r2", peso: 0.3 },
      { label: "Devuelvo rebotes en la pared de fondo, me cuesta devolver los de doble pared", value: "r3", peso: 0.6 },
      { label: "Devuelvo rebotes a dos paredes y alcanzo rebotes rápidos",                     value: "r4", peso: 1.0 },
      { label: "Realizo bajadas de pared con potencia de derecha y de revés",                  value: "r5", peso: 1.5 },
    ],
  },
  {
    id: 6,
    titulo: "¿Qué edad tienes?",
    campo: "q_edad",
    opciones: [
      { label: "Entre 18 y 30 años", value: "18_30", edadNum: 24 },
      { label: "Entre 31 y 40 años", value: "31_40", edadNum: 35 },
      { label: "Entre 41 y 50 años", value: "41_50", edadNum: 45 },
      { label: "Más de 50 años",     value: "mas50",  edadNum: 55 },
    ],
  },
];

// ─── HELPERS ONBOARDING ───────────────────────────────────────────────────────
function calcularRatingInicial(respuestas) {
  let suma = 1.0;
  ONBOARDING_STEPS.forEach((step) => {
    if (step.campo === "q_edad") return;
    const op = step.opciones.find((o) => o.value === respuestas[step.campo]);
    if (op?.peso) suma += op.peso;
  });
  return parseFloat(Math.min(Math.max(suma, 1.0), 7.0).toFixed(2));
}

function nivelDesdeRating(r) {
  if (r < 2.0) return { nivel_base: "principiante", categoria: "rookies" };
  if (r < 3.0) return { nivel_base: "principiante", categoria: "7ma"    };
  if (r < 4.0) return { nivel_base: "intermedio",   categoria: "6ta"    };
  if (r < 4.5) return { nivel_base: "avanzado",     categoria: "5ta"    };
  if (r < 5.0) return { nivel_base: "avanzado",     categoria: "4ta"    };
  if (r < 6.0) return { nivel_base: "profesional",  categoria: "3era"   };
  return              { nivel_base: "profesional",  categoria: "open"   };
}

const NIVEL_LABELS = {
  rookies: { label: "Rookies", desc: "Sin clases. Menos de seis meses jugando. Sin técnica ni táctica." },
  "7ma":   { label: "7ma",     desc: "Conoces las reglas básicas, golpeas con poca consistencia." },
  "6ta":   { label: "6ta",     desc: "Juegas con cierta regularidad, golpes básicos consolidados." },
  "5ta":   { label: "5ta",     desc: "Nivel avanzado, participas en ligas amateur." },
  "4ta":   { label: "4ta",     desc: "Alto nivel técnico, compites en torneos con regularidad." },
  "3era":  { label: "3era",    desc: "Nivel semiprofesional, buena táctica y físico." },
  open:    { label: "Open",    desc: "Nivel profesional o muy cercano." },
};

// ─── HELPERS PERFIL ───────────────────────────────────────────────────────────
function normalizeNivelBase(value) {
  const n = String(value || "").trim().toLowerCase();
  return NIVELES_VALIDOS.includes(n) ? n : "principiante";
}
function normalizeCategoria(value, nivelBase) {
  const nivel     = normalizeNivelBase(nivelBase);
  const permitidas = CATEGORY_OPTIONS[nivel] || CATEGORY_OPTIONS.principiante;
  const cat       = String(value || "").trim().toLowerCase();
  return permitidas.includes(cat) ? cat : permitidas[0];
}
function normalizeEstadoCategoria(value) {
  const e = String(value || "").trim().toLowerCase();
  return ["pendiente","aprobada","rechazada","ajustada"].includes(e) ? e : "pendiente";
}
function normalizarTiposPartido(value) {
  const arr  = Array.isArray(value) ? value : [value];
  const tipos = arr
    .map((t) => String(t || "").trim().toLowerCase())
    .filter((t) => TIPOS_VALIDOS.includes(t));
  const unique = [...new Set(tipos)];
  return unique.length > 0 ? unique : ["amistoso"];
}
function normalizeMatchRelation(match) {
  if (!match) return null;
  return Array.isArray(match) ? match[0] : match;
}
function getInfoRating(ratingVal) {
  const r = Number(ratingVal) || 1.0;
  if (r < 2.0) return { catActual: "Rookies", nextCat: "7ma",  floor: 1.0, ceiling: 2.0 };
  if (r < 3.0) return { catActual: "7ma",     nextCat: "6ta",  floor: 2.0, ceiling: 3.0 };
  if (r < 4.0) return { catActual: "6ta",     nextCat: "5ta",  floor: 3.0, ceiling: 4.0 };
  if (r < 4.5) return { catActual: "5ta",     nextCat: "4ta",  floor: 4.0, ceiling: 4.5 };
  if (r < 5.0) return { catActual: "4ta",     nextCat: "3era", floor: 4.5, ceiling: 5.0 };
  if (r < 6.0) return { catActual: "3era",    nextCat: "Open", floor: 5.0, ceiling: 6.0 };
  return              { catActual: "Open",    nextCat: "MAX",  floor: 6.0, ceiling: 7.0 };
}
function calcProgresoPorcentaje(ratingVal) {
  const r    = Number(ratingVal) || 1.0;
  const info = getInfoRating(r);
  if (info.nextCat === "MAX") return 100;
  return Math.round(Math.min(Math.max(((r - info.floor) / (info.ceiling - info.floor)) * 100, 0), 100));
}
function getEtiquetaFiabilidad(f) {
  const v = Number(f) || 0;
  if (v < 35) return { texto: "Baja (Calibrando)", color: "text-amber-400"   };
  if (v < 70) return { texto: "Media",             color: "text-cyan-300"    };
  return              { texto: "Alta (Estable)",   color: "text-emerald-400" };
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function PadelPerfilPage() {
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [user,          setUser]          = useState(null);
  const [baseProfile,   setBaseProfile]   = useState(null);
  const [padelProfile,  setPadelProfile]  = useState(null);
  const [matchesData,   setMatchesData]   = useState([]);
  const [editando,      setEditando]      = useState(false);
  const [modalInfoOpen, setModalInfoOpen] = useState(false);
  const [mensaje,       setMensaje]       = useState("");
  const [errorMsg,      setErrorMsg]      = useState("");
  const [form,          setForm]          = useState(DEFAULT_PROFILE);

  // ── Onboarding state ──
  const [onboardingOpen,      setOnboardingOpen]      = useState(false);
  const [onboardingStep,      setOnboardingStep]      = useState(0);
  const [onboardingResp,      setOnboardingResp]      = useState({
    q_nivel_escala: null, q_anios: null, q_competicion: null,
    q_formacion: null, q_volea: null, q_rebotes: null, q_edad: null,
  });
  const [ratingCalculado,     setRatingCalculado]     = useState(1.0);
  const [ratingAjuste,        setRatingAjuste]        = useState(0);
  const [onboardingGuardando, setOnboardingGuardando] = useState(false);

  const TOTAL_STEPS = ONBOARDING_STEPS.length + 1; // 7 preguntas + 1 resultado

  useEffect(() => { cargarPerfil(); }, []);

  // ── CARGA PERFIL ──────────────────────────────────────────────────────────
  async function cargarPerfil() {
    try {
      setLoading(true); setErrorMsg(""); setMensaje("");
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser) { setErrorMsg("No hay una sesión activa."); setLoading(false); return; }
      setUser(authUser);

      const [
        { data: profileData },
        { data: padelData, error: padelError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
        supabase.from("padel_profiles").select("*").eq("id", authUser.id).maybeSingle(),
      ]);
      if (padelError) throw padelError;
      setBaseProfile(profileData || null);

      let finalPadel = padelData;
      if (!finalPadel) {
        const { data: created, error: createError } = await supabase
          .from("padel_profiles")
          .upsert({ id: authUser.id, ...DEFAULT_PROFILE }, { onConflict: "id" })
          .select()
          .single();
        if (createError) throw createError;
        finalPadel = created;
      }

      const nivelBaseN    = normalizeNivelBase(finalPadel?.nivel_base);
      const catSolicitada = normalizeCategoria(finalPadel?.categoria_solicitada, nivelBaseN);
      const catOficial    = normalizeCategoria(finalPadel?.categoria_oficial,    nivelBaseN);
      const estadoCat     = normalizeEstadoCategoria(finalPadel?.estado_categoria);
      const tiposN        = normalizarTiposPartido(finalPadel?.tipo_partido_preferido);

      finalPadel = {
        ...finalPadel,
        nivel_base:             nivelBaseN,
        categoria_solicitada:   catSolicitada,
        categoria_oficial:      catOficial,
        estado_categoria:       estadoCat,
        rating:                 Number(finalPadel?.rating)     || 1.50,
        fiabilidad:             Number(finalPadel?.fiabilidad) || 20,
        tipo_partido_preferido: tiposN,
      };

      setPadelProfile(finalPadel);
      setForm({
        nivel_base:             nivelBaseN,
        categoria_solicitada:   catSolicitada,
        categoria_oficial:      catOficial,
        estado_categoria:       estadoCat,
        rating:                 finalPadel.rating,
        fiabilidad:             finalPadel.fiabilidad,
        posicion:               finalPadel.posicion             || DEFAULT_PROFILE.posicion,
        posicion_preferida:     finalPadel.posicion_preferida   || DEFAULT_PROFILE.posicion_preferida,
        mano_habil:             finalPadel.mano_habil           || DEFAULT_PROFILE.mano_habil,
        genero:                 finalPadel.genero               || DEFAULT_PROFILE.genero,
        edad:                   finalPadel.edad                 || DEFAULT_PROFILE.edad,
        horario_preferido:      finalPadel.horario_preferido    || DEFAULT_PROFILE.horario_preferido,
        dia_preferido:          finalPadel.dia_preferido        || DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido: tiposN,
      });

      // ★ Abrir onboarding solo si nunca completó la evaluación inicial
      if (!finalPadel.evaluacion_inicial_completada) {
        setOnboardingStep(0);
        setOnboardingResp({
          q_nivel_escala: null, q_anios: null, q_competicion: null,
          q_formacion: null, q_volea: null, q_rebotes: null, q_edad: null,
        });
        setOnboardingOpen(true);
      }

      // Cargar partidos
      const { data: playedMatches, error: matchesError } = await supabase
        .from("padel_match_players")
        .select(`
          id, team, joined_at,
          match:padel_matches!inner(
            id, status, winner_team,
            team_a_score, team_b_score, scheduled_at
          )
        `)
        .eq("user_id", authUser.id)
        .order("scheduled_at", { referencedTable: "match", ascending: false });
      if (matchesError) throw matchesError;

      setMatchesData(
        (playedMatches || []).filter((row) => {
          const m = normalizeMatchRelation(row.match);
          return m?.status === "jugado";
        })
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }

  // ── GUARDAR EDICIÓN NORMAL ────────────────────────────────────────────────
  async function guardarCambios() {
    if (!user) return;
    try {
      setSaving(true); setErrorMsg(""); setMensaje("");
      const nivelBase     = normalizeNivelBase(form.nivel_base);
      const catSolicitada = normalizeCategoria(form.categoria_solicitada, nivelBase);
      const tiposN        = normalizarTiposPartido(form.tipo_partido_preferido);
      const cambioCategoria =
        catSolicitada !== padelProfile?.categoria_solicitada ||
        nivelBase     !== padelProfile?.nivel_base;

      const { data, error } = await supabase
        .from("padel_profiles")
        .update({
          nivel_base:             nivelBase,
          categoria_solicitada:   catSolicitada,
          estado_categoria:       cambioCategoria ? "pendiente" : padelProfile?.estado_categoria,
          posicion:               form.posicion,
          posicion_preferida:     form.posicion_preferida,
          mano_habil:             form.mano_habil,
          genero:                 form.genero,
          edad:                   Number(form.edad) || 25,
          horario_preferido:      form.horario_preferido,
          dia_preferido:          form.dia_preferido,
          tipo_partido_preferido: tiposN,
        })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;

      const perfilN = {
        ...data,
        nivel_base:             normalizeNivelBase(data?.nivel_base),
        categoria_solicitada:   normalizeCategoria(data?.categoria_solicitada, data?.nivel_base),
        categoria_oficial:      normalizeCategoria(data?.categoria_oficial,    data?.nivel_base),
        estado_categoria:       normalizeEstadoCategoria(data?.estado_categoria),
        rating:                 Number(data?.rating)     || padelProfile?.rating    || 1.50,
        fiabilidad:             Number(data?.fiabilidad) || padelProfile?.fiabilidad || 20,
        tipo_partido_preferido: normalizarTiposPartido(data?.tipo_partido_preferido),
      };
      setPadelProfile(perfilN);
      setEditando(false);
      setMensaje("Perfil actualizado correctamente.");
    } catch (err) {
      setErrorMsg(err.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  // ── ONBOARDING: seleccionar opción ───────────────────────────────────────
  function seleccionarRespuesta(campo, value) {
    setOnboardingResp((prev) => ({ ...prev, [campo]: value }));
  }

  // ── ONBOARDING: avanzar paso ──────────────────────────────────────────────
  function avanzarOnboarding() {
    if (onboardingStep === ONBOARDING_STEPS.length - 1) {
      const rating = calcularRatingInicial(onboardingResp);
      setRatingCalculado(rating);
      setRatingAjuste(0);
      setOnboardingStep(ONBOARDING_STEPS.length); // pantalla resultado
      return;
    }
    setOnboardingStep((s) => s + 1);
  }

  // ── ONBOARDING: guardar resultado ─────────────────────────────────────────
  async function guardarOnboarding() {
    if (!user) return;
    try {
      setOnboardingGuardando(true);
      const ratingFinal = parseFloat(
        Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2)
      );
      const { nivel_base, categoria } = nivelDesdeRating(ratingFinal);
      const opEdad  = ONBOARDING_STEPS[6].opciones.find((o) => o.value === onboardingResp.q_edad);
      const edadNum = opEdad?.edadNum || 25;

      const { data, error } = await supabase
        .from("padel_profiles")
        .update({
          nivel_base,
          categoria_solicitada:           categoria,
          categoria_oficial:              categoria,
          estado_categoria:               "pendiente",
          rating:                         ratingFinal,
          fiabilidad:                     20,
          edad:                           edadNum,
          evaluacion_inicial_completada:  true,
        })
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;

      setPadelProfile((prev) => ({
        ...prev,
        ...data,
        evaluacion_inicial_completada: true,
      }));
      setOnboardingOpen(false);
      setMensaje(
        `¡Bienvenido! Tu nivel inicial es ${ratingFinal.toFixed(2)} — ${NIVEL_LABELS[categoria]?.label} 🎾`
      );
    } catch (err) {
      setErrorMsg(err.message || "Error al guardar la evaluación.");
    } finally {
      setOnboardingGuardando(false);
    }
  }

  // ── ESTADÍSTICAS ──────────────────────────────────────────────────────────
  const estadisticas = useMemo(() => {
    const matches = (matchesData || [])
      .map((row) => {
        const m = normalizeMatchRelation(row.match);
        if (!m || m.status !== "jugado") return null;
        return { team: row.team, winnerTeam: m.winner_team, scheduledAt: m.scheduled_at };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    const partidos  = matches.length;
    const victorias = matches.filter((m) => m.winnerTeam && m.winnerTeam === m.team).length;
    const derrotas  = Math.max(partidos - victorias, 0);
    const pct       = partidos > 0 ? Math.round((victorias / partidos) * 100) : 0;
    let racha = 0, mejorRacha = 0;
    for (const m of matches) {
      if (m.winnerTeam && m.winnerTeam === m.team) { racha++; mejorRacha = Math.max(racha, mejorRacha); }
      else racha = 0;
    }
    return { partidos, victorias, derrotas, porcentajeVictorias: pct, racha: mejorRacha };
  }, [matchesData]);

  // ── LOADING SKELETON ──────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-64 rounded-3xl bg-slate-200" />
          <div className="h-64 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );

  // ── DATOS DE PRESENTACIÓN ─────────────────────────────────────────────────
  const nombreStr       = baseProfile?.nombre || user?.user_metadata?.nombre || user?.email?.split("@")[0] || "Jugador";
  const apellidoStr     = baseProfile?.apellido || "";
  const nombreCompleto  = `${nombreStr} ${apellidoStr}`.trim();
  const inicial         = nombreStr.charAt(0).toUpperCase();
  const catOficialLabel = LABELS.categoria[padelProfile?.categoria_oficial] || "Rookies";
  const ratingActual    = padelProfile?.rating    || 1.50;
  const fiabilidadVal   = padelProfile?.fiabilidad || 20;
  const infoRating      = getInfoRating(ratingActual);
  const progresoPct     = calcProgresoPorcentaje(ratingActual);
  const fiabilidadInfo  = getEtiquetaFiabilidad(fiabilidadVal);
  const categoriasDisponibles = CATEGORY_OPTIONS[normalizeNivelBase(form.nivel_base)] || [];

  // ─── PASO ACTUAL DEL ONBOARDING ───────────────────────────────────────────
  const stepActual     = ONBOARDING_STEPS[onboardingStep] || null;
  const esUltimaPreg   = onboardingStep === ONBOARDING_STEPS.length - 1;
  const esPantallaRes  = onboardingStep === ONBOARDING_STEPS.length;
  const respActual     = stepActual ? onboardingResp[stepActual.campo] : null;
  const progresoBarPct = Math.round(((onboardingStep) / TOTAL_STEPS) * 100);
  const ratingConAjuste= parseFloat(
    Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2)
  );
  const { categoria: catResult } = nivelDesdeRating(ratingConAjuste);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── ALERTAS ── */}
        {mensaje && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-emerald-800">✅ {mensaje}</span>
            <button onClick={() => setMensaje("")} className="text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-rose-800">⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-600 hover:text-rose-800">✕</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODAL ONBOARDING — solo aparece la primera vez
        ══════════════════════════════════════════════════════════════════ */}
        {onboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0B1120]/90 sm:items-center">
            <div className="w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] bg-[#EEF0F5] flex flex-col min-h-[70vh] sm:min-h-0 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <button
                  onClick={() => {
                    if (onboardingStep > 0) setOnboardingStep((s) => s - 1);
                  }}
                  disabled={onboardingStep === 0}
                  className="w-9 h-9 flex items-center justify-center disabled:opacity-0"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                {!esPantallaRes && (
                  <button
                    onClick={() => {/* No cerrable hasta que termine */}}
                    className="text-gray-400 text-lg opacity-50 cursor-default"
                  >✕</button>
                )}
              </div>

              {/* Barra de progreso */}
              <div className="px-5 pb-4">
                <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${esPantallaRes ? 100 : progresoBarPct}%` }}
                  />
                </div>
              </div>

              {/* ── PANTALLA DE PREGUNTA ── */}
              {!esPantallaRes && stepActual && (
                <div className="flex-1 flex flex-col px-5 pb-6 gap-4">
                  <h2 className="text-xl font-black text-gray-900 leading-snug">
                    {stepActual.titulo}
                  </h2>
                  <div className="flex flex-col gap-3 mt-2">
                    {stepActual.opciones.map((op) => {
                      const selected = respActual === op.value;
                      return (
                        <button
                          key={op.value}
                          onClick={() => seleccionarRespuesta(stepActual.campo, op.value)}
                          className={`flex items-center gap-3 w-full rounded-2xl px-4 py-3.5 text-left transition-all border-2 ${
                            selected
                              ? "border-blue-600 bg-white shadow-md"
                              : "border-transparent bg-white/80 hover:bg-white"
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            selected ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"
                          }`}>
                            {selected && (
                              <span className="w-2.5 h-2.5 rounded-full bg-white block" />
                            )}
                          </span>
                          <span className="text-sm font-medium text-gray-800 leading-snug">
                            {op.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Botón avanzar — solo si hay respuesta seleccionada */}
                  {respActual && (
                    <div className="mt-auto flex justify-end pt-2">
                      <button
                        onClick={avanzarOnboarding}
                        className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── PANTALLA RESULTADO ── */}
              {esPantallaRes && (
                <div className="flex-1 flex flex-col px-5 pb-6 gap-5 bg-[#0B1120] text-white">
                  <h2 className="text-base font-bold text-center text-white/80 pt-2">Tu Nivel Inicial</h2>

                  {/* Gauge / Medidor */}
                  <div className="bg-[#141C30] rounded-2xl p-5 flex flex-col items-center gap-2">
                    {/* SVG semicírculo */}
                    <svg width="200" height="110" viewBox="0 0 200 110">
                      {/* Track gris */}
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none" stroke="#374151" strokeWidth="10" strokeLinecap="round"
                      />
                      {/* Arco coloreado */}
                      <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none" stroke="#AFEC3B" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${Math.round(((ratingConAjuste - 1) / 6) * 251.3)} 251.3`}
                      />
                      {/* Marcadores 0 y 7 */}
                      <text x="14" y="112" fontSize="11" fill="#6B7280" textAnchor="middle">0</text>
                      <text x="186" y="112" fontSize="11" fill="#6B7280" textAnchor="middle">7</text>
                    </svg>

                    <div className="text-6xl font-black text-[#AFEC3B] -mt-8">
                      {ratingConAjuste.toFixed(1).replace(".", ",")}
                    </div>
                    <div className="text-xl font-black text-white">
                      {NIVEL_LABELS[catResult]?.label || catResult}
                    </div>
                    <p className="text-xs text-gray-400 text-center max-w-[240px]">
                      {NIVEL_LABELS[catResult]?.desc}
                    </p>
                  </div>

                  {/* Ajuste slider */}
                  <div className="bg-[#141C30] rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80 font-medium">¿Crees que tu Nivel es diferente?</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>- 0,5</span>
                      <span>+ 0,5</span>
                    </div>
                    <input
                      type="range"
                      min={-0.5}
                      max={0.5}
                      step={0.1}
                      value={ratingAjuste}
                      onChange={(e) => setRatingAjuste(parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <p className="text-xs text-gray-500 text-center">Desliza para ajustar tu nivel</p>
                  </div>

                  {/* Botón confirmar */}
                  <button
                    onClick={guardarOnboarding}
                    disabled={onboardingGuardando}
                    className="w-full rounded-2xl bg-blue-600 py-4 text-base font-black text-white hover:bg-blue-700 active:scale-[.98] transition-all disabled:opacity-60"
                  >
                    {onboardingGuardando ? "Guardando..." : "¡Entendido!"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PERFIL PRINCIPAL
        ══════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── CARTA JUGADOR ── */}
          <div className="lg:col-span-5 w-full flex flex-col items-center">
            <div className="w-full bg-gradient-to-b from-[#0B0C2A] via-[#161848] to-[#0B0C2A] rounded-[2.5rem] p-6 md:p-8 text-white text-center shadow-xl border border-blue-500/20 relative overflow-hidden flex flex-col items-center justify-between min-h-[460px]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Avatar */}
              <div className="relative z-10 flex flex-col items-center gap-3 pt-2">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-3xl font-black shadow-lg border-4 border-white/10">
                  {inicial}
                </div>
                <div>
                  <p className="text-lg font-black tracking-wide">{nombreCompleto}</p>
                  <p className="text-xs text-blue-300/80 font-medium mt-0.5">
                    {LABELS.nivel_base[padelProfile?.nivel_base] || "Principiante"}
                  </p>
                </div>
              </div>

              {/* Rating central */}
              <div className="relative z-10 flex flex-col items-center gap-1 py-4">
                <span className="text-6xl font-black text-white tracking-tight">
                  {ratingActual.toFixed(2)}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-300/60">Rating</span>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-200 border border-blue-500/30">
                    {catOficialLabel}
                  </span>
                  <span className={`text-xs font-semibold ${fiabilidadInfo.color}`}>
                    {fiabilidadInfo.texto}
                  </span>
                </div>
              </div>

              {/* Barra progreso */}
              <div className="relative z-10 w-full px-2">
                <div className="flex justify-between text-[10px] text-blue-300/60 mb-1 font-medium">
                  <span>{infoRating.catActual}</span>
                  <span>{infoRating.nextCat !== "MAX" ? `→ ${infoRating.nextCat}` : "Nivel máximo"}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-blue-900/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-700"
                    style={{ width: `${progresoPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-blue-300/40 mt-1 text-right">{progresoPct}% hacia {infoRating.nextCat}</p>
              </div>

              {/* Stats mini */}
              <div className="relative z-10 grid grid-cols-3 gap-3 w-full pt-2">
                {[
                  { label: "Partidos", value: estadisticas.partidos },
                  { label: "Victorias", value: estadisticas.victorias },
                  { label: "% Victoria", value: `${estadisticas.porcentajeVictorias}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 bg-white/5 rounded-2xl py-3 px-1">
                    <span className="text-xl font-black text-white">{value}</span>
                    <span className="text-[10px] text-blue-300/60 font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── PANEL DERECHO ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">

            {/* Estado categoría */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-gray-800">Estado de Categoría</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold border ${
                  padelProfile?.estado_categoria === "aprobada"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : padelProfile?.estado_categoria === "rechazada"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {LABELS.estado_categoria[padelProfile?.estado_categoria] || "En revisión"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Oficial</p>
                  <p className="font-black text-gray-900">{catOficialLabel}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Solicitada</p>
                  <p className="font-black text-gray-900">
                    {LABELS.categoria[padelProfile?.categoria_solicitada] || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Info personal */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-800">Información del Jugador</h3>
                {!editando ? (
                  <button
                    onClick={() => setEditando(true)}
                    className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditando(false)}
                      className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarCambios}
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                )}
              </div>

              {!editando ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {[
                    { label: "Posición",   value: LABELS.posicion[padelProfile?.posicion]       || "—" },
                    { label: "Mano Hábil", value: LABELS.mano_habil[padelProfile?.mano_habil]   || "—" },
                    { label: "Género",     value: LABELS.genero[padelProfile?.genero]            || "—" },
                    { label: "Edad",       value: padelProfile?.edad ? `${padelProfile.edad} años` : "—" },
                    { label: "Horario",    value: padelProfile?.horario_preferido                || "—" },
                    { label: "Día pref.",  value: padelProfile?.dia_preferido                   || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
                      <p className="font-bold text-gray-900 text-sm capitalize">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Nivel base */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Nivel</label>
                    <select
                      value={form.nivel_base}
                      onChange={(e) => {
                        const nv = normalizeNivelBase(e.target.value);
                        const cats = CATEGORY_OPTIONS[nv];
                        setForm((f) => ({
                          ...f,
                          nivel_base:           nv,
                          categoria_solicitada: cats[0],
                        }));
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {NIVELES_VALIDOS.map((n) => (
                        <option key={n} value={n}>{LABELS.nivel_base[n]}</option>
                      ))}
                    </select>
                  </div>
                  {/* Categoría solicitada */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Categoría</label>
                    <select
                      value={form.categoria_solicitada}
                      onChange={(e) => setForm((f) => ({ ...f, categoria_solicitada: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categoriasDisponibles.map((c) => (
                        <option key={c} value={c}>{LABELS.categoria[c] || c}</option>
                      ))}
                    </select>
                  </div>
                  {/* Posición */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Posición</label>
                    <select
                      value={form.posicion}
                      onChange={(e) => setForm((f) => ({ ...f, posicion: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(LABELS.posicion).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {/* Mano hábil */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Mano Hábil</label>
                    <select
                      value={form.mano_habil}
                      onChange={(e) => setForm((f) => ({ ...f, mano_habil: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(LABELS.mano_habil).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {/* Género */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Género</label>
                    <select
                      value={form.genero}
                      onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(LABELS.genero).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {/* Edad */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Edad</label>
                    <input
                      type="number" min={10} max={99}
                      value={form.edad}
                      onChange={(e) => setForm((f) => ({ ...f, edad: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actividad reciente */}
            <PadelRecentActivity userId={user?.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
