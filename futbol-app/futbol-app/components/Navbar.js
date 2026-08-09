"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const NAV_POR_DEPORTE = {
  home: {
    icono: "🏟️",
    nombre: "Inicio",
    items: [
      { href: "/futbol", label: "⚽ Fútbol" },
      { href: "/padel", label: "🎾 Pádel" },
    ],
  },
  futbol: {
    icono: "⚽",
    nombre: "Fútbol",
    items: [
      { href: "/futbol", label: "Partidos" },
      { href: "/futbol/clubes", label: "Clubes" },
      { href: "/futbol/jugadores", label: "Jugadores" },
      { href: "/futbol/perfil", label: "Mi carta" },
    ],
  },
  padel: {
    icono: "🎾",
    nombre: "Pádel",
    items: [
      { href: "/padel", label: "Inicio" },
      { href: "/padel/partidos", label: "Partidos" },
      { href: "/padel/clubes", label: "Clubes" },
      { href: "/padel/perfil", label: "Estadísticas" },
    ],
  },
};

function seccionActual(pathname) {
  if (!pathname || pathname === "/") return "home";
  if (pathname.startsWith("/futbol")) return "futbol";
  if (pathname.startsWith("/padel")) return "padel";
  return "home"; 
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const seccion = seccionActual(pathname);
  
  const config = NAV_POR_DEPORTE[seccion] || NAV_POR_DEPORTE.home;
  const mainNav = config.items;

  const [usuario, setUsuario] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [esGerente, setEsGerente] = useState(false);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const mobileNavRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let activo = true;

    async function cargarCuenta(userId) {
      if (!userId) {
        if (!activo) return;
        setCuenta(null);
        setEsAdmin(false);
        setEsGerente(false);
        return;
      }

      const { data: cuentaData } = await supabase
        .from("profiles")
        .select("nombre, avatar_url, email, is_admin, is_gerente, club_id")
        .eq("id", userId)
        .maybeSingle();

      if (!activo) return;
      
      setCuenta(cuentaData || null);
      setEsAdmin(!!cuentaData?.is_admin);
      setEsGerente(!!cuentaData?.is_gerente || !!cuentaData?.club_id);
    }

    async function iniciar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!activo) return;
      setUsuario(user ?? null);
      await cargarCuenta(user?.id ?? null);
    }

    iniciar();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

    if (mobileNavRef.current) {
      const elActivo = mobileNavRef.current.querySelector('[data-active="true"]');
      if (elActivo) {
        elActivo.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [pathname]);

  async function salir() {
    if (!supabase || cerrandoSesion) return;
    try {
      setCerrandoSesion(true);
      await supabase.auth.signOut();
      setUsuario(null);
      setCuenta(null);
      setEsAdmin(false);
      setEsGerente(false);
      setConfirmandoSalir(false);
      setMenuOpen(false);
      router.push("/");
      router.refresh();
    } finally {
      setCerrandoSesion(false);
    }
  }

  const avatarUrl = cuenta?.avatar_url || null;
  const inicialAvatar = cuenta?.nombre 
    ? cuenta.nombre.charAt(0).toUpperCase() 
    : (usuario?.email ? usuario.email[0].toUpperCase() : "U");

  return (
    <>
      <nav className="w-full bg-white/90 border-b border-gray-200 sticky top-0 z-[50] backdrop-blur-md shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* LOGO Y SELECTOR DE DEPORTE DESKTOP */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-1.5 group whitespace-nowrap" onClick={() => setMenuOpen(false)}>
              <span className="text-xl md:text-2xl">🏟️</span>
              <span className="text-gray-900 font-black tracking-tight text-base md:text-lg flex items-center gap-1">
                SPORTS <span className="text-gray-500 font-medium hidden sm:inline">HUB</span>
              </span>
            </Link>

            <div className="relative group hidden lg:block">
              <button className="flex items-center gap-1 text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 px-3 py-1.5 rounded-full transition-colors border border-gray-200 whitespace-nowrap">
                <span>{config.icono}</span>
                <span>{config.nombre}</span>
                <svg className="w-3.5 h-3.5 text-gray-500 ml-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* NAVEGACIÓN PRINCIPAL DESKTOP */}
          {mainNav.length > 0 && (
            <div className="hidden md:flex items-center p-1 bg-gray-100/80 rounded-full border border-gray-200/80 shrink-0">
              {mainNav.map(({ href, label }) => {
                const exactlyActive = pathname === href;
                const cleanLabel = label.replace(/⚽ |🎾 /g, "");
                
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`whitespace-nowrap px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-semibold transition-all duration-300 ${
                      exactlyActive
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
                    }`}
                  >
                    {cleanLabel}
                  </Link>
                );
              })}
            </div>
          )}

          {/* ACCIONES DERECHA */}
          <div className="flex items-center gap-2 shrink-0 relative" ref={userMenuRef}>
            
            {seccion === "padel" && (
              <Link
                href="/padel/ranking"
                title="Ver Ranking Oficial"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black transition-all border whitespace-nowrap shrink-0 shadow-sm ${
                  pathname === "/padel/ranking"
                    ? "bg-amber-400 text-slate-950 border-amber-400 shadow-amber-200"
                    : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                }`}
              >
                <span className="text-sm">🏆</span>
                <span className="hidden sm:inline">Ranking</span>
              </Link>
            )}

            {usuario && (esGerente || esAdmin) && (
              <Link
                href="/admin/recepcion"
                className="hidden md:flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-full bg-slate-900 text-[#00FF9D] text-xs font-black hover:bg-slate-800 transition-colors shadow-sm"
              >
                <span>🛒</span>
                <span>Sistema POS</span>
              </Link>
            )}

            {esAdmin && (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                  className="whitespace-nowrap px-3 lg:px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-100 flex items-center gap-1 transition-colors"
                >
                  Admin
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg text-xs z-50 overflow-hidden">
                    <Link href="/admin/gerentes" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700 border-b border-gray-100" onClick={() => setAdminMenuOpen(false)}>
                      👥 Gestión Gerentes POS
                    </Link>
                    {seccion === "padel" ? (
                      <Link href="/padel/admin/categorias" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700" onClick={() => setAdminMenuOpen(false)}>
                        Revisión Categorías
                      </Link>
                    ) : (
                      <>
                        <Link href="/futbol/admin" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700" onClick={() => setAdminMenuOpen(false)}>Crear partido</Link>
                        <Link href="/futbol/admin/Logros" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700 border-t border-gray-100" onClick={() => setAdminMenuOpen(false)}>Crear logros</Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {usuario ? (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className={`flex items-center gap-2 text-xs font-bold pl-1.5 md:pr-3 pr-1.5 py-1.5 rounded-full transition-all border whitespace-nowrap shrink-0 ${
                  menuOpen
                    ? "bg-gray-100 border-gray-300 text-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-[#0B0C15] flex items-center justify-center text-[#00FF9D] font-black text-[10px] shadow-sm overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                  ) : (
                    <span>{inicialAvatar}</span>
                  )}
                </div>
                <span className="hidden md:inline">{cuenta?.nombre || "Mi cuenta"}</span>
                <span className="text-[10px] text-gray-400">▼</span>
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden md:flex whitespace-nowrap px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Ingresar
                </Link>

                <button
                  className="md:hidden p-2 text-gray-700 hover:text-gray-900 focus:outline-none shrink-0"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Abrir menú"
                >
                  {menuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  )}
                </button>
              </>
            )}

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-[110] overflow-hidden text-xs font-bold p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                {usuario ? (
                  <>
                    <div className="px-3 py-2 bg-gray-50/80 rounded-xl border border-gray-100/80 mb-1">
                      <span className="text-[9px] uppercase font-black tracking-wider text-gray-400 block">
                        Sesión iniciada
                      </span>
                      <p className="text-xs font-black text-gray-800 truncate">
                        {cuenta?.nombre || usuario?.email}
                      </p>
                    </div>

                    {(esGerente || esAdmin) && (
                      <Link
                        href="/admin/recepcion"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900 text-[#00FF9D] font-black mb-1"
                      >
                        <span className="flex items-center gap-2">
                          <span>🛒</span>
                          <span>Sistema POS (Gerencia)</span>
                        </span>
                      </Link>
                    )}

                    <div className="px-3 pt-1 pb-0.5 text-[9px] font-black uppercase tracking-wider text-gray-400">
                      Mis Fichas Deportivas
                    </div>

                    <Link
                      href="/padel/perfil"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                        seccion === "padel"
                          ? "bg-blue-50 text-blue-700 font-black border border-blue-100"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🎾</span>
                        <span>Mi Ficha de Pádel</span>
                      </span>
                      {seccion === "padel" && (
                        <span className="text-[9px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full">
                          ACTIVO
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/futbol/perfil"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                        seccion === "futbol"
                          ? "bg-emerald-50 text-emerald-700 font-black border border-emerald-100"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>⚽</span>
                        <span>Mi Carta de Fútbol</span>
                      </span>
                      {seccion === "futbol" && (
                        <span className="text-[9px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full">
                          ACTIVO
                        </span>
                      )}
                    </Link>

                    <div className="border-t border-gray-100 my-1" />

                    <Link 
                      href="/perfil" 
                      className="flex items-center gap-2 px-3 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl transition-all" 
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>⚙️</span>
                      <span>Ajustes de Cuenta Global</span>
                    </Link>
                    
                    <div className="border-t border-gray-100 my-1" />

                    <button 
                      onClick={() => { setConfirmandoSalir(true); setMenuOpen(false); }} 
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-black"
                    >
                      <span>🚪</span>
                      <span>Cerrar Sesión</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2 bg-blue-50/80 rounded-xl border border-blue-100/80 mb-1 text-center">
                      <span className="text-[10px] uppercase font-black tracking-wider text-blue-500 block mb-1">
                        ¡Bienvenido a Sports Hub!
                      </span>
                      <Link
                        href="/login"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs shadow-md transition-all"
                      >
                        <span>🔑</span>
                        <span>Iniciar Sesión / Ingresar</span>
                      </Link>
                    </div>

                    <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase tracking-wider text-gray-400">
                      Cambiar de Deporte
                    </div>

                    <Link
                      href="/futbol"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                        seccion === "futbol"
                          ? "bg-emerald-50 text-emerald-700 font-black border border-emerald-100"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>⚽</span>
                        <span>Fútbol</span>
                      </span>
                      {seccion === "futbol" && (
                        <span className="text-[9px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full">
                          ACTIVO
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/padel"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                        seccion === "padel"
                          ? "bg-blue-50 text-blue-700 font-black border border-blue-100"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🎾</span>
                        <span>Pádel</span>
                      </span>
                      {seccion === "padel" && (
                        <span className="text-[9px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full">
                          ACTIVO
                        </span>
                      )}
                    </Link>
                  </>
                )}
              </div>
            )}

          </div>
        </div>

        {/* NAVEGACIÓN SECUNDARIA HORIZONTAL MÓVIL */}
        {mainNav.length > 0 && (
          <div
            ref={mobileNavRef}
            className="md:hidden w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            <div className="flex items-center justify-around gap-1 px-3 pb-3 pt-1 w-full">
              {mainNav.map(({ href, label }) => {
                const exactlyActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    data-active={exactlyActive}
                    className={`shrink-0 text-center px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
                      exactlyActive
                        ? "bg-[#0B0C15] text-[#00FF9D] shadow-md border border-[#0B0C15]"
                        : "bg-gray-100 text-gray-600 border border-gray-200/80 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* MODAL CERRAR SESIÓN */}
      {confirmandoSalir && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => !cerrandoSesion && setConfirmandoSalir(false)}>
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