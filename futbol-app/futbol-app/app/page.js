"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

// ==========================================
// PREGUNTAS Y CÁLCULOS DE NIVELACIÓN INICIAL
// ==========================================
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
  if (r < 2.0) return "rookies";
  if (r < 3.0) return "7ma";
  if (r < 4.0) return "6ta";
  if (r < 4.5) return "5ta";
  if (r < 5.0) return "4ta";
  if (r < 6.0) return "3era";
  return "open";
}

export default function HubHome() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Estados del Modal de Nivelación
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingResp, setOnboardingResp] = useState({});
  const [ratingCalculado, setRatingCalculado] = useState(1.0);
  const [ratingAjuste, setRatingAjuste] = useState(0);
  const [guardandoOnboarding, setGuardandoOnboarding] = useState(false);

  useEffect(() => {
    chequearSesionYNivel();
  }, []);

  async function chequearSesionYNivel() {
    try {
      setCargando(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUsuario(user);

      if (user) {
        // Consultar o crear perfil de pádel
        let { data: pProfile } = await supabase
          .from("padel_profiles")
          .select("*")
          .eq("cuenta_id", user.id)
          .maybeSingle();

        if (!pProfile) {
          const { data: created } = await supabase
            .from("padel_profiles")
            .upsert({
              cuenta_id: user.id,
              categoria_solicitada: "rookies",
              categoria_oficial: "rookies",
              estado_categoria: "aprobada",
              rating: 1.50,
              fiabilidad: 20,
              evaluacion_inicial_completada: false,
            }, { onConflict: "cuenta_id" })
            .select()
            .single();

          pProfile = created;
        }

        // Si NO ha completado la evaluación inicial, abrir el cuestionario automáticamente
        if (pProfile && !pProfile.evaluacion_inicial_completada) {
          setOnboardingStep(0);
          setOnboardingResp({});
          setRatingAjuste(0);
          setOnboardingOpen(true);
        }
      }
    } catch (error) {
      console.error("Error al verificar perfil de pádel:", error);
    } finally {
      setCargando(false);
    }
  }

  // Avanzar o responder en el test
  function seleccionarRespuesta(campo, value) {
    setOnboardingResp((prev) => ({ ...prev, [campo]: value }));
  }

  function avanzarOnboarding() {
    const stepActual = ONBOARDING_STEPS[onboardingStep];
    if (stepActual && !onboardingResp[stepActual.campo]) return;

    if (onboardingStep === ONBOARDING_STEPS.length - 1) {
      const rating = calcularRatingInicial(onboardingResp);
      setRatingCalculado(rating);
      setRatingAjuste(0);
      setOnboardingStep(ONBOARDING_STEPS.length); // Muestra pantalla de resultado final
      return;
    }

    setOnboardingStep((s) => s + 1);
  }

  async function guardarOnboarding() {
    if (!usuario) return;

    try {
      setGuardandoOnboarding(true);

      const ratingFinal = parseFloat(
        Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2)
      );

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

      const { error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("cuenta_id", usuario.id);

      if (error) throw error;

      setOnboardingOpen(false);
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la evaluación inicial.");
    } finally {
      setGuardandoOnboarding(false);
    }
  }

  const TOTAL_STEPS = ONBOARDING_STEPS.length + 1;
  const stepActualObj = ONBOARDING_STEPS[onboardingStep] || null;
  const esPantallaRes = onboardingStep === ONBOARDING_STEPS.length;
  const respActualVal = stepActualObj ? onboardingResp[stepActualObj.campo] : null;
  const progresoBarPct = Math.round((onboardingStep / TOTAL_STEPS) * 100);
  const ratingConAjuste = parseFloat(
    Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2)
  );
  const catResultKey = categoriaDesdeRating(ratingConAjuste);

  return (
    <main className="min-h-[90vh] bg-gray-50 flex flex-col items-center justify-center px-4 py-12 relative">
      
      {/* Animación suave */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>

      {/* Título principal */}
      <div className="text-center max-w-2xl mb-10 animate-slide-up">
        <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4 tracking-tight">
          Elige tu <span className="text-blue-600">Deporte</span>
        </h1>
        <p className="text-lg text-gray-500">
          Fútbol, Pádel y mucho más. Una sola cuenta para dominar la cancha.
        </p>
      </div>

      {/* Botones de sesión / registro */}
      {!cargando && !usuario && (
        <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-2xl bg-white text-gray-900 border border-gray-200 text-sm font-bold hover:bg-gray-50 hover:shadow-md transition-all active:scale-[0.98] text-center"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login?modo=registro"
            className="px-8 py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] text-center"
          >
            Crear cuenta gratis
          </Link>
        </div>
      )}

      {/* Tarjetas de deportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full animate-slide-up" style={{ animationDelay: '0.2s' }}>
        
        {/* Tarjeta Fútbol */}
        <Link
          href="/futbol"
          className="group relative h-[350px] overflow-hidden rounded-[2rem] shadow-xl shadow-gray-200/50 cursor-pointer transform hover:-translate-y-2 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-900"></div>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:opacity-60 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          
          <div className="relative p-8 flex flex-col justify-end h-full">
            <div className="mb-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider border border-white/20">
                ⚽ Fútbol
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-2">Pisa la cancha</h2>
              <p className="text-green-50 font-medium text-sm max-w-sm mb-4">
                Organiza partidos, lleva tus estadísticas y mejora tu carta de jugador.
              </p>
              <div className="flex items-center text-green-400 font-bold text-sm group-hover:translate-x-2 transition-transform">
                Entrar al lobby →
              </div>
            </div>
          </div>
        </Link>

        {/* Tarjeta Pádel */}
        <Link
          href="/padel/partidos"
          className="group relative h-[350px] overflow-hidden rounded-[2rem] shadow-xl shadow-gray-200/50 cursor-pointer transform hover:-translate-y-2 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-900"></div>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:opacity-60 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          
          <div className="relative p-8 flex flex-col justify-end h-full">
            <div className="mb-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider border border-white/20">
                🎾 Pádel
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-2">Domina la red</h2>
              <p className="text-blue-50 font-medium text-sm max-w-sm mb-4">
                Mide tu nivel, encuentra pareja y reserva pistas fácilmente.
              </p>
              <div className="flex items-center text-blue-400 font-bold text-sm group-hover:translate-x-2 transition-transform">
                Entrar al club →
              </div>
            </div>
          </div>
        </Link>

      </div>

      {/* ==================================================== */}
      {/* 🔥 MODAL OBLIGATORIO DE NIVELACIÓN AL ENTRAR         */}
      {/* ==================================================== */}
      {onboardingOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0B1120]/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-[2.5rem] bg-[#EEF0F5] p-6 shadow-2xl flex flex-col overflow-hidden space-y-4">
            
            {/* Header del Test */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-blue-600">
                Nivelación Inicial · Pádel
              </span>
              <span className="text-xs font-bold text-gray-400">
                {esPantallaRes ? "Resultado" : `Pregunta ${onboardingStep + 1} de ${ONBOARDING_STEPS.length}`}
              </span>
            </div>

            {/* Barra de Progreso */}
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progresoBarPct}%` }}
              />
            </div>

            {/* Contenido según paso */}
            {esPantallaRes ? (
              <div className="flex flex-col gap-4 pt-2">
                <div className="rounded-3xl bg-[#0B1120] text-white p-6 text-center shadow-lg">
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Tu Rating Calculado</p>
                  <p className="text-5xl font-black text-cyan-300 my-2">
                    {ratingConAjuste.toFixed(2)}
                  </p>
                  <span className="inline-block rounded-full bg-blue-500/30 border border-blue-400/30 px-4 py-1 text-xs font-black text-blue-300 uppercase tracking-wider">
                    🎾 {NIVEL_LABELS[catResultKey]?.label}
                  </span>
                  <p className="text-xs text-gray-300 mt-3 leading-relaxed font-medium">
                    {NIVEL_LABELS[catResultKey]?.desc}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
                  <p className="text-xs font-bold text-slate-700 mb-1">¿Sientes que este nivel refleja tu juego?</p>
                  <p className="text-[11px] text-slate-400 mb-3">Puedes ajustar levemente tu nivel (máx ±0.3):</p>
                  
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => setRatingAjuste((a) => parseFloat(Math.max(a - 0.1, -0.3).toFixed(1)))}
                      disabled={ratingAjuste <= -0.3}
                      className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-lg font-black text-slate-800 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="text-xs font-black text-slate-900">
                      {ratingAjuste === 0 ? "Sin ajuste" : ratingAjuste > 0 ? `+${ratingAjuste.toFixed(1)}` : ratingAjuste.toFixed(1)}
                    </span>
                    <button
                      onClick={() => setRatingAjuste((a) => parseFloat(Math.min(a + 0.1, 0.3).toFixed(1)))}
                      disabled={ratingAjuste >= 0.3}
                      className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-lg font-black text-slate-800 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={guardarOnboarding}
                  disabled={guardandoOnboarding}
                  className="w-full rounded-2xl bg-blue-600 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-blue-700 shadow-md transition-all"
                >
                  {guardandoOnboarding ? "Guardando..." : "Confirmar y Entrar 🎾"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pt-1">
                <h2 className="text-sm font-black text-slate-900 leading-snug">{stepActualObj?.titulo}</h2>

                <div className="flex flex-col gap-2">
                  {stepActualObj?.opciones.map((op) => (
                    <button
                      key={op.value}
                      onClick={() => seleccionarRespuesta(stepActualObj.campo, op.value)}
                      className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                        respActualVal === op.value
                          ? "border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <span className="block text-xs font-black">{op.label}</span>
                      {op.cats && (
                        <span className={`block text-[10px] mt-0.5 font-bold ${
                          respActualVal === op.value ? "text-blue-100" : "text-slate-400"
                        }`}>
                          {op.cats}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={avanzarOnboarding}
                  disabled={!respActualVal}
                  className={`w-full rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider mt-2 transition-all ${
                    !respActualVal
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-800 shadow-md"
                  }`}
                >
                  Siguiente →
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </main>
  );
}