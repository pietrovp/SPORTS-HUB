"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const AMENIDADES_MAP = {
  equipment_rental: { label: "Alquiler de Equipo", icon: "⚽" },
  free_parking: { label: "Estacionamiento Gratis", icon: "🚗" },
  store: { label: "Tienda Deportiva", icon: "🛍️" },
  restaurant: { label: "Restaurante", icon: "🍽️" },
  cafeteria: { label: "Cafetería", icon: "☕" },
  changing_room: { label: "Vestuarios y Duchas", icon: "🚿" },
  wifi: { label: "WiFi Gratis", icon: "📶" },
  lockers: { label: "Lockers / Casilleros", icon: "🔒" },
};

export default function FutbolReservarPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);

  const [clubes, setClubes] = useState([]);
  const [clubSeleccionadoId, setClubSeleccionadoId] = useState(null);
  const [canchasFutbol, setCanchasFutbol] = useState([]);
  const [partidosFutbol, setPartidosFutbol] = useState([]);
  const [bloqueosActivos, setBloqueosActivos] = useState([]);

  const [tasaBCV, setTasaBCV] = useState(36.65);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });

  const [modalReservaOpen, setModalReservaOpen] = useState(false);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState(null);
  const [procesandoReserva, setProcesandoReserva] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(null);

  const [metodoPago, setMetodoPago] = useState("pago_movil");
  const [monedaAbono, setMonedaAbono] = useState("USD"); 
  const [montoAbono, setMontoAbono] = useState("");
  const [numReferencia, setNumReferencia] = useState("");
  const [previewComprobante, setPreviewComprobante] = useState("");

  useEffect(() => {
    setMounted(true);
    cargarDatosIniciales();
  }, []);

  useEffect(() => {
    if (clubSeleccionadoId) {
      cargarCanchasYPartidos(clubSeleccionadoId);
    }
  }, [clubSeleccionadoId, fechaSeleccionada]);

  useEffect(() => {
    if (!supabase) return;
    cargarBloqueos();

    const channel = supabase
      .channel("realtime-futbol-locks")
      .on("postgres_changes", { event: "*", schema: "public", table: "padel_locks" }, () => cargarBloqueos())
      .on("postgres_changes", { event: "*", schema: "public", table: "padel_matches" }, () => {
        if (clubSeleccionadoId) cargarCanchasYPartidos(clubSeleccionadoId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubSeleccionadoId]);

  useEffect(() => {
    let intervalo;
    if (modalReservaOpen && tiempoRestante !== null && tiempoRestante > 0) {
      intervalo = setInterval(() => setTiempoRestante((prev) => prev - 1), 1000);
    } else if (tiempoRestante === 0 && modalReservaOpen) {
      cerrarModalPorTiempoAgotado();
    }
    return () => clearInterval(intervalo);
  }, [tiempoRestante, modalReservaOpen]);

  const mostrarNotificacion = (title, message, type = "info") => {
    setPopupNotif({ open: true, title, message, type });
  };

  async function cargarDatosIniciales() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      try {
        const res = await fetch("/api/bcv-rate");
        if (res.ok) {
          const data = await res.json();
          if (data.usdRate) setTasaBCV(parseFloat(data.usdRate));
        }
      } catch (e) {
        console.warn("Usando tasa fallback BCV");
      }

      const { data: clubsData } = await supabase
        .from("padel_clubs")
        .select("*")
        .eq("is_active", true);

      const clubesConFutbol = (clubsData || []).filter((c) => {
        const sports = Array.isArray(c.sports) ? c.sports : [];
        return sports.includes("futbol");
      });

      setClubes(clubesConFutbol);
      if (clubesConFutbol.length > 0) {
        setClubSeleccionadoId(clubesConFutbol[0].id);
      }
    } catch (err) {
      console.error("Error cargando datos iniciales fútbol:", err);
    } finally {
      setLoading(false);
    }
  }

  async function cargarCanchasYPartidos(cId) {
    try {
      const { data: courtsData } = await supabase
        .from("courts")
        .select("*")
        .eq("club_id", cId)
        .eq("is_active", true)
        .order("court_number", { ascending: true });

      const filtradasFutbol = (courtsData || []).filter((c) => c.sport_type === "futbol" || !c.sport_type);
      setCanchasFutbol(filtradasFutbol);

      const { data: matchesData } = await supabase
        .from("padel_matches")
        .select("*, court:courts(name)")
        .eq("club_id", cId)
        .neq("status", "cancelado");

      setPartidosFutbol(matchesData || []);
    } catch (e) {
      console.error("Error cargando canchas y partidos de fútbol:", e);
    }
  }

  async function cargarBloqueos() {
    try {
      const ahoraISO = new Date().toISOString();
      const { data } = await supabase.from("padel_locks").select("*").gt("expires_at", ahoraISO);
      setBloqueosActivos(data || []);
    } catch (error) {
      console.error("Error cargando bloqueos:", error);
    }
  }

  const cerrarModalPorTiempoAgotado = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    mostrarNotificacion("⏳ Tiempo Expirado", "Han pasado los 10 minutos. La cancha ha sido liberada.", "warning");
    if (bloqueSeleccionado && user) {
      const d = bloqueSeleccionado.dateObj;
      const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
      await supabase.from("padel_locks").delete().match({ court_id: bloqueSeleccionado.cancha.id, scheduled_at: fechaFija, user_id: user.id });
      await cargarBloqueos();
    }
  };

  const cerrarModalManual = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    if (bloqueSeleccionado && user) {
      const d = bloqueSeleccionado.dateObj;
      const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
      await supabase.from("padel_locks").delete().match({ court_id: bloqueSeleccionado.cancha.id, scheduled_at: fechaFija, user_id: user.id });
      await cargarBloqueos();
    }
  };

  const clubActual = useMemo(() => {
    return clubes.find((c) => c.id === clubSeleccionadoId) || null;
  }, [clubes, clubSeleccionadoId]);

  const listAmenidades = useMemo(() => {
    if (!clubActual) return [];
    return Array.isArray(clubActual.amenities) ? clubActual.amenities : ["free_parking", "changing_room"];
  }, [clubActual]);

  const diasSiguientes = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  const bloquesHorarios = useMemo(() => {
    if (!clubActual) return [];
    const duracion = clubActual.slot_duration_minutes || 60;
    const horaApertura = parseInt((clubActual.open_time || "07:00:00").split(":")[0], 10);
    const horaCierre = parseInt((clubActual.close_time || "23:00:00").split(":")[0], 10);

    const bloques = [];
    let cur = new Date(fechaSeleccionada);
    cur.setHours(horaApertura, 0, 0, 0);

    const end = new Date(fechaSeleccionada);
    end.setHours(horaCierre, 0, 0, 0);

    while (cur <= end) {
      if (cur.getHours() === horaCierre && cur.getMinutes() > 0) break;
      const hStr = cur.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });
      bloques.push({
        etiqueta: hStr,
        horaInt: cur.getHours(),
        minutosInt: cur.getMinutes(),
        dateObj: new Date(cur),
      });
      cur.setMinutes(cur.getMinutes() + duracion);
    }
    return bloques;
  }, [clubActual, fechaSeleccionada]);

  const calcularPrecioPorBloque = (cancha, horaInt, minutosInt) => {
    const horaFormateada = `${String(horaInt).padStart(2, '0')}:${String(minutosInt).padStart(2, '0')}`;
    if (!cancha.pricing_blocks || !Array.isArray(cancha.pricing_blocks) || cancha.pricing_blocks.length === 0) {
      const precioNormal = parseFloat(cancha.price_normal);
      return { precio: isNaN(precioNormal) ? 30 : precioNormal };
    }
    const bloqueEncontrado = cancha.pricing_blocks.find((b) => horaFormateada >= (b.start_time || "00:00") && horaFormateada < (b.end_time || "23:59"));
    if (bloqueEncontrado && !isNaN(parseFloat(bloqueEncontrado.price))) {
      return { precio: parseFloat(bloqueEncontrado.price) };
    }
    return { precio: parseFloat(cancha.pricing_blocks[0].price) || 30 };
  };

  const abrirModalTurno = async (cancha, bloque, precioCalculado) => {
    if (!user) {
      mostrarNotificacion("Inicia Sesión", "Debes iniciar sesión para reservar una cancha.", "warning");
      setTimeout(() => router.push("/login"), 1800);
      return;
    }

    const d = bloque.dateObj;
    const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

    const lockExistente = bloqueosActivos.find((l) => l.court_id === cancha.id && l.scheduled_at.substring(0, 16) === fechaFija.substring(0, 16));

    if (lockExistente) {
      return mostrarNotificacion("Cancha en proceso de reserva", "Alguien más está procesando el pago para esta cancha. Intenta nuevamente en unos minutos.", "warning");
    }

    try {
      setProcesandoReserva(true);
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const { error: lockErr } = await supabase.from("padel_locks").upsert({
        court_id: cancha.id,
        scheduled_at: fechaFija,
        user_id: user.id,
        expires_at: expiresAt
      }, { onConflict: 'court_id,scheduled_at' });

      if (lockErr) {
        console.error("Error al bloquear la cancha:", lockErr);
        setProcesandoReserva(false);
        return mostrarNotificacion("Error al Bloquear", lockErr.message || "No se pudo registrar el bloqueo.", "error");
      }

      await cargarBloqueos();

      setTiempoRestante(600);
      setBloqueSeleccionado({
        cancha,
        dateObj: bloque.dateObj,
        horaLabel: bloque.etiqueta,
        precioBaseTotal: precioCalculado,
      });

      setMetodoPago("pago_movil");
      setMonedaAbono("USD");
      setMontoAbono(precioCalculado.toFixed(2));
      setNumReferencia("");
      setPreviewComprobante("");
      setModalReservaOpen(true);
    } catch (e) {
      console.error(e);
      mostrarNotificacion("Error", "Ocurrió un fallo al intentar bloquear la cancha.", "error");
    } finally {
      setProcesandoReserva(false);
    }
  };

  async function confirmarReservaFutbol() {
    if (!user || !bloqueSeleccionado) return;

    const valIngresado = parseFloat(montoAbono);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Ingresa un monto válido a abonar.", "error");
    }

    if (metodoPago !== "efectivo" && !previewComprobante && !numReferencia.trim()) {
      return mostrarNotificacion("Falta Comprobante", "Adjunta tu comprobante o ingresa el número de referencia.", "error");
    }

    const d = bloqueSeleccionado.dateObj;
    const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
    const montoUSD = monedaAbono === "VES" ? valIngresado / tasaBCV : valIngresado;

    try {
      setProcesandoReserva(true);

      const { data: matchExistente } = await supabase
        .from("padel_matches")
        .select("id")
        .eq("court_id", bloqueSeleccionado.cancha.id)
        .eq("scheduled_at", fechaFija)
        .neq("status", "cancelado")
        .maybeSingle();

      if (matchExistente) {
        await supabase.from("padel_locks").delete().match({ court_id: bloqueSeleccionado.cancha.id, scheduled_at: fechaFija });
        await cargarBloqueos();
        setModalReservaOpen(false);
        return mostrarNotificacion("Cancha Ocupada", "Esta cancha acaba de ser reservada por otro usuario.", "warning");
      }

      const { data: userProf } = await supabase.from("profiles").select("nombre, apellido, telefono").eq("id", user.id).maybeSingle();
      const nombreUsuario = userProf ? `${userProf.nombre || ""} ${userProf.apellido || ""}`.trim() : user.email;

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: user.id,
        user_name: nombreUsuario,
        user_phone: userProf?.telefono || "Sin teléfono",
        amount: montoUSD,
        method: metodoPago,
        reference: numReferencia.trim() || "S/R",
        receipt_url: previewComprobante || null,
        status: metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const { data: newMatch, error: matchErr } = await supabase
        .from("padel_matches")
        .insert({
          club_id: clubSeleccionadoId,
          court_id: bloqueSeleccionado.cancha.id,
          scheduled_at: fechaFija,
          total_price: bloqueSeleccionado.precioBaseTotal,
          price_per_player: bloqueSeleccionado.precioBaseTotal / 10,
          app_fee: bloqueSeleccionado.precioBaseTotal * 0.1,
          match_type: "privado",
          is_private: true,
          status: "programado",
          payment_status: metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente_aprobacion",
          payment_method: metodoPago,
          payment_proof_urls: previewComprobante ? [previewComprobante] : [],
          payments_history: [nuevoAbono],
          created_by: user.id,
          notes: "Reserva Fútbol Caimana",
        })
        .select()
        .single();

      if (matchErr) throw matchErr;

      await supabase.from("padel_match_players").insert({ match_id: newMatch.id, user_id: user.id, team: "A" });
      await supabase.from("padel_locks").delete().match({ court_id: bloqueSeleccionado.cancha.id, scheduled_at: fechaFija });
      await cargarBloqueos();

      setTiempoRestante(null);
      setModalReservaOpen(false);
      mostrarNotificacion("🎉 ¡Cancha Reservada!", "Tu reserva de fútbol ha sido registrada exitosamente.", "success");
      await cargarCanchasYPartidos(clubSeleccionadoId);
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes("unique_court_time")) {
        mostrarNotificacion("Cancha ya no disponible", "Alguien más acaba de confirmar una reserva para esta cancha.", "error");
      } else {
        mostrarNotificacion("Error", err.message || "Error al procesar la reserva.", "error");
      }
    } finally {
      setProcesandoReserva(false);
    }
  }

  const formatoTiempo = (segundos) => {
    if (segundos === null) return "";
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 md:px-8 space-y-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HERO BANNER CON INFORMACIÓN DEL CLUB */}
        <div className="relative w-full h-52 sm:h-80 bg-slate-900 rounded-3xl sm:rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200">
          {clubActual?.image_url ? (
            <img src={clubActual.image_url} alt={clubActual.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <span className="bg-emerald-500 text-slate-950 font-black text-[9px] sm:text-[10px] uppercase px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-sm">
                ⚽ Complejo de Fútbol Verificado
              </span>
              <h1 className="text-xl sm:text-4xl font-black">{clubActual?.name || "Canchas de Fútbol"}</h1>
              <p className="text-[11px] sm:text-sm text-slate-300 font-medium">
                📍 {clubActual?.address || "Dirección del club"}, {clubActual?.city || "Ciudad"}
              </p>
            </div>

            <a
              href="#reserva-pistas"
              className="px-5 py-2.5 sm:px-6 sm:py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-lg transition-all text-center"
            >
              ⚡ Reservar Cancha
            </a>
          </div>
        </div>

        {/* LAYOUT EN 2 COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* DETALLES Y AMENIDADES DEL CLUB */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Cambiar Complejo Deportivo</label>
                <select
                  value={clubSeleccionadoId || ""}
                  onChange={(e) => setClubSeleccionadoId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 outline-none"
                >
                  {clubes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
                  ))}
                </select>
              </div>

              {clubActual?.description && (
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase mb-1">Sobre el Complejo</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{clubActual.description}</p>
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">Amenidades</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {listAmenidades.map((key) => {
                    const am = AMENIDADES_MAP[key] || { label: key, icon: "✨" };
                    return (
                      <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold">
                        <span>{am.icon}</span>
                        <span>{am.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* PARTE DERECHA: SELECCIÓN DE DÍAS Y GRILLA */}
          <div className="lg:col-span-8 space-y-6" id="reserva-pistas">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="text-base sm:text-lg font-black text-slate-900">Reserva tu Cancha en Tiempo Real</h2>
                <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  {canchasFutbol.length} canchas
                </span>
              </div>

              {/* Selector de Días */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-2">
                {diasSiguientes.map((d, i) => {
                  const isSel = fechaSeleccionada.toDateString() === d.toDateString();
                  return (
                    <button
                      key={i}
                      onClick={() => setFechaSeleccionada(d)}
                      className={`shrink-0 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-center border transition-all ${
                        isSel ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-md" : "bg-slate-50 text-slate-600 border-slate-200 font-bold"
                      }`}
                    >
                      <span className="text-[9px] sm:text-[10px] font-black uppercase block opacity-60">
                        {i === 0 ? "Hoy" : d.toLocaleDateString("es-ES", { weekday: "short" })}
                      </span>
                      <span className="text-xs sm:text-sm font-black block mt-0.5">
                        {d.getDate()} {d.toLocaleDateString("es-ES", { month: "short" })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* GRILLA DE CANCHAS DE FÚTBOL */}
              <div className="overflow-x-auto relative rounded-2xl border-2 border-slate-300 bg-white shadow-xs">
                <div className="inline-min-w-full min-w-[500px] w-full">
                  
                  <div className="flex bg-slate-950 text-white border-b-2 border-slate-800 sticky top-0 z-30">
                    <div className="w-16 sm:w-24 shrink-0 p-2 sm:p-3 font-black text-[10px] sm:text-[11px] text-slate-300 text-center uppercase tracking-wider border-r border-slate-800 bg-slate-950">
                      Hora
                    </div>
                    {canchasFutbol.map((c) => (
                      <div key={c.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-2 sm:p-3 text-center border-l border-slate-800 font-black text-[11px] sm:text-xs uppercase tracking-tight">
                        ⚽ {c.name}
                      </div>
                    ))}
                  </div>

                  {canchasFutbol.length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold text-slate-400">
                      Este complejo aún no tiene canchas de fútbol configuradas.
                    </div>
                  ) : (
                    bloquesHorarios.map((bloque, idx) => (
                      <div key={idx} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors h-20">
                        <div className="w-16 sm:w-24 shrink-0 flex flex-col items-center justify-center bg-slate-100 border-r-2 border-slate-300 p-1 text-center font-black text-xs text-slate-900">
                          <span>{bloque.etiqueta.split(" ")[0]}</span>
                          <span className="text-[9px] text-slate-500 uppercase">{bloque.etiqueta.split(" ")[1]}</span>
                        </div>

                        {canchasFutbol.map((cancha) => {
                          const ano = fechaSeleccionada.getFullYear();
                          const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
                          const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
                          const hora = String(bloque.horaInt).padStart(2, '0');
                          const minutos = String(bloque.minutosInt).padStart(2, '0');
                          const fechaSlotGrid = `${ano}-${mes}-${dia}T${hora}:${minutos}`;

                          const partidoOcupado = partidosFutbol.find((m) => m.court_id === cancha.id && m.scheduled_at.substring(0, 16) === fechaSlotGrid);
                          const lockOcupado = bloqueosActivos.find((l) => l.court_id === cancha.id && l.scheduled_at.replace(" ", "T").substring(0, 16) === fechaSlotGrid);

                          const { precio: precioUSD } = calcularPrecioPorBloque(cancha, bloque.horaInt, bloque.minutosInt);

                          if (partidoOcupado) {
                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 bg-slate-950 text-white flex flex-col justify-between shadow-xs border-2 border-slate-800 opacity-90 cursor-not-allowed">
                                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 self-start">RESERVADO</span>
                                  <p className="text-[11px] font-black text-slate-300">Cancha Reservada</p>
                                </div>
                              </div>
                            );
                          }

                          if (lockOcupado) {
                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 flex flex-col items-center justify-center shadow-xs border-2 border-dashed border-amber-400 bg-amber-50/50 text-center cursor-not-allowed">
                                  <span className="text-xl animate-pulse">⏳</span>
                                  <p className="text-[10px] font-black text-amber-600 mt-1">En proceso...</p>
                                  <p className="text-[8px] font-bold text-amber-700/60 mt-0.5">Alguien está pagando</p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200">
                              <button
                                onClick={() => abrirModalTurno(cancha, bloque, precioUSD)}
                                className="h-full w-full bg-slate-50/70 hover:bg-emerald-50/80 text-emerald-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-all group shadow-2xs relative cursor-pointer"
                              >
                                <span className="text-[11px] sm:text-xs font-black text-emerald-700 group-hover:scale-105 transition-transform">+ Agendar</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-0.5">${precioUSD.toFixed(2)}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* MODAL PASARELA DE PAGO FÚTBOL */}
      {mounted && modalReservaOpen && bloqueSeleccionado && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4" onClick={cerrarModalManual}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="border-b pb-3 space-y-2 relative">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">Reserva de Cancha de Fútbol</span>
                  <h3 className="text-lg font-black text-slate-900">{bloqueSeleccionado.cancha.name}</h3>
                </div>
                <button onClick={cerrarModalManual} className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1">✕</button>
              </div>

              {tiempoRestante !== null && (
                <div className={`absolute top-0 right-8 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border shadow-sm ${tiempoRestante < 60 ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                  <span>⏳</span>
                  <span>{formatoTiempo(tiempoRestante)}</span>
                </div>
              )}

              <div className="bg-slate-900 text-white p-2.5 rounded-2xl flex justify-between items-center text-xs font-bold shadow-sm">
                <span>📅 {fechaSeleccionada.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className="bg-[#00FF9D] text-slate-950 px-2.5 py-1 rounded-xl font-black">{bloqueSeleccionado.horaLabel}</span>
              </div>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-700">
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1.5">
                <div className="flex justify-between items-start text-[#00FF9D]">
                  <span>Total Cancha Fútbol:</span>
                  <div className="text-right">
                    <span className="font-black">${bloqueSeleccionado.precioBaseTotal.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400/80 block">Bs. {(bloqueSeleccionado.precioBaseTotal * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block">Monto a Abonar Hoy ($ / Bs):</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-lg font-black text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 En Sitio" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetodoPago(m.id)}
                      className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase border transition-all ${metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {metodoPago !== "efectivo" && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">N° Referencia</label>
                    <input
                      type="text"
                      placeholder="Ej. #123456"
                      value={numReferencia}
                      onChange={(e) => setNumReferencia(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Comprobante (Imagen)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => setPreviewComprobante(reader.result);
                        reader.readAsDataURL(file);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none"
                    />
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={confirmarReservaFutbol}
                disabled={procesandoReserva}
                className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-xs tracking-wider rounded-2xl shadow-md cursor-pointer"
              >
                {procesandoReserva ? "Procesando..." : "Confirmar Reserva de Fútbol"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* POPUP NOTIFICACIÓN */}
      {mounted && popupNotif.open && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900">{popupNotif.title}</h3>
            <p className="text-xs font-bold text-slate-600">{popupNotif.message}</p>
            <button
              onClick={() => setPopupNotif({ ...popupNotif, open: false })}
              className="w-full py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl hover:bg-slate-800 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}