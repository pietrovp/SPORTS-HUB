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
  posicion:          { drive: "Drive", reves: "Revés", ambos: "Ambos lados" },
  mano_habil:        { derecha: "Derecha", izquierda: "Izquierda", ambidiestro: "Ambidiestro" },
  genero:            { masculino: "Masculino", femenino: "Femenino", otro: "Otro" },
  // ✅ FIX #5: mapa de labels para horario
  horario_preferido: { manana: "Mañana", tarde: "Tarde", noche: "Noche" },
  dia_preferido: {
    semana: "Entre semana",
    fin_de_semana: "Fin de semana",
    cualquiera: "Cualquier día",
  },
};

const TIPOS_VALIDOS   = ["amistoso", "competitivo", "mixto"];
const NIVELES_VALIDOS = ["principiante", "intermedio", "avanzado", "profesional"];

const NIVEL_LABELS = {
  rookies: { label: "Rookies", desc: "Sin clases. Menos de seis meses jugando. Sin técnica ni táctica." },
  "7ma":   { label: "7ma",     desc: "Conoces las reglas básicas, golpeas con poca consistencia." },
  "6ta":   { label: "6ta",     desc: "Juegas con cierta regularidad, golpes básicos consolidados." },
  "5ta":   { label: "5ta",     desc: "Nivel avanzado, participas en ligas amateur." },
  "4ta":   { label: "4ta",     desc: "Alto nivel técnico, compites en torneos con regularidad." },
  "3era":  { label: "3era",    desc: "Nivel semiprofesional, buena táctica y físico." },
  open:    { label: "Open",    desc: "Nivel profesional o muy cercano." },
};

// ─── ONBOARDING STEPS ─────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  {
    id: 0,
    titulo: "En la siguiente escala, ¿dónde te colocarías?",
    campo: "q_nivel_escala",
    opciones: [
      { label: "Iniciación",   value: "iniciacion",  peso: 0,   cats: "Rookies · 7ma"    },
      { label: "Intermedio",   value: "intermedio",  peso: 0.8, cats: "6ta"              },
      { label: "Avanzado",     value: "avanzado",    peso: 1.6, cats: "5ta · 4ta"        },
      { label: "Profesional",  value: "profesional", peso: 2.5, cats: "3era · 2da · Open"},
    ],
  },
  {
    id: 1,
    titulo: "¿Cuántos años llevas practicando pádel o algún deporte de raqueta?",
    campo: "q_anios",
    opciones: [
      { label: "Nunca he jugado previamente", value: "nunca",  peso: 0   },
      { label: "Menos de un año",             value: "menos1", peso: 0.2 },
      { label: "Entre 1 y 3 años",            value: "1a3",    peso: 0.5 },
      { label: "Entre 3 y 5 años",            value: "3a5",    peso: 0.8 },
      { label: "Más de 5 años",               value: "mas5",   peso: 1.1 },
    ],
  },
  {
    id: 2,
    titulo: "¿Cuál es el nivel al que compites cuando juegas partidos competitivos?",
    campo: "q_competicion",
    opciones: [
      { label: "Sólo partidos entre amigos", value: "amigos",   peso: 0   },
      { label: "Torneos amistosos",          value: "torneos",  peso: 0.3 },
      { label: "Ligas amateur",              value: "amateur",  peso: 0.6 },
      { label: "Competiciones federadas",    value: "federado", peso: 1.0 },
    ],
  },
  {
    id: 3,
    titulo: "¿Has recibido o recibes formación en pádel?",
    campo: "q_formacion",
    opciones: [
      { label: "No",               value: "no",     peso: 0    },
      { label: "Sí, en el pasado", value: "pasado", peso: 0.15 },
      { label: "Sí, actualmente",  value: "actual", peso: 0.3  },
    ],
  },
  {
    id: 4,
    titulo: "En la volea...",
    campo: "q_volea",
    opciones: [
      { label: "Casi no subo a la red",                                      value: "v1", peso: 0    },
      { label: "No me siento seguro/a en la red, cometo demasiados errores", value: "v2", peso: 0.2  },
      { label: "Logro volear de derecha y de revés con alguna dificultad",   value: "v3", peso: 0.45 },
      { label: "Tengo buena colocación en la red y voleo con seguridad",     value: "v4", peso: 0.7  },
      { label: "Voleo con profundidad y potencia",                           value: "v5", peso: 1.0  },
    ],
  },
  {
    id: 5,
    titulo: "En los rebotes...",
    campo: "q_rebotes",
    opciones: [
      { label: "No sé cómo leer los rebotes, golpeo antes del rebote",                        value: "r1", peso: 0    },
      { label: "Intento, con dificultad, golpear los rebotes en la pared de fondo",            value: "r2", peso: 0.2  },
      { label: "Devuelvo rebotes en la pared de fondo, me cuesta devolver los de doble pared", value: "r3", peso: 0.45 },
      { label: "Devuelvo rebotes a dos paredes y alcanzo rebotes rápidos",                     value: "r4", peso: 0.7  },
      { label: "Realizo bajadas de pared con potencia de derecha y de revés",                  value: "r5", peso: 1.0  },
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

// ─── HELPERS PERFIL ───────────────────────────────────────────────────────────
function normalizeNivelBase(value) {
  const n = String(value || "").trim().toLowerCase();
  return NIVELES_VALIDOS.includes(n) ? n : "principiante";
}
function normalizeCategoria(value, nivelBase) {
  const nivel      = normalizeNivelBase(nivelBase);
  const permitidas = CATEGORY_OPTIONS[nivel] || CATEGORY_OPTIONS.principiante;
  const cat        = String(value || "").trim().toLowerCase();
  return permitidas.includes(cat) ? cat : permitidas[0];
}
function normalizeEstadoCategoria(value) {
  const e = String(value || "").trim().toLowerCase();
  return ["pendiente","aprobada","rechazada","ajustada"].includes(e) ? e : "pendiente";
}
function normalizarTiposPartido(value) {
  const arr   = Array.isArray(value) ? value : [value];
  const tipos = arr.map((t) => String(t || "").trim().toLowerCase()).filter((t) => TIPOS_VALIDOS.includes(t));
  const unique = [...new Set(tipos)];
  return unique.length > 0 ? unique : ["amistoso"];
}
// ✅ FIX #3: helper de relación — robusto ante objeto o array
function normalizeMatchRelation(match) {
  if (!match) return null;
  return Array.isArray(match) ? match[0] ?? null : match;
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
  const [mensaje,       setMensaje]       = useState("");
  const [errorMsg,      setErrorMsg]      = useState("");
  const [form,          setForm]          = useState(DEFAULT_PROFILE);

  // Onboarding
  const [onboardingOpen,      setOnboardingOpen]      = useState(false);
  const [onboardingStep,      setOnboardingStep]      = useState(0);
  const [onboardingResp,      setOnboardingResp]      = useState({
    q_nivel_escala: null, q_anios: null, q_competicion: null,
    q_formacion: null, q_volea: null, q_rebotes: null, q_edad: null,
  });
  const [ratingCalculado,     setRatingCalculado]     = useState(1.0);
  const [ratingAjuste,        setRatingAjuste]        = useState(0);
  const [onboardingGuardando, setOnboardingGuardando] = useState(false);
  const [shakeBtn,            setShakeBtn]            = useState(false);

  const TOTAL_STEPS = ONBOARDING_STEPS.length + 1;

  useEffect(() => { cargarPerfil(); }, []);

  // ── CARGA PERFIL ────────────────────────────────────────────────────────────
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
        supabase.from("padel_profiles").select("*").eq("cuenta_id", authUser.id).maybeSingle(),
      ]);
      if (padelError) throw padelError;
      setBaseProfile(profileData || null);

      let finalPadel = padelData;
      if (!finalPadel) {
        // ✅ FIX #2: no pasar `id` en el payload para evitar conflicto con cuenta_id
        const { data: created, error: createError } = await supabase
          .from("padel_profiles")
          .upsert(
            { cuenta_id: authUser.id, ...DEFAULT_PROFILE },
            { onConflict: "cuenta_id" }
          )
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

      if (!finalPadel.evaluacion_inicial_completada) {
        setOnboardingStep(0);
        setOnboardingResp({
          q_nivel_escala: null, q_anios: null, q_competicion: null,
          q_formacion: null, q_volea: null, q_rebotes: null, q_edad: null,
        });
        setRatingAjuste(0);
        setOnboardingOpen(true);
      }

      // ✅ FIX #1: referencedTable debe ser el nombre real de la tabla, no el alias
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
        .order("scheduled_at", { referencedTable: "padel_matches", ascending: false });
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

  // ── GUARDAR EDICIÓN NORMAL ──────────────────────────────────────────────────
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
        .eq("cuenta_id", user.id)
        .select()
        .single();
      if (error) throw error;

      const perfilN = {
        ...data,
        nivel_base:             normalizeNivelBase(data?.nivel_base),
        categoria_solicitada:   normalizeCategoria(data?.categoria_solicitada, data?.nivel_base),
        categoria_oficial:      normalizeCategoria(data?.categoria_oficial,    data?.nivel_base),
        estado_categoria:       normalizeEstadoCategoria(data?.estado_categoria),
        rating:                 Number(data?.rating)     || padelProfile?.rating     || 1.50,
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

  // ── ONBOARDING HANDLERS ─────────────────────────────────────────────────────
  function seleccionarRespuesta(campo, value) {
    setOnboardingResp((prev) => ({ ...prev, [campo]: value }));
    setShakeBtn(false);
  }

  function avanzarOnboarding() {
    const stepActual = ONBOARDING_STEPS[onboardingStep];
    if (stepActual && !onboardingResp[stepActual.campo]) {
      setShakeBtn(true);
      setTimeout(() => setShakeBtn(false), 600);
      return;
    }
    if (onboardingStep === ONBOARDING_STEPS.length - 1) {
      const rating = calcularRatingInicial(onboardingResp);
      setRatingCalculado(rating);
      setRatingAjuste(0);
      setOnboardingStep(ONBOARDING_STEPS.length);
      return;
    }
    setOnboardingStep((s) => s + 1);
  }

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
          categoria_solicitada:          categoria,
          categoria_oficial:             categoria,
          estado_categoria:              "pendiente",
          rating:                        ratingFinal,
          fiabilidad:                    20,
          edad:                          edadNum,
          evaluacion_inicial_completada: true,
        })
        .eq("cuenta_id", user.id)
        .select()
        .single();
      if (error) throw error;

      // ✅ FIX #4: también actualizar form para que la UI refleje los nuevos valores
      const nivelBaseN    = normalizeNivelBase(data.nivel_base);
      const catSolicitada = normalizeCategoria(data.categoria_solicitada, nivelBaseN);
      const catOficial    = normalizeCategoria(data.categoria_oficial, nivelBaseN);

      setPadelProfile((prev) => ({
        ...prev,
        ...data,
        nivel_base:           nivelBaseN,
        categoria_solicitada: catSolicitada,
        categoria_oficial:    catOficial,
        estado_categoria:     normalizeEstadoCategoria(data.estado_categoria),
        rating:               Number(data.rating) || ratingFinal,
        fiabilidad:           Number(data.fiabilidad) || 20,
        evaluacion_inicial_completada: true,
      }));
      setForm((prev) => ({
        ...prev,
        nivel_base:           nivelBaseN,
        categoria_solicitada: catSolicitada,
        rating:               Number(data.rating) || ratingFinal,
        fiabilidad:           Number(data.fiabilidad) || 20,
        edad:                 edadNum,
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

  // ── ESTADÍSTICAS ────────────────────────────────────────────────────────────
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

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-64 rounded-3xl bg-slate-200" />
          <div className="h-64 rounded-3xl bg-slate-200" />
        </div>
      </div>
    );

  // ── DATOS PRESENTACIÓN ──────────────────────────────────────────────────────
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

  // Onboarding vars
  const stepActual      = ONBOARDING_STEPS[onboardingStep] || null;
  const esPantallaRes   = onboardingStep === ONBOARDING_STEPS.length;
  const respActual      = stepActual ? onboardingResp[stepActual.campo] : null;
  const progresoBarPct  = Math.round((onboardingStep / TOTAL_STEPS) * 100);
  const ratingConAjuste = parseFloat(
    Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2)
  );
  const { categoria: catResult } = nivelDesdeRating(ratingConAjuste);

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-6 md:px-8">

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-4px); }
          80%      { transform: translateX(4px); }
        }
        .shake { animation: shake 0.5s ease-in-out; }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">

        {/* ALERTAS */}
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

        {/* ════════════ MODAL ONBOARDING ════════════ */}
        {onboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0B1120]/90 sm:items-center">
            <div
              className="w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] bg-[#EEF0F5] flex flex-col overflow-hidden"
              style={{ maxHeight: "92vh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
                <button
                  onClick={() => { if (onboardingStep > 0) setOnboardingStep((s) => s - 1); }}
                  disabled={onboardingStep === 0}
                  className="w-9 h-9 flex items-center justify-center disabled:opacity-0 rounded-full hover:bg-black/5 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                </button>
                <span className="text-xs font-semibold text-gray-400">
                  {esPantallaRes
                    ? "Tu resultado"
                    : `Pregunta ${onboardingStep + 1} de ${ONBOARDING_STEPS.length}`}
                </span>
                <div className="w-9 h-9" />
              </div>

              {/* Barra progreso */}
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0B1120] transition-all duration-500"
                    style={{ width: `${progresoBarPct}%` }}
                  />
                </div>
              </div>

              {/* Contenido scrollable */}
              <div className="flex-1 overflow-y-auto px-5 pb-6">

                {/* ── PANTALLA RESULTADO ── */}
                {esPantallaRes ? (
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="rounded-2xl bg-[#0B1120] text-white p-6 text-center">
                      <p className="text-xs text-gray-400 mb-1 uppercase tracking-widest">
                        Tu rating inicial
                      </p>
                      <p className="text-6xl font-black tracking-tight leading-none my-2">
                        {ratingConAjuste.toFixed(2)}
                      </p>
                      <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-emerald-400">
                        {NIVEL_LABELS[catResult]?.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        {NIVEL_LABELS[catResult]?.desc}
                      </p>
                    </div>

                    {/* Ajuste ±0.3 */}
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 mb-1">
                        ¿El resultado te parece justo?
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        Puedes ajustarlo ligeramente (máx ±0.3):
                      </p>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() =>
                            setRatingAjuste((a) => parseFloat(Math.max(a - 0.1, -0.3).toFixed(1)))
                          }
                          disabled={ratingAjuste <= -0.3}
                          className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-30 text-xl font-bold transition-all"
                        >−</button>
                        <span className="text-sm font-semibold text-gray-700 min-w-[70px] text-center">
                          {ratingAjuste === 0
                            ? "Sin ajuste"
                            : ratingAjuste > 0
                            ? `+${ratingAjuste.toFixed(1)}`
                            : ratingAjuste.toFixed(1)}
                        </span>
                        <button
                          onClick={() =>
                            setRatingAjuste((a) => parseFloat(Math.min(a + 0.1, 0.3).toFixed(1)))
                          }
                          disabled={ratingAjuste >= 0.3}
                          className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-30 text-xl font-bold transition-all"
                        >+</button>
                      </div>
                    </div>

                    <button
                      onClick={guardarOnboarding}
                      disabled={onboardingGuardando}
                      className="w-full rounded-2xl bg-[#0B1120] py-4 text-sm font-bold text-white
                                 hover:bg-[#1a2740] active:scale-[0.98] disabled:opacity-60
                                 transition-all duration-150"
                    >
                      {onboardingGuardando ? "Guardando…" : "Confirmar y comenzar 🎾"}
                    </button>
                  </div>

                ) : (
                  /* ── PANTALLA PREGUNTA ── */
                  <div className="flex flex-col gap-3 pt-2">
                    <h2 className="text-base font-bold text-[#0B1120] leading-snug">
                      {stepActual?.titulo}
                    </h2>

                    <div className="flex flex-col gap-2">
                      {stepActual?.opciones.map((op) => (
                        <button
                          key={op.value}
                          onClick={() => seleccionarRespuesta(stepActual.campo, op.value)}
                          className={`
                            w-full text-left rounded-2xl border-2 px-4 py-3
                            transition-all duration-150 active:scale-[0.98]
                            ${respActual === op.value
                              ? "border-[#0B1120] bg-[#0B1120] text-white shadow-md"
                              : "border-transparent bg-white text-[#0B1120] hover:border-[#0B1120]/20 shadow-sm"
                            }
                          `}
                        >
                          <span className="block text-sm font-bold leading-snug">
                            {op.label}
                          </span>
                          {op.cats && (
                            <span className={`
                              block text-xs mt-0.5 font-medium tracking-wide
                              ${respActual === op.value ? "text-white/55" : "text-gray-400"}
                            `}>
                              {op.cats}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {shakeBtn && (
                      <p className="text-center text-xs font-semibold text-rose-500 mt-1">
                        👆 Selecciona una opción para continuar
                      </p>
                    )}

                    <button
                      onClick={avanzarOnboarding}
                      className={`
                        w-full rounded-2xl py-4 text-sm font-bold mt-2
                        transition-all duration-150 active:scale-[0.98]
                        ${shakeBtn ? "shake" : ""}
                        ${!respActual
                          ? "bg-[#0B1120]/25 text-white/60 cursor-not-allowed"
                          : "bg-[#0B1120] text-white hover:bg-[#1a2740] shadow-md"
                        }
                      `}
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* ════════════ FIN MODAL ONBOARDING ════════════ */}

        {/* ════════════ HERO CARD ════════════ */}
        <div className="relative overflow-hidden rounded-3xl bg-[#0B1120] p-6 text-white shadow-2xl md:p-8">
          <div className="absolute inset-0 opacity-5"
               style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #4f98a3 0%, transparent 60%)" }} />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Izquierda */}
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black ring-2 ring-white/20">
                {inicial}
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">{nombreCompleto}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-semibold">
                    {catOficialLabel}
                  </span>
                  <span className={`text-xs font-semibold ${fiabilidadInfo.color}`}>
                    ● {fiabilidadInfo.texto}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>

            {/* Rating */}
            <div className="flex flex-col items-start gap-1 md:items-end">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Rating</p>
              <p className="text-5xl font-black leading-none">{ratingActual.toFixed(2)}</p>
              <p className="text-xs text-gray-400">
                {infoRating.catActual} → {infoRating.nextCat}
              </p>
              <div className="mt-1 w-48">
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>{infoRating.floor.toFixed(1)}</span>
                  <span>{progresoPct}%</span>
                  <span>{infoRating.ceiling.toFixed(1)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                    style={{ width: `${progresoPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats rápidas */}
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Partidos",   value: estadisticas.partidos                   },
              { label: "Victorias",  value: estadisticas.victorias                  },
              { label: "Derrotas",   value: estadisticas.derrotas                   },
              { label: "% Victoria", value: `${estadisticas.porcentajeVictorias}%`  },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-lg font-black">{value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════ BODY ════════════ */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Columna izquierda — datos del perfil */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-800">Datos del perfil</h2>
                {!editando ? (
                  <button
                    onClick={() => setEditando(true)}
                    className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditando(false)}
                      className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarCambios}
                      disabled={saving}
                      className="rounded-xl bg-[#0B1120] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 hover:bg-[#1a2740] transition-colors"
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nivel base */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nivel base</label>
                  {editando ? (
                    <select
                      value={form.nivel_base}
                      onChange={(e) => {
                        const nivel = e.target.value;
                        const cats  = CATEGORY_OPTIONS[nivel] || [];
                        setForm((f) => ({
                          ...f,
                          nivel_base:           nivel,
                          categoria_solicitada: cats[0] || f.categoria_solicitada,
                        }));
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      {NIVELES_VALIDOS.map((n) => (
                        <option key={n} value={n}>{LABELS.nivel_base[n]}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.nivel_base[padelProfile?.nivel_base] || "—"}
                    </p>
                  )}
                </div>

                {/* Categoría solicitada */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Categoría solicitada</label>
                  {editando ? (
                    <select
                      value={form.categoria_solicitada}
                      onChange={(e) => setForm((f) => ({ ...f, categoria_solicitada: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      {categoriasDisponibles.map((c) => (
                        <option key={c} value={c}>{LABELS.categoria[c]}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.categoria[padelProfile?.categoria_solicitada] || "—"}
                    </p>
                  )}
                </div>

                {/* Posición */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Posición</label>
                  {editando ? (
                    <select
                      value={form.posicion}
                      onChange={(e) => setForm((f) => ({ ...f, posicion: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      {Object.entries(LABELS.posicion).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.posicion[padelProfile?.posicion] || "—"}
                    </p>
                  )}
                </div>

                {/* Mano hábil */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mano hábil</label>
                  {editando ? (
                    <select
                      value={form.mano_habil}
                      onChange={(e) => setForm((f) => ({ ...f, mano_habil: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      {Object.entries(LABELS.mano_habil).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.mano_habil[padelProfile?.mano_habil] || "—"}
                    </p>
                  )}
                </div>

                {/* Género */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Género</label>
                  {editando ? (
                    <select
                      value={form.genero}
                      onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      {Object.entries(LABELS.genero).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.genero[padelProfile?.genero] || "—"}
                    </p>
                  )}
                </div>

                {/* Edad */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Edad</label>
                  {editando ? (
                    <input
                      type="number" min="10" max="99"
                      value={form.edad}
                      onChange={(e) => setForm((f) => ({ ...f, edad: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-gray-800">
                      {padelProfile?.edad || "—"} años
                    </p>
                  )}
                </div>

                {/* Horario preferido */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Horario preferido</label>
                  {editando ? (
                    <select
                      value={form.horario_preferido}
                      onChange={(e) => setForm((f) => ({ ...f, horario_preferido: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      <option value="manana">Mañana</option>
                      <option value="tarde">Tarde</option>
                      <option value="noche">Noche</option>
                    </select>
                  ) : (
                    // ✅ FIX #5: usar mapa de labels en lugar de .capitalize()
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.horario_preferido[padelProfile?.horario_preferido] || "—"}
                    </p>
                  )}
                </div>

                {/* Día preferido */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Día preferido</label>
                  {editando ? (
                    <select
                      value={form.dia_preferido}
                      onChange={(e) => setForm((f) => ({ ...f, dia_preferido: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1120]/20"
                    >
                      <option value="semana">Entre semana</option>
                      <option value="fin_de_semana">Fin de semana</option>
                      <option value="cualquiera">Cualquier día</option>
                    </select>
                  ) : (
                    // ✅ FIX #5: usar mapa de labels (más limpio, sin ternarios)
                    <p className="text-sm font-semibold text-gray-800">
                      {LABELS.dia_preferido[padelProfile?.dia_preferido] || "—"}
                    </p>
                  )}
                </div>

                {/* Tipo de partido */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Tipo de partido preferido
                  </label>
                  {editando ? (
                    <div className="flex flex-wrap gap-2">
                      {TIPOS_VALIDOS.map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            const actual  = normalizarTiposPartido(form.tipo_partido_preferido);
                            const updated = actual.includes(t)
                              ? actual.filter((x) => x !== t)
                              : [...actual, t];
                            setForm((f) => ({
                              ...f,
                              tipo_partido_preferido: updated.length > 0 ? updated : ["amistoso"],
                            }));
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors capitalize
                            ${normalizarTiposPartido(form.tipo_partido_preferido).includes(t)
                              ? "border-[#0B1120] bg-[#0B1120] text-white"
                              : "border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0B1120]/40"
                            }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {normalizarTiposPartido(padelProfile?.tipo_partido_preferido).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700 capitalize"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-4">

            {/* Estado categoría */}
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                Estado de categoría
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                  padelProfile?.estado_categoria === "aprobada"  ? "bg-emerald-400" :
                  padelProfile?.estado_categoria === "rechazada" ? "bg-rose-400"    :
                  padelProfile?.estado_categoria === "ajustada"  ? "bg-blue-400"    :
                                                                    "bg-amber-400"
                }`} />
                <span className="text-sm font-bold text-gray-800">
                  {LABELS.estado_categoria[padelProfile?.estado_categoria] || "En revisión"}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Categoría oficial:{" "}
                <span className="font-semibold text-gray-700">{catOficialLabel}</span>
              </p>
              {padelProfile?.categoria_solicitada !== padelProfile?.categoria_oficial && (
                <p className="text-xs text-amber-600 mt-1">
                  Solicitud pendiente:{" "}
                  <span className="font-bold">
                    {LABELS.categoria[padelProfile?.categoria_solicitada]}
                  </span>
                </p>
              )}
            </div>

            {/* Mejor racha */}
            {estadisticas.racha > 0 && (
              <div className="rounded-3xl bg-[#0B1120] p-5 text-white shadow-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mejor racha</p>
                <p className="text-4xl font-black">{estadisticas.racha}</p>
                <p className="text-xs text-gray-400">victorias consecutivas</p>
              </div>
            )}

            {/* Actividad reciente */}
            <PadelRecentActivity userId={user?.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
