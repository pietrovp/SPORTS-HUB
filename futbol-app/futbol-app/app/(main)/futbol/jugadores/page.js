"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlayerCard from "@/components/futbol/PlayerCard";
import Link from "next/link";

function numeroSeguro(valor, valorPorDefecto = 64) {
  const numero = Number(valor);

  return Number.isFinite(numero)
    ? Math.round(numero)
    : valorPorDefecto;
}

export default function Jugadores() {
  const [jugadores, setJugadores] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [ordenDesc, setOrdenDesc] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [errorBd, setErrorBd] = useState("");

  useEffect(() => {
    let activo = true;

    async function cargarJugadores() {
      if (!supabase) {
        setErrorBd("Supabase no está disponible.");
        setCargando(false);
        return;
      }

      setCargando(true);
      setErrorBd("");

      try {
        const { data, error } = await supabase
          .from("futbol_profiles")
          .select(`
            id,
            posicion,
            rating,
            ritmo,
            tiro,
            pase,
            regate,
            defensa,
            fisico,
            partidos_jugados,
            goles,
            victorias,
            derrotas,
            profiles (
              nombre,
              apellido,
              pais,
              avatar_url
            )
          `);

        if (error) {
          console.error("ERROR JUGADORES:", error);
          throw error;
        }

        const jugadoresMapeados = (data || []).map((jugador) => {
          const perfil = Array.isArray(jugador.profiles)
            ? jugador.profiles[0] || {}
            : jugador.profiles || {};

          return {
            id: jugador.id,
            nombre: perfil.nombre || "Jugador",
            apellido: perfil.apellido || "",
            avatar_url: perfil.avatar_url || null,
            nacionalidad: perfil.pais || null,
            posicion: jugador.posicion || "MED",

            // OVR independiente de los atributos.
            // Empieza en 64 y sube por los logros.
            media: numeroSeguro(jugador.rating, 64),

            // Atributos independientes.
            stats: {
              ritmo: numeroSeguro(jugador.ritmo, 64),
              tiro: numeroSeguro(jugador.tiro, 64),
              pase: numeroSeguro(jugador.pase, 64),
              regate: numeroSeguro(jugador.regate, 64),
              defensa: numeroSeguro(jugador.defensa, 64),
              fisico: numeroSeguro(jugador.fisico, 64),
            },

            partidosJugados: numeroSeguro(
              jugador.partidos_jugados,
              0
            ),

            goles: numeroSeguro(jugador.goles, 0),
            victorias: numeroSeguro(jugador.victorias, 0),
            derrotas: numeroSeguro(jugador.derrotas, 0),
          };
        });

        if (activo) {
          setJugadores(jugadoresMapeados);
        }
      } catch (error) {
        console.error("Error cargando jugadores:", error);

        if (activo) {
          setErrorBd(
            error.message ||
              "No se pudieron cargar los jugadores."
          );
          setJugadores([]);
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarJugadores();

    return () => {
      activo = false;
    };
  }, []);

  const textoBusqueda = busqueda.toLowerCase().trim();

  const filtrados = jugadores
    .filter((jugador) => {
      const nombreCompleto = `${jugador.nombre} ${jugador.apellido}`
        .toLowerCase()
        .trim();

      return nombreCompleto.includes(textoBusqueda);
    })
    .sort((a, b) => {
      return ordenDesc
        ? b.media - a.media
        : a.media - b.media;
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
            🔎
          </span>

          <input
            type="text"
            placeholder="Buscar jugador por nombre o apellido..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
          />
        </div>

        <button
          onClick={() => setOrdenDesc((actual) => !actual)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 transition-all w-full md:w-auto active:scale-95"
        >
          ⇅ {ordenDesc ? "Mayor media" : "Menor media"}
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : errorBd ? (
        <div className="bg-red-50 rounded-2xl p-8 text-center border border-red-200 shadow-sm text-red-600">
          <p className="font-bold text-lg mb-1">
            Error de base de datos
          </p>

          <p className="font-mono text-sm">
            {errorBd}
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm text-gray-500">
          <p className="font-medium">
            No se encontraron jugadores.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-8 gap-x-6 justify-center">
            {filtrados.map((jugador) => (
              <Link
                key={jugador.id}
                href={`/futbol/jugadores/${jugador.id}`}
                className="transform hover:-translate-y-2 hover:scale-105 transition-all duration-300 flex justify-center"
              >
                <PlayerCard
                  mini
                  nombre={jugador.nombre}
                  apellido={jugador.apellido}
                  posicion={jugador.posicion}
                  media={jugador.media}
                  stats={jugador.stats}
                  avatar={jugador.avatar_url}
                  nacionalidad={jugador.nacionalidad}
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}