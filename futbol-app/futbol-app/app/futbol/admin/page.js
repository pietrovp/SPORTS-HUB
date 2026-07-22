"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Admin() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);
  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    cancha: "",
    zona: "",
    fecha: null,
    hora: null,
    cupos: "",
  });

  const [imagenFile, setImagenFile] = useState(null);
  const [imagenPreview, setImagenPreview] = useState(null);

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    async function verificar() {
      if (!supabase) {
        setVerificando(false);
        return;
      }
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      setUser(currentUser);

      if (!currentUser) {
        setVerificando(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", currentUser.id)
        .single();

      setAutorizado(!!data?.is_admin);
      setVerificando(false);
    }
    verificar();
  }, []);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function manejarImagen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagenFile(file);
    setImagenPreview(URL.createObjectURL(file));
  }

  async function publicar() {
    setCargando(true);
    setMensaje({ texto: "", tipo: "" });

    if (!form.cancha || !form.zona || !form.fecha || !form.hora || !form.cupos) {
      setMensaje({ texto: "Por favor, completa todos los campos.", tipo: "error" });
      setCargando(false);
      return;
    }

    const fechaDB = format(form.fecha, "yyyy-MM-dd");
    const horaDB = format(form.hora, "HH:mm:ss");

    let imagenUrl = null;

    if (imagenFile) {
      const nombreArchivo = `${Date.now()}-${imagenFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("canchas")
        .upload(nombreArchivo, imagenFile);

      if (uploadError) {
        setMensaje({ texto: "Error al subir la imagen: " + uploadError.message, tipo: "error" });
        setCargando(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("canchas")
        .getPublicUrl(nombreArchivo);

      imagenUrl = publicUrlData.publicUrl;
    }

    // MAPEO A LAS COLUMNAS REALES DE TU TABLA 'partidos'
    const { error } = await supabase.from("partidos").insert({
      titulo: `Partido en ${form.cancha}`,
      cancha_lugar: form.cancha,
      fecha: fechaDB,
      hora: horaDB,
      cupos_totales: Number(form.cupos),
      cupos_disponibles: Number(form.cupos),
      precio_creditos: 1,
      organizador_id: user?.id || null,
      estado: "abierto",
    });

    setCargando(false);

    if (error) {
      setMensaje({ texto: "Error al publicar: " + error.message, tipo: "error" });
    } else {
      setMensaje({ texto: "¡Partido publicado con éxito!", tipo: "exito" });
      setTimeout(() => {
        router.push("/futbol");
        router.refresh();
      }, 1500);
    }
  }

  if (verificando) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border border-red-200 text-center shadow-sm mt-12">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h1>
        <p className="text-sm text-gray-500 font-medium">Esta sección es exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 relative">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Crear partido</h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">
          Programa un nuevo encuentro. Entrada fijada en <span className="text-gray-900 font-bold">1 crédito</span>.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 flex flex-col gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Foto de la cancha</label>
          <label
            htmlFor="imagen-cancha"
            className="relative flex flex-col items-center justify-center w-full h-44 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden cursor-pointer hover:border-green-500 transition-all"
          >
            {imagenPreview ? (
              <img src={imagenPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span className="text-xs font-bold">Haz clic para subir una imagen</span>
              </div>
            )}
          </label>
          <input
            id="imagen-cancha"
            type="file"
            accept="image/*"
            onChange={manejarImagen}
            className="hidden"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Nombre de la cancha</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            placeholder="Ej. Cancha Los Leones"
            value={form.cancha}
            onChange={(e) => actualizar("cancha", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Zona</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            placeholder="Ej. Barquisimeto Este"
            value={form.zona}
            onChange={(e) => actualizar("zona", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha</label>
            <DatePicker
              selected={form.fecha}
              onChange={(date) => actualizar("fecha", date)}
              locale={es}
              dateFormat="dd 'de' MMMM, yyyy"
              placeholderText="Selecciona el día"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all cursor-pointer"
            />
          </div>
          <div className="flex flex-col">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hora</label>
            <DatePicker
              selected={form.hora}
              onChange={(time) => actualizar("hora", time)}
              showTimeSelect
              showTimeSelectOnly
              timeIntervals={15}
              timeCaption="Hora"
              dateFormat="h:mm aa"
              placeholderText="Selecciona la hora"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cupos Totales</label>
          <input
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
            type="number"
            min="1"
            placeholder="Ej. 14 (para un 7 vs 7)"
            value={form.cupos}
            onChange={(e) => actualizar("cupos", e.target.value)}
          />
        </div>

        {mensaje.texto && (
          <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
            mensaje.tipo === "exito" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {mensaje.tipo === "exito" ? "✅" : "⚠️"} {mensaje.texto}
          </div>
        )}

        <button
          disabled={cargando}
          onClick={publicar}
          className={`w-full rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all ${
            cargando
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 text-white active:scale-[0.98]"
          }`}
        >
          {cargando ? "Publicando partido..." : "Publicar partido"}
        </button>
      </div>
    </div>
  );
}