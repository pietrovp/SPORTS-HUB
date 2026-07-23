"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

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

function getClubStatus(club) {
  if (club.scheduledMatchesCount > 0) {
    return {
      label: "Con actividad",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Disponible",
    className:
      "border-slate-200 bg-slate-100 text-slate-700",
  };
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function TopStat({ label, value, accent = "slate" }) {
  const accents = {
    slate: "text-slate-950",
    emerald: "text-emerald-700",
    blue: "text-sky-700",
    amber: "text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={cx("mt-2 text-2xl font-black tracking-tight", accents[accent] || accents.slate)}>
        {value}
      </p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
      <div className="h-48 animate-pulse bg-slate-200" />
      <div className="space-y-4 p-6">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        </div>
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm shadow-slate-200/50">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        🎾
      </div>
      <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
        No hay clubes cargados
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        Cuando agregues clubes activos en Supabase, aquí aparecerán con sus canchas,
        actividad reciente y próximos partidos.
      </p>
    </div>
  );
}

export default function PadelClubsPage() {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadClubs();
  }, []);

  async function loadClubs() {
    try {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No hay una sesión activa.");

      const [{ data: clubsData, error: clubsError }, { data: matchesData, error: matchesError }] =
        await Promise.all([
          supabase
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
              )
            `)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("padel_matches")
            .select(`
              id,
              status,
              match_type,
              scheduled_at,
              club_id,
              court_id,
              location_name
            `),
        ]);

      if (clubsError) throw clubsError;
      if (matchesError) throw matchesError;

      setClubs(clubsData || []);
      setMatches(matchesData || []);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudieron cargar los clubes.");
    } finally {
      setLoading(false);
    }
  }

  const processedClubs = useMemo(() => {
    const now = new Date();

    return (clubs || []).map((club) => {
      const activeCourts = (club.courts || []).filter((court) => court.is_active);

      const clubMatches = (matches || []).filter((match) => match.club_id === club.id);

      const scheduledMatches = clubMatches.filter((match) => {
        if (match.status !== "programado") return false;
        if (!match.scheduled_at) return false;
        return new Date(match.scheduled_at) >= now;
      });

      const nextMatch = [...scheduledMatches].sort(
        (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
      )[0];

      const indoorCourts = activeCourts.filter(
        (court) => court.court_type === "indoor" || court.court_type === "covered"
      ).length;

      return {
        ...club,
        activeCourts,
        activeCourtsCount: activeCourts.length,
        allMatchesCount: clubMatches.length,
        scheduledMatchesCount: scheduledMatches.length,
        indoorCourtsCount: indoorCourts,
        nextMatch,
      };
    });
  }, [clubs, matches]);

  const summary = useMemo(() => {
    const totalClubs = processedClubs.length;
    const totalCourts = processedClubs.reduce((acc, club) => acc + club.activeCourtsCount, 0);
    const totalOpenMatches = processedClubs.reduce(
      (acc, club) => acc + club.scheduledMatchesCount,
      0
    );
    const totalIndoorCourts = processedClubs.reduce(
      (acc, club) => acc + club.indoorCourtsCount,
      0
    );

    return {
      totalClubs,
      totalCourts,
      totalOpenMatches,
      totalIndoorCourts,
    };
  }, [processedClubs]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.15fr,0.85fr] lg:p-8">
            <div className="min-w-0">
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Sports Hub · Pádel
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Clubes y canchas
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-[15px]">
                Explora los clubes activos, revisa la disponibilidad de canchas y consulta
                qué sedes ya tienen movimiento competitivo dentro del hub.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/padel"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Volver a pádel
                </Link>

                <Link
                  href="/padel/perfil"
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Mi perfil
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TopStat label="Clubes activos" value={summary.totalClubs} />
              <TopStat label="Canchas activas" value={summary.totalCourts} accent="emerald" />
              <TopStat label="Partidos abiertos" value={summary.totalOpenMatches} accent="blue" />
              <TopStat label="Indoor/cubiertas" value={summary.totalIndoorCourts} accent="amber" />
            </div>
          </div>
        </section>

        {errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : processedClubs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {processedClubs.map((club) => {
              const status = getClubStatus(club);

              return (
                <article
                  key={club.id}
                  className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/50 transition hover:shadow-md hover:shadow-slate-300/40"
                >
                  <div className="relative h-56 overflow-hidden bg-slate-200">
                    {club.image_url ? (
                      <img
                        src={club.image_url}
                        alt={club.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-5xl">
                        🎾
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />

                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <div
                        className={cx(
                          "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                          status.className
                        )}
                      >
                        {status.label}
                      </div>

                      <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
                        {club.name}
                      </h2>

                      <p className="mt-1 text-sm text-white/80">
                        {club.city || "Ciudad pendiente"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5 p-6">
                    <div className="border-b border-slate-200 pb-5">
                      <p className="text-sm leading-7 text-slate-600">
                        {club.description || "Club de pádel disponible dentro del hub."}
                      </p>
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        {club.address || "Dirección pendiente"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <StatCard
                        label="Canchas activas"
                        value={club.activeCourtsCount}
                        hint="Pistas disponibles"
                      />
                      <StatCard
                        label="Partidos abiertos"
                        value={club.scheduledMatchesCount}
                        hint="Programados y futuros"
                      />
                      <StatCard
                        label="Indoor/cubiertas"
                        value={club.indoorCourtsCount}
                        hint="Espacios protegidos"
                      />
                      <StatCard
                        label="Actividad total"
                        value={club.allMatchesCount}
                        hint="Partidos registrados"
                      />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Próximo partido
                        </p>

                        {club.nextMatch ? (
                          <>
                            <p className="mt-3 text-lg font-black tracking-tight text-slate-950">
                              {club.nextMatch.match_type
                                ? `Partido ${club.nextMatch.match_type}`
                                : "Partido programado"}
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                              {formatDate(club.nextMatch.scheduled_at)}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {club.nextMatch.location_name ||
                                club.address ||
                                "Ubicación pendiente"}
                            </p>
                          </>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-500">
                            Este club todavía no tiene partidos programados futuros.
                          </p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Canchas disponibles
                        </p>

                        {club.activeCourtsCount > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {club.activeCourts.map((court) => (
                              <span
                                key={court.id}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                              >
                                {court.name}
                                {court.court_type ? ` · ${court.court_type}` : ""}
                                {court.has_lighting ? " · luz" : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-500">
                            Este club todavía no tiene canchas activas cargadas.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                      <Link
                        href={`/padel/clubes/${club.slug}`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Ver club
                      </Link>

                      <Link
                        href="/padel/partidos"
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Ver partidos
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
