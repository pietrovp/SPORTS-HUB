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

function StatPill({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  };

  return (
    <div className={cx("rounded-2xl border px-3 py-2", tones[tone] || tones.slate)}>
      <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
      <div className="h-48 animate-pulse bg-slate-200" />
      <div className="space-y-4 p-5">
        <div className="h-6 w-44 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-4 w-28 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm shadow-slate-200/60">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-3xl">
        🎾
      </div>
      <h2 className="mt-4 text-xl font-black text-slate-900">
        No hay clubes cargados todavía
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        Cuando agregues clubes activos en Supabase, aquí aparecerán con sus canchas
        y partidos programados.
      </p>
    </div>
  );
}

export default function PadelClubsPage() {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
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
            club_id,
            court_id,
            location_name
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setClubs(data || []);
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

      const scheduledMatches = (club.matches || []).filter((match) => {
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
        scheduledMatchesCount: scheduledMatches.length,
        indoorCourtsCount: indoorCourts,
        nextMatch,
      };
    });
  }, [clubs]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_28%,#f8fafc_56%,#f8fafc_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Sports Hub · Pádel
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              Clubes y canchas
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Revisa qué clubes están activos, cuántas canchas tienen y si hay partidos
              programados disponibles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/padel"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Volver a pádel
            </Link>

            <Link
              href="/padel/perfil"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Mi perfil
            </Link>
          </div>
        </div>

        {errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : processedClubs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {processedClubs.map((club) => (
              <article
                key={club.id}
                className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm shadow-slate-200/60"
              >
                <div className="relative h-52 w-full overflow-hidden bg-slate-100">
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

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent px-5 pb-5 pt-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                      Club activo
                    </p>
                    <h2 className="mt-2 text-2xl font-black text-white">{club.name}</h2>
                    <p className="mt-1 text-sm text-white/80">
                      {club.city || "Ciudad pendiente"}
                    </p>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div>
                    <p className="text-sm leading-6 text-slate-500">
                      {club.description || "Club de pádel disponible dentro del hub."}
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      {club.address || "Dirección pendiente"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <StatPill
                      label="Canchas activas"
                      value={club.activeCourtsCount}
                      tone="emerald"
                    />
                    <StatPill
                      label="Partidos abiertos"
                      value={club.scheduledMatchesCount}
                      tone="blue"
                    />
                    <StatPill
                      label="Indoor/cubiertas"
                      value={club.indoorCourtsCount}
                      tone="amber"
                    />
                    <StatPill
                      label="Estado"
                      value={club.is_active ? "Activo" : "Inactivo"}
                      tone="slate"
                    />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Próximo partido
                    </p>

                    {club.nextMatch ? (
                      <>
                        <p className="mt-2 text-lg font-black text-slate-900">
                          {club.nextMatch.match_type
                            ? `Partido ${club.nextMatch.match_type}`
                            : "Partido programado"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(club.nextMatch.scheduled_at)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {club.nextMatch.location_name || club.address || "Ubicación pendiente"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Ahora mismo este club no tiene partidos programados futuros.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Resumen de canchas
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
                      <p className="mt-2 text-sm text-slate-500">
                        Este club todavía no tiene canchas activas cargadas.
                      </p>
                    )}
                  </div>

                 <div className="flex flex-wrap gap-3 pt-1">
  <Link
    href={`/padel/clubes/${club.slug}`}
    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
  >
    Ver club
  </Link>

  <Link
    href="/padel/partidos"
    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
  >
    Ver partidos
  </Link>
</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
