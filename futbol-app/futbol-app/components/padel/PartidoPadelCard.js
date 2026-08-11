"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function PartidoPadelCard({ match, currentUser, userCreditos, onUpdate }) {
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState("A");
  const [tasaBCV, setTasaBCV] = useState(36.65);

  const [formPago, setFormPago] = useState({
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });

  const [procesando, setProcesando] = useState(false);
  const [notificacion, setNotificacion] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    obtenerTasaBCV();
  }, []);

  async function obtenerTasaBCV() {
    try {
      const res = await fetch("/api/bcv-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) setTasaBCV(parseFloat(data.usdRate));
      }
    } catch (e) {
      console.warn("Error consultando BCV en card:", e);
    }
  }

  function mostrarNotif(titulo, mensaje, tipo = "info") {
    setNotificacion({ titulo, mensaje, tipo });
  }

  const precioPorJugador = useMemo(() => {
    if (match.price_per_player && parseFloat(match.price_per_player) > 0) {
      return parseFloat(match.price_per_player);
    }
    const precioBase = parseFloat(match.total_price) || 16;
    const fee = parseFloat(match.app_fee) || (match.is_private ? 0 : precioBase * 0.10);
    return parseFloat(((precioBase + fee) / 4).toFixed(2));
  }, [match]);

  const precioBs = useMemo(() => {
    return (precioPorJugador * tasaBCV).toFixed(2);
  }, [precioPorJugador, tasaBCV]);

  const miJugador = useMemo(() => {
    if (!currentUser || !match.players) return null;
    return match.players.find((p) => p.user_id === currentUser.id);
  }, [match.players, currentUser]);

  const soyCreador = match.created_by === currentUser?.id;
  const estoyEnElPartido = !!miJugador || soyCreador;

  const miAbono = useMemo(() => {
    if (!currentUser || !Array.isArray(match.payments_history)) return null;
    return match.payments_history.find((p) => p.user_id === currentUser.id);
  }, [match.payments_history, currentUser]);

  const miPagoAprobado = miAbono?.status === "aprobado" || miAbono?.status === "liquidado";
  const miPagoPendiente = miAbono?.status === "pendiente" || miAbono?.status === "pendiente_aprobacion" || miAbono?.status === "pago_en_sitio";

  const duplaA = useMemo(() => match.players?.filter((p) => p.team === "A") || [], [match.players]);
  const duplaB = useMemo(() => match.players?.filter((p) => p.team === "B") || [], [match.players]);

  function abrirModalInscripcion(equipo = "A") {
    if (!currentUser) {
      return mostrarNotif("Iniciar Sesión", "Debes iniciar sesión para unirte a este partido.");
    }
    setEquipoSeleccionado(equipo);
    setFormPago({ metodoPago: "pago_movil", numReferencia: "", previewComprobante: "" });
    setModalPagoOpen(true);
  }

  const handleSeleccionarImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return mostrarNotif("Archivo Inválido", "Por favor selecciona una imagen de comprobante (JPG, PNG).");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormPago((prev) => ({ ...prev, previewComprobante: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  async function procesarInscripcionYPayment(e) {
    e.preventDefault();
    if (!currentUser) return;

    if (formPago.metodoPago !== "efectivo" && !formPago.numReferencia.trim() && !formPago.previewComprobante) {
      return mostrarNotif("Falta Comprobante", "Por favor ingresa el número de referencia o adjunta la captura del pago.");
    }

    try {
      setProcesando(true);

      const { data: userProf } = await supabase
        .from("profiles")
        .select("nombre, apellido, telefono")
        .eq("id", currentUser.id)
        .maybeSingle();

      const nombreCompleto = userProf 
        ? `${userProf.nombre || ''} ${userProf.apellido || ''}`.trim() 
        : currentUser.email;

      const nuevoAbono = {
        id: `pay-open-${Date.now()}`,
        user_id: currentUser.id,
        user_name: nombreCompleto,
        user_phone: userProf?.telefono || "Sin teléfono",
        amount: precioPorJugador,
        method: formPago.metodoPago,
        reference: formPago.numReferencia.trim() || "Inscripción Partido Abierto",
        receipt_url: formPago.previewComprobante || null,
        status: formPago.metodoPago === "efectivo" ? "pago_en_sitio" : "pendiente_aprobacion",
        created_at: new Date().toISOString(),
        concepto: "Inscripción Individual Partido Abierto"
      };

      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const historialNuevo = [...historialActual, nuevoAbono];

      const proofUrlsActuales = Array.isArray(match.payment_proof_urls) ? match.payment_proof_urls : [];
      const proofUrlsNuevas = formPago.previewComprobante 
        ? [...proofUrlsActuales, formPago.previewComprobante] 
        : proofUrlsActuales;

      const { error: matchErr } = await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_proof_urls: proofUrlsNuevas,
          payment_status: "pendiente_aprobacion",
        })
        .eq("id", match.id);

      if (matchErr) throw matchErr;

      if (!estoyEnElPartido) {
        const { error: playerErr } = await supabase
          .from("match_players")
          .insert({
            match_id: match.id,
            user_id: currentUser.id,
            team: equipoSeleccionado,
          });

        if (playerErr) throw playerErr;
      }

      setModalPagoOpen(false);
      mostrarNotif(
        "¡Solicitud Enviada!",
        "✅ Tu pago y participación han sido registrados. Recepción verificará tu abono en el POS para confirmar tu plaza oficialmente.",
        "success"
      );

      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      mostrarNotif("Error al Unirse", err.message || "No se pudo procesar tu inscripción.");
    } finally {
      setProcesando(false);
    }
  }

  async function salirDelPartido() {
    if (!miJugador) return;

    try {
      setProcesando(true);
      await supabase.from("match_players").delete().eq("id", miJugador.id);
      mostrarNotif("Has Salido del Partido", "Te has retirado de la lista de jugadores.");
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      mostrarNotif("Error", "No se pudo procesar la salida.");
    } finally {
      setProcesando(false);
    }
  }

  const fechaFormateada = useMemo(() => {
    if (!match.scheduled_at) return "";
    const cleanStr = match.scheduled_at.replace(" ", "T").substring(0, 19);
    const d = new Date(`${cleanStr.endsWith("Z") ? cleanStr.slice(0, -1) : cleanStr}-04:00`);
    return d.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [match.scheduled_at]);

  const catBadge = useMemo(() => {
    const raw = (match.category_restriction || "Libre").toString().toLowerCase().trim();
    if (raw === "rookies" || raw === "rookie") return "7MA";
    return raw.toUpperCase();
  }, [match.category_restriction]);

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4 relative flex flex-col justify-between h-full">
      
      {/* HEADER CARD */}
      <div className="space-y-3">
        <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base">📅</span>
            <span className="text-xs font-black text-slate-900 capitalize truncate">
              {fechaFormateada}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {catBadge}
            </span>
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
              match.is_competitive ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-600"
            }`}>
              {match.is_competitive ? "⚡ COMP." : "🤝 AMIST."}
            </span>
          </div>
        </div>

        {/* CONTENEDOR GRID DE DUPLAS (SIN OVERFLOW) */}
        <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 sm:p-4.5 relative">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 items-start text-center relative">
            {/* LÍNEA DIVISORA DE DUPLAS EN EL CENTRO */}
            <div className="absolute left-1/2 top-1 bottom-1 w-[1px] bg-slate-200 -translate-x-1/2" />

            <CircleSlot player={duplaA[0]} onJoin={() => abrirModalInscripcion("A")} disabled={estoyEnElPartido} />
            <CircleSlot player={duplaA[1]} onJoin={() => abrirModalInscripcion("A")} disabled={estoyEnElPartido} />
            <CircleSlot player={duplaB[0]} onJoin={() => abrirModalInscripcion("B")} disabled={estoyEnElPartido} />
            <CircleSlot player={duplaB[1]} onJoin={() => abrirModalInscripcion("B")} disabled={estoyEnElPartido} />
          </div>
        </div>

        {/* DATOS DEL CLUB Y PRECIO */}
        <div className="flex justify-between items-end pt-1">
          <div className="min-w-0 pr-2">
            <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
              {match.club?.name || "Complejo Deportivo"}
            </h4>
            <p className="text-[10px] font-bold text-slate-400 truncate">
              📍 {match.club?.city || "Ubicación"} • {match.court?.name || "Pista"}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-base font-black text-blue-600 block leading-none">
              ${precioPorJugador.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">/jugador</span>
            </span>
            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
              Bs. {precioBs}
            </span>
          </div>
        </div>
      </div>

      {/* BOTONES Y ESTADO */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        {estoyEnElPartido && (
          <div className="text-center">
            {miPagoPendiente ? (
              <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-3 py-1 rounded-full animate-pulse mb-2">
                ⏳ Pago Pendiente por Aprobar en POS
              </span>
            ) : miPagoAprobado ? (
              <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase px-3 py-1 rounded-full mb-2">
                ✓ Participación Confirmada
              </span>
            ) : null}
          </div>
        )}

        <div className="flex gap-2">
          <Link
            href={`/padel/partidos/${match.id}`}
            className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black text-xs uppercase text-center rounded-2xl transition-colors flex items-center justify-center"
          >
            ✓ Ver Partido
          </Link>

          {!estoyEnElPartido && (
            <button
              type="button"
              onClick={() => abrirModalInscripcion("A")}
              className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase rounded-2xl cursor-pointer transition-colors shadow-sm"
            >
              + Unirme
            </button>
          )}
        </div>

        {estoyEnElPartido && !soyCreador && (
          <button
            type="button"
            onClick={salirDelPartido}
            disabled={procesando}
            className="w-full text-center text-[10px] font-bold text-rose-600 hover:underline cursor-pointer py-1"
          >
            🚫 Cancelar mi reserva / salir
          </button>
        )}
      </div>

      {/* MODAL DE PAGO PARA UNIRSE AL PARTIDO ABIERTO */}
      {mounted && modalPagoOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setModalPagoOpen(false)}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Unirse a Partido Abierto
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{match.club?.name || "Complejo"}</h3>
                <p className="text-xs font-bold text-slate-500">{fechaFormateada}</p>
              </div>
              <button type="button" onClick={() => setModalPagoOpen(false)} className="text-slate-400 font-bold hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center font-bold text-xs">
              <div>
                <span className="text-slate-400 uppercase text-[10px] block">Cuota de Inscripción:</span>
                <span className="text-[#00FF9D] text-lg font-black block">${precioPorJugador.toFixed(2)} USD</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 uppercase text-[10px] block">Tasa BCV:</span>
                <span className="text-white text-xs font-black block">Bs. {precioBs} VES</span>
              </div>
            </div>

            <form onSubmit={procesarInscripcionYPayment} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Alineación / Dupla Deseada</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEquipoSeleccionado("A")}
                    className={`py-2 px-3 rounded-xl border text-center font-black transition-all cursor-pointer ${
                      equipoSeleccionado === "A" ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    🎾 Dupla 1 (Pareja A)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEquipoSeleccionado("B")}
                    className={`py-2 px-3 rounded-xl border text-center font-black transition-all cursor-pointer ${
                      equipoSeleccionado === "B" ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    🎾 Dupla 2 (Pareja B)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Método de Pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 En Sitio" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormPago({ ...formPago, metodoPago: m.id })}
                      className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                        formPago.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {formPago.metodoPago !== "efectivo" && (
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      N° de Referencia / ID Transacción *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 123456"
                      value={formPago.numReferencia}
                      onChange={(e) => setFormPago({ ...formPago, numReferencia: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Adjuntar Captura / Comprobante (Opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSeleccionarImagen}
                      className="w-full bg-white border border-slate-300 rounded-xl p-1 text-[10px] outline-none file:mr-2 file:py-0.5 file:px-2 file:rounded-lg file:border-0 file:bg-slate-900 file:text-[#00FF9D]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={procesando}
                className="w-full py-3.5 bg-[#0B1120] text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl hover:bg-slate-900 transition-colors cursor-pointer"
              >
                {procesando ? "PROCESANDO..." : "✓ ENVIAR COMPROBANTE Y UNIRME"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* POPUP NOTIFICACIÓN LOCAL */}
      {notificacion && (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">{notificacion.titulo}</h3>
            <p className="text-xs font-semibold text-slate-500">{notificacion.mensaje}</p>
            <button onClick={() => setNotificacion(null)} className="w-full py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-2xl cursor-pointer">
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// COMPONENTE CÍRCULO INDIVIDUAL CON AVATAR REAL O INICIAL
function CircleSlot({ player, onJoin, disabled }) {
  if (player && player.user_id) {
    const nombre = player.profile ? player.profile.nombre : "Jugador";
    let catRaw = (player.padel_profile?.categoria_oficial || "7ma").toString().toLowerCase().trim();
    if (catRaw === "rookies" || catRaw === "rookie") catRaw = "7ma";
    const cat = catRaw.toUpperCase();
    
    const inicial = nombre.charAt(0).toUpperCase();
    const avatarUrl = player.profile?.avatar_url;

    return (
      <div className="flex flex-col items-center gap-1 z-10 min-w-0">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800 border-2 border-slate-300 p-0.5 shadow-sm overflow-hidden shrink-0 flex items-center justify-center text-white font-black text-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt={nombre} className="w-full h-full object-cover rounded-full" />
          ) : (
            <div className="w-full h-full bg-slate-900 text-white font-black text-sm flex items-center justify-center rounded-full">
              {inicial}
            </div>
          )}
        </div>
        <span className="text-[11px] font-black text-slate-800 truncate w-full px-0.5 leading-tight">
          {nombre}
        </span>
        <span className="bg-[#00FF9D] text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-2xs">
          {cat}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 z-10 min-w-0">
      <button
        type="button"
        onClick={onJoin}
        disabled={disabled}
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-slate-300 bg-white hover:bg-emerald-50 hover:border-emerald-500 flex items-center justify-center transition-all cursor-pointer group shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        <span className="text-xl font-light text-slate-400 group-hover:text-emerald-600 transition-transform">+</span>
      </button>
      <span className="text-[10px] font-extrabold text-blue-600 leading-tight">Libre</span>
    </div>
  );
}