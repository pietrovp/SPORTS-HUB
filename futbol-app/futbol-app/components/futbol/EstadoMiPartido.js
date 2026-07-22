"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function EstadoMiPartido({ partidoId, golesEquipo1, golesEquipo2, estado }) {
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    async function checkEstado() {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("partido_jugadores")
        .select("equipo")
        .eq("partido_id", partidoId)
        .eq("user_id", user.id)
        .maybeSingle();

      // Si no hay data o el equipo está en null/indefinido, no mostramos nada
      if (!data || !data.equipo) return;

      const g1 = Number(golesEquipo1) || 0;
      const g2 = Number(golesEquipo2) || 0;
      
      // LA MAGIA AQUÍ: Forzamos el dato de Supabase a que sea un Número real
      const miEquipo = Number(data.equipo); 

      if (g1 === g2) {
        setResultado("empate");
      } else if ((miEquipo === 1 && g1 > g2) || (miEquipo === 2 && g2 > g1)) {
        setResultado("victoria");
      } else {
        setResultado("derrota");
      }
    }

    if (estado === "finalizado") {
      checkEstado();
    }
  }, [partidoId, golesEquipo1, golesEquipo2, estado]);

  if (!resultado) return null;

  if (resultado === "victoria") {
    return (
      <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-center font-bold border border-emerald-200 shadow-sm w-full">
        🏆 ¡Ganaste este partido!
      </div>
    );
  }

  if (resultado === "empate") {
    return (
      <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl text-center font-bold border border-yellow-200 shadow-sm w-full">
        🤝 Empataste este partido
      </div>
    );
  }

  return (
    <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center font-bold border border-red-200 shadow-sm w-full">
      🔴 Perdiste este partido
    </div>
  );
}