"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

// Categorías oficiales
const CATEGORIAS = ["Rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "Open"];

function formatHora12(hora24) {
  if (!hora24) return "";
  const [h, m] = hora24.split(":");
  const horas = parseInt(h, 10);
  const ampm = horas >= 12 ? "PM" : "AM";
  const h12 = horas % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function PadelClubsPage() {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [userCreditos, setUserCreditos] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Estados de Interacción
  const [search, setSearch] = useState("");
  const [clubSeleccionado, setClubSeleccionado] = useState(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Modal para Crear / Configurar Partido
  const [slotSeleccionado, setSlotSeleccionado] = useState(null);
  const [modalConfigOpen, setModalConfigOpen] = useState(false);
  const [procesando, setProcesando] = useState(false);

  // Formulario de Configuración de Partido Abierto
  const [formMatch, setFormMatch] = useState({
    tipo_acceso: "abierto",
    tipo_partido: "competitivo",
    categoria_permitida: "7ma",
    genero: "todos",
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      setErrorMsg("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        // Cargar créditos del usuario
        const { data: profileData } = await supabase
          .from("profiles")
          .select("creditos")
          .eq("id", authUser.id)
          .maybeSingle();

        setUserCreditos(profileData?.creditos ?? 0);

        // Cargar categoría oficial de pádel
        const { data: pProfile } = await supabase
          .from("padel_profiles")
          .select("categoria_oficial")
          .eq("id", authUser.id)
          .maybeSingle();

        if (pProfile?.categoria_oficial) {
          setFormMatch((prev) => ({ ...prev, categoria_permitida: pProfile.categoria_oficial }));
        }
      }

      // 1. Cargar Clubes y Canchas
      const { data: clubsData, error: clubsError } = await supabase
        .from("padel_clubs")
        .select(`
          id, name, slug, city, address, image_url, is_active,
          courts:padel_courts ( id, name, court_type, surface_type, is_active, price_credits )
        `);

      if (clubsError) {
        console.error("Error al obtener padel_clubs:", clubsError);
        throw new Error(`Error en la base de datos (padel_clubs): ${clubsError.message}`);
      }

      setClubs(clubsData || []);

      // 2. Cargar Partidos
      const { data: matchesData, error: matchesError } = await supabase
        .from("padel_matches")
        .select(`
          id, status, match_type, scheduled_at, club_id, court_id,
          category_restriction, gender_restriction, is_competitive, price_per_player,
          players:padel_match_players ( user_id, team )
        `);

      if (matchesError) {
        console.warn("Aviso: No se pudieron cargar partidos existentes:", matchesError.message);
      } else {
        setMatches(matchesData || []);
      }

    } catch (error) {
      console.error("Error global en cargarDatos:", error);
      setErrorMsg(error.message || "No se pudieron cargar los clubes.");
    } finally {
      setLoading(false);
    }
  }

  const clubesFiltrados = useMemo(() => {
    return clubs.filter((c) => {
      return (
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.city?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [clubs, search]);

  function abrirConfiguracionSlot(court, hora) {
    if (!user) {
      alert("Debes iniciar sesión para reservar o abrir un partido.");
      return;
    }
    const precioTotalCancha = court.price_credits || 16;
    setSlotSeleccionado({ court, hora, precioTotal: precioTotalCancha });
    setModalConfigOpen(true);
  }

  async function confirmarCreacionPartido(e) {
    e.preventDefault();
    if (!slotSeleccionado || !clubSeleccionado || procesando) return;

    const esPrivado = formMatch.tipo_acceso === "privado";
    const costoTotalCancha = slotSeleccionado.precioTotal;
    const costoIndividual = Math.ceil(costoTotalCancha / 4);
    const costoAPagar = esPrivado ? costoTotalCancha : costoIndividual;

    if (userCreditos < costoAPagar) {
      alert(`⚠️ Saldo insuficiente. Requiere ${costoAPagar} créditos y tienes ${userCreditos}. Recarga tu saldo.`);
      return;
    }

    try {
      setProcesando(true);
      const fechaHoraSchedule = `${fechaSeleccionada}T${slotSeleccionado.hora}:00`;

      // 1. Descontar créditos
      const nuevoSaldo = userCreditos - costoAPagar;
      await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", user.id);

      // 2. Registrar en Ledger
      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        delta: -costoAPagar,
        reason: esPrivado ? "reserva_privada_padel" : "creacion_partido_abierto_padel",
        balance_after: nuevoSaldo
      });

      // 3. Crear partido
      const { data: nuevoPartido, error: matchError } = await supabase
        .from("padel_matches")
        .insert({
          club_id: clubSeleccionado.id,
          court_id: slotSeleccionado.court.id,
          scheduled_at: fechaHoraSchedule,
          status: "programado",
          match_type: esPrivado ? "privado" : "abierto",
          category_restriction: formMatch.categoria_permitida,
          gender_restriction: formMatch.genero,
          is_competitive: formMatch.tipo_partido === "competitivo",
          price_per_player: costoIndividual,
          total_price: costoTotalCancha,
          created_by: user.id
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // 4. Inscribir creador
      await supabase.from("padel_match_players").insert({
        match_id: nuevoPartido.id,
        user_id: user.id,
        team: "A"
      });

      alert(
        esPrivado
          ? `✅ Reserva privada confirmada (-${costoAPagar} créditos).`
          : `🎉 ¡Partido abierto publicado! Tu cupo quedó apartado (-${costoAPagar} créditos).`
      );

      setUserCreditos(nuevoSaldo);
      setModalConfigOpen(false);
      setSlotSeleccionado(null);
      await cargarDatos();
    } catch (error) {
      console.error("Error al procesar reserva:", error);
      alert("Error al procesar la reserva. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  async function unirseAPartido(match) {
    if (!user) {
      alert("Debes iniciar sesión para unirte.");
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
    if (userCreditos < costoInscripcion) {
      alert(`⚠️ Saldo insuficiente. Necesitas ${costoInscripcion} créditos y tienes ${userCreditos}.`);
      return;
    }

    try {
      setProcesando(true);
      const nuevoSaldo = userCreditos - costoInscripcion;

      await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", user.id);

      await supabase.from("credit_ledger").insert({
        user_id: user.id,
        match_id: match.id,
        delta: -costoInscripcion,
        reason: "inscripcion_partido_abierto_padel",
        balance_after: nuevoSaldo
      });

      const teamAsignado = match.players?.filter((p) => p.team === "A").length < 2 ? "A" : "B";

      await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: user.id,
        team: teamAsignado
      });

      alert(`🎾 ¡Inscrito con éxito! (-${costoInscripcion} créditos)`);
      setUserCreditos(nuevoSaldo);
      await cargarDatos();
    } catch (error) {
      console.error("Error uniéndose:", error);
      alert("No se pudo completar la inscripción.");
    } finally {
      setProcesando(false);
    }
  }

  const HORARIOS_DIA = ["08:00", "09:30", "11:00", "16:30", "18:00", "19:30", "21:00"];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ALERTA DE ERROR */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex justify-between items-center shadow-sm">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-600 font-black">✕</button>
          </div>
        )}

        {/* HEADER DIRECTORIO */}
        {!clubSeleccionado && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-blue-600">
                Sports Hub · Pádel
              </span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Clubes y Canchas
              </h1>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Reserva canchas completas o únete a partidos abiertos creados por la comunidad.
              </p>
            </div>

            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="🔍 Buscar por club o ciudad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>
        )}

        {/* DETALLE DEL CLUB Y CANCHAS */}
        {clubSeleccionado ? (
          <div className="space-y-6">
            
            {/* CABECERA DEDICADA DEL CLUB */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 w-full md:w-auto">
                <button
                  onClick={() => setClubSeleccionado(null)}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition-colors shrink-0 shadow-sm"
                >
                  ← Volver a Clubes
                </button>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                    Club Seleccionado
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                    {clubSeleccionado.name}
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">
                    📍 {clubSeleccionado.address || clubSeleccionado.city || "Ubicación disponible"}
                  </p>
                </div>
              </div>

              {/* SELECTOR DE FECHA */}
              <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 w-full md:w-auto shrink-0">
                <span className="text-xs font-black text-slate-500 pl-2">Fecha:</span>
                <input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={(e) => setFechaSeleccionada(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* GRILLA DE CANCHAS DEL CLUB */}
            {clubSeleccionado.courts?.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-200">
                <span className="text-3xl block mb-2">🎾</span>
                <p className="text-sm font-bold text-slate-700">Este club aún no tiene canchas registradas en el sistema.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {clubSeleccionado.courts?.map((court) => (
                  <div key={court.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h3 className="font-black text-base text-slate-900">🎾 {court.name}</h3>
                      <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                        {court.court_type || "Cristal"}
                      </span>
                    </div>

                    {/* BLOQUES DE HORARIO */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {HORARIOS_DIA.map((hora) => {
                        const matchExistente = matches.find(
                          (m) =>
                            m.court_id === court.id &&
                            m.scheduled_at?.startsWith(`${fechaSeleccionada}T${hora}`)
                        );

                        const inscritos = matchExistente?.players?.length || 0;

                        return (
                          <div key={hora} className="flex flex-col">
                            {matchExistente ? (
                              <div className="bg-slate-900 text-white rounded-2xl p-3 border border-slate-800 flex flex-col justify-between min-h-[110px] shadow-sm">
                                <div>
                                  <div className="flex justify-between items-center text-[10px] font-black text-blue-400">
                                    <span>{formatHora12(hora)}</span>
                                    <span>{inscritos}/4 👥</span>
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                    <span className="text-[9px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                                      {matchExistente.category_restriction || "Libre"}
                                    </span>
                                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                                      {matchExistente.is_competitive ? "Competitivo" : "Amistoso"}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => unirseAPartido(matchExistente)}
                                  disabled={inscritos >= 4}
                                  className={`w-full mt-2 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    inscritos >= 4
                                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-md"
                                  }`}
                                >
                                  {inscritos >= 4 ? "Lleno" : `+ Unirme (${matchExistente.price_per_player || 4} cr)`}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => abrirConfiguracionSlot(court, hora)}
                                className="bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl p-3 text-left flex flex-col justify-between min-h-[110px] transition-all group"
                              >
                                <div>
                                  <span className="text-xs font-black text-emerald-950 block">{formatHora12(hora)}</span>
                                  <span className="text-[10px] font-bold text-emerald-700 block mt-1">Disponible</span>
                                </div>

                                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                                  + Reservar / Abrir
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        ) : (
          /* DIRECTORIO DE CLUBES */
          <>
            {clubesFiltrados.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 space-y-3">
                <span className="text-4xl block">🏟️</span>
                <h3 className="text-lg font-black text-slate-800">No hay clubes de pádel disponibles</h3>
                <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                  {search
                    ? `No encontramos ningún club que coincida con "${search}".`
                    : "No hay clubes cargados en la base de datos Supabase o no están marcados como activos."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clubesFiltrados.map((club) => {
                  const totalCanchas = club.courts?.length || 0;

                  return (
                    <div
                      key={club.id}
                      className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="relative h-48 bg-slate-800">
                        {club.image_url ? (
                          <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">🏟️</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-4 right-3 text-white">
                          <h3 className="text-xl font-black">{club.name}</h3>
                          <p className="text-xs text-slate-300 font-medium">📍 {club.city || "Ubicación disponible"}</p>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <p className="text-xs text-slate-500 font-medium line-clamp-2">
                          {club.address || "Complejo deportivo con canchas reglamentarias de pádel."}
                        </p>

                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <span>Canchas activas:</span>
                          <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                            {totalCanchas} Pistas
                          </span>
                        </div>

                        <button
                          onClick={() => setClubSeleccionado(club)}
                          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors"
                        >
                          Ver Disponibilidad y Canchas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* ==================================================== */}
      {/* 🔥 MODAL DE RESERVA CON DISEÑO IDÉNTICO A FÚTBOL     */}
      {/* ==================================================== */}
      {modalConfigOpen && slotSeleccionado && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setModalConfigOpen(false)}
        >
          <div
            className="bg-white rounded-[2.5rem] max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100 relative space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-black text-slate-900">Reservar Pista</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  {slotSeleccionado.court.name} • {formatHora12(slotSeleccionado.hora)}
                </p>
              </div>
              <button
                onClick={() => setModalConfigOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Saldo de créditos */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500">Saldo disponible:</span>
              <span className="font-black text-slate-900 text-sm">{userCreditos} créditos</span>
            </div>

            <form onSubmit={confirmarCreacionPartido} className="space-y-4 text-xs font-bold text-slate-700">
              
              {/* SELECCIÓN TIPO RADIO CARDS (ESTILO FÚTBOL) */}
              <div className="space-y-3">
                
                {/* Opción 1: Pagas tu parte */}
                <div
                  onClick={() => setFormMatch({ ...formMatch, tipo_acceso: "abierto" })}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                    formMatch.tipo_acceso === "abierto"
                      ? "border-[#00FF9D] bg-[#00FF9D]/10 text-slate-900 shadow-sm"
                      : "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formMatch.tipo_acceso === "abierto" ? "border-[#00FF9D] bg-white" : "border-slate-300"
                    }`}>
                      {formMatch.tipo_acceso === "abierto" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#00FF9D]" />
                      )}
                    </div>
                    <div>
                      <span className="font-black text-sm text-slate-900 block">Pagas tu parte</span>
                      <span className="text-xs font-semibold text-slate-400 block mt-0.5">El partido será público</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">{Math.ceil(slotSeleccionado.precioTotal / 4)}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">créditos</span>
                  </div>
                </div>

                {/* Opción 2: Reservar cancha completa */}
                <div
                  onClick={() => setFormMatch({ ...formMatch, tipo_acceso: "privado" })}
                  className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                    formMatch.tipo_acceso === "privado"
                      ? "border-[#00FF9D] bg-[#00FF9D]/10 text-slate-900 shadow-sm"
                      : "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      formMatch.tipo_acceso === "privado" ? "border-[#00FF9D] bg-white" : "border-slate-300"
                    }`}>
                      {formMatch.tipo_acceso === "privado" && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#00FF9D]" />
                      )}
                    </div>
                    <div>
                      <span className="font-black text-sm text-slate-900 flex items-center gap-1">
                        Reservar cancha completa 🔒
                      </span>
                      <span className="text-xs font-semibold text-slate-400 block mt-0.5">Cancha privada</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-slate-900">{slotSeleccionado.precioTotal}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">créditos</span>
                  </div>
                </div>

              </div>

              {/* OPCIONES EXTRA PARA PARTIDO ABIERTO */}
              {formMatch.tipo_acceso === "abierto" && (
                <div className="space-y-3.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                      Tipo de Juego
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormMatch({ ...formMatch, tipo_partido: "competitivo" })}
                        className={`py-2 px-3 rounded-xl border text-center font-black transition-all ${
                          formMatch.tipo_partido === "competitivo"
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        ⚡ Competitivo
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormMatch({ ...formMatch, tipo_partido: "amistoso" })}
                        className={`py-2 px-3 rounded-xl border text-center font-black transition-all ${
                          formMatch.tipo_partido === "amistoso"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        🤝 Amistoso
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        Categoría Máxima
                      </label>
                      <select
                        value={formMatch.categoria_permitida}
                        onChange={(e) => setFormMatch({ ...formMatch, categoria_permitida: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold outline-none focus:border-blue-500"
                      >
                        {CATEGORIAS.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        Preferencia Jugadores
                      </label>
                      <select
                        value={formMatch.genero}
                        onChange={(e) => setFormMatch({ ...formMatch, genero: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold outline-none focus:border-blue-500"
                      >
                        <option value="todos">🌐 Todos</option>
                        <option value="varonil">👨 Varones</option>
                        <option value="femenil">👩 Femenil</option>
                        <option value="mixto">🚻 Mixto</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* BOTÓN ESTILO FÚTBOL */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={procesando}
                  className="w-full py-4 bg-[#0B0C15] hover:bg-slate-900 text-[#00FF9D] font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {procesando ? (
                    "PROCESANDO PAGO..."
                  ) : (
                    <>
                      <span>CONFIRMAR Y PAGAR</span>
                      <span className="text-base">→</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}