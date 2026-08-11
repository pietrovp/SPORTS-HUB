"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

function normalizeMatch(match) {
  if (!match) return null;
  return Array.isArray(match) ? match[0] ?? null : match;
}

function ActivityItem({ item }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const statusLabel = {
    programado: "Próximo",
    jugado: "Jugado",
    cancelado: "Cancelado",
  };

  const isPlayed = item.kind === "played" && (item.outcome === "victoria" || item.outcome === "derrota");

  const badgeClass =
    item.kind === "upcoming"
      ? "bg-blue-50 text-blue-700"
      : item.outcome === "victoria"
      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer transition-colors"
      : item.outcome === "derrota"
      ? "bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer transition-colors"
      : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
            {formatDate(item.date)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <button
            type={isPlayed ? "button" : "submit"}
            onClick={() => {
              if (isPlayed) setShowDetails(!showDetails);
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold flex flex-col items-center justify-center ${badgeClass}`}
            style={isPlayed ? { minWidth: '40px', minHeight: '40px', borderRadius: '50%' } : {}}
          >
            {isPlayed ? (
              <span className="text-lg leading-none">{item.outcome === "victoria" ? "V" : "D"}</span>
            ) : (
              <span>{statusLabel[item.status] || item.status}</span>
            )}
          </button>
        </div>
      </div>

      {showDetails && isPlayed && (
        <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
            <div>
              <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Marcador Final</span>
              <span className="text-sm font-black text-slate-800">{item.scoreLabel || "Resultado no disponible"}</span>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo de Partido</span>
              <span className="text-[11px] font-bold text-slate-600 capitalize">{item.matchType}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PadelRecentActivity({ userId }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    loadActivity(userId);
  }, [userId]);

  async function loadActivity(currentUserId) {
    try {
      setLoading(true);
      setErrorMsg("");

      // Modificado para usar 'match:matches' dado tu esquema SQL real
      const { data, error } = await supabase
        .from("match_players")
        .select(`
          id,
          team,
          joined_at,
          match:matches (
            id,
            match_type,
            is_competitive,
            status,
            scheduled_at,
            location_name,
            notes,
            team_a_score,
            team_b_score,
            winner_team,
            score_text
          )
        `)
        .eq("user_id", currentUserId)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      const now = new Date();

      const normalized = (data || [])
        .map((row) => {
          const match = normalizeMatch(row.match);
          if (!match) return null;

          // 🔴 FILTRO: IGNORAR PARTIDOS AMISTOSOS O NO COMPETITIVOS JUGADOS
          if (match.status === "jugado" && (!match.is_competitive || match.match_type === "amistoso")) {
            return null; // Omitimos este partido del historial de ranking
          }

          const scoreArrFormat = formatScore(match.team_a_score, match.team_b_score);
          const finalScoreLabel = match.score_text || scoreArrFormat;
          const outcome = getOutcome(match, row.team);

          if (match.status === "programado" && match.scheduled_at && new Date(match.scheduled_at) >= now) {
            return {
              id: `upcoming-${match.id}`,
              kind: "upcoming",
              title: `Partido ${match.match_type || "amistoso"}`,
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
              title: "Partido de Ranking (Oficial)",
              subtitle: outcome
                ? outcome === "victoria"
                  ? "Victoria suma puntos al rating"
                  : "Derrota restó puntos al rating"
                : "Resultado registrado",
              date: match.scheduled_at,
              outcome,
              scoreLabel: finalScoreLabel, 
              matchType: match.match_type || "Competitivo",
              status: match.status,
            };
          }

          return {
            id: `other-${match.id}`,
            kind: "other",
            title: `Partido ${match.match_type || "amistoso"}`,
            subtitle: match.location_name || match.notes || "Actividad registrada",
            date: match.scheduled_at,
            status: match.status,
          };
        })
        .filter(Boolean); // Elimina los nulos (partidos ignorados por el filtro)

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
            Tus últimos partidos de ranking oficial y el próximo juego programado.
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
              Todavía no hay actividad oficial para mostrar
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Cuando juegues partidos competitivos válidos para ranking, aquí verás tus resultados.
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