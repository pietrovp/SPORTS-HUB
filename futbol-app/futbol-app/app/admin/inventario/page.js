"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function InventarioGerenciaPage() {
  const [loading, setLoading] = useState(true);
  const [userClubId, setUserClubId] = useState(null);
  const [productos, setProductos] = useState([]);

  // Estado del Modal de Nuevo Producto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  // Formulario de Nuevo Producto
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    category: "pelotas",
    price: "",
    stock: "",
    image_url: "",
    is_rental: false
  });

  // --- ESTADOS PARA ACTUALIZAR/AJUSTAR STOCK ---
  const [modalStockOpen, setModalStockOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [nuevoStockExacto, setNuevoStockExacto] = useState("");

  useEffect(() => {
    cargarInventario();
  }, []);

  async function cargarInventario() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      if (!profile?.club_id) {
         console.warn("Este usuario no tiene un club asignado");
         return;
      }
      setUserClubId(profile.club_id);

      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("club_id", profile.club_id)
        .order("created_at", { ascending: false });

      setProductos(prods || []);
    } catch (error) {
      console.error("Error cargando inventario:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- FUNCIÓN PARA GUARDAR PRODUCTO NUEVO ---
  async function guardarProducto(e) {
    e.preventDefault();
    if (!userClubId) return;

    try {
      setGuardando(true);
      
      const stockInicial = formData.is_rental ? 999 : parseInt(formData.stock, 10);

      const { error } = await supabase
        .from("products")
        .insert({
          club_id: userClubId,
          name: formData.name,
          brand: formData.brand,
          category: formData.category,
          price: parseFloat(formData.price),
          stock: stockInicial,
          image_url: formData.image_url,
          is_rental: formData.is_rental
        });

      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({ name: "", brand: "", category: "pelotas", price: "", stock: "", image_url: "", is_rental: false });
      cargarInventario();
    } catch (error) {
      alert("Error al guardar producto: " + error.message);
    } finally {
      setGuardando(false);
    }
  }

  // --- FUNCIÓN PARA AJUSTAR EL STOCK AL NÚMERO EXACTO ---
  async function actualizarStock(e) {
    e.preventDefault();
    if (!productoSeleccionado || nuevoStockExacto === "") return;

    try {
      setGuardando(true);
      const stockFinal = parseInt(nuevoStockExacto, 10);

      const { error } = await supabase
        .from("products")
        .update({ stock: stockFinal })
        .eq("id", productoSeleccionado.id);

      if (error) throw error;

      setModalStockOpen(false);
      setNuevoStockExacto("");
      setProductoSeleccionado(null);
      cargarInventario(); 
    } catch (error) {
      alert("Error al actualizar stock: " + error.message);
    } finally {
      setGuardando(false);
    }
  }

  const abrirModalAjuste = (producto) => {
    setProductoSeleccionado(producto);
    setNuevoStockExacto(producto.stock.toString());
    setModalStockOpen(true);
  };
    return (
    <div className="bg-slate-50 min-h-screen w-full">
      {loading ? (
        <div className="p-10 text-center font-bold text-slate-500 animate-pulse">
          Cargando inventario...
        </div>
      ) : (
        <div className="p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* HEADER */}
            <div className="flex justify-between items-end bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div>
                <h1 className="text-2xl font-black text-slate-900">📦 Inventario Deportivo</h1>
                <p className="text-sm text-slate-500 font-medium">Gestiona pelotas, grips y alquiler de palas.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl shadow-md transition-colors"
              >
                + Agregar Artículo
              </button>
            </div>

            {/* LISTA DE PRODUCTOS (GRID) */}
            {productos.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-300">
                <span className="text-4xl block mb-3">🛍️</span>
                <p className="text-slate-500 font-bold">No tienes artículos en inventario.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {productos.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col group">
                    <div className="h-32 w-full bg-slate-100 rounded-xl mb-4 overflow-hidden relative flex items-center justify-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-contain mix-blend-multiply p-2" />
                      ) : (
                        <span className="text-3xl">{p.category === 'alquiler_pala' ? '🎾' : '📦'}</span>
                      )}
                      {p.is_rental && (
                        <span className="absolute top-2 right-2 bg-purple-100 text-purple-700 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                          Alquiler
                        </span>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <span className="text-[10px] font-black uppercase text-blue-500">{p.brand}</span>
                      <h3 className="font-bold text-slate-900 leading-tight mt-0.5">{p.name}</h3>
                      
                      {/* SECCIÓN PRECIO Y STOCK MEJORADA */}
                      <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                        
                        {/* 🔴 LÓGICA DE ALQUILER VS VENTA PARA OCULTAR EL BOTÓN EDITAR */}
                        {p.is_rental ? (
                          <div className="flex-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Disponibilidad</p>
                            <p className="text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-md uppercase tracking-widest inline-block border border-purple-100">
                              Ilimitado
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Actual</p>
                            <div className="flex items-center gap-2">
                              <p className={`text-xl font-black leading-none ${p.stock < 5 ? 'text-rose-500' : 'text-slate-800'}`}>
                                {p.stock}
                              </p>
                              <button 
                                onClick={() => abrirModalAjuste(p)}
                                className="flex items-center gap-1 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-400 hover:text-blue-600 text-[9px] font-black px-2 py-1 rounded-md transition-all shadow-sm group"
                                title="Editar stock"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                </svg>
                                EDITAR
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-right">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Precio</p>
                          <p className="text-xl font-black text-emerald-600 leading-none">${p.price.toFixed(2)}</p>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MODAL DE NUEVO PRODUCTO */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-black text-slate-900">Agregar Artículo</h2>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                <form onSubmit={guardarProducto} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Nombre del Artículo</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Pelotas Premium Pro" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-500" />
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Marca</label>
                      <input required type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Ej: Bullpadel" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-500" />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Categoría</label>
                      <select value={formData.category} onChange={e => {
                        const esAlquiler = e.target.value === 'alquiler_pala';
                        setFormData({
                          ...formData, 
                          category: e.target.value, 
                          is_rental: esAlquiler,
                          stock: esAlquiler ? "999" : formData.stock 
                        });
                      }} className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold outline-none focus:border-blue-500">
                        <option value="pelotas">Pelotas</option>
                        <option value="grips">Overgrips / Accesorios</option>
                        <option value="alquiler_pala">Alquiler de Pala</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Precio ($)</label>
                      <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-500" />
                    </div>

                    {!formData.is_rental && (
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Stock Inicial</label>
                        <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="0" className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-500" />
                      </div>
                    )}

                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">URL de la Imagen (Opcional)</label>
                      <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." className="w-full p-3 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-blue-500" />
                      {formData.image_url && (
                        <div className="mt-2 h-20 w-20 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                          <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain mix-blend-multiply" />
                        </div>
                      )}
                    </div>
                  </div>

                  <button disabled={guardando} type="submit" className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase py-4 rounded-xl mt-4 hover:bg-slate-900 transition-colors disabled:opacity-70">
                    {guardando ? "Guardando..." : "Guardar en Inventario"}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* MODAL DE AJUSTAR STOCK */}
          {modalStockOpen && productoSeleccionado && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-black text-slate-900">Ajustar Stock</h2>
                  <button onClick={() => setModalStockOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
                </div>
                
                <p className="text-sm font-medium text-slate-500 mb-4">
                  Ingresa el número real de unidades de <span className="font-bold text-slate-900">{productoSeleccionado.name}</span> que hay en existencia.
                </p>

                <form onSubmit={actualizarStock}>
                  <div className="mb-4">
                    <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Stock Real Actual</label>
                    <input 
                      required 
                      type="number" 
                      min="0"
                      value={nuevoStockExacto} 
                      onChange={e => setNuevoStockExacto(e.target.value)} 
                      className="w-full p-3 rounded-xl border border-slate-200 text-lg font-black text-center outline-none focus:border-blue-500" 
                    />
                  </div>

                  <button disabled={guardando} type="submit" className="w-full bg-slate-900 text-white font-black uppercase py-4 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-70">
                    {guardando ? "Guardando..." : "Guardar Ajuste"}
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}