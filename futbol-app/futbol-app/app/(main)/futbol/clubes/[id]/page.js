"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const AMENIDADES_MAP = {
  equipment_rental: { label: "Alquiler de Balones / Petos", icon: "⚽" },
  free_parking: { label: "Estacionamiento Gratis", icon: "🚗" },
  store: { label: "Tienda Deportiva", icon: "🛍️" },
  restaurant: { label: "Restaurante", icon: "🍔" },
  cafeteria: { label: "Cafetería / Sport Bar", icon: "☕" },
  changing_room: { label: "Vestuarios y Duchas", icon: "🚿" },
  wifi: { label: "WiFi Gratis", icon: "📶" },
  lockers: { label: "Lockers / Casilleros", icon: "🔐" },
};

function obtenerEpoch(fechaStr) {
  if (!fechaStr) return 0;
  if (fechaStr instanceof Date) return fechaStr.getTime();
  let clean = String(fechaStr).trim().replace(" ", "T");
  const tieneOffset = clean.includes("Z") || clean.includes("+") || (clean.indexOf("-", 10) !== -1);
  if (!tieneOffset) {
    clean = clean.substring(0, 19) + "-04:00";
  }
  return new Date(clean).getTime();
}

function parsearFechaVET(fechaStr) {
  if (!fechaStr) return new Date();
  const cleanStr = fechaStr.replace(" ", "T").substring(0, 19);
  const isoVET = cleanStr.endsWith("Z") ? cleanStr.slice(0, -1) : cleanStr + "-04:00";
  return new Date(isoVET);
}

function formatearFechaISOVET(dateObj) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dateObj);
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${year}-${month}-${day}`;
}

function crearFechaVET(dateYYYYMMDD, hora24, minutos24) {
  const hStr = String(hora24).padStart(2, "0");
  const mStr = String(minutos24).padStart(2, "0");
  return new Date(`${dateYYYYMMDD}T${hStr}:${mStr}:00-04:00`);
}

function horarioYaPaso(dateObj) {
  const ahora = new Date();
  return dateObj.getTime() <= ahora.getTime();
}

export default function FutbolClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id;

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [club, setClub] = useState(null);
  const [canchas, setCanchas] = useState([]);
  const [partidosClub, setPartidosClub] = useState([]);
  const [bloqueosActivos, setBloqueosActivos] = useState([]);

  // Tasa BCV Oficial
  const [tasaBCV, setTasaBCV] = useState(36.65);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [promocionHoy, setPromocionHoy] = useState(null);

  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });
  
  // Modales de Reserva
  const [modalReservaOpen, setModalReservaOpen] = useState(false);
  const [pasoModal, setPasoModal] = useState(1);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState(null);
  const [procesandoReserva, setProcesandoReserva] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(null);

  const [tipoReserva, setTipoReserva] = useState("privado");
  const [metodoPago, setMetodoPago] = useState("pago_movil");
  const [monedaAbono, setMonedaAbono] = useState("USD");
  const [montoAbono, setMontoAbono] = useState("");
  const [numReferencia, setNumReferencia] = useState("");
  const [previewComprobante, setPreviewComprobante] = useState("");

  useEffect(() => {
    setMounted(true);
    if (clubId) {
      cargarDatosIniciales();
    } else {
      setLoading(false);
    }
  }, [clubId]);

  async function cargarDatosIniciales() {
    setLoading(true);
    try {
      await Promise.all([obtenerTasaBCV(), cargarDetalleClub()]);
    } catch (e) {
      console.error("Error en carga inicial", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clubId && mounted && !loading) {
      cargarPromocionDelDia();
    }
  }, [fechaSeleccionada, clubId, mounted, loading]);

  useEffect(() => {
    if (!clubId || !supabase) return;
    cargarBloqueos();

    const channel = supabase.channel(`locks_club_${clubId}`, {
      config: { broadcast: { self: true } }
    });

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "padel_locks" }, () => {
        cargarBloqueos();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `club_id=eq.${clubId}` }, () => {
        cargarDetalleClub();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players" }, () => {
        cargarDetalleClub();
      })
      .on("broadcast", { event: "lock_event" }, (payload) => {
        const data = payload.payload;
        if (data?.type === "INSERT") {
          setBloqueosActivos((prev) => [
            ...prev.filter((l) => !(l.court_id === data.lock.court_id && Math.abs(obtenerEpoch(l.scheduled_at) - obtenerEpoch(data.lock.scheduled_at)) < 5000)),
            data.lock,
          ]);
        } else if (data?.type === "DELETE") {
          setBloqueosActivos((prev) =>
            prev.filter((l) => !(l.court_id === data.court_id && Math.abs(obtenerEpoch(l.scheduled_at) - obtenerEpoch(data.scheduled_at)) < 5000))
          );
        }
      })
      .on("broadcast", { event: "match_event" }, (payload) => {
        if (payload.payload?.type === "INSERT_MATCH") {
          cargarDetalleClub();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

  useEffect(() => {
    let intervalo;
    if (modalReservaOpen && tiempoRestante !== null) {
      if (tiempoRestante > 0) {
        intervalo = setInterval(() => {
          setTiempoRestante((prev) => prev - 1);
        }, 1000);
      } else if (tiempoRestante === 0 && modalReservaOpen) {
        cerrarModalPorTiempoAgotado();
      }
    }
    return () => clearInterval(intervalo);
  }, [tiempoRestante, modalReservaOpen]);

  const mostrarNotificacion = (title, message, type = "info") => {
    setPopupNotif({ open: true, title, message, type });
  };

  async function obtenerTasaBCV() {
    try {
      const res = await fetch("/api/bcv-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) return setTasaBCV(parseFloat(data.usdRate));
      }
      const resFallback = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
      if (resFallback.ok) {
        const dataFallback = await resFallback.json();
        if (dataFallback?.promedio) return setTasaBCV(parseFloat(dataFallback.promedio));
      }
    } catch (e) {
      console.warn("No se pudo obtener la tasa BCV.", e);
    }
  }

  async function cargarBloqueos() {
    try {
      const ahoraISO = new Date().toISOString();
      const { data } = await supabase
        .from("padel_locks")
        .select("*")
        .gt("expires_at", ahoraISO);
      setBloqueosActivos(data || []);
    } catch (error) {
      console.error("Error cargando bloqueos", error);
    }
  }

  const cerrarModalPorTiempoAgotado = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    mostrarNotificacion(
      "⏱️ Tiempo Expirado",
      "Han pasado los 10 minutos. La cancha de fútbol ha sido liberada para otros usuarios.",
      "warning"
    );

    if (bloqueSeleccionado && user) {
      const scheduledAtISO = bloqueSeleccionado.dateObj.toISOString();
      
      const channel = supabase.channel(`locks_club_${clubId}`);
      channel.send({
        type: "broadcast",
        event: "lock_event",
        payload: { type: "DELETE", court_id: bloqueSeleccionado.cancha.id, scheduled_at: scheduledAtISO },
      });

      await supabase
        .from("padel_locks")
        .delete()
        .eq("court_id", bloqueSeleccionado.cancha.id)
        .eq("user_id", user.id);
      
      await cargarBloqueos();
    }
  };

  const cerrarModalManual = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    
    if (bloqueSeleccionado && user) {
      const scheduledAtISO = bloqueSeleccionado.dateObj.toISOString();
      
      const channel = supabase.channel(`locks_club_${clubId}`);
      channel.send({
        type: "broadcast",
        event: "lock_event",
        payload: { type: "DELETE", court_id: bloqueSeleccionado.cancha.id, scheduled_at: scheduledAtISO },
      });

      await supabase
        .from("padel_locks")
        .delete()
        .eq("court_id", bloqueSeleccionado.cancha.id)
        .eq("user_id", user.id);
        
      await cargarBloqueos();
    }
  };

  async function cargarPromocionDelDia() {
    try {
      const hoyStr = formatearFechaISOVET(fechaSeleccionada);
      const { data: promoActiva } = await supabase
        .from("padel_promotions")
        .select("*")
        .eq("club_id", clubId)
        .lte("start_date", hoyStr)
        .gte("end_date", hoyStr)
        .maybeSingle();
      setPromocionHoy(promoActiva || null);
    } catch (e) {
      console.error("Error buscando promo", e);
    }
  }

  async function cargarDetalleClub() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }

      const { data: clubData, error: cErr } = await supabase
        .from("clubs")
        .select(`id, name, city, address, image_url, amenities, open_time, close_time, slot_duration_minutes`)
        .eq("id", clubId)
        .maybeSingle();

      if (cErr || !clubData) {
        setClub(null);
        return;
      }
      setClub(clubData);

      const { data: courtsData } = await supabase
        .from("courts")
        .select(`id, name, sport_type, capacity, price_normal, pricing_blocks`)
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("court_number", { ascending: true });

      const canchasFutbol = (courtsData || []).filter((c) => c.sport_type === "futbol");
      setCanchas(canchasFutbol);

      const { data: matchesData } = await supabase
        .from("matches")
        .select(`*, court:courts(name)`)
        .eq("club_id", clubId)
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: true });

      const matchIds = (matchesData || []).map((m) => m.id);

      if (matchIds.length > 0) {
        const { data: playersData } = await supabase
          .from("match_players")
          .select(`id, match_id, user_id, team`)
          .in("match_id", matchIds);

        const allUserIds = Array.from(new Set((playersData || []).map((p) => p.user_id).filter(Boolean)));
        let profilesMap = {};

        if (allUserIds.length > 0) {
          const { data: profsData } = await supabase
            .from("profiles")
            .select("id, nombre, apellido, avatar_url, telefono")
            .in("id", allUserIds);
          (profsData || []).forEach((p) => { profilesMap[p.id] = p; });
        }

        const playersByMatch = {};
        (playersData || []).forEach((p) => {
          if (!playersByMatch[p.match_id]) playersByMatch[p.match_id] = [];
          playersByMatch[p.match_id].push({
            ...p,
            profile: profilesMap[p.user_id] || null,
          });
        });

        const partidosFinales = matchesData.map((m) => ({
          ...m,
          players: playersByMatch[m.id] || [],
        }));
        setPartidosClub(partidosFinales);
      } else {
        setPartidosClub(matchesData || []);
      }
    } catch (err) {
      console.error("Error cargando detalle del club", err);
    } finally {
      cargarPromocionDelDia();
    }
  }

  const calcularPrecioPorBloque = (cancha, horaInt, minutosInt) => {
    try {
      const horaFormateada = `${String(horaInt).padStart(2, "0")}:${String(minutosInt).padStart(2, "0")}`;
      if (!cancha.pricing_blocks || !Array.isArray(cancha.pricing_blocks) || cancha.pricing_blocks.length === 0) {
        const precioNormal = parseFloat(cancha.price_normal);
        return { precio: isNaN(precioNormal) ? 30 : precioNormal };
      }
      const bloqueEncontrado = cancha.pricing_blocks.find((bloque) => {
        return horaFormateada >= bloque.start_time && horaFormateada <= bloque.end_time;
      });
      if (bloqueEncontrado && !isNaN(parseFloat(bloqueEncontrado.price))) {
        return { precio: parseFloat(bloqueEncontrado.price) };
      }
      const primerPrecio = parseFloat(cancha.pricing_blocks[0].price);
      return { precio: isNaN(primerPrecio) ? 30 : primerPrecio };
    } catch (error) {
      return { precio: 30 };
    }
  };

  const diasSiguientes = useMemo(() => {
    const list = [];
    const hoyISO = formatearFechaISOVET(new Date());
    const [y, m, d] = hoyISO.split("-").map(Number);
    for (let i = 0; i < 7; i++) {
      const dateObj = crearFechaVET(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, 12, 0);
      dateObj.setDate(dateObj.getDate() + i);
      list.push(dateObj);
    }
    return list;
  }, []);

  const bloquesHorarios = useMemo(() => {
    if (!club) return [];
    const duracion = club.slot_duration_minutes || 60;
    const horaApertura = parseInt(club.open_time || "07:00:00".split(":")[0], 10);
    const horaCierre = parseInt(club.close_time || "23:00:00".split(":")[0], 10);

    const fechaSelISO = formatearFechaISOVET(fechaSeleccionada);
    const bloques = [];

    let curH = horaApertura;
    let curM = 0;

    while (curH < horaCierre || (curH === horaCierre && curM === 0)) {
      if (curH === horaCierre && curM === 0) break;
      const dateObjSlot = crearFechaVET(fechaSelISO, curH, curM);
      const hLabel = dateObjSlot.toLocaleTimeString("es-ES", {
        timeZone: "America/Caracas",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      bloques.push({
        etiqueta: hLabel,
        horaInt: curH,
        minutosInt: curM,
        dateObj: dateObjSlot,
      });

      curM += duracion;
      if (curM >= 60) {
        curH += Math.floor(curM / 60);
        curM = curM % 60;
      }
    }
    return bloques;
  }, [club, fechaSeleccionada]);

  const abrirModalTurno = async (cancha, bloque, precioCalculado) => {
    if (!user) {
      mostrarNotificacion("Inicia Sesión", "Debes iniciar sesión para reservar una cancha.", "warning");
      setTimeout(() => router.push("/login"), 1800);
      return;
    }
    if (horarioYaPaso(bloque.dateObj)) {
      mostrarNotificacion("Horario no disponible", "Este bloque ya pasó y no puede ser reservado.", "warning");
      return;
    }

    const slotTime = bloque.dateObj.getTime();
    
    const lockExistente = bloqueosActivos.find((l) => {
      if (l.court_id !== cancha.id) return false;
      const lockTime = obtenerEpoch(l.scheduled_at);
      return Math.abs(lockTime - slotTime) < 5000;
    });

    if (lockExistente && lockExistente.user_id !== user.id) {
      return mostrarNotificacion(
        "⏳ Cancha en proceso de reserva",
        "Alguien más está procesando el pago para esta cancha ahora mismo. Si no completa la reserva en 10 minutos, volverá a estar disponible.",
        "warning"
      );
    }

    try {
      setProcesandoReserva(true);
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const fechaISO = formatearFechaISOVET(bloque.dateObj);
      const hStr = String(bloque.horaInt).padStart(2, "0");
      const mStr = String(bloque.minutosInt).padStart(2, "0");
      const scheduledAtISO = `${fechaISO}T${hStr}:${mStr}:00-04:00`;

      const nuevoLock = {
        court_id: cancha.id,
        scheduled_at: scheduledAtISO,
        user_id: user.id,
        expires_at: expiresAt,
      };

      setBloqueosActivos((prev) => [
        ...prev.filter((l) => !(l.court_id === cancha.id && Math.abs(obtenerEpoch(l.scheduled_at) - slotTime) < 5000)),
        nuevoLock,
      ]);

      const channel = supabase.channel(`locks_club_${clubId}`);
      channel.send({
        type: "broadcast",
        event: "lock_event",
        payload: { type: "INSERT", lock: nuevoLock },
      });

      const { error: lockErr } = await supabase
        .from("padel_locks")
        .upsert(nuevoLock, { onConflict: "court_id,scheduled_at" });

      if (lockErr) throw lockErr;

      setTiempoRestante(600); 
      const precioBaseTotal = precioCalculado || cancha.price_normal || 30;

      setBloqueSeleccionado({
        cancha,
        dateObj: bloque.dateObj,
        horaLabel: bloque.etiqueta,
        precioBaseTotal,
      });

      setTipoReserva("privado");
      setMetodoPago("pago_movil");
      setMonedaAbono("USD");
      setMontoAbono((precioBaseTotal * 1.10).toFixed(2));
      setNumReferencia("");
      setPreviewComprobante("");
      setPasoModal(1);
      setModalReservaOpen(true);
    } catch (e) {
      console.error("Error al bloquear la cancha", e);
      mostrarNotificacion("Error", "No se pudo iniciar la reserva, intenta nuevamente.", "error");
      await cargarBloqueos();
    } finally {
      setProcesandoReserva(false);
    }
  };

  const handleSeleccionarImagen = (e, setPreview) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return mostrarNotificacion("Archivo Inválido", "Por favor selecciona una imagen válida (JPG, PNG).", "error");
    }
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const calculosPrecio = useMemo(() => {
    if (!bloqueSeleccionado) return { base: 0, fee: 0, totalSug: 0, precioIndividual: 0, capacidadOficial: 10 };
    const baseTotal = bloqueSeleccionado.precioBaseTotal;
    const feeTotal = baseTotal * 0.10;
    const capBD = bloqueSeleccionado.cancha?.capacity || 10;

    const baseCalculada = tipoReserva === "privado" ? baseTotal : (baseTotal / capBD);
    const feeCalculado = tipoReserva === "privado" ? feeTotal : (feeTotal / capBD);
    
    return {
      base: baseCalculada,
      fee: feeCalculado,
      totalSug: baseCalculada + feeCalculado,
      precioIndividual: (baseTotal + feeTotal) / capBD,
      capacidadOficial: capBD
    };
  }, [bloqueSeleccionado, tipoReserva]);

  const cambiarMonedaAbono = (nuevaMoneda) => {
    if (nuevaMoneda === monedaAbono) return;
    const valActual = parseFloat(montoAbono);
    if (!isNaN(valActual) && valActual > 0) {
      setMontoAbono(nuevaMoneda === "VES" ? (valActual * tasaBCV).toFixed(2) : (valActual / tasaBCV).toFixed(2));
    }
    setMonedaAbono(nuevaMoneda);
  };

  async function confirmarReservaYPago() {
    if (!user || !bloqueSeleccionado) return;

    const valIngresado = parseFloat(montoAbono);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Por favor ingresa un monto válido a abonar.", "error");
    }
    if (metodoPago !== "efectivo" && !previewComprobante && !numReferencia.trim()) {
      return mostrarNotificacion("Falta Comprobante", "Por favor adjunta la captura de tu comprobante de pago o ingresa el número de referencia.", "error");
    }

    const montoUSD = monedaAbono === "VES" ? (valIngresado / tasaBCV) : valIngresado;
    const esPrivado = tipoReserva === "privado";

    try {
      setProcesandoReserva(true);

      const { data: userProf } = await supabase.from("profiles").select("nombre, apellido, telefono").eq("id", user.id).maybeSingle();
      const nombreUsuario = userProf ? `${userProf.nombre} ${userProf.apellido}`.trim() : user.email;

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: user.id,
        username: nombreUsuario,
        userphone: userProf?.telefono || "Sin teléfono",
        amount: montoUSD,
        method: metodoPago,
        reference: numReferencia.trim() || (monedaAbono === "VES" ? `Abono Bs. ${valIngresado.toFixed(2)} S/R` : ""),
        receipt_url: previewComprobante || null,
        status: metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const scheduledAtISO = bloqueSeleccionado.dateObj.toISOString();

      const { data: newMatch, error: matchErr } = await supabase
        .from("matches")
        .insert({
          club_id: clubId,
          court_id: bloqueSeleccionado.cancha.id,
          scheduled_at: scheduledAtISO,
          total_price: bloqueSeleccionado.precioBaseTotal,
          price_per_player: calculosPrecio.precioIndividual,
          app_fee: calculosPrecio.fee,
          match_type: esPrivado ? "privado" : "abierto",
          is_private: esPrivado,
          is_competitive: !esPrivado,
          status: "programado",
          payment_status: metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente_aprobacion",
          payment_method: metodoPago,
          payment_proof_urls: previewComprobante ? [previewComprobante] : [],
          payments_history: [nuevoAbono],
          created_by: user.id,
          notes: "Reserva de Fútbol",
        })
        .select()
        .single();

      if (matchErr) throw new Error(matchErr.message);

      await supabase.from("match_players").insert({ match_id: newMatch.id, user_id: user.id, team: "1" });
      await supabase.from("padel_locks").delete().eq("court_id", bloqueSeleccionado.cancha.id).eq("user_id", user.id);

      setModalReservaOpen(false);
      router.push(`/futbol/partidos/${newMatch.id}`);
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error al Reservar", err.message || "Verifica los datos e inténtalo de nuevo.", "error");
    } finally {
      setProcesandoReserva(false);
    }
  }

  const formatoTiempo = (segundos) => {
    if (segundos === null) return "";
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center space-y-4">
        <h2 className="text-xl font-black text-slate-900">Complejo no encontrado</h2>
        <Link href="/futbol/clubes" className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs inline-block">
          Volver al directorio
        </Link>
      </div>
    );
  }

  const listAmenidades = Array.isArray(club.amenities) ? club.amenities : ["wifi", "free_parking", "changing_room"];
  const numIngresado = parseFloat(montoAbono) || 0;
  const equivalenteCalculado = monedaAbono === "USD" ? numIngresado * tasaBCV : numIngresado / tasaBCV;

  return (
    <div className="min-h-screen bg-slate-50/50 px-2 py-4 sm:px-6 md:px-8 space-y-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HERO BANNER */}
        <div className="relative w-full h-52 sm:h-80 bg-slate-900 rounded-3xl overflow-hidden shadow-xl border border-slate-200">
          {club.image_url ? (
            <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <span className="bg-emerald-500 text-slate-950 font-black text-[9px] sm:text-[10px] uppercase px-3 py-1 rounded-full shadow-sm">
                ✅ Complejo de Fútbol Verificado
              </span>
              <h1 className="text-xl sm:text-4xl font-black">{club.name}</h1>
              <p className="text-[11px] sm:text-sm text-slate-300 font-medium">📍 {club.address} — {club.city}</p>
            </div>
            <div>
              <a href="#reserva-pistas" className="px-5 py-2.5 sm:px-6 sm:py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all text-center">
                Reservar Cancha
              </a>
            </div>
          </div>
        </div>

        {/* LAYOUT 2 COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">Amenidades</h3>
              <div className="flex flex-wrap gap-2">
                {listAmenidades.map((key) => {
                  const am = AMENIDADES_MAP[key] || { label: key, icon: "✨" };
                  return (
                    <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                      <span>{am.icon}</span>
                      <span>{am.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6" id="reserva-pistas">
            <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="text-base sm:text-lg font-black text-slate-900">Reserva tu Cancha en Tiempo Real</h2>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">{canchas.length} canchas</span>
              </div>

              {/* Selector de Días */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {diasSiguientes.map((dObj, i) => {
                  const isSel = formatearFechaISOVET(fechaSeleccionada) === formatearFechaISOVET(dObj);
                  return (
                    <button
                      key={i}
                      onClick={() => setFechaSeleccionada(dObj)}
                      className={`shrink-0 px-4 py-2.5 rounded-2xl border text-center transition-all ${
                        isSel ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-md" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase block opacity-60">
                        {i === 0 ? "Hoy" : dObj.toLocaleDateString("es-ES", { timeZone: "America/Caracas", weekday: "short" })}
                      </span>
                      <span className="text-xs sm:text-sm font-black block mt-0.5">
                        {dObj.toLocaleDateString("es-ES", { timeZone: "America/Caracas", day: "numeric" })} {dObj.toLocaleDateString("es-ES", { timeZone: "America/Caracas", month: "short" })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* AVISO DE PROMOCIÓN */}
              {promocionHoy && (
                <div className="bg-rose-50 border border-rose-200 p-3 sm:p-4 rounded-2xl flex items-center gap-3 shadow-sm my-4">
                  <span className="text-3xl animate-bounce">🔥</span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-tight">{promocionHoy.name}</h4>
                    <p className="text-[10px] sm:text-xs font-bold text-rose-700">¡Aprovecha! Precios especiales aplicados en las tarifas de hoy.</p>
                  </div>
                </div>
              )}

              {/* GRILLA DE CANCHAS DE FÚTBOL */}
              <div className="overflow-x-auto relative rounded-2xl border-2 border-slate-300 bg-white shadow-xs">
                <div className="min-w-[500px] w-full">
                  {/* CABECERA PISTAS */}
                  <div className="flex bg-slate-950 text-white border-b-2 border-slate-800 sticky top-0 z-30">
                    <div className="w-20 p-3 font-black text-xs text-slate-300 text-center uppercase tracking-wider border-r border-slate-800 bg-slate-950">
                      Hora
                    </div>
                    {canchas.map((c) => (
                      <div key={c.id} className="flex-1 min-w-[150px] p-3 text-center border-l border-slate-800 font-black text-xs uppercase">
                        <span>{c.name}</span>
                        <span className="text-[9px] text-slate-400 block">({c.capacity || 10} JUGADORES)</span>
                      </div>
                    ))}
                  </div>

                  {canchas.length === 0 ? (
                    <div className="p-8 text-center text-xs font-bold text-slate-400">
                      Este complejo no tiene canchas de fútbol configuradas.
                    </div>
                  ) : (
                    /* FILAS DE HORARIOS */
                    bloquesHorarios.map((bloque, idx) => (
                      <div key={idx} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors h-20">
                        <div className="w-20 shrink-0 flex flex-col items-center justify-center bg-slate-100 border-r-2 border-slate-300 p-1 text-center">
                          <span className="text-xs font-black text-slate-900">{bloque.etiqueta.split(" ")[0]}</span>
                          <span className="text-[9px] font-extrabold text-slate-500 uppercase">{bloque.etiqueta.split(" ")[1]}</span>
                        </div>

                        {/* CELDAS CANCHAS */}
                        {canchas.map((cancha) => {
                          const targetTime = bloque.dateObj.getTime();
                          const bloqueVencido = horarioYaPaso(bloque.dateObj);
                          const partidoOcupado = partidosClub.find((m) => m.court_id === cancha.id && Math.abs(obtenerEpoch(m.scheduled_at) - targetTime) < 5000);
                          const lockOcupado = bloqueosActivos.find((l) => l.court_id === cancha.id && Math.abs(obtenerEpoch(l.scheduled_at) - targetTime) < 5000);

                          const { precio: precioOriginal } = calcularPrecioPorBloque(cancha, bloque.horaInt, bloque.minutosInt);
                          let precioUSD = precioOriginal;
                          let esPromoAplicada = false;

                          if (promocionHoy) {
                            const hasBlocks = promocionHoy.time_blocks && promocionHoy.time_blocks.length > 0;
                            if (hasBlocks) {
                              const hStr = String(bloque.horaInt).padStart(2, "0");
                              const mStr = String(bloque.minutosInt).padStart(2, "0");
                              const horaBotonStr = `${hStr}:${mStr}`;
                              const bloqueAplicable = promocionHoy.time_blocks.find((b) => {
                                return horaBotonStr >= b.start_time && horaBotonStr <= (b.end_time || "23:59");
                              });
                              if (bloqueAplicable && !isNaN(parseFloat(bloqueAplicable.price))) {
                                precioUSD = parseFloat(bloqueAplicable.price);
                                esPromoAplicada = true;
                              }
                            } else {
                              const promoPrice = parseFloat(promocionHoy.price_normal);
                              precioUSD = isNaN(promoPrice) ? precioOriginal : promoPrice;
                              esPromoAplicada = true;
                            }
                          }

                          if (partidoOcupado) {
                            const esMiReserva = !!user && (
                              partidoOcupado.created_by === user.id ||
                              (Array.isArray(partidoOcupado.players) && partidoOcupado.players.some((p) => p.user_id === user.id))
                            );

                            if (esMiReserva) {
                              return (
                                <div key={cancha.id} className="flex-1 min-w-[150px] p-1 border-l border-slate-200">
                                  <Link href={`/futbol/partidos/${partidoOcupado.id}`} className="block h-full">
                                    <div className="h-full w-full rounded-xl p-2 flex flex-col justify-between shadow-xs border-2 text-left bg-emerald-950 text-white border-emerald-500 hover:bg-emerald-900 transition-all">
                                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#00FF9D] text-slate-950 truncate">
                                        MI RESERVA
                                      </span>
                                      <div>
                                        <p className="text-xs font-black text-white">Ver Partido ⚽</p>
                                        <p className="text-[8px] text-slate-300 font-bold">Haz clic para gestionar</p>
                                      </div>
                                    </div>
                                  </Link>
                                </div>
                              );
                            }

                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 flex flex-col justify-between shadow-xs border-2 text-left bg-slate-950 text-white border-slate-800 opacity-90 cursor-not-allowed">
                                  <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">RESERVADO</span>
                                  <p className="text-xs font-black text-slate-400">Cancha Reservada</p>
                                </div>
                              </div>
                            );
                          }

                          if (lockOcupado) {
                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 flex flex-col items-center justify-center border-2 border-dashed border-amber-400 bg-amber-50/50 text-center cursor-not-allowed">
                                  <span className="text-xl animate-pulse">⏳</span>
                                  <p className="text-xs font-black text-amber-600 mt-1">En proceso...</p>
                                </div>
                              </div>
                            );
                          }

                          if (bloqueVencido) {
                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 flex flex-col items-center justify-center border-2 border-slate-200 bg-slate-100 text-center cursor-not-allowed opacity-75">
                                  <span className="text-lg">⏰</span>
                                  <p className="text-xs font-black text-slate-500 mt-1">Horario finalizado</p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={cancha.id} className="flex-1 min-w-[150px] p-1 border-l border-slate-200">
                              <button
                                onClick={() => abrirModalTurno(cancha, bloque, precioUSD)}
                                className="h-full w-full bg-slate-50 hover:bg-emerald-50 text-emerald-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-all cursor-pointer"
                              >
                                {esPromoAplicada && (
                                  <span className="text-[8px] font-black uppercase bg-rose-100 text-rose-600 px-1 py-0.5 rounded shadow-xs mb-0.5">
                                    Promo
                                  </span>
                                )}
                                <span className="text-xs font-black text-emerald-700">Agendar ➕</span>
                                <span className="text-[10px] font-bold text-slate-500 mt-0.5">${precioUSD.toFixed(2)}</span>
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

      {/* MODAL PASARELA DE PAGO CLIENTE */}
      {mounted && modalReservaOpen && bloqueSeleccionado && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={cerrarModalManual}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 block">⚽ Reserva de Cancha de Fútbol</span>
                <h3 className="text-lg font-black text-slate-900">{bloqueSeleccionado.cancha.name}</h3>
              </div>
              <button onClick={cerrarModalManual} className="text-slate-400 font-bold text-lg cursor-pointer">✕</button>
            </div>

            {pasoModal === 1 && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Modalidad de Reserva</label>
                    <select
                      value={tipoReserva}
                      onChange={(e) => {
                        const tipo = e.target.value;
                        setTipoReserva(tipo);
                        const baseTotal = bloqueSeleccionado.precioBaseTotal;
                        const feeTotal = baseTotal * 0.10;
                        const capBD = bloqueSeleccionado.cancha?.capacity || 10;
                        const valUSD = tipo === "privado" ? (baseTotal + feeTotal) : ((baseTotal + feeTotal) / capBD);
                        setMontoAbono(monedaAbono === "USD" ? valUSD.toFixed(2) : (valUSD * tasaBCV).toFixed(2));
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800"
                    >
                      <option value="privado">🔒 Reserva Privada (Cancha Completa para tu grupo)</option>
                      <option value="ranking">🏆 Partido Público (Abrir cupos para la comunidad)</option>
                    </select>
                  </div>

                  {tipoReserva === "privado" ? (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs font-bold text-amber-900">
                      🤝 Al alquilar la cancha completa, tú y tu grupo deciden libremente cómo organizarse, rotar o armar los equipos durante el partido.
                    </div>
                  ) : (
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs font-bold text-blue-900">
                      👥 Se creará una sala abierta para {calculosPrecio.capacidadOficial} jugadores. Tú solo pagas tu cupo individual.
                    </div>
                  )}
                </div>

                <button onClick={() => setPasoModal(2)} className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-2xl shadow-md cursor-pointer">
                  Continuar al Pago →
                </button>
              </div>
            )}

            {pasoModal === 2 && (
              <div className="space-y-4 text-xs font-bold text-slate-700">
                <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-1">
                  <div className="flex justify-between text-[#00FF9D]">
                    <span>{tipoReserva === "privado" ? "Cancha Completa" : "Tu Cupo Individual"}</span>
                    <div className="text-right">
                      <span className="font-black block">${calculosPrecio.base.toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-400/80 block">~Bs. {(calculosPrecio.base * tasaBCV).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Comisión App (+10%)</span>
                    <div className="text-right">
                      <span className="font-black block text-slate-300">+${calculosPrecio.fee.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400 block">~Bs. {(calculosPrecio.fee * tasaBCV).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-white font-black border-t border-slate-800 pt-2 text-sm">
                    <span>Total a Pagar</span>
                    <div className="text-right">
                      <span className="text-[#00FF9D] font-black block">${calculosPrecio.totalSug.toFixed(2)} USD</span>
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        ~Bs. {(calculosPrecio.totalSug * tasaBCV).toFixed(2)} VES
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-slate-500">Monto Aportado ({monedaAbono === "USD" ? "$" : "Bs."})</label>
                    <div className="flex bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                      <button type="button" onClick={() => cambiarMonedaAbono("USD")} className={`px-2 py-0.5 rounded-lg ${monedaAbono === "USD" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>$ USD</button>
                      <button type="button" onClick={() => cambiarMonedaAbono("VES")} className={`px-2 py-0.5 rounded-lg ${monedaAbono === "VES" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>Bs. VES</button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    disabled={tipoReserva === "ranking"}
                    readOnly={tipoReserva === "ranking"}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-base font-black text-slate-900 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />

                  {/* VISTA PREVIA Y CÁLCULO DE CONVERSIÓN CON TASA BCV */}
                  {numIngresado > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900 mt-2">
                      <span>Conversión (Tasa BCV: Bs. {tasaBCV.toFixed(2)})</span>
                      <span>
                        {monedaAbono === "USD"
                          ? `~Bs. ${equivalenteCalculado.toFixed(2)} VES`
                          : `~$${equivalenteCalculado.toFixed(2)} USD`}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "pago_movil", label: "📱 Pago Móvil" },
                      { id: "zelle", label: "🇺🇸 Zelle" },
                      { id: "efectivo", label: "💵 En Sitio" },
                    ].map((m) => (
                      <button key={m.id} type="button" onClick={() => setMetodoPago(m.id)} className={`py-2.5 rounded-xl font-black text-[10px] uppercase border ${metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {metodoPago !== "efectivo" && (
                  <div className="space-y-2">
                    <input type="text" placeholder="N° Referencia Transacción *" value={numReferencia} onChange={(e) => setNumReferencia(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold outline-none" />
                    <input type="file" accept="image/*" onChange={(e) => handleSeleccionarImagen(e, setPreviewComprobante)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-xs font-bold outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-slate-900 file:text-[#00FF9D]" />
                  </div>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={() => setPasoModal(1)} className="w-1/3 py-3 bg-slate-100 text-slate-700 font-black uppercase rounded-2xl cursor-pointer">Volver</button>
                  <button type="button" onClick={confirmarReservaYPago} disabled={procesandoReserva} className="w-2/3 py-3 bg-slate-900 text-[#00FF9D] font-black uppercase rounded-2xl shadow-md cursor-pointer">
                    {procesandoReserva ? "Enviando..." : "Confirmar Reserva"}
                  </button>
                </div>
              </div>
            )}
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