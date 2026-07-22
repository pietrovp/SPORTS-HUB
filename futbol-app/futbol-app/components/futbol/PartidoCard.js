"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function formatFecha(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function formatHora(horaStr) {
  if (!horaStr) return "";
  const [horas, minutos] = horaStr.split(":");
  const h = parseInt(horas, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${minutos} ${ampm}`;
}

export default function PartidoCard({ partido }) {
  const router = useRouter();

  const [verificando, setVerificando] = useState(true);
  const [inscrito, setInscrito] = useState(false);
  const [inscripcionId, setInscripcionId] = useState(null);

  const [cargando, setCargando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const cuposTotales = partido.cupos_totales || partido.cuposTotales || 14;
  const cuposOcupados = partido.cupos_ocupados ?? partido.cuposOcupados ?? 0;
  const cuposLibres = cuposTotales - cuposOcupados;
  const lleno = cuposLibres <= 0;
  const ocupacion = Math.round((cuposOcupados / cuposTotales) * 100);

  const nombreCancha = partido.cancha_lugar || partido.cancha || partido.titulo || "Cancha";

  useEffect(() => {
    let mounted = true;

    async function verificarInscripcion() {
      if (!supabase) {
        setVerificando(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) {
        setInscrito(false);
        setVerificando(false);
        return;
      }

      const { data } = await supabase
        .from("partido_jugadores")
        .select("id")
        .eq("partido_id", partido.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      setInscrito(!!data);
      setInscripcionId(data?.id ?? null);
      setVerificando(false);
    }

    verificarInscripcion();

    return () => {
      mounted = false;
    };
  }, [partido.id]);

  async function unirse() {
    if (!supabase) return;

    setCargando(true);
    setMensaje("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMensaje("Primero inicia sesión para unirte.");
      setCargando(false);
      return;
    }

    // ✅ CORREGIDO: futbol_profiles con columna usuario_id
    const { data: perfil } = await supabase
      .from("futbol_profiles")
      .select("creditos")
      .eq("usuario_id", user.id)
      .single();

    const creditos = perfil?.creditos ?? 0;

    if (creditos < 1) {
      setMensaje("No tienes créditos suficientes. Recarga antes de unirte.");
      setCargando(false);
      return;
    }

    const { data: yaInscrito } = await supabase
      .from("partido_jugadores")
      .select("id")
      .eq("partido_id", partido.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (yaInscrito) {
      setInscrito(true);
      setInscripcionId(yaInscrito.id);
      setMensaje("Ya estás inscrito en este partido.");
      setCargando(false);
      return;
    }

    const nuevoBalance = creditos - 1;

    // ✅ CORREGIDO: futbol_profiles con columna usuario_id
    const { error: updateError } = await supabase
      .from("futbol_profiles")
      .update({ creditos: nuevoBalance })
      .eq("usuario_id", user.id);

    if (updateError) {
      setMensaje("No se pudo descontar el crédito.");
      setCargando(false);
      return;
    }

    const { data: nuevaInscripcion, error: inscripcionError } = await supabase
      .from("partido_jugadores")
      .insert({ partido_id: partido.id, user_id: user.id })
      .select("id")
      .single();

    if (inscripcionError) {
      // ✅ CORREGIDO: revert también usa futbol_profiles
      await supabase
        .from("futbol_profiles")
        .update({ creditos })
        .eq("usuario_id", user.id);
      setMensaje("No se pudo unir al partido.");
      setCargando(false);
      return;
    }

    await supabase.from("credit_ledger").insert({
      user_id: user.id,
      partido_id: partido.id,
      delta: -1,
      reason: "match_join",
      balance_after: nuevoBalance,
    });

    setInscrito(true);
    setInscripcionId(nuevaInscripcion?.id ?? null);
    setMensaje("¡Te uniste al partido! Se descontó 1 crédito.");
    setCargando(false);
    router.refresh();
  }

  async function cancelarInscripcion() {
    if (!supabase || !inscripcionId) return;

    setCancelando(true);
    setMensaje("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCancelando(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("partido_jugadores")
      .delete()
      .eq("id", inscripcionId);

    if (deleteError) {
      setMensaje("No se pudo cancelar la inscripción.");
      setCancelando(false);
      return;
    }

    // ✅ CORREGIDO: futbol_profiles con columna usuario_id
    const { data: perfil } = await supabase
      .from("futbol_profiles")
      .select("creditos")
      .eq("usuario_id", user.id)
      .single();

    const creditos = perfil?.creditos ?? 0;
    const nuevoBalance = creditos + 1;

    // ✅ CORREGIDO: futbol_profiles con columna usuario_id
    await supabase
      .from("futbol_profiles")
      .update({ creditos: nuevoBalance })
      .eq("usuario_id", user.id);

    await supabase.from("credit_ledger").insert({
      user_id: user.id,
      partido_id: partido.id,
      delta: 1,
      reason: "match_cancel",
      balance_after: nuevoBalance,
    });

    setInscrito(false);
    setInscripcionId(null);
    setConfirmandoCancelacion(false);
    setCancelando(false);
    setMensaje("Cancelaste tu inscripción. Se reembolsó 1 crédito.");
    router.refresh();
  }

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-all shadow-sm flex flex-col">
      <div className="relative h-40 w-full overflow-hidden">
        {partido.imagenUrl || partido.imagen_url ? (
          <img
            src={partido.imagenUrl || partido.imagen_url}
            alt={nombreCancha}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-teal-900" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
            {partido.precio_creditos ?? 1} crédito
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="font-black text-white text-2xl leading-tight tracking-tight drop-shadow-lg">
            {nombreCancha}
          </h3>
          <p className="text-gray-200 text-xs mt-1 font-semibold drop-shadow-md">{partido.zona}</p>
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5 flex-grow">
        <div className="flex items-center gap-6 text-sm text-gray-500 font-medium">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            {formatFecha(partido.fecha)}
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {formatHora(partido.hora)}
          </span>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
            <span className={lleno ? "text-red-500 font-bold" : ""}>
              {lleno ? "Cupos agotados" : `${cuposLibres} cupos disponibles`}
            </span>
            <span className="text-gray-800 font-bold">{cuposOcupados} <span className="text-gray-400 font-normal">/ {cuposTotales}</span></span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                lleno ? "bg-red-500" : ocupacion > 75 ? "bg-yellow-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(ocupacion, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-auto pt-2">
          <div className="flex gap-3">
            {inscrito ? (
              <div className="flex-1 rounded-xl py-3 text-sm font-bold flex justify-center items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Inscrito
              </div>
            ) : (
              <button
                disabled={lleno || cargando || verificando}
                onClick={unirse}
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all flex justify-center items-center gap-2 ${
                  lleno || cargando || verificando
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]"
                }`}
              >
                {lleno ? "Sin cupo" : cargando ? "Procesando..." : verificando ? "Cargando..." : "Unirme ahora"}
              </button>
            )}
            <Link
              href={`/futbol/partido/${partido.id}`}
              className="px-5 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold hover:bg-gray-100 transition-all flex items-center justify-center"
            >
              Ver
            </Link>
          </div>

          {inscrito && (
            <div className="flex justify-center">
              {confirmandoCancelacion ? (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-500">¿Cancelar tu inscripción?</span>
                  <button
                    onClick={cancelarInscripcion}
                    disabled={cancelando}
                    className="font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {cancelando ? "Cancelando..." : "Sí, cancelar"}
                  </button>
                  <button
                    onClick={() => setConfirmandoCancelacion(false)}
                    disabled={cancelando}
                    className="font-bold text-gray-500 hover:text-gray-700"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmandoCancelacion(true)}
                  className="text-xs text-gray-400 hover:text-red-600 font-medium underline underline-offset-2 transition-colors"
                >
                  Cancelar inscripción
                </button>
              )}
            </div>
          )}
        </div>

        {mensaje && (
          <div
            className={`text-xs text-center rounded-xl py-2.5 px-3 font-medium border ${
              mensaje.includes("uniste") || mensaje.includes("Cancelaste")
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {mensaje}
          </div>
        )}
      </div>
    </div>
  );
}
