"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CierreCajaPage() {
  const [loading, setLoading] = useState(true);
  const [tasaBcv, setTasaBcv] = useState(null);
  
  // Fecha seleccionada (por defecto hoy)
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  
  // Datos traídos de Supabase
  const [canchasReservadas, setCanchasReservadas] = useState([]);
  const [ventasTienda, setVentasTienda] = useState([]);
  
  // Para la declaración de caja
  const [efectivoDeclarado, setEfectivoDeclarado] = useState("");

  useEffect(() => {
    cargarDatos(fecha);
    obtenerTasaBcv();
  }, [fecha]);

  const obtenerTasaBcv = async () => {
    try {
      const res = await fetch("/api/bcv");
      if (res.ok) {
        const data = await res.json();
        setTasaBcv(data.usdRate);
      }
    } catch (error) {
      console.error("Error obteniendo tasa BCV:", error);
    }
  };

  const cargarDatos = async (fechaSeleccionada) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .maybeSingle();

      const clubId = profile?.club_id;
      if (!clubId) {
        setLoading(false);
        return;
      }

      const startOfDay = new Date(`${fechaSeleccionada}T00:00:00`).toISOString();
      const endOfDay = new Date(`${fechaSeleccionada}T23:59:59`).toISOString();

      // Reservas de canchas (sin cancelados)
      const { data: matches } = await supabase
        .from("padel_matches")
        .select(`
          id, total_price, scheduled_at, payment_method, payment_status,
          padel_courts ( name )
        `)
        .eq("club_id", clubId)
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay)
        .neq("status", "cancelado")
        .neq("payment_status", "cancelado");

      // Ventas POS + ítems
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          id, total_amount, payment_method, created_at,
          sales_items ( id, item_name, quantity, price_unit )
        `)
        .eq("club_id", clubId)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay);

      setCanchasReservadas(matches || []);
      setVentasTienda(sales || []);
    } catch (error) {
      console.error("Error cargando cierre:", error);
    }
    setLoading(false);
  };

  // Cálculos
  const totalCanchas = canchasReservadas.reduce(
    (acc, curr) => acc + (Number(curr.total_price) || 0),
    0
  );
  const totalTienda = ventasTienda.reduce(
    (acc, curr) => acc + (Number(curr.total_amount) || 0),
    0
  );

  const totalSistema = totalCanchas + totalTienda;
  const comisionSportsHub = totalCanchas * 0.10; // 10% solo sobre canchas

  const declarado = Number(efectivoDeclarado) || 0;
  const diferencia = declarado - totalSistema;

  const diferenciaColor =
    diferencia < 0
      ? "text-rose-500 bg-rose-500/10 border-rose-500/30"
      : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* CABECERA / FILTROS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
            📠 Cierre de Caja
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1 uppercase">
            Cuadre general del día
          </p>
        </div>

        <div className="flex items-center gap-4">
          {tasaBcv && (
            <div className="bg-slate-900 text-[#00FF9D] px-4 py-2 rounded-xl text-xs font-black tracking-widest border border-slate-800">
              TASA BCV: {tasaBcv} Bs
            </div>
          )}
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-4 py-2 bg-slate-100 border border-slate-300 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00FF9D]"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center font-bold text-slate-400 animate-pulse">
          Cargando transacciones del día...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* RESUMEN IZQUIERDA */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                Ingresos del Sistema
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-600">
                    🎾 Canchas
                  </span>
                  <span className="font-black text-slate-900">
                    ${totalCanchas.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-600">
                    📦 Tienda (POS)
                  </span>
                  <span className="font-black text-slate-900">
                    ${totalTienda.toFixed(2)}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-black uppercase text-slate-800">
                    Total Esperado
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-slate-900 block">
                      ${totalSistema.toFixed(2)}
                    </span>
                    {tasaBcv && (
                      <span className="text-[10px] font-bold text-slate-400">
                        ~ {(totalSistema * tasaBcv).toFixed(2)} Bs
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* COMISIÓN */}
            <div className="bg-slate-950 p-5 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">
                ⚡
              </div>
              <h2 className="text-xs font-black text-[#00FF9D] uppercase tracking-widest mb-1">
                Comisión Sports Hub (10%)
              </h2>
              <p className="text-[10px] text-slate-400 font-bold mb-3">
                Aplicado solo sobre reservas de canchas
              </p>
              <p className="text-3xl font-black text-[#00FF9D]">
                ${comisionSportsHub.toFixed(2)}
              </p>
            </div>

            {/* DECLARAR CAJA */}
            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
              <h2 className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-3">
                Declarar Caja
              </h2>
              <p className="text-xs text-indigo-600 mb-3 font-medium">
                Ingresa el total de dinero físico y transferencias que tienes en
                mano.
              </p>
              <input
                type="number"
                placeholder="Ej. 480"
                value={efectivoDeclarado}
                onChange={(e) => setEfectivoDeclarado(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl font-black text-xl text-slate-900 text-center mb-3 outline-none focus:ring-2 focus:ring-indigo-400"
              />

              {efectivoDeclarado !== "" && (
                <div
                  className={`p-3 rounded-xl border flex justify-between items-center ${diferenciaColor}`}
                >
                  <span className="text-xs font-black uppercase">
                    {diferencia < 0 ? "Faltante" : "Sobrante / Cuadrado"}
                  </span>
                  <span className="text-lg font-black">
                    {diferencia < 0 ? "" : "+"}${diferencia.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* DETALLE DERECHA */}
          <div className="lg:col-span-2 space-y-6">
            {/* CANCHAS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Detalle de Canchas
                </h3>
                <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg border text-slate-500">
                  {canchasReservadas.length} reservas
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {canchasReservadas.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400 font-medium text-center">
                    No hay reservas válidas para esta fecha.
                  </p>
                ) : (
                  canchasReservadas.map((cancha) => {
                    const hora = new Date(
                      cancha.scheduled_at
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const courtName = cancha.padel_courts
                      ? cancha.padel_courts.name
                      : "Cancha Eliminada";

                    return (
                      <div
                        key={cancha.id}
                        className="p-4 hover:bg-slate-50 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            🎾 {courtName}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 font-medium">
                            Hora: {hora} • Pago:{" "}
                            {cancha.payment_method || "N/A"} •{" "}
                            <span className="text-emerald-600">
                              {cancha.payment_status}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900">
                            ${Number(cancha.total_price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* TIENDA / POS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Detalle de Tienda (POS)
                </h3>
                <span className="text-xs font-bold bg-white px-2 py-1 rounded-lg border text-slate-500">
                  {ventasTienda.length} ventas
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {ventasTienda.length === 0 ? (
                  <p className="p-5 text-sm text-slate-400 font-medium text-center">
                    No hay ventas en tienda para esta fecha.
                  </p>
                ) : (
                  ventasTienda.map((venta) => {
                    const hora = new Date(
                      venta.created_at
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={venta.id}
                        className="p-4 hover:bg-slate-50 flex justify-between items-start"
                      >
                        <div>
                          <div className="space-y-1 mb-2">
                            {venta.sales_items && venta.sales_items.length > 0 ? (
                              venta.sales_items.map((item) => (
                                <p
                                  key={item.id}
                                  className="font-bold text-slate-800 text-sm flex items-center gap-2"
                                >
                                  <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                                    {item.quantity}x
                                  </span>
                                  {item.item_name}
                                  <span className="text-slate-400 font-normal text-xs">
                                    (
                                    {(
                                      Number(item.price_unit) || 0
                                    ).toFixed(2)}{" "}
                                    c/u)
                                  </span>
                                </p>
                              ))
                            ) : (
                              <p className="font-bold text-slate-800 text-sm">
                                Producto sin detalle
                              </p>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium">
                            Hora: {hora} • Método: {venta.payment_method}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="font-black text-slate-900">
                            ${Number(venta.total_amount).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
