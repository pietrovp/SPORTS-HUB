"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function CrearPerfilFutbol() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState({
    posicion: "Mediocentro",
    pierna_habil: "Derecha",
    nivel: "Intermedio",
  });

  const handleChange = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardarPerfil = async () => {
    setCargando(true);
    
    // Obtenemos el usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("Debes iniciar sesión primero");
      return;
    }

    // Guardamos los datos
    const { error } = await supabase.from("futbol_profiles").upsert({
      id: user.id,
      posicion: form.posicion,
      pierna_habil: form.pierna_habil,
      nivel: form.nivel,
    });

    setCargando(false);

    if (error) {
      alert("Error al guardar el perfil: " + error.message);
    } else {
      alert("¡Perfil de Fútbol creado con éxito!");
      router.push("/futbol/perfil"); // Lo mandamos a su perfil de fútbol
    }
  };

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-colors appearance-none cursor-pointer";

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-gray-100 p-8 flex flex-col gap-6">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center text-3xl mb-3">
            ⚽
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Perfil de Fútbol</h1>
          <p className="text-sm text-gray-500 mt-1">Completa tus datos para la cancha</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posición</label>
            <select className={inputClass} value={form.posicion} onChange={(e) => handleChange("posicion", e.target.value)}>
              <option value="Portero">Portero</option>
              <option value="Defensa">Defensa</option>
              <option value="Mediocentro">Mediocentro</option>
              <option value="Delantero">Delantero</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Pierna Hábil</label>
            <select className={inputClass} value={form.pierna_habil} onChange={(e) => handleChange("pierna_habil", e.target.value)}>
              <option value="Derecha">Derecha</option>
              <option value="Izquierda">Izquierda</option>
              <option value="Ambidextro">Ambidextro</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nivel</label>
            <select className={inputClass} value={form.nivel} onChange={(e) => handleChange("nivel", e.target.value)}>
              <option value="Principiante">Principiante (Amateur)</option>
              <option value="Intermedio">Intermedio (Regular)</option>
              <option value="Avanzado">Avanzado (Competitivo)</option>
            </select>
          </div>

          <button onClick={guardarPerfil} disabled={cargando} className="mt-4 bg-green-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm">
            {cargando ? "Guardando..." : "Guardar Perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}