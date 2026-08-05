"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PartidoPadelCard from "@/components/padel/PartidoPadelCard";

const TODAS_CATEGORIAS = [
  { value: "rookies", label: "Rookies" },
  { value: "7ma", label: "7ma Categoría" },
  { value: "6ta", label: "6ta Categoría" },
  { value: "5ta", label: "5ta Categoría" },
  { value: "4ta", label: "4ta Categoría" },
  { value: "3era", label: "3era Categoría" },
  { value: "2da", label: "2da Categoría" },
  { value: "open", label: "Open (Profesional)" },
];

const DEFAULT_PROFILE = {
  categoria_solicitada: "rookies",
  categoria_oficial: "rookies",
  estado_categoria: "aprobada",
  motivo_solicitud: "",
  rating: 1.50,
  fiabilidad: 20,
  posicion: "drive",
  mano_habil: "derecha",
  genero: "masculino",
  edad: 25,
  evaluacion_inicial_completada: false,
};

const LABELS = {
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
    pendiente: "⏳ En revisión por Admin",
    aprobada: "✅ Aprobada",
    rechazada: "❌ Solicitud rechazada",
    ajustada: "🔵 Ajustada por Admin",
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
};

const NIVEL_LABELS = {
  rookies: { label: "Rookies", desc: "Sin clases o menos de 6 meses jugando. Golpes básicos en desarrollo." },
  "7ma": { label: "7ma Categoría", desc: "Conoces reglas básicas, mantienes peloteos lentos sin mucha consistencia." },
  "6ta": { label: "6ta Categoría", desc: "Juegas con regularidad, dominas saques y voleas básicas." },
  "5ta": { label: "5ta Categoría", desc: "Nivel intermedio-avanzado, controlas pared de fondo y dirección." },
  "4ta": { label: "4ta Categoría", desc: "Alto nivel técnico y táctico, participas en torneos locales." },
  "3era": { label: "3era Categoría", desc: "Nivel competitivo avanzado, excelente físico y potencia." },
  "2da": { label: "2da Categoría", desc: "Jugador de élite regional." },
  open: { label: "Open", desc: "Nivel semiprofesional / profesional." },
};

const ONBOARDING_STEPS = [
  {
    id: 0,
    titulo: "¿Cómo te autoevalúas en la siguiente escala?",
    campo: "q_nivel_escala",
    opciones: [
      { label: "Iniciación / Principiante", value: "iniciacion", peso: 0, cats: "Rookies · 7ma" },
      { label: "Intermedio", value: "intermedio", peso: 0.8, cats: "6ta" },
      { label: "Avanzado", value: "avanzado", peso: 1.6, cats: "5ta · 4ta" },
      { label: "Profesional / Competitivo", value: "profesional", peso: 2.5, cats: "3era · 2da · Open" },
    ],
  },
  {
    id: 1,
    titulo: "¿Cuántos años llevas practicando pádel o deportes de raqueta?",
    campo: "q_anios",
    opciones: [
      { label: "Es mi primera vez / Menos de 6 meses", value: "nunca", peso: 0 },
      { label: "Entre 6 meses y 1 año", value: "menos1", peso: 0.2 },
      { label: "Entre 1 y 3 años", value: "1a3", peso: 0.5 },
      { label: "Entre 3 y 5 años", value: "3a5", peso: 0.8 },
      { label: "Más de 5 años", value: "mas5", peso: 1.1 },
    ],
  },
  {
    id: 2,
    titulo: "¿A qué nivel compites habitualmente?",
    campo: "q_competicion",
    opciones: [
      { label: "Solo partidos entre amigos", value: "amigos", peso: 0 },
      { label: "Torneos amistosos de club", value: "torneos", peso: 0.3 },
      { label: "Ligas locales amateur", value: "amateur", peso: 0.6 },
      { label: "Torneos oficiales / Federado", value: "federado", peso: 1.0 },
    ],
  },
  {
    id: 3,
    titulo: "¿Has recibido o recibes clases de pádel?",
    campo: "q_formacion",
    opciones: [
      { label: "No, soy autodidacta", value: "no", peso: 0 },
      { label: "Sí, en el pasado", value: "pasado", peso: 0.15 },
      { label: "Sí, actualmente entreno", value: "actual", peso: 0.3 },
    ],
  },
  {
    id: 4,
    titulo: "En el juego en la red y volea...",
    campo: "q_volea",
    opciones: [
      { label: "Casi no subo a la red", value: "v1", peso: 0 },
      { label: "Subo pero cometo muchos errores no forzados", value: "v2", peso: 0.2 },
      { label: "Logro volear de derecha y revés con control", value: "v3", peso: 0.45 },
      { label: "Voleo con seguridad y busco rincones", value: "v4", peso: 0.7 },
      { label: "Voleo con gran potencia y definición", value: "v5", peso: 1.0 },
    ],
  },
  {
    id: 5,
    titulo: "En las paredes y rebotes...",
    campo: "q_rebotes",
    opciones: [
      { label: "Me cuesta leer el rebote, le pego antes", value: "r1", peso: 0 },
      { label: "Devuelvo la pared de fondo con dificultad", value: "r2", peso: 0.2 },
      { label: "Devuelvo pared de fondo bien, me cuesta la doble pared", value: "r3", peso: 0.45 },
      { label: "Manejo bien doble pared y bajadas de pared", value: "r4", peso: 0.7 },
      { label: "Hago bajadas de pared potentes de ataque", value: "r5", peso: 1.0 },
    ],
  },
  {
    id: 6,
    titulo: "¿En qué rango de edad te encuentras?",
    campo: "q_edad",
    opciones: [
      { label: "Entre 18 y 30 años", value: "18_30", edadNum: 24 },
      { label: "Entre 31 y 40 años", value: "31_40", edadNum: 35 },
      { label: "Entre 41 y 50 años", value: "41_50", edadNum: 45 },
      { label: "Más de 50 años", value: "mas50", edadNum: 55 },
    ],
  },
];

function calcularRatingInicial(respuestas) {
  let suma = 1.0;
  ONBOARDING_STEPS.forEach((step) => {
    if (step.campo === "q_edad") return;
    const op = step.opciones.find((o) => o.value === respuestas[step.campo]);
    if (op?.peso) suma += op.peso;
  });
  return parseFloat(Math.min(Math.max(suma, 1.0), 7.0).toFixed(2));
}

function categoriaDesdeRating(r) {
  const num = Number(r) || 1.0;
  if (num < 2.0) return "rookies";
  if (num < 3.0) return "7ma";
  if (num < 4.0) return "6ta";
  if (num < 4.8) return "5ta";
  if (num < 5.5) return "4ta";
  if (num < 6.2) return "3era";
  if (num < 7.0) return "2da";
  return "open";
}

function getInfoRating(ratingVal) {
  const r = Number(ratingVal) || 1.0;
  if (r < 2.0) return { catActual: "Rookies", nextCat: "7ma", floor: 1.0, ceiling: 2.0 };
  if (r < 3.0) return { catActual: "7ma", nextCat: "6ta", floor: 2.0, ceiling: 3.0 };
  if (r < 4.0) return { catActual: "6ta", nextCat: "5ta", floor: 3.0, ceiling: 4.0 };
  if (r < 4.8) return { catActual: "5ta", nextCat: "4ta", floor: 4.0, ceiling: 4.8 };
  if (r < 5.5) return { catActual: "4ta", nextCat: "3era", floor: 4.8, ceiling: 5.5 };
  if (r < 6.2) return { catActual: "3era", nextCat: "2da", floor: 5.5, ceiling: 6.2 };
  if (r < 7.0) return { catActual: "2da", nextCat: "Open", floor: 6.2, ceiling: 7.0 };
  return { catActual: "Open", nextCat: "MAX", floor: 7.0, ceiling: 8.0 };
}

function calcProgresoPorcentaje(ratingVal) {
  const r = Number(ratingVal) || 1.0;
  const info = getInfoRating(r);
  if (info.nextCat === "MAX") return 100;
  return Math.round(Math.min(Math.max(((r - info.floor) / (info.ceiling - info.floor)) * 100, 0), 100));
}

function getEtiquetaFiabilidad(f) {
  const v = Number(f) || 0;
  if (v < 35) return { texto: "Baja (Calibrando)", color: "text-amber-400" };
  if (v < 70) return { texto: "Media", color: "text-cyan-300" };
  return { texto: "Alta (Estable)", color: "text-emerald-400" };
}

function formatFechaCorta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 📈 TRACKER GRÁFICO (CON ZOOM, SCROLL CUSTOM Y COLORES)
function RatingTrackerChart({ partidosJugados, currentRating }) {
  const [filtro, setFiltro] = useState("10"); // "5" | "10" | "todos"
  const [pointSpacing, setPointSpacing] = useState(65); // Zoom dinámico (px entre puntos)
  const scrollRef = useRef(null);

  // 1. Reconstrucción total de historial
  const historialCompleto = useMemo(() => {
    if (!partidosJugados || partidosJugados.length === 0) {
      return [{ matchNum: 0, rating: currentRating, change: 0, label: "Inicio" }];
    }

    const cronologicos = [...partidosJugados].reverse();
    const deltas = cronologicos.map((m) => {
      const val = Number(m.rating_change);
      if (!isNaN(val) && val !== 0) return val;
      return m.esGanador ? 0.08 : -0.05;
    });

    const totalDeltas = deltas.reduce((sum, d) => sum + d, 0);
    let ratingInicial = Math.max(1.0, parseFloat((currentRating - totalDeltas).toFixed(2)));

    const puntos = [{ matchNum: 0, rating: ratingInicial, change: 0, label: "Inicio" }];

    let corriendo = ratingInicial;
    cronologicos.forEach((m, idx) => {
      const delta = deltas[idx];
      corriendo = Math.max(1.0, corriendo + delta);
      puntos.push({
        matchNum: idx + 1,
        rating: parseFloat(corriendo.toFixed(2)),
        change: delta,
        label: `Partido ${idx + 1}`,
        esGanador: m.esGanador,
      });
    });

    return puntos;
  }, [partidosJugados, currentRating]);

  // 2. Filtro visual
  const puntosFiltrados = useMemo(() => {
    if (filtro === "5") {
      return historialCompleto.length <= 6 ? historialCompleto : historialCompleto.slice(-6);
    }
    if (filtro === "10") {
      return historialCompleto.length <= 11 ? historialCompleto : historialCompleto.slice(-11);
    }
    return historialCompleto;
  }, [historialCompleto, filtro]);

  // Auto-scroll a la derecha cuando se dibuja, cambia el filtro o el usuario hace zoom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [puntosFiltrados, filtro, pointSpacing]);

  if (historialCompleto.length <= 1) {
    return (
      <div className="bg-[#0B1120] text-white p-5 rounded-3xl border border-slate-800 text-center space-y-2">
        <span className="text-xl block">📊</span>
        <h4 className="text-xs font-black uppercase tracking-widest text-[#00FF9D]">Gráfico de Nivel en Calibración</h4>
        <p className="text-[11px] text-slate-400 font-medium max-w-xs mx-auto">
          Juega partidos competitivos para visualizar tu curva de nivel en tiempo real.
        </p>
      </div>
    );
  }

  // Dimensiones del lienzo y límites
  const height = 150;
  const paddingY = 35;
  const paddingX = 35;
  const minWidth = 500;

  // Ancho dinámico basado en la cantidad de puntos y el espaciado (Zoom)
  const calculatedWidth = Math.max(minWidth, (puntosFiltrados.length - 1) * pointSpacing + paddingX * 2);
  const width = filtro === "todos" ? calculatedWidth : minWidth;

  const ratingsVals = puntosFiltrados.map((p) => p.rating);
  const minR = Math.min(...ratingsVals) - 0.15;
  const maxR = Math.max(...ratingsVals) + 0.15;

  const pointsFormatted = puntosFiltrados.map((pt, i) => {
    const x = paddingX + (i / (puntosFiltrados.length - 1 || 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((pt.rating - minR) / (maxR - minR || 1)) * (height - paddingY * 2);
    return { ...pt, x, y };
  });

  const pathD = pointsFormatted.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, "");

  const areaD = `${pathD} L ${pointsFormatted[pointsFormatted.length - 1].x},${height - 10} L ${pointsFormatted[0].x},${height - 10} Z`;
  const ultimoDelta = historialCompleto[historialCompleto.length - 1]?.change || 0;

  return (
    <div className="bg-[#0B1120] text-white p-5 sm:p-6 rounded-[2rem] shadow-xl border border-slate-800 space-y-4">
      
      {/* HEADER + CONTROLES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D] block">
            Tracker de Rendimiento
          </span>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 mt-0.5">
            <span>Evolución de Rating</span>
            <span className="text-xs font-bold text-slate-400">({historialCompleto.length - 1} partidos)</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          
          {/* BOTONES DE FILTRO */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-[10px] font-bold shrink-0">
            <button
              onClick={() => setFiltro("5")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filtro === "5" ? "bg-blue-600 text-white font-black shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              5 Últimos
            </button>
            <button
              onClick={() => setFiltro("10")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filtro === "10" ? "bg-blue-600 text-white font-black shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              10 Últimos
            </button>
            <button
              onClick={() => setFiltro("todos")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filtro === "todos" ? "bg-blue-600 text-white font-black shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              Todos
            </button>
          </div>

          {/* CONTROLES DE ZOOM (Solo visibles en "Todos") */}
          {filtro === "todos" && (
            <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center text-[10px] font-bold shrink-0">
              <button 
                onClick={() => setPointSpacing(p => Math.max(p - 15, 45))} 
                disabled={pointSpacing <= 45} 
                className="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Alejar (Zoom Out)"
              >
                ➖
              </button>
              <span className="text-slate-500 font-black uppercase px-1 cursor-default">Zoom</span>
              <button 
                onClick={() => setPointSpacing(p => Math.min(p + 15, 120))} 
                disabled={pointSpacing >= 120} 
                className="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Acercar (Zoom In)"
              >
                ➕
              </button>
            </div>
          )}

          {/* PASTILLA DEL ÚLTIMO RESULTADO */}
          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border shrink-0 ${
            ultimoDelta >= 0 ? "bg-[#00FF9D]/20 text-[#00FF9D] border-[#00FF9D]/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40"
          }`}>
            {ultimoDelta >= 0 ? `+${ultimoDelta.toFixed(2)} pts` : `${ultimoDelta.toFixed(2)} pts`}
          </span>
        </div>
      </div>

      {/* CANVAS SVG CON SCROLL CUSTOMIZADO */}
      <div 
        ref={scrollRef} 
        className="relative w-full overflow-x-auto pb-4 pt-1 
                   [&::-webkit-scrollbar]:h-2 
                   [&::-webkit-scrollbar-track]:bg-[#0B1120] 
                   [&::-webkit-scrollbar-track]:rounded-full 
                   [&::-webkit-scrollbar-thumb]:bg-slate-700 
                   [&::-webkit-scrollbar-thumb]:rounded-full 
                   hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 transition-colors"
      >
        <div style={{ width: `${width}px`, minWidth: "100%" }}>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="chartGradientGris" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#64748B" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#64748B" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Area de fondo en gris translúcido */}
            <path d={areaD} fill="url(#chartGradientGris)" />

            {/* Línea Principal Neutra en Gris Slate */}
            <path d={pathD} fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Nodos interactivos */}
            {pointsFormatted.map((pt, idx) => {
              const esInicio = pt.matchNum === 0;
              const esVictoria = pt.change >= 0;

              // Asignación de colores: Azul (Inicio), Verde (+), Rojo (-)
              const nodeColor = esInicio ? "#38BDF8" : esVictoria ? "#00FF9D" : "#FF4655";
              const strokeColor = esInicio ? "#0284C7" : esVictoria ? "#00CC7D" : "#E11D48";

              return (
                <g key={idx} className="group cursor-pointer">
                  {/* Punto */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill={nodeColor}
                    stroke={strokeColor}
                    strokeWidth="2.5"
                    className="transition-all group-hover:r-7"
                  />

                  {/* Rating principal (Arriba del punto) */}
                  <text
                    x={pt.x}
                    y={pt.y - 12}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="10"
                    fontWeight="900"
                    className="drop-shadow-sm"
                  >
                    {pt.rating.toFixed(2)}
                  </text>

                  {/* Delta / Cambio numérico (Debajo del punto, visible si no es inicio) */}
                  {!esInicio && (
                    <text
                      x={pt.x}
                      y={pt.y + 18}
                      textAnchor="middle"
                      fill={nodeColor}
                      fontSize="8"
                      fontWeight="900"
                    >
                      {pt.change >= 0 ? `+${pt.change.toFixed(2)}` : pt.change.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

    </div>
  );
}

export default function PadelPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [baseProfile, setBaseProfile] = useState(null);
  const [padelProfile, setPadelProfile] = useState(null);
  const [userCreditos, setUserCreditos] = useState(0);

  const [proximosPartidos, setProximosPartidos] = useState([]);
  const [partidosJugados, setPartidosJugados] = useState([]);
  const [limiteHistorial, setLimiteHistorial] = useState(3);

  const [posicionGlobal, setPosicionGlobal] = useState(null);
  const [posicionCiudad, setPosicionCiudad] = useState(null);

  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [modalSolicitudOpen, setModalSolicitudOpen] = useState(false);
  const [modalInfoOpen, setModalInfoOpen] = useState(false);
  const [mostrarNotaAdmin, setMostrarNotaAdmin] = useState(true);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingResp, setOnboardingResp] = useState({});
  const [ratingCalculado, setRatingCalculado] = useState(1.0);
  const [ratingAjuste, setRatingAjuste] = useState(0);

  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [formPerfil, setFormPerfil] = useState(DEFAULT_PROFILE);
  const [catSolicitada, setCatSolicitada] = useState("rookies");
  const [motivoSolicitud, setMotivoSolicitud] = useState("");

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    try {
      setLoading(true);
      setErrorMsg("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setErrorMsg("No hay sesión activa.");
        setLoading(false);
        return;
      }
      setUser(authUser);

      const [{ data: profileData }, { data: padelData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
        supabase.from("padel_profiles").select("*").eq("cuenta_id", authUser.id).maybeSingle(),
      ]);

      setBaseProfile(profileData || null);
      setUserCreditos(profileData?.creditos ?? 0);

      let finalPadel = padelData;

      if (!finalPadel) {
        const { data: created } = await supabase
          .from("padel_profiles")
          .upsert({ cuenta_id: authUser.id, ...DEFAULT_PROFILE }, { onConflict: "cuenta_id" })
          .select()
          .single();

        finalPadel = created;
      }

      const catReal = categoriaDesdeRating(finalPadel.rating);
      if (finalPadel.categoria_oficial !== catReal) {
        await supabase
          .from("padel_profiles")
          .update({ categoria_oficial: catReal })
          .eq("cuenta_id", authUser.id);
        finalPadel.categoria_oficial = catReal;
      }

      setPadelProfile(finalPadel);
      setFormPerfil({
        posicion: finalPadel.posicion || "drive",
        mano_habil: finalPadel.mano_habil || "derecha",
        genero: finalPadel.genero || "masculino",
        edad: finalPadel.edad || 25,
      });

      setCatSolicitada(finalPadel.categoria_solicitada || finalPadel.categoria_oficial || "rookies");
      setMotivoSolicitud(finalPadel.motivo_solicitud || "");

      if (!finalPadel.evaluacion_inicial_completada) {
        setOnboardingStep(0);
        setOnboardingResp({});
        setRatingAjuste(0);
        setOnboardingOpen(true);
      }

      const { data: todosPadel } = await supabase
        .from("padel_profiles")
        .select(`
          cuenta_id, rating,
          profiles:cuenta_id ( ciudad )
        `);

      if (todosPadel) {
        const rankingOrdenado = todosPadel
          .map((p) => ({
            cuenta_id: p.cuenta_id,
            rating: Number(p.rating) || 1.50,
            ciudad: p.profiles?.ciudad || "",
          }))
          .sort((a, b) => b.rating - a.rating);

        const pGlobal = rankingOrdenado.findIndex((p) => p.cuenta_id === authUser.id) + 1;
        setPosicionGlobal(pGlobal > 0 ? pGlobal : null);

        const miCiudad = profileData?.ciudad || "";
        if (miCiudad) {
          const rankingCiudad = rankingOrdenado.filter(
            (p) => p.ciudad?.toLowerCase() === miCiudad.toLowerCase()
          );
          const pCiudad = rankingCiudad.findIndex((p) => p.cuenta_id === authUser.id) + 1;
          setPosicionCiudad(pCiudad > 0 ? pCiudad : null);
        }
      }

      let myMatches = [];
      const { data: mData, error: mErr } = await supabase
        .from("padel_match_players")
        .select("match_id, team, rating_change")
        .eq("user_id", authUser.id);

      if (mErr) {
        const { data: mDataBasic } = await supabase
          .from("padel_match_players")
          .select("match_id, team")
          .eq("user_id", authUser.id);
        myMatches = mDataBasic || [];
      } else {
        myMatches = mData || [];
      }

      const matchIds = myMatches.map((m) => m.match_id).filter(Boolean);
      const userTeamMap = {};
      const userChangeMap = {};

      myMatches.forEach((m) => {
        userTeamMap[m.match_id] = m.team;
        userChangeMap[m.match_id] = m.rating_change || 0;
      });

      if (matchIds.length > 0) {
        const { data: allMatches } = await supabase
          .from("padel_matches")
          .select(`
            id, match_type, scheduled_at, status, category_restriction,
            gender_restriction, is_competitive, price_per_player, winner_team, score_text,
            club:padel_clubs ( name, city, address ),
            court:padel_courts ( name )
          `)
          .in("id", matchIds)
          .order("scheduled_at", { ascending: false });

        const { data: allPlayersData } = await supabase
          .from("padel_match_players")
          .select("id, match_id, user_id, team")
          .in("match_id", matchIds);

        const allUserIds = Array.from(new Set((allPlayersData || []).map((p) => p.user_id).filter(Boolean)));

        let profilesMap = {};
        let padelProfilesMap = {};

        if (allUserIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, nombre, avatar_url")
            .in("id", allUserIds);

          (profs || []).forEach((p) => { profilesMap[p.id] = p; });

          const { data: padelProfs } = await supabase
            .from("padel_profiles")
            .select("cuenta_id, rating")
            .in("cuenta_id", allUserIds);

          (padelProfs || []).forEach((pp) => { padelProfilesMap[pp.cuenta_id] = pp; });
        }

        const playersByMatch = {};
        (allPlayersData || []).forEach((p) => {
          if (!playersByMatch[p.match_id]) playersByMatch[p.match_id] = [];
          playersByMatch[p.match_id].push({
            ...p,
            profile: profilesMap[p.user_id] || null,
            padel_profile: padelProfilesMap[p.user_id] || null,
          });
        });

        const proximos = [];
        const jugados = [];

        (allMatches || []).forEach((m) => {
          const miEquipo = userTeamMap[m.id];
          const isJugado = m.status === "jugado" || m.status === "finalizado";
          const esGanador = isJugado && m.winner_team === miEquipo;
          const ratingChange = userChangeMap[m.id] || 0;

          const matchFormatted = {
            ...m,
            miEquipo,
            esGanador,
            rating_change: Number(ratingChange),
            players: playersByMatch[m.id] || [],
          };

          if (m.status === "programado") {
            proximos.push(matchFormatted);
          } else if (isJugado) {
            jugados.push(matchFormatted);
          }
        });

        setProximosPartidos(proximos);
        setPartidosJugados(jugados);
      } else {
        setProximosPartidos([]);
        setPartidosJugados([]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error cargando el perfil.");
    } finally {
      setLoading(false);
    }
  }

  async function borrarNotaAdmin() {
    setMostrarNotaAdmin(false);
    if (!user) return;
    try {
      await supabase
        .from("padel_profiles")
        .update({ categoria_comentario_admin: null })
        .eq("cuenta_id", user.id);
    } catch (e) { console.error(e); }
  }

  function seleccionarRespuesta(campo, value) { setOnboardingResp((prev) => ({ ...prev, [campo]: value })); }

  function avanzarOnboarding() {
    const stepActual = ONBOARDING_STEPS[onboardingStep];
    if (stepActual && !onboardingResp[stepActual.campo]) return;

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
      setSaving(true);
      const ratingFinal = parseFloat(Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2));
      const catOficial = categoriaDesdeRating(ratingFinal);
      const opEdad = ONBOARDING_STEPS[6].opciones.find((o) => o.value === onboardingResp.q_edad);
      const edadNum = opEdad?.edadNum || 25;

      const payload = {
        rating: ratingFinal,
        categoria_oficial: catOficial,
        categoria_solicitada: catOficial,
        estado_categoria: "aprobada",
        edad: edadNum,
        evaluacion_inicial_completada: true,
        fiabilidad: 20,
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("cuenta_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPadelProfile(data);
      setOnboardingOpen(false);
      setMensaje(`🎉 ¡Test completado! Tu nivel asignado es ${ratingFinal.toFixed(2)} (${NIVEL_LABELS[catOficial]?.label})`);
      await cargarPerfil();
    } catch (err) {
      console.error(err);
      alert("Error al guardar tu evaluación inicial.");
    } finally {
      setSaving(false);
    }
  }

  async function guardarDatosPerfil() {
    if (!user) return;
    try {
      setSaving(true);
      setErrorMsg("");

      const payload = {
        posicion: formPerfil.posicion,
        mano_habil: formPerfil.mano_habil,
        genero: formPerfil.genero,
        edad: Number(formPerfil.edad) || 25,
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("cuenta_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPadelProfile(data);
      setEditandoPerfil(false);
      setMensaje("✅ Ficha de jugador actualizada con éxito.");
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudieron guardar los datos.");
    } finally {
      setSaving(false);
    }
  }

  async function enviarSolicitudCategoria(e) {
    e.preventDefault();
    if (!user) return;

    if (padelProfile?.estado_categoria === "pendiente") {
      alert("Ya tienes una solicitud de categoría en revisión.");
      return;
    }

    if (!motivoSolicitud.trim()) {
      alert("Por favor explica brevemente el motivo de tu solicitud.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      const payload = {
        categoria_solicitada: catSolicitada,
        motivo_solicitud: motivoSolicitud.trim(),
        estado_categoria: "pendiente",
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("cuenta_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPadelProfile(data);
      setModalSolicitudOpen(false);
      setMensaje("⏳ Solicitud enviada correctamente. El administrador revisará tu caso.");
    } catch (err) {
      console.error(err);
      setErrorMsg("No se pudo enviar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  const estadisticas = useMemo(() => {
    const partidosLista = partidosJugados.length;
    const victoriasLista = partidosJugados.filter((m) => m.esGanador).length;
    const derrotasLista = Math.max(partidosLista - victoriasLista, 0);

    const vTotal = Math.max(victoriasLista, padelProfile?.victorias || 0);
    const dTotal = Math.max(derrotasLista, padelProfile?.derrotas || 0);
    const pTotal = Math.max(partidosLista, vTotal + dTotal);
    const pct = pTotal > 0 ? Math.round((vTotal / pTotal) * 100) : 0;

    return { partidos: pTotal, victorias: vTotal, derrotas: dTotal, porcentajeVictorias: pct };
  }, [partidosJugados, padelProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nombreStr = baseProfile?.nombre || user?.email?.split("@")[0] || "Jugador";
  const nombreCompleto = `${nombreStr} ${baseProfile?.apellido || ""}`.trim();
  const inicial = nombreStr.charAt(0).toUpperCase();

  const ratingActual = padelProfile?.rating || 1.50;
  const fiabilidadVal = padelProfile?.fiabilidad || 20;
  const infoRating = getInfoRating(ratingActual);
  const progresoPct = calcProgresoPorcentaje(ratingActual);
  const fiabilidadInfo = getEtiquetaFiabilidad(fiabilidadVal);

  const estadoCat = padelProfile?.estado_categoria || "pendiente";
  const catOficialKey = padelProfile?.categoria_oficial || categoriaDesdeRating(ratingActual);
  const catOficialLabel = LABELS.categoria[catOficialKey] || "Rookies";
  const tieneSolicitudPendiente = estadoCat === "pendiente";

  const TOTAL_STEPS = ONBOARDING_STEPS.length + 1;
  const stepActual = ONBOARDING_STEPS[onboardingStep] || null;
  const esPantallaRes = onboardingStep === ONBOARDING_STEPS.length;
  const respActual = stepActual ? onboardingResp[stepActual.campo] : null;
  const progresoBarPct = Math.round((onboardingStep / TOTAL_STEPS) * 100);
  const ratingConAjuste = parseFloat(Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2));
  const catResult = categoriaDesdeRating(ratingConAjuste);

  const jugadosVisibles = partidosJugados.slice(0, limiteHistorial);
  const hayMasHistorial = partidosJugados.length > limiteHistorial;

  return (
    <div className="min-h-screen bg-gray-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {mensaje && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex justify-between items-center shadow-sm">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje("")}>✕</button>
          </div>
        )}

        {padelProfile?.categoria_comentario_admin && mostrarNotaAdmin && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-900 shadow-sm flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-blue-500 font-black tracking-widest">Nota de la Administración:</span>
              <p className="font-semibold text-sm">"{padelProfile.categoria_comentario_admin}"</p>
            </div>
            <button onClick={borrarNotaAdmin} className="text-blue-500 hover:text-blue-800 text-sm font-black p-1 hover:bg-blue-100 rounded-lg transition-colors shrink-0">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* COLUMNA IZQUIERDA: CARTA JUGADOR */}
          <div className="lg:col-span-5 w-full flex flex-col items-center space-y-4">
            <div className="w-full bg-gradient-to-b from-[#0B0C2A] via-[#161848] to-[#0B0C2A] rounded-[2.5rem] p-6 md:p-8 text-white text-center shadow-xl border border-blue-500/20 relative overflow-hidden flex flex-col items-center justify-between min-h-[470px]">
              
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

              <button
                onClick={() => setEditandoPerfil(!editandoPerfil)}
                className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-all shadow-md active:scale-95"
                title="Editar Ficha de Jugador"
              >
                ⚙️
              </button>

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

              <div className="z-10 w-full flex flex-col items-center">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">{nombreCompleto}</h2>
                
                <div className="mt-2 flex flex-col items-center gap-1.5">
                  <span className="bg-blue-500/25 border border-blue-400/40 text-blue-300 text-xs md:text-sm font-black uppercase px-5 py-1 rounded-full shadow-md tracking-wider">
                    🎾 {catOficialLabel}
                  </span>

                  {(posicionCiudad || posicionGlobal) && (
                    <div className="flex items-center gap-2 mt-1 bg-white/10 backdrop-blur-md border border-white/10 px-3.5 py-1 rounded-full text-[11px] font-black shadow-sm">
                      {posicionCiudad && <span className="text-cyan-300">📍 #{posicionCiudad} {baseProfile?.ciudad || "Local"}</span>}
                      {posicionCiudad && posicionGlobal && <span className="text-white/30">•</span>}
                      {posicionGlobal && <span className="text-[#00FF9D]">🌐 #{posicionGlobal} Global</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 my-4 z-10 text-left">
                <div className="flex justify-between items-center mb-2 font-bold">
                  <span className="text-gray-300 text-xs md:text-sm">
                    Nivel: <strong className="text-cyan-300 text-base md:text-lg font-black">{ratingActual.toFixed(2)}</strong>
                  </span>
                  <span className="text-[#00FF9D] text-xs md:text-sm uppercase font-black tracking-wider">
                    PRÓX: {infoRating.nextCat} ({infoRating.ceiling.toFixed(2)})
                  </span>
                </div>

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

              <div className="w-full grid grid-cols-3 gap-2 pt-4 border-t border-white/10 text-center z-10">
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">VICTORIAS</p>
                  <p className="text-sm md:text-base font-black text-amber-300 truncate mt-0.5">{estadisticas.victorias} 🏆</p>
                </div>
                <div className="border-x border-white/10">
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">POSICIÓN</p>
                  <p className="text-sm md:text-base font-black text-cyan-300 mt-0.5">{LABELS.posicion[padelProfile?.posicion] || "Drive"}</p>
                </div>
                <div>
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest">MANO</p>
                  <p className="text-sm md:text-base font-black text-emerald-300 mt-0.5">{LABELS.mano_habil[padelProfile?.mano_habil] || "Derecha"}</p>
                </div>
              </div>

            </div>

            <button
              onClick={() => setModalInfoOpen(true)}
              className="mt-2 text-xs md:text-sm font-extrabold text-slate-500 hover:text-blue-600 flex items-center gap-2 transition-colors py-2 px-3 rounded-full hover:bg-slate-100"
            >
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">ℹ️</span>
              <span>¿Cómo funciona el nivel y los ascensos?</span>
            </button>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="lg:col-span-7 space-y-6">

            {editandoPerfil ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Editar Datos de Pista</h3>
                  <button onClick={() => setEditandoPerfil(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xs">✕ Cerrar</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                  <div>
                    <label className="block mb-1 text-[10px] uppercase text-slate-400">Mano Hábil</label>
                    <select value={formPerfil.mano_habil} onChange={(e) => setFormPerfil({ ...formPerfil, mano_habil: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 outline-none">
                      <option value="derecha">Derecha</option>
                      <option value="izquierda">Izquierda</option>
                      <option value="ambidiestro">Ambidiestro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-[10px] uppercase text-slate-400">Posición en Pista</label>
                    <select value={formPerfil.posicion} onChange={(e) => setFormPerfil({ ...formPerfil, posicion: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 outline-none">
                      <option value="drive">Drive (Lado Derecho)</option>
                      <option value="reves">Revés (Lado Izquierdo)</option>
                      <option value="ambos">Ambos Lados</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button onClick={guardarDatosPerfil} disabled={saving} className="flex-1 rounded-2xl bg-blue-600 py-3 text-xs font-bold text-white">
                    {saving ? "Guardando..." : "Guardar Ficha"}
                  </button>
                  <button onClick={() => setEditandoPerfil(false)} className="px-5 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">

                {/* 📈 COMPONENTE REORGANIZADO: TRACKER DE GRÁFICA DE LEVEL */}
                <RatingTrackerChart
                  partidosJugados={partidosJugados}
                  currentRating={ratingActual}
                />

                {/* TABLERO PRINCIPAL DE ESTADÍSTICAS */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-2xl font-black text-slate-900">{nombreCompleto}</h1>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        JUGADOR DE PÁDEL • LEVEL {ratingActual.toFixed(2)} ({catOficialLabel.toUpperCase()})
                      </p>
                    </div>

                    <Link href="/padel/ranking" className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all shrink-0 flex items-center justify-center gap-1.5 self-start sm:self-auto">
                      <span>🏆</span>
                      <span>Ver Tabla de Ranking →</span>
                    </Link>
                  </div>

                  <div className="bg-slate-50/80 border border-slate-200/80 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                        Estado de Categoría
                      </span>
                      <p className="text-base font-black text-slate-900">
                        {LABELS.estado_categoria[estadoCat] || "En revisión"}
                      </p>
                    </div>

                    {!tieneSolicitudPendiente && (
                      <button onClick={() => setModalSolicitudOpen(true)} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-sm">
                        🎾 Solicitar cambio de categoría
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                        PUESTO EN {baseProfile?.ciudad?.toUpperCase() || "BARQUISIMETO"}
                      </p>
                      <p className="text-2xl font-black text-blue-600 mt-2">
                        {posicionCiudad ? `#${posicionCiudad}` : "—"}
                      </p>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PUESTO GLOBAL</p>
                      <p className="text-2xl font-black text-emerald-600 mt-2">
                        {posicionGlobal ? `#${posicionGlobal}` : "—"}
                      </p>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">RATING</p>
                      <p className="text-2xl font-black text-cyan-600 mt-2">{ratingActual.toFixed(2)}</p>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PARTIDOS JUGADOS</p>
                      <p className="text-2xl font-black text-slate-900 mt-2">{estadisticas.partidos}</p>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">VICTORIAS TOTALES</p>
                      <p className="text-2xl font-black text-slate-900 mt-2 flex items-center gap-1">
                        {estadisticas.victorias} <span className="text-lg">🏆</span>
                      </p>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">% VICTORIAS</p>
                      <p className="text-2xl font-black text-emerald-600 mt-2">{estadisticas.porcentajeVictorias}%</p>
                    </div>
                  </div>

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
                      <p className="text-sm font-black text-slate-900">{LABELS.posicion[padelProfile?.posicion] || "Drive"}</p>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* 🎾 PRÓXIMOS PARTIDOS */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <span>📅</span>
                  <span>Próximos Partidos</span>
                </h2>
                <span className="text-xs font-bold text-slate-400 bg-slate-200/60 px-3 py-1 rounded-full">
                  {proximosPartidos.length} agendados
                </span>
              </div>

              {proximosPartidos.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-dashed border-slate-200 shadow-xs space-y-3">
                  <span className="text-4xl block">🎾</span>
                  <h3 className="text-base font-black text-slate-800">No tienes próximos partidos programados</h3>
                  <p className="text-xs font-semibold text-slate-400 max-w-sm mx-auto">
                    Reserva una pista en tu club favorito o únete a un partido abierto de la comunidad.
                  </p>
                  <Link href="/padel/clubes" className="inline-flex items-center gap-2 px-5 py-3 bg-[#0B1120] hover:bg-slate-900 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-2xl shadow-md active:scale-95">
                    <span>🔍 BUSCAR PISTAS Y CLUBES</span>
                    <span>→</span>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proximosPartidos.map((match) => (
                    <PartidoPadelCard key={match.id} match={match} currentUser={user} userCreditos={userCreditos} onUpdate={cargarPerfil} />
                  ))}
                </div>
              )}
            </div>

            {/* 🏆 ACTIVIDAD RECIENTE */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Actividad Reciente</h2>
                  <p className="text-xs text-slate-400 font-bold">Tus últimos partidos jugados y variación de nivel</p>
                </div>
              </div>

              {partidosJugados.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-500">Aún no has jugado tu primer partido oficial de pádel.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jugadosVisibles.map((match) => {
                    const esVictoria = match.esGanador;
                    const change = match.rating_change || 0;

                    return (
                      <div
                        key={match.id}
                        className={`bg-[#0B1120] text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-slate-800 transition-all flex items-center justify-between gap-4 border-l-[6px] ${
                          esVictoria ? "border-l-[#00FF9D]" : "border-l-rose-500"
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              FINALIZADO
                            </span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                esVictoria
                                  ? "bg-[#00FF9D]/20 text-[#00FF9D] border border-[#00FF9D]/30"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {esVictoria ? "VICTORIA 🏆" : "DERROTA"}
                            </span>

                            {change !== 0 && (
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                change > 0
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                              }`}>
                                {change > 0 ? `+${change.toFixed(2)} pts` : `${change.toFixed(2)} pts`}
                              </span>
                            )}
                          </div>

                          <h3 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                            {match.club?.name || "Club de Pádel"}
                          </h3>

                          <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 truncate">
                            <span>📍 {match.court?.name || "Pista Central"}</span>
                            <span>•</span>
                            <span>{formatFechaCorta(match.scheduled_at)}</span>
                          </p>
                        </div>

                        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 text-center shrink-0 shadow-inner">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
                            Marcador
                          </span>
                          <span className="text-base sm:text-lg font-black text-white tracking-wider block">
                            {match.score_text || "6-4, 6-3"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {hayMasHistorial && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => setLimiteHistorial((prev) => prev + 3)}
                        className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all active:scale-95"
                      >
                        👇 Cargar anteriores ({partidosJugados.length - limiteHistorial} restantes)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {onboardingOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0B1120]/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-[2.5rem] bg-[#EEF0F5] p-6 shadow-2xl flex flex-col overflow-hidden space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-blue-600">Nivelación Inicial</span>
              <span className="text-xs font-bold text-gray-400">
                {esPantallaRes ? "Resultado" : `Pregunta ${onboardingStep + 1} de ${ONBOARDING_STEPS.length}`}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progresoBarPct}%` }} />
            </div>

            {esPantallaRes ? (
              <div className="flex flex-col gap-4 pt-2">
                <div className="rounded-3xl bg-[#0B1120] text-white p-6 text-center shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Tu Rating Asignado</p>
                  <p className="text-5xl font-black text-cyan-300 my-2">{ratingConAjuste.toFixed(2)}</p>
                  <span className="inline-block rounded-full bg-blue-500/30 border border-blue-400/30 px-4 py-1 text-xs font-black text-blue-300 uppercase tracking-wider">
                    🎾 {NIVEL_LABELS[catResult]?.label}
                  </span>
                </div>

                <button onClick={guardarOnboarding} disabled={saving} className="w-full rounded-2xl bg-blue-600 py-3.5 text-xs font-black uppercase tracking-wider text-white">
                  {saving ? "Guardando..." : "Confirmar y Comenzar 🎾"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-1">
                <h2 className="text-sm font-black text-slate-900 leading-snug">{stepActual?.titulo}</h2>

                <div className="flex flex-col gap-2">
                  {stepActual?.opciones.map((op) => (
                    <button key={op.value} onClick={() => seleccionarRespuesta(stepActual.campo, op.value)} className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${respActual === op.value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-800"}`}>
                      <span className="block text-xs font-black">{op.label}</span>
                    </button>
                  ))}
                </div>

                <button onClick={avanzarOnboarding} className="w-full rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider mt-2 bg-slate-900 text-white">
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {modalSolicitudOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setModalSolicitudOpen(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Solicitar Cambio de Categoría</h3>
              <button onClick={() => setModalSolicitudOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={enviarSolicitudCategoria} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Nueva Categoría Deseada</label>
                <select value={catSolicitada} onChange={(e) => setCatSolicitada(e.target.value)} className="w-full bg-slate-50 border p-2.5 rounded-xl font-bold">
                  {TODAS_CATEGORIAS.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Motivo</label>
                <textarea rows={4} required placeholder="Explica brevemente tu motivo..." value={motivoSolicitud} onChange={(e) => setMotivoSolicitud(e.target.value)} className="w-full bg-slate-50 border p-2.5 rounded-xl font-bold" />
              </div>

              <button type="submit" disabled={saving} className="w-full py-3.5 bg-blue-600 text-white font-black rounded-2xl text-xs uppercase">
                {saving ? "Enviando..." : "Enviar a Revisión"}
              </button>
            </form>
          </div>
        </div>
      )}

      {modalInfoOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setModalInfoOpen(false)}>
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-4">
              <h3 className="text-xl font-black text-slate-900">¿Cómo funciona el Nivel?</h3>
              <button onClick={() => setModalInfoOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <p className="text-xs text-slate-600">Tu nivel se ajusta automáticamente analizando tus resultados, diferencia de juegos, nivel del adversario y nivel de calibración de fiabilidad.</p>
            <button onClick={() => setModalInfoOpen(false)} className="w-full py-3 bg-slate-900 text-white font-black rounded-2xl text-xs uppercase">Entendido</button>
          </div>
        </div>
      )}

    </div>
  );
}