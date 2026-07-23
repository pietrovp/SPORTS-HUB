import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

export async function generateMetadata({ params }) {
  const slug = params?.slug;

  if (!slug) {
    return {
      title: "Club no encontrado | Sports Hub",
      description: "No se pudo cargar el club de pádel.",
    };
  }

  const { data: club } = await supabase
    .from("padel_clubs")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!club) {
    return {
      title: "Club no encontrado | Sports Hub",
      description: "No se pudo cargar el club de pádel.",
    };
  }

  return {
    title: `${club.name} | Pádel | Sports Hub`,
    description: club.description || `Información del club ${club.name}.`,
  };
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

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function PadelClubDetailPage({ params }) {
  const slug = params?.slug;

  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-black text-amber-900">Falta el slug del club</h1>
          <p className="mt-2 text-sm text-amber-800">
            La página se abrió sin slug en la URL.
          </p>
        </div>
      </div>
    );
  }

  const { data: club, error } = await supabase
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

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-6">
          <h1 className="text-2xl font-black text-rose-900">Error cargando el club</h1>
          <pre className="mt-4 overflow-auto rounded-2xl bg-white p-4 text-xs text-rose-800">
{JSON.stringify(error, null, 2)}
          </pre>
          <p className="mt-4 text-sm text-rose-700">Slug recibido: {slug}</p>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-4xl rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-black text-amber-900">Club no encontrado</h1>
          <p className="mt-2 text-sm text-amber-800">
            No apareció ningún club activo para este slug.
          </p>
          <p className="mt-4 text-sm text-amber-800">Slug recibido: {slug}</p>
        </div>
      </div>
    );
  }

  const activeCourts = (club.courts || []).filter((court) => court.is_active);

  const scheduledMatches = (club.matches || [])
    .filter((match) => match.status === "programado")
    .sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));

  const playedMatches = (club.matches || []).filter((match) => match.status === "jugado");

  const indoorCourtsCount = activeCourts.filter(
    (court) => court.court_type === "indoor" || court.court_type === "covered"
  ).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_28%,#f8fafc_56%,#f8fafc_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Sports Hub · Pádel · Club
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
              {club.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {club.city || "Ciudad pendiente"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/padel/clubes"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Volver a clubes
            </Link>

            <Link
              href="/padel"
              className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Ir a pádel
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="relative h-64 w-full overflow-hidden bg-slate-100 md:h-80">
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

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                Club activo
              </span>
              <h2 className="mt-4 text-3xl font-black text-white md:text-5xl">
                {club.name}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                {club.description || "Club de pádel disponible dentro del hub."}
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2">
            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Dirección
              </p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {club.address || "Dirección pendiente"}
              </p>
            </div>

            <div className="rounded-[24px] bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ciudad
              </p>
              <p className="mt-2 text-base font-bold text-slate-900">
                {club.city || "Ciudad pendiente"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Canchas activas"
            value={activeCourts.length}
            hint="Canchas disponibles en el club."
          />
          <StatCard
            label="Partidos programados"
            value={scheduledMatches.length}
            hint="Próximos partidos dentro de este club."
          />
          <StatCard
            label="Partidos jugados"
            value={playedMatches.length}
            hint="Historial ya registrado en este club."
          />
          <StatCard
            label="Indoor/cubiertas"
            value={indoorCourtsCount}
            hint="Canchas interiores o cubiertas."
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            <h3 className="text-xl font-black text-slate-950">Canchas</h3>
            <p className="mt-1 text-sm text-slate-500">
              Resumen de las pistas activas cargadas en este club.
            </p>

            {activeCourts.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {activeCourts.map((court) => (
                  <div
                    key={court.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-lg font-black text-slate-900">{court.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {court.court_number ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Nº {court.court_number}
                        </span>
                      ) : null}

                      {court.court_type ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {court.court_type}
                        </span>
                      ) : null}

                      {court.surface_type ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {court.surface_type}
                        </span>
                      ) : null}

                      {court.has_lighting ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Con luz
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Este club todavía no tiene canchas activas cargadas.
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            <h3 className="text-xl font-black text-slate-950">Próximos partidos</h3>
            <p className="mt-1 text-sm text-slate-500">
              Partidos programados asociados a este club.
            </p>

            {scheduledMatches.length > 0 ? (
              <div className="mt-5 space-y-4">
                {scheduledMatches.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-lg font-black text-slate-900">
                      {match.match_type ? `Partido ${match.match_type}` : "Partido programado"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatDate(match.scheduled_at)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {match.location_name || club.address || "Ubicación pendiente"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Ahora mismo no hay partidos programados futuros en este club.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
