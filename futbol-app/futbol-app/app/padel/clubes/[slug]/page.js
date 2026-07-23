import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

export default async function PadelClubDetailPage({ params }) {
  const slug = params?.slug;

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
      created_at
    `)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/padel/clubes"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Volver a clubes
          </Link>

          <Link
            href="/padel"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Ir a pádel
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">Diagnóstico del club</h1>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Slug recibido
              </p>
              <p className="mt-2 text-base font-bold text-slate-900">{slug || "(vacío)"}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Club encontrado
              </p>
              <pre className="mt-2 overflow-auto text-xs text-slate-800">
{JSON.stringify(club, null, 2)}
              </pre>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Error de Supabase
              </p>
              <pre className="mt-2 overflow-auto text-xs text-slate-800">
{JSON.stringify(error, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
