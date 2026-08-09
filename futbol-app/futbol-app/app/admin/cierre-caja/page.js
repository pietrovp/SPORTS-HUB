"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

function CustomDarkDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const dateObj = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [value]);

  const [viewDate, setViewDate] = useState(dateObj);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const diasSemana = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const seleccionarDia = (dia) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(dia).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
    setOpen(false);
  };

  const mesAnterior = () => setViewDate(new Date(year, month - 1, 1));
  const mesSiguiente = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3.5 py-2 bg-slate-900 text-[#00FF9D] border border-slate-800 hover:border-[#00FF9D] rounded-xl text-xs sm:text-sm font-black outline-none flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
      >
        <span>📅 {value ? `${value.split("-")[2]}/${value.split("-")[1]}/${value.split("-")[0]}` : "Seleccionar fecha"}</span>
        <span className="text-[10px] text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 bg-[#0B0C15] border border-slate-800 rounded-2xl p-3 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
            <button type="button" onClick={mesAnterior} className="text-slate-400 hover:text-[#00FF9D] font-black text-sm px-2">❮</button>
            <span className="text-xs font-black uppercase text-[#00FF9D]">{meses[month]} {year}</span>
            <button type="button" onClick={mesSiguiente} className="text-slate-400 hover:text-[#00FF9D] font-black text-sm px-2">❯</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {diasSemana.map((d, i) => (
              <span key={i} className="text-[9px] font-black text-slate-500 uppercase">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`offset-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dia = i + 1;
              const mm = String(month + 1).padStart(2, "0");
              const dd = String(dia).padStart(2, "0");
              const fechaStr = `${year}-${mm}-${dd}`;
              const esSeleccionado = value === fechaStr;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => seleccionarDia(dia)}
                  className={`p-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    esSeleccionado
                      ? "bg-[#00FF9D] text-slate-950 font-black shadow-xs"
                      : "hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GráficoDona({ datos }) {
  const total = datos.reduce((acc, d) => acc + d.monto, 0);
  
  if (total <= 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs font-bold text-slate-400 italic">
        Sin ingresos registrados para graficar.
      </div>
    );
  }

  let acumulado = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-2">
      <div className="relative w-40 h-40 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
          {datos.map((d, i) => {
            if (d.monto <= 0) return null;
            const porcentaje = (d.monto / total) * 100;
            const strokeDasharray = `${porcentaje} ${100 - porcentaje}`;
            const strokeDashoffset = 100 - acumulado;
            acumulado += porcentaje;

            return (
              <circle
                key={i}
                cx="18"
                cy="18"
                r="15.91549430918954"
                fill="transparent"
                stroke={d.color}
                strokeWidth="4"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 hover:opacity-80"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-black uppercase text-slate-400 leading-none">Total</span>
          <span className="text-base font-black text-slate-900 mt-0.5">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-1.5 w-full sm:w-auto">
        {datos.map((d, i) => {
          const pct = total > 0 ? ((d.monto / total) * 100).toFixed(1) : 0;
          return (
            <div key={i} className="flex items-center justify-between gap-4 text-xs font-bold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="text-slate-700">{d.label}:</span>
              </div>
              <div className="text-right">
                <span className="text-slate-900 font-black">${d.monto.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 font-extrabold ml-1.5">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CierreCajaPage() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [tasaBcv, setTasaBcv] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Extraemos manualmente la fecha en formato YYYY-MM-DD sin toLocaleDateString()
  // para evitar problemas si el usuario está en GMT muy distantes
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  
  const [ventas, setVentas] = useState([]);
  const [matches, setMatches] = useState([]);
  
  const [efectivoDeclarado, setEfectivoDeclarado] = useState("");
  const [procesandoCierre, setProcesandoCierre] = useState(false);
  
  const [esCajaCerrada, setEsCajaCerrada] = useState(false);
  const [cierreGuardado, setCierreGuardado] = useState(null);
  const [modalResumenOpen, setModalResumenOpen] = useState(false);
  const [modalConfirmReabrir, setModalConfirmReabrir] = useState(false);
  
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
    if (str.includes("movil") || str.includes("móvil") || str.includes("pago_movil") || str.includes("pago movil") || str.includes("transferencia")) return "pago_movil";
    if (str.includes("punto") || str.includes("pos") || str.includes("card") || str.includes("tarjeta") || str.includes("debito") || str.includes("débito") || str.includes("credito") || str.includes("crédito")) return "punto";
    if (str.includes("efectivo") || str.includes("cash")) return "efectivo";
    return "otro";
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
      (i) => i.item_type === "cancha" || (i.item_name && i.item_name.toLowerCase().includes("reserva"))
    );

    if (!itemCancha) return null;

    if (itemCancha.item_detail && itemCancha.item_detail.includes("MatchID:")) {
      const matchIdExtraido = itemCancha.item_detail.split("MatchID:")[1].split(" ")[0].trim();
      const matchDirecto = matchesList.find(m => String(m.id) === String(matchIdExtraido));
      if (matchDirecto) return matchDirecto;
    }

    const cleanCliente = normalizarTexto(extraerTextoLimpio(itemCancha.item_detail));
    const cleanPista = normalizarTexto(extraerTextoLimpio(itemCancha.item_name));
    const fechaVenta = venta.created_at.substring(0, 10); // "YYYY-MM-DD"

    let bestMatch = null;
    let maxScore = 0;

    for (const m of matchesList) {
      let score = 0;
      const mCliente = normalizarTexto(obtenerNombreClienteMatch(m));
      const mNotes = normalizarTexto(m.notes || "");
      const mCourt = normalizarTexto(m.court?.name || "");
      const mDate = m.scheduled_at.substring(0, 10); // "YYYY-MM-DD"

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

  const cargarDatos = async (fechaSeleccionada) => {
    setLoading(true);
    setErrorNotif("");
    setCierreGuardado(null);
    setEsCajaCerrada(false);
    setModalResumenOpen(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*, club_id")
        .eq("id", user.id)
        .maybeSingle();

      setUserProfile(profile);
      const clubId = profile?.club_id;
      if (!clubId) return setLoading(false);

      const { data: clubData } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", clubId)
        .maybeSingle();

      setClubInfo(clubData);

      // ZONA HORARIA LOCAL EXACTA DENTRO DEL RANGO COMPLETO DEL DÍA FORZADO COMO STRING
      const startOfDay = `${fechaSeleccionada}T00:00:00`;
      const endOfDay = `${fechaSeleccionada}T23:59:59`;

      const { data: sales, error: errSales } = await supabase
        .from("sales")
        .select(`
          id, total_amount, payment_method, exchange_rate, created_at,
          sales_items ( id, item_type, item_name, item_detail, quantity, price_unit )
        `)
        .eq("club_id", clubId)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false });

      if (errSales) console.error("Error sales:", errSales);

      const { data: padelMatches } = await supabase
        .from("matches")
        .select("*, court:courts(name)")
        .eq("club_id", clubId);

      setVentas(sales || []);
      setMatches(padelMatches || []);

      const { data: cierreExistente } = await supabase
        .from("cash_closures")
        .select("*")
        .eq("club_id", clubId)
        .eq("closure_date", fechaSeleccionada)
        .maybeSingle();

      if (cierreExistente) {
        setEsCajaCerrada(true);
        setEfectivoDeclarado(cierreExistente.total_declared ? cierreExistente.total_declared.toString() : "");
        setCierreGuardado({
          ...cierreExistente,
          closure_time: cierreExistente.closure_time || cierreExistente.created_at.substring(11, 16) + " UTC",
          cashier_name: cierreExistente.cashier_name || "Cajero Responsable",
          other_total: cierreExistente.other_total || 0,
          tickets: sales || [],
          inventory_recount: calcularRecuentoInventario(sales || []),
        });
      }

    } catch (error) {
      console.error("Error cargando datos de cierre:", error);
    } finally {
      setLoading(false);
    }
  };

  const calcularRecuentoInventario = (ventasActuales) => {
    const map = {};
    ventasActuales.forEach((venta) => {
      (venta.sales_items || []).forEach((item) => {
        if (item.item_type === "producto" || (item.item_name && item.item_name.toLowerCase().startsWith("extra:"))) {
          const nombreLimpio = item.item_name.replace(/^Extra:\s*/i, "").replace(/^Tienda:\s*/i, "").trim();
          const unitPrice = parseFloat(item.price_unit || 0);
          const key = `${nombreLimpio}_${unitPrice}`;
          const qty = parseFloat(item.quantity || 1);

          if (!map[key]) {
            map[key] = {
              name: nombreLimpio,
              quantity: 0,
              price_unit: unitPrice,
              total: 0,
            };
          }
          map[key].quantity += qty;
          map[key].total += qty * unitPrice;
        }
      });
    });
    return Object.values(map);
  };

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

      const match = encontrarMatchParaVenta(venta, matches);
      let pagosDelTicket = [];

      if (match && Array.isArray(match.payments_history) && match.payments_history.length > 0) {
        pagosDelTicket = match.payments_history.filter(p => p.status === 'aprobado' || !p.status);
      }

      if (pagosDelTicket.length > 0) {
        pagosDelTicket.forEach(pago => {
          const m = normalizarMetodoPago(pago.method || pago.metodo || pago.payment_method);
          const monto = parseFloat(pago.amount || pago.monto) || 0;
          desgloseMetodos[m] = (desgloseMetodos[m] || 0) + monto;
        });
      } else {
        const m = normalizarMetodoPago(venta.payment_method);
        const monto = parseFloat(venta.total_amount) || 0;
        desgloseMetodos[m] = (desgloseMetodos[m] || 0) + monto;
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

  const recuentoInventario = useMemo(() => {
    return calcularRecuentoInventario(ventas);
  }, [ventas]);

  const datosGraficoDona = useMemo(() => {
    const metodos = cierreGuardado
      ? {
          efectivo: cierreGuardado.cash_total,
          zelle: cierreGuardado.zelle_total,
          pago_movil: cierreGuardado.mobile_pay_total,
          punto: cierreGuardado.pos_total,
          otro: cierreGuardado.other_total || 0,
        }
      : resumenFinanciero.desgloseMetodos;

    return [
      { label: "Efectivo", monto: metodos.efectivo, color: "#10B981" },
      { label: "Zelle", monto: metodos.zelle, color: "#3B82F6" },
      { label: "Pago Móvil", monto: metodos.pago_movil, color: "#8B5CF6" },
      { label: "Punto Venta", monto: metodos.punto, color: "#F59E0B" },
      ...(metodos.otro > 0 ? [{ label: "Otros", monto: metodos.otro, color: "#64748B" }] : []),
    ];
  }, [cierreGuardado, resumenFinanciero]);

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
    const match = encontrarMatchParaVenta(venta, matches);
    let pagos = [];

    if (match && Array.isArray(match.payments_history)) {
      pagos = match.payments_history.filter(p => p.status === 'aprobado' || !p.status);
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

      const nombreCajero = userProfile
        ? `${userProfile.nombre || ""} ${userProfile.apellido || ""}`.trim() || userProfile.email || "Cajero Mostrador"
        : "Cajero Mostrador";

      // Formatear hora de cierre sin Timezone local del browser
      const now = new Date();
      const horaStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const datosCierre = {
        club_id: userProfile?.club_id,
        closed_by: user?.id,
        cashier_name: nombreCajero,
        closure_date: fecha,
        closure_time: horaStr,
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
        other_total: resumenFinanciero.desgloseMetodos.otro || 0,
        bcv_rate: tasaBcv,
        sales_count: ventas.length,
        tickets: ventas,
        inventory_recount: recuentoInventario,
        created_at: new Date().toISOString()
      };

      await supabase.from("cash_closures").delete().eq("club_id", datosCierre.club_id).eq("closure_date", fecha);

      await supabase.from("cash_closures").insert({
        club_id: datosCierre.club_id,
        closed_by: datosCierre.closed_by,
        closure_date: datosCierre.closure_date,
        total_system: datosCierre.total_system,
        total_declared: datosCierre.total_declared,
        difference: datosCierre.difference,
        courts_total: datosCierre.courts_total,
        store_total: datosCierre.store_total,
        commission_total: datosCierre.commission_total,
        cash_total: datosCierre.cash_total,
        zelle_total: datosCierre.zelle_total,
        mobile_pay_total: datosCierre.mobile_pay_total,
        pos_total: datosCierre.pos_total,
        bcv_rate: datosCierre.bcv_rate,
        sales_count: datosCierre.sales_count,
        created_at: datosCierre.created_at
      });

      setEsCajaCerrada(true);
      setCierreGuardado(datosCierre);
      setModalResumenOpen(true);
    } catch (err) {
      console.error(err);
      setErrorNotif("Error registrando el cierre de caja.");
    } finally {
      setProcesandoCierre(false);
    }
  };

  const reabrirCierreCaja = async () => {
    try {
      setProcesandoCierre(true);
      if (userProfile?.club_id) {
        await supabase
          .from("cash_closures")
          .delete()
          .eq("club_id", userProfile.club_id)
          .eq("closure_date", fecha);
      }
      setEsCajaCerrada(false);
      setCierreGuardado(null);
      setModalConfirmReabrir(false);
    } catch (err) {
      console.error(err);
      setErrorNotif("Error al reabrir la caja.");
    } finally {
      setProcesandoCierre(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #area-impresion-cierre, #area-impresion-cierre * {
            visibility: visible !important;
          }
          #area-impresion-cierre {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 20px !important;
            margin: 0 !important;
            font-family: Arial, sans-serif !important;
          }
          .no-imprimir {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        
        {/* HEADER Y FILTROS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">📠 Cierre de Caja</h1>
              {esCajaCerrada && (
                <span className="bg-emerald-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-sm">
                  🔒 CAJA CERRADA
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Cuadre general de ingresos, desglose real por métodos y auditoría diaria.</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {tasaBcv && (
              <div className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-center shadow-sm border border-slate-200 flex flex-col justify-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tasa BCV</p>
                <p className="text-xs sm:text-sm font-black">Bs. {tasaBcv.toFixed(2)}</p>
              </div>
            )}

            <CustomDarkDatePicker
              value={fecha}
              onChange={(nuevaFecha) => setFecha(nuevaFecha)}
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
            
            <div className="lg:col-span-5 space-y-4">
              
              {esCajaCerrada ? (
                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border-2 border-emerald-400 space-y-5">
                  <div className="text-center space-y-1">
                    <span className="text-3xl block">🔒</span>
                    <h2 className="text-lg font-black text-slate-900">Caja Cerrada Oficialmente</h2>
                    <p className="text-xs font-bold text-slate-500">
                      Fecha: {cierreGuardado?.closure_date} — Hora: {cierreGuardado?.closure_time || "Cierre de Turno"}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 text-center">
                      📊 Distribución por Métodos
                    </p>
                    <GráficoDona datos={datosGraficoDona} />
                  </div>

                  <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs font-bold">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Total Facturado Sistema:</span>
                      <span className="font-black text-white text-sm">${(cierreGuardado?.total_system || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Monto Entregado / Declarado:</span>
                      <span className="font-black text-emerald-400 text-sm">${(cierreGuardado?.total_declared || 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-800 pt-2 flex justify-between items-center font-black">
                      <span className="uppercase text-[10px] text-slate-400">Diferencia:</span>
                      <span className={`text-base ${(cierreGuardado?.difference || 0) < -0.05 ? "text-rose-400" : "text-[#00FF9D]"}`}>
                        {(cierreGuardado?.difference || 0) >= 0 ? "+" : ""}{(cierreGuardado?.difference || 0).toFixed(2)} USD
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setModalResumenOpen(true)}
                      className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black uppercase text-xs tracking-wider rounded-2xl shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      📄 Ver / Imprimir Reporte Oficial
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setModalConfirmReabrir(true)}
                      className="w-full py-2.5 bg-amber-50 text-amber-800 border border-amber-200 font-black uppercase text-[11px] rounded-2xl hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      🔓 Modificar / Reabrir Cierre
                    </button>
                  </div>
                </div>
              ) : (
                <>
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

                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                      💳 Total Ingresado por Métodos Reales
                    </h2>

                    <GráficoDona datos={datosGraficoDona} />

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2">
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
                      {resumenFinanciero.desgloseMetodos.otro > 0 && (
                        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 col-span-2">
                          <span className="text-[10px] font-black text-slate-400 block">💰 OTROS MÉTODOS</span>
                          <span className="text-sm font-black text-slate-900">${resumenFinanciero.desgloseMetodos.otro.toFixed(2)}</span>
                        </div>
                      )}
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
                </>
              )}

            </div>

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
                      
                      // Ajuste de visualización de hora desde la base de datos (string cortado)
                      const horaVenta = venta.created_at.substring(11, 16); // HH:mm

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
                                  ⏰ {horaVenta}
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

      {mounted && modalConfirmReabrir && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-base font-black text-slate-900">¿Modificar cierre del día?</h3>
            <p className="text-xs font-bold text-slate-600">
              Se eliminará el registro de cierre actual de la fecha <strong className="text-slate-900">{fecha}</strong> para permitirte ajustar valores y volver a cerrar.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={reabrirCierreCaja}
                disabled={procesandoCierre}
                className="w-full py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shadow-md cursor-pointer"
              >
                {procesandoCierre ? "Procesando..." : "🔓 Confirmar Reapertura"}
              </button>
              <button
                type="button"
                onClick={() => setModalConfirmReabrir(false)}
                className="w-full py-2.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && modalResumenOpen && cierreGuardado && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setModalResumenOpen(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex justify-between items-start border-b pb-3 no-imprimir">
              <div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                  ✓ CIERRE REGISTRADO CON ÉXITO
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">Reporte de Auditoría de Caja</h2>
                <p className="text-xs font-bold text-slate-400">Previsualización detallada para gerencia.</p>
              </div>
              <button onClick={() => setModalResumenOpen(false)} className="text-slate-400 font-bold text-lg hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div id="area-impresion-cierre" className="space-y-4 text-slate-900">
              
              <div className="text-center border-b border-slate-300 pb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">SPORTS HUB COMPLEX — REPORTE OFICIAL DE CIERRE</p>
                <h1 className="text-2xl font-black uppercase text-slate-900 mt-0.5">{clubInfo?.name || "Club Deportivo Sports Hub"}</h1>
                <div className="flex justify-center items-center gap-4 text-xs font-bold text-slate-600 mt-1">
                  <span>📅 Fecha: {cierreGuardado.closure_date}</span>
                  <span>⏰ Hora: {cierreGuardado.closure_time || "Cierre de Turno"}</span>
                  <span>👤 Responsable: {cierreGuardado.cashier_name}</span>
                </div>
                {cierreGuardado.bcv_rate && (
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                    Tasa Oficial BCV: Bs. {cierreGuardado.bcv_rate.toFixed(2)} / USD
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                  1. Resumen de Ingresos por Categoria
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Ingresos Canchas</span>
                    <span className="text-sm font-black text-slate-900">${cierreGuardado.courts_total.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-400 block">Bs. {(cierreGuardado.courts_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Ventas Tienda POS</span>
                    <span className="text-sm font-black text-slate-900">${cierreGuardado.store_total.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-400 block">Bs. {(cierreGuardado.store_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[9px] uppercase text-slate-500 block">Comisión App</span>
                    <span className="text-sm font-black text-slate-900">${cierreGuardado.commission_total.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-400 block">Bs. {(cierreGuardado.commission_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                  2. Desglose de Dinero Recibido por Método
                </h3>
                <table className="w-full text-xs font-bold text-left border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase">
                    <tr>
                      <th className="p-2 border-b">Método de Pago</th>
                      <th className="p-2 border-b text-right">Monto ($ USD)</th>
                      <th className="p-2 border-b text-right">Equivalente (Bs. VES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2">💵 Efectivo Divisas / Bolívares</td>
                      <td className="p-2 text-right font-black">${cierreGuardado.cash_total.toFixed(2)}</td>
                      <td className="p-2 text-right text-slate-500">Bs. {(cierreGuardado.cash_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">🇺🇸 Zelle (USD)</td>
                      <td className="p-2 text-right font-black">${cierreGuardado.zelle_total.toFixed(2)}</td>
                      <td className="p-2 text-right text-slate-500">Bs. {(cierreGuardado.zelle_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">📱 Pago Móvil (VES)</td>
                      <td className="p-2 text-right font-black">${cierreGuardado.mobile_pay_total.toFixed(2)}</td>
                      <td className="p-2 text-right text-slate-500">Bs. {(cierreGuardado.mobile_pay_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="p-2">💳 Punto de Venta / Tarjeta</td>
                      <td className="p-2 text-right font-black">${cierreGuardado.pos_total.toFixed(2)}</td>
                      <td className="p-2 text-right text-slate-500">Bs. {(cierreGuardado.pos_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</td>
                    </tr>
                    {cierreGuardado.other_total > 0 && (
                      <tr>
                        <td className="p-2">💰 Otros Métodos</td>
                        <td className="p-2 text-right font-black">${cierreGuardado.other_total.toFixed(2)}</td>
                        <td className="p-2 text-right text-slate-500">Bs. {(cierreGuardado.other_total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-300 space-y-2 text-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                  3. Resultado del Arqueo y Cuadre de Caja
                </h3>
                <div className="flex justify-between items-center font-bold">
                  <span>Total Facturado por Sistema:</span>
                  <span className="font-black text-sm">${cierreGuardado.total_system.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span>Monto Declarado Entregado por Cajero:</span>
                  <span className="font-black text-sm">${cierreGuardado.total_declared.toFixed(2)} USD</span>
                </div>
                <div className="border-t border-slate-300 pt-1.5 flex justify-between items-center font-black text-sm">
                  <span className="uppercase text-xs">Diferencia Final (Cuadre):</span>
                  <span className={cierreGuardado.difference < -0.05 ? "text-rose-600" : "text-emerald-700"}>
                    {cierreGuardado.difference >= 0 ? "+" : ""}${cierreGuardado.difference.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {cierreGuardado.tickets && cierreGuardado.tickets.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                    4. Listado de Facturas Procesadas en el Turno ({cierreGuardado.tickets.length})
                  </h3>
                  <table className="w-full text-[10px] text-left border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase">
                      <tr>
                        <th className="p-1.5 border-b">ID Ticket</th>
                        <th className="p-1.5 border-b">Hora</th>
                        <th className="p-1.5 border-b">Método</th>
                        <th className="p-1.5 border-b text-right">Monto USD</th>
                        <th className="p-1.5 border-b text-right">Monto VES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {cierreGuardado.tickets.map((t) => (
                        <tr key={t.id}>
                          <td className="p-1.5 font-mono">#{t.id.split("-")[0].toUpperCase()}</td>
                          <td className="p-1.5">{t.created_at.substring(11, 16)}</td>
                          <td className="p-1.5 uppercase">{t.payment_method || "Efectivo"}</td>
                          <td className="p-1.5 text-right font-black">${parseFloat(t.total_amount || 0).toFixed(2)}</td>
                          <td className="p-1.5 text-right text-slate-500">
                            Bs. {(parseFloat(t.total_amount || 0) * (t.exchange_rate || cierreGuardado.bcv_rate || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                  5. Recuento de Inventario Vendido / Consumido en el Día
                </h3>
                {cierreGuardado.inventory_recount && cierreGuardado.inventory_recount.length > 0 ? (
                  <table className="w-full text-[10px] text-left border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase">
                      <tr>
                        <th className="p-1.5 border-b">Producto / Artículo</th>
                        <th className="p-1.5 border-b text-center">Cant. Consumida</th>
                        <th className="p-1.5 border-b text-right">Precio Unit. ($)</th>
                        <th className="p-1.5 border-b text-right">Total ($ USD)</th>
                        <th className="p-1.5 border-b text-right">Total (Bs. VES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {cierreGuardado.inventory_recount.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-bold">📦 {item.name}</td>
                          <td className="p-1.5 text-center font-black">{item.quantity} und</td>
                          <td className="p-1.5 text-right">${item.price_unit.toFixed(2)}</td>
                          <td className="p-1.5 text-right font-black text-emerald-700">${item.total.toFixed(2)}</td>
                          <td className="p-1.5 text-right text-slate-500">
                            Bs. {(item.total * (cierreGuardado.bcv_rate || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-[11px] font-bold text-slate-400 italic bg-slate-50 p-3 text-center rounded-xl border border-slate-200">
                    No se registraron consumos ni ventas de productos del inventario durante este turno.
                  </p>
                )}
              </div>

            </div>

            <div className="flex gap-3 pt-3 border-t no-imprimir">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-1/2 py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-2xl hover:bg-slate-800 transition-colors shadow-md cursor-pointer"
              >
                🖨️ Imprimir Reporte de Cierre
              </button>
              <button
                type="button"
                onClick={() => setModalResumenOpen(false)}
                className="w-1/2 py-3 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
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