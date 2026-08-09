"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function FutbolClubesDirectoryPage() {
  const [loading, setLoading] = useState(true);
  const [clubes, setClubes] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    cargarClubesFutbol();
  }, []);

  async function cargarClubesFutbol() {
    try {
      setLoading(true);
      
      // 1. Cargar clubes activos
      const { data: clubsData, error: clubsErr } = await supabase
        .from("padel_clubs")
        .select("*")
        .eq("is_active", true);

      if (clubsErr) throw clubsErr;

      const clubesConFutbol = (clubsData || []).filter((c) => {
        const sports = Array.isArray(c.sports) ? c.sports : [];
        return sports.includes("futbol");
      });

      const clubIds = clubesConFutbol.map((c) => c.id);

      // 2. Obtener conteo de canchas de fútbol por club
      let canchasMap = {};
      if (clubIds.length > 0) {
        const { data: courtsData } = await supabase
          .from("courts")
          .select("id, club_id, sport_type")
          .in("club_id", clubIds)
          .eq("is_active", true);

        (courtsData || []).forEach((court) => {
          if (court.sport_type === "futbol") {
            canchasMap[court.club_id] = (canchasMap[court.club_id] || 0) + 1;
          }
        });
      }

      const clubesFinal = clubesConFutbol.map((c) => ({
        ...c,
        totalCanchas: canchasMap[c.id] || 0,
      }));

      setClubes(clubesFinal);
    } catch (e) {
      console.error("Error cargando clubes de fútbol:", e);
    } finally {
      setLoading(false);
    }
  }

  const clubesFiltrados = clubes.filter(
    (c) =>
      c.name.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.city.toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.address && c.address.toLowerCase().includes(busqueda.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-8 sm:px-8 space-y-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* CABECERA ESTILO PÁDEL CON TITULAR Y BÚSQUEDA */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600 block">
              SPORTS HUB · FÚTBOL
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 flex items-center gap-2">
              Clubes de Fútbol 🏟️
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
              Selecciona tu club preferido para ver las canchas disponibles y reservar horarios.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="🔍 Buscar por club o ciudad..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-full px-4 py-2.5 text-xs font-bold text-slate-800 outline-none shadow-xs focus:border-blue-500"
            />
          </div>
        </div>

        {/* GRILLA DE TARJETAS CON DISEÑO IDÉNTICO */}
        {clubesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 space-y-3">
            <span className="text-4xl block">⚽</span>
            <h3 className="text-base font-black text-slate-800">No se encontraron complejos deportivos</h3>
            <p className="text-xs text-slate-400 font-medium">Intenta ajustando tu búsqueda o vuelve más tarde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubesFiltrados.map((club) => (
              <div
                key={club.id}
                className="bg-white rounded-[2rem] border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                {/* CABECERA VISUAL / IMAGEN */}
                <div className="h-48 relative overflow-hidden bg-slate-900">
                  {club.image_url ? (
                    <img
                      src={club.image_url}
                      alt={club.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#121629] via-[#1a203a] to-[#0B0C15] flex items-center justify-center">
                      <span className="text-3xl">🏟️</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <h3 className="text-lg font-black leading-tight drop-shadow-sm truncate">
                      {club.name}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mt-0.5">
                      <span>📍</span> {club.city}
                    </p>
                  </div>
                </div>

                {/* CUERPO Y ACCIÓN */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-xs font-bold text-slate-400 truncate">
                    {club.address || "Dirección no especificada"}
                  </p>

                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Canchas registradas:</span>
                    <span className="bg-blue-100 text-blue-800 text-[11px] font-black px-3 py-1 rounded-full">
                      {club.totalCanchas} {club.totalCanchas === 1 ? "Cancha" : "Canchas"}
                    </span>
                  </div>

                  <Link
                    href={`/futbol/clubes/${club.id}`}
                    className="w-full py-3 bg-[#0B0C15] hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-2xl text-center shadow-md transition-all active:scale-98 block"
                  >
                    VER DISPONIBILIDAD Y CANCHAS →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}