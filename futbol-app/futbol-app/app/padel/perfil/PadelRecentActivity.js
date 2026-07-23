"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

function formatDate(dateString) {
  if (!dateString) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function formatScore(teamA, teamB) {
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length === 0 || teamB.length === 0) {
    return null;
  }

  return teamA.map((score, i) => `${score}-${teamB?.[i] ?? 0}`).join(", ");
}

function getOutcome(match, myTeam) {
  if (match.status !== "jugado" || !match.winner_team || !myTeam) return null;
  return match.winner_team === myTeam ? "victoria" : "derrota";
}

function ActivityItem({ item }) {
  const statusLabel = {
    programado: "Próximo",
    jugado: "Jugado",
    cancelado: "Cancelado",
  };

  const badgeClass =
    item.kind === "upcoming"
      ? "bg-blue-50 text-blue-700"
      : item.outcome === "victoria"
      ? "bg-emerald-50 text-emerald-700"
      : item.outcome === "derrota"
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
            {formatDate(item.date)}
          </p>
        </div>

        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badgeClass}`}>
          {statusLabel[item.status] || item.status}
        </span>
      </div>
    </div>
  );
}

export default function PadelRecentActivity() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadActivity();
  }, []);

  async function loadActivity() {
    try {
      setLoading(true);
      setErrorMsg("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No hay sesión activa.");

      const { data, error } = await supabase
        .from("padel_match_players")
        .select(`
          id,
          team,
          joined_at,
          match:padel_matches (
            id,
            match_type,
            status,
            scheduled_at,
            location_name,
            notes,
            team_a_score,
            team_b_score,
            winner_team
          )
        `)
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      const now = new Date();

      const normalized = (data || [])
        .map((row) => {
          const match = Array.isArray(row.match) ? row.match[0] : row.match;
          if (!match) return null;

          const score = formatScore(match.team_a_score, match.team_b_score);
          const outcome = getOutcome(match, row.team);

          if (match.status === "programado" && new Date(match.scheduled_at) >= now) {
            return {
              id: `upcoming-${match.id}`,
              kind: "upcoming",
              title: `Partido ${match.match_type}`,
              subtitle: match.location_name
                ? `Reservado en ${match.location_name}`
                : "Próximo partido programado",
              date: match.scheduled_at,
              status: match.status,
            };
          }

          if (match.status === "jugado") {
            return {
              id: `played-${match.id}`,
              kind: "played",
              title: score ? `Resultado ${score}` : "Partido jugado",
              subtitle: outcome
                ? outcome === "victoria"
                  ? "Ganaste este partido"
                  : "No se pudo ganar este partido"
                : "Resultado registrado",
              date: match.scheduled_at,
              outcome,
              status: match.status,
            };
          }

          return {
            id: `other-${match.id}`,
            kind: "other",
            title: `Partido ${match.match_type}`,
            subtitle: match.location_name || match.notes || "Actividad registrada",
            date: match.scheduled_at,
            status: match.status,
          };
        })
        .filter(Boolean);

      const upcoming = normalized
        .filter((item) => item.kind === "upcoming")
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 1);

      const played = normalized
        .filter((item) => item.kind === "played")
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 4);

      const other = normalized
        .filter((item) => item.kind === "other")
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 2);

      setItems([...upcoming, ...played, ...other]);
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || "No se pudo cargar la actividad reciente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Actividad reciente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tus últimos partidos y el próximo juego programado.
          </p>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-[22px] bg-slate-100" />
            <div className="h-24 animate-pulse rounded-[22px] bg-slate-100" />
            <div className="h-24 animate-pulse rounded-[22px] bg-slate-100" />
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMsg}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
              🎾
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">
              Todavía no hay actividad para mostrar
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Cuando juegues o reserves partidos de pádel, aquí verás tus resultados
              recientes y tu próximo encuentro.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
