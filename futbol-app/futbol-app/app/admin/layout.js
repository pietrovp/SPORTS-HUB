"use client";

import "../globals.css"; 
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

export default function GerenciaLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasClub, setHasClub] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);

    async function checkRoleAndClub() {
      if (!supabase) {
        setCheckingRole(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, is_gerente, club_id")
        .eq("id", user.id)
        .maybeSingle();

      const userIsAdmin = !!profile?.is_admin;
      setIsAdmin(userIsAdmin);

      let clubId = profile?.club_id;

      if (!clubId) {
        const { data: clubCreado } = await supabase
          .from("clubs")
          .select("id")
          .eq("created_by", user.id)
          .maybeSingle();

        clubId = clubCreado?.id || null;
      }

      const tieneClub = !!clubId;
      setHasClub(tieneClub);
      setCheckingRole(false);

      if (!userIsAdmin && !tieneClub && pathname !== "/admin/mi-club") {
        router.push("/admin/mi-club");
      }
    }

    checkRoleAndClub();
  }, [pathname, router]);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!mounted || checkingRole) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-white font-bold text-xs uppercase tracking-widest">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#00FF9D] border-t-transparent rounded-full animate-spin" />
          <span>Verificando Credenciales de Gerencia...</span>
        </div>
      </div>
    );
  }

  // AQUÍ SE AGREGÓ "Cierre de Caja"
  const baseMenuItems = (hasClub || isAdmin) ? [
    { name: "Recepción (POS)", path: "/admin/recepcion", icon: "🎾" },
    { name: "Mi Complejo", path: "/admin/mi-club", icon: "🏟️" },
    { name: "Inventario", path: "/admin/inventario", icon: "📦" },
    { name: "Promociones", path: "/admin/promociones", icon: "🎁" },
    { name: "Historial Ventas", path: "/admin/historial", icon: "🧾" },
    { name: "Cierre de Caja", path: "/admin/cierre-caja", icon: "📠" },
  ] : [
    { name: "Configurar Mi Complejo", path: "/admin/mi-club", icon: "🏟️", badge: "Obligatorio" }
  ];

  const menuItems = isAdmin
    ? [...baseMenuItems, { name: "Gestión Gerentes", path: "/admin/gerentes", icon: "👥" }]
    : baseMenuItems;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 font-sans w-full overflow-hidden">
      
      {/* HEADER SUPERIOR EXCLUSIVO PARA MÓVILES */}
      <header className="md:hidden bg-slate-950 text-white p-3.5 border-b border-slate-800 flex items-center justify-between z-30 shrink-0 shadow-md">
        <div>
          <h1 className="text-lg font-black text-[#00FF9D] tracking-tighter">SPORTS-HUB</h1>
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            {isAdmin ? "Admin App" : "Gerencia Club"}
          </p>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="px-3 py-1.5 rounded-xl bg-slate-800 text-[#00FF9D] font-black text-xs border border-slate-700 active:scale-95 transition-all"
        >
          {mobileMenuOpen ? "✕ Cerrar" : "☰ Menú"}
        </button>
      </header>

      {/* DROPDOWN MENÚ NAVEGACIÓN MÓVIL */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 text-white border-b border-slate-800 p-3 space-y-1.5 z-30 shadow-2xl shrink-0 max-h-[75vh] overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link href={item.path} key={item.path} onClick={() => setMobileMenuOpen(false)}>
                <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive 
                    ? "bg-[#00FF9D] text-slate-950 shadow-md" 
                    : "text-slate-300 hover:bg-slate-900"
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-amber-500 text-slate-950 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          <div className="pt-2 border-t border-slate-800 flex gap-2">
            <Link href="/futbol" className="flex-1 text-center px-3 py-2 text-[10px] font-black uppercase text-slate-300 bg-slate-900 rounded-xl border border-slate-800">
              🏟️ App
            </Link>
            <button onClick={handleLogout} className="flex-1 text-center px-3 py-2 text-[10px] font-black uppercase text-rose-400 bg-rose-950/40 rounded-xl border border-rose-900/50">
              🚪 Salir
            </button>
          </div>
        </div>
      )}

      {/* SIDEBAR DESKTOP */}
      <aside className="w-64 bg-slate-950 text-white hidden md:flex flex-col shadow-2xl z-20 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-[#00FF9D] tracking-tighter">SPORTS-HUB</h1>
          <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">
            {isAdmin ? "Super Admin / App Owner" : "Gerencia de Club / POS"}
          </p>
        </div>

        {!hasClub && !isAdmin && (
          <div className="p-4 mx-4 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-[11px] font-bold text-amber-300">
            ⚠️ <strong>Registro Pendiente:</strong> Registra la ficha de tu complejo para habilitar la Recepción y el punto de venta.
          </div>
        )}
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link href={item.path} key={item.path}>
                <div className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                    ? "bg-[#00FF9D] text-slate-950 shadow-lg shadow-emerald-900/20" 
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link href="/futbol" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase text-slate-400 hover:bg-slate-900 hover:text-white rounded-xl transition-all">
            <span>🏟️</span> Volver a la App
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
            <span>🚪</span> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
        <div className="flex-1 overflow-y-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
