"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function PerfilCuenta() {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [tienePerfilFutbol, setTienePerfilFutbol] = useState(false);
  const [tienePerfilPadel, setTienePerfilPadel] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState("");

  useEffect(() => {
    async function cargar() {
      if (!supabase) {
        setCargando(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCargando(false);
        return;
      }

      setUsuario(user);

      // CORRECCIÓN: Buscamos en la tabla "profiles"
      let { data: cuentaData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!cuentaData) {
        // CORRECCIÓN: Insertamos en "profiles" y usamos "email" en lugar de "correo"
        const { data: creada } = await supabase
          .from("profiles")
          .insert({ id: user.id, email: user.email, nombre: user.user_metadata?.nombre || null })
          .select()
          .single();
        cuentaData = creada;
      }

      // CORRECCIÓN: Buscamos en las nuevas tablas satélite
      const [{ data: pf }, { data: pp }] = await Promise.all([
        supabase.from("futbol_profiles").select("id").eq("id", user.id).maybeSingle(),
        supabase.from("padel_profiles").select("id").eq("id", user.id).maybeSingle(),
      ]);

      setCuenta(cuentaData || null);
      setTienePerfilFutbol(!!pf);
      setTienePerfilPadel(!!pp);
      setCargando(false);
    }

    cargar();
  }, []);

  async function subirFoto(e) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !usuario) return;

    setMensajeFoto("");

    if (!file.type.startsWith("image/")) {
      setMensajeFoto("Solo puedes subir imágenes.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMensajeFoto("La imagen no puede pesar más de 2MB.");
      return;
    }

    try {
      setSubiendoFoto(true);

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${usuario.id}/avatar-cuenta.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        setMensajeFoto(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatar_url = publicUrlData.publicUrl;

      // CORRECCIÓN: Actualizamos en la tabla "profiles"
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url })
        .eq("id", usuario.id);

      if (updateError) {
        setMensajeFoto(updateError.message);
        return;
      }

      setCuenta((prev) => ({ ...prev, avatar_url }));
      setMensajeFoto("Foto actualizada correctamente.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">🏟️</div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <div className="text-6xl">🔐</div>
        <h1 className="text-2xl font-bold text-gray-800">Accede a tu cuenta</h1>
        <p className="text-gray-500 text-center max-w-sm">
          Inicia sesión para ver tu cuenta y tus perfiles deportivos.
        </p>
        <Link href="/login" className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800">Mi cuenta</h1>

      {/* --- Datos de la cuenta núcleo --- */}
      <div className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl">
          {cuenta?.avatar_url ? (
            <img src={cuenta.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
          ) : (
            (cuenta?.nombre || usuario.email || "?").slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-800">{cuenta?.nombre || "Sin nombre"}</p>
          <p className="text-sm text-gray-500">{usuario.email}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Foto de perfil de la cuenta</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={subirFoto}
          className="text-sm text-gray-600"
          disabled={subiendoFoto}
        />
        {subiendoFoto && <p className="text-xs text-gray-500">Subiendo foto...</p>}
        {mensajeFoto && <p className="text-xs text-gray-500">{mensajeFoto}</p>}
      </div>

      {/* --- Perfiles deportivos vinculados a esta cuenta --- */}
      <h2 className="text-lg font-bold text-gray-800 mt-2">Mis perfiles deportivos</h2>

      <div className="grid md:grid-cols-2 gap-4">
        {/* CORRECCIÓN: Link dinámico según si tiene perfil o no */}
        <Link
          href={tienePerfilFutbol ? "/futbol/perfil" : "/futbol/crear-perfil"}
          className="rounded-2xl p-5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-between"
        >
          <div>
            <p className="font-black text-emerald-900 flex items-center gap-2">⚽ Fútbol</p>
            <p className="text-xs text-emerald-700 mt-1">
              {tienePerfilFutbol ? "Ver mi carta y estadísticas" : "Aún no tienes perfil — créalo aquí"}
            </p>
          </div>
          <span className="text-emerald-700 font-bold">→</span>
        </Link>

        {/* CORRECCIÓN: Link dinámico según si tiene perfil o no */}
        <Link
          href={tienePerfilPadel ? "/padel/perfil" : "/padel/crear-perfil"}
          className="rounded-2xl p-5 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
        >
          <div>
            <p className="font-black text-blue-900 flex items-center gap-2">🎾 Pádel</p>
            <p className="text-xs text-blue-700 mt-1">
              {tienePerfilPadel ? "Ver mis estadísticas" : "Aún no tienes perfil — créalo aquí"}
            </p>
          </div>
          <span className="text-blue-700 font-bold">→</span>
        </Link>
      </div>
    </div>
  );
}