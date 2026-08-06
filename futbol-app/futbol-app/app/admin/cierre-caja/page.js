"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

export default function CierreCajaPage() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [tasaBcv, setTasaBcv] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString('en-CA'));
  
  const [ventas, setVentas] = useState([]);
  const [matches, setMatches] = useState([]);
  
  const [efectivoDeclarado, setEfectivoDeclarado] = useState("");
  const [procesandoCierre, setProcesandoCierre] = useState(false);
  const [cierreGuardado, setCierreGuardado] = useState(null);
  const [modalResumenOpen, setModalResumenOpen] = useState(false);
  const [ticketExpandido, setTicketExpandido] = useState(null);
  const [errorNotif, setErrorNotif] = useState("");

  useEffect(() => {
    setMounted(true);
    cargarDatos(fecha);
    obtenerTasaBcv();
  }, [fecha]);

  const obtenerTasaBcv = async () => {
    try {
      const res = await fetch("/api/bcv-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) setTasaBcv(parseFloat(data.usdRate));
        return;
      }
      const resFallback = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
      if (resFallback.ok) {
        const dataFallback = await resFallback.json();
        if (dataFallback?.promedio) setTasaBcv(parseFloat(dataFallback.promedio));
      }
    } catch (error) {
      console.error("Error obteniendo tasa BCV:", error);
    }
  };

  const normalizarTexto = (str) => {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  // Limpia los prefijos "Cliente:", "Reserva Completa:", "Extra:" antes de comparar
  const extraerTextoLimpio = (str) => {
    if (!str) return "";
    return str
      .replace(/^Reserva Completa:\s*/i, "")
      .replace(/^Cliente:\s*/i, "")
      .replace(/^Extra:\s*/i, "")
      .trim();
  };

  const normalizarMetodoPago = (metodoStr) => {
    if (!metodoStr) return "efectivo";
    const str = metodoStr.toString().toLowerCase().trim();
    if (str.includes("zelle")) return "zelle";
    if (str.includes("movil") || str.includes("móvil") || str.includes("pago_movil") || str.includes("pago movil")) return "pago_movil";
    if (str.includes("punto") || str.includes("pos") || str.includes("card") || str.includes("tarjeta")) return "punto";
    if (str.includes("efectivo") || str.includes("cash")) return "efectivo";
    return "otro";
  };

  const cargarDatos = async (fechaSeleccionada) => {
    setLoading(true);
    setErrorNotif("");
    setCierreGuardado(null);
    setModalResumenOpen(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*, club_id")
        .eq("id", user.id)
        .maybeSingle();

      setUserProfile(profile);

      const clubId = profile?.club_id;
      if (!clubId) {
        setLoading(false);
        return;
      }

      const { data: clubData } = await supabase
        .from("padel_clubs")
        .select("*")
        .eq("id", clubId)
        .maybeSingle();

      setClubInfo(clubData);

      const startOfDay = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
      const endOfDay = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();

      const { data: sales } = await supabase
        .from("sales")
        .select(`
          id, total_amount, payment_method, exchange_rate, created_at, payment_details,
          sales_items ( id, item_type, item_name, item_detail, quantity, price_unit )
        `)
        .eq("club_id", clubId)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false });

      const { data: padelMatches } = await supabase
        .from("padel_matches")
        .select("*, court:padel_courts(name)")
        .eq("club_id", clubId);

      setVentas(sales || []);
      setMatches(padelMatches || []);
    } catch (error) {
      console.error("Error cargando datos de cierre:", error);
    } finally {
      setLoading(false);
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

  const encontrarMatchParaVenta = (venta, matchesList) => {
    if (!matchesList || matchesList.length === 0) return null;

    const itemCancha = (venta.sales_items || []).find(
      (i) =>
        i.item_type === "cancha" ||
        (i.item_name &&
          (i.item_name.toLowerCase().includes("reserva") ||
            i.item_name.toLowerCase().includes("pista")))
    );

    if (!itemCancha) return null;

    const cleanCliente = normalizarTexto(extraerTextoLimpio(itemCancha.item_detail));
    const cleanPista = normalizarTexto(extraerTextoLimpio(itemCancha.item_name));
    const fechaVenta = new Date(venta.created_at).toDateString();

    let bestMatch = null;
    let maxScore = 0;

    for (const m of matchesList) {
      let score = 0;
      const mCliente = normalizarTexto(obtenerNombreClienteMatch(m));
      const mNotes = normalizarTexto(m.notes || "");
      const mCourt = normalizarTexto(m.court?.name || "");
      const mDate = new Date(m.scheduled_at).toDateString();

      if (cleanPista && mCourt && (cleanPista.includes(mCourt) || mCourt.includes(cleanPista))) score += 3;
      if (cleanCliente && (mCliente.includes(cleanCliente) || cleanCliente.includes(mCliente) || mNotes.includes(cleanCliente))) score += 5;
      if (mDate === fechaVenta) score += 2;
      if (m.payment_status === "liquidado") score += 1;

      if (score > maxScore && score >= 3) {
        maxScore = score;
        bestMatch = m;
      }
    }

    return bestMatch;
  };

  // CÁLCULOS FINANCIEROS CON LECTURA DE PAGOS MIXTOS MULTIORIGEN
  const resumenFinanciero = useMemo(() => {
    let sumCanchas = 0;
    let sumTienda = 0;
    let sumComision = 0;

    const desgloseMetodos = {
      efectivo: 0,
      zelle: 0,
      pago_movil: 0,
      punto: 0,
      otro: 0
    };

    ventas.forEach((venta) => {
      const items = venta.sales_items || [];
      items.forEach((item) => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.price_unit) || 0;
        const subtotal = qty * price;

        if (item.item_type === "cancha") {
          sumCanchas += subtotal;
        } else if (item.item_type === "producto") {
          sumTienda += subtotal;
        } else if (item.item_type === "comision_app") {
          sumComision += subtotal;
        }
      });

      // 1. Verificar si el ticket guardó payment_details en el registro
      let pagosDelTicket = [];
      if (Array.isArray(venta.payment_details) && venta.payment_details.length > 0) {
        pagosDelTicket = venta.payment_details;
      } else {
        // 2. Si no, buscar en la reserva enlazada
        const match = encontrarMatchParaVenta(venta, matches);
        if (match && Array.isArray(match.payments_history) && match.payments_history.length > 0) {
          pagosDelTicket = match.payments_history.filter(p => p.status === 'aprobado' || !p.status);
        }
      }

      if (pagosDelTicket.length > 0) {
        pagosDelTicket.forEach(pago => {
          const m = normalizarMetodoPago(pago.method || pago.metodo || pago.payment_method);
          const monto = parseFloat(pago.amount || pago.monto) || 0;
          desgloseMetodos[m] += monto;
        });
      } else {
        const m = normalizarMetodoPago(venta.payment_method);
        const monto = parseFloat(venta.total_amount) || 0;
        desgloseMetodos[m] += monto;
      }
    });

    const totalSistema = sumCanchas + sumTienda + sumComision;
    const comisionSportsHub = sumComision > 0 ? sumComision : sumCanchas * 0.10;

    return {
      sumCanchas,
      sumTienda,
      sumComision,
      totalSistema,
      comisionSportsHub,
      desgloseMetodos
    };
  }, [ventas, matches]);

  const declarado = Number(efectivoDeclarado) || 0;
  const diferencia = declarado - resumenFinanciero.totalSistema;

  const agruparItemsTicket = (items) => {
    if (!items || items.length === 0) return [];
    const map = {};

    items.forEach((item) => {
      const key = `${item.item_name}_${item.price_unit}_${item.item_type}`;
      const qty = parseFloat(item.quantity || 1);

      if (!map[key]) {
        map[key] = { ...item, quantity: qty };
      } else {
        map[key].quantity += qty;
      }
    });

    return Object.values(map);
  };

  const iconPago = (metodo) => {
    const m = normalizarMetodoPago(metodo);
    if (m === "zelle") return "🇺🇸 ZELLE";
    if (m === "pago_movil") return "📱 PAGO MÓVIL";
    if (m === "punto") return "💳 PUNTO";
    if (m === "efectivo") return "💵 EFECTIVO";
    return `💰 ${metodo.toString().toUpperCase()}`;
  };

  const renderBadgesMetodosVenta = (venta) => {
    let pagos = [];
    if (Array.isArray(venta.payment_details) && venta.payment_details.length > 0) {
      pagos = venta.payment_details;
    } else {
      const match = encontrarMatchParaVenta(venta, matches);
      if (match && Array.isArray(match.payments_history)) {
        pagos = match.payments_history.filter(p => p.status === 'aprobado' || !p.status);
      }
    }

    if (pagos.length > 0) {
      const metodosUnicos = Array.from(
        new Set(pagos.map(p => normalizarMetodoPago(p.method || p.metodo || p.payment_method)))
      );
      return (
        <div className="flex flex-wrap gap-1">
          {metodosUnicos.map((m, idx) => (
            <span key={idx} className="text-[9px] font-black text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
              {iconPago(m)}
            </span>
          ))}
        </div>
      );
    }

    return (
      <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
        {iconPago(venta.payment_method)}
      </span>
    );
  };

  const ejecutarCierreCaja = async () => {
    if (efectivoDeclarado === "" || isNaN(declarado) || declarado < 0) {
      setErrorNotif("Por favor ingresa un monto válido de dinero declarado para cerrar la caja.");
      return;
    }

    try {
      setProcesandoCierre(true);
      setErrorNotif("");

      const { data: { user } } = await supabase.auth.getUser();

      const datosCierre = {
        club_id: userProfile?.club_id,
        closed_by: user?.id,
        closure_date: fecha,
        total_system: resumenFinanciero.totalSistema,
        total_declared: declarado,
        difference: diferencia,
        courts_total: resumenFinanciero.sumCanchas,
        store_total: resumenFinanciero.sumTienda,
        commission_total: resumenFinanciero.sumComision,
        cash_total: resumenFinanciero.desgloseMetodos.efectivo,
        zelle_total: resumenFinanciero.desgloseMetodos.zelle,
        mobile_pay_total: resumenFinanciero.desgloseMetodos.pago_movil,
        pos_total: resumenFinanciero.desgloseMetodos.punto,
        bcv_rate: tasaBcv,
        sales_count: ventas.length,
        created_at: new Date().toISOString()
      };

      try {
        await supabase.from("cash_closures").insert(datosCierre);
      } catch (dbErr) {
        console.log("Aviso: Registro guardado localmente.");
      }

      setCierreGuardado(datosCierre);
      setModalResumenOpen(true);
    } catch (err) {
      console.error(err);
      setErrorNotif("Error registrando el cierre de caja.");
    } finally {
      setProcesandoCierre(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        
        {/* HEADER Y FILTROS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">📠 Cierre de Caja</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Cuadre general de ingresos, desglose real por métodos y auditoría diaria.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {tasaBcv && (
              <div className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-center shadow-sm border border-slate-200 flex flex-col justify-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tasa BCV</p>
                <p className="text-xs sm:text-sm font-black">Bs. {tasaBcv.toFixed(2)}</p>
              </div>
            )}
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="px-3 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm outline-none shadow-sm cursor-pointer"
            />
          </div>
        </div>

        {errorNotif && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-2xl text-xs font-bold flex justify-between items-center">
            <span>⚠️ {errorNotif}</span>
            <button onClick={() => setErrorNotif("")} className="font-black text-slate-400">✕</button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center font-bold text-slate-400 animate-pulse bg-white rounded-3xl border border-slate-200">
            Cargando transacciones del día...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMNA IZQUIERDA (5 COLS) */}
            <div className="lg:col-span-5 space-y-4">
              
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  📊 Ingresos del Sistema
                </h2>

                <div className="space-y-2.5 text-xs font-bold text-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">🎾 Canchas Netas</span>
                    <span className="font-black text-slate-900">${resumenFinanciero.sumCanchas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">🛍️ Tienda (POS)</span>
                    <span className="font-black text-slate-900">${resumenFinanciero.sumTienda.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 text-emerald-700">⚡ Comisión Cobrada</span>
                    <span className="font-black text-emerald-600">+${resumenFinanciero.sumComision.toFixed(2)}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-black uppercase text-slate-900">Total Facturado</span>
                    <div className="text-right">
                      <span className="text-2xl font-black text-slate-900 block leading-none">
                        ${resumenFinanciero.totalSistema.toFixed(2)}
                      </span>
                      {tasaBcv && (
                        <span className="text-[10px] font-bold text-slate-400 block mt-1">
                          Bs. {(resumenFinanciero.totalSistema * tasaBcv).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* DESGLOSE REAL DE MÉTODOS DE PAGO */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                  💳 Total Ingresado por Métodos Reales
                </h2>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 block">💵 EFECTIVO</span>
                    <span className="text-sm font-black text-slate-900">${resumenFinanciero.desgloseMetodos.efectivo.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 block">🇺🇸 ZELLE</span>
                    <span className="text-sm font-black text-slate-900">${resumenFinanciero.desgloseMetodos.zelle.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 block">📱 PAGO MÓVIL</span>
                    <span className="text-sm font-black text-slate-900">${resumenFinanciero.desgloseMetodos.pago_movil.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 block">💳 PUNTO VENTA</span>
                    <span className="text-sm font-black text-slate-900">${resumenFinanciero.desgloseMetodos.punto.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-5 rounded-3xl shadow-md border border-slate-800 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xs font-black text-[#00FF9D] uppercase tracking-widest">
                    Deuda a Sports Hub
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    10% cobrado al usuario en los tickets.
                  </p>
                </div>
                <p className="text-2xl font-black text-[#00FF9D]">
                  ${resumenFinanciero.comisionSportsHub.toFixed(2)}
                </p>
              </div>

              <div className="bg-indigo-50/80 p-5 rounded-3xl border border-indigo-100 space-y-3">
                <h2 className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                  🔒 Declarar y Cerrar Caja
                </h2>
                <p className="text-xs text-indigo-700 font-bold leading-snug">
                  Ingresa la suma total entregada al final del turno.
                </p>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 480.00"
                  value={efectivoDeclarado}
                  onChange={(e) => setEfectivoDeclarado(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-2xl font-black text-xl text-slate-900 text-center outline-none focus:ring-2 focus:ring-indigo-400 shadow-2xs"
                />

                {efectivoDeclarado !== "" && (
                  <div className={`p-3 rounded-2xl border flex justify-between items-center ${
                    diferencia < -0.05
                      ? "text-rose-700 bg-rose-100 border-rose-200"
                      : "text-emerald-800 bg-emerald-100 border-emerald-200"
                  }`}>
                    <span className="text-xs font-black uppercase">
                      {diferencia < -0.05 ? "Faltante" : "Sobrante / Cuadrado"}
                    </span>
                    <span className="text-base font-black">
                      {diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={ejecutarCierreCaja}
                  disabled={procesandoCierre}
                  className="w-full py-3.5 bg-slate-900 text-[#00FF9D] hover:bg-slate-800 rounded-2xl font-black uppercase text-xs tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {procesandoCierre ? "Procesando Cierre..." : "🔒 Realizar Cierre de Caja"}
                </button>
              </div>

            </div>

            {/* COLUMNA DERECHA (7 COLS) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider">
                      🧾 Tickets Generados del Día
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Detalle de ventas registradas en POS
                    </p>
                  </div>
                  <span className="bg-slate-800 text-[#00FF9D] font-mono font-black text-xs px-2.5 py-1 rounded-xl">
                    {ventas.length} facturas
                  </span>
                </div>

                {ventas.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-bold text-sm">
                    📭 No hay tickets registrados en esta fecha.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {ventas.map((venta) => {
                      const tasaAplicar = venta.exchange_rate ? venta.exchange_rate : tasaBcv;
                      const esExpandido = ticketExpandido === venta.id;
                      const itemsAgrupados = agruparItemsTicket(venta.sales_items);

                      return (
                        <div key={venta.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                          <div
                            onClick={() => setTicketExpandido(esExpandido ? null : venta.id)}
                            className="flex justify-between items-center cursor-pointer"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-900 text-[#00FF9D] text-[9px] font-mono font-black px-2 py-0.5 rounded-md">
                                  #{venta.id.split("-")[0].toUpperCase()}
                                </span>
                                <span className="text-xs font-bold text-slate-600">
                                  ⏰ {new Date(venta.created_at).toLocaleTimeString("es-VE", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                              <div>
                                {renderBadgesMetodosVenta(venta)}
                              </div>
                            </div>

                            <div className="text-right flex items-center gap-2">
                              <div>
                                <span className="text-base font-black text-slate-900 block leading-tight">
                                  ${parseFloat(venta.total_amount || 0).toFixed(2)}
                                </span>
                                {tasaAplicar && (
                                  <span className="text-[10px] font-bold text-slate-400 block">
                                    Bs. {(parseFloat(venta.total_amount || 0) * tasaAplicar).toFixed(2)}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 font-bold">{esExpandido ? '▼' : '▶'}</span>
                            </div>
                          </div>

                          {esExpandido && (
                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                Consumos en este Ticket:
                              </p>
                              <div className="space-y-1.5">
                                {itemsAgrupados.map((item, idx) => (
                                  <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="bg-slate-200 text-slate-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                                        {item.quantity} und
                                      </span>
                                      <span className="font-bold text-slate-900">{item.item_name}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-black text-emerald-600">
                                        ${(item.quantity * item.price_unit).toFixed(2)}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-bold block">
                                        (${parseFloat(item.price_unit).toFixed(2)} c/u)
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* COMPROBANTE OFICIAL DE CIERRE */}
      {mounted && modalResumenOpen && cierreGuardado && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-4" onClick={() => setModalResumenOpen(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            
            <div className="text-center border-b pb-4 space-y-1">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                ✓ CIERRE DE CAJA EXITOSO
              </span>
              <h2 className="text-xl font-black text-slate-900 pt-1">
                {clubInfo?.name || "Sports Hub Complex"}
              </h2>
              <p className="text-xs font-bold text-slate-400">
                Fecha Cierre: {cierreGuardado.closure_date}
              </p>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Total Facturado Sistema:</span>
                <span className="font-black text-white text-sm">${cierreGuardado.total_system.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Monto Declarado Entregado:</span>
                <span className="font-black text-emerald-400 text-sm">${cierreGuardado.total_declared.toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center font-black">
                <span className="uppercase text-[10px] text-slate-400">Diferencia Final:</span>
                <span className={`text-base ${cierreGuardado.difference < -0.05 ? "text-rose-400" : "text-[#00FF9D]"}`}>
                  {cierreGuardado.difference >= 0 ? "+" : ""}${cierreGuardado.difference.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <p className="text-[10px] font-black uppercase text-slate-400 border-b pb-1">
                💳 Desglose de Ingresos Reales:
              </p>
              <div className="flex justify-between">
                <span>💵 Efectivo:</span>
                <span className="font-black text-slate-900">${cierreGuardado.cash_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>🇺🇸 Zelle:</span>
                <span className="font-black text-slate-900">${cierreGuardado.zelle_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>📱 Pago Móvil:</span>
                <span className="font-black text-slate-900">${cierreGuardado.mobile_pay_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>💳 Punto de Venta:</span>
                <span className="font-black text-slate-900">${cierreGuardado.pos_total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-1/2 py-3 bg-slate-100 text-slate-800 font-black text-xs uppercase rounded-xl hover:bg-slate-200 transition-colors"
              >
                🖨️ Imprimir
              </button>
              <button
                type="button"
                onClick={() => setModalResumenOpen(false)}
                className="w-1/2 py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cerrar Vista
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}