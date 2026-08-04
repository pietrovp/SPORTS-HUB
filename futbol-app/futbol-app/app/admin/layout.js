"use client";

import "../globals.css"; 
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useEffect, useState } from "react";

export default function GerenciaLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // SOLUCIÓN NUCLEAR: Evitar renderizado de servidor para el layout de admin
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

    const menuItems = [
    { name: "Recepción (POS)", path: "/admin/recepcion", icon: "🎾" },
    { name: "Inventario", path: "/admin/inventario", icon: "📦" },
    { name: "Promociones", path: "/admin/promociones", icon: "🎁" },
    { name: "Historial Ventas", path: "/admin/historial", icon: "🧾" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Si no se ha montado el cliente, mostramos una pantalla vacía del mismo color base
  if (!mounted) {
    return <div className="flex h-screen bg-slate-100 font-sans w-full"></div>;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans w-full">
      {/* MENU LATERAL DESKTOP */}
      <aside className="w-64 bg-slate-950 text-white hidden md:flex flex-col shadow-2xl z-20 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-[#00FF9D] tracking-tighter">SPORTS-HUB</h1>
          <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest">Gerencia de Club</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            return (
              <Link href={item.path} key={item.path}>
                <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                    ? "bg-[#00FF9D] text-slate-950 shadow-lg shadow-emerald-900/20" 
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}>
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
            <span>🚪</span> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* AREA CENTRAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-100">
        {/* CONTENIDO DE LA PAGINA */}
        <div className="flex-1 overflow-y-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}