"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Fotos libres de Unsplash (Unsplash License: uso comercial permitido, sin
// atribución obligatoria). Si prefieres optimizarlas con next/image, agrega
// "images.unsplash.com" a images.remotePatterns en next.config.js.
const HERO_IMG = "https://images.unsplash.com/photo-1646651105426-e8c8ee9badde?auto=format&fit=crop&w=1740&q=80";
const PADEL_IMG = "https://images.unsplash.com/photo-1646649851800-48dba35edc76?auto=format&fit=crop&w=900&q=80";
const FUTBOL_IMG = "https://images.unsplash.com/photo-1598880513655-d1c6d4b2dfbf?auto=format&fit=crop&w=900&q=80";
const TROFEO_IMG = "https://images.unsplash.com/photo-1578269174936-2709b6aeb913?auto=format&fit=crop&w=900&q=80";

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
        <div className="w-10 h-10 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const esGerenteOAdmin = !!profile?.is_gerente || !!profile?.is_admin || !!profile?.club_id;
  const nombreUsuario = profile?.nombre ? `${profile.nombre} ${profile.apellido || ""}`.trim() : (user?.email || "Deportista");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 px-3 pt-2 sm:pt-4 pb-8 sm:pb-12 space-y-6 sm:space-y-10">

      {/* Tipografía de marca + única animación (ticker) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        .font-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
        .font-brand-mono { font-family: 'Space Mono', monospace; }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-marquee { animation: marquee 24s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-10">

        {/* BANNER B2B / POS (SÓLO VISIBLE PARA GERENTES Y ADMINS) */}
        {esGerenteOAdmin && (
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-slate-800 rounded-xl">🛒</span>
              <div>
                <span className="font-brand-mono text-[9px] uppercase text-[#00FF9D] tracking-widest block">
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

        {/* 1. HERO — foto real a pantalla completa, tipo cartel deportivo */}
        <div className="relative w-full rounded-3xl sm:rounded-[2rem] overflow-hidden shadow-2xl min-h-[420px] sm:min-h-[560px] flex items-end">
          <img
            src={HERO_IMG}
            alt="Jugador golpeando la bola en una pista de pádel"
            className="absolute inset-0 w-full h-full object-cover object-[65%_25%]"
          />
          {/* Degradados para legibilidad: oscuro a la izquierda / abajo, imagen visible a la derecha */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C2A] via-[#0B0C2A]/80 to-transparent sm:to-[#0B0C2A]/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C2A] via-[#0B0C2A]/20 to-transparent" />

          <div className="relative z-10 p-6 sm:p-12 max-w-xl text-white space-y-5">
            <span className="font-brand-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#00FF9D]">
              ● Ecosistema Deportivo
            </span>

            <h1 className="font-display uppercase text-6xl sm:text-8xl leading-[0.85] tracking-tight">
              Juega.<br />
              <span className="text-[#00FF9D]">Compite.</span><br />
              Reserva.
            </h1>

            <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed max-w-md">
              Reserva pistas en tiempo real, encuentra partidas abiertas con jugadores de tu categoría y lleva el control oficial de tus estadísticas.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
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
                  className="px-7 py-3.5 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-[#00FF9D]/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <span>🔑</span>
                  <span>Iniciar Sesión / Registrarse</span>
                </Link>
              )}
            </div>

            {/* Accesos rápidos como chips, no como panel aparte */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/padel/clubes" className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-[11px] font-black uppercase tracking-wide transition-colors">
                🎾 Reservar Pádel
              </Link>
              <Link href="/padel/partidos" className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-[11px] font-black uppercase tracking-wide transition-colors">
                🔍 Buscar Partidos
              </Link>
              <Link href="/futbol" className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-[11px] font-black uppercase tracking-wide transition-colors">
                ⚽ Fútbol
              </Link>
            </div>
          </div>
        </div>

        {/* TICKER — único acento de movimiento, tipo marcador deportivo */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0B0C2A] border border-white/10 py-3">
          <div className="flex whitespace-nowrap animate-marquee w-max">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-6 px-3 font-brand-mono text-[11px] uppercase tracking-[0.25em] text-[#00FF9D]">
                <span>🎾 Comunidad de Pádel</span><span className="text-slate-600">✦</span>
                <span>⚽ Fútbol & Caimanas</span><span className="text-slate-600">✦</span>
                <span>🏆 Ranking Oficial</span><span className="text-slate-600">✦</span>
                <span>📅 Reservas en tiempo real</span><span className="text-slate-600">✦</span>
                <span>🤝 Partidos Abiertos</span><span className="text-slate-600">✦</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. MÓDULOS — tarjetas con foto real de fondo */}
        <div className="space-y-4">
          <div className="px-1">
            <span className="font-brand-mono text-[10px] uppercase tracking-[0.25em] text-blue-600 block">Explora la WebApp</span>
            <h2 className="font-display uppercase text-3xl sm:text-4xl text-slate-900">Módulos Especializados</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* CARD PÁDEL */}
            <div className="relative rounded-3xl overflow-hidden shadow-lg h-[380px] group">
              <img
                src={PADEL_IMG}
                alt="Jugador de pádel sosteniendo la raqueta en la pista"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-950/95 via-blue-950/55 to-blue-950/10" />
              <div className="relative z-10 h-full flex flex-col justify-end p-6 text-white space-y-3">
                <span className="text-3xl">🎾</span>
                <h3 className="font-display uppercase text-3xl leading-[0.9]">Comunidad<br />de Pádel</h3>
                <p className="text-xs text-blue-100/90 font-medium leading-relaxed">
                  Partidos abiertos nivelados por categoría, disponibilidad de pistas y tu rating en el Ranking Oficial.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Link href="/padel/partidos" className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-black text-xs uppercase tracking-wider rounded-xl text-center transition-colors">
                    Ver Partidos Abiertos
                  </Link>
                  <Link href="/padel/clubes" className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-white font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-colors">
                    Directorio de Clubes
                  </Link>
                </div>
              </div>
            </div>

            {/* CARD FÚTBOL */}
            <div className="relative rounded-3xl overflow-hidden shadow-lg h-[380px] group">
              <img
                src={FUTBOL_IMG}
                alt="Grupo de jugadores en un campo de fútbol"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/55 to-emerald-950/10" />
              <div className="relative z-10 h-full flex flex-col justify-end p-6 text-white space-y-3">
                <span className="text-3xl">⚽</span>
                <h3 className="font-display uppercase text-3xl leading-[0.9]">Fútbol &<br />Caimanas</h3>
                <p className="text-xs text-emerald-100/90 font-medium leading-relaxed">
                  Arma partidos, reserva canchas, crea tu carta de jugador y registra estadísticas de cada encuentro.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Link href="/futbol" className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider rounded-xl text-center transition-colors">
                    Ir a Fútbol
                  </Link>
                  <Link href="/futbol/perfil" className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-white font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-colors">
                    Mi Carta de Jugador
                  </Link>
                </div>
              </div>
            </div>

            {/* CARD RANKINGS & ESTADÍSTICAS */}
            <div className="relative rounded-3xl overflow-hidden shadow-lg h-[380px] group">
              <img
                src={TROFEO_IMG}
                alt="Trofeo dorado de campeón"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-amber-950/95 via-amber-950/60 to-amber-950/10" />
              <div className="relative z-10 h-full flex flex-col justify-end p-6 text-white space-y-3">
                <span className="text-3xl">🏆</span>
                <h3 className="font-display uppercase text-3xl leading-[0.9]">Rankings<br />& Nivel</h3>
                <p className="text-xs text-amber-100/90 font-medium leading-relaxed">
                  Suma puntos en encuentros oficiales, sube de categoría y consulta tu posición en la tabla general.
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Link href="/padel/ranking" className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl text-center transition-colors">
                    Ver Ranking Oficial
                  </Link>
                  <Link href="/padel/perfil" className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm text-white font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-colors">
                    Mi Ficha y Estadísticas
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 3. VENTAJAS — franja de íconos con círculos de color */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="font-brand-mono text-[10px] uppercase tracking-[0.25em] text-blue-600 block">Beneficios</span>
            <h2 className="font-display uppercase text-3xl sm:text-4xl text-slate-900">Todo tu deporte conectado en un solo lugar</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-200 flex items-center justify-center text-2xl">⚡</div>
              <h4 className="text-sm font-black text-slate-900">Reservas Inmediatas</h4>
              <p className="text-xs text-slate-500 font-medium max-w-[220px]">Agenda en tiempo real sin esperas ni llamadas telefónicas.</p>
            </div>

            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center text-2xl">📊</div>
              <h4 className="text-sm font-black text-slate-900">Fichas & Rankings</h4>
              <p className="text-xs text-slate-500 font-medium max-w-[220px]">Lleva el registro de tus partidos, victorias, derrotas y nivel competitivo.</p>
            </div>

            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-200 flex items-center justify-center text-2xl">🤝</div>
              <h4 className="text-sm font-black text-slate-900">Partidos Abiertos</h4>
              <p className="text-xs text-slate-500 font-medium max-w-[220px]">¿Te falta gente? Abre tu partido al público para completar la jugada.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}