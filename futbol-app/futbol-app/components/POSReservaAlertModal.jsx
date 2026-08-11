"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function POSReservaAlertModal({
  clubId,
  audioSilenciado,
  setAudioSilenciado,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [alerta, setAlerta] = useState(null); // { canchaNombre, cliente }
  const audioRef = useRef(null);

  useEffect(() => {
    audioRef.current = new Audio("/alerta-reserva.wav");
    audioRef.current.volume = 0.9;
  }, []);

  const reproducirSonido = () => {
    if (!audioSilenciado && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => {
        console.warn("Autoplay bloqueado por el navegador:", e);
      });
    }
  };

  useEffect(() => {
    if (!clubId || !supabase) return;

    const procesarNuevaReserva = (reserva) => {
      reproducirSonido();
      setAlerta({
        canchaNombre: reserva.canchaNombre || reserva.court?.name || "Pista",
        cliente: reserva.user_name || reserva.cliente || "Cliente desde App",
      });
    };

    const channelName = `pos_sidebar_channel_${clubId}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "match_event" }, (payload) => {
        if (payload.payload?.type === "INSERT_MATCH") {
          procesarNuevaReserva(payload.payload);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `club_id=eq.${clubId}`,
        },
        (payload) => {
          procesarNuevaReserva(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, audioSilenciado]);

  return (
    <div className="px-4 py-2 w-full">
      {alerta ? (
        <div className="bg-slate-900 border-2 border-[#00FF9D] rounded-2xl p-3 shadow-2xl space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-base animate-bounce">🔔</span>
              <span className="text-[10px] font-black uppercase text-[#00FF9D] tracking-wider">
                ¡Nueva Reserva!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAlerta(null)}
              className="text-slate-400 hover:text-white font-bold text-xs p-1 cursor-pointer"
              title="Cerrar notificación"
            >
              ✕
            </button>
          </div>

          <div className="text-left space-y-0.5">
            <p className="text-xs font-black text-white truncate">
              🏟️ {alerta.canchaNombre}
            </p>
            <p className="text-[11px] font-bold text-slate-300 truncate">
              👤 <span className="text-[#00FF9D]">{alerta.cliente}</span>
            </p>
          </div>

          <div className="pt-1 flex flex-col gap-1.5">
            {pathname !== "/admin/recepcion" && (
              <button
                type="button"
                onClick={() => {
                  setAlerta(null);
                  router.push("/admin/recepcion");
                }}
                className="w-full py-1.5 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-[10px] uppercase rounded-lg transition-all cursor-pointer text-center"
              >
                Ver en POS →
              </button>
            )}

            <button
              type="button"
              onClick={() => setAudioSilenciado(!audioSilenciado)}
              className="w-full py-1 text-[9px] font-extrabold uppercase text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              {audioSilenciado ? "🔊 Activar Sonido" : "🔇 Silenciar Sonido"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-center">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-ping" />
              Realtime POS
            </span>
            <button
              type="button"
              onClick={() => setAudioSilenciado(!audioSilenciado)}
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded cursor-pointer transition-colors ${
                audioSilenciado
                  ? "bg-rose-950/60 text-rose-300 border border-rose-800/60"
                  : "bg-emerald-950/60 text-[#00FF9D] border border-emerald-800/60"
              }`}
            >
              {audioSilenciado ? "🔇 Pausado" : "🔊 Audio ON"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}