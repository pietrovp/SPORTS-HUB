"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const AMENIDADES_MAP = {
  equipment_rental: { label: "Alquiler de Palas / Pelotas", icon: "🎾" },
  free_parking: { label: "Estacionamiento Gratis", icon: "🚗" },
  store: { label: "Tienda Deportiva", icon: "🛍️" },
  restaurant: { label: "Restaurante", icon: "🍽️" },
  cafeteria: { label: "Cafetería / Bar", icon: "☕" },
  changing_room: { label: "Vestuarios y Duchas", icon: "🚿" },
  wifi: { label: "WiFi Gratis", icon: "📶" },
  lockers: { label: "Lockers / Casilleros", icon: "🔒" },
};

function obtenerEpoch(fechaStr) {
  if (!fechaStr) return 0;
  if (fechaStr instanceof Date) return fechaStr.getTime();
  let clean = String(fechaStr).trim().replace(" ", "T");
  const tieneOffset = clean.includes("Z") || clean.includes("+") || clean.indexOf("-", 10) !== -1;
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
  const mStr = String(minutos24 || 0).padStart(2, "0");
  return new Date(`${dateYYYYMMDD}T${hStr}:${mStr}:00-04:00`);
}

function obtenerHoraMinutoVET(dateObj) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dateObj);
  let hour = parts.find((p) => p.type === "hour").value;
  const minute = parts.find((p) => p.type === "minute").value;
  if (hour === "24") hour = "00";
  return {
    hourStr: hour,
    minuteStr: minute,
    hourInt: parseInt(hour, 10),
    minuteInt: parseInt(minute, 10),
  };
}

function formatearScheduledAtISO(dateObj) {
  const fechaISO = formatearFechaISOVET(dateObj);
  const { hourStr, minuteStr } = obtenerHoraMinutoVET(dateObj);
  return `${fechaISO}T${hourStr}:${minuteStr}:00-04:00`;
}

function obtenerFinDiaClub(dateObj, closeTimeStr) {
  const fechaISO = formatearFechaISOVET(dateObj);
  const [hStr, mStr] = (closeTimeStr || "23:00:00").split(":");
  return crearFechaVET(fechaISO, parseInt(hStr, 10), parseInt(mStr || 0, 10));
}

function horarioYaPaso(dateObj) {
  return dateObj.getTime() < Date.now();
}

function haySolapamiento(inicioA, duracionA, inicioB, duracionB) {
  const startA = obtenerEpoch(inicioA);
  const endA = startA + duracionA * 60 * 1000;
  const startB = obtenerEpoch(inicioB);
  const endB = startB + duracionB * 60 * 1000;
  return startA < endB && endA > startB;
}

function formatRangoHorarioExacto(isoStr, durationMin) {
  const start = parsearFechaVET(isoStr);
  const end = new Date(start.getTime() + (durationMin || 60) * 60000);
  const fmt = (d) =>
    d.toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Caracas",
    }).toUpperCase();
  return `${fmt(start)} - ${fmt(end)}`;
}

function generarItemsAgendaMobile(canchaId, fechaSeleccionada, partidos, bloqueos, club) {
  if (!club) return [];
  const horaApertura = parseInt((club.open_time || "07:00:00").split(":")[0], 10);
  const minApertura = parseInt((club.open_time || "07:00:00").split(":")[1] || 0, 10);
  const horaCierre = parseInt((club.close_time || "23:00:00").split(":")[0], 10);
  const fechaSelISO = formatearFechaISOVET(fechaSeleccionada);

  let curr = crearFechaVET(fechaSelISO, horaApertura, minApertura);
  const finDia = crearFechaVET(fechaSelISO, horaCierre, 0);
  const items = [];
  let trasReservaPrev = false;

  while (curr.getTime() < finDia.getTime()) {
    const currTime = curr.getTime();

    const match = partidos.find(
      (m) => m.court_id === canchaId && Math.abs(obtenerEpoch(m.scheduled_at) - currTime) < 60000
    );
    if (match) {
      const dur = match.duration_minutes || 60;
      items.push({
        tipo: "partido",
        partido: match,
        startObj: new Date(currTime),
        duracion: dur,
        rangoTexto: formatRangoHorarioExacto(match.scheduled_at, dur),
      });
      curr = new Date(currTime + dur * 60000);
      trasReservaPrev = true;
      continue;
    }

    const lock = bloqueos.find(
      (l) => l.court_id === canchaId && Math.abs(obtenerEpoch(l.scheduled_at) - currTime) < 60000
    );
    if (lock) {
      const dur = lock.duration_minutes || 60;
      items.push({
        tipo: "bloqueo",
        lock: lock,
        startObj: new Date(currTime),
        duracion: dur,
        rangoTexto: formatRangoHorarioExacto(lock.scheduled_at, dur),
      });
      curr = new Date(currTime + dur * 60000);
      trasReservaPrev = true;
      continue;
    }

    const ongoingMatch = partidos.find((m) => {
      if (m.court_id !== canchaId) return false;
      const s = obtenerEpoch(m.scheduled_at);
      const e = s + (m.duration_minutes || 60) * 60000;
      return currTime > s && currTime < e;
    });
    if (ongoingMatch) {
      const e = obtenerEpoch(ongoingMatch.scheduled_at) + (ongoingMatch.duration_minutes || 60) * 60000;
      curr = new Date(e);
      trasReservaPrev = true;
      continue;
    }

    const ongoingLock = bloqueos.find((l) => {
      if (l.court_id !== canchaId) return false;
      const s = obtenerEpoch(l.scheduled_at);
      const e = s + (l.duration_minutes || 60) * 60000;
      return currTime > s && currTime < e;
    });
    if (ongoingLock) {
      const e = obtenerEpoch(ongoingLock.scheduled_at) + (ongoingLock.duration_minutes || 60) * 60000;
      curr = new Date(e);
      trasReservaPrev = true;
      continue;
    }

    const { hourInt, minuteInt } = obtenerHoraMinutoVET(curr);
    const esHoraPunto = minuteInt === 0;
    const esValidoMostrar = esHoraPunto || trasReservaPrev;

    if (esValidoMostrar) {
      const hLabel = curr.toLocaleTimeString("es-ES", {
        timeZone: "America/Caracas",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      items.push({
        tipo: "libre",
        startObj: new Date(currTime),
        horaInt: hourInt,
        minutosInt: minuteInt,
        etiqueta: hLabel,
        vencido: horarioYaPaso(curr),
      });
      trasReservaPrev = false;
    }

    if (minuteInt === 30) {
      curr = new Date(currTime + 30 * 60000);
    } else {
      const proximo30 = currTime + 30 * 60000;
      const hayAlgoEn30 =
        partidos.some(
          (m) => m.court_id === canchaId && Math.abs(obtenerEpoch(m.scheduled_at) - proximo30) < 60000
        ) ||
        bloqueos.some(
          (l) => l.court_id === canchaId && Math.abs(obtenerEpoch(l.scheduled_at) - proximo30) < 60000
        );

      if (hayAlgoEn30) {
        curr = new Date(currTime + 30 * 60000);
      } else {
        curr = new Date(currTime + 60 * 60000);
      }
    }
  }

  return items;
}

export default function PublicClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id;

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [userPadelProfile, setUserPadelProfile] = useState(null);
  const [club, setClub] = useState(null);
  const [canchas, setCanchas] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [partidosClub, setPartidosClub] = useState([]);
  const [bloqueosActivos, setBloqueosActivos] = useState([]);
  const [tasaBCV, setTasaBCV] = useState(36.65);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [promocionHoy, setPromocionHoy] = useState(null);

  // Estados del Modal
  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });
  const [modalReservaOpen, setModalReservaOpen] = useState(false);
  const [pasoModal, setPasoModal] = useState(1);
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState(null);
  const [duracionMinutos, setDuracionMinutos] = useState(60);
  const [procesandoReserva, setProcesandoReserva] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(null);

  // Modalidad: "privado", "ranking" o "clase"
  const [tipoReserva, setTipoReserva] = useState("privado");
  const [activarRankedPrivado, setActivarRankedPrivado] = useState(true);
  const [cantidadJugadores, setCantidadJugadores] = useState(4);

  // CLASES Y SELECCIÓN DE PROFESOR
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [cantidadAlumnos, setCantidadAlumnos] = useState(1); // 1 a 4 alumnos

  // Pago
  const [metodoPago, setMetodoPago] = useState("pagomovil");
  const [monedaAbono, setMonedaAbono] = useState("USD");
  const [montoAbono, setMontoAbono] = useState("");
  const [numReferencia, setNumReferencia] = useState("");
  const [previewComprobante, setPreviewComprobante] = useState("");

  const [canchaFiltroMobile, setCanchaFiltroMobile] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    if (clubId) {
      cargarDatosIniciales();
    } else {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (canchas.length > 0 && !canchaFiltroMobile) {
      setCanchaFiltroMobile(canchas[0].id);
    }
  }, [canchas, canchaFiltroMobile]);

  async function cargarDatosIniciales() {
    setLoading(true);
    try {
      await Promise.all([obtenerTasaBCV(), cargarDetalleClub()]);
    } catch (e) {
      console.error("Error en carga inicial:", e);
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

    const channelName = `locks:club:${clubId}`;
    const channel = supabase.channel(channelName, { config: { broadcast: { self: true } } });
    channelRef.current = channel;

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
        if (data?.type === "INSERT" || data?.type === "UPDATE") {
          setBloqueosActivos((prev) => [
            ...prev.filter(
              (l) =>
                !(
                  l.court_id === data.lock.court_id &&
                  Math.abs(obtenerEpoch(l.scheduled_at) - obtenerEpoch(data.lock.scheduled_at)) < 5000
                )
            ),
            data.lock,
          ]);
        } else if (data?.type === "DELETE") {
          setBloqueosActivos((prev) =>
            prev.filter(
              (l) =>
                !(
                  l.court_id === data.court_id &&
                  Math.abs(obtenerEpoch(l.scheduled_at) - obtenerEpoch(data.scheduled_at)) < 5000
                )
            )
          );
        }
        cargarBloqueos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [clubId]);

  useEffect(() => {
    let intervalo;
    if (modalReservaOpen && tiempoRestante !== null) {
      if (tiempoRestante > 0) {
        intervalo = setInterval(() => {
          setTiempoRestante((prev) => prev - 1);
        }, 1000);
      } else if (tiempoRestante <= 0 && modalReservaOpen) {
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
      const { data } = await supabase.from("padel_locks").select("*").gt("expires_at", ahoraISO);
      setBloqueosActivos(data || []);
    } catch (error) {
      console.error("Error cargando bloqueos:", error);
    }
  }

  const cerrarModalPorTiempoAgotado = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    mostrarNotificacion(
      "Tiempo Expirado",
      "Han pasado los 10 minutos. La pista ha sido liberada para otros usuarios.",
      "warning"
    );
    if (bloqueSeleccionado && user) {
      const scheduledAtISO = formatearScheduledAtISO(bloqueSeleccionado.dateObj);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "lock_event",
          payload: { type: "DELETE", court_id: bloqueSeleccionado.cancha.id, scheduled_at: scheduledAtISO },
        });
      }
      await supabase
        .from("padel_locks")
        .delete()
        .eq("court_id", bloqueSeleccionado.cancha.id)
        .eq("scheduled_at", scheduledAtISO);
      await cargarBloqueos();
    }
  };

  const cerrarModalManual = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    if (bloqueSeleccionado && user) {
      const scheduledAtISO = formatearScheduledAtISO(bloqueSeleccionado.dateObj);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "lock_event",
          payload: { type: "DELETE", court_id: bloqueSeleccionado.cancha.id, scheduled_at: scheduledAtISO },
        });
      }
      await supabase
        .from("padel_locks")
        .delete()
        .eq("court_id", bloqueSeleccionado.cancha.id)
        .eq("scheduled_at", scheduledAtISO);
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
      console.error("Error buscando promo:", e);
    }
  }

  async function cargarDetalleClub() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData ? sessionData.session : null;

      if (session && session.user) {
        setUser(session.user);
        try {
          const { data: padelProf } = await supabase
            .from("padel_profiles")
            .select("*")
            .eq("cuenta_id", session.user.id)
            .maybeSingle();
          setUserPadelProfile(padelProf || null);
        } catch (e) {
          console.warn("No se pudo cargar el perfil de padel", e);
        }
      } else {
        setUser(null);
        setUserPadelProfile(null);
      }

      // 1. Datos del Club
      const { data: clubData, error: cErr } = await supabase
        .from("clubs")
        .select(`
          id, name, city, address, image_url, amenities, open_time, close_time, slot_duration_minutes,
          class_price_1_pax, class_price_2_pax, class_price_3_pax, class_price_4_pax, has_coaching_service
        `)
        .eq("id", clubId)
        .maybeSingle();

      if (cErr || !clubData) {
        setClub(null);
        return;
      }
      setClub(clubData);

      // 2. Canchas
      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, sport_type, capacity, price_normal, pricing_blocks")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("court_number", { ascending: true });

      const canchasPadel = (courtsData || []).filter(
        (c) => c.sport_type === "padel" || !c.sport_type || c.sport_type !== "futbol"
      );
      setCanchas(canchasPadel);

      // 3. Profesores Activos del Club
      const { data: coachesData, error: coachErr } = await supabase
        .from("club_coaches")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (coachErr) {
        console.warn("Error cargando profesores en el club:", coachErr.message);
      }
      setProfesores(coachesData || []);

      // 4. Partidos
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*, court:courts(name)")
        .eq("club_id", clubId)
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: true });

      setPartidosClub(matchesData || []);
    } catch (err) {
      console.error("Error cargando detalle del club:", err);
    } finally {
      cargarPromocionDelDia();
    }
  }

  const calcularPrecioPorBloque = (cancha, horaInt, minutosInt) => {
    try {
      const horaFormateada = `${String(horaInt).padStart(2, "0")}:${String(minutosInt).padStart(2, "0")}`;
      if (!cancha.pricing_blocks || !Array.isArray(cancha.pricing_blocks) || cancha.pricing_blocks.length === 0) {
        const precioNormal = parseFloat(cancha.price_normal);
        return { precio: isNaN(precioNormal) ? 15 : precioNormal, esPico: false };
      }

      const bloqueEncontrado = cancha.pricing_blocks.find((bloque) => {
        return horaFormateada >= (bloque.start_time || "00:00") && horaFormateada < (bloque.end_time || "23:59");
      });

      if (bloqueEncontrado && !isNaN(parseFloat(bloqueEncontrado.price_60 ?? bloqueEncontrado.price))) {
        return { precio: parseFloat(bloqueEncontrado.price_60 ?? bloqueEncontrado.price), esPico: false };
      }

      const primerPrecio = parseFloat(cancha.pricing_blocks[0].price_60 ?? cancha.pricing_blocks[0].price);
      return { precio: isNaN(primerPrecio) ? 15 : primerPrecio, esPico: false };
    } catch (error) {
      return { precio: 15, esPico: false };
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

  const bloquesHorariosDesktop = useMemo(() => {
    if (!club) return [];
    const horaApertura = parseInt((club.open_time || "07:00:00").split(":")[0], 10);
    const horaCierre = parseInt((club.close_time || "23:00:00").split(":")[0], 10);
    const fechaSelISO = formatearFechaISOVET(fechaSeleccionada);
    const bloques = [];

    for (let curH = horaApertura; curH < horaCierre; curH++) {
      const dateObj0 = crearFechaVET(fechaSelISO, curH, 0);
      const dateObj30 = crearFechaVET(fechaSelISO, curH, 30);
      const hLabel = dateObj0.toLocaleTimeString("es-ES", {
        timeZone: "America/Caracas",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      bloques.push({
        etiqueta: hLabel,
        horaInt: curH,
        dateObj0,
        dateObj30,
      });
    }
    return bloques;
  }, [club, fechaSeleccionada]);

  const abrirModalTurno = async (cancha, bloque, precioCalculado) => {
    if (!user) {
      mostrarNotificacion("Inicia Sesión", "Debes iniciar sesión para reservar una pista.", "warning");
      setTimeout(() => router.push("/login"), 1800);
      return;
    }

    const startObj = bloque.startObj || bloque.dateObj;
    if (horarioYaPaso(startObj)) {
      mostrarNotificacion("Horario no disponible", "Este bloque ya pasó y no puede ser reservado.", "warning");
      return;
    }

    const finDiaClub = obtenerFinDiaClub(startObj, club?.close_time);
    if (startObj.getTime() + 60 * 60000 > finDiaClub.getTime()) {
      const hCierreFmt = finDiaClub.toLocaleTimeString("es-VE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Caracas",
      });
      mostrarNotificacion("Fuera de Horario", `No es posible alquilar porque el complejo cierra a las ${hCierreFmt}.`, "warning");
      return;
    }

    const slotTime = startObj.getTime();
    const lockExistente = bloqueosActivos.find((l) => {
      if (l.court_id !== cancha.id) return false;
      if (new Date(l.expires_at).getTime() < Date.now()) return false;
      const lockTime = obtenerEpoch(l.scheduled_at);
      return Math.abs(lockTime - slotTime) < 5000;
    });

    if (lockExistente) {
      return mostrarNotificacion("Pista en proceso de reserva", "Esta pista ya está en proceso de reserva por otro usuario.", "warning");
    }

    try {
      setProcesandoReserva(true);
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      const scheduledAtISO = formatearScheduledAtISO(startObj);

      const nuevoLock = {
        court_id: cancha.id,
        scheduled_at: scheduledAtISO,
        duration_minutes: 60,
        user_id: user.id,
        expires_at: expiresAt,
      };

      const { error: lockErr } = await supabase.from("padel_locks").insert(nuevoLock);
      if (lockErr) {
        await cargarBloqueos();
        return mostrarNotificacion("Pista en proceso", "Alguien más se ha adelantado a reservar esta pista.", "warning");
      }

      setBloqueosActivos((prev) => [
        ...prev.filter((l) => !(l.court_id === cancha.id && Math.abs(obtenerEpoch(l.scheduled_at) - slotTime) < 5000)),
        nuevoLock,
      ]);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "lock_event",
          payload: { type: "INSERT", lock: nuevoLock },
        });
      }

      setTiempoRestante(600);
      const precioBaseTotal = precioCalculado || cancha.price_normal || 16;
      setBloqueSeleccionado({
        cancha,
        dateObj: startObj,
        horaLabel: bloque.etiqueta || startObj.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Caracas" }),
        precioBaseTotal: precioBaseTotal,
      });

      setDuracionMinutos(60);
      setTipoReserva("privado");
      setActivarRankedPrivado(true);
      setCantidadJugadores(4);
      setSelectedCoachId(profesores.length > 0 ? profesores[0].id : "");
      setCantidadAlumnos(1);
      setMetodoPago("pagomovil");
      setMonedaAbono("USD");

      const valUSD = precioBaseTotal * 1.10;
      setMontoAbono(valUSD.toFixed(2));
      setNumReferencia("");
      setPreviewComprobante("");
      setPasoModal(1);
      setModalReservaOpen(true);
    } catch (e) {
      console.error("Error al bloquear la pista:", e);
      mostrarNotificacion("Error", "No se pudo iniciar la reserva.", "error");
      await cargarBloqueos();
    } finally {
      setProcesandoReserva(false);
    }
  };

  const intentarCambiarDuracion = async (nuevaDuracion) => {
    if (!bloqueSeleccionado) return;
    if (tipoReserva === "ranking" && nuevaDuracion !== 60) {
      mostrarNotificacion("Duración fija", "Los partidos públicos para ranking tienen una duración fija de 1 Hora (60 min).", "warning");
      return;
    }
    if (tipoReserva === "clase" && nuevaDuracion !== 60) {
      mostrarNotificacion("Duración fija para clases", "Las clases con profesor tienen una duración estructurada de 1 Hora (60 min).", "warning");
      return;
    }

    const inicioDeseado = bloqueSeleccionado.dateObj;
    const canchaId = bloqueSeleccionado.cancha.id;
    const finDiaClub = obtenerFinDiaClub(inicioDeseado, club?.close_time);
    const finDeseado = new Date(inicioDeseado.getTime() + nuevaDuracion * 60000);

    if (finDeseado.getTime() > finDiaClub.getTime()) {
      mostrarNotificacion("Excede el cierre", "No es posible alquilar esa duración porque excede la hora de cierre.", "warning");
      return;
    }

    const chocaPartido = partidosClub.some((m) => {
      if (m.court_id !== canchaId) return false;
      return haySolapamiento(inicioDeseado, nuevaDuracion, m.scheduled_at, m.duration_minutes || 60);
    });

    const chocaLock = bloqueosActivos.some((l) => {
      if (l.court_id !== canchaId) return false;
      if (Math.abs(obtenerEpoch(l.scheduled_at) - inicioDeseado.getTime()) < 5000) return false;
      if (new Date(l.expires_at).getTime() < Date.now()) return false;
      return haySolapamiento(inicioDeseado, nuevaDuracion, l.scheduled_at, l.duration_minutes || 60);
    });

    if (chocaPartido || chocaLock) {
      mostrarNotificacion("Horario no disponible", "La pista se encuentra ocupada en el bloque contiguo.", "warning");
      return;
    }

    setDuracionMinutos(nuevaDuracion);

    if (user) {
      const scheduledAtISO = formatearScheduledAtISO(inicioDeseado);
      const targetTime = inicioDeseado.getTime();
      const updatedLock = {
        court_id: canchaId,
        scheduled_at: scheduledAtISO,
        duration_minutes: nuevaDuracion,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
      };

      setBloqueosActivos((prev) => [
        ...prev.filter((l) => !(l.court_id === canchaId && Math.abs(obtenerEpoch(l.scheduled_at) - targetTime) < 5000)),
        updatedLock,
      ]);

      if (channelRef.current) {
        channelRef.current.send({ type: "broadcast", event: "lock_event", payload: { type: "UPDATE", lock: updatedLock } });
      }

      await supabase
        .from("padel_locks")
        .update({ duration_minutes: nuevaDuracion })
        .match({ court_id: canchaId, scheduled_at: scheduledAtISO, user_id: user.id });
    }
  };

  // Forzar 60 minutos al cambiar a modalidad Clase o Ranking
  const cambiarTipoReserva = async (nuevoTipo) => {
    setTipoReserva(nuevoTipo);
    if ((nuevoTipo === "ranking" || nuevoTipo === "clase") && duracionMinutos !== 60) {
      await intentarCambiarDuracion(60);
    }
  };

  // CÁLCULO DE PRECIOS EXACTO CON CLASES Y PROFESOR SELECCIONADO
  const calculosPrecio = useMemo(() => {
    if (!bloqueSeleccionado || !club) {
      return {
        base: 0,
        fee: 0,
        totalSug: 0,
        precioIndividual: 0,
        capacidadOficial: 4,
        baseTotalCancha: 0,
        feeTotalCancha: 0,
        tarifaClaseTotal: 0,
        precioPorAlumnoClase: 0,
      };
    }

    const factorTiempo = duracionMinutos / 60;
    const baseTotalCancha = bloqueSeleccionado.precioBaseTotal * factorTiempo;

    let precioPorAlumnoClase = 0;
    if (cantidadAlumnos === 1) precioPorAlumnoClase = Number(club.class_price_1_pax || 25);
    else if (cantidadAlumnos === 2) precioPorAlumnoClase = Number(club.class_price_2_pax || 18);
    else if (cantidadAlumnos === 3) precioPorAlumnoClase = Number(club.class_price_3_pax || 14);
    else if (cantidadAlumnos === 4) precioPorAlumnoClase = Number(club.class_price_4_pax || 10);

    const tarifaClaseTotal = tipoReserva === "clase" ? (precioPorAlumnoClase * cantidadAlumnos * factorTiempo) : 0;
    const baseCombinada = baseTotalCancha + tarifaClaseTotal;
    const feeTotal = baseCombinada * 0.10;

    let baseCalculada = baseCombinada;
    let feeCalculado = feeTotal;
    let cantJugadores = 4;

    if (tipoReserva === "clase") {
      cantJugadores = cantidadAlumnos;
      baseCalculada = baseCombinada;
      feeCalculado = feeTotal;
    } else if (tipoReserva === "ranking") {
      cantJugadores = 4;
      baseCalculada = baseTotalCancha / 4;
      feeCalculado = (baseTotalCancha * 0.10) / 4;
    } else {
      cantJugadores = cantidadJugadores;
      baseCalculada = baseTotalCancha;
      feeCalculado = baseTotalCancha * 0.10;
    }

    const totalSug = baseCalculada + feeCalculado;
    const precioIndividual = (baseTotalCancha + (baseTotalCancha * 0.10)) / cantJugadores;

    return {
      base: baseCalculada,
      fee: feeCalculado,
      totalSug,
      precioIndividual,
      capacidadOficial: cantJugadores,
      baseTotalCancha,
      feeTotalCancha: baseTotalCancha * 0.10,
      tarifaClaseTotal,
      precioPorAlumnoClase,
    };
  }, [bloqueSeleccionado, tipoReserva, cantidadJugadores, duracionMinutos, cantidadAlumnos, club]);

  useEffect(() => {
    if (calculosPrecio.totalSug > 0) {
      const val = monedaAbono === "USD" ? calculosPrecio.totalSug.toFixed(2) : (calculosPrecio.totalSug * tasaBCV).toFixed(2);
      setMontoAbono(val);
    }
  }, [calculosPrecio.totalSug, monedaAbono, tasaBCV]);

  const cambiarMonedaAbono = (nuevaMoneda) => {
    if (nuevaMoneda === monedaAbono) return;
    const valActual = parseFloat(montoAbono);
    if (!isNaN(valActual) && valActual > 0) {
      setMontoAbono(nuevaMoneda === "VES" ? (valActual * tasaBCV).toFixed(2) : (valActual / tasaBCV).toFixed(2));
    }
    setMonedaAbono(nuevaMoneda);
  };

  const handleSeleccionarImagen = (e, setPreview) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return mostrarNotificacion("Archivo Inválido", "Por favor selecciona una imagen válida.", "error");
    }
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  async function confirmarReservaYPago() {
    if (!user || !bloqueSeleccionado) return;

    const valIngresado = parseFloat(montoAbono);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Por favor ingresa un monto válido.", "error");
    }

    if (metodoPago !== "efectivo" && !previewComprobante && !numReferencia.trim()) {
      return mostrarNotificacion("Falta Comprobante", "Por favor adjunta el comprobante o referencia bancaria.", "error");
    }

    const montoUSD = monedaAbono === "VES" ? valIngresado / tasaBCV : valIngresado;

    try {
      setProcesandoReserva(true);

      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", user.id)
        .maybeSingle();

      const nombreUsuarioCompleto = userProf ? `${userProf.nombre || ""} ${userProf.apellido || ""}`.trim() : user.email;
      const telefonoUsuario = userProf?.telefono || "Sin teléfono";
      const miCat = userPadelProfile?.categoria_oficial || "7ma";
      const estadoPagoFinal = metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente_aprobacion";

      const coachElegido = profesores.find((p) => p.id === selectedCoachId);
      const nombreCoach = coachElegido ? coachElegido.name : (profesores.length === 0 ? "Profesor por asignar" : "");

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: user.id,
        user_name: nombreUsuarioCompleto,
        user_phone: telefonoUsuario,
        amount: montoUSD,
        method: metodoPago,
        reference: numReferencia.trim() ? (monedaAbono === "VES" ? `Abono Bs. ${valIngresado.toFixed(2)} - Ref: ${numReferencia}` : numReferencia) : "Abono Inicial",
        receipt_url: previewComprobante || null,
        status: metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const scheduledAtISO = formatearScheduledAtISO(bloqueSeleccionado.dateObj);
      const esClase = tipoReserva === "clase";

      const payloadMatch = {
        club_id: clubId,
        court_id: bloqueSeleccionado.cancha.id,
        scheduled_at: scheduledAtISO,
        duration_minutes: duracionMinutos,
        total_price: calculosPrecio.base,
        price_per_player: calculosPrecio.precioIndividual,
        app_fee: calculosPrecio.fee,
        match_type: esClase ? "clase" : tipoReserva,
        is_private: tipoReserva !== "ranking",
        is_competitive: tipoReserva === "ranking" || (tipoReserva === "privado" && activarRankedPrivado),
        category_restriction: miCat,
        status: "programado",
        payment_status: estadoPagoFinal,
        payment_method: metodoPago,
        payment_proof_urls: previewComprobante ? [previewComprobante] : [],
        payments_history: [nuevoAbono],
        created_by: user.id,
        coach_id: esClase ? (selectedCoachId || null) : null,
        coach_fee: esClase ? calculosPrecio.tarifaClaseTotal : 0,
        students_count: esClase ? cantidadAlumnos : 1,
        is_class: esClase,
        notes: esClase ? `Clase con Profesor: ${nombreCoach} (${cantidadAlumnos} Alumno/s)` : "",
      };

      const { data: newMatch, error: matchErr } = await supabase
        .from("matches")
        .insert(payloadMatch)
        .select()
        .single();

      if (matchErr) throw new Error(matchErr.message);

      await supabase.from("match_players").insert({
        match_id: newMatch.id,
        user_id: user.id,
        team: "A",
      });

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "match_event",
          payload: { type: "INSERT_MATCH", match: newMatch, canchaNombre: bloqueSeleccionado.cancha.name },
        });
        channelRef.current.send({
          type: "broadcast",
          event: "lock_event",
          payload: { type: "DELETE", court_id: bloqueSeleccionado.cancha.id, scheduled_at: scheduledAtISO },
        });
      }

      await supabase
        .from("padel_locks")
        .delete()
        .eq("court_id", bloqueSeleccionado.cancha.id)
        .eq("scheduled_at", scheduledAtISO);

      await cargarBloqueos();
      setTiempoRestante(null);
      setModalReservaOpen(false);

      mostrarNotificacion(
        "¡Reserva Confirmada!",
        esClase ? `Tu clase con ${nombreCoach} ha sido agendada con éxito.` : "Pista reservada con éxito.",
        "success"
      );

      await cargarDetalleClub();
      router.push(`/padel/partidos/${newMatch.id}`);
    } catch (err) {
      console.error("Error al procesar reserva:", err);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center space-y-4 font-sans">
        <h2 className="text-xl font-black text-slate-900">Complejo no encontrado</h2>
        <Link href="/padel/clubes" className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs inline-block">
          Volver al directorio
        </Link>
      </div>
    );
  }

  const listAmenidades = Array.isArray(club.amenities) ? club.amenities : ["wifi", "free_parking", "changing_room"];
  const numIngresado = parseFloat(montoAbono) || 0;
  const equivalenteCalculado = monedaAbono === "USD" ? numIngresado * tasaBCV : numIngresado / tasaBCV;
  const horaInicioObj = bloqueSeleccionado?.dateObj;
  const horaFinObj = horaInicioObj ? new Date(horaInicioObj.getTime() + duracionMinutos * 60000) : null;
  const fmtHoraModal = (d) =>
    d ? d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Caracas" }).toUpperCase() : "";
  const rangoHorarioDinamico = horaInicioObj && horaFinObj ? `${fmtHoraModal(horaInicioObj)} - ${fmtHoraModal(horaFinObj)}` : "";
  const fechaFormateadaModal = horaInicioObj
    ? horaInicioObj.toLocaleDateString("es-ES", { timeZone: "America/Caracas", weekday: "long", day: "numeric", month: "short" })
    : "";

  return (
    <div className="min-h-screen bg-slate-50/50 px-2 py-3 sm:px-6 md:px-8 space-y-4 sm:space-y-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-8">

        {/* HERO BANNER */}
        <div className="relative w-full h-48 sm:h-80 bg-slate-900 rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200">
          {club.image_url ? (
            <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#0B0C2A] to-[#161848]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <span className="bg-[#00FF9D] text-slate-950 font-black text-[9px] sm:text-[10px] uppercase px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-sm">
                Complejo de Pádel Verificado
              </span>
              <h1 className="text-lg sm:text-4xl font-black truncate">{club.name}</h1>
              <p className="text-[10px] sm:text-sm text-slate-300 font-medium">{club.address || "Cabudare"}, {club.city}</p>
            </div>
          </div>
        </div>

        {/* LAYOUT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          
          {/* COLUMNA LATERAL: AMENIDADES Y STAFF DE PROFESORES */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            
            {/* AMENIDADES */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-sm space-y-2 sm:space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">Amenidades</h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {listAmenidades.map((key) => {
                  const am = AMENIDADES_MAP[key] || { label: key, icon: "✨" };
                  return (
                    <span key={key} className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-100 text-slate-800 text-[10px] sm:text-xs font-bold">
                      <span>{am.icon}</span>
                      <span>{am.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN PROFESORES Y TARIFAS DE CLASES DEL CLUB */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span>🎓</span> Clases & Profesores
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400">Escoge con quién ver tus clases</p>
                </div>
                <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  {profesores.length} disponibles
                </span>
              </div>

              {/* TARIFARIO DEL COMPLEJO */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider">
                  Tarifas Oficiales de Clases / Hora
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold">
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">1 Alumno:</span>
                    <span className="font-black text-emerald-700">${Number(club.class_price_1_pax || 25).toFixed(0)}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">2 Alumnos:</span>
                    <span className="font-black text-emerald-700">${Number(club.class_price_2_pax || 18).toFixed(0)} c/u</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">3 Alumnos:</span>
                    <span className="font-black text-emerald-700">${Number(club.class_price_3_pax || 14).toFixed(0)} c/u</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center">
                    <span className="text-slate-500">4 Alumnos:</span>
                    <span className="font-black text-emerald-700">${Number(club.class_price_4_pax || 10).toFixed(0)} c/u</span>
                  </div>
                </div>
              </div>

              {/* LISTA DE ENTRENADORES */}
              {profesores.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                  Aún no hay profesores registrados para mostrar, pero puedes reservar la clase con instructor general.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {profesores.map((profe) => (
                    <div key={profe.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center">
                        {profe.photo_url ? (
                          <img src={profe.photo_url} alt={profe.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">👤</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-slate-900 truncate">{profe.name}</h4>
                        <p className="text-[10px] font-bold text-slate-500 truncate">{profe.specialty || "Instructor de Pádel"}</p>
                        {profe.bio && <p className="text-[9px] text-slate-400 line-clamp-1 italic">"{profe.bio}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA PRINCIPAL: RESERVA DE PISTAS */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6" id="reserva-pistas">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-200 shadow-sm space-y-3 sm:space-y-5">
              <div className="flex justify-between items-center border-b pb-2 sm:pb-3">
                <h2 className="text-sm sm:text-lg font-black text-slate-900">Reserva tu Pista o Clase</h2>
                <span className="text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                  {canchas.length} pistas
                </span>
              </div>

              {/* SELECTOR DE DÍAS */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-width-none">
                {diasSiguientes.map((dObj, i) => {
                  const isSel = formatearFechaISOVET(fechaSeleccionada) === formatearFechaISOVET(dObj);
                  return (
                    <button
                      key={i}
                      onClick={() => setFechaSeleccionada(dObj)}
                      className={`shrink-0 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-center border transition-all cursor-pointer ${
                        isSel ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-md" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-[8px] sm:text-[10px] font-black uppercase block opacity-60">
                        {i === 0 ? "Hoy" : dObj.toLocaleDateString("es-ES", { timeZone: "America/Caracas", weekday: "short" })}
                      </span>
                      <span className="text-xs sm:text-sm font-black block mt-0.5">
                        {dObj.toLocaleDateString("es-ES", { timeZone: "America/Caracas", day: "numeric", month: "short" })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* AVISO DE PROMOCIÓN */}
              {promocionHoy && (
                <div className="bg-rose-50 border border-rose-200 p-2.5 sm:p-4 rounded-2xl flex items-center gap-2.5 sm:gap-3 shadow-sm my-2 sm:my-4">
                  <span className="text-2xl sm:text-3xl animate-bounce">🔥</span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-tight">{promocionHoy.name}</h4>
                    <p className="text-[9px] sm:text-xs font-bold text-rose-700">¡Aprovecha! Tarifas especiales aplicadas en el día de hoy.</p>
                  </div>
                </div>
              )}

              {/* VISTA MÓVIL NATIVA */}
              <div className="block md:hidden space-y-4 font-sans">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Selecciona la Pista</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-width-none">
                    {canchas.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCanchaFiltroMobile(c.id)}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase shrink-0 transition-all cursor-pointer ${
                          canchaFiltroMobile === c.id ? "bg-slate-900 text-[#00FF9D] shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-900">Agenda & Disponibilidad</h3>
                      <p className="text-[10px] font-bold text-slate-400">Turnos organizados en horas y medias horas.</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(() => {
                      const canchaActual = canchas.find((c) => c.id === canchaFiltroMobile) || canchas[0];
                      if (!canchaActual) return <p className="text-xs font-bold text-slate-400 text-center py-6">No hay pistas disponibles.</p>;

                      const agendaItems = generarItemsAgendaMobile(canchaActual.id, fechaSeleccionada, partidosClub, bloqueosActivos, club);
                      if (agendaItems.length === 0) return <p className="text-xs font-bold text-slate-400 text-center py-6">No hay horarios configurados para esta fecha.</p>;

                      return agendaItems.map((item, idx) => {
                        if (item.tipo === "partido") {
                          const match = item.partido;
                          const esMiReserva = !!user && (match.created_by === user.id || (Array.isArray(match.players) && match.players.some((p) => p.user_id === user.id)));
                          const isApproved = match.payment_status === "aprobado" || match.payment_status === "pagado" || match.payment_status === "completado";
                          const isPending = !isApproved;
                          const bgClass = isPending ? "bg-amber-100 border-amber-300 text-amber-950" : "bg-emerald-100 border-emerald-300 text-emerald-950";
                          const badgeClass = isPending ? "bg-amber-200 text-amber-950" : "bg-emerald-200 text-emerald-950";

                          return (
                            <div key={`match-${match.id}-${idx}`}>
                              <Link href={`/padel/partidos/${match.id}`} className="block w-full">
                                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${bgClass}`}>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                                        {match.is_class ? "🎓 CLASE PÁDEL" : esMiReserva ? "MI RESERVA" : "RESERVADO"} ({item.duracion}M)
                                      </span>
                                    </div>
                                    <p className="text-sm font-black">{item.rangoTexto}</p>
                                    <p className="text-[10px] font-bold">{isPending ? "Pendiente" : "Confirmada"}</p>
                                  </div>
                                  <span className="text-xs font-black opacity-80">{esMiReserva ? "Ver Detalle →" : "Ocupado"}</span>
                                </div>
                              </Link>
                            </div>
                          );
                        }

                        if (item.tipo === "bloqueo") {
                          const lock = item.lock;
                          const esMiLock = user && lock.user_id === user.id;
                          return (
                            <div key={`lock-${lock.id || idx}`} className="p-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                              <div>
                                <span className="text-[9px] font-black uppercase bg-orange-200 text-orange-900 px-2.5 py-0.5 rounded-full">
                                  EN PROCESO DE RESERVA ({item.duracion}M)
                                </span>
                                <p className="text-sm font-black text-orange-950 mt-1">{item.rangoTexto}</p>
                              </div>
                              <span className="text-xs font-bold text-orange-800">{esMiLock ? "Tu reserva en curso..." : "Reservando..."}</span>
                            </div>
                          );
                        }

                        const { precio: precioOriginal } = calcularPrecioPorBloque(canchaActual, item.horaInt, item.minutosInt);
                        if (item.vencido) {
                          return (
                            <div key={`free-${idx}`} className="p-3.5 rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 opacity-60 flex justify-between items-center text-xs font-bold cursor-not-allowed">
                              <span className="font-bold">{item.etiqueta}</span>
                              <span className="text-[10px] uppercase font-black text-slate-400">Finalizado</span>
                            </div>
                          );
                        }

                        return (
                          <div key={`free-${idx}`} className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 flex justify-between items-center transition-all">
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-100 text-slate-900 text-xs font-black px-3 py-1.5 rounded-xl border border-slate-200">
                                {item.etiqueta}
                              </span>
                              <span className="text-xs font-bold text-slate-400">Disponible</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => abrirModalTurno(canchaActual, item, precioOriginal)}
                              className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Reservar ${precioOriginal.toFixed(2)}
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* VISTA DESKTOP (GRILLA HORIZONTAL) */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden font-sans">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900">Agenda Horizontal</h3>
                    <p className="text-[10px] font-bold text-slate-500">Visualiza la disponibilidad de todas las pistas a la vez.</p>
                  </div>
                  <div className="flex gap-4 text-[10px] font-bold text-slate-500">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Aprobada</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Pendiente</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-50 border border-dashed border-orange-300" /> En proceso</div>
                  </div>
                </div>

                <div className="overflow-x-auto relative w-full">
                  <div className="w-max pb-4">
                    <div className="flex border-b border-slate-200 bg-slate-100 sticky top-0 z-30">
                      <div className="w-32 shrink-0 sticky left-0 z-40 bg-slate-100 border-r border-slate-200 p-2 flex items-center justify-center">
                        <span className="text-[10px] font-black uppercase text-slate-500">Pistas</span>
                      </div>
                      {bloquesHorariosDesktop.map((b, i) => (
                        <div key={i} className="w-28 shrink-0 py-2 border-r border-slate-200 text-center flex flex-col justify-center">
                          <span className="text-xs font-black text-slate-800">{b.etiqueta.split(" ")[0]}</span>
                          <span className="text-[8px] font-bold text-slate-500">{b.etiqueta.split(" ")[1]}</span>
                        </div>
                      ))}
                    </div>

                    {canchas.map((cancha) => {
                      const gridStart = bloquesHorariosDesktop[0]?.dateObj0.getTime() || 0;
                      const lastBlock = bloquesHorariosDesktop[bloquesHorariosDesktop.length - 1];
                      const gridEnd = lastBlock ? lastBlock.dateObj30.getTime() + 30 * 60000 : 0;

                      return (
                        <div key={cancha.id} className="flex border-b border-slate-100 relative h-16 group">
                          <div className="w-32 shrink-0 sticky left-0 z-30 bg-white border-r border-slate-200 p-2 flex flex-col justify-center items-center group-hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-black text-slate-800 text-center leading-tight truncate px-1 w-full">{cancha.name}</span>
                            <span className="text-[8px] font-bold text-slate-400 mt-0.5">{cancha.capacity || 4} Jug.</span>
                          </div>

                          <div className="flex relative">
                            {bloquesHorariosDesktop.map((b, i) => {
                              const isOcupado0 =
                                partidosClub.some((m) => m.court_id === cancha.id && haySolapamiento(b.dateObj0, 30, m.scheduled_at, m.duration_minutes)) ||
                                bloqueosActivos.some((l) => l.court_id === cancha.id && haySolapamiento(b.dateObj0, 30, l.scheduled_at, l.duration_minutes));

                              const isOcupado30 =
                                partidosClub.some((m) => m.court_id === cancha.id && haySolapamiento(b.dateObj30, 30, m.scheduled_at, m.duration_minutes)) ||
                                bloqueosActivos.some((l) => l.court_id === cancha.id && haySolapamiento(b.dateObj30, 30, l.scheduled_at, l.duration_minutes));

                              const vencido0 = horarioYaPaso(b.dateObj0);
                              const vencido30 = horarioYaPaso(b.dateObj30);
                              const { precio: precio0 } = calcularPrecioPorBloque(cancha, b.horaInt, 0);

                              if (!isOcupado0 && !isOcupado30 && !vencido0) {
                                return (
                                  <div key={i} className="w-28 shrink-0 border-r border-slate-100 h-full relative p-1 z-10">
                                    <button
                                      onClick={() => abrirModalTurno(cancha, { dateObj: b.dateObj0, horaInt: b.horaInt, minutosInt: 0, etiqueta: b.etiqueta }, precio0)}
                                      className="w-full h-full rounded-xl bg-emerald-50/50 hover:bg-emerald-100 border border-transparent hover:border-emerald-300 flex flex-col items-center justify-center transition-all cursor-pointer"
                                    >
                                      <span className="text-[10px] font-black text-emerald-800 uppercase leading-none">Agendar</span>
                                      <span className="text-[10px] font-black text-emerald-600 mt-0.5">${precio0.toFixed(2)}</span>
                                    </button>
                                  </div>
                                );
                              }

                              const slots = [
                                { dateObj: b.dateObj0, min: 0, isOcupado: isOcupado0, vencido: vencido0 },
                                { dateObj: b.dateObj30, min: 30, isOcupado: isOcupado30, vencido: vencido30 },
                              ];

                              return slots.map((s, sIdx) => {
                                const { precio: precioSlot } = calcularPrecioPorBloque(cancha, b.horaInt, s.min);
                                return (
                                  <div key={`${i}-${sIdx}`} className="w-14 shrink-0 border-r border-slate-100 h-full relative p-1 z-10">
                                    {!s.isOcupado && !s.vencido ? (
                                      <button
                                        onClick={() => abrirModalTurno(cancha, { dateObj: s.dateObj, horaInt: b.horaInt, minutosInt: s.min, etiqueta: s.dateObj.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Caracas" }) }, precioSlot)}
                                        className="w-full h-full rounded-lg bg-emerald-50/50 hover:bg-emerald-100 border border-transparent hover:border-emerald-300 flex flex-col items-center justify-center transition-all cursor-pointer"
                                      >
                                        <span className="text-[8px] font-black text-emerald-800 uppercase leading-none">30m</span>
                                        <span className="text-[9px] font-black text-emerald-600 mt-0.5">${precioSlot.toFixed(0)}</span>
                                      </button>
                                    ) : s.vencido && !s.isOcupado ? (
                                      <div className="w-full h-full rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center opacity-50">
                                        <span className="text-[8px] font-bold text-slate-300">—</span>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              });
                            })}

                            {/* Overlays de Partidos */}
                            {partidosClub.filter((m) => m.court_id === cancha.id).map((match) => {
                              const startEpoch = obtenerEpoch(match.scheduled_at);
                              if (startEpoch < gridStart || startEpoch >= gridEnd) return null;
                              const offsetMin = (startEpoch - gridStart) / 60000;
                              const leftPx = (offsetMin / 30) * 56;
                              const dur = match.duration_minutes || 60;
                              const maxDur = (gridEnd - startEpoch) / 60000;
                              const effectiveDur = Math.min(dur, maxDur);
                              const widthPx = (effectiveDur / 30) * 56 - 2;

                              const isApproved = match.payment_status === "aprobado" || match.payment_status === "pagado" || match.payment_status === "completado";
                              const isPending = !isApproved;
                              const esMiReserva = !!user && (match.created_by === user.id || match.players?.some((p) => p.user_id === user.id));
                              const bgClass = isPending ? "bg-amber-100 border-amber-300 text-amber-950" : "bg-emerald-100 border-emerald-300 text-emerald-950";
                              const badgeClass = isPending ? "bg-amber-200 text-amber-950" : "bg-emerald-200 text-emerald-950";
                              const textStatus = isPending ? "Pendiente" : "Confirmada";

                              return (
                                <div key={match.id} style={{ left: `${leftPx}px`, width: `${widthPx}px` }} className="absolute top-0 h-full p-0.5 z-20">
                                  <Link href={`/padel/partidos/${match.id}`} className="block h-full w-full">
                                    <div className={`h-full w-full rounded-xl border flex flex-col justify-center px-2 py-1 shadow-sm transition-all overflow-hidden whitespace-nowrap cursor-pointer ${bgClass}`}>
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-[9px] font-black">{formatRangoHorarioExacto(match.scheduled_at, match.duration_minutes)}</span>
                                        {esMiReserva && <span className={`text-[7px] uppercase font-black px-1 rounded ${badgeClass}`}>MÍA</span>}
                                      </div>
                                      <span className="text-[10px] font-bold truncate flex items-center gap-1">
                                        {match.is_class ? "🎓 CLASE PÁDEL" : `🎾 ${textStatus}`}
                                      </span>
                                    </div>
                                  </Link>
                                </div>
                              );
                            })}

                            {/* Overlays de Bloqueos */}
                            {bloqueosActivos.filter((l) => l.court_id === cancha.id).map((lock) => {
                              const startEpoch = obtenerEpoch(lock.scheduled_at);
                              if (startEpoch < gridStart || startEpoch >= gridEnd) return null;
                              const offsetMin = (startEpoch - gridStart) / 60000;
                              const leftPx = (offsetMin / 30) * 56;
                              const dur = lock.duration_minutes || 60;
                              const maxDur = (gridEnd - startEpoch) / 60000;
                              const effectiveDur = Math.min(dur, maxDur);
                              const widthPx = (effectiveDur / 30) * 56 - 2;

                              return (
                                <div key={lock.id || lock.scheduled_at} style={{ left: `${leftPx}px`, width: `${widthPx}px` }} className="absolute top-0 h-full p-0.5 z-20 pointer-events-none">
                                  <div className="h-full w-full rounded-xl border border-dashed border-orange-300 bg-orange-50 flex flex-col justify-center px-2 py-1 shadow-sm overflow-hidden whitespace-nowrap">
                                    <span className="text-[9px] font-black text-orange-800">{formatRangoHorarioExacto(lock.scheduled_at, lock.duration_minutes)}</span>
                                    <span className="text-[10px] font-medium text-orange-600 truncate">Procesando...</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE RESERVA Y PASARELA DE PAGO */}
      {mounted && modalReservaOpen && bloqueSeleccionado && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans" onClick={cerrarModalManual}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            
            {/* ENCABEZADO */}
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2.5">
                {pasoModal === 2 && (
                  <button type="button" onClick={() => setPasoModal(1)} className="p-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold">
                    ←
                  </button>
                )}
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 block">Reserva de Padel & Clases</span>
                  <h3 className="text-lg font-black text-slate-900">{bloqueSeleccionado.cancha.name}</h3>
                </div>
              </div>
              <button onClick={cerrarModalManual} className="text-slate-400 font-bold text-lg cursor-pointer">✕</button>
            </div>

            {/* TARJETA RESUMEN */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2.5 shadow-md border border-slate-800">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-[10px] font-black uppercase text-[#00FF9D] tracking-wider truncate max-w-[200px]">
                  {club.name}
                </span>
                {tiempoRestante !== null && (
                  <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                    ⏱ {formatoTiempo(tiempoRestante)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Pista</span>
                  <span className="font-black text-white text-xs block truncate">{bloqueSeleccionado.cancha.name}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Fecha</span>
                  <span className="font-black text-white text-xs block capitalize truncate">{fechaFormateadaModal}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Horario</span>
                  <span className="font-black text-[#00FF9D] text-sm block">{rangoHorarioDinamico}</span>
                </div>
                <span className="text-[10px] font-extrabold bg-slate-800 text-slate-300 px-2.5 py-1 rounded-xl border border-slate-700">
                  {duracionMinutos} Mins
                </span>
              </div>
            </div>

            {/* PASO 1: SELECCIÓN DE MODALIDAD, PROFESOR Y ALUMNOS */}
            {pasoModal === 1 && (
              <div className="space-y-4 text-xs font-bold text-slate-700">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Modalidad de Reserva</label>
                  <select
                    value={tipoReserva}
                    onChange={(e) => cambiarTipoReserva(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="privado">Reserva Privada (Pista Completa)</option>
                    <option value="ranking">Partido Abierto Público (Sumar Ranking)</option>
                    <option value="clase">🎓 Clase con Profesor del Complejo</option>
                  </select>
                </div>

                {/* SELECTOR DE PROFESOR Y ALUMNOS SI ES CLASE */}
                {tipoReserva === "clase" && (
                  <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl space-y-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-emerald-900 mb-1">
                        1. Escoge al Profesor
                      </label>
                      {profesores.length > 0 ? (
                        <select
                          value={selectedCoachId}
                          onChange={(e) => setSelectedCoachId(e.target.value)}
                          className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none"
                        >
                          {profesores.map((profe) => (
                            <option key={profe.id} value={profe.id}>
                              {profe.name} — ({profe.specialty || "Instructor"})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="p-2.5 bg-white border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold">
                          Profesor del Complejo (Asignado en recepción)
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-emerald-900 mb-1.5">
                        2. Cantidad de Alumnos en la Clase
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((num) => {
                          let precioCupo = 0;
                          if (num === 1) precioCupo = Number(club.class_price_1_pax || 25);
                          else if (num === 2) precioCupo = Number(club.class_price_2_pax || 18);
                          else if (num === 3) precioCupo = Number(club.class_price_3_pax || 14);
                          else if (num === 4) precioCupo = Number(club.class_price_4_pax || 10);

                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setCantidadAlumnos(num)}
                              className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                                cantidadAlumnos === num
                                  ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <span className="block text-xs font-black">{num} {num === 1 ? "Alumno" : "Alumnos"}</span>
                              <span className="block text-[9px] font-bold mt-0.5 opacity-80">${precioCupo} c/u</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* SELECTOR DE DURACIÓN (DESHABILITADO PARA CLASES Y RANKING) */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400">Duración del Alquiler</label>
                    {tipoReserva === "clase" && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Duración fija de 1 Hora para clases
                      </span>
                    )}
                    {tipoReserva === "ranking" && (
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Duración fija de 1 Hora para ranking
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { min: 60, label: "1 Hora (60m)" },
                      { min: 90, label: "1.5 Horas (90m)" },
                      { min: 120, label: "2 Horas (120m)" },
                    ].map((d) => {
                      const deshabilitadoPorModalidad = (tipoReserva === "clase" || tipoReserva === "ranking") && d.min !== 60;
                      return (
                        <button
                          key={d.min}
                          type="button"
                          disabled={deshabilitadoPorModalidad}
                          onClick={() => !deshabilitadoPorModalidad && intentarCambiarDuracion(d.min)}
                          className={`py-2 px-2 rounded-xl text-xs font-black uppercase border transition-all ${
                            deshabilitadoPorModalidad
                              ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50"
                              : duracionMinutos === d.min
                              ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm cursor-pointer"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 cursor-pointer"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => setPasoModal(2)}
                  className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-md cursor-pointer hover:bg-slate-800 transition-all"
                >
                  Continuar al Pago →
                </button>
              </div>
            )}

            {/* PASO 2: DESGLOSE Y PAGO */}
            {pasoModal === 2 && (
              <div className="space-y-4 text-xs font-bold text-slate-700">
                <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-1.5">
                  <div className="flex justify-between text-[#00FF9D]">
                    <span>Alquiler Pista ({duracionMinutos}m)</span>
                    <span className="font-black">${calculosPrecio.baseTotalCancha.toFixed(2)}</span>
                  </div>

                  {tipoReserva === "clase" && (
                    <div className="flex justify-between text-emerald-300">
                      <span>Clase con {profesores.find((p) => p.id === selectedCoachId)?.name || "Profesor"} ({cantidadAlumnos} al.)</span>
                      <span className="font-black">${calculosPrecio.tarifaClaseTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span>Comisión App (10%)</span>
                    <span className="font-black">${calculosPrecio.fee.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-white font-black border-t border-slate-800 pt-2 text-sm">
                    <span>Total a Pagar</span>
                    <div className="text-right">
                      <span className="text-[#00FF9D] font-black block">${calculosPrecio.totalSug.toFixed(2)} USD</span>
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        Bs. {(calculosPrecio.totalSug * tasaBCV).toFixed(2)} VES
                      </span>
                    </div>
                  </div>
                </div>

                {/* MONTO A APORTAR */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-slate-500">Monto Aportado ({monedaAbono === "USD" ? "$" : "Bs."})</label>
                    <div className="flex bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                      <button type="button" onClick={() => cambiarMonedaAbono("USD")} className={`px-2 py-0.5 rounded-lg ${monedaAbono === "USD" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>USD</button>
                      <button type="button" onClick={() => cambiarMonedaAbono("VES")} className={`px-2 py-0.5 rounded-lg ${monedaAbono === "VES" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>Bs. VES</button>
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={montoAbono}
                    onChange={(e) => setMontoAbono(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-base font-black text-slate-900 outline-none"
                  />
                  {numIngresado > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900 mt-2">
                      <span>Tasa BCV: Bs. {tasaBCV.toFixed(2)}</span>
                      <span>{monedaAbono === "USD" ? `Bs. ${equivalenteCalculado.toFixed(2)} VES` : `$${equivalenteCalculado.toFixed(2)} USD`}</span>
                    </div>
                  )}
                </div>

                {/* MÉTODO DE PAGO */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "pagomovil", label: "Pago Móvil" },
                      { id: "zelle", label: "Zelle" },
                      { id: "efectivo", label: "En Sitio" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodoPago(m.id)}
                        className={`py-2.5 rounded-xl font-black text-[10px] uppercase border cursor-pointer ${
                          metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COMPROBANTE & REFERENCIA */}
                {metodoPago !== "efectivo" && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nº Referencia Transacción"
                      value={numReferencia}
                      onChange={(e) => setNumReferencia(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold outline-none"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSeleccionarImagen(e, setPreviewComprobante)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-xs font-bold outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-slate-900 file:text-[#00FF9D]"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={confirmarReservaYPago}
                  disabled={procesandoReserva}
                  className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black uppercase rounded-2xl shadow-md cursor-pointer hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {procesandoReserva ? "Confirmando..." : "Confirmar Reserva"}
                </button>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* POPUP NOTIFICACIÓN */}
      {mounted && popupNotif.open && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
            <h3 className="text-base font-black text-slate-900">{popupNotif.title}</h3>
            <p className="text-xs font-bold text-slate-600">{popupNotif.message}</p>
            <button
              onClick={() => setPopupNotif({ ...popupNotif, open: false })}
              className="w-full py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl cursor-pointer"
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