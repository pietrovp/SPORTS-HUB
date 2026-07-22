"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import PlayerCard from "../../../components/futbol/PlayerCard";
import Link from "next/link";

export default function Jugadores() {
  const [jugadores, setJugadores] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [ordenDesc, setOrdenDesc] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [errorBd, setErrorBd] = useState(""); 

  useEffect(() => {
    async function cargar() {
      if (!supabase) {
        setCargando(false);
        return;
      }

      // CORRECCIÓN: Ahora pedimos la columna 'rating' que es la que realmente existe en tu base de datos
      const { data, error } = await supabase
        .from("futbol_profiles")
        .select(
          "id, posicion, rating, profiles(nombre, pais, avatar_url)"
        );

      if (error) {
        console.error("ERROR JUGADORES:", error);
        setErrorBd(error.message); 
        setJugadores([]);
        setCargando(false);
        return;
      }

      // Mapeamos los datos para que tu componente PlayerCard los entienda igual que antes
      // Usamos j.rating y se lo pasamos a media_general
      const dataMapeada = data?.map(j => ({
        id: j.id,
        nombre: j.profiles?.nombre || "Jugador",
        posicion_preferida: j.posicion,
        media_general: j.rating != null ? j.rating : 65, 
        avatar_url: j.profiles?.avatar_url,
        nacionalidad: j.profiles?.pais
      })) || [];

      setJugadores(dataMapeada);
      setCargando(false);
    }

    cargar();
  }, []);

  const filtrados = jugadores
    .filter((j) => j.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => {
      const mediaA = a.media_general ?? 0;
      const mediaB = b.media_general ?? 0;
      return ordenDesc ? mediaB - mediaA : mediaA - mediaB;
    });

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
          Comunidad
        </h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">
          Descubre a los jugadores y sus estadísticas.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 pointer-events-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar jugador por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>

        <button
          onClick={() => setOrdenDesc(!ordenDesc)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 transition-all w-full md:w-auto active:scale-95"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
          </svg>
          {ordenDesc ? "Mayor media" : "Menor media"}
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : errorBd ? (
        <div className="bg-red-50 rounded-2xl p-8 text-center border border-red-200 shadow-sm text-red-600 flex flex-col items-center">
          <span className="text-4xl mb-2">🚨</span>
          <p className="font-bold text-lg mb-1">Error de base de datos:</p>
          <p className="font-mono text-sm">{errorBd}</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm text-gray-500 flex flex-col items-center">
          <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
          </svg>
          <p className="font-medium">No se encontraron jugadores.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-8 gap-x-6 justify-center">
            {filtrados.map((j) => (
              <Link
                key={j.id}
                href={`/futbol/jugadores/${j.id}`}
                className="transform hover:-translate-y-2 hover:scale-105 transition-all duration-300 flex justify-center"
              >
                <PlayerCard
                  mini
                  nombre={j.nombre || "Jugador"}
                  posicion={j.posicion_preferida || "MED"}
                  media={j.media_general ?? 65}
                  avatar={j.avatar_url || null}
                  nacionalidad={j.nacionalidad || null}
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}