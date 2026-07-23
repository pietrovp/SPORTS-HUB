"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) return "Fecha pendiente";

  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Fecha pendiente";
  }
}

function HeroStat({ label, value, hint, accent = "default" }) {
  const accents = {
    default: "text-slate-950",
    emerald: "text-emerald-800",
    blue: "text-sky-800",
    amber: "text-amber-800",
  };

  return (
    <div className="rounded-[24px] border border-white/60 bg-white/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
        {label}
      </p>
      <p className={cx("mt-2 text-3xl font-black tracking-tight", accents[accent] || accents.default)}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-6 text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({ badge, title, subtitle }) {
  return (
    <div className="mb-5">
      {badge ? (
        <div className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
          {badge}
        </div>
      ) : null}

      <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">
        {title}
      </h3>

      {subtitle ? (
        <p className="mt-1 text-sm leading-6 text-stone-600">{subtitle}</p>
      ) : null}
    </div>
  );
}

function SoftCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_16px_38px_rgba(15,23,42,0.06)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export default function PadelClubDetailPage() {
  const params = useParams();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!slug) return;
    loadClub();
  }, [slug]);

  async function loadClub() {
    try {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No hay una sesión activa.");

      const { data, error } = await supabase
        .from("padel_clubs")
        .select(`
          id,
          name,
          slug,
          city,
          address,
          description,
          image_url,
          is_active,
          created_at,
          courts:padel_courts (
            id,
            name,
            court_number,
            surface_type,
            court_type,
            has_lighting,
            is_active
          ),
          matches:padel_matches (
            id,
            status,
            match_type,
            scheduled_at,
            location_name,
            club_id,
            court_id
          )
        `)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error(`No apareció ningún club activo para este slug: ${slug}`);

      setClub(data);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo cargar el club.");
    } finally {
      setLoading(false);
    }
  }

  const derived = useMemo(() => {
    if (!club) {
      return {
        activeCourts: [],
        scheduledMatches: [],
        playedMatches: [],
        indoorCourtsCount: 0,
      };
    }

    const now = new Date();

    const activeCourts = (club.courts || []).filter((court) => court.is_active);

    const scheduledMatches = (club.matches || [])
      .filter((match) => {
        if (match.status !== "programado") return false;
        if (!match.scheduled_at) return false;
        return new Date(match.scheduled_at) >= now;
      })
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

    const playedMatches = (club.matches || []).filter((match) => match.status === "jugado");

    const indoorCourtsCount = activeCourts.filter(
      (court) => court.court_type === "indoor" || court.court_type === "covered"
    ).length;

    return {
      activeCourts,
      scheduledMatches,
      playedMatches,
      indoorCourtsCount,
    };
  }, [club]);

  if (!slug) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5efe7_0%,#f8f5f0_34%,#fbfaf7_65%,#fcfbf8_100%)] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Sports Hub · Pádel · Club
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              {club?.name || "Club"}
            </h1>

            <p className="mt-2 text-sm text-stone-600">
              {club?.city || "Ciudad pendiente"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/padel/clubes"
              className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Volver a clubes
            </Link>

            <Link
              href="/padel"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Ir a pádel
            </Link>
          </div>
        </div>

        {errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : null}

        {loading ? (
          <SoftCard>
            <p className="text-sm text-stone-600">Cargando club...</p>
          </SoftCard>
        ) : !club ? (
          <SoftCard className="border-amber-200 bg-amber-50/90">
            <h2 className="text-xl font-black tracking-tight text-amber-900">
              Club no encontrado
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              No se pudo cargar el detalle del club para el slug: {slug}
            </p>
          </SoftCard>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[34px] border border-stone-200/80 bg-white/80 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.07),transparent_24%)]" />

              <div className="relative h-72 overflow-hidden bg-stone-200 md:h-[26rem]">
                {club.image_url ? (
                  <img
                    src={club.image_url}
                    alt={club.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl">
                    🎾
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/82 via-[#111827]/28 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-8">
                  <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                    Club activo
                  </div>

                  <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
                    {club.name}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-white/85 md:text-base">
                    {club.description || "Club de pádel disponible dentro del hub."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 p-6 md:grid-cols-2 lg:p-8">
                <div className="rounded-[24px] border border-stone-200/80 bg-[#fffdfa] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Dirección
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {club.address || "Dirección pendiente"}
                  </p>
                </div>

                <div className="rounded-[24px] border border-stone-200/80 bg-[#fffdfa] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Ciudad
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {club.city || "Ciudad pendiente"}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <HeroStat
                label="Canchas activas"
                value={derived.activeCourts.length}
                hint="Pistas disponibles"
              />
              <HeroStat
                label="Partidos programados"
                value={derived.scheduledMatches.length}
                hint="Próximos partidos"
                accent="blue"
              />
              <HeroStat
                label="Partidos jugados"
                value={derived.playedMatches.length}
                hint="Historial registrado"
              />
              <HeroStat
                label="Indoor/cubiertas"
                value={derived.indoorCourtsCount}
                hint="Espacios protegidos"
                accent="amber"
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.08fr,0.92fr]">
              <SoftCard>
                <SectionTitle
                  badge="Pistas"
                  title="Canchas"
                  subtitle="Canchas activas cargadas en este club."
                />

                {derived.activeCourts.length > 0 ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {derived.activeCourts.map((court) => (
                      <div
                        key={court.id}
                        className="rounded-[24px] border border-stone-200/80 bg-[#fffdfa] p-4"
                      >
                        <p className="text-lg font-black tracking-tight text-slate-950">
                          {court.name}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {court.court_number ? (
                            <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
                              Nº {court.court_number}
                            </span>
                          ) : null}

                          {court.court_type ? (
                            <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
                              {court.court_type}
                            </span>
                          ) : null}

                          {court.surface_type ? (
                            <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
                              {court.surface_type}
                            </span>
                          ) : null}

                          {court.has_lighting ? (
                            <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
                              Con luz
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-stone-300 bg-stone-50/80 p-6 text-sm text-stone-500">
                    Este club todavía no tiene canchas activas cargadas.
                  </div>
                )}
              </SoftCard>

              <SoftCard>
                <SectionTitle
                  badge="Actividad"
                  title="Próximos partidos"
                  subtitle="Partidos programados asociados a este club."
                />

                {derived.scheduledMatches.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {derived.scheduledMatches.map((match) => (
                      <div
                        key={match.id}
                        className="rounded-[24px] border border-stone-200/80 bg-stone-50/80 p-4"
                      >
                        <p className="text-lg font-black tracking-tight text-slate-950">
                          {match.match_type
                            ? `Partido ${match.match_type}`
                            : "Partido programado"}
                        </p>
                        <p className="mt-2 text-sm text-stone-700">
                          {formatDate(match.scheduled_at)}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {match.location_name || club.address || "Ubicación pendiente"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-stone-300 bg-stone-50/80 p-6 text-sm text-stone-500">
                    Ahora mismo no hay partidos programados futuros en este club.
                  </div>
                )}
              </SoftCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
