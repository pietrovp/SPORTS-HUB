"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

export default function HistorialVentasPage() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [tasaBCV, setTasaBCV] = useState(null);
  const [ventaExpandida, setVentaExpandida] = useState(null);
  const [diasExpandidos, setDiasExpandidos] = useState([]);
  const [inicializado, setInicializado] = useState(false);
  const [imagenEngrande, setImagenEngrande] = useState(null);

  const hoyStr = new Date().toLocaleDateString("es-VE", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hoyFormateado = hoyStr.charAt(0).toUpperCase() + hoyStr.slice(1);

  useEffect(() => {
    setMounted(true);
    cargarHistorial();
    obtenerTasaBCV();
  }, []);

  async function obtenerTasaBCV() {
    try {
      const res = await fetch('/api/bcv-rate');
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) {
          setTasaBCV(parseFloat(data.usdRate));
          return;
        }
      }
      const resFallback = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (resFallback.ok) {
        const dataFallback = await resFallback.json();
        if (dataFallback?.promedio) {
          setTasaBCV(parseFloat(dataFallback.promedio));
          return;
        }
      }
    } catch (error) {
      console.error("Fallo al obtener BCV en historial:", error);
    }
  }

  const normalizarTexto = (str) => {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  const formatearHoraReserva = (dbDateString) => {
    if (!dbDateString) return null;
    try {
      // Usamos subcadenas para evitar conversiones de Timezone del navegador
      // Ej: "2026-08-10T15:30:00" -> hora: 15, min: 30
      const horaStr = dbDateString.substring(11, 13);
      const minStr = dbDateString.substring(14, 16);
      
      const hour = parseInt(horaStr, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hora12 = hour % 12 || 12;
      
      return `${hora12}:${minStr} ${ampm}`;
    } catch (e) {
      return null;
    }
  };

  const obtenerNombreClienteMatch = (match) => {
    if (!match) return "";
    if (match.notes && match.notes.trim()) {
      return match.notes.replace(/^Cliente:\s*/i, "").split("(")[0].trim();
    }
    if (match.creator_profile) {
      return `${match.creator_profile.nombre || ""} ${match.creator_profile.apellido || ""}`.trim();
    }
    return "";
  };

  const obtenerTelefonoClienteMatch = (match) => {
    if (!match) return "—";
    if (match.notes && match.notes.includes("(")) {
      const matchTel = match.notes.match(/\(([^)]+)\)/);
      if (matchTel && matchTel[1]) return matchTel[1].trim();
    }
    if (match.creator_profile?.telefono) {
      return match.creator_profile.telefono;
    }
    if (Array.isArray(match.payments_history)) {
      const pConTel = match.payments_history.find(p => p.user_phone && p.user_phone !== "En sitio");
      if (pConTel) return pConTel.user_phone;
    }
    return "—";
  };

  const agruparItemsConsumo = (items) => {
    if (!items || items.length === 0) return [];
    const map = {};

    items.forEach((item) => {
      const key = `${item.item_name}_${item.price_unit}_${item.item_type}`;
      const qty = parseFloat(item.quantity || 1);

      if (!map[key]) {
        map[key] = {
          ...item,
          quantity: qty,
        };
      } else {
        map[key].quantity += qty;
      }
    });

    return Object.values(map);
  };

  const encontrarMatchParaVenta = (venta, matches) => {
    if (!matches || matches.length === 0) return null;

    const itemCancha = (venta.sales_items || []).find(
      (i) => i.item_type === "cancha" || (i.item_name && i.item_name.toLowerCase().includes("reserva"))
    );

    if (!itemCancha) return null;

    if (itemCancha.item_detail && itemCancha.item_detail.includes("MatchID:")) {
      const matchIdExtraido = itemCancha.item_detail.split("MatchID:")[1].split(" ")[0].trim();
      const matchDirecto = matches.find(m => String(m.id) === String(matchIdExtraido));
      if (matchDirecto) return matchDirecto;
    }

    const cleanCliente = normalizarTexto(itemCancha.item_detail || "");
    const cleanPista = normalizarTexto(itemCancha.item_name || "");
    
    // Comparación sin Timezone (solo los primeros 10 caracteres YYYY-MM-DD)
    const fechaVenta = venta.created_at.substring(0, 10);

    let bestMatch = null;
    let maxScore = 0;

    for (const m of matches) {
      let score = 0;
      const mCliente = normalizarTexto(obtenerNombreClienteMatch(m));
      const mNotes = normalizarTexto(m.notes || "");
      const mCourt = normalizarTexto(m.court?.name || "");
      const mDate = m.scheduled_at.substring(0, 10);

      if (cleanPista && mCourt && (cleanPista.includes(mCourt) || mCourt.includes(cleanPista))) score += 3;
      if (cleanCliente && (mCliente.includes(cleanCliente) || cleanCliente.includes(mCliente) || mNotes.includes(cleanCliente))) score += 5;
      if (mDate === fechaVenta) score += 2;
      if (m.payment_status === "liquidado") score += 1;

      if (score > maxScore && score >= 4) {
        maxScore = score;
        bestMatch = m;
      }
    }

    return bestMatch;
  };

  async function cargarHistorial() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      if (!profile?.club_id) return;

      const { data: historialVentas, error: errVentas } = await supabase
        .from("sales")
        .select(`
          *,
          sales_items (*)
        `)
        .eq("club_id", profile.club_id)
        .order("created_at", { ascending: false });

      if (errVentas) throw errVentas;
      const ventasRaw = historialVentas || [];

      const { data: padelMatches } = await supabase
        .from("padel_matches")
        .select(`
          *,
          court:courts(name)
        `)
        .eq("club_id", profile.club_id);

      const matchesList = padelMatches || [];

      const ventasProcesadas = ventasRaw.map((v) => {
        const match = encontrarMatchParaVenta(v, matchesList);

        let clienteFinal = "Cliente Mostrador";
        let telefonoFinal = "—";
        let horaReservaFinal = "—";
        let pagosDesglosados = [];

        if (match) {
          // VENTA PROVENIENTE DE RESERVA DE CANCHA
          clienteFinal = obtenerNombreClienteMatch(match) || "Cliente Mostrador";
          telefonoFinal = obtenerTelefonoClienteMatch(match);
          horaReservaFinal = formatearHoraReserva(match.scheduled_at) || "—";

          if (Array.isArray(match.payments_history) && match.payments_history.length > 0) {
            pagosDesglosados = match.payments_history.filter(p => p.status === 'aprobado' || !p.status);
          } else {
            pagosDesglosados = [
              {
                method: v.payment_method || "efectivo",
                amount: v.total_amount,
                user_name: clienteFinal,
                reference: "Cobro POS",
              },
            ];
          }
        } else {
          // VENTA DIRECTA DE TIENDA (PARSEO ESTRUCTURADO DE ITEM_DETAIL)
          const primerItem = (v.sales_items || [])[0];
          const detail = primerItem?.item_detail || "";

          let refTienda = "Venta Tienda POS";
          let proofTienda = null;

          if (detail.includes("Cliente:")) {
            const mC = detail.match(/Cliente:\s*([^|]+)/i);
            if (mC && mC[1]) clienteFinal = mC[1].trim();
          }
          if (detail.includes("Tel:")) {
            const mT = detail.match(/Tel:\s*([^|]+)/i);
            if (mT && mT[1]) telefonoFinal = mT[1].trim();
          }
          if (detail.includes("Ref:")) {
            const mR = detail.match(/Ref:\s*([^|]+)/i);
            if (mR && mR[1]) refTienda = mR[1].trim();
          }
          if (detail.includes("Proof:")) {
            const mP = detail.match(/Proof:\s*(.+)$/i);
            if (mP && mP[1]) proofTienda = mP[1].trim();
          }

          horaReservaFinal = "Tienda POS";
          pagosDesglosados = [
            {
              method: v.payment_method || "efectivo",
              amount: v.total_amount,
              user_name: clienteFinal,
              user_phone: telefonoFinal,
              reference: refTienda,
              receipt_url: proofTienda,
            },
          ];
        }

        return {
          ...v,
          cliente_principal: clienteFinal,
          telefono_principal: telefonoFinal,
          hora_reserva_principal: horaReservaFinal,
          pagos_desglosados: pagosDesglosados,
          match_info: match,
        };
      });

      setVentas(ventasProcesadas);
    } catch (error) {
      console.error("Error cargando el historial:", error);
    } finally {
      setLoading(false);
    }
  }

  const iconPago = (metodo) => {
    if (!metodo) return '💵 EFECTIVO';
    const key = metodo.toString().toLowerCase().trim();
    if (key.includes('zelle')) return '🇺🇸 ZELLE';
    if (key.includes('movil') || key.includes('móvil') || key.includes('pago_movil') || key.includes('pago movil') || key.includes('transferencia')) return '📱 PAGO MÓVIL';
    if (key.includes('punto') || key.includes('pos') || key.includes('card') || key.includes('tarjeta')) return '💳 PUNTO';
    if (key.includes('efectivo') || key.includes('cash')) return '💵 EFECTIVO';
    return `💰 ${metodo.toString().toUpperCase()}`;
  };

  const toggleExpandirTicket = (id) => {
    setVentaExpandida(ventaExpandida === id ? null : id);
  };

  const toggleDia = (fecha) => {
    setDiasExpandidos((prev) =>
      prev.includes(fecha)
        ? prev.filter(d => d !== fecha)
        : [...prev, fecha]
    );
  };

  const ventasAgrupadas = useMemo(() => {
    return ventas.reduce((acc, venta) => {
      // Agrupamos las ventas por la fecha en la que se emitieron
      const fechaObj = new Date(venta.created_at);
      const fechaString = fechaObj.toLocaleDateString("es-VE", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const fechaMayus = fechaString.charAt(0).toUpperCase() + fechaString.slice(1);
      
      const grupo = acc.find(g => g.fecha === fechaMayus);
      if (grupo) {
        grupo.tickets.push(venta);
      } else {
        acc.push({ fecha: fechaMayus, tickets: [venta] });
      }
      return acc;
    }, []);
  }, [ventas]);

  useEffect(() => {
    if (ventasAgrupadas.length > 0 && !inicializado) {
      setDiasExpandidos([ventasAgrupadas[0].fecha]);
      setInicializado(true);
    }
  }, [ventasAgrupadas, inicializado]);

  const ticketsVisibles = ventasAgrupadas
    .filter(grupo => diasExpandidos.includes(grupo.fecha))
    .reduce((total, grupo) => total + grupo.tickets.length, 0);

  const textoTickets = diasExpandidos.length === 1 && diasExpandidos[0] === hoyFormateado
    ? "Tickets de Hoy"
    : "Tickets Visibles";

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Cargando Historial...</div>;
  }

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">🧾 Historial de Tickets</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Revisa los cobros, desglose exacto de abonos y comprobantes adjuntos.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-4 w-full md:w-auto">
            {tasaBCV && (
              <div className="bg-slate-100 text-slate-600 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-center shadow-sm border border-slate-200 flex flex-col justify-center">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasa de Hoy</p>
                <p className="text-xs sm:text-sm font-black">Bs. {tasaBCV.toFixed(2)}</p>
              </div>
            )}
            <div className="bg-slate-900 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-center shadow-lg flex flex-col justify-center min-w-[110px] sm:min-w-[130px]">
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{textoTickets}</p>
              <p className="text-base sm:text-lg font-black text-[#00FF9D]">{ticketsVisibles}</p>
            </div>
          </div>
        </div>

        {ventasAgrupadas.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-10 sm:p-16 text-center">
            <span className="text-4xl sm:text-5xl block mb-3">📭</span>
            <p className="text-slate-500 font-bold text-sm sm:text-lg">Aún no hay tickets registrados.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {ventasAgrupadas.map((grupo) => {
              const estaAbierto = diasExpandidos.includes(grupo.fecha);
              const totalDia = grupo.tickets.reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
              const esHoy = grupo.fecha === hoyFormateado;

              return (
                <div key={grupo.fecha} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                  <button
                    type="button"
                    onClick={() => toggleDia(grupo.fecha)}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-5 bg-white hover:bg-slate-50 transition-colors gap-2 sm:gap-4 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 transition-colors text-xs ${estaAbierto ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {estaAbierto ? '▼' : '▶'}
                      </div>
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-lg font-black text-slate-900 leading-tight">📅 {grupo.fecha}</h3>
                          {esHoy && <span className="bg-[#00FF9D]/20 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Hoy</span>}
                        </div>
                        <p className="text-[11px] sm:text-xs font-bold text-slate-400">{grupo.tickets.length} tickets registrados</p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col justify-between items-center sm:items-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 w-full sm:w-auto">
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Venta Neta</p>
                      <p className="text-base sm:text-lg font-black text-emerald-600 leading-none">${totalDia.toFixed(2)}</p>
                    </div>
                  </button>

                  {estaAbierto && (
                    <div className="border-t border-slate-100 bg-slate-50 p-2.5 sm:p-4">
                      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-950 text-slate-300 text-[10px] uppercase tracking-widest font-black">
                                <th className="p-3 border-b border-slate-800 w-10 text-center">Det.</th>
                                <th className="p-3 border-b border-slate-800">Ticket ID</th>
                                <th className="p-3 border-b border-slate-800">Cliente</th>
                                <th className="p-3 border-b border-slate-800">Teléfono</th>
                                <th className="p-3 border-b border-slate-800">Horario Reserva</th>
                                <th className="p-3 border-b border-slate-800">Hora de Cobro</th>
                                <th className="p-3 border-b border-slate-800 text-right">Monto Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {grupo.tickets.map((venta) => {
                                const tasaAplicar = venta.exchange_rate ? venta.exchange_rate : (esHoy ? tasaBCV : null);
                                const esExpandido = ventaExpandida === venta.id;
                                const itemsAgrupados = agruparItemsConsumo(venta.sales_items);

                                // Ajuste para renderizar la hora exacta de cobro sin timezone offset
                                const horaCobro = venta.created_at.substring(11, 16);

                                return (
                                  <React.Fragment key={venta.id}>
                                    <tr
                                      onClick={() => toggleExpandirTicket(venta.id)}
                                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${esExpandido ? 'bg-slate-50' : ''}`}
                                    >
                                      <td className="p-3 text-slate-400 text-center text-xs">
                                        {esExpandido ? '▼' : '▶'}
                                      </td>
                                      <td className="p-3">
                                        <span className="bg-slate-900 text-[#00FF9D] text-[9px] font-mono font-black px-2 py-1 rounded-md">
                                          #{venta.id.split("-")[0].toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <p className="text-xs font-bold text-slate-800">
                                          👤 {venta.cliente_principal}
                                        </p>
                                      </td>
                                      <td className="p-3">
                                        <p className="text-xs font-bold text-slate-600">
                                          📞 {venta.telefono_principal}
                                        </p>
                                      </td>
                                      <td className="p-3">
                                        <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                                          ⏰ {venta.hora_reserva_principal}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <p className="text-xs font-bold text-slate-600">
                                          {horaCobro}
                                        </p>
                                      </td>
                                      <td className="p-3 text-right">
                                        <span className="text-sm font-black text-slate-900 block leading-none">
                                          ${parseFloat(venta.total_amount || 0).toFixed(2)}
                                        </span>
                                        {tasaAplicar ? (
                                          <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                                            Bs. {(parseFloat(venta.total_amount || 0) * tasaAplicar).toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-[8px] font-bold text-slate-300 mt-1 block">Tasa N/A</span>
                                        )}
                                      </td>
                                    </tr>

                                    {esExpandido && (
                                      <tr className="bg-slate-50/70 border-t-0">
                                        <td colSpan="7" className="p-5 px-8 border-b border-slate-200">
                                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            
                                            <div className="space-y-3">
                                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">
                                                📦 Detalle de la Reserva e Ítems
                                              </h4>
                                              <div className="space-y-2">
                                                {itemsAgrupados.map((item, idx) => {
                                                  const esCancha = item.item_type === 'cancha' || (item.item_name && (item.item_name.toLowerCase().includes('reserva') || item.item_name.toLowerCase().includes('pista')));
                                                  const subtotal = item.quantity * item.price_unit;

                                                  return (
                                                    <div key={idx} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex justify-between items-center gap-3">
                                                      <div className="flex items-center gap-2.5 min-w-0">
                                                        <span className="text-lg">{esCancha ? '🎾' : '🛍️'}</span>
                                                        <p className="text-sm font-bold text-slate-900 leading-tight truncate">{item.item_name}</p>
                                                      </div>

                                                      <div className="text-right shrink-0">
                                                        <p className="text-sm font-black text-emerald-600">${subtotal.toFixed(2)}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                          {item.quantity} und x ${parseFloat(item.price_unit).toFixed(2)}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                            <div className="space-y-3">
                                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 pb-2">
                                                💳 Desglose de Pagos Recibidos ({venta.pagos_desglosados.length})
                                              </h4>
                                              <div className="space-y-2">
                                                {(venta.pagos_desglosados || []).map((pago, idx) => {
                                                  const montoPago = parseFloat(pago.amount || pago.monto || 0);
                                                  const esNegativo = montoPago < 0;
                                                  const metodoNombre = pago.method || pago.metodo || pago.payment_method || 'EFECTIVO';
                                                  const referencia = pago.reference || pago.numReferencia;
                                                  const nombreCliente = pago.user_name || pago.client_name || pago.nombre_cliente || 'Cliente Mostrador (POS)';
                                                  const comprobanteUrl = pago.receipt_url || pago.receipt_proof || pago.previewComprobante;

                                                  return (
                                                    <div key={idx} className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs">
                                                      <div className="flex items-center gap-3 min-w-0">
                                                        <span className="bg-slate-900 text-[#00FF9D] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0">
                                                          {iconPago(metodoNombre)}
                                                        </span>
                                                        <div className="min-w-0">
                                                          <p className="text-xs sm:text-sm font-extrabold text-slate-800 leading-tight truncate">
                                                            {nombreCliente}
                                                          </p>
                                                          {referencia && (
                                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                                                              Ref: {referencia}
                                                            </p>
                                                          )}
                                                        </div>
                                                      </div>

                                                      <div className="flex items-center gap-2 shrink-0">
                                                        <div className="text-right">
                                                          <p className={`text-sm sm:text-base font-black ${esNegativo ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                            {esNegativo ? '-' : ''}${Math.abs(montoPago).toFixed(2)}
                                                          </p>
                                                          {tasaAplicar && (
                                                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                              Bs. {(Math.abs(montoPago) * tasaAplicar).toFixed(2)}
                                                            </p>
                                                          )}
                                                        </div>

                                                        {comprobanteUrl && (
                                                          <button
                                                            type="button"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              setImagenEngrande(comprobanteUrl);
                                                            }}
                                                            className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-100 overflow-hidden hover:border-blue-500 transition-all shrink-0 ml-1 cursor-pointer"
                                                          >
                                                            <img src={comprobanteUrl} alt="Comprobante" className="w-full h-full object-cover" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>

                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mounted && imagenEngrande && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-4" onClick={() => setImagenEngrande(null)}>
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagenEngrande(null)}
              className="absolute -top-10 right-0 text-white font-black text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              ✕ Cerrar Vista
            </button>
            <img src={imagenEngrande} alt="Comprobante Ampliado" className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl border border-slate-800" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}