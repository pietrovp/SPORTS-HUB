"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function HomePresentation() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    cargarEstadoUsuario();
  }, []);

  async function cargarEstadoUsuario() {
    try {
      setLoading(true);
      if (!supabase) return;

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("nombre, apellido, is_gerente, is_admin, club_id")
          .eq("id", authUser.id)
          .maybeSingle();

        setProfile(prof || null);
      }
    } catch (err) {
      console.error("Error cargando sesión en Home:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const esGerenteOAdmin = !!profile?.is_gerente || !!profile?.is_admin || !!profile?.club_id;
  const nombreUsuario = profile?.nombre ? `${profile.nombre} ${profile.apellido || ""}`.trim() : (user?.email || "Deportista");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-3 pt-2 sm:pt-4 pb-8 sm:pb-12 space-y-8 sm:space-y-12">
      <div className="mx-auto max-w-7xl space-y-8 sm:space-y-12">

        {/* BANNER B2B / POS (SÓLO VISIBLE PARA GERENTES Y ADMINS) */}
        {esGerenteOAdmin && (
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-slate-800 rounded-xl">🛒</span>
              <div>
                <span className="text-[9px] font-black uppercase text-[#00FF9D] tracking-widest block">
                  Panel de Gerencia B2B Activo
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  Gestión de Recepción, Pistas & Punto de Venta (POS)
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link
                href="/admin/recepcion"
                className="flex-1 sm:flex-initial px-4 py-2 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all text-center shadow-sm"
              >
                Acceder al POS →
              </Link>
              <Link
                href="/admin/mi-club"
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase rounded-xl transition-all text-center border border-slate-700"
              >
                Mi Complejo
              </Link>
            </div>
          </div>
        )}

        {/* 1. HERO PRESENTACIÓN PRINCIPAL */}
        <div className="relative w-full bg-gradient-to-br from-[#0B0C2A] via-[#161848] to-[#0B0C2A] rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl border border-blue-500/20 overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#00FF9D]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4 max-w-2xl">
            <span className="bg-[#00FF9D]/20 border border-[#00FF9D]/40 text-[#00FF9D] text-[10px] sm:text-xs font-black uppercase px-3.5 py-1.5 rounded-full tracking-wider inline-flex items-center gap-1.5">
              <span>🏟️</span> Ecosistema Deportivo
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              La plataforma para <span className="text-[#00FF9D]">Jugar</span>, <span className="text-blue-400">Competir</span> y <span className="text-amber-400">Reservar</span>
            </h1>
            <p className="text-xs sm:text-base text-slate-300 font-medium leading-relaxed">
              Reserva pistas en tiempo real, encuentra partidas abiertas con jugadores de tu categoría y lleva el control oficial de tus estadísticas deportivas.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {user ? (
                <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                  <span className="text-lg">👋</span>
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-300 block uppercase leading-none">Hola</span>
                    <span className="text-xs font-black text-[#00FF9D]">{nombreUsuario}</span>
                  </div>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-6 py-3.5 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>🔑</span>
                  <span>Iniciar Sesión / Registrarse</span>
                </Link>
              )}
            </div>
          </div>

          {/* TARJETA DE ACCESO RÁPIDO JUGADORES */}
          <div className="relative z-10 lg:w-80 shrink-0 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-5 space-y-4">
            <div className="border-b border-white/10 pb-3 flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Acceso Rápido</span>
              <span className="text-xs">⚡</span>
            </div>

            <div className="space-y-2">
              <Link
                href="/padel/clubes"
                className="w-full py-3 px-4 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/30 rounded-xl flex items-center justify-between text-xs font-black transition-colors"
              >
                <span className="flex items-center gap-2"><span>🎾</span> Reservar Pádel</span>
                <span>→</span>
              </Link>

              <Link
                href="/padel/partidos"
                className="w-full py-3 px-4 bg-slate-800/60 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl flex items-center justify-between text-xs font-black transition-colors"
              >
                <span className="flex items-center gap-2"><span>🔍</span> Buscar Partidos</span>
                <span>→</span>
              </Link>

              <Link
                href="/futbol"
                className="w-full py-3 px-4 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/30 rounded-xl flex items-center justify-between text-xs font-black transition-colors"
              >
                <span className="flex items-center gap-2"><span>⚽</span> Fútbol & Partidos</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. MÓDULOS PRINCIPALES DE LA APLICACIÓN */}
        <div className="space-y-4">
          <div className="px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">Explora la WebApp</span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Módulos Especializados</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* CARD PÁDEL */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🎾
                </div>
                <h3 className="text-lg font-black text-slate-900">Comunidad de Pádel</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Encuentra partidos abiertos nivelados por categoría, consulta la disponibilidad de pistas en clubes y sube tu rating en el Ranking Oficial.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/padel/partidos"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl text-center transition-colors"
                >
                  Ver Partidos Abiertos
                </Link>
                <Link
                  href="/padel/clubes"
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-colors"
                >
                  Directorio de Clubes
                </Link>
              </div>
            </div>

            {/* CARD FÚTBOL */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ⚽
                </div>
                <h3 className="text-lg font-black text-slate-900">Fútbol & Caimanas</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Arma partidos de fútbol, reserva canchas con tus amigos, crea tu carta de jugador personalizada y registra estadísticas de cada encuentro.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/futbol"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl text-center transition-colors"
                >
                  Ir a Fútbol
                </Link>
                <Link
                  href="/futbol/perfil"
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-colors"
                >
                  Mi Carta de Jugador
                </Link>
              </div>
            </div>

            {/* CARD RANKINGS & ESTADÍSTICAS (PÚBLICO GENERAL) */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🏆
                </div>
                <h3 className="text-lg font-black text-slate-900">Rankings & Nivel</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Suma puntos en encuentros competitivos oficiales, sube de categoría y consulta tu posición exacta en la tabla general de la región.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  href="/padel/ranking"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl text-center transition-colors"
                >
                  Ver Ranking Oficial
                </Link>
                <Link
                  href="/padel/perfil"
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-colors"
                >
                  Mi Ficha y Estadísticas
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* 3. VENTAJAS */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">Beneficios</span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900">Todo tu deporte conectado en un solo lugar</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
            <div className="space-y-2 text-center sm:text-left">
              <span className="text-3xl block">⚡</span>
              <h4 className="text-sm font-black text-slate-900">Reservas Inmediatas</h4>
              <p className="text-xs text-slate-500 font-medium">Agenda en tiempo real sin esperas ni llamadas telefónicas.</p>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <span className="text-3xl block">📊</span>
              <h4 className="text-sm font-black text-slate-900">Fichas & Rankings</h4>
              <p className="text-xs text-slate-500 font-medium">Lleva el registro de tus partidos, victorias, derrotas y nivel competitivo.</p>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <span className="text-3xl block">🤝</span>
              <h4 className="text-sm font-black text-slate-900">Partidos Abiertos</h4>
              <p className="text-xs text-slate-500 font-medium">¿Te falta gente? Abre tu partido al público para completar la jugada rápidamente.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}