"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const NAV_POR_DEPORTE = {
  futbol: {
    icono: "⚽",
    nombre: "Fútbol",
    items: [
      { href: "/futbol", label: "Partidos" },
      { href: "/futbol/jugadores", label: "Jugadores" },
      // ¡Eliminamos el "Créditos" redundante de aquí!
      { href: "/futbol/perfil", label: "Mi carta" },
    ],
  },
  padel: {
    icono: "🎾",
    nombre: "Pádel",
    items: [
      { href: "/padel", label: "Inicio" },
      { href: "/padel/perfil", label: "Mis estadísticas" },
    ],
  },
};

function seccionActual(pathname) {
  if (pathname.startsWith("/futbol")) return "futbol";
  if (pathname.startsWith("/padel")) return "padel";
  return null;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const seccion = seccionActual(pathname);
  const config = seccion ? NAV_POR_DEPORTE[seccion] : null;

  const [usuario, setUsuario] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [creditos, setCreditos] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let activo = true;

    async function cargarCuenta(userId) {
      if (!userId) {
        if (!activo) return;
        setCuenta(null);
        setEsAdmin(false);
        setCreditos(0);
        return;
      }

      const { data: cuentaData } = await supabase
        .from("profiles")
        .select("nombre, avatar_url, email, is_admin, creditos")
        .eq("id", userId)
        .maybeSingle();

      if (!activo) return;
      
      setCuenta(cuentaData || null);
      setEsAdmin(!!cuentaData?.is_admin);
      setCreditos(cuentaData?.creditos ?? 0);
    }

    async function iniciar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!activo) return;
      setUsuario(user ?? null);
      await cargarCuenta(user?.id ?? null);
    }

    iniciar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!activo) return;
      setUsuario(user);
      cargarCuenta(user?.id ?? null);
    });

    return () => {
      activo = false;
      subscription?.unsubscribe();
    };
  }, [seccion]);

  useEffect(() => {
    setMenuOpen(false);
    setAdminMenuOpen(false);
  }, [pathname]);

  async function salir() {
    if (!supabase || cerrandoSesion) return;
    try {
      setCerrandoSesion(true);
      await supabase.auth.signOut();
      setUsuario(null);
      setCuenta(null);
      setEsAdmin(false);
      setCreditos(0);
      setConfirmandoSalir(false);
      setMenuOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setCerrandoSesion(false);
    }
  }

  const mainNav = config?.items || [];
  const avatarUrl = cuenta?.avatar_url || null;
  const inicialAvatar = usuario?.email ? usuario.email[0].toUpperCase() : "U";

  return (
    <>
      <nav className="w-full bg-white/90 border-b border-gray-200 sticky top-0 z-50 backdrop-blur-md transition-all shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/" className="flex items-center gap-1.5 group" onClick={() => setMenuOpen(false)}>
              <span className="text-xl md:text-2xl">🏟️</span>
              <span className="text-gray-900 font-black tracking-tight text-base md:text-lg flex items-center gap-1">
                SPORTS <span className="text-gray-500 font-medium hidden sm:inline">HUB</span>
              </span>
            </Link>

            <div className="relative group hidden lg:block">
              <button className="flex items-center gap-1 text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 px-3 py-1.5 rounded-full transition-colors border border-gray-200">
                {config ? (
                  <>
                    <span>{config.icono}</span>
                    <span>{config.nombre}</span>
                  </>
                ) : (
                  <span>Elige</span>
                )}
                <svg className="w-3.5 h-3.5 text-gray-500 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <div className="absolute top-full left-0 mt-1.5 w-40 bg-white border border-gray-200 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform origin-top-left group-hover:scale-100 scale-95 overflow-hidden z-50">
                <Link href="/futbol" className="flex items-center gap-2 px-4 py-3 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-semibold transition-colors">
                  <span>⚽</span> Fútbol
                </Link>
                <Link href="/padel" className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 hover:text-blue-700 text-sm font-semibold transition-colors border-t border-gray-100">
                  <span>🎾</span> Pádel
                </Link>
              </div>
            </div>
          </div>

          {mainNav.length > 0 && (
            <div className="hidden md:flex items-center p-1 bg-gray-100/80 rounded-full border border-gray-200/80">
              {mainNav.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-4 lg:px-5 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-semibold transition-all duration-300 ${
                      isActive
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="hidden md:flex items-center gap-1.5 lg:gap-3">
            
            {seccion === "futbol" && esAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen((prev) => !prev)}
                  className="px-3 lg:px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                >
                  Admin
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg text-xs z-50 overflow-hidden">
                    <Link href="/futbol/admin" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700" onClick={() => setAdminMenuOpen(false)}>
                      Crear partido
                    </Link>
                    <Link href="/futbol/admin/pagos" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700 border-t border-gray-100" onClick={() => setAdminMenuOpen(false)}>
                      Pagos
                    </Link>
                    <Link href="/futbol/admin/Logros" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700 border-t border-gray-100" onClick={() => setAdminMenuOpen(false)}>
                      Crear logros
                    </Link>
                  </div>
                )}
              </div>
            )}

            {usuario ? (
              <>
                {seccion === "futbol" && (
                  <Link
                    href="/futbol/creditos"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-bold hover:bg-yellow-100 transition-colors whitespace-nowrap"
                  >
                    <span>{creditos} crd.</span>
                  </Link>
                )}

                <Link
                  href="/perfil"
                  className={`flex items-center gap-2 text-xs font-bold pl-1.5 pr-3 py-1.5 rounded-full transition-all border whitespace-nowrap ${
                    pathname === "/perfil"
                      ? "bg-gray-100 border-gray-300 text-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-black text-[10px] shadow-sm overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <span>{inicialAvatar}</span>
                    )}
                  </div>
                  <span className="hidden lg:inline">Mi cuenta</span>
                </Link>

                <button
                  onClick={() => setConfirmandoSalir(true)}
                  title="Cerrar sesión"
                  className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-red-50 text-xs font-medium"
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Ingresar
              </Link>
            )}
          </div>

          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-900 focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 flex flex-col gap-1.5 shadow-lg absolute w-full left-0 z-50">
            <div className="grid grid-cols-2 gap-2 mb-4 pb-4 border-b border-gray-100">
              <Link href="/futbol" className="flex flex-col items-center justify-center gap-1 bg-gray-50 rounded-xl p-3 border border-gray-200 hover:bg-emerald-50 hover:border-emerald-200" onClick={() => setMenuOpen(false)}>
                <span className="text-xl">⚽</span>
                <span className="text-xs font-bold text-gray-700">Fútbol</span>
              </Link>
              <Link href="/padel" className="flex flex-col items-center justify-center gap-1 bg-gray-50 rounded-xl p-3 border border-gray-200 hover:bg-blue-50 hover:border-blue-200" onClick={() => setMenuOpen(false)}>
                <span className="text-xl">🎾</span>
                <span className="text-xs font-bold text-gray-700">Pádel</span>
              </Link>
            </div>
            <Link href="/" className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>
              🏟️ Inicio de Hub
            </Link>
            {mainNav.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link key={href} href={href} className={`px-4 py-3 rounded-xl text-sm font-semibold ${isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`} onClick={() => setMenuOpen(false)}>
                  {label}
                </Link>
              );
            })}
            {seccion === "futbol" && esAdmin && (
              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Panel Admin</span>
                <Link href="/futbol/admin" className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>Crear partido</Link>
                <Link href="/futbol/admin/pagos" className="px-4 py-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>Pagos</Link>
                <Link href="/futbol/admin/Logros" className="px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-sm font-bold text-center" onClick={() => setMenuOpen(false)}>Crear logros</Link>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-gray-100">
              {usuario ? (
                <>
                  {seccion === "futbol" && (
                    <Link href="/futbol/creditos" className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm font-bold" onClick={() => setMenuOpen(false)}>{creditos} créditos</Link>
                  )}
                  <Link href="/perfil" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold" onClick={() => setMenuOpen(false)}>
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white font-black text-xs overflow-hidden">
                      {avatarUrl ? <img src={avatarUrl} alt="Foto" className="w-full h-full object-cover" /> : <span>{inicialAvatar}</span>}
                    </div>
                    Mi cuenta
                  </Link>
                  <button onClick={() => { setConfirmandoSalir(true); setMenuOpen(false); }} className="px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 text-left">Cerrar sesión</button>
                </>
              ) : (
                <Link href="/login" className="px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold text-center hover:bg-blue-700" onClick={() => setMenuOpen(false)}>Ingresar</Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {confirmandoSalir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => !cerrandoSesion && setConfirmandoSalir(false)}>
          <div className="bg-white rounded-3xl shadow-xl max-w-sm w-full p-6 flex flex-col gap-5 border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">👋</div>
              <h3 className="text-xl font-black text-gray-900">¿Cerrar sesión?</h3>
              <p className="text-sm text-gray-500 mt-2">Tendrás que volver a ingresar tus datos para acceder a tu cuenta.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoSalir(false)} disabled={cerrandoSesion} className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
              <button onClick={salir} disabled={cerrandoSesion} className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">{cerrandoSesion ? "Cerrando..." : "Sí, salir"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}