"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";
import Cropper from "react-easy-crop";

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ==========================================
// FUNCIONES AUXILIARES PARA EL RECORTE DE IMAGEN
// ==========================================
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, "image/jpeg");
  });
}

function formatHora12(hora24) {
  if (!hora24) return "";
  const [h, m] = hora24.split(":");
  const horas = parseInt(h, 10);
  const ampm = horas >= 12 ? "PM" : "AM";
  const h12 = horas % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatFecha(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function AdminCanchasDashboard() {
  const [cargando, setCargando] = useState(true);
  const [usuarioActual, setUsuarioActual] = useState(null);
  
  // Soporte Multicancha
  const [misSedes, setMisSedes] = useState([]);
  const [sedeActiva, setSedeActiva] = useState(null);
  
  // Vistas del Panel
  const [mostrarFormularioSede, setMostrarFormularioSede] = useState(false);
  const [editandoSede, setEditandoSede] = useState(false);
  const [vistaActiva, setVistaActiva] = useState("horarios"); // "horarios" | "reservas"

  const [creando, setCreando] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", direccion: "", zona: "", telefono: "", imagen_url: "" });

  // ESTADOS DEL RECORTADOR DE IMÁGENES
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [blobToUpload, setBlobToUpload] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Estados Horarios y Reservas
  const [franjas, setFranjas] = useState([]);
  const [diaActivo, setDiaActivo] = useState(1); 
  const [creandoFranja, setCreandoFranja] = useState(false);
  const [formFranja, setFormFranja] = useState({ dia_semana: 1, hora_inicio: "18:00", hora_fin: "19:30", precio_creditos: 14 });

  const [partidosReservados, setPartidosReservados] = useState([]);
  const [procesandoCancelacion, setProcesandoCancelacion] = useState(null);

  // 1. Cargar Usuario y Sedes
  useEffect(() => {
    async function cargarDatos() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUsuarioActual(user);
        const { data: sedesData, error } = await supabase
          .from("sedes")
          .select("*")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true });

        if (!error && sedesData && sedesData.length > 0) {
          setMisSedes(sedesData);
          setSedeActiva(sedesData[0]); 
        } else {
          setMostrarFormularioSede(true);
        }
      }
      setCargando(false);
    }
    cargarDatos();
  }, []);

  // 2. Cargar Franjas y Partidos Reservados cuando cambia la Sede Activa
  useEffect(() => {
    async function cargarDatosSede() {
      if (!sedeActiva || !supabase) return;
      
      // Cargar Franjas (Plantillas)
      const { data: franjasData } = await supabase
        .from("franjas_horarias")
        .select("*")
        .eq("sede_id", sedeActiva.id)
        .order("dia_semana", { ascending: true })
        .order("hora_inicio", { ascending: true });
        
      setFranjas(franjasData || []);

      // Cargar Partidos Reales Reservados (Abiertos)
      const { data: partidosData } = await supabase
        .from("partidos")
        .select("*, partido_jugadores(id)")
        .eq("sede_id", sedeActiva.id)
        .eq("estado", "abierto")
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true });

      setPartidosReservados(partidosData || []);
    }
    cargarDatosSede();
  }, [sedeActiva]);

  // --- LÓGICA DE CANCELACIÓN CON DEVOLUCIÓN DE CRÉDITOS ---
  async function cancelarPartidoPorGerente(partido) {
    if (!confirm(`🚨 ¡ALERTA!\n\n¿Estás seguro de cancelar el partido del ${formatFecha(partido.fecha)} a las ${formatHora12(partido.hora)}?\n\nSe le devolverán los créditos automáticamente a todos los jugadores inscritos y el partido desaparecerá.`)) return;

    setProcesandoCancelacion(partido.id);

    try {
      // 1. Obtener todos los jugadores inscritos en este partido específico
      const { data: inscripciones, error: insError } = await supabase
        .from("partido_jugadores")
        .select("id, user_id")
        .eq("partido_id", partido.id);

      if (insError) throw insError;

      // 2. Loop de Devolución: Por cada jugador, reembolsar los créditos
      if (inscripciones && inscripciones.length > 0) {
        const costo = partido.precio_creditos ?? 1;

        for (const inscripcion of inscripciones) {
          const userId = inscripcion.user_id;

          // Obtener perfil actual
          const { data: perfil } = await supabase
            .from("profiles")
            .select("creditos")
            .eq("id", userId)
            .single();

          const creditosActuales = perfil?.creditos ?? 0;
          const nuevoBalance = creditosActuales + costo;

          // Actualizar perfil del jugador
          await supabase
            .from("profiles")
            .update({ creditos: nuevoBalance })
            .eq("id", userId);

          // Registrar la devolución en el Ledger
          await supabase.from("credit_ledger").insert({
            user_id: userId,
            partido_id: partido.id,
            delta: costo,
            reason: "cancellation_by_manager_emergency",
            balance_after: nuevoBalance,
          });
        }

        // Eliminar las inscripciones para limpiar la base de datos
        await supabase.from("partido_jugadores").delete().eq("partido_id", partido.id);
      }

      // 3. Cambiar el estado del partido a "cancelado"
      const { error: updateError } = await supabase
        .from("partidos")
        .update({ estado: "cancelado" })
        .eq("id", partido.id);

      if (updateError) throw updateError;

      // 4. Actualizar la UI localmente
      setPartidosReservados(partidosReservados.filter(p => p.id !== partido.id));
      alert("✅ Partido cancelado correctamente. Los créditos fueron devueltos a los jugadores.");

    } catch (error) {
      console.error("Error al cancelar partido:", error);
      alert("Hubo un error procesando la cancelación y devolución.");
    } finally {
      setProcesandoCancelacion(null);
    }
  }

  // --- LÓGICA DE SELECCIÓN Y RECORTE DE IMAGEN ---
  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener("load", () => setImageSrc(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const confirmarRecorte = async () => {
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      setBlobToUpload(croppedImageBlob);
      setPreviewUrl(URL.createObjectURL(croppedImageBlob));
      setImageSrc(null);
    } catch (e) {
      console.error(e);
      alert("Error al recortar la imagen.");
    }
  };

  // --- GUARDAR SEDE EN BASE DE DATOS Y STORAGE ---
  async function guardarSede(e) {
    e.preventDefault();
    setCreando(true);

    let urlImagenFinal = formData.imagen_url;

    try {
      if (blobToUpload) {
        const fileName = `${usuarioActual.id}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("canchas")
          .upload(fileName, blobToUpload, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from("canchas").getPublicUrl(fileName);
        urlImagenFinal = publicUrl;
      }

      if (editandoSede) {
        const { data: sedeActualizada, error } = await supabase
          .from("sedes")
          .update({
            nombre: formData.nombre,
            direccion: formData.direccion,
            zona: formData.zona,
            telefono: formData.telefono,
            imagen_url: urlImagenFinal,
          })
          .eq("id", sedeActiva.id)
          .select()
          .single();

        if (error) throw error;
        setMisSedes(misSedes.map(s => s.id === sedeActualizada.id ? sedeActualizada : s));
        setSedeActiva(sedeActualizada);
      } else {
        const { data: nuevaSede, error } = await supabase
          .from("sedes")
          .insert({
            owner_id: usuarioActual.id,
            nombre: formData.nombre,
            direccion: formData.direccion,
            zona: formData.zona,
            telefono: formData.telefono,
            imagen_url: urlImagenFinal,
          })
          .select()
          .single();

        if (error) throw error;
        setMisSedes([...misSedes, nuevaSede]);
        setSedeActiva(nuevaSede);
      }

      cerrarFormularioSede();
    } catch (error) {
      console.error(error);
      alert("Error al guardar la sede. Verifica los permisos del Storage.");
    } finally {
      setCreando(false);
    }
  }

  function abrirEdicion() {
    setFormData({
      nombre: sedeActiva.nombre || "",
      direccion: sedeActiva.direccion || "",
      zona: sedeActiva.zona || "",
      telefono: sedeActiva.telefono || "",
      imagen_url: sedeActiva.imagen_url || "",
    });
    setPreviewUrl(sedeActiva.imagen_url || null);
    setBlobToUpload(null);
    setEditandoSede(true);
    setMostrarFormularioSede(true);
  }

  function cerrarFormularioSede() {
    setMostrarFormularioSede(false);
    setEditandoSede(false);
    setFormData({ nombre: "", direccion: "", zona: "", telefono: "", imagen_url: "" });
    setPreviewUrl(null);
    setBlobToUpload(null);
    setImageSrc(null);
  }

  async function agregarFranja(e) {
    e.preventDefault();
    setCreandoFranja(true);
    const { data: nuevaFranja, error } = await supabase
      .from("franjas_horarias")
      .insert({
        sede_id: sedeActiva.id,
        dia_semana: formFranja.dia_semana,
        hora_inicio: formFranja.hora_inicio,
        hora_fin: formFranja.hora_fin,
        precio_creditos: formFranja.precio_creditos,
      })
      .select()
      .single();

    if (!error) {
      const nuevasFranjas = [...franjas, nuevaFranja].sort((a, b) => {
        if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
        return a.hora_inicio.localeCompare(b.hora_inicio);
      });
      setFranjas(nuevasFranjas);
      setDiaActivo(formFranja.dia_semana);
    }
    setCreandoFranja(false);
  }

  async function eliminarFranja(id) {
    if (!confirm("¿Seguro que deseas eliminar esta franja horaria? (Ojo: Esto no elimina reservas que ya hayan sido pagadas para este horario).")) return;
    const { error } = await supabase.from("franjas_horarias").delete().eq("id", id);
    if (!error) setFranjas(franjas.filter((f) => f.id !== id));
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!usuarioActual) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-2xl font-black text-gray-900 mb-2">Acceso Denegado</h1>
        <Link href="/" className="px-6 py-3 bg-[#0B0C15] text-white font-bold rounded-xl">Volver al inicio</Link>
      </div>
    );
  }

  const franjasDelDiaActivo = franjas.filter(f => f.dia_semana === diaActivo);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 overflow-x-hidden w-full relative">
      
      {/* --- MODAL DE RECORTE DE IMAGEN --- */}
      {imageSrc && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="relative flex-1">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="bg-white p-6 flex flex-col gap-4 pb-12">
            <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(e.target.value)} className="w-full accent-[#00FF9D]" />
            <div className="flex gap-3">
              <button onClick={() => setImageSrc(null)} className="flex-1 py-4 font-bold text-gray-600 bg-gray-100 rounded-xl">Cancelar</button>
              <button onClick={confirmarRecorte} className="flex-1 py-4 font-black text-[#0B0C15] bg-[#00FF9D] rounded-xl uppercase tracking-wider">Recortar</button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-100 py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-black text-gray-900 uppercase tracking-tight">Panel B2B</h1>
            <p className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mt-0.5">Gestión de Sedes</p>
          </div>
          <Link href="/futbol" className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg">Volver</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 md:px-4 mt-6 w-full flex flex-col gap-6">
        
        {misSedes.length > 0 && (
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2">
              {misSedes.map((sede) => (
                <button
                  key={sede.id}
                  onClick={() => {
                    setSedeActiva(sede);
                    cerrarFormularioSede();
                    setVistaActiva("horarios");
                  }}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    sedeActiva?.id === sede.id && !mostrarFormularioSede
                    ? "bg-[#0B0C15] text-[#00FF9D] shadow-md"
                    : "bg-transparent text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {sede.nombre}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                cerrarFormularioSede();
                setMostrarFormularioSede(true);
              }}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold border border-dashed transition-all shrink-0 ${
                mostrarFormularioSede && !editandoSede ? "border-[#00FF9D] text-[#00FF9D] bg-emerald-50/50" : "border-gray-300 text-gray-500 hover:bg-gray-50"
              }`}
            >
              + Nueva Sede
            </button>
          </div>
        )}

        {mostrarFormularioSede ? (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 max-w-xl mx-auto w-full">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-gray-900">{editandoSede ? "Editar Complejo" : "Registra un Complejo"}</h2>
              <p className="text-sm text-gray-500 mt-1">{editandoSede ? "Actualiza la información de tu sede." : "Añade los detalles de tu nueva sucursal."}</p>
            </div>
            
            <form onSubmit={guardarSede} className="space-y-4">
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Foto de la Cancha</label>
                <div className="relative w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden hover:border-[#00FF9D]/50 transition-colors group">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      <span className="text-xs font-bold uppercase tracking-wider">Subir Foto (16:9)</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={onFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  
                  {previewUrl && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-0 pointer-events-none">
                      <span className="text-white text-xs font-bold uppercase tracking-wider px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm">Cambiar Foto</span>
                    </div>
                  )}
                </div>
              </div>

              <input required type="text" placeholder="Nombre (Ej: Complejo La 10)" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#00FF9D]" />
              <div className="grid grid-cols-2 gap-4">
                <input required type="text" placeholder="Zona (Ej: Este)" value={formData.zona} onChange={(e) => setFormData({...formData, zona: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#00FF9D]" />
                <input required type="text" placeholder="Teléfono" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#00FF9D]" />
              </div>
              <textarea required rows="2" placeholder="Dirección completa" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#00FF9D]" />
              
              <button disabled={creando} type="submit" className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-wider rounded-xl py-4 hover:bg-gray-900 disabled:opacity-50 transition-colors mt-2">
                {creando ? "Guardando..." : editandoSede ? "Guardar Cambios" : "Crear Complejo"}
              </button>
              {misSedes.length > 0 && (
                <button type="button" onClick={cerrarFormularioSede} className="w-full text-gray-400 text-xs font-bold uppercase tracking-wider py-2 hover:text-gray-600">Cancelar</button>
              )}
            </form>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {sedeActiva?.imagen_url && (
                  <img src={sedeActiva.imagen_url} alt="Cancha" className="w-16 h-16 rounded-2xl object-cover border border-gray-100 shadow-sm shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-none">{sedeActiva?.nombre}</h2>
                    <button onClick={abrirEdicion} title="Editar datos" className="text-gray-300 hover:text-[#00FF9D] hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-xs font-medium">
                    <svg className="w-3.5 h-3.5 text-[#00FF9D] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    {sedeActiva?.zona} • {sedeActiva?.direccion}
                  </div>
                </div>
              </div>
              <span className="bg-[#00FF9D]/10 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-[#00FF9D]/20 self-start md:self-auto shrink-0">Operativa</span>
            </div>

            {/* --- SWITCHER DE VISTAS (HORARIOS vs RESERVAS) --- */}
            <div className="flex gap-2 bg-gray-200/50 p-1 rounded-xl w-fit">
              <button 
                onClick={() => setVistaActiva("horarios")}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${vistaActiva === "horarios" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Gestión de Horarios
              </button>
              <button 
                onClick={() => setVistaActiva("reservas")}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${vistaActiva === "reservas" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Reservas Activas
                {partidosReservados.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${vistaActiva === "reservas" ? "bg-[#00FF9D]/20 text-emerald-700" : "bg-gray-300 text-gray-600"}`}>
                    {partidosReservados.length}
                  </span>
                )}
              </button>
            </div>

            {/* --- VISTA 1: GESTIÓN DE HORARIOS (PLANTILLAS) --- */}
            {vistaActiva === "horarios" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start w-full">
                <div className="md:col-span-4 min-w-0 bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 md:sticky md:top-24 h-fit relative">
                  <h3 className="text-base font-black text-gray-900 mb-4">Añadir Horario Base</h3>
                  <form onSubmit={agregarFranja} className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Día</label>
                      <select value={formFranja.dia_semana} onChange={(e) => { const dia = Number(e.target.value); setFormFranja({...formFranja, dia_semana: dia}); setDiaActivo(dia); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#00FF9D]">
                        {DIAS_SEMANA.map((dia, index) => (<option key={index} value={index}>{dia}</option>))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full">
                      <div className="min-w-0">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Inicio</label>
                        <input type="time" required value={formFranja.hora_inicio} onChange={(e) => setFormFranja({...formFranja, hora_inicio: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#00FF9D]" />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fin</label>
                        <input type="time" required value={formFranja.hora_fin} onChange={(e) => setFormFranja({...formFranja, hora_fin: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#00FF9D]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Costo Total</label>
                      <div className="relative">
                        <input type="number" min="1" required value={formFranja.precio_creditos} onChange={(e) => setFormFranja({...formFranja, precio_creditos: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-16 py-2.5 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#00FF9D]" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">créditos</span>
                      </div>
                    </div>
                    <button disabled={creandoFranja} type="submit" className="w-full mt-2 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-wider rounded-xl py-3 hover:bg-gray-900 disabled:opacity-50 transition-colors text-xs">
                      {creandoFranja ? "..." : "+ Crear Horario"}
                    </button>
                  </form>
                </div>

                <div className="md:col-span-8 min-w-0 bg-white rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100">
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide snap-x w-full">
                    {DIAS_SEMANA.map((dia, index) => {
                      const conteo = franjas.filter(f => f.dia_semana === index).length;
                      const isActive = diaActivo === index;
                      return (
                        <button key={index} onClick={() => { setDiaActivo(index); setFormFranja({...formFranja, dia_semana: index}); }} className={`snap-start shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? "bg-[#0B0C15] text-[#00FF9D] shadow-md" : "bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100"}`}>
                          {dia.slice(0, 3)}
                          {conteo > 0 && <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isActive ? "bg-[#00FF9D]/10 border-[#00FF9D]/30 text-[#00FF9D]" : "bg-white border-gray-200 text-gray-400"}`}>{conteo}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    {franjasDelDiaActivo.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                        <p className="text-gray-400 font-bold text-sm">Sin horarios definidos</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {franjasDelDiaActivo.map((franja) => (
                          <div key={franja.id} className="group flex items-center justify-between bg-white border border-gray-100 hover:border-[#00FF9D]/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md p-3 rounded-xl transition-all gap-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                              <p className="text-base font-black text-gray-800 tabular-nums leading-none">
                                {formatHora12(franja.hora_inicio)} <span className="text-gray-300 font-medium mx-0.5">-</span> {formatHora12(franja.hora_fin)}
                              </p>
                              <span className="text-[10px] font-bold text-[#00FF9D] bg-[#0B0C15] w-fit px-2 py-0.5 rounded uppercase tracking-wide">
                                {franja.precio_creditos} créditos
                              </span>
                            </div>
                            <button onClick={() => eliminarFranja(franja.id)} className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- VISTA 2: RESERVAS REALES --- */}
            {vistaActiva === "reservas" && (
              <div className="bg-white rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100 w-full">
                <h3 className="text-lg font-black text-gray-900 mb-6">Próximos Partidos Reservados</h3>
                
                {partidosReservados.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                    <span className="text-4xl mb-3 block">🏟️</span>
                    <p className="text-gray-500 font-bold text-base">Aún no hay reservas activas en tu complejo.</p>
                    <p className="text-gray-400 text-sm mt-1">Los partidos creados por los jugadores aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partidosReservados.map((partido) => {
                      const jugadoresInscritos = partido.partido_jugadores?.length || 0;
                      return (
                        <div key={partido.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00FF9D]"></div>
                          
                          <div className="flex justify-between items-start pl-2">
                            <div>
                              <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">{formatFecha(partido.fecha)}</p>
                              <p className="text-xl font-black text-gray-900">{formatHora12(partido.hora)}</p>
                            </div>
                            <span className="bg-white border border-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                              {jugadoresInscritos} / {partido.cupos_totales || 14} Inscritos
                            </span>
                          </div>

                          <div className="pl-2 flex gap-2 mt-auto">
                            <button 
                              onClick={() => cancelarPartidoPorGerente(partido)}
                              disabled={procesandoCancelacion === partido.id}
                              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                            >
                              {procesandoCancelacion === partido.id ? "Cancelando..." : "Cancelar por Emergencia"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}