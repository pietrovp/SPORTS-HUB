"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function AdminGerentesPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [clubes, setClubes] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  // Usar IDs directos es más seguro que objetos completos para los selects
  const [usuarioIdSeleccionado, setUsuarioIdSeleccionado] = useState("");
  const [clubSeleccionado, setClubSeleccionado] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      setMensaje("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      // Cargar lista de clubes
      const { data: clubesData } = await supabase
        .from("clubs")
        .select("id, name, city")
        .order("name", { ascending: true });

      setClubes(clubesData || []);

      // Cargar lista de usuarios
      const { data: usuariosData, error: uErr } = await supabase
        .from("profiles")
        .select("id, nombre, apellido, email, is_admin, is_gerente, club_id")
        .order("nombre", { ascending: true });

      if (uErr) throw uErr;

      setUsuarios(usuariosData || []);
    } catch (err) {
      console.error("Error cargando gerentes:", err);
      setMensaje("Error al cargar datos.");
    } finally {
      setLoading(false);
    }
  }

  async function asignarGerente(e) {
    e.preventDefault();
    if (!usuarioIdSeleccionado || !clubSeleccionado) {
      alert("Selecciona un usuario y un club.");
      return;
    }

    try {
      setGuardando(true);
      setMensaje("");

      const { error } = await supabase
        .from("profiles")
        .update({
          is_gerente: true,
          club_id: clubSeleccionado,
        })
        .eq("id", usuarioIdSeleccionado);

      if (error) throw error;

      // Buscar el nombre para el mensaje de éxito
      const u = usuarios.find(x => x.id === usuarioIdSeleccionado);
      setMensaje(`✅ Se asignó como gerente a ${u?.nombre || u?.email}.`);
      
      // Limpiar formulario
      setUsuarioIdSeleccionado("");
      setClubSeleccionado("");
      
      await cargarDatos();
    } catch (err) {
      console.error(err);
      alert("Error al asignar gerente: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function removerGerente(userItem) {
    if (!confirm(`¿Remover acceso de gerente a ${userItem.nombre || userItem.email}?`)) return;

    try {
      setGuardando(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          is_gerente: false,
          club_id: null,
        })
        .eq("id", userItem.id);

      if (error) throw error;

      setMensaje(`✅ Rol de gerente removido de ${userItem.nombre || userItem.email}.`);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      alert("Error al remover gerente: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Lógica del buscador y filtro de gerentes activos
  const gerentesActuales = usuarios.filter((u) => {
    if (!u.is_gerente) return false;
    
    // Si hay búsqueda, filtrar por nombre o correo
    if (busqueda.trim() !== "") {
      const termino = busqueda.toLowerCase();
      const nomCompleto = `${u.nombre || ''} ${u.apellido || ''} ${u.email}`.toLowerCase();
      return nomCompleto.includes(termino);
    }
    
    return true;
  });

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Cargando gestión de gerentes...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center max-w-md">
          <h2 className="text-xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-xs text-slate-500 mb-4">Esta sección requiere permisos de Super Administrador (App Owner).</p>
          <Link href="/admin/recepcion" className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs inline-block">
            Volver a Recepción
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-end bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Super Admin / App Owner</span>
            <h1 className="text-2xl font-black text-slate-900 mt-0.5">👥 Gestión de Gerentes de Complejos (POS)</h1>
            <p className="text-xs text-slate-500 font-medium">Asigna permisos de gerente y vincula dueños a sus respectivos clubes para acceder al sistema POS.</p>
          </div>
        </div>

        {mensaje && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex justify-between items-center">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje("")}>✕</button>
          </div>
        )}

        {/* VINCULAR NUEVO GERENTE */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
            ➕ Asignar Gerente a Complejo / Club
          </h2>

          <form onSubmit={asignarGerente} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">1. Buscar y seleccionar Usuario</label>
              <select
                value={usuarioIdSeleccionado}
                onChange={(e) => setUsuarioIdSeleccionado(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                required
              >
                <option value="">Selecciona un usuario...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre ? `${u.nombre} ${u.apellido || ""}` : u.email} ({u.email}) {u.is_gerente ? "• [Ya es Gerente]" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">2. Asignar Club / Complejo</label>
              <select
                value={clubSeleccionado}
                onChange={(e) => setClubSeleccionado(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 outline-none"
                required
              >
                <option value="">Selecciona un club...</option>
                {clubes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city || "Sin ciudad"})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={guardando}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Asignar como Gerente POS"}
              </button>
            </div>
          </form>
        </div>

        {/* LISTA DE GERENTES ACTUALES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Gerentes Activos en POS ({gerentesActuales.length})
            </h3>
            <input
              type="text"
              placeholder="🔍 Buscar gerente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none w-48"
            />
          </div>

          {gerentesActuales.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold text-center py-6">No hay gerentes asignados aún o que coincidan con la búsqueda.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {gerentesActuales.map((g) => {
                const club = clubes.find((c) => c.id === g.club_id);
                const esYoMismo = currentUser && g.id === currentUser.id;

                return (
                  <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        {g.nombre ? `${g.nombre} ${g.apellido || ""}` : "Gerente"}
                        {esYoMismo && <span className="ml-2 text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full uppercase">Yo</span>}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">{g.email}</p>
                    </div>

                    <div className="text-right flex items-center gap-4">
                      <div>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 block">
                          {club ? club.name : "Club Asignado"}
                        </span>
                      </div>

                      <button
                        onClick={() => removerGerente(g)}
                        disabled={esYoMismo}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          esYoMismo 
                            ? "text-slate-300 cursor-not-allowed" 
                            : "text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        }`}
                        title={esYoMismo ? "No puedes quitarte a ti mismo" : "Remover rol de gerente"}
                      >
                        Quitar Gerente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}