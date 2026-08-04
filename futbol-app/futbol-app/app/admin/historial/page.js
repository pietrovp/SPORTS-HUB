"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function HistorialVentasPage() {
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [clubId, setClubId] = useState(null);
  const [tasaBCV, setTasaBCV] = useState(null); // NUEVO: Estado para Tasa BCV
  
  // Estado para el acordeón de detalles
  const [ventaExpandida, setVentaExpandida] = useState(null);

  useEffect(() => {
    cargarHistorial();
    obtenerTasaBCV(); // Llamamos al BCV al abrir el historial
  }, []);

  // --- OBTENER TASA BCV ---
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
      setTasaBCV(36.65); // Tasa de emergencia
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

      // Traer todas las ventas CON SUS DETALLES
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

  const formatearFecha = (fechaStr) => {
    const opciones = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    return new Date(fechaStr).toLocaleDateString("es-VE", opciones);
  };

  const iconPago = (metodo) => {
    switch (metodo) {
      case 'efectivo': return '💵 Efectivo';
      case 'zelle': return '🇺🇸 Zelle';
      case 'pago_movil': return '📱 Pago Móvil';
      case 'punto': return '💳 Punto de Venta';
      default: return '💰 Otro';
    }
  };

  const toggleExpandir = (id) => {
    if (ventaExpandida === id) {
      setVentaExpandida(null);
    } else {
      setVentaExpandida(id);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Cargando Historial...</div>;
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-end bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900">🧾 Historial de Tickets</h1>
            <p className="text-sm text-slate-500 font-medium">Revisa todos los cobros (montos netos para el club) realizados en Recepción.</p>
          </div>
          <div className="flex gap-4">
            {tasaBCV && (
              <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-center shadow-sm border border-slate-200 flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasa BCV</p>
                <p className="text-sm font-black">Bs. {tasaBCV.toFixed(2)}</p>
              </div>
            )}
            <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-center shadow-lg flex flex-col justify-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Tickets</p>
              <p className="text-lg font-black text-[#00FF9D]">{ventas.length}</p>
            </div>
          </div>
        </div>

        {/* TABLA DE HISTORIAL */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {ventas.length === 0 ? (
            <div className="p-16 text-center">
              <span className="text-5xl block mb-4">📭</span>
              <p className="text-slate-500 font-bold text-lg">Aún no hay tickets registrados.</p>
              <p className="text-slate-400 text-sm mt-1">Las ventas de la Recepción aparecerán aquí.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 text-[10px] uppercase tracking-widest font-black">
                    <th className="p-4 border-b border-slate-800 rounded-tl-2xl w-10"></th>
                    <th className="p-4 border-b border-slate-800">Ticket ID</th>
                    <th className="p-4 border-b border-slate-800">Fecha y Hora</th>
                    <th className="p-4 border-b border-slate-800">Método de Pago</th>
                    <th className="p-4 border-b border-slate-800 text-right rounded-tr-2xl">Venta Neta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventas.map((venta) => (
                    <React.Fragment key={venta.id}>
                      {/* FILA PRINCIPAL DEL TICKET */}
                      <tr 
                        onClick={() => toggleExpandir(venta.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${ventaExpandida === venta.id ? 'bg-slate-50' : ''}`}
                      >
                        <td className="p-4 text-slate-400 text-center">
                          {ventaExpandida === venta.id ? '▼' : '▶'}
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-900 text-[#00FF9D] text-[10px] font-mono font-black px-2 py-1 rounded-md">
                            #{venta.id.split("-")[0].toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-bold text-slate-700">{formatearFecha(venta.created_at)}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-black text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                            {iconPago(venta.payment_method)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-base font-black text-slate-900 block leading-none">
                            ${parseFloat(venta.total_amount).toFixed(2)}
                          </span>
                          {tasaBCV && (
                            <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                              Bs. {(parseFloat(venta.total_amount) * tasaBCV).toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* FILA DE DETALLES (ACORDEÓN) */}
                      {ventaExpandida === venta.id && (
                        <tr className="bg-slate-50 border-t-0">
                          <td colSpan="5" className="p-0">
                            <div className="p-4 px-12 pb-6 border-b border-slate-200">
                              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 border-b border-slate-200 pb-2">
                                Detalle del Ticket
                              </h4>
                              
                              {(!venta.sales_items || venta.sales_items.length === 0) ? (
                                <p className="text-xs text-slate-500 font-medium italic">Ticket antiguo sin detalles guardados.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {venta.sales_items.map(item => (
                                    <li key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <div className="text-xl">
                                          {item.item_type === 'cancha' ? '🎾' : '🛍️'}
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-slate-900">{item.item_name}</p>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase">{item.item_detail}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          {item.quantity} und x ${parseFloat(item.price_unit).toFixed(2)}
                                        </p>
                                        <p className="text-sm font-black text-emerald-600 block leading-none">
                                          ${(item.quantity * item.price_unit).toFixed(2)}
                                        </p>
                                        {tasaBCV && (
                                          <p className="text-[9px] font-bold text-emerald-600/70 mt-1 block">
                                            Bs. {((item.quantity * item.price_unit) * tasaBCV).toFixed(2)}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}