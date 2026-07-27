"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

// Categorías ordenadas correlativamente de menor a mayor
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

// Bloques de horario estándar
const HORARIOS_DISPONIBLES = ["07:00 AM", "08:30 AM", "10:00 AM", "04:30 PM", "06:00 PM", "07:30 PM", "09:00 PM"];

// 🧠 Cálculo automático del Rango Competitivo (1 Abajo • Tu Nivel • 1 Arriba)
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
    etiquetaCorta: permitidas.map((c) => c.value).join(" • "), // Formato compacto para BD
  };
}

export default function ClubDetallePage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params?.id;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userCategoria, setUserCategoria] = useState("rookies");
  const [saldoCreditos, setSaldoCreditos] = useState(0);

  const [club, setClub] = useState(null);
  const [pistas, setPistas] = useState([]);
  const [partidosFecha, setPartidosFecha] = useState([]);

  // ↕️ Estado para controlar qué pistas están colapsadas
  const [pistasColapsadas, setPistasColapsadas] = useState({});

  // Control de Fecha
  const [fechaSeleccionada, setFiltroFecha] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().split("T")[0];
  });

  // Estado del Pop-up de Reserva
  const [modalReservaOpen, setModalReservaOpen] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  // Formulario de Reserva
  const [modoPago, setModoPago] = useState("cuota"); // 'cuota' o 'completa'
  const [tipoJuego, setTipoJuego] = useState("competitivo"); // 'competitivo' o 'amistoso'
  const [catMaximaAmistoso, setCatMaximaAmistoso] = useState("open");
  const [prefGenero, setPrefGenero] = useState("todos");
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorReserva, setErrorReserva] = useState("");

  useEffect(() => {
    if (clubId) cargarClubYHorarios();
  }, [clubId, fechaSeleccionada]);

  // 🛡️ Si es reserva completa, forzar modo Amistoso
  useEffect(() => {
    if (modoPago === "completa") {
      setTipoJuego("amistoso");
    }
  }, [modoPago]);

  function toggleColapsarPista(pistaId) {
    setPistasColapsadas((prev) => ({
      ...prev,
      [pistaId]: !prev[pistaId],
    }));
  }

  async function cargarClubYHorarios() {
    try {
      setLoading(true);
      setErrorReserva("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("creditos")
          .eq("id", authUser.id)
          .maybeSingle();
        setSaldoCreditos(profile?.creditos || 0);

        const { data: pProfile } = await supabase
          .from("padel_profiles")
          .select("categoria_oficial")
          .eq("cuenta_id", authUser.id)
          .maybeSingle();

        const catActual = pProfile?.categoria_oficial || "rookies";
        setUserCategoria(catActual);
      }

      // 1. Datos del Club
      const { data: clubData, error: errClub } = await supabase
        .from("padel_clubs")
        .select("*")
        .eq("id", clubId)
        .maybeSingle();

      if (errClub) throw errClub;
      setClub(clubData);

      // 2. Canchas del Club
      let { data: courtsData } = await supabase
        .from("padel_courts")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true);

      setPistas(courtsData || []);

      // 3. Partidos programados para la fecha
      const inicioDia = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
      const finDia = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();

      const { data: matches } = await supabase
        .from("padel_matches")
        .select(`
          id, court_id, scheduled_at, status, is_private, match_type, price_per_player, category_restriction, is_competitive,
          players:padel_match_players ( user_id, team )
        `)
        .eq("club_id", clubId)
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

  // Carrusel de 7 días
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

  function abrirModalReserva(court, horaStr) {
    if (!user) {
      router.push("/login");
      return;
    }
    const precioTotalCancha = court.price_credits || 16;
    setSlotSeleccionado({ court, hora: horaStr, precioTotal: precioTotalCancha });
    setModoPago("cuota");
    setTipoJuego("competitivo");
    setErrorReserva("");
    setModalReservaOpen(true);
  }

  // Rango competitivo automático
  const rangoCompetitivo = useMemo(() => {
    return getRangoCompetitivoAutomático(userCategoria);
  }, [userCategoria]);

  // PROCESAR RESERVA
  async function confirmarCreacionPartido() {
    let currentUser = user;
    if (!currentUser) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      currentUser = authUser;
    }

    if (!currentUser || !slotSeleccionado || !club) return;

    const esPrivado = modoPago === "completa";
    const costoTotalCancha = slotSeleccionado.precioTotal;
    const costoIndividual = Math.ceil(costoTotalCancha / 4);
    const costoAPagar = esPrivado ? costoTotalCancha : costoIndividual;

    if (saldoCreditos < costoAPagar) {
      setErrorReserva(`Saldo insuficiente. Necesitas ${costoAPagar} créditos y tienes ${saldoCreditos}.`);
      return;
    }

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

      // Usa la etiqueta corta para BD (ej. "7ma • 6ta • 5ta")
      const restriccionCategoriaFinal = esPrivado
        ? "Libre"
        : tipoJuego === "competitivo"
        ? rangoCompetitivo.etiquetaCorta
        : catMaximaAmistoso;

      // 1. Crear registro de partido
      const { data: nuevoPartido, error: matchError } = await supabase
        .from("padel_matches")
        .insert({
          club_id: club.id,
          court_id: slotSeleccionado.court.id,
          scheduled_at: new Date(matchTimestamp).toISOString(),
          status: "programado",
          is_private: esPrivado,
          match_type: esPrivado ? "privado" : "abierto",
          category_restriction: restriccionCategoriaFinal,
          gender_restriction: prefGenero,
          is_competitive: !esPrivado && tipoJuego === "competitivo",
          price_per_player: costoIndividual,
          total_price: costoTotalCancha,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (matchError) throw new Error(`Error en padel_matches: ${matchError.message}`);

      // 2. Inscribir creador
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: nuevoPartido.id,
        user_id: currentUser.id,
        team: "A",
      });

      if (playerErr) throw new Error(`Error en padel_match_players: ${playerErr.message}`);

      // 3. Descontar créditos
      const nuevoSaldo = saldoCreditos - costoAPagar;
      const { error: errSaldo } = await supabase
        .from("profiles")
        .update({ creditos: nuevoSaldo })
        .eq("id", currentUser.id);

      if (errSaldo) throw new Error(`Error descontando créditos: ${errSaldo.message}`);

      // 4. Ledger
      await supabase.from("credit_ledger").insert({
        user_id: currentUser.id,
        delta: -costoAPagar,
        reason: esPrivado ? "reserva_privada_padel" : "creacion_partido_abierto_padel",
        balance_after: nuevoSaldo
      });

      setModalReservaOpen(false);
      setSaldoCreditos(nuevoSaldo);
      router.push(`/padel/partidos`);
    } catch (err) {
      console.error("Error al reservar:", err);
      setErrorReserva(err.message || "Ocurrió un error al procesar la reserva.");
    } finally {
      setProcesandoPago(false);
    }
  }

  // Unirse a partido
  async function unirseAPartido(match) {
    if (!user) {
      router.push("/login");
      return;
    }

    const inscritos = match.players?.length || 0;
    if (inscritos >= 4) {
      alert("Este partido ya está lleno (4/4).");
      return;
    }

    if (match.players?.some((p) => p.user_id === user.id)) {
      alert("Ya estás inscrito en este partido.");
      return;
    }

    const costoInscripcion = match.price_per_player || 4;
    if (saldoCreditos < costoInscripcion) {
      alert(`⚠️ Saldo insuficiente. Necesitas ${costoInscripcion} créditos y tienes ${saldoCreditos}.`);
      return;
    }

    try {
      setLoading(true);

      const teamAsignado = match.players?.filter((p) => p.team === "A").length < 2 ? "A" : "B";

      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: user.id,
        team: teamAsignado
      });

      if (playerErr) throw playerErr;

      const nuevoSaldo = saldoCreditos - costoInscripcion;
      await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", user.id);

      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        match_id: match.id,
        delta: -costoInscripcion,
        reason: "inscripcion_partido_abierto_padel",
        balance_after: nuevoSaldo
      });

      setSaldoCreditos(nuevoSaldo);
      router.push("/padel/partidos");
    } catch (error) {
      console.error("Error uniéndose:", error);
      alert(`No se pudo completar la inscripción: ${error.message}`);
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

        {/* 🏟️ HEADER CON IMAGEN DE BAJA OPACIDAD */}
        <div className="relative bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm overflow-hidden min-h-[140px] flex items-center">
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={club?.image_url || club?.banner_url || imagenClubFallback}
              alt={club?.name || "Cancha de pádel"}
              className="w-full h-full object-cover object-right opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
          </div>

          <div className="relative z-10 space-y-1.5 max-w-sm sm:max-w-md">
            <Link href="/padel/clubes" className="text-xs font-black uppercase tracking-widest text-blue-600 hover:underline inline-block">
              ← Volver a Clubes
            </Link>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {club?.name || "Club de Pádel"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-bold flex items-center gap-1">
              📍 {club?.address || club?.city || "Ubicación disponible"}
            </p>
          </div>
        </div>

        {/* CARRUSEL HORIZONTAL DE DÍAS */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-1">Selecciona el día</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {diasCarrusel.map((d) => {
              const esActivo = fechaSeleccionada === d.iso;
              return (
                <button
                  key={d.iso}
                  onClick={() => setFiltroFecha(d.iso)}
                  className={`flex flex-col items-center min-w-[72px] py-2.5 px-3 rounded-2xl border transition-all shrink-0 ${
                    esActivo
                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className={`text-[10px] font-black uppercase ${esActivo ? "text-blue-100" : "text-slate-400"}`}>
                    {d.diaNombre}
                  </span>
                  <span className="text-lg font-black my-0.5">{d.diaNum}</span>
                  <span className={`text-[9px] font-extrabold ${esActivo ? "text-blue-200" : "text-slate-400"}`}>
                    {d.mesNombre}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PARRILLA DE PISTAS Y HORARIOS CON ACORDEÓN REPLEGABLE */}
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
                  <div
                    onClick={() => toggleColapsarPista(pista.id)}
                    className="flex items-center justify-between cursor-pointer select-none border-b border-slate-100 pb-3 group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎾</span>
                      <h3 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                        {pista.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 border border-blue-200 rounded-full uppercase">
                        {pista.court_type || "Cristal"}
                      </span>

                      <button
                        type="button"
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all shrink-0"
                        title={estaColapsada ? "Desplegar cancha" : "Recoger cancha"}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform duration-300 ${estaColapsada ? "rotate-180" : "rotate-0"}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {!estaColapsada && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1 animate-in fade-in duration-200">
                      {HORARIOS_DISPONIBLES.map((horaStr) => {
                        const isPM = horaStr.includes("PM");
                        let [h, m] = horaStr.split(" ")[0].split(":");
                        let hrsNum = parseInt(h, 10);
                        if (isPM && hrsNum !== 12) hrsNum += 12;
                        if (!isPM && hrsNum === 12) hrsNum = 0;
                        const hora24 = `${hrsNum.toString().padStart(2, "0")}:${m}:00`;

                        const targetTimeMs = new Date(`${fechaSeleccionada}T${hora24}`).getTime();

                        const partidoOcupado = partidosFecha.find((m) => {
                          if (m.court_id !== pista.id || !m.scheduled_at) return false;
                          const matchTimeMs = new Date(m.scheduled_at).getTime();
                          return matchTimeMs === targetTimeMs;
                        });

                        const inscritos = partidoOcupado?.players?.length || 0;
                        const esAbierto = partidoOcupado && !partidoOcupado.is_private && inscritos < 4;

                        if (partidoOcupado && !esAbierto) {
                          return (
                            <div key={horaStr} className="bg-slate-100 border border-slate-200 rounded-2xl py-2.5 text-center opacity-60">
                              <span className="text-xs font-bold text-slate-400 block">{horaStr}</span>
                              <span className="text-[9px] font-black text-rose-500 uppercase block mt-0.5">Reservado</span>
                            </div>
                          );
                        }

                        if (esAbierto) {
                          return (
                            <button
                              key={horaStr}
                              onClick={() => unirseAPartido(partidoOcupado)}
                              className="bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-2xl py-2.5 text-center transition-all shadow-sm"
                            >
                              <span className="text-xs font-black text-amber-900 block">{horaStr}</span>
                              <span className="text-[9px] font-black text-amber-700 uppercase block mt-0.5">
                                Unirse ({inscritos}/4)
                              </span>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={horaStr}
                            onClick={() => abrirModalReserva(pista, horaStr)}
                            className="bg-emerald-50/80 border border-emerald-300/80 hover:bg-emerald-400 hover:text-slate-950 rounded-2xl py-2.5 text-center transition-all shadow-sm group"
                          >
                            <span className="text-xs font-black text-emerald-950 group-hover:text-slate-950 block">{horaStr}</span>
                            <span className="text-[9px] font-extrabold text-emerald-700 group-hover:text-slate-950 uppercase block mt-0.5">
                              Disponible
                            </span>
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

      {/* 🟢 POP-UP INFERIOR DE RESERVA ESTILO FÚTBOL (BOTTOM SHEET) */}
      {modalReservaOpen && slotSeleccionado && (
        <div
          className="fixed inset-0 z-[10000] flex flex-col justify-end bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setModalReservaOpen(false)}
        >
          <div
            className="w-full max-w-2xl mx-auto bg-white rounded-t-[2.5rem] p-5 sm:p-7 shadow-[0_-15px_40px_rgba(0,0,0,0.15)] border-t border-slate-100 space-y-4 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Reservar Pista</h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {slotSeleccionado.court.name} • {slotSeleccionado.hora}
                </p>
              </div>
              <button
                onClick={() => setModalReservaOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">Saldo disponible:</span>
              <span className="text-sm font-black text-slate-900">{saldoCreditos} créditos</span>
            </div>

            <div className="space-y-2">
              <div
                onClick={() => setModoPago("cuota")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  modoPago === "cuota" ? "border-[#00FF9D] bg-[#00FF9D]/5 shadow-xs" : "border-slate-100 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${modoPago === "cuota" ? "border-[#00FF9D]" : "border-slate-300"}`}>
                    {modoPago === "cuota" && <div className="w-2.5 h-2.5 bg-[#00FF9D] rounded-full" />}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">Pagas tu parte</p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">El partido será público para la comunidad</p>
                  </div>
                </div>
                <span className="font-black text-base sm:text-lg text-slate-900 whitespace-nowrap">
                  {Math.ceil(slotSeleccionado.precioTotal / 4)} <span className="text-[10px] text-slate-400 font-bold">créditos</span>
                </span>
              </div>

              <div
                onClick={() => setModoPago("completa")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  modoPago === "completa" ? "border-[#00FF9D] bg-[#00FF9D]/5 shadow-xs" : "border-slate-100 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${modoPago === "completa" ? "border-[#00FF9D]" : "border-slate-300"}`}>
                    {modoPago === "completa" && <div className="w-2.5 h-2.5 bg-[#00FF9D] rounded-full" />}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                      Reservar cancha completa 🔒
                    </p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">Cancha privada</p>
                  </div>
                </div>
                <span className="font-black text-base sm:text-lg text-slate-900 whitespace-nowrap">
                  {slotSeleccionado.precioTotal} <span className="text-[10px] text-slate-400 font-bold">créditos</span>
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tipo de Juego</span>
                {modoPago === "completa" && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    🔒 Reserva completa = Amistoso
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={modoPago === "completa"}
                  onClick={() => setTipoJuego("competitivo")}
                  className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                    modoPago === "completa"
                      ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200"
                      : tipoJuego === "competitivo"
                      ? "bg-[#0B1120] text-[#00FF9D] shadow-md"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  ⚡ Competitivo
                </button>
                <button
                  type="button"
                  onClick={() => setTipoJuego("amistoso")}
                  className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                    tipoJuego === "amistoso"
                      ? "bg-[#0B1120] text-white shadow-md"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  🤝 Amistoso
                </button>
              </div>

              {modoPago === "cuota" ? (
                <div className="space-y-3 pt-1">
                  
                  {tipoJuego === "competitivo" ? (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 p-4 rounded-2xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 flex items-center gap-1">
                          <span>🎯</span> Restricción Competitiva Automática
                        </span>
                        <span className="text-[9px] font-black bg-blue-600 text-white px-2.5 py-0.5 rounded-full uppercase">
                          Regla ±1 Nivel
                        </span>
                      </div>
                      
                      <p className="text-xs font-black text-slate-900 pt-0.5">
                        Jugadores permitidos: <span className="text-blue-700">{rangoCompetitivo.etiquetaRango}</span>
                      </p>

                      <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                        Al ser tu nivel <strong className="text-slate-900">{rangoCompetitivo.actual.label}</strong>, el partido admitirá automáticamente a jugadores de 1 categoría abajo, tu misma categoría o 1 categoría arriba.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                          Categoría Máxima Permitida
                        </label>
                        <select
                          value={catMaximaAmistoso}
                          onChange={(e) => setCatMaximaAmistoso(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                        >
                          <option value="open">Abierto (Sin restricción)</option>
                          {CATEGORIAS_ORDENADAS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                          Preferencia Jugadores
                        </label>
                        <select
                          value={prefGenero}
                          onChange={(e) => setPrefGenero(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                        >
                          {PREFERENCIA_GENERO.map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {tipoJuego === "competitivo" && (
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                        Preferencia Jugadores
                      </label>
                      <select
                        value={prefGenero}
                        onChange={(e) => setPrefGenero(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                      >
                        {PREFERENCIA_GENERO.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl text-[11px] font-bold text-slate-500 text-center">
                  🔒 Los partidos privados de cancha completa se registran como <strong className="text-slate-900">Amistosos</strong> para mantener la integridad del Rating oficial.
                </div>
              )}
            </div>

            {errorReserva && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs font-bold text-rose-800 text-center">
                <p>{errorReserva}</p>
              </div>
            )}

            <button
              onClick={confirmarCreacionPartido}
              disabled={procesandoPago}
              className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors disabled:opacity-70 shadow-lg shadow-gray-900/20 active:scale-[0.99]"
            >
              {procesandoPago ? (
                "Procesando..."
              ) : (
                <>
                  Confirmar y Pagar
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}