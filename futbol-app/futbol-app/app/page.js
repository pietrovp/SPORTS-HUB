"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function HubHome() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Verificamos si el usuario ya tiene sesión iniciada
  useEffect(() => {
    async function chequearSesion() {
      const { data: { user } } = await supabase.auth.getUser();
      setUsuario(user);
      setCargando(false);
    }
    chequearSesion();
  }, []);

  return (
    <main className="min-h-[90vh] bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      
      {/* Animación suave */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>

      {/* Título principal */}
      <div className="text-center max-w-2xl mb-10 animate-slide-up">
        <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4 tracking-tight">
          Elige tu <span className="text-blue-600">Deporte</span>
        </h1>
        <p className="text-lg text-gray-500">
          Fútbol, Pádel y mucho más. Una sola cuenta para dominar la cancha.
        </p>
      </div>

      {/* Botones de sesión / registro (Solo se muestran si NO hay sesión) */}
      {!cargando && !usuario && (
        <div className="flex flex-col sm:flex-row gap-4 mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-2xl bg-white text-gray-900 border border-gray-200 text-sm font-bold hover:bg-gray-50 hover:shadow-md transition-all active:scale-[0.98] text-center"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/login?modo=registro"
            className="px-8 py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] text-center"
          >
            Crear cuenta gratis
          </Link>
        </div>
      )}

      {/* Tarjetas de deportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full animate-slide-up" style={{ animationDelay: '0.2s' }}>
        
        {/* Tarjeta Fútbol */}
        <Link
          href="/futbol"
          className="group relative h-[350px] overflow-hidden rounded-[2rem] shadow-xl shadow-gray-200/50 cursor-pointer transform hover:-translate-y-2 transition-all duration-300"
        >
          {/* Capas de fondo Fútbol */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-900"></div>
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:opacity-60 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          
          <div className="relative p-8 flex flex-col justify-end h-full">
            <div className="mb-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider border border-white/20">
                ⚽ Fútbol
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-2">Pisa la cancha</h2>
              <p className="text-green-50 font-medium text-sm max-w-sm mb-4">
                Organiza partidos, lleva tus estadísticas y mejora tu carta de jugador.
              </p>
              <div className="flex items-center text-green-400 font-bold text-sm group-hover:translate-x-2 transition-transform">
                Entrar al lobby →
              </div>
            </div>
          </div>
        </Link>

        {/* Tarjeta Pádel */}
        <Link
          href="/padel"
          className="group relative h-[350px] overflow-hidden rounded-[2rem] shadow-xl shadow-gray-200/50 cursor-pointer transform hover:-translate-y-2 transition-all duration-300"
        >
          {/* Capas de fondo Pádel (LA IMAGEN QUE ME PASASTE) */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-900"></div>
          <div className="absolute inset-0 bg-[url('https://unsplash.com/photos/Cj35lHL4atY/download?w=1000')] bg-cover bg-center opacity-40 mix-blend-overlay group-hover:opacity-60 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          
          <div className="relative p-8 flex flex-col justify-end h-full">
            <div className="mb-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider border border-white/20">
                🎾 Pádel
              </span>
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-2">Domina la red</h2>
              <p className="text-blue-50 font-medium text-sm max-w-sm mb-4">
                Mide tu nivel, encuentra pareja y reserva pistas fácilmente.
              </p>
              <div className="flex items-center text-blue-400 font-bold text-sm group-hover:translate-x-2 transition-transform">
                Entrar al club →
              </div>
            </div>
          </div>
        </Link>

      </div>
    </main>
  );
}