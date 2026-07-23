"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";

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

function TopStat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {hint ? (
        <p className="mt-2 text-xs leading-6 text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({ badge, title, subtitle }) {
  return (
    <div className="mb-5">
      {badge ? (
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          {badge}
        </div>
      ) : null}

      <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">
        {title}
      </h3>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      ) : null}
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
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Sports Hub · Pádel · Club
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              {club?.name || "Club"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {club?.city || "Ciudad pendiente"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/padel/clubes"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Volver a clubes
            </Link>

            <Link
              href="/padel"
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
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
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/50">
            <p className="text-sm text-slate-600">Cargando club...</p>
          </div>
        ) : !club ? (
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 shadow-sm">
            <h2 className="text-xl font-black tracking-tight text-amber-900">
              Club no encontrado
            </h2>
            <p className="mt-2 text-sm text-amber-800">
              No se pudo cargar el detalle del club para el slug: {slug}
            </p>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
              <div className="relative h-64 overflow-hidden bg-slate-200 md:h-80">
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

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />

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
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Dirección
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {club.address || "Dirección pendiente"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ciudad
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-950">
                    {club.city || "Ciudad pendiente"}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TopStat
                label="Canchas activas"
                value={derived.activeCourts.length}
                hint="Pistas disponibles"
              />
              <TopStat
                label="Partidos programados"
                value={derived.scheduledMatches.length}
                hint="Próximos partidos"
              />
              <TopStat
                label="Partidos jugados"
                value={derived.playedMatches.length}
                hint="Historial registrado"
              />
              <TopStat
                label="Indoor/cubiertas"
                value={derived.indoorCourtsCount}
                hint="Espacios protegidos"
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
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
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-lg font-black tracking-tight text-slate-950">
                          {court.name}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {court.court_number ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                              Nº {court.court_number}
                            </span>
                          ) : null}

                          {court.court_type ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                              {court.court_type}
                            </span>
                          ) : null}

                          {court.surface_type ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                              {court.surface_type}
                            </span>
                          ) : null}

                          {court.has_lighting ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                              Con luz
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Este club todavía no tiene canchas activas cargadas.
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
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
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-lg font-black tracking-tight text-slate-950">
                          {match.match_type
                            ? `Partido ${match.match_type}`
                            : "Partido programado"}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          {formatDate(match.scheduled_at)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {match.location_name || club.address || "Ubicación pendiente"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Ahora mismo no hay partidos programados futuros en este club.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
