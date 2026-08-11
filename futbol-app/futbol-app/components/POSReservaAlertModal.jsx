"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function POSReservaAlertModal({
  clubId,
  audioSilenciado,
  setAudioSilenciado,
}) {
  const router = useRouter();
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

    const channelName = `pos_alert_global_${clubId}_${Math.random().toString(36).substring(2, 7)}`;
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

  if (!alerta) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-slate-900 border-2 border-[#00FF9D] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center text-white">
        <div className="w-16 h-16 bg-[#00FF9D]/20 text-[#00FF9D] border-2 border-[#00FF9D] rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">
          🔔
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-[#00FF9D] tracking-widest bg-[#00FF9D]/10 px-3 py-1 rounded-full border border-[#00FF9D]/30">
            ¡Nueva Reserva en Tiempo Real!
          </span>
          <h3 className="text-2xl font-black text-white pt-2">
            {alerta.canchaNombre}
          </h3>
          <p className="text-sm font-semibold text-slate-300">
            Cliente: <strong className="text-[#00FF9D]">{alerta.cliente}</strong>
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setAlerta(null);
              router.push("/admin/recepcion");
            }}
            className="w-full py-3 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
          >
            🎾 Ir a Recepción (POS) →
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAlerta(null)}
              className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs uppercase rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => {
                setAudioSilenciado(true);
                setAlerta(null);
              }}
              className="w-1/2 py-2.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 font-black text-xs uppercase rounded-xl transition-colors cursor-pointer"
            >
              🔇 Silenciar Sonido
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}