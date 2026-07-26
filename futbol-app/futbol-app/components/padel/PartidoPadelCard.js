"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// JERARQUÍA OFICIAL DE NIVELES DE PÁDEL
const CATEGORIA_NIVEL = {
  rookies: 1,
  "7ma": 2,
  "6ta": 3,
  "5ta": 4,
  "4ta": 5,
  "3era": 6,
  "2da": 7,
  open: 8,
};

function formatFechaLarga(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PartidoPadelCard({ match, currentUser, userCreditos, onUpdate }) {
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const players = match.players || [];
  const inscritosCount = players.length;
  const yaInscrito = currentUser ? players.some((p) => p.user_id === currentUser.id) : false;
  const lleno = inscritosCount >= 4;

  const slots = [0, 1, 2, 3].map((index) => players[index] || null);

  async function unirse() {
    if (!currentUser) {
      alert("Debes iniciar sesión para unirte al partido.");
      return;
    }

    if (lleno) {
      alert("Este partido ya está lleno.");
      return;
    }

    if (yaInscrito) return;

    try {
      setProcesando(true);
      setErrorMsg("");

      // 1. OBTENER PERFIL DE PÁDEL DEL USUARIO ACTUAL
      const { data: userPadelProfile } = await supabase
        .from("padel_profiles")
        .select("categoria_oficial, rating")
        .eq("cuenta_id", currentUser.id)
        .maybeSingle();

      const userCatKey = (userPadelProfile?.categoria_oficial || "rookies").toLowerCase();
      const matchCatKey = (match.category_restriction || "open").toLowerCase();

      // 2. VALIDAR RESTRICCIÓN DE CATEGORÍA MÁXIMA
      const userLevel = CATEGORIA_NIVEL[userCatKey] || 1;
      const matchMaxLevel = CATEGORIA_NIVEL[matchCatKey] || 8;

      if (matchCatKey !== "open" && userLevel > matchMaxLevel) {
        const errorTexto = `⚠️ Tu categoría (${userCatKey.toUpperCase()}) supera la categoría máxima permitida para este partido (${matchCatKey.toUpperCase()}).`;
        setErrorMsg(errorTexto);
        alert(errorTexto);
        setProcesando(false);
        return;
      }

      // 3. VALIDAR CRÉDITOS
      const costo = match.price_per_player || 4;
      if (userCreditos < costo) {
        const errorSaldo = `⚠️ Saldo insuficiente. Necesitas ${costo} créditos y tienes ${userCreditos}.`;
        setErrorMsg(errorSaldo);
        alert(errorSaldo);
        setProcesando(false);
        return;
      }

      // 4. ASIGNACIÓN DE EQUIPO (A O B)
      const equipoACount = players.filter((p) => p.team === "A").length;
      const teamAsignado = equipoACount < 2 ? "A" : "B";

      // 5. INSCRIBIR EN LA BASE DE DATOS
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: currentUser.id,
        team: teamAsignado,
      });

      if (playerErr) throw playerErr;

      // 6. DESCONTAR SALDO
      const nuevoSaldo = userCreditos - costo;
      await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", currentUser.id);

      await supabase.from("credit_ledger").insert({
        user_id: currentUser.id,
        match_id: match.id,
        delta: -costo,
        reason: "unirse_partido_feed_padel",
        balance_after: nuevoSaldo,
      });

      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Error al unirte al partido.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between p-5 space-y-4">
      
      {/* 1. HEADER FECHA & TIPO */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs sm:text-sm font-black text-slate-900 capitalize flex items-center gap-1.5">
            <span>📅</span>
            <span>{formatFechaLarga(match.scheduled_at)}</span>
          </span>

          <div className="flex items-center gap-1.5">
            <span className="bg-blue-50 text-blue-700 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-blue-200">
              Max: {match.category_restriction || "Libre"}
            </span>
            <span
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                match.is_competitive
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {match.is_competitive ? "⚡ Comp." : "🤝 Amistoso"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. GRILLA DE 4 JUGADORES */}
      <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3.5">
        <div className="grid grid-cols-4 gap-2 items-center text-center relative">
          <div className="absolute left-1/2 top-2 bottom-2 w-[1px] bg-slate-200 -translate-x-1/2 hidden sm:block" />

          {slots.map((player, idx) => {
            if (player) {
              const nombrePila = player.profile?.nombre || "Jugador";
              const avatar = player.profile?.avatar_url;
              const rating = player.padel_profile?.rating
                ? Number(player.padel_profile.rating).toFixed(2)
                : "1.50";

              return (
                <div key={player.id || idx} className="flex flex-col items-center gap-1 z-10 min-w-0">
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 border-slate-300 p-0.5 shadow-sm overflow-hidden shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={nombrePila} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <div className="w-full h-full bg-slate-900 text-white font-black text-sm flex items-center justify-center rounded-full">
                        {nombrePila.charAt(0)}
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-black text-slate-800 truncate w-full px-0.5">
                    {nombrePila}
                  </span>

                  <span className="bg-[#00FF9D] text-slate-950 text-[9px] font-black px-2 py-0.2 rounded-full shadow-xs">
                    {rating}
                  </span>
                </div>
              );
            }

            return (
              <button
                key={idx}
                onClick={unirse}
                disabled={yaInscrito || lleno || procesando}
                className="flex flex-col items-center gap-1 group z-10 transition-transform active:scale-95"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-slate-300 group-hover:border-blue-500 bg-white flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors shadow-xs">
                  <span className="text-xl font-light">+</span>
                </div>

                <span className="text-[10px] font-extrabold text-blue-600 group-hover:underline">
                  Libre
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. FOOTER CLUB + BOTONES */}
      <div className="space-y-3 pt-1">
        <div className="flex justify-between items-end">
          <div>
            <h3 className="text-sm font-black text-slate-900 line-clamp-1">
              {match.club?.name || "Club de Pádel"}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 truncate">
              📍 {match.club?.city || "Ubicación"} • {match.court?.name || "Pista general"}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-sm font-black text-blue-600 block">
              {match.price_per_player || 4} <span className="text-[10px] text-slate-400">créditos</span>
            </span>
          </div>
        </div>

        {errorMsg && (
          <p className="text-[10px] font-bold text-rose-600 text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
            {errorMsg}
          </p>
        )}

        <div className="flex gap-2">
          {yaInscrito ? (
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs uppercase tracking-wider rounded-2xl text-center block"
            >
              ✓ Ver Partido / Resultado
            </Link>
          ) : lleno ? (
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-wider rounded-2xl text-center block"
            >
              Ver Partido Lleno (4/4)
            </Link>
          ) : (
            <button
              onClick={unirse}
              disabled={procesando}
              className="flex-1 py-3 bg-[#0B1120] hover:bg-slate-900 text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>{procesando ? "PROCESANDO..." : `UNIRME (+${match.price_per_player || 4} CR)`}</span>
              {!procesando && <span>→</span>}
            </button>
          )}

          <Link
            href={`/padel/partidos/${match.id}`}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-2xl flex items-center justify-center"
            title="Ver Detalle"
          >
            👁️
          </Link>
        </div>

      </div>

    </div>
  );
}