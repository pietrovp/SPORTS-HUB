"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

const LABELS = {
  categoria: {
    rookies: "Rookies",
    "7ma": "7ma",
    "6ta": "6ta",
    "5ta": "5ta",
    "4ta": "4ta",
    "3era": "3era",
    "2da": "2da",
    open: "Open",
  },
  estado: {
    pendiente: "⏳ Pendiente",
    aprobada: "✅ Aprobada",
    ajustada: "🔵 Ajustada",
    rechazada: "❌ Rechazada",
  },
};

function ratingPorCategoria(cat) {
  const c = String(cat || "").toLowerCase();
  switch (c) {
    case "rookies": return 1.50;
    case "7ma": return 2.00;
    case "6ta": return 3.00;
    case "5ta": return 4.00;
    case "4ta": return 4.50;
    case "3era": return 5.00;
    case "2da": return 5.50;
    case "open": return 6.00;
    default: return 1.50;
  }
}

function EstadoBadge({ estado }) {
  const styles = {
    pendiente: "border-amber-200 bg-amber-50 text-amber-700",
    aprobada: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ajustada: "border-sky-200 bg-sky-50 text-sky-700",
    rechazada: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles[estado] || styles.pendiente}`}>
      {LABELS.estado[estado] || "Pendiente"}
    </span>
  );
}

export default function AdminCategoriasPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [search, setSearch] = useState("");

  useEffect(() => {
    validarYBuscar();
  }, []);

  async function validarYBuscar() {
    try {
      setLoading(true);
      setErrorMsg("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

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
      await cargarSolicitudes();
    } catch (error) {
      console.error(error);
      setErrorMsg("Error al validar permisos de administrador.");
      setLoading(false);
    }
  }

  async function cargarSolicitudes() {
    try {
      setLoading(true);
      setErrorMsg("");

      // 🔥 ORDEN DE LLEGADA (created_at ASCENDING)
      const { data, error } = await supabase
        .from("padel_profiles")
        .select(`
          id, cuenta_id, categoria_solicitada, categoria_oficial,
          estado_categoria, categoria_comentario_admin, motivo_solicitud, rating,
          mano_habil, posicion, edad, created_at,
          profiles:cuenta_id ( id, nombre, apellido, email )
        `)
        .order("created_at", { ascending: true }); // Primo en llegar, primero en salir

      if (error) throw error;

      const items = (data || []).map((row) => ({
        ...row,
        draft_categoria_oficial: row.categoria_solicitada || row.categoria_oficial || "rookies",
        draft_estado_categoria: row.estado_categoria || "pendiente",
        draft_comentario: row.categoria_comentario_admin || "",
      }));

      setRows(items);
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
      setErrorMsg(error.message || "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }

  async function guardarRevision(row, overrides = {}) {
    try {
      setSavingId(row.id);
      setMensaje("");
      setErrorMsg("");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay sesión activa.");

      const categoriaFinal = overrides.categoria_oficial ?? row.draft_categoria_oficial;
      let estadoFinal = overrides.estado_categoria ?? row.draft_estado_categoria;

      if (estadoFinal === "aprobada" && categoriaFinal !== row.categoria_solicitada) {
        estadoFinal = "ajustada";
      }

      const nuevoRating = (estadoFinal === "aprobada" || estadoFinal === "ajustada")
        ? ratingPorCategoria(categoriaFinal)
        : row.rating || 1.50;

      const payload = {
        categoria_oficial: categoriaFinal,
        estado_categoria: estadoFinal,
        rating: nuevoRating,
        categoria_comentario_admin: overrides.categoria_comentario_admin ?? (row.draft_comentario?.trim() || null),
        categoria_revision_admin: true,
        categoria_revisada_por: user.id,
        categoria_revisada_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("id", row.id);

      if (updateError) throw updateError;

      setMensaje(`✅ Solicitud procesada correctamente: ${LABELS.estado[estadoFinal]}`);
      await cargarSolicitudes();
    } catch (error) {
      console.error("Error al guardar revisión:", error);
      setErrorMsg(error.message || "No se pudo guardar la revisión.");
    } finally {
      setSavingId(null);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const nombreComp = `${row.profiles?.nombre || ""} ${row.profiles?.apellido || ""}`.trim().toLowerCase();
      const email = (row.profiles?.email || "").toLowerCase();
      const searchLower = search.trim().toLowerCase();

      if (filtroEstado !== "todos" && row.estado_categoria !== filtroEstado) return false;
      if (!searchLower) return true;
      return nombreComp.includes(searchLower) || email.includes(searchLower);
    });
  }, [rows, search, filtroEstado]);

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center max-w-md">
          <h2 className="text-xl font-black text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-xs text-slate-500 mb-4">Esta sección requiere permisos de administrador.</p>
          <Link href="/padel" className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs inline-block">
            Volver a Pádel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">Sports Hub · Admin</span>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Revisión de Categorías</h1>
            <p className="text-xs text-slate-500 font-medium">Atención en estricto orden de llegada (FIFO).</p>
          </div>
          <button
            onClick={cargarSolicitudes}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold self-start transition-colors"
          >
            🔄 Recargar Cola
          </button>
        </div>

        {/* NOTIFICACIONES */}
        {mensaje && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex justify-between items-center">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje("")}>✕</button>
          </div>
        )}

        {/* CONTADORES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setFiltroEstado("pendiente")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              filtroEstado === "pendiente" ? "bg-amber-500 text-white border-amber-500 shadow-md" : "bg-white border-slate-200 hover:border-amber-300"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase ${filtroEstado === "pendiente" ? "text-amber-100" : "text-slate-400"}`}>
              ⏳ Pendientes
            </p>
            <p className="text-2xl font-black mt-1">
              {rows.filter((r) => r.estado_categoria === "pendiente").length}
            </p>
          </button>

          <button
            onClick={() => setFiltroEstado("aprobada")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              filtroEstado === "aprobada" ? "bg-emerald-600 text-white border-emerald-600 shadow-md" : "bg-white border-slate-200 hover:border-emerald-300"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase ${filtroEstado === "aprobada" ? "text-emerald-100" : "text-slate-400"}`}>
              ✅ Aprobadas
            </p>
            <p className="text-2xl font-black mt-1">
              {rows.filter((r) => r.estado_categoria === "aprobada").length}
            </p>
          </button>

          <button
            onClick={() => setFiltroEstado("ajustada")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              filtroEstado === "ajustada" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white border-slate-200 hover:border-blue-300"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase ${filtroEstado === "ajustada" ? "text-blue-100" : "text-slate-400"}`}>
              🔵 Ajustadas
            </p>
            <p className="text-2xl font-black mt-1">
              {rows.filter((r) => r.estado_categoria === "ajustada").length}
            </p>
          </button>

          <button
            onClick={() => setFiltroEstado("rechazada")}
            className={`p-4 rounded-2xl border text-left transition-all ${
              filtroEstado === "rechazada" ? "bg-rose-600 text-white border-rose-600 shadow-md" : "bg-white border-slate-200 hover:border-rose-300"
            }`}
          >
            <p className={`text-[10px] font-bold uppercase ${filtroEstado === "rechazada" ? "text-rose-100" : "text-slate-400"}`}>
              ❌ Rechazadas
            </p>
            <p className="text-2xl font-black mt-1">
              {rows.filter((r) => r.estado_categoria === "rechazada").length}
            </p>
          </button>
        </div>

        {/* BUSCADOR */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o correo de jugador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
          />
        </div>

        {/* LISTA DE SOLICITUDES */}
        <div className="space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-bold">Cargando cola de solicitudes...</div>
          ) : filteredRows.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200 text-xs text-slate-400 font-bold space-y-2">
              <span className="text-3xl block">🎉</span>
              <p className="text-sm font-black text-slate-800">No hay solicitudes en este estado</p>
            </div>
          ) : (
            filteredRows.map((row) => {
              const nombreUser = `${row.profiles?.nombre || "Jugador"} ${row.profiles?.apellido || ""}`.trim();
              
              return (
                <div key={row.id} className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900">{nombreUser}</h3>
                        <EstadoBadge estado={row.estado_categoria} />
                      </div>
                      <p className="text-xs font-bold text-slate-400">{row.profiles?.email || "Sin email"}</p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => guardarRevision(row, { categoria_oficial: row.categoria_solicitada, estado_categoria: "aprobada" })}
                        disabled={savingId === row.id}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm"
                      >
                        ✓ Aprobar {row.categoria_solicitada?.toUpperCase()}
                      </button>
                      <button
                        onClick={() => guardarRevision(row, { estado_categoria: "rechazada" })}
                        disabled={savingId === row.id}
                        className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl transition-all"
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Cat. Oficial Actual</span>
                      <span className="font-black text-slate-800">{row.categoria_oficial?.toUpperCase() || "ROOKIES"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Cat. Solicitada</span>
                      <span className="font-black text-blue-600">{row.categoria_solicitada?.toUpperCase() || "ROOKIES"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Rating Numérico</span>
                      <span className="font-black text-slate-800">{Number(row.rating || 1.5).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* MOTIVO DEL JUGADOR */}
                  {row.motivo_solicitud && (
                    <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-2xl text-xs">
                      <span className="text-[10px] font-black uppercase text-amber-800 block tracking-wider mb-0.5">
                        💬 Motivo enviado por el jugador:
                      </span>
                      <p className="font-bold text-amber-950">"{row.motivo_solicitud}"</p>
                    </div>
                  )}

                  {/* AJUSTE MANUAL Y NOTA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Asignar una categoría manualmente:
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={row.draft_categoria_oficial}
                          onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, draft_categoria_oficial: e.target.value } : r))}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                        >
                          {["rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "open"].map((c) => (
                            <option key={c} value={c}>Categoría {c.toUpperCase()}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => guardarRevision(row, { categoria_oficial: row.draft_categoria_oficial, estado_categoria: "ajustada" })}
                          disabled={savingId === row.id}
                          className="px-3 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700"
                        >
                          Ajustar
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Nota para el jugador:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Te aprobamos en 5ta categoría. ¡Éxitos!"
                        value={row.draft_comentario}
                        onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, draft_comentario: e.target.value } : r))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}