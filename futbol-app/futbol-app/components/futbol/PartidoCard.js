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

  const urlBaseStorage = "https://exrrcqwfiapfdcwjxzbf.supabase.co/storage/v1/object/public/canchas/";
  const rawImagen = partido.imagenUrl || partido.imagen_url;
  const imagenFinal = rawImagen?.startsWith("http") 
    ? rawImagen 
    : rawImagen ? `${urlBaseStorage}${rawImagen}` : null;

  useEffect(() => {
    let mounted = true;

    async function verificarInscripcion() {
      if (!supabase) {
        setVerificando(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setMensaje("Primero inicia sesión para unirte.");
      setCargando(false);
      return;
    }

    const { data: perfil, error: perfilError } = await supabase
      .from("profiles")
      .select("creditos")
      .eq("id", user.id)
      .single();

    if (perfilError) console.error("Error al obtener créditos:", perfilError);

    const creditos = perfil?.creditos ?? 0;
    const costoInscripcion = partido.precio_creditos ?? 1;

    if (creditos < costoInscripcion) {
      setMensaje(`No tienes créditos suficientes. Necesitas ${costoInscripcion}.`);
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

    const nuevoBalance = creditos - costoInscripcion;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ creditos: nuevoBalance })
      .eq("id", user.id);

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
      await supabase
        .from("profiles")
        .update({ creditos })
        .eq("id", user.id);
      setMensaje("No se pudo unir al partido.");
      setCargando(false);
      return;
    }

    await supabase.from("credit_ledger").insert({
      user_id: user.id,
      partido_id: partido.id,
      delta: -costoInscripcion,
      reason: "match_join",
      balance_after: nuevoBalance,
    });

    setInscrito(true);
    setInscripcionId(nuevaInscripcion?.id ?? null);
    setMensaje(`¡Te uniste! Se descontaron ${costoInscripcion} créditos.`);
    setCargando(false);
    router.refresh();
  }

  async function cancelarInscripcion() {
    if (!supabase || !inscripcionId) return;

    setCancelando(true);
    setMensaje("");

    const { data: { user } } = await supabase.auth.getUser();

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

    const { data: perfil } = await supabase
      .from("profiles")
      .select("creditos")
      .eq("id", user.id)
      .single();

    const creditos = perfil?.creditos ?? 0;
    const costoInscripcion = partido.precio_creditos ?? 1;
    const nuevoBalance = creditos + costoInscripcion;

    await supabase
      .from("profiles")
      .update({ creditos: nuevoBalance })
      .eq("id", user.id);

    await supabase.from("credit_ledger").insert({
      user_id: user.id,
      partido_id: partido.id,
      delta: costoInscripcion,
      reason: "match_cancel",
      balance_after: nuevoBalance,
    });

    setInscrito(false);
    setInscripcionId(null);
    setConfirmandoCancelacion(false);
    setCancelando(false);
    setMensaje(`Cancelado. Se reembolsaron ${costoInscripcion} créditos.`);
    router.refresh();
  }

  return (
    <div className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:border-gray-200 transition-all shadow-sm hover:shadow-md flex flex-col">
      <div className="relative h-44 w-full overflow-hidden bg-gray-900">
        
        {/* --- 1. CAPA BASE: LA FOTO (z-0) --- */}
        {imagenFinal ? (
          <img
            src={imagenFinal}
            alt={nombreCancha}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 z-0 opacity-90"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 to-teal-900 z-0" />
        )}

        {/* --- 2. CAPA MEDIA: DEGRADADO INTENSO (z-10) --- */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

        {/* --- 3. CAPA SUPERIOR: TEXTOS Y ELEMENTOS (z-20) --- */}
        <div className="absolute top-4 right-4 z-20">
          <span className="inline-flex items-center bg-white/95 text-emerald-800 text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
            {partido.precio_creditos ?? 1} créditos
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 z-20">
          <h3 className="font-black text-white text-2xl leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {nombreCancha}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 opacity-90">
            <svg className="w-3.5 h-3.5 text-[#00FF9D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
            <p className="text-white text-xs font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{partido.zona}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5 flex-grow">
        <div className="flex items-center justify-between text-sm text-gray-600 font-medium bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-100">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            {formatFecha(partido.fecha)}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {formatHora(partido.hora)}
          </span>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <span className={`text-xs font-black uppercase tracking-wider ${lleno ? "text-red-500" : "text-gray-500"}`}>
              {lleno ? "Agotados" : `${cuposLibres} libres`}
            </span>
            <span className="text-gray-900 font-black text-sm">{cuposOcupados} <span className="text-gray-400 font-bold">/ {cuposTotales}</span></span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                lleno ? "bg-red-500" : ocupacion > 75 ? "bg-yellow-400" : "bg-emerald-500"
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
            <div className="flex justify-center mt-1">
              {confirmandoCancelacion ? (
                <div className="flex items-center justify-center gap-3 w-full bg-red-50 p-2 rounded-xl border border-red-100">
                  <span className="text-xs font-semibold text-red-800">¿Seguro?</span>
                  <button
                    onClick={cancelarInscripcion}
                    disabled={cancelando}
                    className="text-xs font-black text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancelando ? "..." : "Sí"}
                  </button>
                  <button
                    onClick={() => setConfirmandoCancelacion(false)}
                    disabled={cancelando}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 bg-white px-3 py-1.5 rounded-lg border border-gray-200 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmandoCancelacion(true)}
                  className="text-[11px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all"
                >
                  Cancelar inscripción
                </button>
              )}
            </div>
          )}
        </div>

        {mensaje && (
          <div
            className={`text-xs text-center rounded-xl py-2.5 px-3 font-bold border ${
              mensaje.includes("uniste") || mensaje.includes("Cancelado")
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