"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// 1. CONFIGURACIÓN DE RUTAS Y MENÚS
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
      { href: "/futbol/reservar", label: "Reservar" },
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
  const [esDuenoCancha, setEsDuenoCancha] = useState(false);
  const [creditos, setCreditos] = useState(0);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [duenoMenuOpen, setDuenoMenuOpen] = useState(false);
  
  const [confirmandoSalir, setConfirmandoSalir] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  const mobileNavRef = useRef(null);
  const userMenuRef = useRef(null);

  // Cerrar menú de usuario al hacer clic afuera
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
        setEsDuenoCancha(false);
        setCreditos(0);
        return;
      }

      const { data: cuentaData } = await supabase
        .from("profiles")
        .select("nombre, avatar_url, email, is_admin, is_gerente, creditos")
        .eq("id", userId)
        .maybeSingle();

      if (!activo) return;
      
      setCuenta(cuentaData || null);
      setEsAdmin(!!cuentaData?.is_admin);
      setEsGerente(!!cuentaData?.is_gerente);
      setCreditos(cuentaData?.creditos ?? 0);

      if (cuentaData?.is_gerente) {
        const { data: sedeData } = await supabase
          .from("sedes")
          .select("id")
          .eq("owner_id", userId)
          .limit(1);
          
        if (activo && sedeData && sedeData.length > 0) {
          setEsDuenoCancha(true);
        } else {
          setEsDuenoCancha(false);
        }
      }
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

  // Auto-scroll al cambiar de pestaña
  useEffect(() => {
    setMenuOpen(false);
    setAdminMenuOpen(false);
    setDuenoMenuOpen(false);

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
      setEsDuenoCancha(false);
      setCreditos(0);
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
          
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-1.5 group whitespace-nowrap" onClick={() => setMenuOpen(false)}>
              <span className="text-xl md:text-2xl">🏟️</span>
              <span className="text-gray-900 font-black tracking-tight text-base md:text-lg flex items-center gap-1">
                SPORTS <span className="text-gray-500 font-medium hidden sm:inline">HUB</span>
              </span>
            </Link>

            {/* Selector Desktop de Deporte */}
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

          {/* Menú Principal Desktop */}
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

          {/* Iconos a la derecha: RANKING 🏆 + CRÉDITOS + PERFIL */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* BOTÓN DE RANKING DESTACADO EN CABECERA SUPERIOR */}
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

            {/* Mi Cancha solo en Fútbol */}
            {usuario && seccion === "futbol" && esGerente && (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => {
                    if (esDuenoCancha) {
                      setDuenoMenuOpen(!duenoMenuOpen);
                      setAdminMenuOpen(false);
                    } else {
                      router.push("/futbol/admin-canchas");
                    }
                  }}
                  className={`whitespace-nowrap px-3 lg:px-4 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1 transition-colors ${
                    esDuenoCancha 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  }`}
                >
                  {esDuenoCancha ? "Mi Cancha" : "+ Registrar Cancha"}
                  {esDuenoCancha && (
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                {duenoMenuOpen && esDuenoCancha && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg text-xs z-50 overflow-hidden">
                    <Link href="/futbol/admin-canchas" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700" onClick={() => setDuenoMenuOpen(false)}>
                      Gestión de Horarios
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Admin global */}
            {esAdmin && (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => {setAdminMenuOpen(!adminMenuOpen); setDuenoMenuOpen(false);}}
                  className="whitespace-nowrap px-3 lg:px-4 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-100 flex items-center gap-1 transition-colors"
                >
                  Admin
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {adminMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg text-xs z-50 overflow-hidden">
                    {seccion === "padel" ? (
                      <Link href="/padel/admin/categorias" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700" onClick={() => setAdminMenuOpen(false)}>
                        Revisión Categorías
                      </Link>
                    ) : (
                      <>
                        <Link href="/futbol/admin" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700" onClick={() => setAdminMenuOpen(false)}>Crear partido</Link>
                        <Link href="/futbol/admin/pagos" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700 border-t border-gray-100" onClick={() => setAdminMenuOpen(false)}>Pagos</Link>
                        <Link href="/futbol/admin/Logros" className="block w-full text-left px-4 py-3 hover:bg-gray-50 font-semibold text-gray-700 border-t border-gray-100" onClick={() => setAdminMenuOpen(false)}>Crear logros</Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {usuario ? (
              <>
                <Link
                  href={seccion === "padel" ? "/padel" : "/futbol/creditos"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0 shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0 text-amber-500 drop-shadow-sm">
                    <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
                    <path d="m16.6 11.39-2.77-1.23-1.23-2.77a.68.68 0 0 0-.6-.4c-.27-.02-.5.15-.61.39l-1.23 2.67-2.78 1.34c-.23.11-.38.35-.38.61s.16.49.4.6l2.77 1.23 1.23 2.77a.663.663 0 0 0 1.22 0l1.23-2.77 2.77-1.23c.24-.11.4-.35.4-.61s-.16-.5-.4-.61Z" />
                  </svg>
                  <span>{creditos}</span>
                </Link>

                {/* BOTÓN CON MENÚ DESPLEGABLE RESTRUCTURADO (SOLUCIÓN 1) */}
                <div className="relative" ref={userMenuRef}>
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

                  {/* DESPLEGABLE INTELEVENTE DE PERFILES */}
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-2xl shadow-xl z-[110] overflow-hidden text-xs font-bold p-1.5 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                      
                      <div className="px-3 py-2 bg-gray-50/80 rounded-xl border border-gray-100/80 mb-1">
                        <span className="text-[9px] uppercase font-black tracking-wider text-gray-400 block">
                          Sesión iniciada
                        </span>
                        <p className="text-xs font-black text-gray-800 truncate">
                          {cuenta?.nombre || usuario?.email}
                        </p>
                      </div>

                      <div className="px-3 pt-1 pb-0.5 text-[9px] font-black uppercase tracking-wider text-gray-400">
                        Mis Fichas Deportivas
                      </div>

                      {/* Opción Pádel */}
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

                      {/* Opción Fútbol */}
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

                      {/* Opciones Móvil Admin/Gerente */}
                      {seccion === "futbol" && esGerente && (
                        <div className="md:hidden border-b border-gray-100 pb-1">
                          <Link 
                            href="/futbol/admin-canchas"
                            className="block px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-xl" 
                            onClick={() => setMenuOpen(false)}
                          >
                            {esDuenoCancha ? "🏟️ Gestión de Horarios" : "🏟️ Registrar Cancha"}
                          </Link>
                        </div>
                      )}

                      {esAdmin && (
                        <div className="md:hidden border-b border-gray-100 pb-1 bg-violet-50/30 rounded-xl p-1">
                          <p className="px-2 pt-1 text-[9px] font-black text-violet-400 uppercase tracking-widest">Admin</p>
                          {seccion === "padel" ? (
                            <Link href="/padel/admin/categorias" className="block px-2 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 rounded-lg" onClick={() => setMenuOpen(false)}>Revisión Categorías</Link>
                          ) : (
                            <>
                              <Link href="/futbol/admin" className="block px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 rounded-lg" onClick={() => setMenuOpen(false)}>Crear partido</Link>
                              <Link href="/futbol/admin/pagos" className="block px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 rounded-lg" onClick={() => setMenuOpen(false)}>Pagos</Link>
                              <Link href="/futbol/admin/Logros" className="block px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 rounded-lg" onClick={() => setMenuOpen(false)}>Crear logros</Link>
                            </>
                          )}
                        </div>
                      )}

                      {/* Ajustes Globales de Cuenta */}
                      <Link 
                        href="/perfil" 
                        className="flex items-center gap-2 px-3 py-2.5 text-gray-600 hover:bg-gray-50 rounded-xl transition-all" 
                        onClick={() => setMenuOpen(false)}
                      >
                        <span>⚙️</span>
                        <span>Ajustes de Cuenta Global</span>
                      </Link>
                      
                      <div className="border-t border-gray-100 my-1" />

                      {/* Salir */}
                      <button 
                        onClick={() => { setConfirmandoSalir(true); setMenuOpen(false); }} 
                        className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-black"
                      >
                        <span>🚪</span>
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setConfirmandoSalir(true)}
                  title="Cerrar sesión"
                  className="hidden md:block text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-red-50 text-xs font-medium whitespace-nowrap shrink-0"
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="hidden md:flex whitespace-nowrap px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
              >
                Ingresar
              </Link>
            )}

            {!usuario && (
              <button
                className="md:hidden p-2 text-gray-500 hover:text-gray-900 focus:outline-none shrink-0"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* SUB-MENÚ MÓVIL */}
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