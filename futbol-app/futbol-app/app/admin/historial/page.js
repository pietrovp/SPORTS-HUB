"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function HistorialVentasPage() {
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [clubId, setClubId] = useState(null);
  const [tasaBCV, setTasaBCV] = useState(null);
  
  const [ventaExpandida, setVentaExpandida] = useState(null);
  const [diasExpandidos, setDiasExpandidos] = useState([]);

  // Calculamos cómo se llama "Hoy" para compararlo luego
  const hoyStr = new Date().toLocaleDateString("es-VE", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hoyFormateado = hoyStr.charAt(0).toUpperCase() + hoyStr.slice(1);

  useEffect(() => {
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
      setClubId(profile.club_id);

      const { data: historialVentas, error } = await supabase
        .from("sales")
        .select(`
          *,
          sales_items (*)
        `)
        .eq("club_id", profile.club_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setVentas(historialVentas || []);
    } catch (error) {
      console.error("Error cargando el historial:", error);
    } finally {
      setLoading(false);
    }
  }

  const iconPago = (metodo) => {
    switch (metodo) {
      case 'efectivo': return '💵 Efectivo';
      case 'zelle': return '🇺🇸 Zelle';
      case 'pago_movil': return '📱 Pago Móvil';
      case 'punto': return '💳 Punto Venta';
      default: return '💰 Otro';
    }
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

  const ventasAgrupadas = ventas.reduce((acc, venta) => {
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

  useEffect(() => {
    if (ventasAgrupadas.length > 0 && diasExpandidos.length === 0) {
      setDiasExpandidos([ventasAgrupadas[0].fecha]);
    }
  }, [ventasAgrupadas, diasExpandidos.length]);

  // 🔴 LÓGICA DINÁMICA: Calcula cuántos tickets hay en los días que el usuario tiene abiertos
  const ticketsVisibles = ventasAgrupadas
    .filter(grupo => diasExpandidos.includes(grupo.fecha))
    .reduce((total, grupo) => total + grupo.tickets.length, 0);

  // Textito dinámico para el cuadrito negro
  const textoTickets = diasExpandidos.length === 1 && diasExpandidos[0] === hoyFormateado 
    ? "Tickets de Hoy" 
    : "Tickets Visibles";

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Cargando Historial...</div>;
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-end bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900">🧾 Historial de Tickets</h1>
            <p className="text-sm text-slate-500 font-medium">Revisa todos los cobros realizados en Recepción agrupados por día.</p>
          </div>
          <div className="flex gap-4">
            {tasaBCV && (
              <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-center shadow-sm border border-slate-200 flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasa de Hoy</p>
                <p className="text-sm font-black">Bs. {tasaBCV.toFixed(2)}</p>
              </div>
            )}
            {/* CUADRO NEGRO DINÁMICO */}
            <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-center shadow-lg flex flex-col justify-center transition-all duration-300 min-w-[130px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{textoTickets}</p>
              <p className="text-lg font-black text-[#00FF9D]">{ticketsVisibles}</p>
            </div>
          </div>
        </div>

        {/* LISTA DE HISTORIAL AGRUPADO */}
        {ventasAgrupadas.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center">
            <span className="text-5xl block mb-4">📭</span>
            <p className="text-slate-500 font-bold text-lg">Aún no hay tickets registrados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ventasAgrupadas.map((grupo) => {
              const estaAbierto = diasExpandidos.includes(grupo.fecha);
              const totalDia = grupo.tickets.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
              const esHoy = grupo.fecha === hoyFormateado;

              return (
                <div key={grupo.fecha} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                  
                  <button 
                    onClick={() => toggleDia(grupo.fecha)}
                    className="w-full flex items-center justify-between p-5 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${estaAbierto ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {estaAbierto ? '▼' : '▶'}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black text-slate-900 leading-none mb-1">📅 {grupo.fecha}</h3>
                          {esHoy && <span className="bg-[#00FF9D]/20 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Hoy</span>}
                        </div>
                        <p className="text-xs font-bold text-slate-400">{grupo.tickets.length} tickets registrados</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Venta Neta del Día</p>
                      <p className="text-lg font-black text-emerald-600 leading-none">${totalDia.toFixed(2)}</p>
                    </div>
                  </button>

                  {estaAbierto && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4">
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-950 text-slate-300 text-[10px] uppercase tracking-widest font-black">
                                <th className="p-3 border-b border-slate-800 w-10 text-center">Det.</th>
                                <th className="p-3 border-b border-slate-800">Ticket ID</th>
                                <th className="p-3 border-b border-slate-800">Hora</th>
                                <th className="p-3 border-b border-slate-800">Método de Pago</th>
                                <th className="p-3 border-b border-slate-800 text-right">Monto</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {grupo.tickets.map((venta) => {
                                const tasaAplicar = venta.exchange_rate ? venta.exchange_rate : (esHoy ? tasaBCV : null);

                                return (
                                  <React.Fragment key={venta.id}>
                                    <tr 
                                      onClick={() => toggleExpandirTicket(venta.id)}
                                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${ventaExpandida === venta.id ? 'bg-slate-50' : ''}`}
                                    >
                                      <td className="p-3 text-slate-400 text-center text-xs">
                                        {ventaExpandida === venta.id ? '▼' : '▶'}
                                      </td>
                                      <td className="p-3">
                                        <span className="bg-slate-900 text-[#00FF9D] text-[9px] font-mono font-black px-2 py-1 rounded-md">
                                          #{venta.id.split("-")[0].toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <p className="text-xs font-bold text-slate-700">
                                          {new Date(venta.created_at).toLocaleTimeString("es-VE", { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </p>
                                      </td>
                                      <td className="p-3">
                                        <span className="text-[10px] font-black text-slate-600 bg-white px-2 py-1 rounded-full border border-slate-200 shadow-sm whitespace-nowrap">
                                          {iconPago(venta.payment_method)}
                                        </span>
                                      </td>
                                      <td className="p-3 text-right">
                                        <span className="text-sm font-black text-slate-900 block leading-none">
                                          ${parseFloat(venta.total_amount).toFixed(2)}
                                        </span>
                                        {tasaAplicar ? (
                                          <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                                            Bs. {(parseFloat(venta.total_amount) * tasaAplicar).toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-[8px] font-bold text-slate-300 mt-1 block">
                                            Tasa no guardada
                                          </span>
                                        )}
                                      </td>
                                    </tr>

                                    {ventaExpandida === venta.id && (
                                      <tr className="bg-slate-50 border-t-0">
                                        <td colSpan="5" className="p-0">
                                          <div className="p-4 px-10 pb-5 border-b border-slate-200">
                                            <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2 border-b border-slate-200 pb-1">
                                              Detalle del Ticket
                                            </h4>
                                            
                                            {(!venta.sales_items || venta.sales_items.length === 0) ? (
                                              <p className="text-xs text-slate-500 font-medium italic">Sin detalles.</p>
                                            ) : (
                                              <ul className="space-y-2">
                                                {venta.sales_items.map(item => (
                                                  <li key={item.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                      <div className="text-base">
                                                        {item.item_type === 'cancha' ? '🎾' : '🛍️'}
                                                      </div>
                                                      <div>
                                                        <p className="text-[11px] font-bold text-slate-900">{item.item_name}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{item.item_detail}</p>
                                                      </div>
                                                    </div>
                                                    <div className="text-right">
                                                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {item.quantity} und x ${parseFloat(item.price_unit).toFixed(2)}
                                                      </p>
                                                      <p className="text-xs font-black text-emerald-600 block leading-none mt-0.5">
                                                        ${(item.quantity * item.price_unit).toFixed(2)}
                                                      </p>
                                                      {tasaAplicar && (
                                                        <p className="text-[8px] font-bold text-emerald-600/60 mt-1 block">
                                                          Bs. {((item.quantity * item.price_unit) * tasaAplicar).toFixed(2)}
                                                        </p>
                                                      )}
                                                    </div>
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
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
    </div>
  );
}