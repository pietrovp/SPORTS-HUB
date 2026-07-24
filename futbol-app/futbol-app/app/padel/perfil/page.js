"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import PadelRecentActivity from "./PadelRecentActivity";

const CATEGORY_OPTIONS = {
  principiante: ["rookies", "7ma"],
  intermedio: ["6ta"],
  avanzado: ["5ta", "4ta"],
  profesional: ["3era", "2da", "open"],
};

const DEFAULT_PROFILE = {
  nivel_base: "principiante",
  categoria: "rookies",
  posicion: "drive",
  posicion_preferida: "lado_derecho",
  mano_habil: "derecha",
  horario_preferido: "noche",
  dia_preferido: "fin_de_semana",
  tipo_partido_preferido: ["amistoso"],
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

const TIPOS_VALIDOS = ["amistoso", "competitivo", "mixto"];
const NIVELES_VALIDOS = ["principiante", "intermedio", "avanzado", "profesional"];
const CATEGORIAS_VALIDAS = ["rookies", "7ma", "6ta", "5ta", "4ta", "3era", "2da", "open"];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extraerTipos(value) {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extraerTipos(item));
  }

  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);

    if (parsed !== value) {
      return extraerTipos(parsed);
    }

    return value
      .split(",")
      .map((item) => item.trim().replace(/^"+|"+$/g, ""))
      .filter(Boolean);
  }

  return [];
}

function normalizarTiposPartido(value) {
  const tipos = extraerTipos(value)
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => TIPOS_VALIDOS.includes(item));

  const unicos = [...new Set(tipos)];
  return unicos.length > 0 ? unicos : ["amistoso"];
}

function normalizeMatchRelation(match) {
  if (!match) return null;
  return Array.isArray(match) ? match[0] : match;
}

function normalizeNivelBase(value) {
  const nivel = String(value || "").trim().toLowerCase();

  if (NIVELES_VALIDOS.includes(nivel)) return nivel;
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

function StatCard({ label, value, hint, accent = "from-blue-500 to-cyan-400" }) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/15 bg-white/12 p-5 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className={cx("mb-3 h-1.5 w-14 rounded-full bg-gradient-to-r", accent)} />
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">{label}</p>
      <p className="mt-2 break-words text-3xl font-black text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/70">{hint}</p> : null}
    </div>
  );
}

function InfoCard({ icon, title, value, subtitle }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-2xl">
          <span aria-hidden="true">{icon}</span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 break-words text-lg font-bold text-slate-900">{value}</p>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function PadelPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [baseProfile, setBaseProfile] = useState(null);
  const [padelProfile, setPadelProfile] = useState(null);
  const [matchesData, setMatchesData] = useState([]);
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
          nivel_base: DEFAULT_PROFILE.nivel_base,
          categoria: DEFAULT_PROFILE.categoria,
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

      const nivelBaseNormalizado = normalizeNivelBase(
        finalPadel?.nivel_base || finalPadel?.nivel
      );
      const categoriaNormalizada = normalizeCategoria(
        finalPadel?.categoria || finalPadel?.nivel,
        nivelBaseNormalizado
      );
      const tiposNormalizados = normalizarTiposPartido(finalPadel?.tipo_partido_preferido);

      finalPadel = {
        ...finalPadel,
        nivel_base: nivelBaseNormalizado,
        categoria: categoriaNormalizada,
        tipo_partido_preferido: tiposNormalizados,
      };

      setPadelProfile(finalPadel);
      setForm({
        nivel_base: nivelBaseNormalizado,
        categoria: categoriaNormalizada,
        posicion: finalPadel.posicion || DEFAULT_PROFILE.posicion,
        posicion_preferida: finalPadel.posicion_preferida || DEFAULT_PROFILE.posicion_preferida,
        mano_habil: finalPadel.mano_habil || DEFAULT_PROFILE.mano_habil,
        horario_preferido: finalPadel.horario_preferido || DEFAULT_PROFILE.horario_preferido,
        dia_preferido: finalPadel.dia_preferido || DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido: tiposNormalizados,
      });

      const { data: playedMatches, error: matchesError } = await supabase
        .from("padel_match_players")
        .select(`
          id,
          team,
          joined_at,
          match:padel_matches!inner (
            id,
            status,
            winner_team,
            team_a_score,
            team_b_score,
            scheduled_at
          )
        `)
        .eq("user_id", authUser.id)
        .eq("match.status", "jugado")
        .order("scheduled_at", { referencedTable: "match", ascending: false });

      if (matchesError) throw matchesError;

      setMatchesData(playedMatches || []);
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

      const nivelBase = normalizeNivelBase(form.nivel_base);
      const categoria = normalizeCategoria(form.categoria, nivelBase);
      const tiposNormalizados = normalizarTiposPartido(form.tipo_partido_preferido);

      const payload = {
        nivel_base: nivelBase,
        categoria,
        posicion: form.posicion,
        posicion_preferida: form.posicion_preferida,
        mano_habil: form.mano_habil,
        horario_preferido: form.horario_preferido,
        dia_preferido: form.dia_preferido,
        tipo_partido_preferido: tiposNormalizados,
      };

      const { data, error } = await supabase
        .from("padel_profiles")
        .update(payload)
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      const perfilNormalizado = {
        ...data,
        nivel_base: normalizeNivelBase(data?.nivel_base),
        categoria: normalizeCategoria(data?.categoria, data?.nivel_base),
        tipo_partido_preferido: normalizarTiposPartido(data?.tipo_partido_preferido),
      };

      setPadelProfile(perfilNormalizado);
      setForm({
        nivel_base: perfilNormalizado.nivel_base || DEFAULT_PROFILE.nivel_base,
        categoria: perfilNormalizado.categoria || DEFAULT_PROFILE.categoria,
        posicion: perfilNormalizado.posicion || DEFAULT_PROFILE.posicion,
        posicion_preferida:
          perfilNormalizado.posicion_preferida || DEFAULT_PROFILE.posicion_preferida,
        mano_habil: perfilNormalizado.mano_habil || DEFAULT_PROFILE.mano_habil,
        horario_preferido:
          perfilNormalizado.horario_preferido || DEFAULT_PROFILE.horario_preferido,
        dia_preferido: perfilNormalizado.dia_preferido || DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido: perfilNormalizado.tipo_partido_preferido,
      });

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
    const normalizedMatches = (matchesData || [])
      .map((row) => {
        const match = normalizeMatchRelation(row.match);
        if (!match || match.status !== "jugado") return null;

        return {
          team: row.team,
          winnerTeam: match.winner_team,
          scheduledAt: match.scheduled_at,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    const partidos = normalizedMatches.length;
    const victorias = normalizedMatches.filter(
      (match) => match.winnerTeam && match.winnerTeam === match.team
    ).length;
    const derrotas = Math.max(partidos - victorias, 0);
    const winRate = partidos > 0 ? Math.round((victorias / partidos) * 100) : 0;

    let rachaActual = 0;
    let mejorRacha = 0;

    for (const match of normalizedMatches) {
      const gano = match.winnerTeam && match.winnerTeam === match.team;
      if (gano) {
        rachaActual += 1;
        if (rachaActual > mejorRacha) mejorRacha = rachaActual;
      } else {
        rachaActual = 0;
      }
    }

    return { partidos, victorias, derrotas, winRate, racha: mejorRacha };
  }, [matchesData]);

  function toggleTipoPartido(tipo) {
    setForm((prev) => {
      const actual = normalizarTiposPartido(prev.tipo_partido_preferido);
      const exists = actual.includes(tipo);
      const next = exists ? actual.filter((item) => item !== tipo) : [...actual, tipo];

      return {
        ...prev,
        tipo_partido_preferido: next.length > 0 ? next : ["amistoso"],
      };
    });
  }

  const categoriasDisponibles = CATEGORY_OPTIONS[normalizeNivelBase(form.nivel_base)] || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_28%,#f8fafc_55%,#f8fafc_100%)] px-4 py-6 md:px-6">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-10 w-60 rounded-2xl bg-slate-200" />
          <div className="h-[260px] rounded-[32px] bg-slate-200" />
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="h-[260px] rounded-[32px] bg-slate-200" />
            <div className="h-[260px] rounded-[32px] bg-slate-200 lg:col-span-2" />
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

  const email = user?.email || "Sin correo";
  const nivelBaseLabel = LABELS.nivel_base[padelProfile?.nivel_base] || "Principiante";
  const categoriaLabel = LABELS.categoria[padelProfile?.categoria] || "Rookies";
  const manoLabel = LABELS.mano_habil[padelProfile?.mano_habil] || "Derecha";
  const posicionBaseLabel = LABELS.posicion[padelProfile?.posicion] || "Drive";
  const posicionLabel =
    LABELS.posicion_preferida[padelProfile?.posicion_preferida] || "Lado derecho";
  const horarioLabel =
    LABELS.horario_preferido[padelProfile?.horario_preferido] || "Noche";
  const diaLabel = LABELS.dia_preferido[padelProfile?.dia_preferido] || "Fin de semana";

  const tiposPartido = normalizarTiposPartido(padelProfile?.tipo_partido_preferido);
  const tiposLabel = tiposPartido
    .map((tipo) => LABELS.tipo_partido_preferido[tipo] || tipo)
    .join(", ");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_28%,#f8fafc_55%,#f8fafc_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Sports Hub · Pádel
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              Mi perfil de pádel
            </h1>
          </div>

          <Link
            href="/perfil"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
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

        <section className="rounded-[32px] bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-950 p-6 shadow-[0_30px_80px_-35px_rgba(8,47,73,0.82)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50 backdrop-blur">
                Jugador de pádel
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                {nombre}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/80">
                <span className="break-all">{email}</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/40 md:inline-block" />
                <span>{nivelBaseLabel}</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/40 md:inline-block" />
                <span>Categoría {categoriaLabel}</span>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] md:text-base">
                Configura tus preferencias, revisa tu rendimiento y prepara tu perfil
                para futuros partidos, rankings y progreso dentro del hub.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {!editando ? (
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-cyan-50"
                >
                  Editar perfil
                </button>
              ) : null}

              <Link
                href="/padel"
                className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Ir a pádel
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Nivel base"
              value={nivelBaseLabel}
              hint="Escalón general de desarrollo"
              accent="from-cyan-400 to-blue-400"
            />
            <StatCard
              label="Categoría"
              value={categoriaLabel}
              hint="Tu categoría competitiva actual"
              accent="from-amber-400 to-orange-400"
            />
            <StatCard
              label="Partidos"
              value={estadisticas.partidos}
              hint="Encuentros jugados registrados"
              accent="from-blue-400 to-indigo-400"
            />
            <StatCard
              label="Victorias"
              value={estadisticas.victorias}
              hint={`Derrotas: ${estadisticas.derrotas}`}
              accent="from-emerald-400 to-cyan-400"
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <SectionCard
            title="Preferencias de juego"
            subtitle="Tu perfil deportivo ayuda a encajar mejor en próximos partidos y reservas."
            action={
              !editando ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Perfil activo
                </span>
              ) : null
            }
          >
            {!editando ? (
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard
                  icon="🏅"
                  title="Nivel base"
                  value={nivelBaseLabel}
                  subtitle="Tu nivel general dentro del ecosistema."
                />
                <InfoCard
                  icon="🥇"
                  title="Categoría actual"
                  value={categoriaLabel}
                  subtitle="La referencia principal para jugar y competir."
                />
                <InfoCard
                  icon="👋"
                  title="Mano hábil"
                  value={manoLabel}
                  subtitle="Importante para emparejar mejor los partidos."
                />
                <InfoCard
                  icon="🎯"
                  title="Posición en pista"
                  value={posicionLabel}
                  subtitle={`Base preferida: ${posicionBaseLabel}`}
                />
                <InfoCard
                  icon="🗓️"
                  title="Tipo de partido"
                  value={tiposLabel || "Amistoso"}
                  subtitle="Tu preferencia actual para jugar."
                />
                <InfoCard
                  icon="🌙"
                  title="Horario favorito"
                  value={horarioLabel}
                  subtitle="Franja horaria ideal para jugar."
                />
                <InfoCard
                  icon="📍"
                  title="Día preferido"
                  value={diaLabel}
                  subtitle="Útil para futuras búsquedas y reservas."
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Nivel base</span>
                  <select
                    value={form.nivel_base}
                    onChange={(e) => {
                      const nextNivel = e.target.value;
                      const categoriaInicial =
                        (CATEGORY_OPTIONS[nextNivel] || CATEGORY_OPTIONS.principiante)[0];

                      setForm((prev) => ({
                        ...prev,
                        nivel_base: nextNivel,
                        categoria: categoriaInicial,
                      }));
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                    <option value="profesional">Profesional</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Categoría</span>
                  <select
                    value={normalizeCategoria(form.categoria, form.nivel_base)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        categoria: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                  >
                    {categoriasDisponibles.map((categoria) => (
                      <option key={categoria} value={categoria}>
                        {LABELS.categoria[categoria]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Mano hábil</span>
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
                  <span className="text-sm font-semibold text-slate-700">Posición base</span>
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
                  <span className="text-sm font-semibold text-slate-700">Posición preferida</span>
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
                  <span className="text-sm font-semibold text-slate-700">Horario preferido</span>
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
                  <span className="text-sm font-semibold text-slate-700">Día preferido</span>
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

                <div className="space-y-3 pt-2 md:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Tipo de partido</span>

                  <div className="flex flex-wrap gap-3">
                    {TIPOS_VALIDOS.map((tipo) => {
                      const tiposActuales = normalizarTiposPartido(form.tipo_partido_preferido);
                      const active = tiposActuales.includes(tipo);

                      return (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => toggleTipoPartido(tipo)}
                          className={cx(
                            "rounded-full border px-4 py-2 text-sm font-semibold transition",
                            active
                              ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-200"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {LABELS.tipo_partido_preferido[tipo]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={guardarCambios}
                    disabled={saving}
                    className="rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditando(false);
                      setForm({
                        nivel_base: padelProfile?.nivel_base || DEFAULT_PROFILE.nivel_base,
                        categoria: padelProfile?.categoria || DEFAULT_PROFILE.categoria,
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
                        tipo_partido_preferido: normalizarTiposPartido(
                          padelProfile?.tipo_partido_preferido
                        ),
                      });
                    }}
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <div className="space-y-6">
            <PadelRecentActivity />

            <SectionCard
              title="Progreso"
              subtitle="Un espacio pensado para tu evolución dentro del hub."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] bg-slate-950 p-5 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                    Mejor racha
                  </p>
                  <p className="mt-3 text-4xl font-black">{estadisticas.racha}</p>
                  <p className="mt-2 text-sm text-white/70">
                    Victorias consecutivas registradas hasta ahora.
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Próximamente
                  </p>
                  <p className="mt-3 text-2xl font-black text-slate-900">
                    Ranking y ascenso
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Más adelante aquí podemos mostrar puntos, fiabilidad, ascensos de categoría
                    y evolución competitiva dentro del hub.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
