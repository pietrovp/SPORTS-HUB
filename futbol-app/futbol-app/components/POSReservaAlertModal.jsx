"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

export default function POSReservaAlertModal({ clubId, onVerReserva }) {
  const [alerta, setAlerta] = useState(null); // { id, canchaNombre, cliente, matchData }
  const [audioHabilitado, setAudioHabilitado] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Cargar sonido desde /public/alerta-reserva.wav
    audioRef.current = new Audio("/alerta-reserva.wav");
    audioRef.current.volume = 0.9;
  }, []);

  const desbloquearAudio = () => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setAudioHabilitado(true);
        })
        .catch((e) => console.warn("Interacción requerida para habilitar audio:", e));
    }
  };

  const reproducirSonido = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => {
        console.warn("Navegador bloqueó el sonido automático de alerta:", e);
      });
    }
  };

  useEffect(() => {
    if (!clubId || !supabase) return;

    const procesarNuevaReserva = (reserva) => {
      reproducirSonido();
      setAlerta({
        id: reserva.id || reserva.match?.id,
        canchaNombre: reserva.canchaNombre || reserva.court?.name || "Pista",
        cliente: reserva.user_name || reserva.cliente || "Cliente desde App",
        matchData: reserva.match || reserva,
      });
    };

    // Nombre de canal único e independiente para evitar colisión de suscripción con otros componentes
    const channelName = `pos_alert_channel_${clubId}_${Math.random().toString(36).substring(2, 7)}`;
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
  }, [clubId]);

  if (!alerta) {
    if (!audioHabilitado) {
      return (
        <div className="fixed top-2 right-2 z-[999999]">
          <button
            type="button"
            onClick={desbloquearAudio}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 cursor-pointer animate-pulse"
          >
            <span>🔊</span>
            <span>Activar Alertas de Audio POS</span>
          </button>
        </div>
      );
    }
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-slate-900 border-2 border-[#00FF9D] rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center text-white">
        <div className="w-14 h-14 bg-[#00FF9D]/20 text-[#00FF9D] border border-[#00FF9D] rounded-full flex items-center justify-center mx-auto text-2xl animate-bounce">
          🔔
        </div>

        <div>
          <span className="text-[10px] font-black uppercase text-[#00FF9D] tracking-widest bg-[#00FF9D]/10 px-2.5 py-0.5 rounded-full border border-[#00FF9D]/30">
            Nueva Reserva en Sitio Web
          </span>
          <h3 className="text-xl font-black mt-2 text-white">
            {alerta.canchaNombre}
          </h3>
          <p className="text-xs font-bold text-slate-300 mt-1">
            Cliente: <strong className="text-white">{alerta.cliente}</strong>
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setAlerta(null)}
            className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-xs uppercase rounded-xl transition-colors cursor-pointer"
          >
            Entendido
          </button>

          {onVerReserva && (
            <button
              type="button"
              onClick={() => {
                const data = alerta.matchData;
                setAlerta(null);
                onVerReserva(data);
              }}
              className="w-1/2 py-2.5 bg-[#00FF9D] hover:bg-[#00cc7d] text-slate-950 font-black text-xs uppercase rounded-xl shadow-md transition-colors cursor-pointer"
            >
              Ver Detalle →
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}