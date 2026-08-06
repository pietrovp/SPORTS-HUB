"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

function parsearFechaBD(fechaStr) {
  if (!fechaStr) return new Date();
  const str = fechaStr.replace(" ", "T");
  return new Date(str.endsWith("Z") || str.includes("+") ? str : `${str}Z`);
}

export default function RecepcionElite() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  
  // 🇻🇪 Tasa BCV Oficial
  const [tasaBCV, setTasaBCV] = useState(36.65);

  // Configuración de Fechas
  const [fechaBase, setFechaBase] = useState(new Date());

  // Datos Principales
  const [canchas, setCanchas] = useState([]);
  const [partidosPeriodo, setPartidosPeriodo] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  // NUEVO ESTADO PARA LA PROMOCIÓN
  const [promocionHoy, setPromocionHoy] = useState(null); 

  // POPUPS / NOTIFICACIONES PERSONALIZADAS
  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });
  const [modalConfirm, setModalConfirm] = useState({ open: false, title: "", message: "", action: null });

  // Modal Agendar Directo POS
  const [modalAgendarOpen, setModalAgendarOpen] = useState(false);
  const [bloqueAgendar, setBloqueAgendar] = useState(null);
  const [monedaAgendarPOS, setMonedaAgendarPOS] = useState("USD"); // 'USD' | 'VES'
  const [formAgendarPOS, setFormAgendarPOS] = useState({
    nombreCliente: "",
    telefonoCliente: "",
    metodoPago: "pago_movil",
    montoCustomUSD: "",
    numReferencia: "",
    previewComprobante: "",
  });

  // Modal Auditoría / Gestionar Reserva Existente
  const [modalDetalleMatch, setModalDetalleMatch] = useState(false);
  const [matchSeleccionado, setMatchSeleccionado] = useState(null);
  const [extrasBackup, setExtrasBackup] = useState([]);
  const [modalConfirmCambios, setModalConfirmCambios] = useState(false);
  const [imagenEngrande, setImagenEngrande] = useState(null);

  // Estados Desplegables del Modal de Gestión
  const [historialAbierto, setHistorialAbierto] = useState(true);
  const [cobroAbierto, setCobroAbierto] = useState(true);

  // Abono y Extras en POS
  const [monedaCobroPOS, setMonedaCobroPOS] = useState("USD"); // 'USD' | 'VES'
  const [montoAbonoManualPOS, setMontoAbonoManualPOS] = useState("");
  const [metodoAbonoManualPOS, setMetodoAbonoManualPOS] = useState("pago_movil");
  const [numRefAbonoManualPOS, setNumRefAbonoManualPOS] = useState("");
  const [previewAbonoManualPOS, setPreviewAbonoManualPOS] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    setMounted(true);
    cargarDatosGenerales();
    obtenerTasaBCV();
  }, []);

  useEffect(() => {
    if (clubId) {
      cargarPartidosPeriodo();
    }
  }, [clubId, fechaBase]);

// NUEVO USE-EFFECT
useEffect(() => {
  if (clubId) {
    chequearPromocion(clubId, fechaBase);
  }
}, [clubId, fechaBase]);

  // Suscripción Realtime
  useEffect(() => {
    if (!clubId || !supabase) return;

    const channel = supabase
      .channel("pos-realtime-matches-full-v28")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "padel_matches", filter: `club_id=eq.${clubId}` },
        () => cargarPartidosPeriodo()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `club_id=eq.${clubId}` },
        () => cargarDatosGenerales()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, fechaBase]);

  const mostrarNotificacion = (title, message, type = "info") => {
    setPopupNotif({ open: true, title, message, type });
  };

  const pedirConfirmacion = (title, message, action) => {
    setModalConfirm({ open: true, title, message, action });
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
      console.error("Fallo al consultar BCV:", e);
    }
  }

  // NUEVA FUNCIÓN PARA CHEQUEAR PROMOCIONES
async function chequearPromocion(clubIdActual, fechaActual) {
  if (!clubIdActual) return;
  
  // Convertir fechaBase a YYYY-MM-DD local
  const year = fechaActual.getFullYear();
  const month = String(fechaActual.getMonth() + 1).padStart(2, '0');
  const day = String(fechaActual.getDate()).padStart(2, '0');
  const hoyStr = `${year}-${month}-${day}`;

  try {
    const { data } = await supabase
      .from("padel_promotions")
      .select("*")
      .eq("club_id", clubIdActual)
      .lte("start_date", hoyStr)
      .gte("end_date", hoyStr)
      .maybeSingle();
      
    setPromocionHoy(data || null);
  } catch (error) {
    console.error("Error buscando promoción:", error);
  }
} 

  async function cargarDatosGenerales() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", authUser.id)
        .single();

      let targetClubId = profile?.club_id;
      if (!targetClubId) {
        const { data: clubCreado } = await supabase
          .from("padel_clubs")
          .select("id")
          .eq("created_by", authUser.id)
          .maybeSingle();

        targetClubId = clubCreado?.id || null;
      }

      if (!targetClubId) return setLoading(false);
      setClubId(targetClubId);

      const { data: clubData } = await supabase.from("padel_clubs").select("*").eq("id", targetClubId).maybeSingle();
      setClubInfo(clubData || { slot_duration_minutes: 60, open_time: "07:00:00", close_time: "23:00:00" });

      const { data: courts } = await supabase.from("padel_courts").select("*").eq("club_id", targetClubId).eq("is_active", true).order("court_number");
      setCanchas(courts || []);

      const { data: inventory } = await supabase.from("products").select("*").eq("club_id", targetClubId).order("name");
      setProductos(inventory || []);
    } catch (err) {
      console.error("Error al cargar datos del POS:", err);
    } finally {
      setLoading(false);
    }
  }

  async function cargarPartidosPeriodo() {
    if (!clubId) return;

    let inicio = new Date(fechaBase);
    inicio.setHours(0, 0, 0, 0);

    let fin = new Date(fechaBase);
    fin.setHours(23, 59, 59, 999);

    const { data: matches, error: matchErr } = await supabase
      .from("padel_matches")
      .select("*, court:padel_courts(name)")
      .eq("club_id", clubId)
      .gte("scheduled_at", inicio.toISOString())
      .lte("scheduled_at", fin.toISOString())
      .neq("status", "cancelado");

    if (matchErr) {
      console.error("Error cargando reservas:", matchErr);
      return;
    }

    const matchIds = (matches || []).map((m) => m.id);

    if (matchIds.length > 0) {
      const { data: players } = await supabase
        .from("padel_match_players")
        .select("id, match_id, user_id, team")
        .in("match_id", matchIds);

      const allUserIds = Array.from(new Set((players || []).map((p) => p.user_id).filter(Boolean)));
      let userProfilesMap = {};

      if (allUserIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre, apellido, telefono, email").in("id", allUserIds);
        (profs || []).forEach((p) => { userProfilesMap[p.id] = p; });
      }

      const playersMap = {};
      (players || []).forEach((p) => {
        if (!playersMap[p.match_id]) playersMap[p.match_id] = [];
        playersMap[p.match_id].push({
          ...p,
          profile: userProfilesMap[p.user_id] || null
        });
      });

      const finalMatches = (matches || []).map((m) => ({
        ...m,
        creator_profile: userProfilesMap[m.created_by] || null,
        players: playersMap[m.id] || [],
      }));

      setPartidosPeriodo(finalMatches);

      if (matchSeleccionado) {
        const actualizado = finalMatches.find(m => m.id === matchSeleccionado.id);
        if (actualizado) setMatchSeleccionado(actualizado);
      }
    } else {
      setPartidosPeriodo(matches || []);
    }
  }

  const abrirModalDetalle = (reservado) => {
    setMatchSeleccionado(reservado);
    setExtrasBackup(Array.isArray(reservado.extra_items) ? [...reservado.extra_items] : []);
    setHistorialAbierto(true);
    setCobroAbierto(reservado.payment_status !== "liquidado");
    setModalDetalleMatch(true);
  };

  const solicitarCerrarModalDetalle = () => {
    const actualStr = JSON.stringify(matchSeleccionado?.extra_items || []);
    const backupStr = JSON.stringify(extrasBackup || []);

    if (actualStr !== backupStr) {
      setModalConfirmCambios(true);
    } else {
      setModalDetalleMatch(false);
    }
  };

  const descartarCambiosExtras = async () => {
    if (!matchSeleccionado) return;
    try {
      setProcesando(true);

      const totalAbonado = (Array.isArray(matchSeleccionado.payments_history) ? matchSeleccionado.payments_history : [])
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = matchSeleccionado.total_price || 15;
      const fee = matchSeleccionado.app_fee || precioBase * 0.10;
      const totalExtrasBackup = extrasBackup.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
      const totalGranEsperado = precioBase + fee + totalExtrasBackup;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const estadoPagoFinal = matchSeleccionado.payment_status === "liquidado" 
        ? "liquidado" 
        : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

      await supabase
        .from("padel_matches")
        .update({
          extra_items: extrasBackup,
          payment_status: estadoPagoFinal,
        })
        .eq("id", matchSeleccionado.id);

      await cargarPartidosPeriodo();
    } catch (e) {
      console.error("Error restaurando extras:", e);
    } finally {
      setProcesando(false);
      setModalConfirmCambios(false);
      setModalDetalleMatch(false);
    }
  };

  const guardarCambiosExtras = () => {
    setModalConfirmCambios(false);
    setModalDetalleMatch(false);
    mostrarNotificacion("Cambios Guardados", "✅ Se han conservado las modificaciones en la reserva.", "success");
  };

  const obtenerNombreCliente = (reservado) => {
    if (!reservado) return "Cliente Mostrador";
    if (reservado.notes && reservado.notes.trim()) {
      return reservado.notes.replace(/^Cliente:\s*/i, "");
    }
    if (reservado.creator_profile) {
      return `${reservado.creator_profile.nombre || ""} ${reservado.creator_profile.apellido || ""}`.trim();
    }
    return "Cliente Mostrador";
  };

  const chequearSiEsPico = (dateObj) => {
    const startStr = clubInfo?.peak_start_time || "17:00:00"; 
    const endStr = clubInfo?.peak_end_time || "22:00:00";
    
    const slotMins = dateObj.getHours() * 60 + dateObj.getMinutes();
    
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    
    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (startMins <= endMins) {
      return slotMins >= startMins && slotMins < endMins;
    } else {
      return slotMins >= startMins || slotMins < endMins;
    }
  };

  const bloquesHorarios = useMemo(() => {
    const duracion = clubInfo?.slot_duration_minutes || 60;
    const horaApertura = parseInt((clubInfo?.open_time || "07:00:00").split(":")[0], 10);
    const horaCierre = parseInt((clubInfo?.close_time || "23:00:00").split(":")[0], 10);

    const bloques = [];
    let cur = new Date(fechaBase);
    cur.setHours(horaApertura, 0, 0, 0);

    const end = new Date(fechaBase);
    end.setHours(horaCierre, 0, 0, 0);

    while (cur <= end) {
      if (cur.getHours() === horaCierre && cur.getMinutes() > 0) break;
      const hStr = cur.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });
      bloques.push({
        etiqueta: hStr,
        horaInt: cur.getHours(),
        minutosInt: cur.getMinutes(),
      });
      cur.setMinutes(cur.getMinutes() + duracion);
    }
    return bloques;
  }, [clubInfo, fechaBase]);

  const obtenerReserva = (canchaId, bloqueDateObj) => {
    return partidosPeriodo.find((p) => {
      if (p.court_id !== canchaId) return false;
      const t = parsearFechaBD(p.scheduled_at);
      return (
        t.getFullYear() === bloqueDateObj.getFullYear() &&
        t.getMonth() === bloqueDateObj.getMonth() &&
        t.getDate() === bloqueDateObj.getDate() &&
        t.getHours() === bloqueDateObj.getHours() &&
        t.getMinutes() === bloqueDateObj.getMinutes()
      );
    });
  };

  const abrirModalAgendarPOS = (cancha, dateObj, horaLabel, precioCalculado) => {
    const precioBaseTotal = precioCalculado || cancha.price_credits || 15;
    const feeSugerido = precioBaseTotal * 0.10;
    const totalSugerido = precioBaseTotal + feeSugerido;

    setBloqueAgendar({ cancha, dateObj, horaLabel, precioBaseTotal });
    setMonedaAgendarPOS("USD");
    setFormAgendarPOS({
      nombreCliente: "",
      telefonoCliente: "",
      metodoPago: "pago_movil",
      montoCustomUSD: totalSugerido.toFixed(2),
      numReferencia: "",
      previewComprobante: "",
    });
    setModalAgendarOpen(true);
  };

  const calculosAgendarPOS = useMemo(() => {
    if (!bloqueAgendar) return { base: 0, fee: 0, totalSugerido: 0 };
    const base = bloqueAgendar.precioBaseTotal;
    const fee = base * 0.10;
    const totalSugerido = base + fee;
    return { base, fee, totalSugerido };
  }, [bloqueAgendar]);

  const handleSeleccionarImagenPOS = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return mostrarNotificacion("Archivo Inválido", "Por favor selecciona una imagen válida (JPG, PNG).", "error");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  async function ejecutarAgendarPOS(e) {
    e.preventDefault();
    if (!bloqueAgendar) return;

    const valIngresado = parseFloat(formAgendarPOS.montoCustomUSD);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Por favor ingresa un monto válido a cobrar.", "error");
    }

    if (formAgendarPOS.metodoPago !== "efectivo" && !formAgendarPOS.numReferencia.trim()) {
      return mostrarNotificacion("Falta Referencia", `Por favor ingresa el N° de Referencia para ${formAgendarPOS.metodoPago.toUpperCase().replace("_", " ")}.`, "error");
    }

    const montoUSD = monedaAgendarPOS === "VES" ? valIngresado / tasaBCV : valIngresado;

    try {
      setProcesando(true);
      const { cancha, dateObj } = bloqueAgendar;
      const { base, fee, totalSugerido } = calculosAgendarPOS;

      const nombreCliente = formAgendarPOS.nombreCliente.trim() || "Cliente Mostrador";
      const telefonoCliente = formAgendarPOS.telefonoCliente.trim();
      const notaFinal = telefonoCliente ? `${nombreCliente} (${telefonoCliente})` : nombreCliente;

      const nuevoAbonoPOS = {
        id: `pay-pos-${Date.now()}`,
        user_id: user.id,
        user_name: nombreCliente,
        user_phone: telefonoCliente || "En sitio",
        amount: montoUSD,
        method: formAgendarPOS.metodoPago,
        reference: formAgendarPOS.numReferencia.trim() || "Venta Directa POS",
        receipt_url: formAgendarPOS.previewComprobante || null,
        status: "aprobado",
        created_at: new Date().toISOString(),
      };

      const pagoCompleto = montoUSD >= totalSugerido - 0.05;
      const estadoPagoInicial = pagoCompleto ? "aprobado" : "pendiente_aprobacion";

      const { data: newMatch, error: matchErr } = await supabase
        .from("padel_matches")
        .insert({
          club_id: clubId,
          court_id: cancha.id,
          scheduled_at: dateObj.toISOString(),
          total_price: base,
          price_per_player: base / 4,
          app_fee: fee,
          match_type: "privado",
          is_private: true,
          status: "programado",
          payment_status: estadoPagoInicial,
          payment_method: formAgendarPOS.metodoPago,
          payment_proof_urls: formAgendarPOS.previewComprobante ? [formAgendarPOS.previewComprobante] : [],
          payments_history: [nuevoAbonoPOS],
          created_by: user.id,
          notes: notaFinal,
        })
        .select()
        .single();

      if (matchErr) throw matchErr;

      await supabase.from("padel_match_players").insert({
        match_id: newMatch.id,
        user_id: user.id,
        team: "A",
      });

      setModalAgendarOpen(false);
      mostrarNotificacion(
        "¡Reserva Agendada!",
        `✅ Pista agendada con éxito por $${montoUSD.toFixed(2)} USD (${monedaAgendarPOS === "VES" ? `Bs. ${valIngresado.toFixed(2)}` : `Bs. ${(montoUSD * tasaBCV).toFixed(2)}`}) mediante ${formAgendarPOS.metodoPago.toUpperCase()}.`,
        "success"
      );
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error al Agendar", err.message || "Error al procesar la reserva.", "error");
    } finally {
      setProcesando(false);
    }
  }

  const calcularTotalExtras = (match) => {
    const extras = Array.isArray(match?.extra_items) ? match.extra_items : [];
    return extras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
  };

  // LIQUIDAR RESERVA
  async function cerrarTicketYLiquidarReserva(match) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ya Liquidado", "Esta reserva ya fue liquidada e ingresada al historial de ventas.", "info");
    }

    try {
      setProcesando(true);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const totalAbonadoAprobado = historialActual
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const restante = Math.max(0, totalGranEsperado - totalAbonadoAprobado);

      let historialNuevo = [...historialActual];
      if (restante > 0) {
        historialNuevo.push({
          id: `pay-pos-close-${Date.now()}`,
          user_id: user.id,
          user_name: "Liquidación Recepción POS",
          user_phone: "En sitio",
          amount: restante,
          method: metodoAbonoManualPOS || "pago_movil",
          reference: numRefAbonoManualPOS.trim() || "Cierre de Ticket POS",
          receipt_url: previewAbonoManualPOS || null,
          status: "aprobado",
          created_at: new Date().toISOString(),
        });
      }

      historialNuevo = historialNuevo.map((item) => ({ ...item, status: "aprobado" }));

      // Crear entrada única en la tabla sales
      const { data: ventaCaja, error: errVenta } = await supabase
        .from("sales")
        .insert({
          club_id: clubId,
          cashier_id: user.id,
          total_amount: totalGranEsperado,
          payment_method: metodoAbonoManualPOS || match.payment_method || "efectivo",
          exchange_rate: tasaBCV,
        })
        .select("id")
        .single();

      if (errVenta) throw errVenta;
      // Determinamos el nombre del ítem dependiendo de si hay promo
      let nombreItemCancha = `Reserva Completa: ${match.court?.name || "Pista"}`;
      if (promocionHoy) {
        nombreItemCancha = `Reserva (Promo ${promocionHoy.name}): ${match.court?.name || "Pista"}`;
      }

      const itemsAInsertar = [
        {
          sale_id: ventaCaja.id,
          item_type: "cancha",
          item_name: nombreItemCancha,
          item_detail: `Cliente: ${obtenerNombreCliente(match)}`,
          quantity: 1,
          price_unit: precioBase,
        },
      ];

      if (fee > 0) {
        itemsAInsertar.push({
          sale_id: ventaCaja.id,
          item_type: "comision_app",
          item_name: "Comisión App Sports Hub",
          item_detail: "Cobrado al usuario",
          quantity: 1,
          price_unit: fee,
        });
      }

      const extrasList = Array.isArray(match.extra_items) ? match.extra_items : [];
      const productosVendidos = {};

      extrasList.forEach((ex) => {
        itemsAInsertar.push({
          sale_id: ventaCaja.id,
          item_type: "producto",
          item_name: `Extra: ${ex.name}`,
          item_detail: "Consumo de tienda",
          quantity: 1,
          price_unit: parseFloat(ex.price) || 0,
        });

        if (ex.id) {
          if (!productosVendidos[ex.id]) {
            productosVendidos[ex.id] = 0;
          }
          productosVendidos[ex.id] += 1;
        }
      });

      await supabase.from("sales_items").insert(itemsAInsertar);

      // DESCUENTO DE STOCK REAL EN INVENTARIO
      if (Object.keys(productosVendidos).length > 0) {
        const { data: currentProducts } = await supabase
          .from("products")
          .select("id, stock, is_rental")
          .in("id", Object.keys(productosVendidos));

        if (currentProducts) {
          const updates = currentProducts
            .filter(p => !p.is_rental)
            .map(p => {
              const cantidadVendida = productosVendidos[p.id] || 0;
              const nuevoStock = Math.max(0, p.stock - cantidadVendida);
              
              return supabase
                .from("products")
                .update({ stock: nuevoStock })
                .eq("id", p.id);
            });
          
          if (updates.length > 0) {
            await Promise.all(updates);
          }
        }
      }

      await supabase
        .from("padel_matches")
        .update({
          payments_history: historialNuevo,
          payment_status: "liquidado",
        })
        .eq("id", match.id);

      setModalDetalleMatch(false);
      mostrarNotificacion(
        "Ticket Liquidado",
        `🔒 ¡RESERVA CONFIRMADA! Se registraron $${totalGranEsperado.toFixed(2)} (Bs. ${(totalGranEsperado * tasaBCV).toFixed(2)}) en el historial y se descontó el inventario.`,
        "success"
      );
      
      await cargarDatosGenerales();
      await cargarPartidosPeriodo();

    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error al liquidar el ticket.", "error");
    } finally {
      setProcesando(false);
    }
  }

  function cancelarReserva(match) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "No se puede anular una reserva que ya fue liquidada e ingresada en las ventas oficiales.", "warning");
    }

    pedirConfirmacion(
      "Anular Reserva Completa",
      `¿Deseas anular completamente la reserva de ${match.court?.name || "Pista"}? Se liberará la agenda y se removerán los registros asociados.`,
      async () => {
        try {
          setProcesando(true);

          const { error: matchErr } = await supabase
            .from("padel_matches")
            .update({ status: "cancelado", payment_status: "cancelado" })
            .eq("id", match.id);

          if (matchErr) throw matchErr;

          const clienteNom = obtenerNombreCliente(match);
          const { data: ventasCoincidentes } = await supabase
            .from("sales_items")
            .select("sale_id")
            .ilike("item_detail", `%${clienteNom}%`);

          if (ventasCoincidentes && ventasCoincidentes.length > 0) {
            const saleIds = Array.from(new Set(ventasCoincidentes.map(v => v.sale_id)));
            await supabase.from("sales_items").delete().in("sale_id", saleIds);
            await supabase.from("sales").delete().in("id", saleIds);
          }

          setModalDetalleMatch(false);
          mostrarNotificacion("Reserva Anulada", "🚨 La reserva fue anulada y la pista ha quedado libre.", "info");
          await cargarPartidosPeriodo();
        } catch (err) {
          console.error(err);
          mostrarNotificacion("Error", "Error al anular la reserva.", "error");
        } finally {
          setProcesando(false);
        }
      }
    );
  }

  async function agregarAbonoManualPOS(match) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "No se pueden agregar más cobros a un ticket que ya fue liquidado.", "warning");
    }

    const valIngresado = parseFloat(montoAbonoManualPOS);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Ingresa un monto válido a cobrar.", "error");
    }

    if (metodoAbonoManualPOS !== "efectivo" && !numRefAbonoManualPOS.trim()) {
      return mostrarNotificacion("Falta Referencia", `Por favor ingresa el N° de referencia para el pago.`, "error");
    }

    const montoFinalUSD = monedaCobroPOS === "VES" ? valIngresado / tasaBCV : valIngresado;

    try {
      setProcesando(true);

      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const nuevoAbono = {
        id: `pay-pos-${Date.now()}`,
        user_id: user.id,
        user_name: "Cliente Mostrador (POS)",
        user_phone: "En sitio",
        amount: montoFinalUSD,
        method: metodoAbonoManualPOS,
        reference: numRefAbonoManualPOS.trim() || (monedaCobroPOS === "VES" ? `Cobro Bs. ${valIngresado.toFixed(2)}` : "Cobro POS"),
        receipt_url: previewAbonoManualPOS || null,
        status: "aprobado",
        created_at: new Date().toISOString(),
      };

      const historialNuevo = [...historialActual, nuevoAbono];

      const totalAbonado = historialNuevo
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const nuevoEstadoGeneral = match.payment_status === "liquidado" 
        ? "liquidado" 
        : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

      await supabase
        .from("padel_matches")
        .update({
          payments_history: historialNuevo,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      mostrarNotificacion(
        "Abono Registrado",
        `✅ Registrado $${montoFinalUSD.toFixed(2)} USD (${monedaCobroPOS === "VES" ? `Bs. ${valIngresado.toFixed(2)}` : `Bs. ${(montoFinalUSD * tasaBCV).toFixed(2)}`}).`,
        "success"
      );
      setMontoAbonoManualPOS("");
      setNumRefAbonoManualPOS("");
      setPreviewAbonoManualPOS("");
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error registrando el abono.", "error");
    } finally {
      setProcesando(false);
    }
  }

  // 💵 REGISTRAR DEVOLUCIÓN DE CAMBIO EN EFECTIVO
  async function registrarDevolucionCambioPOS(match, cambioUSD) {
    if (cambioUSD <= 0.05) return;
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "No se puede registrar cambio en una reserva ya liquidada.", "warning");
    }

    try {
      setProcesando(true);
      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const nuevoAbono = {
        id: `pay-pos-change-${Date.now()}`,
        user_id: user.id,
        user_name: "Devolución de Cambio (POS)",
        user_phone: "En sitio",
        amount: -Math.abs(cambioUSD),
        method: "efectivo",
        reference: `Entrega Cambio $${cambioUSD.toFixed(2)}`,
        receipt_url: null,
        status: "aprobado",
        created_at: new Date().toISOString(),
      };

      const historialNuevo = [...historialActual, nuevoAbono];

      await supabase
        .from("padel_matches")
        .update({
          payments_history: historialNuevo,
        })
        .eq("id", match.id);

      mostrarNotificacion(
        "Cambio Registrado",
        `💵 Se registró la entrega de $${cambioUSD.toFixed(2)} USD (Bs. ${(cambioUSD * tasaBCV).toFixed(2)}) en cambio.`,
        "success"
      );
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error al registrar la devolución de cambio.", "error");
    } finally {
      setProcesando(false);
    }
  }

  async function aprobarPagoPendiente(match, pagoId) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "Esta reserva ya está liquidada.", "warning");
    }

    try {
      setProcesando(true);
      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      
      const historialNuevo = historialActual.map(p => 
        p.id === pagoId ? { ...p, status: "aprobado" } : p
      );

      const totalAbonado = historialNuevo
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const nuevoEstadoGeneral = match.payment_status === "liquidado" 
        ? "liquidado" 
        : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

      await supabase
        .from("padel_matches")
        .update({
          payments_history: historialNuevo,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      const matchActualizado = { 
        ...match, 
        payments_history: historialNuevo, 
        payment_status: nuevoEstadoGeneral 
      };

      setMatchSeleccionado(matchActualizado);
      mostrarNotificacion("Pago Aprobado", "✅ El pago ha sido verificado y aprobado correctamente.", "success");
      await cargarPartidosPeriodo();

    } catch (err) {
      console.error("Error al aprobar pago:", err);
      mostrarNotificacion("Error", "No se pudo aprobar el pago.", "error");
    } finally {
      setProcesando(false);
    }
  }

  // 🔴 AGREGAR EXTRA OPTIMISTA CON VALIDACIÓN DE LIQUIDACIÓN
  async function agregarUnExtraSilencioso(match, producto) {
    if (!producto || !match) return;

    const currentMatch = (matchSeleccionado && matchSeleccionado.id === match.id) ? matchSeleccionado : match;
    
    if (currentMatch.payment_status === "liquidado") {
      return mostrarNotificacion("🔒 Reserva Liquidada", "No se pueden agregar más consumos a una reserva que ya fue liquidada.", "warning");
    }

    const extrasActuales = Array.isArray(currentMatch.extra_items) ? currentMatch.extra_items : [];
    const realStock = producto.is_rental ? 999999 : (parseInt(producto.stock, 10) || 0);

    if (!producto.is_rental) {
      const cantidadEnTicket = extrasActuales.filter((ex) => String(ex.id) === String(producto.id)).length;
      if (cantidadEnTicket >= realStock) {
        return mostrarNotificacion(
          "Stock Insuficiente",
          `No puedes agregar más de ${realStock} und. de "${producto.name}". Disponibilidad máxima alcanzada.`,
          "warning"
        );
      }
    }

    const nuevoExtraItem = {
      id_unic: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      id: producto.id,
      name: producto.name,
      price: parseFloat(producto.price) || 0,
    };

    const nuevosExtras = [...extrasActuales, nuevoExtraItem];

    const totalAbonado = (Array.isArray(currentMatch.payments_history) ? currentMatch.payments_history : [])
      .filter((item) => item.status === "aprobado")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const precioBase = currentMatch.total_price || 15;
    const fee = currentMatch.app_fee || precioBase * 0.10;
    const totalExtrasNuevo = nuevosExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
    const totalGranEsperadoNuevo = precioBase + fee + totalExtrasNuevo;

    const pagoCompleto = totalAbonado >= totalGranEsperadoNuevo - 0.05;
    const nuevoEstadoGeneral = currentMatch.payment_status === "liquidado" 
      ? "liquidado" 
      : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

    // ACTUALIZACIÓN OPTIMISTA EN ESTADO REACT (0ms DE LATENCIA)
    const updatedMatch = { ...currentMatch, extra_items: nuevosExtras, payment_status: nuevoEstadoGeneral };
    setMatchSeleccionado(updatedMatch);
    setPartidosPeriodo((prev) =>
      prev.map((m) => (m.id === currentMatch.id ? updatedMatch : m))
    );

    try {
      await supabase
        .from("padel_matches")
        .update({
          extra_items: nuevosExtras,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", currentMatch.id);
    } catch (err) {
      console.error("Error guardando extra en BD:", err);
    }
  }

  async function quitarUnExtraSilencioso(match, productoId) {
    if (!match) return;

    const currentMatch = (matchSeleccionado && matchSeleccionado.id === match.id) ? matchSeleccionado : match;
    
    if (currentMatch.payment_status === "liquidado") {
      return mostrarNotificacion("🔒 Reserva Liquidada", "No se pueden eliminar consumos de una reserva que ya fue liquidada.", "warning");
    }

    const extrasActuales = Array.isArray(currentMatch.extra_items) ? currentMatch.extra_items : [];
    
    const idxToRemove = extrasActuales.findIndex((ex) => String(ex.id) === String(productoId));
    if (idxToRemove === -1) return;

    const nuevosExtras = [...extrasActuales];
    nuevosExtras.splice(idxToRemove, 1);

    const totalAbonado = (Array.isArray(currentMatch.payments_history) ? currentMatch.payments_history : [])
      .filter((item) => item.status === "aprobado")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const precioBase = currentMatch.total_price || 15;
    const fee = currentMatch.app_fee || precioBase * 0.10;
    const totalExtrasNuevo = nuevosExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
    const totalGranEsperadoNuevo = precioBase + fee + totalExtrasNuevo;

    const pagoCompleto = totalAbonado >= totalGranEsperadoNuevo - 0.05;
    const nuevoEstadoGeneral = currentMatch.payment_status === "liquidado" 
      ? "liquidado" 
      : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

    // ACTUALIZACIÓN OPTIMISTA EN ESTADO REACT
    const updatedMatch = { ...currentMatch, extra_items: nuevosExtras, payment_status: nuevoEstadoGeneral };
    setMatchSeleccionado(updatedMatch);
    setPartidosPeriodo((prev) =>
      prev.map((m) => (m.id === currentMatch.id ? updatedMatch : m))
    );

    try {
      await supabase
        .from("padel_matches")
        .update({
          extra_items: nuevosExtras,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", currentMatch.id);
    } catch (err) {
      console.error("Error removiendo extra en BD:", err);
    }
  }

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto.trim()) return productos;
    const term = busquedaProducto.toLowerCase();
    return productos.filter(p => p.name.toLowerCase().includes(term) || (p.brand && p.brand.toLowerCase().includes(term)));
  }, [productos, busquedaProducto]);

  const extrasAgrupados = useMemo(() => {
    const list = Array.isArray(matchSeleccionado?.extra_items) ? matchSeleccionado.extra_items : [];
    const map = {};
    list.forEach((ex) => {
      const itemKey = String(ex.id);
      if (!map[itemKey]) {
        map[itemKey] = { id: ex.id, name: ex.name, price: parseFloat(ex.price) || 0, qty: 0 };
      }
      map[itemKey].qty += 1;
    });
    return Object.values(map);
  }, [matchSeleccionado?.extra_items]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Cargando Sistema POS...</div>;
  }

  const numIngresadoAgendar = parseFloat(formAgendarPOS.montoCustomUSD) || 0;
  const equivalenteAgendar = monedaAgendarPOS === "USD"
    ? numIngresadoAgendar * tasaBCV
    : numIngresadoAgendar / tasaBCV;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-100 font-sans p-2 sm:p-4 space-y-3">

      {/* CONTENEDOR PRINCIPAL POS */}
      <div className="w-full flex flex-col flex-1 min-w-0 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-300 overflow-hidden">
        
           {/* --- BARRA SUPERIOR POS --- */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap justify-between items-center bg-white gap-2 sm:gap-3">
            {/* ... los botones de fecha, Sincronizar, etc ... */}
        </div>

        {/* --- BANNER DE PROMOCIÓN EN EL POS --- */}
        {promocionHoy && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">🎁</span>
              <div>
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-tight">
                  TARIFA PROMOCIONAL: {promocionHoy.name}
                </h4>
                <p className="text-[10px] font-bold text-rose-700">
                  Precios reducidos aplicados automáticamente a las canchas en la fecha mostrada.
                </p>
              </div>
            </div>
            <div className="bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-4 text-xs font-black text-rose-800">
                <div className="text-center">
                    <span className="block text-[9px] uppercase opacity-70">Normal</span>
                    ${promocionHoy.price_normal.toFixed(2)}
                </div>
                <div className="text-center border-l border-rose-300 pl-4">
                    <span className="block text-[9px] uppercase opacity-70">Hora Pico</span>
                    ${promocionHoy.price_peak.toFixed(2)}
                </div>
            </div>
          </div>
        )}

        {/* GRILLA RESPONSIVE CON COLUMNA DE HORA STICKY */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-slate-100/70">
          <div className="overflow-x-auto relative rounded-2xl border-2 border-slate-300 bg-white shadow-xs">
            <div className="inline-min-w-full min-w-[500px] w-full">
              
              {/* CABECERA PISTAS */}
              <div className="flex bg-slate-950 text-white border-b-2 border-slate-800 sticky top-0 z-30 shadow-xs">
                <div className="w-16 sm:w-24 shrink-0 p-2 sm:p-3.5 font-black text-[10px] sm:text-[11px] text-slate-300 text-center uppercase tracking-wider border-r border-slate-800 bg-slate-950 sticky left-0 z-40">
                  Hora
                </div>
                {canchas.map((c) => (
                  <div key={c.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-2 sm:p-3 text-center border-l border-slate-800 font-black text-[11px] sm:text-xs uppercase tracking-tight">
                    {c.name}
                  </div>
                ))}
              </div>

              {/* FILAS DE HORARIOS CON ALTURA CORREGIDA H-24 */}
              {bloquesHorarios.map((bloque, idx) => {
                const dateObjSlot = new Date(fechaBase);
                dateObjSlot.setHours(bloque.horaInt, bloque.minutosInt, 0, 0);

                return (
                  <div key={idx} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors h-24">
                    
                    {/* COLUMNA DE HORA STICKY */}
                    <div className="w-16 sm:w-24 shrink-0 flex flex-col items-center justify-center bg-slate-100 border-r-2 border-slate-300 p-1 text-center sticky left-0 z-20 shadow-xs">
                      <span className="text-[11px] sm:text-xs font-black text-slate-900">{bloque.etiqueta.split(" ")[0]}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase">{bloque.etiqueta.split(" ")[1]}</span>
                    </div>

                    {/* PISTAS CON NUEVAS REGLAS DE ESTADO VISUAL */}
{canchas.map((cancha) => {
  const reservado = obtenerReserva(cancha.id, dateObjSlot);
  
  // --- INICIO DE LÓGICA DE PRECIOS ACTUALIZADA ---
  const esPico = chequearSiEsPico(dateObjSlot);
  const precioOriginal = esPico ? (cancha.price_peak || 20) : (cancha.price_normal || 12);
  let precioUSD = precioOriginal;

  if (promocionHoy) {
    const hasBlocks = promocionHoy.time_blocks && promocionHoy.time_blocks.length > 0;
    
    if (hasBlocks) {
      // Obtenemos la hora en formato "HH:MM" (ej: "07:00", "14:00")
      const horaBotonStr = `${String(bloque.horaInt).padStart(2, '0')}:${String(bloque.minutosInt).padStart(2, '0')}`;
      
      const bloqueAplicable = promocionHoy.time_blocks.find(b => {
        return horaBotonStr >= b.start_time && horaBotonStr < b.end_time;
      });

      if (bloqueAplicable) {
        precioUSD = bloqueAplicable.price; 
      }
    } else {
      // Promo de todo el día
      precioUSD = esPico ? promocionHoy.price_peak : promocionHoy.price_normal;
    }
  }

  const precioBs = precioUSD * tasaBCV;

                      return (
                        <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200 relative">
                          {reservado ? (() => {
                            const isLiquidado = reservado.payment_status === "liquidado";
                            const precioCanchaBaseFee = (reservado.total_price || 15) + (reservado.app_fee || 1.50);
                            const totalAbonado = (Array.isArray(reservado.payments_history) ? reservado.payments_history : [])
                              .filter((a) => a.status === "aprobado")
                              .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
                            const totalExtras = (Array.isArray(reservado.extra_items) ? reservado.extra_items : [])
                              .reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
                            const totalGranEsperado = precioCanchaBaseFee + totalExtras;

                            const canchaCubierta = totalAbonado >= (precioCanchaBaseFee - 0.05);
                            const todoPagado = totalAbonado >= (totalGranEsperado - 0.05);
                            const esAbierto = reservado.match_type === "abierto" && !reservado.is_private;

                            let cardStyle = "";
                            let badgeText = "";
                            let badgeStyle = "";

                            if (isLiquidado) {
                              cardStyle = "bg-emerald-100/90 text-emerald-950 border-emerald-400 hover:bg-emerald-200/90 shadow-sm";
                              badgeText = "✅ LIQUIDADA";
                              badgeStyle = "bg-emerald-600 text-white font-black";
                            } else if (todoPagado) {
                              // PAGADA PERO ABIERTA/SIN LIQUIDAR -> COLOR OSCURO PREDETERMINADO
                              cardStyle = "bg-slate-950 text-white border-slate-800 hover:border-emerald-400";
                              badgeText = "✅ PAGADA";
                              badgeStyle = "bg-emerald-500/20 text-[#00FF9D] font-black";
                            } else if (canchaCubierta) {
                              cardStyle = "bg-amber-400/90 text-slate-950 border-amber-500 animate-pulse hover:bg-amber-400";
                              badgeText = "⚠️ CONSUMOS PENDIENTES";
                              badgeStyle = "bg-slate-950 text-amber-300 font-black";
                            } else {
                              cardStyle = "bg-rose-500/90 text-white border-rose-600 animate-pulse hover:bg-rose-500";
                              badgeText = "🚨 PENDIENTE CONFIRMACION";
                              badgeStyle = "bg-slate-950 text-rose-300 font-black";
                            }

                            return (
                              <button
                                onClick={() => abrirModalDetalle(reservado)}
                                className={`h-full w-full rounded-xl p-1.5 sm:p-2 flex flex-col justify-between text-left transition-all shadow-xs border-2 overflow-hidden ${cardStyle}`}
                              >
                                <div className="flex justify-between items-center w-full gap-1">
                                  <span className={`text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full truncate ${badgeStyle}`}>
                                    {badgeText}
                                  </span>
                                  {/* MOSTRAR 1/4 ÚNICAMENTE SI ES PARTIDO ABIERTO */}
                                  {esAbierto && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-900/20 rounded shrink-0">
                                      {reservado.players?.length || 1}/4
                                    </span>
                                  )}
                                </div>
                                <div className="my-0.5">
                                  <p className="text-[10px] sm:text-[11px] font-black truncate leading-tight">{obtenerNombreCliente(reservado)}</p>
                                  <p className="text-[8px] sm:text-[9px] opacity-80 font-bold leading-tight">Bs. {((reservado.total_price || 15) * tasaBCV).toFixed(2)}</p>
                                </div>

                                {!isLiquidado && (
                                  <div className="pt-1 border-t border-black/10 flex justify-between items-center text-[8px] sm:text-[9px] font-black uppercase tracking-wider opacity-90">
                                    <span>⚙️ Gestionar</span>
                                    <span>→</span>
                                  </div>
                                )}
                              </button>
                            );
                          })() : (
                          <button
  onClick={() => abrirModalAgendarPOS(cancha, dateObjSlot, bloque.etiqueta, precioUSD)}
  className="h-full w-full bg-slate-50/70 hover:bg-emerald-50/80 text-emerald-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-all group shadow-2xs relative"
>
  {/* BADGE PICO */}
  {esPico && (
    <span className="absolute top-1.5 right-1.5 text-[8px] font-black uppercase bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">
      Pico
    </span>
  )}

  {/* BADGE PROMO */}
  {promocionHoy && (
    <span className="absolute top-1.5 left-1.5 text-[8px] font-black uppercase bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded shadow-sm">
      Promo
    </span>
  )}

  <span className="text-[11px] sm:text-xs font-black text-emerald-700 group-hover:scale-105 transition-transform">
    + Agendar
  </span>

  {/* PRECIOS TACHADOS O NORMALES */}
  {promocionHoy ? (
    <div className="flex flex-col items-center mt-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-bold text-slate-400 line-through">${precioOriginal}</span>
        <span className="text-[10px] font-black text-rose-500">${precioUSD}</span>
      </div>
      <span className="text-[8px] font-bold text-slate-400">Bs. {precioBs.toFixed(2)}</span>
    </div>
  ) : (
    <div className="flex flex-col items-center mt-0.5">
      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">${precioUSD}</span>
      <span className="text-[8px] font-bold text-slate-400">Bs. {precioBs.toFixed(2)}</span>
    </div>
  )}
</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL AGENDAR EN POS (RENDERIZADO VÍA PORTAL) */}
      {mounted && modalAgendarOpen && bloqueAgendar && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-3 sm:p-4" onClick={() => setModalAgendarOpen(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Nueva Reserva POS</span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{bloqueAgendar.cancha.name}</h3>
                <p className="text-xs font-bold text-slate-500">{bloqueAgendar.horaLabel}</p>
              </div>
              <button onClick={() => setModalAgendarOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={ejecutarAgendarPOS} className="space-y-3.5 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={formAgendarPOS.nombreCliente}
                  onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, nombreCliente: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Teléfono de Contacto</label>
                <input
                  type="tel"
                  placeholder="Ej. 0414-1234567"
                  value={formAgendarPOS.telefonoCliente}
                  onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, telefonoCliente: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    Monto Aportado Hoy ({monedaAgendarPOS === "USD" ? "$" : "Bs."})
                  </label>
                  
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => {
                        if (monedaAgendarPOS !== "USD") {
                          const val = parseFloat(formAgendarPOS.montoCustomUSD) || 0;
                          setFormAgendarPOS({ ...formAgendarPOS, montoCustomUSD: val > 0 ? (val / tasaBCV).toFixed(2) : "" });
                          setMonedaAgendarPOS("USD");
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all ${monedaAgendarPOS === "USD" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"}`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (monedaAgendarPOS !== "VES") {
                          const val = parseFloat(formAgendarPOS.montoCustomUSD) || 0;
                          setFormAgendarPOS({ ...formAgendarPOS, montoCustomUSD: val > 0 ? (val * tasaBCV).toFixed(2) : "" });
                          setMonedaAgendarPOS("VES");
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all ${monedaAgendarPOS === "VES" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"}`}
                    >
                      Bs. VES
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.01"
                  value={formAgendarPOS.montoCustomUSD}
                  onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, montoCustomUSD: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-lg font-black text-slate-900 outline-none"
                  required
                />

                {numIngresadoAgendar > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900 mt-1.5">
                    <span>🧮 Conversión:</span>
                    <span>
                      {monedaAgendarPOS === "USD"
                        ? `Bs. ${equivalenteAgendar.toFixed(2)} VES`
                        : `$${equivalenteAgendar.toFixed(2)} USD`}
                    </span>
                  </div>
                )}
              </div>

              {/* FACTURA DETALLADA DE LA CANCHA */}
              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between items-start text-slate-400">
                  <span>Cancha Base (Pista Completa):</span>
                  <div className="text-right">
                    <span className="text-white font-black block">${calculosAgendarPOS.base.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 block">Bs. {(calculosAgendarPOS.base * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-start text-[#00FF9D]">
                  <span>Comisión App (+10%):</span>
                  <div className="text-right">
                    <span className="font-black block">+${calculosAgendarPOS.fee.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400/70 block">Bs. {(calculosAgendarPOS.fee * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end border-t border-slate-800 pt-2 text-white">
                  <div>
                    <span className="text-xs font-black block">Total Pista Esperado:</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#00FF9D] block">${calculosAgendarPOS.totalSugerido.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Bs. {(calculosAgendarPOS.totalSugerido * tasaBCV).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Método de Pago Recibido</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 Efectivo" },
                    { id: "punto", label: "💳 Punto Venta" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormAgendarPOS({ ...formAgendarPOS, metodoPago: m.id })}
                      className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                        formAgendarPOS.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CAMPOS REQUERIDOS PARA MÉTODOS DIGITALES */}
              {formAgendarPOS.metodoPago !== "efectivo" && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      N° de Referencia / ID Transacción *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={formAgendarPOS.metodoPago === "zelle" ? "Ej. Email de Zelle o Ref #1234" : "Ej. 123456"}
                      value={formAgendarPOS.numReferencia}
                      onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, numReferencia: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Adjuntar Captura / Comprobante (Opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSeleccionarImagenPOS(e, (img) => setFormAgendarPOS({ ...formAgendarPOS, previewComprobante: img }))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-1 text-xs outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-900 file:text-[#00FF9D]"
                    />

                    {formAgendarPOS.previewComprobante && (
                      <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-24 bg-slate-950 flex items-center justify-center">
                        <img src={formAgendarPOS.previewComprobante} alt="Preview Comprobante" className="max-h-24 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={procesando}
                className="w-full py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase text-xs tracking-wider rounded-2xl shadow-md mt-2"
              >
                {procesando ? "Guardando..." : "✓ Agendar y Registrar Cobro"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL AUDITORÍA Y DETALLE DE RESERVA (RENDERIZADO VÍA PORTAL) */}
      {mounted && modalDetalleMatch && matchSeleccionado && createPortal(
        (() => {
          const extras = Array.isArray(matchSeleccionado.extra_items) ? matchSeleccionado.extra_items : [];
          const precioBase = matchSeleccionado.total_price || 15;
          const feeApp = matchSeleccionado.app_fee || (matchSeleccionado.is_private ? 0 : precioBase * 0.10);
          const totalCanchaConFee = precioBase + feeApp;

          const totalExtras = calcularTotalExtras(matchSeleccionado);
          const totalGranEsperado = totalCanchaConFee + totalExtras;

          const historialAbonos = Array.isArray(matchSeleccionado.payments_history) ? matchSeleccionado.payments_history : [];
          const totalAbonadoAprobado = historialAbonos
            .filter((a) => a.status === "aprobado")
            .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

          const pendientePorCobrar = Math.max(0, totalGranEsperado - totalAbonadoAprobado);
          const cambioDevolver = Math.max(0, totalAbonadoAprobado - totalGranEsperado);
          
          const esLiquidadoOficial = matchSeleccionado.payment_status === "liquidado";
          const canchaTotalmenteCubierta = totalAbonadoAprobado >= (totalCanchaConFee - 0.05);
          const todoPagadoConExtras = pendientePorCobrar <= 0.05;

          const montoNumIngresado = parseFloat(montoAbonoManualPOS) || 0;
          const equivalenteCalculado = monedaCobroPOS === "USD" 
            ? montoNumIngresado * tasaBCV 
            : montoNumIngresado / tasaBCV;

          return (
            <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-3 sm:p-4" onClick={solicitarCerrarModalDetalle}>
              <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-5xl shadow-2xl space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
                
                {/* CABECERA POS */}
                <div className="flex justify-between items-start border-b pb-3">
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      esLiquidadoOficial
                        ? "bg-emerald-100 text-emerald-800"
                        : todoPagadoConExtras 
                          ? "bg-emerald-100 text-emerald-800" 
                          : canchaTotalmenteCubierta 
                            ? "bg-blue-100 text-blue-900 border border-blue-200" 
                            : "bg-amber-500 text-slate-950"
                    }`}>
                      {esLiquidadoOficial 
                        ? "🔒 FACTURA LIQUIDADA EN VENTAS" 
                        : todoPagadoConExtras 
                          ? "✅ FACTURA TOTALMENTE PAGADA" 
                          : canchaTotalmenteCubierta 
                            ? "🎾 CANCHA RESERVADA (EXTRAS PENDIENTES)" 
                            : "⚠️ RESERVA PENDIENTE DE PAGO"}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{matchSeleccionado.court?.name || "Pista"}</h3>
                  </div>
                  <button onClick={solicitarCerrarModalDetalle} className="text-slate-400 font-bold text-lg hover:text-slate-700">✕</button>
                </div>

                {/* ESTRUCTURA TÁCTIL POS DE 2 COLUMNAS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  
                  {/* COLUMNA IZQUIERDA (RESUMEN FINANCIERO Y CLIENTE) */}
                  <div className="lg:col-span-6 space-y-4">
                    
                    {/* DATOS CLIENTE */}
                    <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                      <div className="grid grid-cols-2 gap-4 flex-1">
                        <div>
                          <span className="text-[9px] uppercase font-black text-slate-400 block">Cliente:</span>
                          <p className="text-slate-900 font-black text-xs sm:text-sm truncate">{obtenerNombreCliente(matchSeleccionado)}</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-black text-slate-400 block">Contacto:</span>
                          <p className="text-slate-900 font-black text-xs sm:text-sm">{matchSeleccionado.creator_profile?.telefono || "En sitio"}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => cancelarReserva(matchSeleccionado)}
                        disabled={procesando || esLiquidadoOficial}
                        className={`px-3 py-1.5 border font-black text-[10px] uppercase rounded-xl transition-colors shrink-0 ml-2 ${
                          esLiquidadoOficial
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        🚨 Anular Reserva
                      </button>
                    </div>

                    {/* FACTURA DETALLADA MULTIMONEDA */}
                    <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 font-bold">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D] border-b border-slate-800 pb-1">
                        🧾 Desglose de Factura
                      </p>

                      <div className="space-y-2 text-xs border-b border-slate-800 pb-3">
                        <div className="flex justify-between items-start text-slate-300">
                          <span>Pista Completa:</span>
                          <div className="text-right">
                            <span className="text-white block font-black">${precioBase.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 block">Bs. {(precioBase * tasaBCV).toFixed(2)}</span>
                          </div>
                        </div>

                        {feeApp > 0 && (
                          <div className="flex justify-between items-start text-emerald-400">
                            <span>Comisión App (+10%):</span>
                            <div className="text-right">
                              <span className="block font-black">+${feeApp.toFixed(2)}</span>
                              <span className="text-[10px] text-emerald-400/70 block">Bs. {(feeApp * tasaBCV).toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {extrasAgrupados.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-amber-300 block">
                              🛒 Consumos Tienda / Extras ({extrasAgrupados.reduce((s, x) => s + x.qty, 0)} items):
                            </span>
                            {extrasAgrupados.map((item) => {
                              const subtotalUSD = item.price * item.qty;
                              const subtotalBs = subtotalUSD * tasaBCV;
                              return (
                                <div key={item.id} className="flex justify-between items-start text-[11px] bg-slate-850 p-1.5 rounded-lg border border-slate-800">
                                  <span className="text-slate-200">
                                    • {item.name} <strong className="text-amber-400">x{item.qty}</strong>
                                  </span>
                                  <div className="text-right">
                                    <span className="text-amber-300 font-black block">+${subtotalUSD.toFixed(2)}</span>
                                    <span className="text-[9px] text-slate-400 block">Bs. {subtotalBs.toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[9px] font-black uppercase text-slate-400 block">Total Factura:</span>
                          <p className="text-lg font-black text-white leading-none mt-1">${totalGranEsperado.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">Bs. {(totalGranEsperado * tasaBCV).toFixed(2)}</p>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[9px] font-black uppercase text-emerald-400 block">Total Abonado:</span>
                          <p className="text-lg font-black text-emerald-400 leading-none mt-1">${totalAbonadoAprobado.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-emerald-500/70 mt-0.5">Bs. {(totalAbonadoAprobado * tasaBCV).toFixed(2)}</p>
                        </div>
                      </div>

                      {/* MOSTRAR BANNER DE CAMBIO O SALDO RESTANTE */}
                      {cambioDevolver > 0.05 ? (
                        <div className="p-3.5 rounded-2xl border bg-cyan-500/20 border-cyan-500/60 text-cyan-300 flex justify-between items-center shadow-inner">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider block text-cyan-300">
                              💵 DINERO A DEVOLVER / CAMBIO:
                            </span>
                            <span className="text-xs font-bold block opacity-90 mt-0.5 text-cyan-200">
                              Bs. {(cambioDevolver * tasaBCV).toFixed(2)} VES
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black block leading-none text-cyan-200">${cambioDevolver.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`p-3.5 rounded-2xl border flex justify-between items-center transition-all ${
                          pendientePorCobrar > 0.05 
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-300" 
                            : "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                        }`}>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider block">🔥 SALDO RESTANTE A COBRAR:</span>
                            <span className="text-xs font-bold block opacity-90 mt-0.5">Bs. {(pendientePorCobrar * tasaBCV).toFixed(2)} VES</span>
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-black block leading-none">${pendientePorCobrar.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* COLUMNA DERECHA (HISTORIAL DESPLEGABLE, COBRO DESPLEGABLE & CONSUMOS) */}
                  <div className="lg:col-span-6 space-y-4">

                    {/* 1. HISTORIAL DE PAGOS DESPLEGABLE (ARRIBA) */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setHistorialAbierto(!historialAbierto)}
                        className="w-full p-3.5 flex justify-between items-center bg-slate-100/80 hover:bg-slate-200/70 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{historialAbierto ? "▼" : "▶"}</span>
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                            📜 Historial de Pagos ({historialAbonos.length})
                          </h4>
                        </div>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Aprobado: ${totalAbonadoAprobado.toFixed(2)}
                        </span>
                      </button>

                      {historialAbierto && (
                        <div className="p-3.5 border-t border-slate-200 space-y-2 bg-white">
                          {historialAbonos.length === 0 ? (
                            <p className="text-xs font-bold text-slate-400 italic py-2 text-center">No hay abonos registrados.</p>
                          ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
                              {historialAbonos.map((ab, idx) => {
                                const amountUsd = parseFloat(ab.amount) || 0;
                                const amountBs = amountUsd * tasaBCV;
                                const esAprobado = ab.status === "aprobado";

                                return (
                                  <div key={ab.id || idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-[#00FF9D]">
                                          {ab.method ? ab.method.replace("_", " ") : "POS"}
                                        </span>
                                        <span className="text-xs font-black text-slate-800 truncate">{ab.user_name || "Cliente"}</span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                                        Ref: <strong className="text-slate-800">{ab.reference || "S/R"}</strong>
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <div className="text-right">
                                        <span className={`text-xs font-black block leading-none ${amountUsd < 0 ? "text-cyan-600" : esAprobado ? "text-emerald-700" : "text-amber-600"}`}>
                                          {amountUsd < 0 ? `-$${Math.abs(amountUsd).toFixed(2)}` : `$${amountUsd.toFixed(2)}`}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                                          Bs. {amountBs.toFixed(2)}
                                        </span>
                                      </div>

                                      {!esAprobado && !esLiquidadoOficial && (
                                        <button
                                          type="button"
                                          onClick={() => aprobarPagoPendiente(matchSeleccionado, ab.id)}
                                          disabled={procesando}
                                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                        >
                                          ✓ Aprobar
                                        </button>
                                      )}

                                      {ab.receipt_url && (
                                        <button
                                          type="button"
                                          onClick={() => setImagenEngrande(ab.receipt_url)}
                                          className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-100 overflow-hidden hover:border-blue-500 transition-all shrink-0"
                                        >
                                          <img src={ab.receipt_url} alt="Comprobante" className="w-full h-full object-cover" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* 2. REGISTRAR COBRO EN SITIO DESPLEGABLE (OCULTO SI ESTÁ LIQUIDADA) */}
                    {!esLiquidadoOficial && (
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setCobroAbierto(!cobroAbierto)}
                          className="w-full p-3.5 flex justify-between items-center bg-slate-100/80 hover:bg-slate-200/70 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{cobroAbierto ? "▼" : "▶"}</span>
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                              💳 Registrar Cobro de Saldo en Sitio
                            </h4>
                          </div>
                          {pendientePorCobrar > 0.05 && (
                            <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                              Pendiente: ${pendientePorCobrar.toFixed(2)}
                            </span>
                          )}
                        </button>

                        {cobroAbierto && (
                          <div className="p-3.5 sm:p-4 border-t border-slate-200 space-y-3 bg-white">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-black uppercase text-slate-500">Moneda de Pago:</p>
                              <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                                <button type="button" onClick={() => setMonedaCobroPOS("USD")} className={`px-2 py-0.5 rounded-lg ${monedaCobroPOS === "USD" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>$ USD</button>
                                <button type="button" onClick={() => setMonedaCobroPOS("VES")} className={`px-2 py-0.5 rounded-lg ${monedaCobroPOS === "VES" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>Bs. VES</button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {[
                                { id: "pago_movil", label: "📱 Pago Móvil" },
                                { id: "zelle", label: "🇺🇸 Zelle" },
                                { id: "efectivo", label: "💵 Efectivo" },
                                { id: "punto", label: "💳 Punto Venta" },
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setMetodoAbonoManualPOS(m.id)}
                                  className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase border transition-all ${
                                    metodoAbonoManualPOS === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-xs" : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder={`$${pendientePorCobrar.toFixed(2)}`}
                                value={montoAbonoManualPOS}
                                onChange={(e) => setMontoAbonoManualPOS(e.target.value)}
                                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold outline-none"
                              />
                              <button
                                onClick={() => agregarAbonoManualPOS(matchSeleccionado)}
                                disabled={procesando}
                                className="px-4 py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shrink-0 hover:bg-slate-800 transition-colors"
                              >
                                + Registrar
                              </button>
                            </div>

                            {cambioDevolver > 0.05 && (
                              <button
                                type="button"
                                onClick={() => registrarDevolucionCambioPOS(matchSeleccionado, cambioDevolver)}
                                disabled={procesando}
                                className="w-full py-2.5 bg-cyan-600 text-white font-black text-xs uppercase rounded-xl shadow-sm hover:bg-cyan-700 transition-colors"
                              >
                                💵 Entregar y Registrar Cambio (${cambioDevolver.toFixed(2)} USD)
                              </button>
                            )}

                            {metodoAbonoManualPOS !== "efectivo" && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <input
                                  type="text"
                                  placeholder="N° Referencia / ID Transacción"
                                  value={numRefAbonoManualPOS}
                                  onChange={(e) => setNumRefAbonoManualPOS(e.target.value)}
                                  className="bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold outline-none"
                                />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleSeleccionarImagenPOS(e, setPreviewAbonoManualPOS)}
                                  className="bg-slate-50 border border-slate-300 rounded-xl p-1 text-[10px] outline-none file:mr-1 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-900 file:text-[#00FF9D]"
                                />
                              </div>
                            )}

                            {montoNumIngresado > 0 && (
                              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900">
                                <span>🧮 Conversión en vivo:</span>
                                <span>
                                  {monedaCobroPOS === "USD"
                                    ? `Bs. ${equivalenteCalculado.toFixed(2)} VES`
                                    : `$${equivalenteCalculado.toFixed(2)} USD`}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. CONSUMOS EXTRA EN SLIDER CON BUSCADOR (DESHABILITADO SI ESTÁ LIQUIDADA) */}
                    <div className="border-t border-slate-200 pt-3 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">🛒 Consumos Extra</h4>
                          <span className="text-xs font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border">
                            ${totalExtras.toFixed(2)} (Bs. {(totalExtras * tasaBCV).toFixed(2)})
                          </span>
                        </div>
                        
                        <div className="relative w-full sm:w-48">
                          <input
                            type="text"
                            placeholder="🔍 Buscar artículo..."
                            value={busquedaProducto}
                            onChange={(e) => setBusquedaProducto(e.target.value)}
                            disabled={esLiquidadoOficial}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      {esLiquidadoOficial && (
                        <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          🔒 Ticket Liquidado - No es posible modificar consumos en facturas cerradas.
                        </p>
                      )}

                      {/* SLIDER HORIZONTAL DE PRODUCTOS */}
                      <div className={`flex gap-3 overflow-x-auto pb-3 pt-1 px-1 bg-slate-50 rounded-2xl border border-slate-200 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                        esLiquidadoOficial ? "opacity-60 pointer-events-none" : ""
                      }`}>
                        {productosFiltrados.length === 0 ? (
                          <p className="text-xs text-slate-400 font-bold p-3">No se encontraron productos.</p>
                        ) : (
                          productosFiltrados.map((prod) => {
                            const qty = extras.filter((ex) => String(ex.id) === String(prod.id)).length;
                            const pPrice = parseFloat(prod.price) || 0;
                            const stockDisponible = prod.is_rental ? 999999 : (parseInt(prod.stock, 10) || 0);
                            const alcanzadoLimiteStock = !prod.is_rental && qty >= stockDisponible;
                            const sinStock = !prod.is_rental && stockDisponible <= 0;

                            return (
                              <div key={prod.id} className={`shrink-0 w-44 p-3 rounded-2xl border flex flex-col justify-between shadow-xs transition-all ${
                                qty > 0 ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"
                              }`}>
                                <div>
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[9px] font-black uppercase text-blue-500 truncate">{prod.brand || "Tienda"}</span>
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                                      prod.is_rental 
                                        ? "bg-purple-100 text-purple-700" 
                                        : sinStock 
                                          ? "bg-rose-100 text-rose-700" 
                                          : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {prod.is_rental ? "Ilimitado" : `Stock: ${stockDisponible}`}
                                    </span>
                                  </div>

                                  <p className="text-xs font-black text-slate-900 truncate" title={prod.name}>{prod.name}</p>
                                  <div className="mt-0.5">
                                    <span className="text-[11px] font-black text-slate-900 block">${pPrice.toFixed(2)}</span>
                                    <span className="text-[9px] font-bold text-slate-400 block">Bs. {(pPrice * tasaBCV).toFixed(2)}</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                                  {qty > 0 ? (
                                    <div className="flex items-center justify-between w-full">
                                      <button 
                                        type="button" 
                                        onClick={() => quitarUnExtraSilencioso(matchSeleccionado, prod.id)} 
                                        disabled={esLiquidadoOficial}
                                        className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 font-black text-xs flex items-center justify-center hover:bg-rose-200 transition-colors disabled:opacity-40"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs font-black">{qty} und</span>
                                      <button 
                                        type="button" 
                                        onClick={() => agregarUnExtraSilencioso(matchSeleccionado, prod)} 
                                        disabled={esLiquidadoOficial || alcanzadoLimiteStock}
                                        className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center transition-colors ${
                                          (esLiquidadoOficial || alcanzadoLimiteStock)
                                            ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                                        }`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      type="button" 
                                      onClick={() => agregarUnExtraSilencioso(matchSeleccionado, prod)} 
                                      disabled={esLiquidadoOficial || sinStock || alcanzadoLimiteStock}
                                      className={`w-full py-1.5 rounded-xl font-black text-[10px] uppercase transition-colors ${
                                        (esLiquidadoOficial || sinStock || alcanzadoLimiteStock)
                                          ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                          : "bg-slate-900 text-[#00FF9D] hover:bg-slate-800"
                                      }`}
                                    >
                                      {sinStock ? "Agotado" : "+ Añadir"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex gap-2 pt-2 border-t">
                  <button 
                    onClick={solicitarCerrarModalDetalle} 
                    disabled={procesando} 
                    className="w-1/3 py-3.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    🚪 Salir / Cerrar
                  </button>
                  
                  <button 
                    onClick={() => cerrarTicketYLiquidarReserva(matchSeleccionado)} 
                    disabled={procesando || esLiquidadoOficial || pendientePorCobrar > 0.05} 
                    className={`w-2/3 py-3.5 text-white font-black text-xs uppercase rounded-2xl shadow-md transition-all ${
                      esLiquidadoOficial 
                        ? "bg-slate-400 cursor-not-allowed" 
                        : pendientePorCobrar > 0.05
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300"
                          : "bg-emerald-600 hover:bg-emerald-700 active:scale-98"
                    }`}
                  >
                    {esLiquidadoOficial 
                      ? "✅ Ticket Ya Liquidado" 
                      : pendientePorCobrar > 0.05
                        ? `⚠️ Falta Cobrar $${pendientePorCobrar.toFixed(2)} USD`
                        : "🔒 Liquidar Reserva"}
                  </button>
                </div>

              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* MODAL DE CONFIRMACIÓN AL CERRAR CON CAMBIOS (RENDERIZADO VÍA PORTAL) */}
      {mounted && modalConfirmCambios && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-base font-black text-slate-900">¿Guardar cambios en la reserva?</h3>
            <p className="text-xs font-bold text-slate-600">
              Has modificado los consumos extra de la reserva. ¿Deseas conservar los cambios realizados o descartarlos?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button 
                onClick={guardarCambiosExtras} 
                className="w-full py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shadow-md"
              >
                💾 Conservar Cambios
              </button>
              <button 
                onClick={descartarCambiosExtras} 
                className="w-full py-2.5 bg-rose-50 text-rose-700 border border-rose-200 font-black text-xs uppercase rounded-xl"
              >
                🗑️ Descartar Cambios
              </button>
              <button 
                onClick={() => setModalConfirmCambios(false)} 
                className="w-full py-2 text-slate-400 font-extrabold text-[11px] uppercase hover:underline"
              >
                Continuar editando
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* LIGHTBOX AMPLIFICADOR DE COMPROBANTE (RENDERIZADO VÍA PORTAL) */}
      {mounted && imagenEngrande && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-4" onClick={() => setImagenEngrande(null)}>
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagenEngrande(null)}
              className="absolute -top-10 right-0 text-white font-black text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              ✕ Cerrar Vista
            </button>
            <img src={imagenEngrande} alt="Comprobante Ampliado" className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl border border-slate-800" />
          </div>
        </div>,
        document.body
      )}

      {/* POPUP NOTIFICACIÓN (RENDERIZADO VÍA PORTAL) */}
      {mounted && popupNotif.open && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
            <h3 className="text-base font-black text-slate-900">{popupNotif.title}</h3>
            <p className="text-xs font-bold text-slate-600">{popupNotif.message}</p>
            <button onClick={() => setPopupNotif({ ...popupNotif, open: false })} className="w-full py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl">Entendido</button>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRMACIÓN GENERAL (RENDERIZADO VÍA PORTAL) */}
      {mounted && modalConfirm.open && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
            <h3 className="text-base font-black text-slate-900">{modalConfirm.title}</h3>
            <p className="text-xs font-bold text-slate-600">{modalConfirm.message}</p>
            <div className="flex gap-2">
              <button onClick={() => setModalConfirm({ ...modalConfirm, open: false })} className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-xl">Cancelar</button>
              <button onClick={() => { const act = modalConfirm.action; setModalConfirm({ ...modalConfirm, open: false }); if (act) act(); }} className="w-1/2 py-2.5 bg-rose-600 text-white font-black text-xs uppercase rounded-xl shadow-md">Confirmar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}