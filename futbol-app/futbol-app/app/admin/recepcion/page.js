"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

function parsearFechaBD(fechaStr) {
  if (!fechaStr) return new Date();
  const str = fechaStr.replace(" ", "T");
  return new Date(str.endsWith("Z") || str.includes("+") ? str : `${str}Z`);
}

export default function RecepcionElite() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  
  // Tasa BCV
  const [tasaBCV, setTasaBCV] = useState(36.65);

  // Configuración de Fechas
  const [fechaBase, setFechaBase] = useState(new Date());

  // Datos Principales
  const [canchas, setCanchas] = useState([]);
  const [partidosPeriodo, setPartidosPeriodo] = useState([]);
  const [productos, setProductos] = useState([]);

  // POPUPS / NOTIFICACIONES
  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });
  const [modalConfirm, setModalConfirm] = useState({ open: false, title: "", message: "", action: null });

  // Modal Agendar Directo POS
  const [modalAgendarOpen, setModalAgendarOpen] = useState(false);
  const [bloqueAgendar, setBloqueAgendar] = useState(null);
  const [monedaAgendarPOS, setMonedaAgendarPOS] = useState("USD");
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
  const [imagenEngrande, setImagenEngrande] = useState(null);

  // Abono y Extras en POS
  const [monedaCobroPOS, setMonedaCobroPOS] = useState("USD");
  const [montoAbonoManualPOS, setMontoAbonoManualPOS] = useState("");
  const [metodoAbonoManualPOS, setMetodoAbonoManualPOS] = useState("pago_movil");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarDatosGenerales();
    obtenerTasaBCV();
  }, []);

  useEffect(() => {
    if (clubId) {
      cargarPartidosPeriodo();
    }
  }, [clubId, fechaBase]);

  // Suscripción Realtime
  useEffect(() => {
    if (!clubId || !supabase) return;

    const channel = supabase
      .channel("pos-realtime-matches-full-v16")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "padel_matches", filter: `club_id=eq.${clubId}` },
        () => cargarPartidosPeriodo()
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

      const { data: inventory } = await supabase.from("products").select("*").eq("club_id", targetClubId);
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

  const abrirModalAgendarPOS = (cancha, dateObj, horaLabel) => {
    const precioBaseTotal = cancha.price_credits || 15;
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

  const handleSeleccionarImagenPOS = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return mostrarNotificacion("Archivo Inválido", "Por favor selecciona una imagen válida (JPG, PNG).", "error");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormAgendarPOS((prev) => ({ ...prev, previewComprobante: reader.result }));
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
        reference: formAgendarPOS.numReferencia.trim() || (monedaAgendarPOS === "VES" ? `Cobro Bs. ${valIngresado.toFixed(2)}` : "Venta Directa POS"),
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

      const { data: ventaCaja, error: errVenta } = await supabase
        .from("sales")
        .insert({
          club_id: clubId,
          cashier_id: user.id,
          total_amount: montoUSD,
          payment_method: formAgendarPOS.metodoPago,
          exchange_rate: tasaBCV,
        })
        .select("id")
        .single();

      if (errVenta) throw errVenta;

      await supabase.from("sales_items").insert([
        {
          sale_id: ventaCaja.id,
          item_type: "cancha",
          item_name: `Reserva Pista Completa: ${cancha.name}`,
          item_detail: `Cliente: ${notaFinal} • Ref: ${formAgendarPOS.numReferencia || "POS"}`,
          quantity: 1,
          price_unit: base,
        },
        {
          sale_id: ventaCaja.id,
          item_type: "comision_app",
          item_name: "Comisión App Sports Hub (10%)",
          item_detail: "Cobrado en POS",
          quantity: 1,
          price_unit: fee,
        },
      ]);

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
      setProcesandoReserva(false);
    }
  }

  const calcularTotalExtras = (match) => {
    const extras = Array.isArray(match?.extra_items) ? match.extra_items : [];
    return extras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
  };

  async function aprobarAbonoEspecifico(match, payItem) {
    try {
      setProcesando(true);

      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const historialNuevo = historialActual.map((item) => {
        if (item.id === payItem.id) {
          return { ...item, status: "aprobado" };
        }
        return item;
      });

      const totalAbonado = historialNuevo
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const nuevoEstadoGeneral = pagoCompleto ? "aprobado" : "pendiente_aprobacion";

      await supabase
        .from("padel_matches")
        .update({
          payments_history: historialNuevo,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      mostrarNotificacion(
        "Abono Aprobado",
        `✅ Abono de $${payItem.amount.toFixed(2)} (Bs. ${(payItem.amount * tasaBCV).toFixed(2)}) APROBADO.`,
        "success"
      );
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error aprobando el abono.", "error");
    } finally {
      setProcesando(false);
    }
  }

  function rechazarAbonoEspecifico(match, payItem) {
    pedirConfirmacion(
      "Rechazar Abono",
      `¿Deseas rechazar el abono de $${payItem.amount.toFixed(2)} enviado por ${payItem.user_name}?`,
      async () => {
        try {
          setProcesando(true);
          const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
          const historialNuevo = historialActual.map((item) => {
            if (item.id === payItem.id) {
              return { ...item, status: "rechazado" };
            }
            return item;
          });

          await supabase
            .from("padel_matches")
            .update({ payments_history: historialNuevo })
            .eq("id", match.id);

          mostrarNotificacion("Abono Rechazado", "❌ El abono ha sido rechazado.", "info");
          await cargarPartidosPeriodo();
        } catch (err) {
          console.error(err);
        } finally {
          setProcesando(false);
        }
      }
    );
  }

  async function cerrarTicketYLiquidarReserva(match) {
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
          reference: "Cierre de Ticket POS",
          receipt_url: null,
          status: "aprobado",
          created_at: new Date().toISOString(),
        });
      }

      historialNuevo = historialNuevo.map((item) => ({ ...item, status: "aprobado" }));

      const { data: ventaCaja, error: errVenta } = await supabase
        .from("sales")
        .insert({
          club_id: clubId,
          cashier_id: user.id,
          total_amount: totalGranEsperado,
          payment_method: metodoAbonoManualPOS || "pago_movil",
          exchange_rate: tasaBCV,
        })
        .select("id")
        .single();

      if (errVenta) throw errVenta;

      const itemsAInsertar = [
        {
          sale_id: ventaCaja.id,
          item_type: "cancha",
          item_name: `Reserva Completa: ${match.court?.name || "Pista"}`,
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
      extrasList.forEach((ex) => {
        itemsAInsertar.push({
          sale_id: ventaCaja.id,
          item_type: "producto",
          item_name: `Extra: ${ex.name}`,
          item_detail: "Consumo de tienda",
          quantity: 1,
          price_unit: parseFloat(ex.price) || 0,
        });
      });

      await supabase.from("sales_items").insert(itemsAInsertar);

      await supabase
        .from("padel_matches")
        .update({
          payments_history: historialNuevo,
          payment_status: "aprobado",
        })
        .eq("id", match.id);

      setModalDetalleMatch(false);
      mostrarNotificacion(
        "Ticket Liquidado",
        `🔒 ¡RESERVA CONFIRMADA! Se registraron $${totalGranEsperado.toFixed(2)} (Bs. ${(totalGranEsperado * tasaBCV).toFixed(2)}) en las ventas del día.`,
        "success"
      );
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error al liquidar el ticket.", "error");
    } finally {
      setProcesando(false);
    }
  }

  function cancelarReserva(match) {
    pedirConfirmacion(
      "Cancelar Reserva",
      `¿Confirmas la cancelación de la reserva de ${match.court?.name || "Pista"}? Se liberará la agenda y se removerá de las ventas.`,
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
          mostrarNotificacion("Reserva Cancelada", "🚨 La reserva fue cancelada y la pista ha quedado libre.", "info");
          await cargarPartidosPeriodo();
        } catch (err) {
          console.error(err);
          mostrarNotificacion("Error", "Error al cancelar la reserva.", "error");
        } finally {
          setProcesando(false);
        }
      }
    );
  }

  async function agregarAbonoManualPOS(match) {
    const valIngresado = parseFloat(montoAbonoManualPOS);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Ingresa un monto válido a cobrar.", "error");
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
        reference: monedaCobroPOS === "VES" ? `Cobro Bs. ${valIngresado.toFixed(2)}` : "Cobro Mostrador POS",
        receipt_url: null,
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
      const nuevoEstadoGeneral = pagoCompleto ? "aprobado" : "pendiente_aprobacion";

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
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error registrando el abono.", "error");
    } finally {
      setProcesando(false);
    }
  }

  async function agregarUnExtraSilencioso(match, producto) {
    if (!producto || !match) return;
    try {
      setProcesando(true);
      const extrasActuales = Array.isArray(match.extra_items) ? match.extra_items : [];
      const nuevoExtraItem = {
        id_unic: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        id: producto.id,
        name: producto.name,
        price: parseFloat(producto.price) || 0,
      };

      const nuevosExtras = [...extrasActuales, nuevoExtraItem];

      const totalAbonado = (Array.isArray(match.payments_history) ? match.payments_history : [])
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtrasNuevo = nuevosExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
      const totalGranEsperadoNuevo = precioBase + fee + totalExtrasNuevo;

      const pagoCompleto = totalAbonado >= totalGranEsperadoNuevo - 0.05;
      const nuevoEstadoGeneral = pagoCompleto ? "aprobado" : "pendiente_aprobacion";

      await supabase
        .from("padel_matches")
        .update({
          extra_items: nuevosExtras,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      setMatchSeleccionado((prev) =>
        prev ? { ...prev, extra_items: nuevosExtras, payment_status: nuevoEstadoGeneral } : null
      );

      await cargarPartidosPeriodo();
    } catch (err) {
      console.error("Error al agregar extra:", err);
    } finally {
      setProcesando(false);
    }
  }

  async function quitarUnExtraSilencioso(match, productoId) {
    if (!match) return;
    try {
      setProcesando(true);
      const extrasActuales = Array.isArray(match.extra_items) ? match.extra_items : [];
      
      const idxToRemove = extrasActuales.findIndex((ex) => ex.id === productoId);
      if (idxToRemove === -1) return;

      const nuevosExtras = [...extrasActuales];
      nuevosExtras.splice(idxToRemove, 1);

      const totalAbonado = (Array.isArray(match.payments_history) ? match.payments_history : [])
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtrasNuevo = nuevosExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
      const totalGranEsperadoNuevo = precioBase + fee + totalExtrasNuevo;

      const pagoCompleto = totalAbonado >= totalGranEsperadoNuevo - 0.05;
      const nuevoEstadoGeneral = pagoCompleto ? "aprobado" : "pendiente_aprobacion";

      await supabase
        .from("padel_matches")
        .update({
          extra_items: nuevosExtras,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      setMatchSeleccionado((prev) =>
        prev ? { ...prev, extra_items: nuevosExtras, payment_status: nuevoEstadoGeneral } : null
      );

      await cargarPartidosPeriodo();
    } catch (err) {
      console.error("Error al quitar extra:", err);
    } finally {
      setProcesando(false);
    }
  }

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
        
        {/* BARRA SUPERIOR POS */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap justify-between items-center bg-white gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setFechaBase(new Date())} className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-slate-300 text-xs font-black text-slate-800 hover:bg-slate-100">
              Hoy
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => { const d = new Date(fechaBase); d.setDate(d.getDate() - 1); setFechaBase(d); }} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-slate-800 flex items-center justify-center">‹</button>
              <button onClick={() => { const d = new Date(fechaBase); d.setDate(d.getDate() + 1); setFechaBase(d); }} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-black text-slate-800 flex items-center justify-center">›</button>
            </div>
            <h2 className="text-xs sm:text-base font-black text-slate-900 capitalize">
              {fechaBase.toLocaleDateString("es-ES", { month: "long", year: "numeric", day: "numeric" })}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <span className="text-[10px] sm:text-xs font-black">🇻🇪 BCV:</span>
              <span className="text-xs sm:text-sm font-black text-emerald-700">Bs. {tasaBCV.toFixed(2)}</span>
            </div>

            <button onClick={() => cargarPartidosPeriodo()} className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black">
              🔄 Sincronizar
            </button>
          </div>
        </div>

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

              {/* FILAS DE HORARIOS */}
              {bloquesHorarios.map((bloque, idx) => {
                const dateObjSlot = new Date(fechaBase);
                dateObjSlot.setHours(bloque.horaInt, bloque.minutosInt, 0, 0);

                return (
                  <div key={idx} className="flex border-b border-slate-200 hover:bg-slate-50 transition-colors h-20">
                    
                    {/* COLUMNA DE HORA STICKY */}
                    <div className="w-16 sm:w-24 shrink-0 flex flex-col items-center justify-center bg-slate-100 border-r-2 border-slate-300 p-1 text-center sticky left-0 z-20 shadow-xs">
                      <span className="text-[11px] sm:text-xs font-black text-slate-900">{bloque.etiqueta.split(" ")[0]}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase">{bloque.etiqueta.split(" ")[1]}</span>
                    </div>

                    {/* PISTAS */}
                    {canchas.map((cancha) => {
                      const reservado = obtenerReserva(cancha.id, dateObjSlot);
                      const esPendiente = reservado?.payment_status === "pendiente_aprobacion" || reservado?.payment_status === "pago_en_sitio";
                      const precioUSD = cancha.price_credits || 15;
                      const precioBs = precioUSD * tasaBCV;

                      return (
                        <div key={cancha.id} className="flex-1 min-w-[150px] sm:min-w-[180px] p-1 border-l border-slate-200 relative">
                          {reservado ? (
                            <button
                              onClick={() => { setMatchSeleccionado(reservado); setModalDetalleMatch(true); }}
                              className={`h-full w-full rounded-xl p-2 sm:p-2.5 flex flex-col justify-between text-left transition-all shadow-xs border-2 ${
                                esPendiente
                                  ? "bg-amber-500 text-slate-950 border-amber-600 animate-pulse"
                                  : "bg-slate-950 text-white border-slate-800"
                              }`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className={`text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                                  esPendiente ? "bg-slate-950 text-amber-400" : "bg-emerald-500/20 text-[#00FF9D]"
                                }`}>
                                  {esPendiente ? "⚠️ PENDIENTE" : reservado.is_private || reservado.match_type === "privado" ? "🔒 Privado" : "🌐 Abierto"}
                                </span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 bg-white/10 rounded">
                                  {reservado.players?.length || 1}/4
                                </span>
                              </div>
                              <div>
                                <p className="text-[11px] sm:text-xs font-black truncate">{obtenerNombreCliente(reservado)}</p>
                                <p className="text-[8px] sm:text-[9px] opacity-80 font-bold">Bs. {((reservado.total_price || 15) * tasaBCV).toFixed(2)}</p>
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => abrirModalAgendarPOS(cancha, dateObjSlot, bloque.etiqueta)}
                              className="h-full w-full bg-slate-50/70 hover:bg-emerald-50/80 text-emerald-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 transition-all group shadow-2xs"
                            >
                              <span className="text-[11px] sm:text-xs font-black text-emerald-700 group-hover:scale-105 transition-transform">+ Agendar</span>
                              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-0.5">${precioUSD} • Bs. {precioBs.toFixed(2)}</span>
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

      {/* MODAL AGENDAR EN POS */}
      {modalAgendarOpen && bloqueAgendar && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
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

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Cancha Base (Pista Completa):</span>
                  <span className="text-white">${calculosAgendarPOS.base.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#00FF9D]">
                  <span>Comisión App (+10%):</span>
                  <span>+${calculosAgendarPOS.fee.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-end border-t border-slate-800 pt-2 text-white">
                  <div>
                    <span className="text-xs font-black block">Total Sugerido:</span>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Bs. {(calculosAgendarPOS.totalSugerido * tasaBCV).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-lg font-black text-[#00FF9D]">
                    ${calculosAgendarPOS.totalSugerido.toFixed(2)}
                  </span>
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

              <button
                type="submit"
                disabled={procesando}
                className="w-full py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase text-xs tracking-wider rounded-2xl shadow-md mt-2"
              >
                {procesando ? "Guardando..." : "✓ Agendar y Registrar Cobro"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUDITORÍA DE RESERVA */}
      {modalDetalleMatch && matchSeleccionado && (() => {
        const precioBase = matchSeleccionado.total_price || 16;
        const feeApp = matchSeleccionado.app_fee || (matchSeleccionado.is_private ? 0 : precioBase * 0.10);
        const totalExtras = calcularTotalExtras(matchSeleccionado);
        const totalGranEsperado = precioBase + feeApp + totalExtras;

        const historialAbonos = Array.isArray(matchSeleccionado.payments_history) ? matchSeleccionado.payments_history : [];
        const totalAbonadoAprobado = historialAbonos
          .filter((a) => a.status === "aprobado")
          .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

        const pendientePorCobrar = Math.max(0, totalGranEsperado - totalAbonadoAprobado);
        const estaPagadoCompleto = pendientePorCobrar <= 0.05;
        const extras = Array.isArray(matchSeleccionado.extra_items) ? matchSeleccionado.extra_items : [];

        const montoNumIngresado = parseFloat(montoAbonoManualPOS) || 0;
        const equivalenteCalculado = monedaCobroPOS === "USD" 
          ? montoNumIngresado * tasaBCV 
          : montoNumIngresado / tasaBCV;

        return (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
              
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    estaPagadoCompleto ? "bg-emerald-100 text-emerald-800" : "bg-amber-500 text-slate-950"
                  }`}>
                    {estaPagadoCompleto ? "✅ CONFIRMADA / PAGADA" : `⚠️ PENDIENTE ($${pendientePorCobrar.toFixed(2)})`}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">{matchSeleccionado.court?.name || "Pista"}</h3>
                </div>
                <button onClick={() => setModalDetalleMatch(false)} className="text-slate-400 font-bold text-lg">✕</button>
              </div>

              <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 block">Cliente:</span>
                  <p className="text-slate-900 font-black text-xs sm:text-sm truncate">{obtenerNombreCliente(matchSeleccionado)}</p>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-black text-slate-400 block">Contacto:</span>
                  <p className="text-slate-900 font-black text-xs sm:text-sm">{matchSeleccionado.creator_profile?.telefono || "En sitio"}</p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl space-y-2 text-xs font-bold">
                <div className="flex justify-between text-slate-400">
                  <span>Cancha Base:</span>
                  <span className="text-white">${precioBase.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end border-t border-slate-800 pt-2 text-white">
                  <div>
                    <span className="text-xs font-black block">Total Esperado:</span>
                    <p className="text-[10px] text-slate-400 font-semibold">Bs. {(totalGranEsperado * tasaBCV).toFixed(2)}</p>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-[#00FF9D]">${totalGranEsperado.toFixed(2)}</span>
                </div>
              </div>

              {/* COBRAR SALDO EN SITIO */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase text-slate-500">Cobrar Saldo en Sitio:</p>
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                    <button type="button" onClick={() => setMonedaCobroPOS("USD")} className={`px-2 py-0.5 rounded-lg ${monedaCobroPOS === "USD" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>$ USD</button>
                    <button type="button" onClick={() => setMonedaCobroPOS("VES")} className={`px-2 py-0.5 rounded-lg ${monedaCobroPOS === "VES" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}>Bs. VES</button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`$${pendientePorCobrar.toFixed(2)}`}
                    value={montoAbonoManualPOS}
                    onChange={(e) => setMontoAbonoManualPOS(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold outline-none"
                  />
                  <button
                    onClick={() => agregarAbonoManualPOS(matchSeleccionado)}
                    disabled={procesando}
                    className="px-3 py-2 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shrink-0"
                  >
                    + Registrar
                  </button>
                </div>
              </div>

              {/* CONSUMOS EXTRA CON CONTROLES (-) / (+) */}
              <div className="border-t border-slate-200 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">🛒 Consumos Extra</h4>
                  <span className="text-xs font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border">${totalExtras.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
                  {productos.map((prod) => {
                    const qty = extras.filter((ex) => ex.id === prod.id).length;
                    const pPrice = parseFloat(prod.price) || 0;

                    return (
                      <div key={prod.id} className={`p-2 rounded-xl border flex items-center justify-between ${qty > 0 ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"}`}>
                        <div className="min-w-0 flex-1 pr-1">
                          <p className="text-xs font-black text-slate-800 truncate">{prod.name}</p>
                          <p className="text-[10px] font-bold text-slate-500">${pPrice.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {qty > 0 ? (
                            <>
                              <button type="button" onClick={() => quitarUnExtraSilencioso(matchSeleccionado, prod.id)} className="w-6 h-6 rounded bg-rose-100 text-rose-800 font-black text-xs flex items-center justify-center">-</button>
                              <span className="w-4 text-center text-xs font-black">{qty}</span>
                              <button type="button" onClick={() => agregarUnExtraSilencioso(matchSeleccionado, prod)} className="w-6 h-6 rounded bg-emerald-600 text-white font-black text-xs flex items-center justify-center">+</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => agregarUnExtraSilencioso(matchSeleccionado, prod)} className="px-2 py-1 rounded bg-slate-900 text-[#00FF9D] font-black text-[10px]">+ Añadir</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOTONES ACCIÓN */}
              <div className="flex gap-2 pt-2 border-t">
                <button onClick={() => cancelarReserva(matchSeleccionado)} disabled={procesando} className="w-1/3 py-3 bg-rose-100 text-rose-800 font-black text-[11px] uppercase rounded-2xl">🚨 Cancelar</button>
                <button onClick={() => cerrarTicketYLiquidarReserva(matchSeleccionado)} disabled={procesando} className="w-2/3 py-3 bg-emerald-600 text-white font-black text-[11px] uppercase rounded-2xl shadow-md">🔒 Liquidar Reserva</button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* LIGHTBOX IMAGEN */}
      {imagenEngrande && (
        <div className="fixed inset-0 bg-black/90 z-[20000] flex items-center justify-center p-4" onClick={() => setImagenEngrande(null)}>
          <img src={imagenEngrande} alt="Comprobante" className="max-h-[80vh] w-auto rounded-2xl" />
        </div>
      )}

      {/* POPUP NOTIFICACIÓN */}
      {popupNotif.open && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[30000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
            <h3 className="text-base font-black text-slate-900">{popupNotif.title}</h3>
            <p className="text-xs font-bold text-slate-600">{popupNotif.message}</p>
            <button onClick={() => setPopupNotif({ ...popupNotif, open: false })} className="w-full py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl">Entendido</button>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN */}
      {modalConfirm.open && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[30000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
            <h3 className="text-base font-black text-slate-900">{modalConfirm.title}</h3>
            <p className="text-xs font-bold text-slate-600">{modalConfirm.message}</p>
            <div className="flex gap-2">
              <button onClick={() => setModalConfirm({ ...modalConfirm, open: false })} className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-xl">Cancelar</button>
              <button onClick={() => { const act = modalConfirm.action; setModalConfirm({ ...modalConfirm, open: false }); if (act) act(); }} className="w-1/2 py-2.5 bg-rose-600 text-white font-black text-xs uppercase rounded-xl shadow-md">Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}