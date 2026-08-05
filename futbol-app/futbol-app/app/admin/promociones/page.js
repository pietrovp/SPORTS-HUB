"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function PromocionesPage() {
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState(null);
  const [promociones, setPromociones] = useState([]);
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    price_normal: "",
    price_peak: "",
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

  async function guardarPromocion(e) {
    e.preventDefault();
    if (!clubId) return;

    // Validar fechas
    if (new Date(form.start_date) > new Date(form.end_date)) {
      return alert("La fecha de inicio no puede ser mayor a la fecha de fin.");
    }

    try {
      setGuardando(true);
      const nuevaPromo = {
        club_id: clubId,
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        price_normal: parseFloat(form.price_normal),
        price_peak: parseFloat(form.price_peak),
      };

      const { error } = await supabase.from("padel_promotions").insert([nuevaPromo]);
      if (error) throw error;

      setForm({ name: "", start_date: "", end_date: "", price_normal: "", price_peak: "" });
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
          onClick={() => setModalAbierto(true)}
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
            El sistema está usando tus precios por defecto ($15 normal / $25 hora pico). Crea una promoción para cambiarlos temporalmente en fechas específicas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promociones.map(p => {
            const hoy = new Date().toISOString().split("T")[0];
            const estaActiva = hoy >= p.start_date && hoy <= p.end_date;
            
            return (
              <div key={p.id} className={`bg-white p-5 rounded-2xl border transition-all relative ${estaActiva ? 'border-[#00FF9D] shadow-md' : 'border-slate-200 opacity-70'}`}>
                <button onClick={() => eliminarPromo(p.id)} className="absolute top-4 right-4 text-rose-300 hover:text-rose-500 font-bold">✕</button>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{p.name}</h3>
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
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-slate-100 rounded-xl p-2 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Precio Normal</p>
                    <p className="text-lg font-black text-emerald-600">${p.price_normal.toFixed(2)}</p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-2 text-center bg-amber-50/50">
                    <p className="text-[9px] font-black text-amber-500 uppercase mb-1">Hora Pico</p>
                    <p className="text-lg font-black text-amber-600">${p.price_peak.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR PROMO */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-900">Nueva Promoción</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Los precios cambiarán solos en estas fechas.</p>
            </div>
            
            <form onSubmit={guardarPromocion} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Nuevo Precio (Normal)</label>
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
                  <label className="text-[10px] font-black uppercase text-amber-600 mb-1.5 block">Nuevo Precio (Pico)</label>
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

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalAbierto(false)} className="flex-1 py-3 text-sm font-black text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando} className="flex-1 bg-[#00FF9D] text-slate-900 py-3 text-sm font-black uppercase rounded-xl hover:bg-emerald-400 transition-colors shadow-md disabled:opacity-50">
                  {guardando ? "Guardando..." : "Crear Oferta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}