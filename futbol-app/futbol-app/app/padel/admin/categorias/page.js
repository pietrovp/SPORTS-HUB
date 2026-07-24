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
  mano_habil: {
    derecha: "Derecha",
    izquierda: "Izquierda",
    ambidiestro: "Ambidiestro",
    Derecha: "Derecha",
    Izquierda: "Izquierda",
  },
  posicion: {
    drive: "Drive",
    reves: "Revés",
    ambos: "Ambos lados",
    Drive: "Drive",
    Revés: "Revés",
    reves: "Revés",
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

function CounterCard({ title, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <div className={cx("rounded-3xl border p-5", tones[tone] || tones.slate)}>
      <p className="text-xs uppercase tracking-[0.18em] opacity-70">{title}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

export default function AdminCategoriasPage() {
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [search, setSearch] = useState("");

  useEffect(() => {
    validarAcceso();
  }, []);

  async function validarAcceso() {
    try {
      setLoading(true);
      setMensaje("");
      setErrorMsg("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setAuthChecked(true);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nombre, email, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile?.is_admin) {
        setAuthChecked(true);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setAuthChecked(true);
      await cargarSolicitudes();
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo validar el acceso.");
      setAuthChecked(true);
      setIsAdmin(false);
      setLoading(false);
    }
  }

  async function cargarSolicitudes() {
    try {
      setMensaje("");
      setErrorMsg("");

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
          categoria_revision_admin,
          categoria_comentario_admin,
          categoria_revisada_at,
          categoria_revisada_por,
          created_at,
          posicion,
          posicion_preferida,
          mano_habil,
          rating,
          partidos_jugados,
          victorias,
          derrotas,
          profiles:profiles!padel_profiles_id_fkey (
            id,
            nombre,
            apellido,
            email,
            is_admin
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
        const estado = normalizeEstado(item.estado_categoria);

        return {
          ...item,
          nivel_base: nivelBase,
          categoria_solicitada: categoriaSolicitada,
          categoria_oficial: categoriaOficial,
          estado_categoria: estado,
          categoria_comentario_admin: item.categoria_comentario_admin || "",
          draft_categoria_oficial: categoriaOficial,
          draft_estado_categoria: estado,
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

  function aprobarDirecto(row) {
    patchRow(row.id, {
      draft_categoria_oficial: row.categoria_solicitada,
      draft_estado_categoria: "aprobada",
    });
  }

    async function guardarRevision(row) {
    try {
      setSavingId(row.id);
      setMensaje("");
      setErrorMsg("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setErrorMsg("No se pudo obtener la sesión.");
        setSavingId(null);
        return;
      }

      const body = {
        padelProfileId: row.id,
        categoria_oficial: row.draft_categoria_oficial,
        estado_categoria: row.draft_estado_categoria,
        categoria_comentario_admin: row.draft_comentario?.trim() || "",
      };

      const res = await fetch("/api/admin/padel/categorias/revisar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "No se pudo guardar la revisión.");
      }

      const updated = result.data;

      patchRow(row.id, {
        categoria_oficial: updated.categoria_oficial,
        estado_categoria: updated.estado_categoria,
        categoria_revision_admin: updated.categoria_revision_admin,
        categoria_revisada_por: updated.categoria_revisada_por,
        categoria_comentario_admin: updated.categoria_comentario_admin || "",
        categoria_revisada_at: updated.categoria_revisada_at,
        draft_categoria_oficial: updated.categoria_oficial,
        draft_estado_categoria: updated.estado_categoria,
        draft_comentario: updated.categoria_comentario_admin || "",
      });

      setMensaje("Revisión guardada correctamente.");
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo guardar la revisión.");
    } finally {
      setSavingId(null);
    }
  }
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const estadoOk = filtroEstado === "todos" ? true : row.estado_categoria === filtroEstado;

      const nombreCompleto = [
        row?.profiles?.nombre,
        row?.profiles?.apellido,
      ]
        .filter(Boolean)
        .join(" ");

      const bag = [
        nombreCompleto,
        row?.profiles?.email,
        row?.id,
        row?.cuenta_id,
        row?.nivel_base,
        row?.categoria_solicitada,
        row?.categoria_oficial,
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase());

      const q = search.trim().toLowerCase();
      const searchOk = !q ? true : bag.some((value) => value.includes(q));

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

  if (!loading && authChecked && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-[28px] border border-rose-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">
            Acceso restringido
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">
            No tienes permisos de administrador
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Esta sección está disponible solo para usuarios marcados como admin en tu perfil.
          </p>
          <div className="mt-6">
            <Link
              href="/padel"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Volver a pádel
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              Revisa solicitudes pendientes, aprueba categorías o ajusta la categoría oficial
              usada por los partidos de pádel.
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
          <CounterCard title="Total" value={counters.total} tone="slate" />
          <CounterCard title="Pendientes" value={counters.pendiente} tone="amber" />
          <CounterCard title="Aprobadas" value={counters.aprobada} tone="emerald" />
          <CounterCard title="Ajustadas" value={counters.ajustada} tone="sky" />
          <CounterCard title="Rechazadas" value={counters.rechazada} tone="rose" />
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
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

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Buscar jugador</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, email, id, categoría..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
              />
            </label>
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
              const nombreCompleto = [
                row?.profiles?.nombre,
                row?.profiles?.apellido,
              ]
                .filter(Boolean)
                .join(" ");

              const nombre = nombreCompleto || row?.profiles?.email || row?.id;
              const categoriasPermitidas =
                CATEGORY_OPTIONS[normalizeNivelBase(row.nivel_base)] || CATEGORY_OPTIONS.principiante;

              return (
                <article
                  key={row.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-4">
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
                            Categoría solicitada
                          </p>
                          <p className="mt-2 text-lg font-bold text-slate-950">
                            {LABELS.categoria[row.categoria_solicitada] || "Rookies"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Categoría oficial
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

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Email
                          </p>
                          <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                            {row?.profiles?.email || "Sin email"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Mano hábil
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {LABELS.mano_habil[row.mano_habil] || row.mano_habil || "No definida"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Posición
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {LABELS.posicion[row.posicion] || row.posicion || "No definida"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Registro
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            PJ {row.partidos_jugados || 0} · V {row.victorias || 0} · D {row.derrotas || 0}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400">
                        ID jugador: {row.id}
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
