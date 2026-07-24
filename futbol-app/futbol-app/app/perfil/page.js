"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import Cropper from "react-easy-crop";

// ==========================================
// FUNCIONES AUXILIARES PARA EL RECORTE DE AVATAR (1:1)
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

function iniciales(nombre, apellido) {
  if (!nombre && !apellido) return "?";
  const n = nombre ? nombre[0] : "";
  const a = apellido ? apellido[0] : "";
  return (n + a).toUpperCase() || "?";
}

export default function MiCuentaGlobal() {
  const [perfil, setPerfil] = useState(null);
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(true);
  const [userId, setUserId] = useState(null);
  
  // Validaciones de perfiles deportivos
  const [tienePerfilFutbol, setTienePerfilFutbol] = useState(false);
  const [tienePerfilPadel, setTienePerfilPadel] = useState(false);

  // Estados para subida de foto
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState("");

  // Estados para edición de datos personales
  const [nombreInput, setNombreInput] = useState("");
  const [apellidoInput, setApellidoInput] = useState("");
  const [codigoArea, setCodigoArea] = useState("+58");
  const [telefonoInput, setTelefonoInput] = useState("");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");

  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [mensajeDatos, setMensajeDatos] = useState("");

  // Estados del Cropper
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    async function cargarPerfil() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        setEmail(user.email);
        
        let { data: cuentaData } = await supabase
          .from("profiles")
          .select("nombre, apellido, telefono, pais, avatar_url, creditos, fecha_nacimiento")
          .eq("id", user.id)
          .maybeSingle();

        setPerfil(cuentaData);
        setNombreInput(cuentaData?.nombre || "");
        setApellidoInput(cuentaData?.apellido || "");

        // Separación inteligente de código de área y teléfono
        if (cuentaData?.telefono) {
          const tel = cuentaData.telefono.trim();
          const codigos = ["+58", "+54", "+57", "+56", "+34", "+52", "+1", "+39"];
          let encontrado = false;
          for (let code of codigos) {
            if (tel.startsWith(code)) {
              setCodigoArea(code);
              setTelefonoInput(tel.slice(code.length).trim());
              encontrado = true;
              break;
            }
          }
          if (!encontrado) setTelefonoInput(tel);
        }

        // Cargar fecha de nacimiento en los 3 dropdowns
        if (cuentaData?.fecha_nacimiento) {
          const partes = cuentaData.fecha_nacimiento.split("-");
          if (partes.length === 3) {
            setAno(partes[0]);
            setMes(partes[1]);
            setDia(partes[2]);
          }
        }

        // Verificar tablas satélite
        const [{ data: pf }, { data: pp }] = await Promise.all([
          supabase.from("futbol_profiles").select("id").eq("id", user.id).maybeSingle(),
          supabase.from("padel_profiles").select("id").eq("id", user.id).maybeSingle(),
        ]);

        setTienePerfilFutbol(!!pf);
        setTienePerfilPadel(!!pp);
      }
      setCargando(false);
    }
    cargarPerfil();
  }, []);

  const onFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        setMensajeFoto("Solo puedes subir imágenes.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMensajeFoto("La imagen no puede pesar más de 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => setImageSrc(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const guardarFotoRecortada = async () => {
    try {
      setSubiendoFoto(true);
      setMensajeFoto("");

      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      setImageSrc(null);

      const filePath = `${userId}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedImageBlob, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatar_url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url }).eq("id", userId);

      if (updateError) throw updateError;

      setPerfil((prev) => ({ ...prev, avatar_url }));
      setMensajeFoto("¡Foto de perfil actualizada!");
      setTimeout(() => setMensajeFoto(""), 3000);
    } catch (error) {
      console.error("Error al recortar/subir foto:", error);
      setMensajeFoto("Ocurrió un error al actualizar la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardarDatos = async (e) => {
    e.preventDefault();
    if (!supabase || !userId) return;

    try {
      setGuardandoDatos(true);
      setMensajeDatos("");

      let fechaCombinada = null;
      if (ano && mes && dia) {
        fechaCombinada = `${ano}-${mes}-${dia}`;
      }

      const telefonoCompleto = telefonoInput.trim() ? `${codigoArea} ${telefonoInput.trim()}` : null;

      const { error } = await supabase
        .from("profiles")
        .update({ 
          nombre: nombreInput,
          apellido: apellidoInput,
          telefono: telefonoCompleto,
          fecha_nacimiento: fechaCombinada
        })
        .eq("id", userId);

      if (error) throw error;

      setPerfil((prev) => ({ 
        ...prev, 
        nombre: nombreInput, 
        apellido: apellidoInput,
        telefono: telefonoCompleto,
        fecha_nacimiento: fechaCombinada
      }));
      setMensajeDatos("Datos actualizados correctamente.");
      setTimeout(() => setMensajeDatos(""), 3000);
    } catch (error) {
      console.error("Error guardando datos:", error);
      setMensajeDatos("Hubo un error al guardar los datos.");
    } finally {
      setGuardandoDatos(false);
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <span className="text-5xl">🔐</span>
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Acceso denegado</h1>
        <p className="text-gray-500 font-medium">Inicia sesión para gestionar tu cuenta global.</p>
        <Link href="/login" className="mt-2 px-8 py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-900 transition-colors shadow-lg">
          Ir al Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 pt-8">

      {/* MODAL DE RECORTE DE FOTO */}
      {imageSrc && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col">
          <div className="relative flex-1">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="bg-white p-6 flex flex-col gap-4 pb-10">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
              <span>Zoom</span>
              <span>Ajusta tu encuadre</span>
            </div>
            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="w-full accent-gray-900" />
            <div className="flex gap-3 mt-2">
              <button onClick={() => setImageSrc(null)} className="flex-1 py-3.5 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider">Cancelar</button>
              <button onClick={guardarFotoRecortada} className="flex-1 py-3.5 font-black text-white bg-gray-900 rounded-xl hover:bg-black transition-colors text-xs uppercase tracking-wider shadow-md">Guardar Foto</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 space-y-10">
        
        {/* ENCABEZADO */}
        <div className="border-b border-gray-200/80 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            Mi Cuenta
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Gestiona tu información personal global y accede a tus distintos perfiles deportivos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA */}
          <div className="md:col-span-1 flex flex-col gap-8">
            
            {/* INFO DEL USUARIO / AVATAR */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center gap-4">
              <div className="relative group">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md flex items-center justify-center text-gray-400 font-black text-3xl">
                  {perfil?.avatar_url ? (
                    <img src={perfil.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    iniciales(perfil?.nombre, perfil?.apellido)
                  )}
                </div>
                
                <label className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white">
                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">Editar</span>
                  <input type="file" accept="image/*" onChange={onFileChange} className="hidden" disabled={subiendoFoto} />
                </label>
              </div>

              <div className="w-full">
                <h2 className="text-xl font-black text-gray-900 leading-tight truncate">
                  {perfil?.nombre || "Usuario"} {perfil?.apellido || ""}
                </h2>
                <p className="text-xs font-semibold text-gray-400 mt-1 truncate">{email}</p>
              </div>

              {mensajeFoto && (
                <div className={`w-full p-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${mensajeFoto.includes("error") || mensajeFoto.includes("Solo") || mensajeFoto.includes("peso") ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                  {mensajeFoto}
                </div>
              )}
            </div>

            {/* BILLETERA GLOBAL DE CRÉDITOS */}
            <div className="bg-gradient-to-br from-[#0B0C15] to-gray-900 rounded-3xl p-6 shadow-lg border border-gray-800 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-2xl rounded-full pointer-events-none"></div>
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-500">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34-.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.843c-.391-.015-.776-.11-1.116-.281-.51-.255-.884-.71-.884-1.22a1 1 0 10-2 0c0 1.25-.96 2.38-2.215-2.875A4.535 4.535 0 009 14.908V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.249c.391.015.776.11 1.116.281.51.255.884.71.884 1.22a1 1 0 102 0c0-1.25-.96-2.38-2.215-2.875A4.535 4.535 0 0011 5.092V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saldo Total</p>
                    <p className="font-black text-2xl leading-none mt-0.5">{perfil?.creditos || 0} <span className="text-sm font-medium text-gray-400">⚡</span></p>
                  </div>
                </div>
                <Link href="/futbol/creditos" className="w-full text-center py-3 bg-white text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-gray-100 transition-colors shadow-sm">
                  Comprar Créditos
                </Link>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="md:col-span-2 flex flex-col gap-8">
            
            {/* PERFILES DEPORTIVOS */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Perfiles Deportivos</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* TARJETA FÚTBOL */}
                <Link 
                  href={tienePerfilFutbol ? "/futbol/perfil" : "/futbol/crear-perfil"} 
                  className="group relative bg-[#0B0C15] rounded-3xl p-6 border border-gray-800 hover:border-[#00FF9D] transition-all overflow-hidden flex flex-col justify-between min-h-[160px] shadow-lg hover:shadow-[#00FF9D]/10 hover:-translate-y-1"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF9D]/5 rounded-bl-full pointer-events-none group-hover:bg-[#00FF9D]/10 transition-colors"></div>
                  <div>
                    <span className="text-3xl block mb-2">⚽</span>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">Fútbol</h4>
                    {!tienePerfilFutbol && (
                      <span className="inline-block mt-1 bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-yellow-500/20">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] font-bold text-[#00FF9D] uppercase tracking-widest">
                      {tienePerfilFutbol ? "Ver estadísticas" : "Crear mi carta"}
                    </span>
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-[#00FF9D] transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                  </div>
                </Link>

                {/* TARJETA PÁDEL */}
                <Link 
                  href={tienePerfilPadel ? "/padel/perfil" : "/padel/crear-perfil"} 
                  className="group relative bg-[#0B0C15] rounded-3xl p-6 border border-gray-800 hover:border-sky-400 transition-all overflow-hidden flex flex-col justify-between min-h-[160px] shadow-lg hover:shadow-sky-400/10 hover:-translate-y-1"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/5 rounded-bl-full pointer-events-none group-hover:bg-sky-400/10 transition-colors"></div>
                  <div>
                    <span className="text-3xl block mb-2">🎾</span>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">Pádel</h4>
                    {!tienePerfilPadel && (
                      <span className="inline-block mt-1 bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border border-yellow-500/20">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">
                      {tienePerfilPadel ? "Ver nivel y récord" : "Crear mi perfil"}
                    </span>
                    <svg className="w-5 h-5 text-gray-600 group-hover:text-sky-400 transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                  </div>
                </Link>
              </div>
            </div>

            {/* FORMULARIO DATOS PERSONALES */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5">Datos Personales</h3>
              
              <form onSubmit={guardarDatos} className="flex flex-col gap-4">
                
                {/* CORREO */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={email} 
                    disabled 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400">El correo está vinculado a tu acceso seguro.</p>
                </div>

                {/* NOMBRE Y APELLIDO EN PARALELO */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre</label>
                    <input 
                      type="text" 
                      value={nombreInput} 
                      onChange={(e) => setNombreInput(e.target.value)}
                      placeholder="Ej. Juan"
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apellido</label>
                    <input 
                      type="text" 
                      value={apellidoInput} 
                      onChange={(e) => setApellidoInput(e.target.value)}
                      placeholder="Ej. Pérez"
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all"
                    />
                  </div>
                </div>

                {/* FECHA DE NACIMIENTO EN 3 DROPDOWNS */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha de Nacimiento</label>
                  <div className="grid grid-cols-3 gap-2">
                    <select 
                      value={dia} 
                      onChange={(e) => setDia(e.target.value)} 
                      className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-white font-bold text-gray-900 focus:outline-none focus:border-gray-400"
                    >
                      <option value="" disabled>Día</option>
                      {Array.from({ length: 31 }, (_, i) => {
                        const val = String(i + 1).padStart(2, "0");
                        return <option key={val} value={val}>{i + 1}</option>;
                      })}
                    </select>

                    <select 
                      value={mes} 
                      onChange={(e) => setMes(e.target.value)} 
                      className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-white font-bold text-gray-900 focus:outline-none focus:border-gray-400"
                    >
                      <option value="" disabled>Mes</option>
                      <option value="01">Ene</option>
                      <option value="02">Feb</option>
                      <option value="03">Mar</option>
                      <option value="04">Abr</option>
                      <option value="05">May</option>
                      <option value="06">Jun</option>
                      <option value="07">Jul</option>
                      <option value="08">Ago</option>
                      <option value="09">Sep</option>
                      <option value="10">Oct</option>
                      <option value="11">Nov</option>
                      <option value="12">Dic</option>
                    </select>

                    <select 
                      value={ano} 
                      onChange={(e) => setAno(e.target.value)} 
                      className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-white font-bold text-gray-900 focus:outline-none focus:border-gray-400"
                    >
                      <option value="" disabled>Año</option>
                      {Array.from({ length: 100 }, (_, i) => {
                        const year = new Date().getFullYear() - 10 - i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>
                </div>

                {/* TELÉFONO CON DROPDOWN DE CÓDIGO DE ÁREA */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teléfono</label>
                  <div className="flex gap-2">
                    <select
                      className="w-[105px] border border-gray-200 rounded-xl px-2 py-3 text-sm bg-white font-bold text-gray-900 focus:outline-none focus:border-gray-400 text-center shrink-0"
                      value={codigoArea}
                      onChange={(e) => setCodigoArea(e.target.value)}
                    >
                      <option value="+58">🇻🇪 +58</option>
                      <option value="+54">🇦🇷 +54</option>
                      <option value="+57">🇨🇴 +57</option>
                      <option value="+56">🇨🇱 +56</option>
                      <option value="+34">🇪🇸 +34</option>
                      <option value="+52">🇲🇽 +52</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+39">🇮🇹 +39</option>
                    </select>
                    <input 
                      type="tel" 
                      value={telefonoInput} 
                      onChange={(e) => setTelefonoInput(e.target.value)}
                      placeholder="351 3810400"
                      className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-gray-400 transition-all min-w-0"
                    />
                  </div>
                </div>

                {mensajeDatos && (
                  <div className={`p-3 rounded-xl text-xs font-bold text-center ${mensajeDatos.includes("error") ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                    {mensajeDatos}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={guardandoDatos}
                  className="mt-2 w-full py-4 bg-[#0B0C15] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-colors disabled:opacity-50"
                >
                  {guardandoDatos ? "Guardando..." : "Guardar Cambios"}
                </button>

              </form>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}