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

  // Modal Cancelación
  const [modalCancelOpen, setModalCancelOpen] = useState(false);

  const players = match.players || [];
  const inscritosCount = players.length;
  const yaInscrito = currentUser ? players.some((p) => p.user_id === currentUser.id) : false;
  const soyCreador = currentUser ? match.created_by === currentUser.id : false;
  const esPrivado = match.is_private || match.match_type === "privado";
  const lleno = inscritosCount >= 4;

  const esJugado = match.status === "jugado";
  const esPropuesto = match.score_status === "propuesto";

  const slots = [0, 1, 2, 3].map((index) => players[index] || null);

  // Cálculo de horas faltantes
  const matchTime = match?.scheduled_at ? new Date(match.scheduled_at).getTime() : 0;
  const nowTime = new Date().getTime();
  const horasFaltantes = (matchTime - nowTime) / (1000 * 60 * 60);
  const esReembolsable = horasFaltantes > 10;

  async function unirse() {
    if (!currentUser) {
      alert("Debes iniciar sesión para unirte al partido.");
      return;
    }

    if (esPrivado) {
      alert("Este es un partido privado.");
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

      // 1. Obtener perfil
      const { data: userPadelProfile } = await supabase
        .from("padel_profiles")
        .select("categoria_oficial, rating")
        .eq("cuenta_id", currentUser.id)
        .maybeSingle();

      const userCatKey = (userPadelProfile?.categoria_oficial || "rookies").toLowerCase();
      const matchCatKey = (match.category_restriction || "open").toLowerCase();

      // 2. Validar categoría
      const userLevel = CATEGORIA_NIVEL[userCatKey] || 1;
      const matchMaxLevel = CATEGORIA_NIVEL[matchCatKey] || 8;

      if (matchCatKey !== "open" && !matchCatKey.includes("•") && userLevel > matchMaxLevel) {
        const errorTexto = `⚠️ Tu categoría (${userCatKey.toUpperCase()}) supera la categoría máxima permitida (${matchCatKey.toUpperCase()}).`;
        setErrorMsg(errorTexto);
        alert(errorTexto);
        setProcesando(false);
        return;
      }

      // 3. Validar créditos
      const costo = match.price_per_player || 4;
      if (userCreditos < costo) {
        const errorSaldo = `⚠️ Saldo insuficiente. Necesitas ${costo} créditos y tienes ${userCreditos}.`;
        setErrorMsg(errorSaldo);
        alert(errorSaldo);
        setProcesando(false);
        return;
      }

      // 4. Asignar equipo
      const equipoACount = players.filter((p) => p.team === "A").length;
      const teamAsignado = equipoACount < 2 ? "A" : "B";

      // 5. Inscribir
      const { error: playerErr } = await supabase.from("padel_match_players").insert({
        match_id: match.id,
        user_id: currentUser.id,
        team: teamAsignado,
      });

      if (playerErr) throw playerErr;

      // 6. Descontar saldo
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

  // 🚪 CANCELACIÓN SEGÚN REGLA DE 10 HORAS
  async function confirmarCancelacion() {
    if (!currentUser) return;

    try {
      setProcesando(true);

      const costoIndividual = match.price_per_player || 4;
      const costoTotalCancha = match.total_price || 16;

      if (soyCreador || esPrivado) {
        const { error: errMatch } = await supabase
          .from("padel_matches")
          .update({ status: "cancelado" })
          .eq("id", match.id);

        if (errMatch) throw errMatch;

        if (esReembolsable) {
          for (const p of players) {
            if (!p.user_id) continue;
            
            const montoDevolver = esPrivado && p.user_id === currentUser.id ? costoTotalCancha : costoIndividual;

            const { data: pProfile } = await supabase
              .from("profiles")
              .select("creditos")
              .eq("id", p.user_id)
              .maybeSingle();

            const saldoActual = pProfile?.creditos || 0;
            const nuevoSaldo = saldoActual + montoDevolver;

            await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", p.user_id);

            await supabase.from("credit_ledger").insert({
              user_id: p.user_id,
              match_id: match.id,
              delta: montoDevolver,
              reason: "reembolso_cancelacion_partido_padel",
              balance_after: nuevoSaldo,
            });
          }
        }
      } else {
        const { error: errDel } = await supabase
          .from("padel_match_players")
          .delete()
          .eq("match_id", match.id)
          .eq("user_id", currentUser.id);

        if (errDel) throw errDel;

        if (esReembolsable) {
          const nuevoSaldo = userCreditos + costoIndividual;
          await supabase.from("profiles").update({ creditos: nuevoSaldo }).eq("id", currentUser.id);

          await supabase.from("credit_ledger").insert({
            user_id: currentUser.id,
            match_id: match.id,
            delta: costoIndividual,
            reason: "reembolso_salida_partido_padel",
            balance_after: nuevoSaldo,
          });
        }
      }

      setModalCancelOpen(false);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      alert("Error al procesar la cancelación.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between p-5 space-y-4">
      
      {/* 1. HEADER FECHA & ESTADO */}
      <div>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
          <span className="text-xs sm:text-sm font-black text-slate-900 capitalize flex items-center gap-1.5">
            <span>📅</span>
            <span>{formatFechaLarga(match.scheduled_at)}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {esJugado ? (
              <span className="bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                <span>🏆</span> Finalizado
              </span>
            ) : esPropuesto ? (
              <span className="bg-amber-100 text-amber-900 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-amber-300 animate-pulse flex items-center gap-1">
                <span>⏳</span> Aprobar Marcador
              </span>
            ) : esPrivado ? (
              <span className="bg-slate-900 text-amber-300 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-slate-800 flex items-center gap-1">
                <span>🔒</span> Privado
              </span>
            ) : (
              <>
                <span className="bg-blue-50 text-blue-700 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-blue-200 truncate max-w-[130px]">
                  {match.category_restriction ? `${match.category_restriction}` : "Libre"}
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
              </>
            )}
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
                        {nombrePila.charAt(0).toUpperCase()}
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

            if (esPrivado) {
              return (
                <div key={idx} className="flex flex-col items-center gap-1 opacity-40 z-10 cursor-not-allowed">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shadow-xs">
                    <span className="text-sm font-bold">🔒</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400">
                    Privado
                  </span>
                </div>
              );
            }

            return (
              <button
                key={idx}
                onClick={unirse}
                disabled={yaInscrito || lleno || procesando || esJugado}
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

      {/* 3. FOOTER CLUB + BOTONES DINÁMICOS */}
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
              {esJugado ? (
                <span className="text-xs font-black text-emerald-600">{match.score_text || "Jugado"}</span>
              ) : esPrivado ? (
                <span className="text-xs font-black text-slate-700">Reserva Completa</span>
              ) : (
                <>
                  {match.price_per_player || 4} <span className="text-[10px] text-slate-400">créditos</span>
                </>
              )}
            </span>
          </div>
        </div>

        {errorMsg && (
          <p className="text-[10px] font-bold text-rose-600 text-center bg-rose-50 p-2 rounded-xl border border-rose-200">
            {errorMsg}
          </p>
        )}

        {/* FILA DE BOTONES PRINCIPALES */}
        <div className="flex gap-2">
          {esJugado ? (
            /* 🟢 SI EL PARTIDO ESTÁ FINALIZADO */
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-black text-xs uppercase tracking-wider rounded-2xl text-center block transition-colors shadow-xs"
            >
              🏆 Ver Resultado / Evaluación
            </Link>
          ) : esPropuesto && yaInscrito ? (
            /* ⏳ SI HAY MARCADOR PROPUESTO PENDIENTE DE APROBACIÓN */
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl text-center block transition-all shadow-md active:scale-98"
            >
              ⏳ Aprobar Marcador
            </Link>
          ) : esPrivado ? (
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 font-black text-xs uppercase tracking-wider rounded-2xl text-center block shadow-sm transition-colors"
            >
              🔒 Ver Partido Privado
            </Link>
          ) : yaInscrito ? (
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs uppercase tracking-wider rounded-2xl text-center block"
            >
              ✓ Ver Partido
            </Link>
          ) : lleno ? (
            <Link
              href={`/padel/partidos/${match.id}`}
              className="flex-1 py-3 bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-wider rounded-2xl text-center block"
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
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center shrink-0 transition-colors"
            title="Ver Detalle"
          >
            VER
          </Link>
        </div>

        {/* 🔻 CANCELAR MI RESERVA (SÓLO PARA PARTIDOS PROGRAMADOS Y NO FINALIZADOS) */}
        {!esJugado && match.status === "programado" && (yaInscrito || soyCreador) && (
          <div className="text-center pt-1">
            <button
              onClick={() => setModalCancelOpen(true)}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:underline transition-colors py-1 px-2"
            >
              🚫 Cancelar mi reserva / salir
            </button>
          </div>
        )}

      </div>

      {/* ⚠️ MODAL REGLA DE CANCELACIÓN (10 HORAS) */}
      {modalCancelOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalCancelOpen(false)}>
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                {soyCreador || esPrivado ? "¿Cancelar Partido Completo?" : "¿Salir del Partido?"}
              </h3>
              <p className="text-xs text-slate-500 font-bold">
                {formatFechaLarga(match.scheduled_at)}
              </p>
            </div>

            {/* Aviso de Política 10 Horas */}
            <div className={`p-3.5 rounded-2xl text-xs font-bold text-left space-y-1 ${
              esReembolsable ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-amber-50 border border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider">Política de Cancelación</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${esReembolsable ? "bg-emerald-200 text-emerald-950" : "bg-amber-200 text-amber-950"}`}>
                  Faltan {horasFaltantes.toFixed(1)}h
                </span>
              </div>

              {esReembolsable ? (
                <p className="normal-case text-[11px]">
                  ✅ <strong>Faltan más de 10 horas.</strong> Tus créditos invertidos serán devueltos a tu saldo inmediatamente.
                </p>
              ) : (
                <p className="normal-case text-[11px]">
                  ⚠️ <strong>Faltan menos de 10 horas.</strong> La plaza/partido se liberará pero <u>tus créditos no serán reembolsados</u>.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setModalCancelOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-2xl"
              >
                Volver
              </button>
              <button
                onClick={confirmarCancelacion}
                disabled={procesando}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase rounded-2xl shadow-md"
              >
                {procesando ? "Procesando..." : "Sí, Cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}