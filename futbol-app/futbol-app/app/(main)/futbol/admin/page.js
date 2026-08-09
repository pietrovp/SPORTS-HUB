"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function FutbolPartidosPage() {
  const [loading, setLoading] = useState(true);
  const [partidos, setPartidos] = useState([]);

  useEffect(() => {
    cargarPartidosFutbol();
  }, []);

  async function cargarPartidosFutbol() {
    try {
      setLoading(true);

      // Traer reservas/partidos de padel_matches unidos con courts (donde sport_type = 'futbol')
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          club:clubs(name, city, address, image_url),
          court:courts!inner(name, sport_type)
        `)
        .eq("court.sport_type", "futbol")
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: true });

      if (error) throw error;

      setPartidos(data || []);
    } catch (e) {
      console.error("Error cargando partidos de fútbol:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const proximos = partidos.filter((p) => p.status !== "jugado");
  const jugados = partidos.filter((p) => p.status === "jugado");

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-8 sm:px-8 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* HERO BANNER */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider inline-block mb-2">
              ⚽ Caimanas & Partidos
            </span>
            <h1 className="text-2xl sm:text-4xl font-black">Próximos Encuentros de Fútbol</h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
              Únete a un partido abierto o consulta tus partidos agendados en los complejos deportivos.
            </p>
          </div>

          <Link
            href="/futbol/clubes"
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all text-center shrink-0"
          >
            🏟️ Ver Clubes Disponibles
          </Link>
        </div>

        {/* PRÓXIMOS JUEGOS */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-xl font-black text-slate-900">PRÓXIMOS JUEGOS</h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              {proximos.length} disponibles
            </span>
          </div>

          {proximos.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-200 space-y-2">
              <span className="text-3xl block">📅</span>
              <p className="text-xs font-bold text-slate-500">No hay partidos públicos próximos en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proximos.map((match) => {
                const dateObj = new Date(match.scheduled_at);
                const fechaFormat = dateObj.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
                const horaFormat = dateObj.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: true });

                return (
                  <Link
                    key={match.id}
                    href={`/futbol/partidos/${match.id}`}
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all space-y-4 block group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-600 block">{match.club?.name || "Complejo"}</span>
                        <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                          ⚽ {match.court?.name || "Cancha de Fútbol"}
                        </h3>
                      </div>
                      <span className="text-xs font-black bg-slate-900 text-[#00FF9D] px-2.5 py-1 rounded-xl">
                        ${match.total_price || 30} USD
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center text-xs font-bold text-slate-700">
                      <span>📅 {fechaFormat}</span>
                      <span>⏰ {horaFormat}</span>
                    </div>

                    <div className="pt-1 flex justify-between items-center text-xs font-black text-slate-900">
                      <span>📍 {match.club?.city || "Barquisimeto"}</span>
                      <span className="text-emerald-600 uppercase">Ver Partido →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}