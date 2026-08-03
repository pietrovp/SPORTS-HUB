"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

// Categorías ordenadas
const CATEGORIAS_ORDENADAS = [
  { value: "rookies", label: "Rookies" },
  { value: "7ma", label: "7ma Categoría" },
  { value: "6ta", label: "6ta Categoría" },
  { value: "5ta", label: "5ta Categoría" },
  { value: "4ta", label: "4ta Categoría" },
  { value: "3era", label: "3era Categoría" },
  { value: "2da", label: "2da Categoría" },
  { value: "open", label: "Open" },
];

const PREFERENCIA_GENERO = [
  { value: "todos", label: "🌐 Todos" },
  { value: "masculino", label: "👨 Masculino" },
  { value: "femenino", label: "👩 Femenino" },
  { value: "mixto", label: "👫 Mixto" },
];

// 🧠 Cálculo automático del Rango Competitivo
function getRangoCompetitivoAutomático(userCatValue) {
  const idx = CATEGORIAS_ORDENADAS.findIndex((c) => c.value === userCatValue);
  const safeIdx = idx === -1 ? 0 : idx;
  const minIdx = Math.max(0, safeIdx - 1);
  const maxIdx = Math.min(CATEGORIAS_ORDENADAS.length - 1, safeIdx + 1);
  const permitidas = CATEGORIAS_ORDENADAS.slice(minIdx, maxIdx + 1);

  return {
    min: CATEGORIAS_ORDENADAS[minIdx],
    actual: CATEGORIAS_ORDENADAS[safeIdx],
    max: CATEGORIAS_ORDENADAS[maxIdx],
    permitidas,
    etiquetaRango: permitidas.map((c) => c.label).join(" • "),
    etiquetaCorta: permitidas.map((c) => c.value).join(" • "),
  };
}

// 🧠 Función para generar horarios dinámicos según el club
function generarHorariosClub(openTime, closeTime, durationMin) {
  const horarios = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  
  let currentMin = (openH * 60) + openM;
  const endMin = (closeH * 60) + closeM;

  while (currentMin + durationMin <= endMin) {
    const h = Math.floor(currentMin / 60);
    const m = currentMin % 60;
    
    const isPM = h >= 12;
    const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const ampm = isPM ? "PM" : "AM";
    
    const timeStr = `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
    const precio = (h >= 17 && h < 21) ? 25.00 : 15.00; // Lógica básica de precio
    
    horarios.push({ timeStr, precio });
    currentMin += durationMin;
  }
  
  return horarios;
}

export default function ClubDetallePage() {
  const params = useParams();
  const router = useRouter();
  const clubParam = params?.id;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userCategoria, setUserCategoria] = useState("rookies");

  const [club, setClub] = useState(null);
  const [pistas, setPistas] = useState([]);
  const [partidosFecha, setPartidosFecha] = useState([]);
  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [pistasColapsadas, setPistasColapsadas] = useState({});

  const [fechaSeleccionada, setFiltroFecha] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Modal Reserva
  const [modalReservaOpen, setModalReservaOpen] = useState(false);
  const [pasoModal, setPasoModal] = useState(1); 
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  // Formulario y Pagos
  const [modoPago, setModoPago] = useState("cuota");
  const [tipoJuego, setTipoJuego] = useState("competitivo");
  const [catMaximaAmistoso, setCatMaximaAmistoso] = useState("open");
  const [prefGenero, setPrefGenero] = useState("todos");
  const [metodoPagoElegido, setMetodoPagoElegido] = useState("efectivo"); 
  const [referenciaPago, setReferenciaPago] = useState(""); // NUEVO ESTADO PARA LA REFERENCIA
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorReserva, setErrorReserva] = useState("");

  // NEGOCIO Y TASAS
  const TASA_COMISION = 0.10; // 10%
  const [tasaBcv, setTasaBcv] = useState(0);

  useEffect(() => {
    if (clubParam) cargarClubYHorarios();
  }, [clubParam, fechaSeleccionada]);

  useEffect(() => {
    if (modoPago === "completa") setTipoJuego("amistoso");
  }, [modoPago]);

  function toggleColapsarPista(pistaId) {
    setPistasColapsadas((prev) => ({ ...prev, [pistaId]: !prev[pistaId] }));
  }

  async function cargarClubYHorarios() {
    try {
      setLoading(true);
      setErrorReserva("");

      // 0. Obtener tasa BCV
      try {
        const resBcv = await fetch("/api/futbol/bcv-rate");
        if (resBcv.ok) {
          const dataBcv = await resBcv.json();
          if (dataBcv.usdRate) setTasaBcv(dataBcv.usdRate);
        }
      } catch (errBcv) {
        console.error("Error obteniendo tasa BCV:", errBcv);
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        const { data: pProfile } = await supabase
          .from("padel_profiles")
          .select("categoria_oficial")
          .eq("cuenta_id", authUser.id)
          .maybeSingle();
        setUserCategoria(pProfile?.categoria_oficial || "rookies");
      }

      // 1. Datos del Club
      let targetClub = null;
      const { data: clubBySlug } = await supabase.from("padel_clubs").select("*").eq("slug", clubParam).maybeSingle();

      if (clubBySlug) {
        targetClub = clubBySlug;
      } else {
        const { data: clubById } = await supabase.from("padel_clubs").select("*").eq("id", clubParam).maybeSingle();
        targetClub = clubById;
      }

      if (!targetClub) throw new Error("No se encontró el club.");
      setClub(targetClub);

      // 2. Horarios Dinámicos
      const duration = targetClub.slot_duration_minutes || 60;
      const openTime = targetClub.open_time || '07:00:00';
      const closeTime = targetClub.close_time || '23:00:00';
      setHorariosDisponibles(generarHorariosClub(openTime, closeTime, duration));

      // 3. Canchas
      let { data: courtsData } = await supabase
        .from("padel_courts")
        .select("*")
        .eq("club_id", targetClub.id)
        .eq("is_active", true)
        .order('court_number', { ascending: true });
      setPistas(courtsData || []);

      // 4. Partidos programados
      const inicioDia = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
      const finDia = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();
      const { data: matches } = await supabase
        .from("padel_matches")
        .select(`
          id, court_id, scheduled_at, status, is_private, match_type, price_per_player, category_restriction, is_competitive,
          players:padel_match_players ( user_id, team )
        `)
        .eq("club_id", targetClub.id)
        .neq("status", "cancelado")
        .gte("scheduled_at", inicioDia)
        .lte("scheduled_at", finDia);

      setPartidosFecha(matches || []);
    } catch (err) {
      console.error("Error cargando club:", err);
    } finally {
      setLoading(false);
    }
  }

  const diasCarrusel = useMemo(() => {
    const dias = [];
    const hoy = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(hoy.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const diaNum = d.getDate();
      const mesNombre = d.toLocaleDateString("es-ES", { month: "short" }).toUpperCase();
      const diaNombre = i === 0 ? "HOY" : i === 1 ? "MAÑANA" : d.toLocaleDateString("es-ES", { weekday: "short" }).substring(0,3).toUpperCase();
      dias.push({ iso, diaNum, mesNombre, diaNombre });
    }
    return dias;
  }, []);

  function abrirModalReserva(court, slot) {
    if (!user) {
      router.push("/login");
      return;
    }
    
    const precioClub = slot.precio;
    const comisionApp = precioClub * TASA_COMISION;
    const precioTotal = precioClub + comisionApp;

    setSlotSeleccionado({ 
      court, 
      hora: slot.timeStr, 
      precioClub,
      comisionApp,
      precioTotal
    });
    
    setModoPago("cuota");
    setTipoJuego("competitivo");
    setMetodoPagoElegido("efectivo");
    setReferenciaPago("");
    setPasoModal(1);
    setErrorReserva("");
    setModalReservaOpen(true);
  }

  const rangoCompetitivo = useMemo(() => getRangoCompetitivoAutomático(userCategoria), [userCategoria]);

  // VALIDACIÓN DE PAGO
  const puedePagar = metodoPagoElegido === "efectivo" || (referenciaPago.trim().length > 3);

  // PROCESAR RESERVA
  async function confirmarCreacionPartido() {
    if (!user || !slotSeleccionado || !club) return;
    if (!puedePagar) {
      setErrorReserva("Por favor ingresa el número de referencia del pago.");
      return;
    }

    const esPrivado = modoPago === "completa";
    
    try {
      setProcesandoPago(true);
      setErrorReserva("");

      const isPM = slotSeleccionado.hora.includes("PM");
      let [h, m] = slotSeleccionado.hora.split(" ")[0].split(":");
      let horasNumericas = parseInt(h, 10);
      if (isPM && horasNumericas !== 12) horasNumericas += 12;
      if (!isPM && horasNumericas === 12) horasNumericas = 0;
      const horaReal24 = `${horasNumericas.toString().padStart(2, "0")}:${m}:00`;

      const matchTimestamp = `${fechaSeleccionada}T${horaReal24}`;

      const restriccionCategoriaFinal = esPrivado
        ? "Libre"
        : tipoJuego === "competitivo"
        ? rangoCompetitivo.etiquetaCorta
        : catMaximaAmistoso;

      const { data: nuevoPartido, error: matchError } = await supabase
        .from("padel_matches")
        .insert({
          club_id: club.id,
          court_id: slotSeleccionado.court.id,
          scheduled_at: new Date(matchTimestamp).toISOString(),
          status: metodoPagoElegido === "efectivo" ? "programado" : "pendiente_verificacion",
          is_private: esPrivado,
          match_type: esPrivado ? "privado" : "abierto",
          category_restriction: restriccionCategoriaFinal,
          gender_restriction: prefGenero,
          is_competitive: !esPrivado && tipoJuego === "competitivo",
          price_per_player: (slotSeleccionado.precioTotal / 4),
          total_price: slotSeleccionado.precioTotal,
          created_by: user.id
        })
        .select()
        .single();

      if (matchError) throw new Error(matchError.message);

      // Inscribimos al jugador Y guardamos su método de pago y referencia
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: nuevoPartido.id,
        user_id: user.id,
        team: "A",
        payment_method: metodoPagoElegido,
        payment_reference: metodoPagoElegido === "efectivo" ? "En Taquilla" : referenciaPago
      });

      if (playerErr) throw new Error(playerErr.message);

      setModalReservaOpen(false);
      router.push(`/padel/partidos`);
    } catch (err) {
      console.error("Error al reservar:", err);
      setErrorReserva(`Error de BD: ${err.message}`);
    } finally {
      setProcesandoPago(false);
    }
  }

  // UNIRSE A PARTIDO
  async function unirseAPartido(match) {
    if (!user) return router.push("/login");

    const inscritos = match.players?.length || 0;
    if (inscritos >= 4) return alert("Este partido ya está lleno (4/4).");
    if (match.players?.some((p) => p.user_id === user.id)) return alert("Ya estás inscrito.");

    try {
      setLoading(true);

      const teamAsignado = match.players?.filter((p) => p.team === "A").length < 2 ? "A" : "B";
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: user.id,
        team: teamAsignado
      });

      if (playerErr) throw playerErr;
      router.push("/padel/partidos");
    } catch (error) {
      console.error("Error uniéndose:", error);
      alert(`No se pudo completar la inscripción: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const imagenClubFallback = "https://images.unsplash.com/photo-1626248801379-51a0748a5f96?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 pb-36">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* 🏟️ HEADER DEL CLUB */}
        <div className="relative bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm overflow-hidden min-h-[140px] flex items-center">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img src={club?.image_url || club?.banner_url || imagenClubFallback} alt={club?.name} className="w-full h-full object-cover object-right opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
          </div>
          <div className="relative z-10 space-y-1.5 max-w-sm sm:max-w-md">
            <Link href="/padel/clubes" className="text-xs font-black uppercase tracking-widest text-blue-600 hover:underline inline-block">← Volver a Clubes</Link>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">{club?.name || "Club de Pádel"}</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-bold flex items-center gap-1">📍 {club?.address || club?.city}</p>
          </div>
        </div>

        {/* CARRUSEL HORIZONTAL DE DÍAS */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-1">Selecciona el día</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {diasCarrusel.map((d) => {
              const esActivo = fechaSeleccionada === d.iso;
              return (
                <button key={d.iso} onClick={() => setFiltroFecha(d.iso)} className={`flex flex-col items-center min-w-[72px] py-2.5 px-3 rounded-2xl border transition-all shrink-0 ${esActivo ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
                  <span className={`text-[10px] font-black uppercase ${esActivo ? "text-blue-100" : "text-slate-400"}`}>{d.diaNombre}</span>
                  <span className="text-lg font-black my-0.5">{d.diaNum}</span>
                  <span className={`text-[9px] font-extrabold ${esActivo ? "text-blue-200" : "text-slate-400"}`}>{d.mesNombre}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PARRILLA DE PISTAS Y HORARIOS */}
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-900 px-1">Disponibilidad de Pistas</h2>

          {pistas.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200">
              <span className="text-3xl block mb-2">🎾</span>
              <p className="text-sm font-bold text-slate-700">No hay pistas registradas para este club.</p>
            </div>
          ) : (
            pistas.map((pista) => {
              const estaColapsada = !!pistasColapsadas[pista.id];

              return (
                <div key={pista.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3 transition-all">
                  <div onClick={() => toggleColapsarPista(pista.id)} className="flex items-center justify-between cursor-pointer select-none border-b border-slate-100 pb-3 group">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎾</span>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors">{pista.name}</h3>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 border border-blue-200 rounded-full uppercase">
                        {pista.surface_type || "Cristal"} - {pista.court_type || "Indoor"}
                      </span>
                      <button className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all shrink-0">
                        <svg className={`w-4 h-4 transition-transform duration-300 ${estaColapsada ? "rotate-180" : "rotate-0"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                  </div>

                  {!estaColapsada && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1 animate-in fade-in duration-200">
                      {horariosDisponibles.map((slot) => {
                        const isPM = slot.timeStr.includes("PM");
                        let [h, m] = slot.timeStr.split(" ")[0].split(":");
                        let hrsNum = parseInt(h, 10);
                        if (isPM && hrsNum !== 12) hrsNum += 12;
                        if (!isPM && hrsNum === 12) hrsNum = 0;
                        const hora24 = `${hrsNum.toString().padStart(2, "0")}:${m}:00`;
                        const targetTimeMs = new Date(`${fechaSeleccionada}T${hora24}`).getTime();

                        const partidoOcupado = partidosFecha.find((m) => m.court_id === pista.id && new Date(m.scheduled_at).getTime() === targetTimeMs);
                        const inscritos = partidoOcupado?.players?.length || 0;
                        const esAbierto = partidoOcupado && !partidoOcupado.is_private && inscritos < 4;

                        if (partidoOcupado && !esAbierto) {
                          return (
                            <div key={slot.timeStr} className="bg-slate-100 border border-slate-200 rounded-2xl py-2.5 text-center opacity-60">
                              <span className="text-xs font-bold text-slate-400 block">{slot.timeStr}</span>
                              <span className="text-[9px] font-black text-rose-500 uppercase block mt-0.5">Reservado</span>
                            </div>
                          );
                        }

                        if (esAbierto) {
                          return (
                            <button key={slot.timeStr} onClick={() => unirseAPartido(partidoOcupado)} className="bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-2xl py-2.5 text-center transition-all shadow-sm">
                              <span className="text-xs font-black text-amber-900 block">{slot.timeStr}</span>
                              <span className="text-[9px] font-black text-amber-700 uppercase block mt-0.5">Unirse ({inscritos}/4)</span>
                            </button>
                          );
                        }

                        return (
                          <button key={slot.timeStr} onClick={() => abrirModalReserva(pista, slot)} className="bg-emerald-50/80 border border-emerald-300/80 hover:bg-emerald-400 hover:text-slate-950 rounded-2xl py-2.5 text-center transition-all shadow-sm group">
                            <span className="text-xs font-black text-emerald-950 group-hover:text-slate-950 block">{slot.timeStr}</span>
                            <span className="text-[9px] font-extrabold text-emerald-700 group-hover:text-slate-950 uppercase block mt-0.5">${slot.precio.toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 🟢 POP-UP INFERIOR DE RESERVA ESTILO PLAYTOMIC (2 PASOS) */}
      {modalReservaOpen && slotSeleccionado && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-end bg-black/50 backdrop-blur-xs transition-opacity" onClick={() => setModalReservaOpen(false)}>
          <div className="w-full max-w-2xl mx-auto bg-white rounded-t-[2.5rem] p-5 sm:p-7 shadow-[0_-15px_40px_rgba(0,0,0,0.15)] border-t border-slate-100 space-y-4 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                {pasoModal === 1 && <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Reservar Pista</h2>}
                {pasoModal === 2 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPasoModal(1)} className="text-slate-400 hover:text-slate-900 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Método de Pago</h2>
                  </div>
                )}
                <p className="text-xs font-bold text-slate-400 mt-0.5">{slotSeleccionado.court.name} • {slotSeleccionado.hora}</p>
              </div>
              <button onClick={() => setModalReservaOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition-colors">✕</button>
            </div>

            {/* ====== PASO 1: RESUMEN ====== */}
            {pasoModal === 1 && (
              <div className="animate-in fade-in duration-200 space-y-4">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 block">Costo de Pista (Club)</span>
                      {tasaBcv > 0 && <span className="text-[9px] font-medium text-slate-400">Ref: Bs {(slotSeleccionado.precioClub * tasaBcv).toFixed(2)}</span>}
                    </div>
                    <span className="text-sm font-bold text-slate-500">${slotSeleccionado.precioClub.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-600 block">Service Fee (App)</span>
                      {tasaBcv > 0 && <span className="text-[9px] font-medium text-blue-400">Ref: Bs {(slotSeleccionado.comisionApp * tasaBcv).toFixed(2)}</span>}
                    </div>
                    <span className="text-sm font-bold text-blue-600">${slotSeleccionado.comisionApp.toFixed(2)}</span>
                  </div>
                  
                  <div className="border-t border-slate-200 pt-3 flex items-end justify-between">
                    <span className="text-sm font-black text-slate-900">Total a Pagar</span>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 block">${slotSeleccionado.precioTotal.toFixed(2)}</span>
                      {tasaBcv > 0 && <span className="text-[10px] font-bold text-slate-500 block">Ref: Bs {(slotSeleccionado.precioTotal * tasaBcv).toFixed(2)}</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div onClick={() => setModoPago("cuota")} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${modoPago === "cuota" ? "border-[#00FF9D] bg-[#00FF9D]/5 shadow-xs" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${modoPago === "cuota" ? "border-[#00FF9D]" : "border-slate-300"}`}>{modoPago === "cuota" && <div className="w-2.5 h-2.5 bg-[#00FF9D] rounded-full" />}</div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">Pagas tu parte</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Partido público (1/4 del total)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-base sm:text-lg text-slate-900 whitespace-nowrap block">
                        ${(slotSeleccionado.precioTotal / 4).toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">c/u</span>
                      </span>
                      {tasaBcv > 0 && <span className="text-[10px] font-bold text-slate-500 block">Bs {((slotSeleccionado.precioTotal / 4) * tasaBcv).toFixed(2)}</span>}
                    </div>
                  </div>

                  <div onClick={() => setModoPago("completa")} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${modoPago === "completa" ? "border-[#00FF9D] bg-[#00FF9D]/5 shadow-xs" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${modoPago === "completa" ? "border-[#00FF9D]" : "border-slate-300"}`}>{modoPago === "completa" && <div className="w-2.5 h-2.5 bg-[#00FF9D] rounded-full" />}</div>
                      <div>
                        <p className="font-black text-slate-900 text-sm flex items-center gap-1.5">Reserva Completa 🔒</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Pagas el total, cancha privada</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-base sm:text-lg text-slate-900 whitespace-nowrap block">
                        ${slotSeleccionado.precioTotal.toFixed(2)}
                      </span>
                      {tasaBcv > 0 && <span className="text-[10px] font-bold text-slate-500 block">Bs {(slotSeleccionado.precioTotal * tasaBcv).toFixed(2)}</span>}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" disabled={modoPago === "completa"} onClick={() => setTipoJuego("competitivo")} className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${modoPago === "completa" ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400" : tipoJuego === "competitivo" ? "bg-[#0B1120] text-[#00FF9D] shadow-md" : "bg-slate-50 border border-slate-200 text-slate-600"}`}>⚡ Comp.</button>
                    <button type="button" onClick={() => setTipoJuego("amistoso")} className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${tipoJuego === "amistoso" ? "bg-[#0B1120] text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-600"}`}>🤝 Amistoso</button>
                  </div>
                </div>

                <button onClick={() => setPasoModal(2)} className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors shadow-lg shadow-gray-900/20">
                  Continuar al Pago
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            )}

            {/* ====== PASO 2: MÉTODO DE PAGO ====== */}
            {pasoModal === 2 && (
              <div className="animate-in slide-in-from-right-4 duration-200 space-y-4">
                
                <div className="space-y-3">
                  {/* Zelle */}
                  <div className={`p-4 rounded-2xl border-2 transition-all ${metodoPagoElegido === "zelle" ? "border-purple-500 bg-purple-50/50 shadow-sm" : "border-slate-100 bg-white"}`}>
                    <div onClick={() => setMetodoPagoElegido("zelle")} className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">🇺🇸</div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">Zelle</p>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">Transferencia en divisas</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${metodoPagoElegido === "zelle" ? "border-purple-500" : "border-slate-300"}`}>
                        {metodoPagoElegido === "zelle" && <div className="w-2.5 h-2.5 bg-purple-500 rounded-full" />}
                      </div>
                    </div>
                    {metodoPagoElegido === "zelle" && (
                      <div className="mt-4 pt-4 border-t border-purple-100 animate-in fade-in">
                        <div className="bg-white p-3 rounded-xl border border-purple-100 mb-3">
                          <p className="text-[10px] uppercase font-black text-purple-400 mb-1">Datos de Transferencia:</p>
                          <p className="text-sm font-black text-slate-900">pagos@elitepadel.com</p>
                          <p className="text-xs text-slate-500 font-medium">Elite Padel Center LLC</p>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Número de Confirmación Zelle" 
                          value={referenciaPago}
                          onChange={(e) => setReferenciaPago(e.target.value)}
                          className="w-full p-3.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pago Móvil */}
                  <div className={`p-4 rounded-2xl border-2 transition-all ${metodoPagoElegido === "pago_movil" ? "border-sky-500 bg-sky-50/50 shadow-sm" : "border-slate-100 bg-white"}`}>
                    <div onClick={() => setMetodoPagoElegido("pago_movil")} className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-lg">📱</div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">Pago Móvil</p>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">Transferencia en Bolívares</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${metodoPagoElegido === "pago_movil" ? "border-sky-500" : "border-slate-300"}`}>
                        {metodoPagoElegido === "pago_movil" && <div className="w-2.5 h-2.5 bg-sky-500 rounded-full" />}
                      </div>
                    </div>
                    {metodoPagoElegido === "pago_movil" && (
                      <div className="mt-4 pt-4 border-t border-sky-100 animate-in fade-in">
                        <div className="bg-white p-3 rounded-xl border border-sky-100 mb-3 grid grid-cols-2 gap-2">
                          <div className="col-span-2"><p className="text-[10px] uppercase font-black text-sky-400 mb-1">Datos Pago Móvil:</p></div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold">Banco</p>
                            <p className="text-sm font-black text-slate-900">Banesco (0134)</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold">Teléfono</p>
                            <p className="text-sm font-black text-slate-900">0414-1234567</p>
                          </div>
                          <div className="col-span-2 mt-1">
                            <p className="text-xs text-slate-400 font-bold">RIF</p>
                            <p className="text-sm font-black text-slate-900">J-50000000-0</p>
                          </div>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Últimos 4 dígitos de Referencia" 
                          value={referenciaPago}
                          onChange={(e) => setReferenciaPago(e.target.value)}
                          className="w-full p-3.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {/* Efectivo */}
                  <div onClick={() => setMetodoPagoElegido("efectivo")} className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${metodoPagoElegido === "efectivo" ? "border-emerald-500 bg-emerald-50 shadow-xs" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">💵</div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">Efectivo en el Club</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">Pagas al llegar a recepción</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${metodoPagoElegido === "efectivo" ? "border-emerald-500" : "border-slate-300"}`}>
                      {metodoPagoElegido === "efectivo" && <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />}
                    </div>
                  </div>
                </div>

                {errorReserva && <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs font-bold text-rose-800 text-center"><p>{errorReserva}</p></div>}

                <button 
                  onClick={confirmarCreacionPartido} 
                  disabled={procesandoPago || !puedePagar} 
                  className="w-full mt-2 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gray-900/20"
                >
                  {procesandoPago ? "Procesando..." : "Confirmar y Finalizar"}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
