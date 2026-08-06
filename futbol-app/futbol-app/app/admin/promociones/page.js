"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PromocionesPage() {
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState(null);
  const [promociones, setPromociones] = useState([]);
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    price_normal: "",
    price_peak: "",
    time_blocks: [], 
  });

  useEffect(() => {
    cargarPromociones();
  }, []);

  async function cargarPromociones() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("club_id").eq("id", user.id).single();
      if (!profile?.club_id) return;
      setClubId(profile.club_id);

      const { data: promos } = await supabase
        .from("padel_promotions")
        .select("*")
        .eq("club_id", profile.club_id)
        .order("start_date", { ascending: true });

      setPromociones(promos || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const agregarBloque = () => {
    setForm({
      ...form,
      time_blocks: [
        ...form.time_blocks,
        { start_time: "07:00", end_time: "09:00", price: "" }
      ]
    });
  };

  const actualizarBloque = (index, field, value) => {
    const nuevosBloques = [...form.time_blocks];
    nuevosBloques[index][field] = value;
    setForm({ ...form, time_blocks: nuevosBloques });
  };

  const eliminarBloque = (index) => {
    const nuevosBloques = form.time_blocks.filter((_, i) => i !== index);
    setForm({ ...form, time_blocks: nuevosBloques });
  };

  const abrirModal = (promo = null) => {
    if (promo) {
      setEditandoId(promo.id);
      setForm({
        name: promo.name,
        start_date: promo.start_date,
        end_date: promo.end_date,
        price_normal: promo.price_normal || "",
        price_peak: promo.price_peak || "",
        time_blocks: promo.time_blocks || [],
      });
    } else {
      setEditandoId(null);
      setForm({ name: "", start_date: "", end_date: "", price_normal: "", price_peak: "", time_blocks: [] });
    }
    setModalAbierto(true);
  };

  async function guardarPromocion(e) {
    e.preventDefault();
    if (!clubId) return;

    if (new Date(form.start_date) > new Date(form.end_date)) {
      return alert("La fecha de inicio no puede ser mayor a la fecha de fin.");
    }

    for (const b of form.time_blocks) {
      if (!b.start_time || !b.end_time || !b.price) {
        return alert("Todos los campos de los bloques horarios son obligatorios.");
      }
    }

    try {
      setGuardando(true);
      const promoData = {
        club_id: clubId,
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        price_normal: parseFloat(form.price_normal) || 0,
        price_peak: parseFloat(form.price_peak) || 0,
        time_blocks: form.time_blocks.map(b => ({
          ...b,
          price: parseFloat(b.price)
        }))
      };

      if (editandoId) {
        const { error } = await supabase.from("padel_promotions").update(promoData).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("padel_promotions").insert([promoData]);
        if (error) throw error;
      }

      setModalAbierto(false);
      cargarPromociones();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPromo(id) {
    if (!window.confirm("¿Eliminar esta promoción? Los precios volverán a la normalidad.")) return;
    try {
      await supabase.from("padel_promotions").delete().eq("id", id);
      cargarPromociones();
    } catch (error) {
      alert("Error eliminando promoción");
    }
  }

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Cargando Promociones...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col gap-6">
      
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900">🎁 Promociones y Precios</h1>
          <p className="text-xs font-bold text-slate-500 mt-1">Configura ofertas temporales para tus pistas</p>
        </div>
        <button 
          onClick={() => abrirModal()}
          className="bg-slate-900 text-[#00FF9D] text-xs font-black uppercase px-5 py-3 rounded-xl shadow-md hover:bg-slate-800 transition-colors"
        >
          + Crear Promoción
        </button>
      </div>

      {promociones.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center shadow-sm">
          <span className="text-5xl mb-4">🏷️</span>
          <h3 className="text-lg font-black text-slate-900">No tienes promociones activas</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            El sistema está usando tus precios por defecto. Crea una promoción para cambiarlos temporalmente por bloques de horas o días enteros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promociones.map(p => {
            const hoy = new Date().toISOString().split("T")[0];
            const estaActiva = hoy >= p.start_date && hoy <= p.end_date;
            const hasBlocks = p.time_blocks && p.time_blocks.length > 0;
            
            return (
              <div key={p.id} className={`bg-white p-5 rounded-2xl border transition-all relative ${estaActiva ? 'border-[#00FF9D] shadow-md' : 'border-slate-200 opacity-70'}`}>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => abrirModal(p)} className="text-blue-400 hover:text-blue-600 font-bold text-xs bg-blue-50 px-2 py-1 rounded">Editar</button>
                  <button onClick={() => eliminarPromo(p.id)} className="text-rose-400 hover:text-rose-600 font-bold text-xs bg-rose-50 px-2 py-1 rounded">✕</button>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight pr-16">{p.name}</h3>
                    {estaActiva ? (
                      <span className="text-[9px] font-black uppercase bg-[#00FF9D]/20 text-emerald-800 px-2 py-0.5 rounded text-left inline-block mt-0.5">En Curso Hoy</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-left inline-block mt-0.5">Programada</span>
                    )}
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Desde</span>
                    <span className="font-black text-slate-700">{p.start_date}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Hasta</span>
                    <span className="font-black text-slate-700">{p.end_date}</span>
                  </div>
                </div>
                                {hasBlocks ? (
                   <div className="space-y-1">
                     <p className="text-[9px] font-black text-slate-400 uppercase mb-1 border-b pb-1">Bloques Horarios ({p.time_blocks.length})</p>
                     <div className="max-h-24 overflow-y-auto pr-1">
                       {p.time_blocks.map((b, i) => (
                         <div key={i} className="flex justify-between items-center text-xs bg-slate-50 p-1.5 rounded mb-1 border border-slate-100">
                           <span className="font-bold text-slate-600">{b.start_time} - {b.end_time}</span>
                           <span className="font-black text-emerald-600">${b.price.toFixed(2)}</span>
                         </div>
                       ))}
                     </div>
                     <p className="text-[8px] text-slate-400 font-bold mt-1 text-center">Fuera de estos bloques aplica el precio normal de la cancha.</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border border-slate-100 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Precio Promo</p>
                      <p className="text-lg font-black text-emerald-600">${p.price_normal.toFixed(2)}</p>
                    </div>
                    <div className="border border-slate-100 rounded-xl p-2 text-center bg-amber-50/50">
                      <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Hora Pico Promo</p>
                      <p className="text-lg font-black text-amber-600">${p.price_peak.toFixed(2)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR/EDITAR PROMO */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-lg shadow-2xl my-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-6 flex justify-between items-center border-b pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">{editandoId ? "Editar Promoción" : "Nueva Promoción"}</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Configura las fechas y los bloques de precios.</p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={guardarPromocion} className="space-y-5">
              {/* DATOS BÁSICOS */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Nombre del Evento</label>
                  <input 
                    required type="text" placeholder="Ej: Especial Semana Santa"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#00FF9D] outline-none text-sm font-bold"
                    value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Fecha Inicio</label>
                    <input 
                      required type="date"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#00FF9D] outline-none text-sm font-bold"
                      value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Fecha Fin</label>
                    <input 
                      required type="date"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#00FF9D] outline-none text-sm font-bold"
                      value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* PESTAÑAS SIMULADAS: GLOBAL VS BLOQUES */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-black text-slate-800">Precios de la Promoción</h3>
                </div>

                {form.time_blocks.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 font-bold bg-blue-50 p-2 rounded-lg border border-blue-100">
                      💡 <strong>Modo Todo el Día:</strong> Se aplicará este Precio Promo a las horas normales, y la Hora Pico Promo a las horas pico definidas por tu club.
                    </p>
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Precio Promo</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">$</span>
                          <input 
                            required type="number" step="0.01" min="0" placeholder="15.00"
                            className="w-full pl-7 pr-3 py-3 rounded-lg border border-slate-200 focus:border-[#00FF9D] outline-none text-sm font-black text-emerald-700"
                            value={form.price_normal} onChange={e => setForm({...form, price_normal: e.target.value})}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-amber-600 mb-1.5 block">Hora Pico Promo</label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">$</span>
                          <input 
                            required type="number" step="0.01" min="0" placeholder="25.00"
                            className="w-full pl-7 pr-3 py-3 rounded-lg border border-amber-200 focus:border-amber-400 outline-none text-sm font-black text-amber-700"
                            value={form.price_peak} onChange={e => setForm({...form, price_peak: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-center pt-2">
                      <span className="text-[10px] text-slate-400 font-bold">¿Prefieres horarios específicos? </span>
                      <button type="button" onClick={agregarBloque} className="text-[10px] font-black text-blue-600 hover:underline">
                        Cambiar a Bloques Horarios
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-500 font-bold bg-amber-50 p-2 rounded-lg border border-amber-100">
                      💡 <strong>Modo Bloques:</strong> En este modo los Precios Globales de arriba se ignoran. Define rangos exactos. Las horas fuera de estos bloques cobrarán la tarifa normal de la cancha.
                    </p>
                    
                    <div className="space-y-2">
                      {form.time_blocks.map((bloque, index) => (
                        <div key={index} className="flex items-end gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 relative">
                          <div className="flex-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Desde</label>
                            <input 
                              type="time" required
                              value={bloque.start_time} onChange={(e) => actualizarBloque(index, 'start_time', e.target.value)}
                              className="w-full p-2 text-xs font-bold border rounded outline-none"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Hasta</label>
                            <input 
                              type="time" required
                              value={bloque.end_time} onChange={(e) => actualizarBloque(index, 'end_time', e.target.value)}
                              className="w-full p-2 text-xs font-bold border rounded outline-none"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[9px] font-black uppercase text-emerald-600 mb-1 block">Precio ($)</label>
                            <input 
                              type="number" step="0.01" min="0" required placeholder="0.00"
                              value={bloque.price} onChange={(e) => actualizarBloque(index, 'price', e.target.value)}
                              className="w-full p-2 text-xs font-black text-emerald-700 border border-emerald-200 rounded outline-none focus:border-emerald-500"
                            />
                          </div>
                          <button type="button" onClick={() => eliminarBloque(index)} className="p-2 mb-0.5 text-rose-400 hover:text-rose-600 font-black text-sm bg-rose-50 rounded">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <button type="button" onClick={agregarBloque} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 font-bold text-xs rounded-xl hover:bg-slate-50">
                      + Agregar otro bloque horario
                    </button>
                    
                    <div className="text-center pt-2">
                      <button type="button" onClick={() => setForm({...form, time_blocks: []})} className="text-[10px] font-black text-rose-500 hover:underline">
                        Cancelar bloques y volver al modo Todo el Día
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 py-3 text-sm font-black text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 bg-[#0B0C15] text-[#00FF9D] py-3 text-sm font-black uppercase rounded-xl hover:bg-slate-900 transition-colors shadow-md disabled:opacity-50">
                  {guardando ? "Guardando..." : (editandoId ? "Actualizar Oferta" : "Crear Oferta")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}