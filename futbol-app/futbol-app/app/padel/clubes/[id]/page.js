"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

// Categorías para el modal
const CATEGORIAS_OPCIONES = [
  { value: "rookies", label: "Rookies" },
  { value: "7ma", label: "7ma Categoría" },
  { value: "6ta", label: "6ta Categoría" },
  { value: "5ta", label: "5ta Categoría" },
  { value: "4ta", label: "4ta Categoría" },
  { value: "3era", label: "3era Categoría" },
  { value: "2da", label: "2da Categoría" },
  { value: "open", label: "Open (Sin límite)" },
];

const PREFERENCIA_GENERO = [
  { value: "todos", label: "🌐 Todos" },
  { value: "masculino", label: "👨 Masculino" },
  { value: "femenino", label: "👩 Femenino" },
  { value: "mixto", label: "👫 Mixto" },
];

// Bloques de horario estándar
const HORARIOS_DISPONIBLES = ["07:00 AM", "08:30 AM", "10:00 AM", "04:30 PM", "06:00 PM", "07:30 PM", "09:00 PM"];

export default function ClubDetallePage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params?.id;

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [saldoCreditos, setSaldoCreditos] = useState(0);

  const [club, setClub] = useState(null);
  const [pistas, setPistas] = useState([]);
  const [partidosFecha, setPartidosFecha] = useState([]);

  // Control de Fecha (Por defecto Hoy)
  const [fechaSeleccionada, setFiltroFecha] = useState(() => {
    const hoy = new Date();
    return hoy.toISOString().split("T")[0];
  });

  // Estado del Modal de Reserva
  const [modalReservaOpen, setModalReservaOpen] = useState(false);
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);

  // Formulario de Reserva (Modal)
  const [modoPago, setModoPago] = useState("cuota"); // 'cuota' (4 cred) o 'completa' (16 cred)
  const [tipoJuego, setTipoJuego] = useState("competitivo"); // 'competitivo' o 'amistoso'
  const [catMaxima, setCatMaxima] = useState("rookies");
  const [prefGenero, setPrefGenero] = useState("todos");
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorReserva, setErrorReserva] = useState("");

  useEffect(() => {
    cargarClubYHorarios();
  }, [clubId, fechaSeleccionada]);

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

        if (pProfile?.categoria_oficial) {
          setCatMaxima(pProfile.categoria_oficial);
        }
      }

      // 1. Obtener Datos del Club
      const { data: clubData, error: errClub } = await supabase
        .from("padel_clubs")
        .select("*")
        .eq("id", clubId)
        .maybeSingle();

      if (errClub) throw errClub;
      setClub(clubData);

      // 2. Obtener Canchas / Pistas del Club
      let { data: courtsData } = await supabase
        .from("padel_courts")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true);

      setPistas(courtsData || []);

      // 3. Obtener Partidos programados para la fecha seleccionada
      const inicioDia = `${fechaSeleccionada}T00:00:00`;
      const finDia = `${fechaSeleccionada}T23:59:59`;

      const { data: matches } = await supabase
        .from("padel_matches")
        .select(`
          id, court_id, scheduled_at, status, is_private, match_type, price_per_player, category_restriction, is_competitive,
          players:padel_match_players ( user_id, team )
        `)
        .gte("scheduled_at", inicioDia)
        .lte("scheduled_at", finDia);

      setPartidosFecha(matches || []);
    } catch (err) {
      console.error("Error cargando club:", err);
    } finally {
      setLoading(false);
    }
  }

  // Generar tira de próximos 7 días para el carrusel
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

  // PROCESAR RESERVA SEGURA (CREA PARTIDO PRIMERO, DESCUENTA CRÉDITOS DESPUÉS)
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

      // Conversión de hora a formato 24h
      const isPM = slotSeleccionado.hora.includes("PM");
      let [h, m] = slotSeleccionado.hora.split(" ")[0].split(":");
      let horasNumericas = parseInt(h, 10);
      if (isPM && horasNumericas !== 12) horasNumericas += 12;
      if (!isPM && horasNumericas === 12) horasNumericas = 0;
      const horaReal24 = `${horasNumericas.toString().padStart(2, "0")}:${m}:00`;

      const matchTimestamp = `${fechaSeleccionada}T${horaReal24}`;

      // 1. PRIMERO CREAR REGISTRO DEL PARTIDO
      const { data: nuevoPartido, error: matchError } = await supabase
        .from("padel_matches")
        .insert({
          club_id: club.id,
          court_id: slotSeleccionado.court.id,
          scheduled_at: new Date(matchTimestamp).toISOString(),
          status: "programado",
          is_private: esPrivado,
          match_type: esPrivado ? "privado" : "abierto",
          category_restriction: catMaxima,
          gender_restriction: prefGenero,
          is_competitive: tipoJuego === "competitivo",
          price_per_player: costoIndividual,
          total_price: costoTotalCancha,
          created_by: currentUser.id
        })
        .select()
        .single();

      if (matchError) throw new Error(`Error en padel_matches: ${matchError.message}`);

      // 2. INSCRIBIR CREADOR AL PARTIDO
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: nuevoPartido.id,
        user_id: currentUser.id,
        team: "A",
      });

      if (playerErr) throw new Error(`Error en padel_match_players: ${playerErr.message}`);

      // 3. SOLO SI LO ANTERIOR TUVO ÉXITO -> DESCONTAR CRÉDITOS DEL USUARIO
      const nuevoSaldo = saldoCreditos - costoAPagar;
      const { error: errSaldo } = await supabase
        .from("profiles")
        .update({ creditos: nuevoSaldo })
        .eq("id", currentUser.id);

      if (errSaldo) throw new Error(`Error descontando créditos: ${errSaldo.message}`);

      // 4. REGISTRAR TRANSACCIÓN EN HISTORIAL
      await supabase.from("credit_ledger").insert({
        user_id: currentUser.id,
        delta: -costoAPagar,
        reason: esPrivado ? "reserva_privada_padel" : "creacion_partido_abierto_padel",
        balance_after: nuevoSaldo
      });

      setModalReservaOpen(false);
      setSaldoCreditos(nuevoSaldo);
      
      // Redirigir al listado de partidos
      router.push(`/padel/partidos`);
    } catch (err) {
      console.error("Error al reservar:", err);
      // Muestra el motivo exacto de fallo
      setErrorReserva(err.message || "Ocurrió un error al procesar la reserva.");
    } finally {
      setProcesandoPago(false);
    }
  }

  // UNIRSE A UN PARTIDO EXISTENTE
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

      // 1. Inscribir jugador primero
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: user.id,
        team: teamAsignado
      });

      if (playerErr) throw playerErr;

      // 2. Descontar saldo
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

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* HEADER DEL CLUB */}
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/padel/clubes" className="text-xs font-black uppercase tracking-widest text-blue-600 hover:underline">
              ← Volver a Clubes
            </Link>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900">{club?.name || "Club de Pádel"}</h1>
            <p className="text-xs text-slate-500 font-semibold">📍 {club?.address || club?.city || "Ubicación disponible"}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl text-right">
              <span className="text-[10px] uppercase font-black text-amber-700 block">Tus Créditos</span>
              <span className="text-base font-black text-amber-900">{saldoCreditos} 🪙</span>
            </div>
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

        {/* PARRILLA DE PISTAS Y HORARIOS */}
        <div className="space-y-4">
          <h2 className="text-lg font-black text-slate-900 px-1">Disponibilidad de Pistas</h2>

          {pistas.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200">
              <span className="text-3xl block mb-2">🎾</span>
              <p className="text-sm font-bold text-slate-700">No hay pistas registradas para este club.</p>
            </div>
          ) : (
            pistas.map((pista) => (
              <div key={pista.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎾</span>
                    <h3 className="text-base font-black text-slate-900">{pista.name}</h3>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-3 py-1 border border-blue-200 rounded-full uppercase">
                    {pista.court_type || "Cristal"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-1">
                  {HORARIOS_DISPONIBLES.map((horaStr) => {
                    const isPM = horaStr.includes("PM");
                    let [h, m] = horaStr.split(" ")[0].split(":");
                    let hrsNum = parseInt(h, 10);
                    if (isPM && hrsNum !== 12) hrsNum += 12;
                    if (!isPM && hrsNum === 12) hrsNum = 0;
                    const hora24 = `${hrsNum.toString().padStart(2, "0")}:${m}:00`;

                    const partidoOcupado = partidosFecha.find(
                      (m) =>
                        m.court_id === pista.id &&
                        m.scheduled_at?.startsWith(`${fechaSeleccionada}T${hora24}`)
                    );

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
              </div>
            ))
          )}
        </div>

      </div>

      {/* MODAL DE RESERVA */}
      {modalReservaOpen && slotSeleccionado && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setModalReservaOpen(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative space-y-5 my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reservar Pista</h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">
                  {slotSeleccionado.court.name} • {slotSeleccionado.hora}
                </p>
              </div>
              <button onClick={() => setModalReservaOpen(false)} className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition-colors">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">Saldo disponible:</span>
              <span className="text-sm font-black text-slate-900">{saldoCreditos} créditos</span>
            </div>

            <button
              type="button"
              onClick={() => setModoPago("cuota")}
              className={`w-full text-left p-4 rounded-3xl border-2 transition-all flex items-center justify-between gap-3 ${
                modoPago === "cuota" ? "border-[#00FF9D] bg-emerald-50/40 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${modoPago === "cuota" ? "border-[#00FF9D] bg-[#00FF9D]" : "border-slate-300"}`}>
                  {modoPago === "cuota" && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Pagas tu parte</p>
                  <p className="text-xs font-semibold text-slate-400">El partido será público</p>
                </div>
              </div>
              <span className="text-lg font-black text-slate-900">
                {Math.ceil(slotSeleccionado.precioTotal / 4)} <span className="text-xs text-slate-400 font-bold">créditos</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModoPago("completa")}
              className={`w-full text-left p-4 rounded-3xl border-2 transition-all flex items-center justify-between gap-3 ${
                modoPago === "completa" ? "border-[#00FF9D] bg-emerald-50/40 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${modoPago === "completa" ? "border-[#00FF9D] bg-[#00FF9D]" : "border-slate-300"}`}>
                  {modoPago === "completa" && <div className="w-2 h-2 rounded-full bg-slate-900" />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 flex items-center gap-1">Reservar cancha completa 🔒</p>
                  <p className="text-xs font-semibold text-slate-400">Cancha privada</p>
                </div>
              </div>
              <span className="text-lg font-black text-slate-900">
                {slotSeleccionado.precioTotal} <span className="text-xs text-slate-400 font-bold">créditos</span>
              </span>
            </button>

            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tipo de Juego</span>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setTipoJuego("competitivo")} className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${tipoJuego === "competitivo" ? "bg-[#0B1120] text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-600"}`}>⚡ Competitivo</button>
                <button type="button" onClick={() => setTipoJuego("amistoso")} className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${tipoJuego === "amistoso" ? "bg-[#0B1120] text-white shadow-md" : "bg-slate-50 border border-slate-200 text-slate-600"}`}>🤝 Amistoso</button>
              </div>

              {modoPago === "cuota" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Categoría Máxima</label>
                    <select value={catMaxima} onChange={(e) => setCatMaxima(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none">
                      {CATEGORIAS_OPCIONES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Preferencia Jugadores</label>
                    <select value={prefGenero} onChange={(e) => setPrefGenero(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none">
                      {PREFERENCIA_GENERO.map((g) => (<option key={g.value} value={g.value}>{g.label}</option>))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* AVISO DE ERROR CON DETALLE DE SUPABASE */}
            {errorReserva && (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-xs font-bold text-rose-800 text-center space-y-1">
                <span className="block uppercase font-black text-[10px] text-rose-500">Error detectado:</span>
                <p className="normal-case">{errorReserva}</p>
              </div>
            )}

            <button onClick={confirmarCreacionPartido} disabled={procesandoPago} className="w-full py-4 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-900 active:scale-[0.98] transition-all shadow-xl disabled:opacity-60 flex items-center justify-center gap-2">
              <span>{procesandoPago ? "PROCESANDO RESERVA..." : "CONFIRMAR Y PAGAR"}</span>
              {!procesandoPago && <span className="text-base">→</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}