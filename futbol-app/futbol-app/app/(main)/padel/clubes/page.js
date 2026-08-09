"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ALERTA DE ERROR */}
        {errorMsg && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex justify-between items-center shadow-sm">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-600 font-black">✕</button>
          </div>
        )}

        {/* HEADER DIRECTORIO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">
              Sports Hub · Pádel
            </span>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Clubes de Pádel 🏟️
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Selecciona tu club preferido para ver las pistas disponibles y reservar horarios.
            </p>
          </div>

          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="🔍 Buscar por club o ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* LISTA / GRILLA DE CLUBES */}
        {clubesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 space-y-3">
            <span className="text-4xl block">🏟️</span>
            <h3 className="text-lg font-black text-slate-800">No hay clubes disponibles</h3>
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
                  className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="relative h-48 bg-slate-800">
                    {club.image_url ? (
                      <img src={club.image_url} alt={club.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🏟️</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-3 text-white">
                      <h3 className="text-xl font-black">{club.name}</h3>
                      <p className="text-xs text-slate-300 font-medium">📍 {club.city || "Ubicación disponible"}</p>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <p className="text-xs text-slate-500 font-medium line-clamp-2">
                      {club.address || "Complejo deportivo con canchas reglamentarias de pádel."}
                    </p>

                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span>Pistas registradas:</span>
                      <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-black text-[11px]">
                        {totalCanchas} Pistas
                      </span>
                    </div>

                    {/* 🔥 REDIRECCIÓN REAL A /padel/clubes/[id] */}
                    <Link
                      href={`/padel/clubes/${club.id}`}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-colors text-center block"
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