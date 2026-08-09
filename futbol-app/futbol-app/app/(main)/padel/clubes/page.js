"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Foto libre de Unsplash (Unsplash License: uso comercial permitido, sin
// atribución obligatoria). Si luego quieres optimizarla con next/image,
// agrega "images.unsplash.com" a images.remotePatterns en next.config.js.
const PADEL_HERO_IMG = "https://images.unsplash.com/photo-1646649852046-b758d2d573f3?auto=format&fit=crop&w=1740&q=80";

export default function PadelClubsPage() {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    cargarClubes();
  }, []);

  async function cargarClubes() {
    try {
      setLoading(true);
      setErrorMsg("");

      // Intenta cargar de clubs o sedes
      const { data: clubsData, error } = await supabase
        .from("clubs")
        .select(`
          id, name, slug, city, address, image_url, is_active,
          courts:courts ( id )
        `);

      if (error) throw error;
      setClubs(clubsData || []);
    } catch (err) {
      console.error("Error cargando directorio de clubes:", err);
      setErrorMsg("No se pudieron cargar los clubes.");
    } finally {
      setLoading(false);
    }
  }

  const clubesFiltrados = useMemo(() => {
    return clubs.filter((c) => {
      return (
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.city?.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [clubs, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">

      {/* Tipografía de marca, en línea con el resto de la WebApp */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
        .font-brand-mono { font-family: 'Space Mono', monospace; }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">

        {/* HERO — foto real de pádel, buscador integrado */}
        <div className="relative rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl min-h-[300px] sm:min-h-[380px] flex items-end">
          <img
            src={PADEL_HERO_IMG}
            alt="Jugadora sosteniendo la raqueta en una pista de pádel"
            className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C2A] via-[#0B0C2A]/75 to-[#0B0C2A]/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C2A]/70 via-transparent to-transparent" />

          <div className="relative z-10 w-full p-6 sm:p-10 text-white space-y-4">
            <span className="font-brand-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#00FF9D]">
              Sports Hub · Pádel
            </span>
            <h1 className="font-display uppercase text-5xl sm:text-6xl leading-[0.85]">
              Clubes de <span className="text-[#00FF9D]">Pádel</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 font-medium max-w-md">
              Selecciona tu club preferido para ver las pistas disponibles y reservar tu horario.
            </p>

            <div className="pt-2 max-w-md">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por club o ciudad..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl pl-10 pr-4 py-3.5 text-xs font-bold text-white placeholder:text-slate-300 outline-none focus:border-[#00FF9D]/60 focus:bg-white/15 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ALERTA DE ERROR */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex justify-between items-center shadow-sm">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-600 font-black">✕</button>
          </div>
        )}

        {/* LISTA / GRILLA DE CLUBES */}
        {clubesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-3xl">🏟️</div>
            <h3 className="font-display uppercase text-2xl text-slate-800">No hay clubes disponibles</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
              {search
                ? `No encontramos ningún club que coincida con "${search}".`
                : "Aún no hay clubes cargados en el sistema."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubesFiltrados.map((club) => {
              const totalCanchas = club.courts?.length || 0;

              return (
                <div
                  key={club.id}
                  className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-100 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="relative h-48 bg-slate-800 overflow-hidden">
                    {club.image_url ? (
                      <img
                        src={club.image_url}
                        alt={club.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-blue-900 to-slate-900">🏟️</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

                    {totalCanchas > 0 && (
                      <span className="absolute top-3 right-3 bg-[#00FF9D] text-slate-950 text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-sm">
                        {totalCanchas} {totalCanchas === 1 ? "Pista" : "Pistas"}
                      </span>
                    )}

                    <div className="absolute bottom-3 left-4 right-3 text-white">
                      <h3 className="font-display uppercase text-2xl leading-none">{club.name}</h3>
                      <p className="text-xs text-slate-300 font-medium mt-1">📍 {club.city || "Ubicación disponible"}</p>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {club.address || "Complejo deportivo con canchas reglamentarias de pádel."}
                    </p>

                    {/* 🔥 REDIRECCIÓN REAL A /padel/clubes/[id] */}
                    <Link
                      href={`/padel/clubes/${club.id}`}
                      className="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors text-center block"
                    >
                      Ver Disponibilidad y Canchas →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}