"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

export default function PanelRecepcionPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [duracionTurno, setDuracionTurno] = useState(60);
  
  // Datos del Club
  const [canchas, setCanchas] = useState([]);
  const [partidosHoy, setPartidosHoy] = useState([]);
  const [productos, setProductos] = useState([]);

  // POS / Caja
  const [carrito, setCarrito] = useState([]);
  const [metodoPagoPos, setMetodoPagoPos] = useState("efectivo");
  const [procesando, setProcesando] = useState(false);

  // Arqueo
  const [modalArqueo, setModalArqueo] = useState(false);
  const [ventasHoy, setVentasHoy] = useState({ 
    posTotal: 0, 
    canchasTotal: 0, 
    comisionApp: 0, 
    netoClub: 0, 
    ingresoBruto: 0 
  });

  useEffect(() => {
    cargarDatosRecepcion();
  }, []);

  async function cargarDatosRecepcion() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", authUser.id).single();

      if (!profile?.club_id) return;
      setClubId(profile.club_id);

      // Config Club
      const { data: clubData } = await supabase.from("padel_clubs").select("slot_duration_minutes").eq("id", profile.club_id).single();
      if (clubData?.slot_duration_minutes) setDuracionTurno(clubData.slot_duration_minutes);

      // Canchas
      const { data: courts } = await supabase.from("padel_courts").select("*").eq("club_id", profile.club_id).order("court_number");
      
      // Partidos
      const hoy = new Date().toISOString().split("T")[0];
      const { data: matches } = await supabase.from("padel_matches").select("*, players:padel_match_players(user_id)").eq("club_id", profile.club_id).gte("scheduled_at", `${hoy}T00:00:00`).lte("scheduled_at", `${hoy}T23:59:59`);

      // Inventario
      const { data: inventory } = await supabase.from("products").select("*").eq("club_id", profile.club_id).eq("is_active", true).order("category");

      setCanchas(courts || []);
      setPartidosHoy(matches || []);
      setProductos(inventory || []);

    } catch (error) {
      console.error("Error cargando panel:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- Lógica del Carrito (POS) ---
  const agregarAlCarrito = (producto) => {
    if (producto.stock <= 0) return;
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        if (existe.cantidad >= producto.stock) return prev;
        return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const quitarDelCarrito = (productoId) => setCarrito(prev => prev.filter(item => item.id !== productoId));
  const totalCarrito = carrito.reduce((sum, item) => sum + (item.price * item.cantidad), 0);

  // --- Procesar Venta en BD ---
  async function procesarVenta() {
    if (!clubId || !user || carrito.length === 0) return;
    try {
      setProcesando(true);

      const { error: saleError } = await supabase.from("sales").insert({
        club_id: clubId,
        cashier_id: user.id,
        total_amount: totalCarrito,
        payment_method: metodoPagoPos
      });
      if (saleError) throw saleError;

      for (const item of carrito) {
        const nuevoStock = item.stock - item.cantidad;
        await supabase.from("products").update({ stock: nuevoStock }).eq("id", item.id);
      }

      alert("✅ Venta registrada exitosamente");
      setCarrito([]);
      setMetodoPagoPos("efectivo");
      cargarDatosRecepcion(); 
    } catch (error) {
      alert("Error procesando venta: " + error.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- Generar Arqueo de Caja (CON COMISIONES) ---
  async function abrirArqueo() {
    try {
      const hoy = new Date().toISOString().split("T")[0];
      
      // 1. Ventas del POS (Tienda)
      const { data: ventasPos } = await supabase
        .from("sales")
        .select("total_amount")
        .eq("club_id", clubId)
        .gte("created_at", `${hoy}T00:00:00`)
        .lte("created_at", `${hoy}T23:59:59`);

      let totalPos = 0;
      ventasPos?.forEach(v => { totalPos += parseFloat(v.total_amount); });

      // 2. Ventas de Canchas (Reservas/Jugadores)
      const { data: reservasCanchas } = await supabase
        .from("padel_matches")
        .select("total_price")
        .eq("club_id", clubId)
        .gte("created_at", `${hoy}T00:00:00`)
        .lte("created_at", `${hoy}T23:59:59`);

      let totalCanchas = 0;
      reservasCanchas?.forEach(p => { totalCanchas += parseFloat(p.total_price || 0); });

      // 3. Cálculos de Comisión (Solo para Canchas)
      // Como el precio guardado es el Precio Base + 10%, extraemos la comisión así:
      // Base = Total / 1.10. Comision = Total - Base.
      const baseCanchas = totalCanchas / 1.10;
      const comisionSportsHub = totalCanchas - baseCanchas;

      const ingresoBrutoGeneral = totalPos + totalCanchas;
      const netoParaElClub = ingresoBrutoGeneral - comisionSportsHub;

      setVentasHoy({ 
        posTotal: totalPos, 
        canchasTotal: totalCanchas, 
        comisionApp: comisionSportsHub, 
        netoClub: netoParaElClub, 
        ingresoBruto: ingresoBrutoGeneral 
      });
      
      setModalArqueo(true);
    } catch (error) {
      alert("Error calculando arqueo.");
    }
  }

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Cargando Recepción...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 flex flex-col gap-6">
      
      {/* 🟢 MONITOR DE CANCHAS */}
      <section className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">🎾 Monitor de Pistas</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Turnos de {duracionTurno} min</p>
          </div>
          <button onClick={abrirArqueo} className="bg-slate-900 text-[#00FF9D] text-xs font-black uppercase px-4 py-2 rounded-xl shadow-md hover:bg-slate-800 transition-colors">
            📊 Arqueo de Hoy
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {canchas.map(cancha => {
            const horaActual = new Date().getTime();
            const partidoActual = partidosHoy.find(p => {
              if (p.court_id !== cancha.id) return false;
              const inicio = new Date(p.scheduled_at).getTime();
              const fin = inicio + (duracionTurno * 60000); 
              return horaActual >= inicio && horaActual <= fin;
            });
            const estado = partidoActual ? "ocupada" : "libre";

            return (
              <div key={cancha.id} className={`p-5 rounded-2xl border-2 transition-all ${estado === 'ocupada' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{cancha.name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{cancha.surface_type}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${estado === 'ocupada' ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'}`}>
                    {estado === 'ocupada' ? 'En Juego' : 'Libre'}
                  </span>
                </div>
                {estado === 'ocupada' ? (
                  <div className="bg-white/60 p-3 rounded-xl border border-amber-200/50">
                    <p className="text-xs font-bold text-slate-700">Partido {partidoActual.match_type}</p>
                  </div>
                ) : (
                  <button className="w-full bg-white/60 hover:bg-white text-emerald-700 text-xs font-black uppercase py-2.5 rounded-xl border border-emerald-200/50 transition-colors">
                    Abrir Pista Manualmente
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 🟢 PUNTO DE VENTA (POS) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200">
          <h2 className="text-xl font-black text-slate-900 mb-6">🛒 Catálogo POS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {productos.map(p => (
              <div key={p.id} onClick={() => agregarAlCarrito(p)} className={`p-3 rounded-2xl border transition-all cursor-pointer select-none ${p.stock <= 0 ? 'border-slate-200 bg-slate-50 opacity-50' : 'border-slate-200 hover:border-blue-400 hover:shadow-md bg-white'}`}>
                <div className="h-20 bg-slate-100 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                   {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full object-contain mix-blend-multiply" /> : <span className="text-2xl">{p.is_rental ? '🎾' : '📦'}</span>}
                </div>
                <p className="text-xs font-black text-slate-900 leading-tight truncate">{p.name}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-black text-emerald-600">${p.price.toFixed(2)}</span>
                  <span className="text-[10px] font-bold text-slate-400">Disp: {p.stock}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CAJA / TICKET */}
        <div className="bg-slate-900 rounded-3xl p-5 sm:p-7 shadow-xl text-white flex flex-col h-[550px]">
          <h2 className="text-lg font-black text-white border-b border-slate-800 pb-4 mb-4">Caja Registradora</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 [&::-webkit-scrollbar]:hidden">
            {carrito.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl">
                <div className="flex-1">
                  <p className="text-xs font-bold text-white truncate max-w-[120px]">{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">${item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black bg-slate-700 px-2 py-1 rounded">x{item.cantidad}</span>
                  <span className="text-sm font-black text-[#00FF9D]">${(item.price * item.cantidad).toFixed(2)}</span>
                  <button onClick={() => quitarDelCarrito(item.id)} className="text-rose-400">✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-4 mt-4 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Método de Pago</p>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setMetodoPagoPos('efectivo')} className={`py-2 text-xs font-bold rounded-lg border-2 ${metodoPagoPos === 'efectivo' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 text-slate-400'}`}>💵 Efec.</button>
                <button onClick={() => setMetodoPagoPos('zelle')} className={`py-2 text-xs font-bold rounded-lg border-2 ${metodoPagoPos === 'zelle' ? 'border-purple-500 bg-purple-500/10 text-purple-400' : 'border-slate-700 text-slate-400'}`}>🇺🇸 Zelle</button>
                <button onClick={() => setMetodoPagoPos('pago_movil')} className={`py-2 text-xs font-bold rounded-lg border-2 ${metodoPagoPos === 'pago_movil' ? 'border-sky-500 bg-sky-500/10 text-sky-400' : 'border-slate-700 text-slate-400'}`}>📱 PM</button>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <span className="text-xs font-black text-slate-400 uppercase">Total Venta</span>
              <span className="text-3xl font-black text-white">${totalCarrito.toFixed(2)}</span>
            </div>
            
            <button 
              onClick={procesarVenta}
              disabled={carrito.length === 0 || procesando}
              className="w-full bg-[#00FF9D] text-slate-950 font-black uppercase py-4 rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {procesando ? "Cobrando..." : "Cobrar Venta"}
            </button>
          </div>
        </div>
      </section>

      {/* MODAL DE ARQUEO DE CAJA */}
      {modalArqueo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalArqueo(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in" onClick={e => e.stopPropagation()}>
            <div className="text-center border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-2xl font-black text-slate-900">Arqueo del Día</h2>
              <p className="text-xs font-bold text-slate-400 mt-1">{new Date().toLocaleDateString()}</p>
            </div>
            
            {/* Ingresos Brutos */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-600">🛍️ Ventas Tienda (POS)</span>
                <span className="font-black text-slate-900">${ventasHoy.posTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-600">🎾 Reservas de Pistas</span>
                <span className="font-black text-slate-900">${ventasHoy.canchasTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-black text-slate-400 uppercase">Ingresos Brutos</span>
                <span className="text-sm font-black text-slate-900">${ventasHoy.ingresoBruto.toFixed(2)}</span>
              </div>
            </div>

            {/* Comisión */}
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-black text-rose-800 block">Comisión SPORTS-HUB</span>
                  <span className="text-[9px] font-bold text-rose-500">10% solo en pistas</span>
                </div>
                <span className="text-sm font-black text-rose-600">-${ventasHoy.comisionApp.toFixed(2)}</span>
              </div>
            </div>

            {/* Total Neto para el Club */}
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
              <span className="text-sm font-black text-emerald-800 uppercase">Neto Club</span>
              <span className="text-2xl font-black text-emerald-700">${ventasHoy.netoClub.toFixed(2)}</span>
            </div>
            
            <button onClick={() => setModalArqueo(false)} className="w-full bg-slate-900 text-white font-black uppercase py-3 rounded-xl mt-4 hover:bg-slate-800">
              Cerrar Resumen
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
