"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_PROFILE = {
  nivel: "intermedio",
  posicion: "drive",
  posicion_preferida: "lado_derecho",
  mano_habil: "derecha",
  horario_preferido: "noche",
  dia_preferido: "fin_de_semana",
  tipo_partido_preferido: ["amistoso"],
};

const LABELS = {
  nivel: {
    principiante: "Principiante",
    intermedio: "Intermedio",
    avanzado: "Avanzado",
    competitivo: "Competitivo",
  },
  posicion: {
    drive: "Drive",
    reves: "Revés",
    ambos: "Ambos lados",
  },
  posicion_preferida: {
    lado_derecho: "Lado derecho",
    lado_izquierdo: "Lado izquierdo",
    indistinto: "Indistinto",
  },
  mano_habil: {
    derecha: "Derecha",
    izquierda: "Izquierda",
    ambidiestro: "Ambidiestro",
  },
  horario_preferido: {
    manana: "Mañana",
    tarde: "Tarde",
    noche: "Noche",
    indistinto: "Indistinto",
  },
  dia_preferido: {
    semana: "Entre semana",
    fin_de_semana: "Fin de semana",
    indistinto: "Indistinto",
  },
  tipo_partido_preferido: {
    amistoso: "Amistoso",
    competitivo: "Competitivo",
    mixto: "Mixto",
  },
};

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/10">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-white">{value}</p>
    </div>
  );
}

function PreferenceCard({ icon, title, value, action }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl">
          <span aria-hidden="true">{icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-xl font-semibold text-slate-900 break-words">{value}</p>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export default function PadelPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [baseProfile, setBaseProfile] = useState(null);
  const [padelProfile, setPadelProfile] = useState(null);
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState(DEFAULT_PROFILE);

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    try {
      setLoading(true);
      setErrorMsg("");
      setMensaje("");

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!authUser) {
        setErrorMsg("No hay una sesión activa.");
        setLoading(false);
        return;
      }

      setUser(authUser);

      const [{ data: profileData, error: profileError }, { data: padelData, error: padelError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
          supabase.from("padel_profiles").select("*").eq("id", authUser.id).maybeSingle(),
        ]);

      if (profileError) throw profileError;
      if (padelError) throw padelError;

      setBaseProfile(profileData || null);

      let finalPadel = padelData;

      if (!finalPadel) {
        const insertPayload = {
          id: authUser.id,
          nivel: DEFAULT_PROFILE.nivel,
          posicion: DEFAULT_PROFILE.posicion,
          posicion_preferida: DEFAULT_PROFILE.posicion_preferida,
          mano_habil: DEFAULT_PROFILE.mano_habil,
          horario_preferido: DEFAULT_PROFILE.horario_preferido,
          dia_preferido: DEFAULT_PROFILE.dia_preferido,
          tipo_partido_preferido: DEFAULT_PROFILE.tipo_partido_preferido,
        };

        const { data: created, error: createError } = await supabase
          .from("padel_profiles")
          .insert(insertPayload)
          .select()
          .single();

        if (createError) throw createError;
        finalPadel = created;
        setMensaje("Perfil de pádel creado correctamente.");
      }

      setPadelProfile(finalPadel);
      setForm({
        nivel: finalPadel.nivel || DEFAULT_PROFILE.nivel,
        posicion: finalPadel.posicion || DEFAULT_PROFILE.posicion,
        posicion_preferida: finalPadel.posicion_preferida || DEFAULT_PROFILE.posicion_preferida,
        mano_habil: finalPadel.mano_habil || DEFAULT_PROFILE.mano_habil,
        horario_preferido: finalPadel.horario_preferido || DEFAULT_PROFILE.horario_preferido,
        dia_preferido: finalPadel.dia_preferido || DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido:
          finalPadel.tipo_partido_preferido?.length > 0
            ? finalPadel.tipo_partido_preferido
            : DEFAULT_PROFILE.tipo_partido_preferido,
      });
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo cargar el perfil de pádel.");
    } finally {
      setLoading(false);
    }
  }

  async function guardarCambios() {
    if (!user) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setMensaje("");

      const payload = {
        nivel: form.nivel,
        posicion: form.posicion,
        posicion_preferida: form.posicion_preferida,
        mano_habil: form.mano_habil,
        horario_preferido: form.horario_preferido,
        dia_preferido: form.dia_preferido,
        tipo_partido_preferido: form.tipo_partido_preferido,
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setPadelProfile(data);
      setEditando(false);
      setMensaje("Preferencias actualizadas correctamente.");
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  const estadisticas = useMemo(() => {
    const partidos = padelProfile?.partidos_jugados ?? 0;
    const victorias = padelProfile?.victorias ?? 0;
    const derrotas = Math.max(partidos - victorias, 0);
    const puntos = padelProfile?.puntos ?? 0;
    const ratio = partidos > 0 ? (victorias / partidos).toFixed(2) : "0.00";

    return {
      partidos,
      victorias,
      derrotas,
      puntos,
      ratio,
    };
  }, [padelProfile]);

  function toggleTipoPartido(tipo) {
    setForm((prev) => {
      const exists = prev.tipo_partido_preferido.includes(tipo);
      const next = exists
        ? prev.tipo_partido_preferido.filter((item) => item !== tipo)
        : [...prev.tipo_partido_preferido, tipo];

      return {
        ...prev,
        tipo_partido_preferido: next.length > 0 ? next : ["amistoso"],
      };
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-8 w-52 rounded-xl bg-slate-200" />
          <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
            <div className="h-[260px] rounded-3xl bg-slate-200" />
            <div className="h-[420px] rounded-3xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  const nombre =
    baseProfile?.nombre ||
    user?.user_metadata?.nombre ||
    user?.email?.split("@")[0] ||
    "Jugador";

  const nivelLabel = LABELS.nivel[padelProfile?.nivel] || "Intermedio";
  const manoLabel = LABELS.mano_habil[padelProfile?.mano_habil] || "Derecha";
  const posicionLabel =
    LABELS.posicion_preferida[padelProfile?.posicion_preferida] || "Lado derecho";
  const horarioLabel =
    LABELS.horario_preferido[padelProfile?.horario_preferido] || "Noche";
  const diaLabel = LABELS.dia_preferido[padelProfile?.dia_preferido] || "Fin de semana";
  const tiposLabel =
    padelProfile?.tipo_partido_preferido?.map((tipo) => LABELS.tipo_partido_preferido[tipo] || tipo).join(", ") ||
    "Amistoso";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Mi perfil de pádel
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Revisa tus estadísticas y ajusta tus preferencias de juego.
            </p>
          </div>

          <Link
            href="/perfil"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Volver a mi cuenta
          </Link>
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

        <div className="grid gap-6 lg:grid-cols-[380px,1fr]">
          <section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-700 via-indigo-600 to-blue-900 p-5 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl font-bold text-white">
                🎾
              </div>

              <div>
                <h2 className="text-3xl font-extrabold text-white">{nombre}</h2>
                <span className="mt-1 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  {nivelLabel}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatBox label="Partidos" value={estadisticas.partidos} />
              <StatBox label="Puntos" value={estadisticas.puntos} />
              <StatBox
                label="Récord V/D"
                value={`${estadisticas.victorias}/${estadisticas.derrotas}`}
              />
              <StatBox label="Ratio" value={estadisticas.ratio} />
            </div>
          </section>

          <section className="space-y-4 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Preferencias de jugador
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Define cómo prefieres jugar para mejorar futuras reservas y partidos.
                </p>
              </div>

              {!editando ? (
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  Editar
                </button>
              ) : null}
            </div>

            {!editando ? (
              <div className="space-y-4">
                <PreferenceCard icon="👋" title="Mano preferida" value={manoLabel} />
                <PreferenceCard icon="📍" title="Posición en pista" value={posicionLabel} />
                <PreferenceCard icon="🏅" title="Tipo de partido" value={tiposLabel} />
                <PreferenceCard icon="🌅" title="Horario de juego preferido" value={horarioLabel} />
                <PreferenceCard icon="📅" title="Día preferido" value={diaLabel} />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Nivel</span>
                  <select
                    value={form.nivel}
                    onChange={(e) => setForm((prev) => ({ ...prev, nivel: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                    <option value="competitivo">Competitivo</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Mano hábil</span>
                  <select
                    value={form.mano_habil}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, mano_habil: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="derecha">Derecha</option>
                    <option value="izquierda">Izquierda</option>
                    <option value="ambidiestro">Ambidiestro</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Posición base</span>
                  <select
                    value={form.posicion}
                    onChange={(e) => setForm((prev) => ({ ...prev, posicion: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="drive">Drive</option>
                    <option value="reves">Revés</option>
                    <option value="ambos">Ambos lados</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Posición preferida</span>
                  <select
                    value={form.posicion_preferida}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        posicion_preferida: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="lado_derecho">Lado derecho</option>
                    <option value="lado_izquierdo">Lado izquierdo</option>
                    <option value="indistinto">Indistinto</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Horario preferido</span>
                  <select
                    value={form.horario_preferido}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        horario_preferido: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="manana">Mañana</option>
                    <option value="tarde">Tarde</option>
                    <option value="noche">Noche</option>
                    <option value="indistinto">Indistinto</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Día preferido</span>
                  <select
                    value={form.dia_preferido}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dia_preferido: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="semana">Entre semana</option>
                    <option value="fin_de_semana">Fin de semana</option>
                    <option value="indistinto">Indistinto</option>
                  </select>
                </label>

                <div className="md:col-span-2 space-y-2">
                  <span className="text-sm font-medium text-slate-700">Tipo de partido</span>

                  <div className="flex flex-wrap gap-3">
                    {["amistoso", "competitivo", "mixto"].map((tipo) => {
                      const active = form.tipo_partido_preferido.includes(tipo);

                      return (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => toggleTipoPartido(tipo)}
                          className={cx(
                            "rounded-full border px-4 py-2 text-sm font-medium transition",
                            active
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {LABELS.tipo_partido_preferido[tipo]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={guardarCambios}
                    disabled={saving}
                    className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditando(false);
                      setForm({
                        nivel: padelProfile?.nivel || DEFAULT_PROFILE.nivel,
                        posicion: padelProfile?.posicion || DEFAULT_PROFILE.posicion,
                        posicion_preferida:
                          padelProfile?.posicion_preferida ||
                          DEFAULT_PROFILE.posicion_preferida,
                        mano_habil: padelProfile?.mano_habil || DEFAULT_PROFILE.mano_habil,
                        horario_preferido:
                          padelProfile?.horario_preferido ||
                          DEFAULT_PROFILE.horario_preferido,
                        dia_preferido:
                          padelProfile?.dia_preferido || DEFAULT_PROFILE.dia_preferido,
                        tipo_partido_preferido:
                          padelProfile?.tipo_partido_preferido?.length > 0
                            ? padelProfile.tipo_partido_preferido
                            : DEFAULT_PROFILE.tipo_partido_preferido,
                      });
                    }}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
