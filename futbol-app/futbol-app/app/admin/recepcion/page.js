"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function RecepcionElite() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [clubId, setClubId] = useState(null);
  
  // Tasa BCV
  const [tasaBCV, setTasaBCV] = useState(null);

  // Configuración Básica
  const [canchas, setCanchas] = useState([]);
  const [partidosHoy, setPartidosHoy] = useState([]);
  const [productos, setProductos] = useState([]);
  
  // ⏳ HORARIOS ELITE
  const duracionTurno = 60; 
  const horaApertura = 7; 
  const horaCierre = 23; 

  // Caja y Cobros
  const [carrito, setCarrito] = useState([]);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [procesando, setProcesando] = useState(false);
  
  // Modales y Cierre de Caja
  const [modalArqueo, setModalArqueo] = useState(false);
  const [modalTienda, setModalTienda] = useState(false);
  const [ventasHoy, setVentasHoy] = useState({ canchasTotal: 0, tiendaTotal: 0, comisionApp: 0, netoClub: 0 });
  
  const [cerrandoCaja, setCerrandoCaja] = useState(false);
  const [efectivoReal, setEfectivoReal] = useState("");

  useEffect(() => {
    cargarDatos();
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
      throw new Error("No devolvió datos válidos");
    } catch (error) {
      console.error("Fallo al obtener BCV:", error);
      setTasaBCV(36.65); 
    }
  }

  async function cargarDatos() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", authUser.id).single();
      if (!profile?.club_id) return;
      setClubId(profile.club_id);

      const { data: courts } = await supabase.from("padel_courts").select("*").eq("club_id", profile.club_id).order("court_number");
      setCanchas(courts || []);

      const hoyStr = new Date().toISOString().split("T")[0];
      const { data: matches } = await supabase.from("padel_matches").select("*").eq("club_id", profile.club_id).gte("scheduled_at", `${hoyStr}T00:00:00`);
      setPartidosHoy(matches || []);

      const { data: inventory } = await supabase.from("products").select("*").eq("club_id", profile.club_id);
      setProductos(inventory || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const calcularPrecioCancha = (hora) => {
    if (hora >= 7 && hora < 17) return 15.00; 
    if (hora >= 17 && hora < 21) return 25.00; 
    if (hora >= 21 && hora <= 23) return 15.00; 
    return 15.00; 
  };

  const generarBloquesHorarios = () => {
    const bloques = [];
    let horaActual = new Date();
    horaActual.setHours(horaApertura, 0, 0, 0);
    const horaFin = new Date();
    horaFin.setHours(horaCierre, 0, 0, 0);

    while (horaActual <= horaFin) { 
      if(horaActual.getHours() === 23 && horaActual.getMinutes() > 0) break; 
      bloques.push({ 
        etiqueta: horaActual.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true }), 
        horaInt: horaActual.getHours(), 
        dateObj: new Date(horaActual) 
      });
      horaActual.setMinutes(horaActual.getMinutes() + duracionTurno);
    }
    return bloques;
  };

  const bloquesHorarios = generarBloquesHorarios();

  const obtenerReserva = (canchaId, bloqueDateObj) => {
    return partidosHoy.find(p => {
      if (p.court_id !== canchaId) return false;
      const t = new Date(p.scheduled_at);
      return t.getHours() === bloqueDateObj.getHours() && t.getMinutes() === bloqueDateObj.getMinutes();
    });
  };

  const agregarCanchaAlTicket = (cancha, bloque) => {
    const idUnico = `res-${cancha.id}-${bloque.etiqueta}`;
    if (carrito.find(i => i.id === idUnico)) return;
    setCarrito(prev => [...prev, {
      id: idUnico, tipo: 'reserva', cancha_id: cancha.id,
      nombre: `Turno ${cancha.name}`, detalle: bloque.etiqueta, fechaObj: bloque.dateObj,
      precio: calcularPrecioCancha(bloque.horaInt), cantidad: 1
    }]);
  };

  // En la tienda ya no bloqueamos por stock 0 si es ALQUILER (porque igual lo puedes alquilar mil veces)
  const agregarProductoAlTicket = (prod) => {
    if (!prod.is_rental && prod.stock <= 0) return alert("Producto sin stock para vender");
    
    setCarrito(prev => {
      const existe = prev.find(i => i.id === `prod-${prod.id}`);
      if (existe) {
        // Si no es alquiler y no hay suficiente stock, no sumar más al carrito
        if (!prod.is_rental && existe.cantidad >= prod.stock) return prev;
        return prev.map(i => i.id === `prod-${prod.id}` ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { 
        id: `prod-${prod.id}`, 
        tipo: 'producto', 
        producto_id: prod.id, 
        nombre: prod.name, 
        detalle: prod.is_rental ? 'Alquiler' : 'Tienda',
        precio: prod.price, 
        cantidad: 1, 
        stock_disp: prod.stock, 
        is_rental: prod.is_rental // 🔴 AQUÍ GUARDAMOS EL BOOLEANO PARA LEERLO AL COBRAR
      }];
    });
  };

  const modificarCantidadProd = (id, delta) => {
    setCarrito(prev => prev.map(i => {
      if (i.id === id) {
        const nuevaCant = i.cantidad + delta;
        if (nuevaCant <= 0) return null;
        // Si no es de alquiler, validar que no supere el stock
        if (!i.is_rental && nuevaCant > i.stock_disp) return i;
        return { ...i, cantidad: nuevaCant };
      }
      return i;
    }).filter(Boolean));
  };

  const quitarDelTicket = (id) => setCarrito(prev => prev.filter(i => i.id !== id));
  
  const totalCobrarUSD = carrito.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
  
  const totalConFeeAlJugador = carrito.reduce((sum, i) => {
    let subtotal = i.precio * i.cantidad;
    if (i.tipo === 'reserva') subtotal = subtotal * 1.10; 
    return sum + subtotal;
  }, 0);
  
  const totalCobrarBs = tasaBCV ? (totalConFeeAlJugador * tasaBCV) : 0;

  async function procesarCobro() {
    if (!clubId || carrito.length === 0) return;
    
    try {
      setProcesando(true);
      
      const { data: ventaCaja, error: errVenta } = await supabase.from("sales").insert({
        club_id: clubId, 
        cashier_id: user.id, 
        total_amount: totalCobrarUSD, 
        payment_method: metodoPago,
        exchange_rate: tasaBCV 
      }).select("id").single();

      if (errVenta) throw new Error("Error creando ticket maestro: " + errVenta.message);

      const idVentaMaestra = ventaCaja.id;

      for (const item of carrito) {
        if (item.tipo === 'reserva') {
          const fechaBd = new Date();
          fechaBd.setHours(item.fechaObj.getHours(), item.fechaObj.getMinutes(), 0, 0);

          const { error: errReserva } = await supabase.from("padel_matches").insert({
            club_id: clubId, 
            court_id: item.cancha_id, 
            scheduled_at: fechaBd.toISOString(),
            total_price: item.precio, 
            match_type: "privado", 
            status: "programado" 
          });

          if (errReserva) throw new Error("Error guardando cancha: " + errReserva.message);

          await supabase.from("sales_items").insert({
            sale_id: idVentaMaestra,
            item_type: 'cancha',
            item_name: item.nombre,
            item_detail: item.detalle,
            quantity: 1,
            price_unit: item.precio 
          });

        } else if (item.tipo === 'producto') {
          
          // 🔴 CORRECCIÓN INFALIBLE: Validamos directo con la propiedad booleana
          if (!item.is_rental) {
            const nuevoStock = item.stock_disp - item.cantidad;
            
            const { error: errProd } = await supabase.from("products")
              .update({ stock: nuevoStock })
              .eq("id", item.producto_id);

            if (errProd) throw new Error("Error descontando inventario: " + errProd.message);
          }

          await supabase.from("sales_items").insert({
            sale_id: idVentaMaestra,
            item_type: 'producto',
            item_name: item.nombre,
            item_detail: item.detalle,
            quantity: item.cantidad,
            price_unit: item.precio
          });
        }
      }

      alert("✅ ¡Cobro registrado exitosamente!");
      setCarrito([]);
      setModalTienda(false);
      window.location.reload(); 
      
    } catch (error) {
      console.error("Fallo general:", error);
      alert("❌ " + error.message);
    } finally {
      setProcesando(false);
    }
  }

  async function calcularArqueo() {
    try {
      const fechaInicio = new Date();
      fechaInicio.setHours(0, 0, 0, 0);
      
      const fechaFin = new Date();
      fechaFin.setHours(23, 59, 59, 999);

      const inicioISO = fechaInicio.toISOString();
      const finISO = fechaFin.toISOString();

      const { data: reservas, error: errRes } = await supabase
        .from("padel_matches")
        .select("total_price")
        .eq("club_id", clubId)
        .gte("created_at", inicioISO)
        .lte("created_at", finISO);
        
      if (errRes) console.error("Error Reservas:", errRes);
      
      let totalPistasBase = 0; 
      reservas?.forEach(r => totalPistasBase += parseFloat(r.total_price || 0));
      
      const { data: ventas, error: errVen } = await supabase
        .from("sales")
        .select(`
          total_amount,
          sales_items (
            item_type,
            quantity,
            price_unit
          )
        `)
        .eq("club_id", clubId)
        .gte("created_at", inicioISO)
        .lte("created_at", finISO);
        
      if (errVen) console.error("Error Ventas:", errVen);

      let totalTienda = 0; 
      ventas?.forEach(v => {
        v.sales_items?.forEach(item => {
          if (item.item_type !== 'cancha') {
            totalTienda += parseFloat(item.price_unit) * item.quantity;
          }
        });
      });

      const comisionApp = totalPistasBase * 0.10; 
      const netoClub = totalPistasBase + totalTienda;

      setVentasHoy({ 
        canchasTotal: totalPistasBase, 
        tiendaTotal: totalTienda, 
        comisionApp: comisionApp, 
        netoClub: netoClub 
      });
      
      setModalArqueo(true);
    } catch (error) { 
      console.error("Error arqueo general:", error);
      alert("Error calculando arqueo."); 
    }
  }

  async function ejecutarCierreDeCaja() {
    if (!efectivoReal || isNaN(efectivoReal)) {
      alert("Por favor ingresa cuánto dinero real tienes en caja.");
      return;
    }

    const confirmar = window.confirm("¿Confirmas el cierre de caja? Esto guardará un registro permanente.");
    if (!confirmar) return;

    try {
      setCerrandoCaja(true);

      const expectedCash = ventasHoy.netoClub + ventasHoy.comisionApp;
      const realCash = parseFloat(efectivoReal);

      const { error } = await supabase.from("cash_registers").insert({
        club_id: clubId,
        opened_by: user.id, 
        closed_by: user.id,
        opening_time: new Date().toISOString(), 
        closing_time: new Date().toISOString(),
        initial_cash: 0.00, 
        expected_cash: expectedCash,
        real_cash: realCash,
        status: "closed"
      });

      if (error) throw error;

      alert("🔒 ¡Cierre de caja guardado exitosamente!");
      setModalArqueo(false);
      setEfectivoReal("");
      window.location.reload(); 
      
    } catch (error) {
      console.error("Error al cerrar caja:", error);
      alert("Error al cerrar caja: " + error.message);
    } finally {
      setCerrandoCaja(false);
    }
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Cargando Agenda...</div>;

  return (
    <div className="flex w-full h-[calc(100vh-1rem)] gap-4 p-4 overflow-hidden bg-slate-50 font-sans">
      
      {/* 🟢 ZONA PRINCIPAL: AGENDA */}
      <div className="flex-[3] flex flex-col min-w-0 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Agenda de Pistas</h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">Selecciona un horario libre para agendar</p>
          </div>
          <div className="flex gap-2">
            <button onClick={calcularArqueo} className="bg-white border-2 border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">📊 Resumen del Día</button>
            <button onClick={() => setModalTienda(true)} className="bg-slate-900 text-[#00FF9D] text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors shadow-md">🏪 Abrir Tienda</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/30 p-4">
          <div className="min-w-[600px] w-full bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-10">
              <div className="w-20 shrink-0 p-3 font-bold text-[10px] text-slate-400 text-center uppercase tracking-widest bg-slate-950">Hora</div>
              {canchas.map(c => <div key={c.id} className="flex-1 p-3 text-center border-l border-slate-800"><p className="font-black text-xs">{c.name}</p></div>)}
            </div>

            {bloquesHorarios.map((bloque, index) => (
              <div key={index} className="flex border-b border-slate-100 hover:bg-slate-50 transition-colors h-[72px]">
                <div className="w-20 shrink-0 flex flex-col items-center justify-center bg-slate-50/50 border-r border-slate-100 p-2 text-center">
                  <span className="text-[11px] font-black text-slate-700 leading-tight">{bloque.etiqueta.split(' ')[0]}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight">{bloque.etiqueta.split(' ')[1]}</span>
                  {bloque.horaInt >= 17 && bloque.horaInt < 21 && <span className="text-[8px] bg-amber-100 text-amber-700 font-bold px-1 rounded mt-1">Pico</span>}
                </div>

                {canchas.map(cancha => {
                  const reservado = obtenerReserva(cancha.id, bloque.dateObj);
                  const idUnico = `res-${cancha.id}-${bloque.etiqueta}`;
                  const enTicket = carrito.some(i => i.id === idUnico);
                  const precioTurno = calcularPrecioCancha(bloque.horaInt);
                  
                  return (
                    <div key={idUnico} className="flex-1 p-1.5 border-l border-slate-100">
                      {reservado ? (
                        <div className="h-full bg-slate-100 rounded-xl p-1 flex flex-col justify-center items-center border border-slate-200 cursor-not-allowed">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Ocupada</p>
                        </div>
                      ) : enTicket ? (
                        <div className="h-full bg-[#00FF9D]/20 rounded-xl flex flex-col items-center justify-center border-2 border-[#00FF9D] p-1">
                          <p className="text-[9px] font-black text-emerald-800 uppercase">En Ticket 👉</p>
                          <p className="text-[10px] font-black text-emerald-900 mt-0.5">${precioTurno}</p>
                        </div>
                      ) : (
                        <button onClick={() => agregarCanchaAlTicket(cancha, bloque)} className="h-full w-full bg-white hover:bg-emerald-50 text-emerald-600 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-emerald-100 hover:border-emerald-400 transition-all group p-1">
                          <span className="text-[10px] font-black opacity-0 group-hover:opacity-100">+ Agendar</span>
                          <span className="text-[9px] font-bold text-emerald-500 opacity-60 group-hover:opacity-100">${precioTurno.toFixed(2)}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🔴 ZONA DERECHA: CAJA REGISTRADORA */}
      <div className="flex-[1] min-w-[280px] max-w-[340px] flex flex-col bg-slate-950 text-white rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">Ticket de Venta</h2>
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs font-medium text-slate-400">Canchas y artículos</p>
            {tasaBCV && <span className="bg-slate-800 text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-700">BCV: Bs.{tasaBCV.toFixed(2)}</span>}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:hidden">
          {carrito.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 opacity-50">
              <span className="text-4xl mb-3">🛒</span>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">El ticket está vacío</p>
            </div>
          ) : (
            carrito.map(item => (
              <div key={item.id} className="bg-slate-900 p-3 rounded-2xl border border-slate-800 relative group">
                <button onClick={() => quitarDelTicket(item.id)} className="absolute top-2 right-2 text-rose-400 hover:text-rose-300 font-bold bg-rose-400/10 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                <p className="text-xs font-black text-[#00FF9D] pr-6">{item.nombre}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.detalle}</p>
                <div className="flex justify-between items-end mt-2">
                  {item.tipo === 'producto' ? (
                    <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                      <button onClick={() => modificarCantidadProd(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 rounded text-xs">-</button>
                      <span className="text-[10px] font-black w-3 text-center">{item.cantidad}</span>
                      <button onClick={() => modificarCantidadProd(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800 rounded text-xs">+</button>
                    </div>
                  ) : (
                    <span className="bg-slate-800 text-slate-300 text-[9px] font-black uppercase px-2 py-0.5 rounded">1 Turno</span>
                  )}
                  <div className="text-right">
                    <p className="text-sm font-black text-white">
                      ${(item.precio * item.cantidad * (item.tipo === 'reserva' ? 1.10 : 1)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-2 tracking-widest">Método de Pago</p>
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {[
              { id: 'efectivo', label: '💵 Efectivo' },
              { id: 'zelle', label: '🇺🇸 Zelle' },
              { id: 'pago_movil', label: '📱 Pago Móvil' },
              { id: 'punto', label: '💳 Punto Venta' }
            ].map(metodo => (
              <button 
                key={metodo.id}
                onClick={() => setMetodoPago(metodo.id)}
                className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase transition-all ${
                  metodoPago === metodo.id 
                    ? 'bg-[#00FF9D] text-slate-950 shadow-[0_0_15px_rgba(0,255,157,0.2)] border-transparent' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {metodo.label}
              </button>
            ))}
          </div>
          
          <div className="flex justify-between items-center mb-4 bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-inner">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total (+Fee)</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-3xl font-black text-[#00FF9D] tracking-tight leading-none mb-0.5">${totalConFeeAlJugador.toFixed(2)}</span>
              {tasaBCV ? (
                <span className="text-[11px] font-black text-slate-300">Bs. {totalCobrarBs.toFixed(2)}</span>
              ) : (
                <span className="text-[9px] text-slate-500">Cargando...</span>
              )}
            </div>
          </div>

          <button disabled={carrito.length === 0 || procesando} onClick={procesarCobro} className="w-full bg-[#00FF9D] hover:bg-emerald-400 text-slate-950 font-black uppercase py-3.5 rounded-2xl transition-all disabled:opacity-50 text-xs tracking-widest shadow-lg">
            {procesando ? "Guardando..." : "Confirmar Venta"}
          </button>
        </div>
      </div>

      {/* 🏪 MODAL TIENDA RÁPIDA */}
      {modalTienda && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalTienda(false)}>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div><h2 className="text-2xl font-black text-slate-900">🏪 Tienda del Club</h2></div>
              <button onClick={() => setModalTienda(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full w-10 h-10 font-black">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {productos.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <span className="text-4xl mb-2 block">📦</span>
                  <p className="text-slate-500 font-bold">No tienes productos a la venta.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {productos.map(p => {
                    // Si NO es alquiler y no hay stock, se deshabilita
                    const deshabilitar = !p.is_rental && p.stock <= 0;
                    return (
                      <button key={p.id} onClick={() => { agregarProductoAlTicket(p); setModalTienda(false); }} disabled={deshabilitar} className="bg-slate-50 border border-slate-100 hover:border-[#00FF9D] hover:bg-[#00FF9D]/5 p-4 rounded-2xl text-center transition-all disabled:opacity-50">
                        <div className="text-3xl mb-2">{p.is_rental ? '🎾' : '🛍️'}</div>
                        <h3 className="text-xs font-black text-slate-900 leading-tight h-8">{p.name}</h3>
                        <div className="mt-2 flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-200">
                          <span className="text-xs font-black text-emerald-600">${p.price.toFixed(2)}</span>
                          {p.is_rental ? (
                            <span className="text-[9px] font-black text-purple-500 uppercase">Alquiler</span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-400">Disp: {p.stock}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARQUEO DE CAJA */}
      {modalArqueo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalArqueo(false)}>
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-1">
              <h2 className="text-2xl font-black text-slate-900">Cierre de Caja</h2>
              {tasaBCV && (
                <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-1 rounded-lg border border-slate-200">
                  Tasa BCV: Bs. {tasaBCV.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-500 mb-6">{new Date().toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-600 text-sm">🎾 Venta Pistas</span>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900 block leading-none">${ventasHoy.canchasTotal.toFixed(2)}</span>
                  {tasaBCV && <span className="text-[10px] font-bold text-slate-400">Bs. {(ventasHoy.canchasTotal * tasaBCV).toFixed(2)}</span>}
                </div>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="font-bold text-slate-600 text-sm">🛍️ Venta Tienda</span>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900 block leading-none">${ventasHoy.tiendaTotal.toFixed(2)}</span>
                  {tasaBCV && <span className="text-[10px] font-bold text-slate-400">Bs. {(ventasHoy.tiendaTotal * tasaBCV).toFixed(2)}</span>}
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100 mt-2">
                <div>
                  <span className="font-bold text-indigo-800 text-xs block">Fee App Recaudado</span>
                  <span className="text-[9px] font-bold text-indigo-500 uppercase">+10% cobrado al jugador</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-indigo-600 block leading-none">+${ventasHoy.comisionApp.toFixed(2)}</span>
                  {tasaBCV && <span className="text-[9px] font-bold text-indigo-400">Bs. {(ventasHoy.comisionApp * tasaBCV).toFixed(2)}</span>}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl flex justify-between items-center shadow-lg">
              <span className="text-sm font-black text-[#00FF9D] uppercase tracking-widest">Esperado en Caja</span>
              <div className="text-right">
                <span className="text-3xl font-black text-white block leading-none">${(ventasHoy.netoClub + ventasHoy.comisionApp).toFixed(2)}</span>
                {tasaBCV && <span className="text-[11px] font-bold text-[#00FF9D]/70">Bs. {((ventasHoy.netoClub + ventasHoy.comisionApp) * tasaBCV).toFixed(2)}</span>}
              </div>
            </div>

            {/* INPUT DE EFECTIVO REAL PARA EL CIERRE DE CAJA */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-6">
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
                ¿Cuánto efectivo real (USD) tienes en caja?
              </label>
              <input 
                type="number" 
                step="0.01"
                value={efectivoReal} 
                onChange={(e) => setEfectivoReal(e.target.value)} 
                placeholder="Ej: 150.00" 
                className="w-full p-3 rounded-xl border border-slate-300 text-lg font-black text-slate-900 outline-none focus:border-indigo-500" 
              />
              {efectivoReal && !isNaN(efectivoReal) && (
                <div className={`mt-2 flex justify-between items-end ${
                  parseFloat(efectivoReal) === (ventasHoy.netoClub + ventasHoy.comisionApp) ? "text-emerald-600" :
                  parseFloat(efectivoReal) > (ventasHoy.netoClub + ventasHoy.comisionApp) ? "text-blue-600" : "text-rose-600"
                }`}>
                  <p className="text-xs font-bold">
                    Diferencia: ${(parseFloat(efectivoReal) - (ventasHoy.netoClub + ventasHoy.comisionApp)).toFixed(2)}
                  </p>
                  {tasaBCV && (
                    <p className="text-[10px] font-bold opacity-80">
                      Bs. {((parseFloat(efectivoReal) - (ventasHoy.netoClub + ventasHoy.comisionApp)) * tasaBCV).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button 
                onClick={ejecutarCierreDeCaja} 
                disabled={cerrandoCaja}
                className="w-full bg-slate-900 text-white font-black uppercase py-4 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {cerrandoCaja ? "Guardando Cierre..." : "🔒 Ejecutar Cierre de Caja"}
              </button>
              <button 
                onClick={() => setModalArqueo(false)} 
                className="w-full bg-slate-100 text-slate-600 font-black uppercase py-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Volver a la Recepción
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}