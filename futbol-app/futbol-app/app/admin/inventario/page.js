"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

// COMPONENTE CROPPER CIRCULAR DE IMAGEN (HTML5 CANVAS PURO)
function ModalCropImagen({ imageSrc, onConfirm, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      dibujar();
    };
  }, [imageSrc]);

  useEffect(() => {
    dibujar();
  }, [zoom, offset]);

  const dibujar = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    const size = 280;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // DIBUJAR MÁSCARA CIRCULAR
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    const scale = (size / Math.min(img.width, img.height)) * zoom;
    const w = img.width * scale;
    const h = img.height * scale;

    const x = (size - w) / 2 + offset.x;
    const y = (size - h) / 2 + offset.y;

    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const recortarYConfirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const croppedDataUrl = canvas.toDataURL("image/webp", 0.9);
    onConfirm(croppedDataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-white border border-slate-800 text-center">
        <div>
          <h3 className="text-base font-black text-[#00FF9D] uppercase tracking-wider">Ajustar Imagen del Artículo</h3>
          <p className="text-xs font-bold text-slate-400 mt-1">Arrastra para encuadrar y ajusta el zoom</p>
        </div>

        {/* ÁREA DE ENCUADRE CIRCULAR */}
        <div
          className="relative w-[280px] h-[280px] mx-auto rounded-full overflow-hidden border-4 border-[#00FF9D] shadow-2xl cursor-grab active:cursor-grabbing bg-slate-950 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
        </div>

        {/* CONTROL DE ZOOM */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
            <span>Zoom</span>
            <span>{zoom.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-[#00FF9D] cursor-pointer"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 bg-slate-800 text-slate-300 font-black text-xs uppercase rounded-xl hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={recortarYConfirmar}
            className="w-1/2 py-2.5 bg-[#00FF9D] text-slate-950 font-black text-xs uppercase rounded-xl shadow-md hover:bg-emerald-400 transition-colors"
          >
            ✓ Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventarioGerenciaPage() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userClubId, setUserClubId] = useState(null);
  const [productos, setProductos] = useState([]);

  // FILTROS
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  // MODAL CREAR
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // CATEGORÍA PERSONALIZADA
  const [modoNuevaCategoria, setModoNuevaCategoria] = useState(false);
  const [nuevaCategoriaInput, setNuevaCategoriaInput] = useState("");

  // CROPPER IMAGEN
  const [imagenTempSrc, setImagenTempSrc] = useState(null);
  const [modalCropOpen, setModalCropOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    category: "Pelotas",
    price: "",
    stock: "",
    image_url: "",
    is_rental: false,
  });

  // MODAL AJUSTE STOCK
  const [modalStockOpen, setModalStockOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [nuevoStockExacto, setNuevoStockExacto] = useState("");

  useEffect(() => {
    setMounted(true);
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

      if (!profile?.club_id) return;
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

  // OBTENER LISTA ÚNICA DE CATEGORÍAS
  const categoriasDisponibles = useMemo(() => {
    const fijas = ["Pelotas", "Grips & Accesorios", "Alquiler de Pala"];
    const creadas = productos.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...fijas, ...creadas]));
  }, [productos]);

  // PRODUCTOS FILTRADOS
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      const coincideCat = categoriaFiltro === "todas" || p.category === categoriaFiltro;
      const term = busqueda.toLowerCase();
      const coincideBusqueda =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.brand && p.brand.toLowerCase().includes(term));

      return coincideCat && coincideBusqueda;
    });
  }, [productos, categoriaFiltro, busqueda]);

  // SELECCIÓN DE IMAGEN PARA RECORTAR
  const handleSeleccionarArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return alert("Selecciona un archivo de imagen válido (JPG, PNG).");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagenTempSrc(reader.result);
      setModalCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmarCrop = (croppedDataUrl) => {
    setFormData((prev) => ({ ...prev, image_url: croppedDataUrl }));
    setModalCropOpen(false);
    setImagenTempSrc(null);
  };

  async function guardarProducto(e) {
    e.preventDefault();
    if (!userClubId) return;

    const categoriaFinal = modoNuevaCategoria
      ? nuevaCategoriaInput.trim()
      : formData.category;

    if (!categoriaFinal) {
      return alert("Ingresa o selecciona una categoría para el artículo.");
    }

    try {
      setGuardando(true);

      const stockInicial = formData.is_rental ? 999 : parseInt(formData.stock, 10) || 0;

      const { error } = await supabase.from("products").insert({
        club_id: userClubId,
        name: formData.name.trim(),
        brand: formData.brand.trim(),
        category: categoriaFinal,
        price: parseFloat(formData.price) || 0,
        stock: stockInicial,
        image_url: formData.image_url || null,
        is_rental: formData.is_rental,
      });

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({
        name: "",
        brand: "",
        category: "Pelotas",
        price: "",
        stock: "",
        image_url: "",
        is_rental: false,
      });
      setModoNuevaCategoria(false);
      setNuevaCategoriaInput("");
      cargarInventario();
    } catch (error) {
      alert("Error al guardar producto: " + error.message);
    } finally {
      setGuardando(false);
    }
  }

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

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Cargando inventario...</div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen w-full p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">📦 Inventario Deportivo POS</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Control de stock, alquileres y productos de tienda.</p>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 text-[#00FF9D] font-black text-xs uppercase px-5 py-3 rounded-2xl shadow-md hover:bg-slate-800 transition-all cursor-pointer"
          >
            + Agregar Nuevo Artículo
          </button>
        </div>

        {/* BARRA DE BÚSQUEDA Y CATEGORÍAS */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o marca..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full sm:w-72 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none focus:border-slate-900 shadow-2xs"
          />

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 [scrollbar-width:none]">
            <button
              onClick={() => setCategoriaFiltro("todas")}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all shrink-0 cursor-pointer ${
                categoriaFiltro === "todas" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              Todas ({productos.length})
            </button>

            {categoriasDisponibles.map((cat) => {
              const count = productos.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all shrink-0 cursor-pointer ${
                    categoriaFiltro === cat ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS */}
        {productosFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-2">
            <span className="text-4xl block">🛍️</span>
            <p className="text-slate-500 font-bold text-sm">No se encontraron artículos en el inventario.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {productosFiltrados.map((p) => (
              <div key={p.id} className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between group relative overflow-hidden">
                <div>
                  {/* IMAGEN CIRCULAR RECORTADA O ICONO POR DEFECTO */}
                  <div className="h-32 w-full bg-slate-100 rounded-2xl mb-3 flex items-center justify-center relative overflow-hidden">
                    {p.image_url ? (
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 shadow-inner flex items-center justify-center bg-white">
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-3xl">
                        {p.category === "Alquiler de Pala" || p.is_rental ? "🎾" : "📦"}
                      </div>
                    )}

                    {p.is_rental && (
                      <span className="absolute top-2.5 right-2.5 bg-purple-100 text-purple-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-purple-200">
                        Alquiler
                      </span>
                    )}
                  </div>

                  <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider block">{p.brand || "Generico"}</span>
                  <h3 className="font-black text-slate-900 text-sm leading-snug truncate" title={p.name}>{p.name}</h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">
                    {p.category}
                  </span>
                </div>

                {/* PRECIO Y STOCK */}
                <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100">
                  {p.is_rental ? (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Estado</span>
                      <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md uppercase border border-purple-200">
                        Ilimitado
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Stock Real</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-base font-black ${p.stock < 5 ? "text-rose-600" : "text-slate-900"}`}>
                          {p.stock}
                        </span>
                        <button
                          onClick={() => abrirModalAjuste(p)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                          title="Ajustar stock"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Precio Unit.</span>
                    <span className="text-base font-black text-emerald-600">${parseFloat(p.price || 0).toFixed(2)}</span>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* MODAL CROPPER DE IMAGEN */}
      {modalCropOpen && imagenTempSrc && (
        <ModalCropImagen
          imageSrc={imagenTempSrc}
          onConfirm={handleConfirmarCrop}
          onClose={() => {
            setModalCropOpen(false);
            setImagenTempSrc(null);
          }}
        />
      )}

      {/* MODAL NUEVO ARTÍCULO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Inventario POS
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">Agregar Artículo</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={guardarProducto} className="space-y-4 text-xs font-bold text-slate-700">
              
              {/* SELECCIÓN Y RECORTADOR DE IMAGEN CIRCULAR */}
              <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-300 bg-white shadow-xs flex items-center justify-center relative">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl text-slate-300">📷</span>
                  )}
                </div>

                <label className="bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-[10px] uppercase px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-xs">
                  {formData.image_url ? "🔄 Cambiar Imagen" : "📷 Subir y Recortar Foto"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSeleccionarArchivo}
                    className="hidden"
                  />
                </label>
              </div>

              {/* CAMPOS DEL FORMULARIO */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre del Artículo *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Bote de Pelotas Pro"
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Marca</label>
                  <input
                    required
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Ej. Bullpadel"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Categoría</label>
                  {!modoNuevaCategoria ? (
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        if (e.target.value === "NUEVA") {
                          setModoNuevaCategoria(true);
                        } else {
                          const esAlquiler = e.target.value === "Alquiler de Pala";
                          setFormData({
                            ...formData,
                            category: e.target.value,
                            is_rental: esAlquiler,
                            stock: esAlquiler ? "999" : formData.stock,
                          });
                        }
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:border-slate-900 cursor-pointer"
                    >
                      {categoriasDisponibles.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="NUEVA">➕ Crear nueva categoría...</option>
                    </select>
                  ) : (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="Ej. Bebidas / Ropa"
                        value={nuevaCategoriaInput}
                        onChange={(e) => setNuevaCategoriaInput(e.target.value)}
                        className="w-full p-2 rounded-xl border border-emerald-400 text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setModoNuevaCategoria(false)}
                        className="px-2 bg-slate-200 rounded-xl text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Precio ($ USD) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:border-slate-900"
                  />
                </div>

                {!formData.is_rental && (
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Stock Inicial *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      placeholder="10"
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold outline-none focus:border-slate-900"
                    />
                  </div>
                )}
              </div>

              <button
                disabled={guardando}
                type="submit"
                className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase py-3.5 rounded-2xl shadow-md hover:bg-slate-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "✓ Guardar en Inventario"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTAR STOCK */}
      {modalStockOpen && productoSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setModalStockOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-black text-slate-900">Ajustar Stock Real</h2>
              <button onClick={() => setModalStockOpen(false)} className="text-slate-400 font-bold hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs font-bold text-slate-500 leading-snug">
              Ingresa la cantidad física exacta disponible de <strong className="text-slate-900">{productoSeleccionado.name}</strong>.
            </p>

            <form onSubmit={actualizarStock} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Unidades en Existencia</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={nuevoStockExacto}
                  onChange={(e) => setNuevoStockExacto(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-slate-300 text-xl font-black text-center outline-none focus:border-slate-900"
                />
              </div>

              <button
                disabled={guardando}
                type="submit"
                className="w-full bg-slate-900 text-[#00FF9D] font-black uppercase py-3 rounded-xl shadow-md hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "✓ Actualizar Stock"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}