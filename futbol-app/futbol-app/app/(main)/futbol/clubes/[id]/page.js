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
  restaurant: { label: "Restaurante", icon: "🍽️" },
  cafeteria: { label: "Cafetería / Sport Bar", icon: "☕" },
  changing_room: { label: "Vestuarios y Duchas", icon: "🚿" },
  wifi: { label: "WiFi Gratis", icon: "📶" },
  lockers: { label: "Lockers / Casilleros", icon: "🔒" },
};

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

  // 🇻🇪 Tasa BCV Oficial
  const [tasaBCV, setTasaBCV] = useState(36.65);

  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [promocionHoy, setPromocionHoy] = useState(null);
  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });

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

  const [modalMiReservaOpen, setModalMiReservaOpen] = useState(false);
  const [matchMiReservaSel, setMatchMiReservaSel] = useState(null);
  const [formPagoExtra, setFormPagoExtra] = useState({
    monto: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });
  const [enviandoPagoExtra, setEnviandoPagoExtra] = useState(false);

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
      await Promise.all([
        obtenerTasaBCV(),
        cargarDetalleClub()
      ]);
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

    const channel = supabase
      .channel("realtime-futbol-locks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "padel_locks" },
        () => {
          cargarBloqueos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

  useEffect(() => {
    let intervalo;
    if (modalReservaOpen && tiempoRestante !== null && tiempoRestante > 0) {
      intervalo = setInterval(() => {
        setTiempoRestante((prev) => prev - 1);
      }, 1000);
    } else if (tiempoRestante === 0 && modalReservaOpen) {
      cerrarModalPorTiempoAgotado();
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
      console.error("Error cargando bloqueos:", error);
    }
  }

  const cerrarModalPorTiempoAgotado = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);
    mostrarNotificacion(
      "⏳ Tiempo Expirado",
      "Han pasado los 10 minutos. La cancha de fútbol ha sido liberada para otros usuarios.",
      "warning"
    );

    if (bloqueSeleccionado && user) {
      const d = bloqueSeleccionado.dateObj;
      const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

      await supabase
        .from("padel_locks")
        .delete()
        .match({
          court_id: bloqueSeleccionado.cancha.id,
          scheduled_at: fechaFija,
          user_id: user.id
        });

      await cargarBloqueos();
    }
  };

  const cerrarModalManual = async () => {
    setModalReservaOpen(false);
    setTiempoRestante(null);

    if (bloqueSeleccionado && user) {
      const d = bloqueSeleccionado.dateObj;
      const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

      await supabase
        .from("padel_locks")
        .delete()
        .match({
          court_id: bloqueSeleccionado.cancha.id,
          scheduled_at: fechaFija,
          user_id: user.id
        });

      await cargarBloqueos();
    }
  };

  async function cargarPromocionDelDia() {
    try {
      const ano = fechaSeleccionada.getFullYear();
      const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
      const hoyStr = `${ano}-${mes}-${dia}`;

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
      const { data: { session } } = await supabase.auth.getSession();

      if (session && session.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }

      const { data: clubData, error: cErr } = await supabase
        .from("clubs")
        .select("id, name, city, address, image_url, amenities, open_time, close_time, slot_duration_minutes")
        .eq("id", clubId)
        .maybeSingle();

      if (cErr || !clubData) {
        console.error("Club no encontrado en BD.");
        setClub(null);
        return;
      }

      setClub(clubData);

      // Cargar Canchas Públicas filtrando EXCLUSIVAMENTE las de Fútbol
      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, sport_type, price_normal, pricing_blocks")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("court_number", { ascending: true });

      const canchasFutbol = (courtsData || []).filter(
        (c) => c.sport_type === "futbol"
      );

      setCanchas(canchasFutbol);

      // Cargar Reservas / Partidos de las canchas del club
      const { data: matchesData } = await supabase
        .from("matches")
        .select("*, court:courts(name)")
        .eq("club_id", clubId)
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: true });

      const matchIds = (matchesData || []).map((m) => m.id);

      if (matchIds.length > 0) {
        const { data: playersData } = await supabase
          .from("match_players")
          .select("id, match_id, user_id, team")
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

        const partidosFinales = (matchesData || []).map((m) => ({
          ...m,
          players: playersByMatch[m.id] || [],
        }));

        setPartidosClub(partidosFinales);
      } else {
        setPartidosClub(matchesData || []);
      }
    } catch (err) {
      console.error("Error cargando detalle del club:", err);
    } finally {
      cargarPromocionDelDia();
    }
  }

  const calcularPrecioPorBloque = (cancha, horaInt, minutosInt) => {
    try {
      const horaFormateada = `${String(horaInt).padStart(2, '0')}:${String(minutosInt).padStart(2, '0')}`;

      if (!cancha.pricing_blocks || !Array.isArray(cancha.pricing_blocks) || cancha.pricing_blocks.length === 0) {
        const precioNormal = parseFloat(cancha.price_normal);
        return { precio: isNaN(precioNormal) ? 30 : precioNormal };
      }

      const bloqueEncontrado = cancha.pricing_blocks.find((bloque) => {
        return horaFormateada >= (bloque.start_time || "00:00") && horaFormateada < (bloque.end_time || "23:59");
      });

      if (bloqueEncontrado && !isNaN(parseFloat(bloqueEncontrado.price))) {
        return { precio: parseFloat(bloqueEncontrado.price) };
      }

      const primerPrecio = parseFloat(cancha.pricing_blocks[0].price);
      return { precio: isNaN(primerPrecio) ? 30 : primerPrecio };
    } catch (error) {
      console.error("Error calculando precio bloque:", error);
      return { precio: 30 };
    }
  };

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
    if (!club) return [];
    const duracion = club.slot_duration_minutes || 60;
    const horaApertura = parseInt((club.open_time || "07:00:00").split(":")[0], 10);
    const horaCierre = parseInt((club.close_time || "23:00:00").split(":")[0], 10);

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
  }, [club, fechaSeleccionada]);

  const abrirModalTurno = async (cancha, bloque, precioCalculado) => {
    if (!user) {
      mostrarNotificacion("Inicia Sesión", "Debes iniciar sesión para reservar una cancha.", "warning");
      setTimeout(() => router.push("/login"), 1800);
      return;
    }

    const d = bloque.dateObj;
    const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

    const lockExistente = bloqueosActivos.find((l) => {
      if (l.court_id !== cancha.id) return false;
      const fechaLockStr = l.scheduled_at.replace(" ", "T").substring(0, 16);
      return fechaLockStr === fechaFija.substring(0, 16);
    });

    if (lockExistente) {
      return mostrarNotificacion(
        "Cancha en proceso de reserva",
        "Alguien más está procesando el pago para esta cancha ahora mismo. Si no completa la reserva en 10 minutos, volverá a estar disponible.",
        "warning"
      );
    }

    try {
      setProcesandoReserva(true);

      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

      const { error: lockErr } = await supabase
        .from("padel_locks")
        .upsert({
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

      const precioBaseTotal = precioCalculado || cancha.price_normal || 30;
      const precioBaseInd = precioBaseTotal / 10;

      setBloqueSeleccionado({
        cancha,
        dateObj: bloque.dateObj,
        horaLabel: bloque.etiqueta,
        precioBaseTotal,
        precioBaseInd,
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
      console.error("Error al bloquear la cancha:", e);
      mostrarNotificacion("Error", "No se pudo iniciar la reserva, intenta nuevamente.", "error");
    } finally {
      setProcesandoReserva(false);
    }
  };

  const handleCambioTipoReserva = (tipo) => {
    setTipoReserva(tipo);
    if (!bloqueSeleccionado) return;
    const base = tipo === "privado" ? bloqueSeleccionado.precioBaseTotal : bloqueSeleccionado.precioBaseInd;
    const totalUSD = base * 1.10;
    setMontoAbono(monedaAbono === "USD" ? totalUSD.toFixed(2) : (totalUSD * tasaBCV).toFixed(2));
  };

  const handleSeleccionarImagen = (e, setPreview) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return mostrarNotificacion("Archivo Inválido", "Por favor selecciona una imagen válida (JPG, PNG).", "error");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const calculosPrecio = useMemo(() => {
    if (!bloqueSeleccionado) return { base: 0, fee: 0, totalSug: 0 };
    const base = tipoReserva === "privado" ? bloqueSeleccionado.precioBaseTotal : bloqueSeleccionado.precioBaseInd;
    const fee = base * 0.10;
    const totalSug = base + fee;
    return { base, fee, totalSug };
  }, [bloqueSeleccionado, tipoReserva]);

  const cambiarMonedaAbono = (nuevaMoneda) => {
    if (nuevaMoneda === monedaAbono) return;

    const valActual = parseFloat(montoAbono);
    if (!isNaN(valActual) && valActual > 0) {
      if (nuevaMoneda === "VES") {
        setMontoAbono((valActual * tasaBCV).toFixed(2));
      } else {
        setMontoAbono((valActual / tasaBCV).toFixed(2));
      }
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

    const montoUSD = monedaAbono === "VES" ? valIngresado / tasaBCV : valIngresado;
    const esPrivado = tipoReserva === "privado";

    try {
      setProcesandoReserva(true);

      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", user.id)
        .maybeSingle();

      const nombreUsuarioCompleto = userProf ? `${userProf.nombre || ""} ${userProf.apellido || ""}`.trim() : user.email;
      const telefonoUsuario = userProf?.telefono || "Sin teléfono";

      const estadoPagoFinal = metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente_aprobacion";

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: user.id,
        user_name: nombreUsuarioCompleto,
        user_phone: telefonoUsuario,
        amount: montoUSD,
        method: metodoPago,
        reference: numReferencia.trim() || (monedaAbono === "VES" ? `Abono Bs. ${valIngresado.toFixed(2)}` : "S/R"),
        receipt_url: previewComprobante || null,
        status: metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const d = bloqueSeleccionado.dateObj;
      const fechaFija = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

      const { data: newMatch, error: matchErr } = await supabase
        .from("matches")
        .insert({
          club_id: clubId,
          court_id: bloqueSeleccionado.cancha.id,
          scheduled_at: fechaFija,
          total_price: bloqueSeleccionado.precioBaseTotal,
          price_per_player: bloqueSeleccionado.precioBaseInd,
          app_fee: calculosPrecio.fee,
          match_type: esPrivado ? "privado" : "abierto",
          is_private: esPrivado,
          is_competitive: false,
          status: "programado",
          payment_status: estadoPagoFinal,
          payment_method: metodoPago,
          payment_proof_urls: previewComprobante ? [previewComprobante] : [],
          payments_history: [nuevoAbono],
          created_by: user.id,
          notes: "Reserva de Fútbol Caimana",
        })
        .select()
        .single();

      if (matchErr) throw new Error(matchErr.message || "Error guardando la reserva");

      await supabase.from("match_players").insert({
        match_id: newMatch.id,
        user_id: user.id,
        team: "A",
      });

      await supabase
        .from("padel_locks")
        .delete()
        .match({
          court_id: bloqueSeleccionado.cancha.id,
          scheduled_at: fechaFija,
        });

      await cargarBloqueos();

      setTiempoRestante(null);
      setModalReservaOpen(false);

      // REDIRECCIÓN DIRECTA A LA PÁGINA DEL PARTIDO RECIÉN CREADO
      router.push(`/futbol/partidos/${newMatch.id}`);

    } catch (err) {
      console.error("Error al procesar reserva:", err);
      if (err.message && err.message.includes("unique_court_time")) {
        mostrarNotificacion("Cancha ya no disponible", "Alguien más acaba de confirmar una reserva para esta cancha hace unos instantes.", "error");
      } else {
        mostrarNotificacion("Error al Reservar", err.message || "Verifica los datos e inténtalo de nuevo.", "error");
      }
    } finally {
      setProcesandoReserva(false);
    }
  }

  const abrirModalMiReserva = (match) => {
    setMatchMiReservaSel(match);

    const historial = Array.isArray(match.payments_history) ? match.payments_history : [];
    const totalAbonado = historial
      .filter((a) => a.status === "aprobado" || a.status === "pendiente")
      .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

    const totalCancha = (match.total_price || 30) + (match.app_fee || 3.00);
    const restante = Math.max(0, totalCancha - totalAbonado);

    setFormPagoExtra({
      monto: restante > 0 ? restante.toFixed(2) : "",
      metodoPago: "pago_movil",
      numReferencia: "",
      previewComprobante: "",
    });

    setModalMiReservaOpen(true);
  };

  async function agregarComprobanteExtraUser() {
    if (!matchMiReservaSel || !user) return;

    const montoValido = parseFloat(formPagoExtra.monto);
    if (isNaN(montoValido) || montoValido <= 0) {
      return mostrarNotificacion("Monto Inválido", "Por favor ingresa un monto válido a abonar.", "error");
    }

    if (formPagoExtra.metodoPago !== "efectivo" && !formPagoExtra.previewComprobante && !formPagoExtra.numReferencia.trim()) {
      return mostrarNotificacion("Falta Comprobante", "Por favor adjunta la captura del comprobante o ingresa el número de referencia.", "error");
    }

    try {
      setEnviandoPagoExtra(true);

      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", user.id)
        .maybeSingle();

      const nombreUsuarioCompleto = userProf ? `${userProf.nombre || ""} ${userProf.apellido || ""}`.trim() : user.email;
      const telefonoUsuario = userProf?.telefono || "Sin teléfono";

      const nuevoAbono = {
        id: `pay-${Date.now()}`,
        user_id: user.id,
        user_name: nombreUsuarioCompleto,
        user_phone: telefonoUsuario,
        amount: montoValido,
        method: formPagoExtra.metodoPago,
        reference: formPagoExtra.numReferencia.trim() || "S/R",
        receipt_url: formPagoExtra.previewComprobante || null,
        status: formPagoExtra.metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente",
        created_at: new Date().toISOString(),
      };

      const historialActual = Array.isArray(matchMiReservaSel.payments_history) ? matchMiReservaSel.payments_history : [];
      const historialNuevo = [...historialActual, nuevoAbono];

      const proofUrlsActuales = Array.isArray(matchMiReservaSel.payment_proof_urls) ? matchMiReservaSel.payment_proof_urls : [];
      const proofUrlsNuevas = formPagoExtra.previewComprobante
        ? [...proofUrlsActuales, formPagoExtra.previewComprobante]
        : proofUrlsActuales;

      const { error: updateErr } = await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_proof_urls: proofUrlsNuevas,
          payment_status: "pendiente_aprobacion",
        })
        .eq("id", matchMiReservaSel.id);

      if (updateErr) throw updateErr;

      setModalMiReservaOpen(false);
      mostrarNotificacion("✅ Comprobante Enviado", "¡Nuevo comprobante enviado con éxito! El gerente del club lo revisará en la recepción.", "success");
      await cargarDetalleClub();
    } catch (err) {
      console.error("Error al enviar pago extra:", err);
      mostrarNotificacion("Error", "Error al adjuntar el nuevo comprobante.", "error");
    } finally {
      setEnviandoPagoExtra(false);
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
    <div className="min-h-screen bg-slate-50/50 px-2 py-4 sm:px-6 md:px-8 space-y-6 sm:space-y-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">

        {/* HERO BANNER */}
        <div className="relative w-full h-52 sm:h-80 bg-slate-900 rounded-3xl sm:rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200">
          {club.image_url ? (
            <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div className="space-y-1 max-w-2xl">
              <span className="bg-emerald-500 text-slate-950 font-black text-[9px] sm:text-[10px] uppercase px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-sm">
                ⚽ Complejo de Fútbol Verificado
              </span>
              <h1 className="text-xl sm:text-4xl font-black">{club.name}</h1>
              <p className="text-[11px] sm:text-sm text-slate-300 font-medium">
                📍 {club.address || "Cabudare"}, {club.city}
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

        {/* LAYOUT 2 COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight">Amenidades</h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {listAmenidades.map((key) => {
                  const am = AMENIDADES_MAP[key] || { label: key, icon: "✨" };
                  return (
                    <span key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-100 text-slate-800 text-[11px] sm:text-xs font-bold">
                      <span>{am.icon}</span>
                      <span>{am.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6" id="reserva-pistas">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-200 shadow-sm space-y-4 sm:space-y-5">
              <div className="flex justify-between items-center border-b pb-3">
                <h2 className="text-base sm:text-lg font-black text-slate-900">Reserva tu Cancha en Tiempo Real</h2>
                <span className="text-[11px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">{canchas.length} canchas</span>
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
                        isSel ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-md" : "bg-slate-50 text-slate-600 border-slate-200"
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

              {/* AVISO DE PROMOCIÓN */}
              {promocionHoy && (
                <div className="bg-rose-50 border border-rose-200 p-3 sm:p-4 rounded-2xl flex items-center gap-3 shadow-sm my-4">
                  <span className="text-3xl animate-bounce">🎁</span>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-rose-900 uppercase tracking-tight">
                      {promocionHoy.name}
                    </h4>
                    <p className="text-[10px] sm:text-xs font-bold text-rose-700">
                      ¡Aprovecha! Precios especiales aplicados en las tarifas de hoy.
                    </p>
                  </div>
                </div>
              )}

              {/* GRILLA DE CANCHAS DE FÚTBOL */}
              <div className="overflow-x-auto relative rounded-2xl border-2 border-slate-300 bg-white shadow-xs">
                <div className="inline-min-w-full min-w-[500px] w-full">
                  
                  {/* CABECERA PISTAS */}
                  <div className="flex bg-slate-950 text-white border-b-2 border-slate-800 sticky top-0 z-30">
                    <div className="w-16 sm:w-24 shrink-0 p-2 sm:p-3 font-black text-[10px] sm:text-[11px] text-slate-300 text-center uppercase tracking-wider border-r border-slate-800 bg-slate-950 sticky left-0 z-40 shadow-xs">
                      Hora
                    </div>
                    {canchas.map((c) => (
                      <div key={c.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-2 sm:p-3 text-center border-l border-slate-800 font-black text-[11px] sm:text-xs uppercase tracking-tight">
                        ⚽ {c.name}
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
                        
                        <div className="w-16 sm:w-24 shrink-0 flex flex-col items-center justify-center bg-slate-100 border-r-2 border-slate-300 p-1 text-center sticky left-0 z-20 shadow-xs">
                          <span className="text-[11px] sm:text-xs font-black text-slate-900">{bloque.etiqueta.split(" ")[0]}</span>
                          <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase">{bloque.etiqueta.split(" ")[1]}</span>
                        </div>

                        {/* CELDAS CANCHAS */}
                        {canchas.map((cancha) => {
                          const ano = fechaSeleccionada.getFullYear();
                          const mes = String(fechaSeleccionada.getMonth() + 1).padStart(2, '0');
                          const dia = String(fechaSeleccionada.getDate()).padStart(2, '0');
                          const hora = String(bloque.horaInt).padStart(2, '0');
                          const minutos = String(bloque.minutosInt).padStart(2, '0');
                          const fechaSlotGrid = `${ano}-${mes}-${dia}T${hora}:${minutos}`;

                          const partidoOcupado = partidosClub.find((m) => {
                            if (m.court_id !== cancha.id) return false;
                            const fechaCitaDB = m.scheduled_at.substring(0, 16);
                            return fechaCitaDB === fechaSlotGrid;
                          });

                          const lockOcupado = bloqueosActivos.find((l) => {
                            if (l.court_id !== cancha.id) return false;
                            const fechaLockStr = l.scheduled_at.replace(" ", "T").substring(0, 16);
                            return fechaLockStr === fechaSlotGrid;
                          });

                          const { precio: precioOriginal } = calcularPrecioPorBloque(cancha, bloque.horaInt, bloque.minutosInt);
                          let precioUSD = precioOriginal;

                          let esPromoAplicada = false;

                          if (promocionHoy) {
                            const hasBlocks = promocionHoy.time_blocks && promocionHoy.time_blocks.length > 0;

                            if (hasBlocks) {
                              const horaBotonStr = `${hora}:${minutos}`;
                              const bloqueAplicable = promocionHoy.time_blocks.find((b) => {
                                return horaBotonStr >= (b.start_time || "00:00") && horaBotonStr < (b.end_time || "23:59");
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
                            const totalAbonado = Array.isArray(partidoOcupado.payments_history)
                              ? partidoOcupado.payments_history.filter((a) => a.status === "aprobado").reduce((sum, a) => sum + parseFloat(a.amount || 0), 0)
                              : 0;

                            const canchaBaseFee = (partidoOcupado.total_price || 30) + (partidoOcupado.app_fee || (partidoOcupado.total_price || 30) * 0.1);
                            const canchaTotalmentePagada = partidoOcupado.payment_status === "aprobado" || totalAbonado >= canchaBaseFee - 0.5;
                            const esPendiente = !canchaTotalmentePagada && (partidoOcupado.payment_status === "pendiente_aprobacion" || partidoOcupado.payment_status === "pago_en_sitio");
                            const esMiReserva = !!user && (partidoOcupado.created_by === user.id || (Array.isArray(partidoOcupado.players) && partidoOcupado.players.some((p) => p.user_id === user.id)));

                            if (esMiReserva) {
                              return (
                                <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200">
                                  {/* REDIRECCIÓN DIRECTA A LA PÁGINA DEL PARTIDO DESDE LA GRILLA */}
                                  <Link
                                    href={`/futbol/partidos/${partidoOcupado.id}`}
                                    className={`h-full w-full rounded-xl p-2 flex flex-col justify-between shadow-xs border-2 text-left transition-all block ${
                                      esPendiente ? "bg-amber-500 text-slate-950 border-amber-600 hover:bg-amber-400" : "bg-emerald-950 text-white border-emerald-500 hover:bg-emerald-900"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center w-full">
                                      <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#00FF9D] text-slate-950 truncate">
                                        MI RESERVA
                                      </span>
                                    </div>
                                    <div className="my-0.5">
                                      <p className="text-[11px] sm:text-[12px] font-black truncate text-white">Ver Partido →</p>
                                      <p className="text-[8px] text-slate-300 font-bold">Haz clic para gestionar</p>
                                    </div>
                                  </Link>
                                </div>
                              );
                            }

                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 flex flex-col justify-between shadow-xs border-2 text-left bg-slate-950 text-white border-slate-800 opacity-90 cursor-not-allowed">
                                  <div className="flex justify-between items-center w-full">
                                    <span className="text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">RESERVADO</span>
                                  </div>
                                  <p className="text-[11px] sm:text-[12px] font-black text-slate-400">Cancha Reservada</p>
                                </div>
                              </div>
                            );
                          }

                          if (lockOcupado) {
                            return (
                              <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200">
                                <div className="h-full rounded-xl p-2 flex flex-col items-center justify-center shadow-xs border-2 border-dashed border-amber-400 bg-amber-50/50 text-center cursor-not-allowed">
                                  <span className="text-xl animate-pulse">⏳</span>
                                  <p className="text-[10px] sm:text-[11px] font-black text-amber-600 mt-1">En proceso...</p>
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
                                {esPromoAplicada && (
                                  <span className="absolute top-1.5 left-1.5 text-[8px] font-black uppercase bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded shadow-sm">
                                    Promo
                                  </span>
                                )}

                                <span className="text-[11px] sm:text-xs font-black text-emerald-700 group-hover:scale-105 transition-transform">
                                  + Agendar
                                </span>

                                {esPromoAplicada ? (
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[8px] font-bold text-slate-400 line-through">${precioOriginal.toFixed(2)}</span>
                                      <span className="text-[10px] sm:text-[11px] font-black text-rose-500">${precioUSD.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-0.5">${precioUSD.toFixed(2)}</span>
                                )}
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

      {/* MODAL MI RESERVA CON ENLACE AL PARTIDO */}
      {mounted && modalMiReservaOpen && matchMiReservaSel && createPortal(
        (() => {
          const precioBase = matchMiReservaSel.total_price || 30;
          const feeApp = matchMiReservaSel.app_fee || (precioBase * 0.10);
          const totalCancha = precioBase + feeApp;

          const historialAbonos = Array.isArray(matchMiReservaSel.payments_history) ? matchMiReservaSel.payments_history : [];
          const totalAbonado = historialAbonos
            .filter((a) => a.status === "aprobado" || a.status === "pendiente")
            .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

          const restante = Math.max(0, totalCancha - totalAbonado);

          const dbDate = matchMiReservaSel.scheduled_at;
          const [datePart, timePart] = dbDate.split("T");
          const [year, month, day] = datePart.split("-").map(Number);
          const [hour, minute] = timePart.split(":").map(Number);
          
          const visualDate = new Date(year, month - 1, day);
          const formattedDate = visualDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
          
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const hora12 = hour % 12 || 12;
          const formattedTime = `${hora12}:${String(minute).padStart(2, '0')} ${ampm}`;

          return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4" onClick={() => setModalMiReservaOpen(false)}>
              <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
                
                <div className="border-b pb-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">Gestionar Mi Reserva de Fútbol</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <h3 className="text-lg font-black text-slate-900">⚽ {matchMiReservaSel.court?.name || "Cancha"}</h3>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">🏟️ {club?.name}</span>
                      </div>
                    </div>
                    <button onClick={() => setModalMiReservaOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1">✕</button>
                  </div>

                  <div className="bg-slate-900 text-white p-2.5 rounded-2xl flex justify-between items-center text-xs font-bold shadow-sm">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="text-base shrink-0">📅</span>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase text-slate-400 block leading-none">Fecha de Juego</span>
                        <p className="text-xs font-black truncate capitalize mt-0.5">{formattedDate}</p>
                      </div>
                    </div>
                    <div className="bg-[#00FF9D] text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs shrink-0 flex items-center gap-1 shadow-sm">
                      <span>⏰</span>
                      <span>{formattedTime}</span>
                    </div>
                  </div>
                </div>

                {/* BOTÓN DIRECTO AL CENTRO DEL PARTIDO */}
                <Link
                  href={`/futbol/partidos/${matchMiReservaSel.id}`}
                  className="w-full py-3 bg-[#0B0C15] hover:bg-slate-900 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <span>⚽ Ir a la página del Partido</span>
                  <span>→</span>
                </Link>

                <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs font-bold">
                  <div className="flex justify-between text-[#00FF9D]">
                    <span>Tarifa Cancha Base:</span>
                    <span className="font-black">${precioBase.toFixed(2)}</span>
                  </div>
                  {feeApp > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Comisión App (+10%):</span>
                      <span>+${feeApp.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t border-slate-800 pt-2 text-white">
                    <span>Total Cancha:</span>
                    <span className="text-[#00FF9D]">${totalCancha.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-800/60">
                    <span className="text-emerald-400">Abonado: ${totalAbonado.toFixed(2)}</span>
                    <span className={restante > 0 ? "text-amber-400 font-black" : "text-slate-400"}>Restante: ${restante.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Comprobantes Enviados ({historialAbonos.length}):</h4>
                  {historialAbonos.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 bg-slate-50 p-3 rounded-xl text-center">Aún no hay comprobantes registrados.</p>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
                      {historialAbonos.map((ab, idx) => (
                        <div key={ab.id || idx} className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <p className="font-black text-slate-900">{ab.user_name || "Comprobante"}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{ab.method} • Ref: {ab.reference}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-slate-900 block">${parseFloat(ab.amount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 sm:p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">+ Adjuntar Nuevo Pago / Comprobante Extra</h4>

                  <div className="space-y-3 text-xs font-bold text-slate-700">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Monto que Pagas ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formPagoExtra.monto}
                        onChange={(e) => setFormPagoExtra({ ...formPagoExtra, monto: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 outline-none"
                        placeholder="Ej. 10.00"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Método de Pago</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "pago_movil", label: "📱 Pago Móvil" },
                          { id: "zelle", label: "🇺🇸 Zelle" },
                          { id: "efectivo", label: "💵 En Sitio" },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setFormPagoExtra({ ...formPagoExtra, metodoPago: m.id })}
                            className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all ${
                              formPagoExtra.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-white text-slate-600 border-slate-200"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {formPagoExtra.metodoPago !== "efectivo" && (
                      <>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Número de Referencia</label>
                          <input
                            type="text"
                            placeholder="Ej. #123456"
                            value={formPagoExtra.numReferencia}
                            onChange={(e) => setFormPagoExtra({ ...formPagoExtra, numReferencia: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-bold outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Foto / Captura del Comprobante</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSeleccionarImagen(e, (res) => setFormPagoExtra({ ...formPagoExtra, previewComprobante: res }))}
                            className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs font-bold outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-900 file:text-[#00FF9D]"
                          />

                          {formPagoExtra.previewComprobante && (
                            <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-28 bg-slate-950 flex items-center justify-center">
                              <img src={formPagoExtra.previewComprobante} alt="Preview Comprobante" className="max-h-28 object-contain" />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={agregarComprobanteExtraUser}
                      disabled={enviandoPagoExtra}
                      className="w-full py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-xl shadow-md mt-1 cursor-pointer"
                    >
                      {enviandoPagoExtra ? "Enviando Comprobante..." : "+ Enviar Comprobante Adicional"}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* MODAL PASARELA DE PAGO CLIENTE CON COMISIÓN (+10%) Y BCV */}
      {mounted && modalReservaOpen && bloqueSeleccionado && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4" onClick={cerrarModalManual}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
            
            <div className="border-b pb-3 space-y-2.5 relative">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">
                    Reserva de Cancha de Fútbol
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h3 className="text-lg font-black text-slate-900">⚽ {bloqueSeleccionado.cancha.name}</h3>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      🏟️ {club?.name}
                    </span>
                  </div>
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
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="text-base shrink-0">📅</span>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block leading-none">Fecha de Juego</span>
                    <p className="text-xs font-black truncate capitalize mt-0.5">
                      {fechaSeleccionada.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                  </div>
                </div>
                
                <div className="bg-[#00FF9D] text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs shrink-0 flex items-center gap-1 shadow-sm">
                  <span>⏰</span>
                  <span>{bloqueSeleccionado.horaLabel}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-700">
              
              {/* DESGLOSE FACTURA */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between items-start text-[#00FF9D]">
                  <span>Cancha Base (Fútbol):</span>
                  <div className="text-right">
                    <span className="text-[#00FF9D] font-black block">${calculosPrecio.base.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400/80 block">Bs. {(calculosPrecio.base * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-start text-slate-400">
                  <span>Comisión App (+10%):</span>
                  <div className="text-right">
                    <span className="font-black block text-slate-300">+${calculosPrecio.fee.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 block">Bs. {(calculosPrecio.fee * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end border-t border-slate-800 pt-2 text-white">
                  <div>
                    <span className="text-xs font-black block">Total Sugerido:</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#00FF9D] block">${calculosPrecio.totalSug.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Bs. {(calculosPrecio.totalSug * tasaBCV).toFixed(2)} VES
                    </span>
                  </div>
                </div>
              </div>

              {/* INPUT MONTO CON SWITCH Y CONVERSIÓN BCV */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Monto a Abonar Hoy ({monedaAbono === "USD" ? "$" : "Bs."}):
                  </label>
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => cambiarMonedaAbono("USD")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        monedaAbono === "USD" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"
                      }`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarMonedaAbono("VES")}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        monedaAbono === "VES" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"
                      }`}
                    >
                      Bs. VES
                    </button>
                  </div>
                </div>
                
                <input
                  type="number"
                  step="0.01"
                  required
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-lg font-black text-slate-900 outline-none focus:border-blue-500"
                  placeholder={monedaAbono === "USD" ? "Ej. 33.00" : "Ej. 1200.00"}
                />

                {numIngresado > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900 mt-2">
                    <span>🧮 Conversión Tasa BCV (Bs. {tasaBCV.toFixed(2)}):</span>
                    <span>
                      {monedaAbono === "USD"
                        ? `Bs. ${equivalenteCalculado.toFixed(2)} VES`
                        : `$${equivalenteCalculado.toFixed(2)} USD`}
                    </span>
                  </div>
                )}
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
                      className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {metodoPago === "pago_movil" && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl text-[11px] text-blue-900 space-y-1">
                  <p className="font-black">🏦 Datos Pago Móvil:</p>
                  <p>Banco: Banesco (0134) • C.I: V-12345678 • Tel: 0414-1234567</p>
                </div>
              )}

              {metodoPago === "zelle" && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded-2xl text-[11px] text-purple-900 space-y-1">
                  <p className="font-black">🇺🇸 Datos Zelle:</p>
                  <p>Correo: pagos@sportshub.com • Titular: Sports Hub LLC</p>
                </div>
              )}

              {metodoPago !== "efectivo" && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Número de Referencia de Transacción
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. #123456"
                      value={numReferencia}
                      onChange={(e) => setNumReferencia(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                      Adjuntar Captura / Foto del Comprobante (Imagen)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSeleccionarImagen(e, setPreviewComprobante)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-900 file:text-[#00FF9D]"
                    />

                    {previewComprobante && (
                      <div className="mt-2 relative rounded-2xl overflow-hidden border border-slate-200 max-h-36 bg-slate-950 flex items-center justify-center">
                        <img src={previewComprobante} alt="Preview Comprobante" className="max-h-36 object-contain" />
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={confirmarReservaYPago}
                disabled={procesandoReserva}
                className="w-full py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-wider rounded-2xl shadow-md cursor-pointer"
              >
                {procesandoReserva ? "Enviando..." : "Confirmar y Enviar Abono"}
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