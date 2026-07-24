"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

const CATEGORY_OPTIONS = {
  principiante: ["rookies", "7ma"],
  intermedio: ["6ta"],
  avanzado: ["5ta", "4ta"],
  profesional: ["3era", "2da", "open"],
};

const LABELS = {
  nivel_base: {
    principiante: "Principiante",
    intermedio: "Intermedio",
    avanzado: "Avanzado",
    profesional: "Profesional",
  },
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
    pendiente: "Pendiente",
    aprobada: "Aprobada",
    ajustada: "Ajustada",
    rechazada: "Rechazada",
  },
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeNivelBase(value) {
  const nivel = String(value || "").trim().toLowerCase();
  if (["principiante", "intermedio", "avanzado", "profesional"].includes(nivel)) return nivel;
  if (nivel === "competitivo") return "profesional";
  return "principiante";
}

function normalizeCategoria(value, nivelBase) {
  const nivel = normalizeNivelBase(nivelBase);
  const permitidas = CATEGORY_OPTIONS[nivel] || CATEGORY_OPTIONS.principiante;
  const categoria = String(value || "").trim().toLowerCase();

  if (permitidas.includes(categoria)) return categoria;
  if (categoria === "principiante") return "rookies";
  if (categoria === "intermedio") return "6ta";
  if (categoria === "avanzado") return "5ta";
  if (categoria === "profesional") return "3era";
  if (categoria === "competitivo") return "3era";

  return permitidas[0];
}

function normalizeEstado(value) {
  const estado = String(value || "").trim().toLowerCase();
  if (["pendiente", "aprobada", "ajustada", "rechazada"].includes(estado)) return estado;
  return "pendiente";
}

function formatFecha(value) {
  if (!value) return "Sin revisión";
  try {
    return new Intl.DateTimeFormat("es-VE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Sin revisión";
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
    <span
      className={cx(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        styles[estado] || styles.pendiente
      )}
    >
      {LABELS.estado[estado] || "Pendiente"}
    </span>
  );
}

export default function AdminCategoriasPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [rows, setRows] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [search, setSearch] = useState("");

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  async function cargarSolicitudes() {
    try {
      setLoading(true);
      setErrorMsg("");
      setMensaje("");

      const { data, error } = await supabase
        .from("padel_profiles")
        .select(`
          id,
          cuenta_id,
          nivel,
          nivel_base,
          categoria,
          categoria_solicitada,
          categoria_oficial,
          estado_categoria,
          categoria_comentario_admin,
          categoria_revisada_at,
          created_at,
          posicion,
          mano_habil,
          profiles:profiles!padel_profiles_id_fkey (
            id,
            nombre,
            username
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((item) => {
        const nivelBase = normalizeNivelBase(item.nivel_base || item.nivel);
        const categoriaSolicitada = normalizeCategoria(
          item.categoria_solicitada || item.categoria || item.nivel,
          nivelBase
        );
        const categoriaOficial = normalizeCategoria(
          item.categoria_oficial || item.categoria || item.nivel,
          nivelBase
        );

        return {
          ...item,
          nivel_base: nivelBase,
          categoria_solicitada: categoriaSolicitada,
          categoria_oficial: categoriaOficial,
          estado_categoria: normalizeEstado(item.estado_categoria),
          categoria_comentario_admin: item.categoria_comentario_admin || "",
          draft_categoria_oficial: categoriaOficial,
          draft_estado_categoria: normalizeEstado(item.estado_categoria),
          draft_comentario: item.categoria_comentario_admin || "",
        };
      });

      setRows(normalized);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }

  function patchRow(id, patch) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function guardarRevision(row) {
    try {
      setSavingId(row.id);
      setMensaje("");
      setErrorMsg("");

      const categoriaFinal = normalizeCategoria(row.draft_categoria_oficial, row.nivel_base);
      let estadoFinal = normalizeEstado(row.draft_estado_categoria);

      if (estadoFinal === "aprobada" && categoriaFinal !== row.categoria_solicitada) {
        estadoFinal = "ajustada";
      }

      const payload = {
        categoria_oficial: categoriaFinal,
        estado_categoria: estadoFinal,
        categoria_comentario_admin: row.draft_comentario?.trim() || null,
        categoria_revisada_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("id", row.id)
        .select()
        .single();

      if (error) throw error;

      patchRow(row.id, {
        ...row,
        categoria_oficial: data.categoria_oficial,
        estado_categoria: data.estado_categoria,
        categoria_comentario_admin: data.categoria_comentario_admin || "",
        categoria_revisada_at: data.categoria_revisada_at,
        draft_categoria_oficial: data.categoria_oficial,
        draft_estado_categoria: data.estado_categoria,
        draft_comentario: data.categoria_comentario_admin || "",
      });

      setMensaje("Revisión guardada correctamente.");
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo guardar la revisión.");
    } finally {
      setSavingId(null);
    }
  }

  function aprobarDirecto(row) {
    patchRow(row.id, {
      draft_categoria_oficial: row.categoria_solicitada,
      draft_estado_categoria: "aprobada",
    });
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const estadoOk = filtroEstado === "todos" ? true : row.estado_categoria === filtroEstado;

      const nombre =
        row?.profiles?.nombre ||
        row?.profiles?.username ||
        row?.cuenta_id ||
        row?.id ||
        "";

      const q = search.trim().toLowerCase();
      const searchOk = !q
        ? true
        : [
            nombre,
            row.id,
            row.categoria_solicitada,
            row.categoria_oficial,
            row.nivel_base,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));

      return estadoOk && searchOk;
    });
  }, [rows, filtroEstado, search]);

  const counters = useMemo(() => {
    return {
      total: rows.length,
      pendiente: rows.filter((r) => r.estado_categoria === "pendiente").length,
      aprobada: rows.filter((r) => r.estado_categoria === "aprobada").length,
      ajustada: rows.filter((r) => r.estado_categoria === "ajustada").length,
      rechazada: rows.filter((r) => r.estado_categoria === "rechazada").length,
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Sports Hub · Admin
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              Revisión de categorías
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Revisa solicitudes, aprueba categorías o ajusta el nivel competitivo oficial de
              cada jugador.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/padel"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              Ir a pádel
            </Link>

            <button
              type="button"
              onClick={cargarSolicitudes}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Recargar
            </button>
          </div>
        </div>

        {mensaje ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{counters.total}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Pendientes</p>
            <p className="mt-3 text-3xl font-black text-amber-900">{counters.pendiente}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Aprobadas</p>
            <p className="mt-3 text-3xl font-black text-emerald-900">{counters.aprobada}</p>
          </div>
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-sky-700">Ajustadas</p>
            <p className="mt-3 text-3xl font-black text-sky-900">{counters.ajustada}</p>
          </div>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Rechazadas</p>
            <p className="mt-3 text-3xl font-black text-rose-900">{counters.rechazada}</p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
            <div>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Filtrar por estado</span>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                >
                  <option value="todos">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="ajustada">Ajustada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
              </label>
            </div>

            <div>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Buscar jugador</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, id, categoría..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500">
              Cargando solicitudes...
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-10 text-center text-slate-500">
              No hay solicitudes para mostrar.
            </div>
          ) : (
            filteredRows.map((row) => {
              const nombre =
                row?.profiles?.nombre ||
                row?.profiles?.username ||
                row?.cuenta_id ||
                row?.id;

              const categoriasPermitidas =
                CATEGORY_OPTIONS[normalizeNivelBase(row.nivel_base)] || CATEGORY_OPTIONS.principiante;

              return (
                <article
                  key={row.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-black text-slate-950">{nombre}</h2>
                        <EstadoBadge estado={row.estado_categoria} />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Nivel base
                          </p>
                          <p className="mt-2 text-lg font-bold text-slate-950">
                            {LABELS.nivel_base[row.nivel_base] || "Principiante"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Solicitada
                          </p>
                          <p className="mt-2 text-lg font-bold text-slate-950">
                            {LABELS.categoria[row.categoria_solicitada] || "Rookies"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Oficial actual
                          </p>
                          <p className="mt-2 text-lg font-bold text-slate-950">
                            {LABELS.categoria[row.categoria_oficial] || "Rookies"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Última revisión
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-700">
                            {formatFecha(row.categoria_revisada_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400">
                        ID: {row.id}
                      </div>
                    </div>

                    <div className="w-full max-w-xl rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => aprobarDirecto(row)}
                            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                          >
                            Aprobar solicitada
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              patchRow(row.id, {
                                draft_estado_categoria: "rechazada",
                              })
                            }
                            className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            Marcar rechazada
                          </button>
                        </div>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700">
                            Categoría oficial
                          </span>
                          <select
                            value={row.draft_categoria_oficial}
                            onChange={(e) =>
                              patchRow(row.id, {
                                draft_categoria_oficial: e.target.value,
                                draft_estado_categoria:
                                  e.target.value === row.categoria_solicitada
                                    ? "aprobada"
                                    : "ajustada",
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                          >
                            {categoriasPermitidas.map((categoria) => (
                              <option key={categoria} value={categoria}>
                                {LABELS.categoria[categoria]}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700">
                            Estado de revisión
                          </span>
                          <select
                            value={row.draft_estado_categoria}
                            onChange={(e) =>
                              patchRow(row.id, {
                                draft_estado_categoria: e.target.value,
                              })
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="aprobada">Aprobada</option>
                            <option value="ajustada">Ajustada</option>
                            <option value="rechazada">Rechazada</option>
                          </select>
                        </label>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700">
                            Comentario admin
                          </span>
                          <textarea
                            rows={4}
                            value={row.draft_comentario}
                            onChange={(e) =>
                              patchRow(row.id, {
                                draft_comentario: e.target.value,
                              })
                            }
                            placeholder="Ejemplo: Te dejamos en 6ta por ahora y luego revisamos con resultados."
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                          />
                        </label>

                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => guardarRevision(row)}
                          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === row.id ? "Guardando..." : "Guardar revisión"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
