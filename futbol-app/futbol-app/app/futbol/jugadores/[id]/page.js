"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatFechaCompleta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

function formatHora12(hora24) {
  if (!hora24) return "";
  const [h, m] = hora24.split(":");
  const horas = parseInt(h, 10);
  const ampm = horas >= 12 ? "PM" : "AM";
  const h12 = horas % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function PartidoDetalle({ params }) {
  const router = useRouter();
  const { id } = params;

  const [cargando, setCargando] = useState(true);
  const [partido, setPartido] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [inscrito, setInscrito] = useState(false);
  const [inscripcionId, setInscripcionId] = useState(null);

  // Estados de acciones
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // ESTADOS DEL MODAL DE CONTRASEÑA
  const [mostrarModalPassword, setMostrarModalPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorPassword, setErrorPassword] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      setUsuarioActual(user);

      // 1. Cargar el partido y la sede asociada
      const { data: partidoData, error: partidoError } = await supabase
        .from("partidos")
        .select("*, sedes(imagen_url, direccion)")
        .eq("id", id)
        .single();

      if (partidoError || !partidoData) {
        setCargando(false);
        return;
      }
      setPartido(partidoData);

      // 2. Cargar jugadores inscritos
      const { data: inscripciones } = await supabase
        .from("partido_jugadores")
        .select("id, user_id, profiles(nombre, avatar_url)")
        .eq("partido_id", id);

      if (inscripciones) {
        setJugadores(inscripciones);
        if (user) {
          const miInscripcion = inscripciones.find(i => i.user_id === user.id);
          setInscrito(!!miInscripcion);
          setInscripcionId(miInscripcion?.id || null);
        }
      }

      setCargando(false);
    }

    cargarDatos();
  }, [id]);

  const esCreador = usuarioActual?.id === partido?.creador_id;
  const cuposTotales = partido?.cupos_totales || 14;
  const cuposOcupados = jugadores.length;
  const lleno = cuposOcupados >= cuposTotales;

  // Lógica principal para unirse
  async function procesarInscripcion() {
    setProcesando(true);
    setMensaje("");

    const costoInscripcion = partido.precio_creditos ?? 0;

    // Verificar saldo
    const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", usuarioActual.id).single();
    const creditosActuales = perfil?.creditos || 0;

    if (creditosActuales < costoInscripcion) {
      setMensaje(`No tienes créditos suficientes. Necesitas ${costoInscripcion} créditos.`);
      setProcesando(false);
      return;
    }

    // Inscribir y descontar (incluso si el costo es 0, hacemos la actualización para dejar el ledger limpio)
    const nuevoBalance = creditosActuales - costoInscripcion;
    
    await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", usuarioActual.id);
    
    if (costoInscripcion > 0) {
      await supabase.from("credit_ledger").insert({
        user_id: usuarioActual.id,
        partido_id: partido.id,
        delta: -costoInscripcion,
        reason: partido.tipo_acceso === "privado" ? "join_private_match" : "join_public_match",
        balance_after: nuevoBalance,
      });
    }

    const { data: nuevaInscripcion, error } = await supabase
      .from("partido_jugadores")
      .insert({ partido_id: partido.id, user_id: usuarioActual.id })
      .select("id")
      .single();

    if (!error) {
      setInscrito(true);
      setInscripcionId(nuevaInscripcion.id);
      setMensaje("¡Te has unido al partido con éxito!");
      // Actualizar lista de jugadores localmente
      setJugadores([...jugadores, { id: nuevaInscripcion.id, user_id: usuarioActual.id, profiles: perfil }]);
      setMostrarModalPassword(false);
      setPasswordInput("");
    } else {
      setMensaje("Hubo un error al unirte.");
    }
    setProcesando(false);
  }

  // Interceptor del botón "Unirme"
  function handleUnirmeClick() {
    if (!usuarioActual) {
      router.push("/login");
      return;
    }

    if (partido.tipo_acceso === "privado" && !esCreador) {
      // Exigir contraseña a los invitados
      setMostrarModalPassword(true);
      setErrorPassword("");
      setPasswordInput("");
    } else {
      // Si es público o es el creador, pasa directo
      procesarInscripcion();
    }
  }

  function verificarPassword() {
    if (passwordInput.trim().toUpperCase() === partido.password) {
      procesarInscripcion();
    } else {
      setErrorPassword("Contraseña incorrecta. Pídesela al organizador.");
    }
  }

  async function cancelarInscripcion() {
    if (!confirm("¿Seguro que deseas cancelar tu inscripción?")) return;
    setProcesando(true);

    const { error } = await supabase.from("partido_jugadores").delete().eq("id", inscripcionId);
    if (!error) {
      const costoInscripcion = partido.precio_creditos ?? 0;
      
      if (costoInscripcion > 0) {
        const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", usuarioActual.id).single();
        const nuevoBalance = (perfil?.creditos || 0) + costoInscripcion;
        
        await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", usuarioActual.id);
        await supabase.from("credit_ledger").insert({
          user_id: usuarioActual.id,
          partido_id: partido.id,
          delta: costoInscripcion,
          reason: "cancel_match_join",
          balance_after: nuevoBalance,
        });
      }

      setInscrito(false);
      setInscripcionId(null);
      setJugadores(jugadores.filter(j => j.id !== inscripcionId));
      setMensaje("Inscripción cancelada. Créditos devueltos.");
    }
    setProcesando(false);
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!partido) {
    return <div className="min-h-screen flex items-center justify-center"><h1 className="text-xl font-bold">Partido no encontrado</h1></div>;
  }

  const imagenCancha = partido.sedes?.imagen_url || partido.imagen_url || "https://images.unsplash.com/photo-1518605368461-1ee7e53f090b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80";

  return (
    <div className="min-h-screen bg-gray-50/50 pb-32">
      
      {/* MODAL DE CONTRASEÑA */}
      {mostrarModalPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">🔒</span>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-1">Partido Privado</h3>
            <p className="text-sm text-gray-500 font-medium mb-6">Ingresa el PIN que te compartió el organizador para unirte.</p>
            
            <input 
              type="text" 
              maxLength={6}
              placeholder="Ej: A8X9J2"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value.toUpperCase())}
              className="w-full text-center text-2xl font-black tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl py-3 focus:outline-none focus:border-[#00FF9D] focus:ring-2 focus:ring-[#00FF9D]/20 transition-all uppercase"
            />
            
            {errorPassword && <p className="text-xs font-bold text-red-500 mt-3 bg-red-50 py-2 px-3 rounded-lg w-full">{errorPassword}</p>}
            
            <div className="flex gap-3 w-full mt-6">
              <button onClick={() => setMostrarModalPassword(false)} disabled={procesando} className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={verificarPassword} disabled={procesando || !passwordInput} className="flex-1 py-3.5 rounded-xl font-black text-[#0B0C15] bg-[#00FF9D] hover:bg-[#00e58d] transition-colors uppercase tracking-wider disabled:opacity-50">
                {procesando ? "..." : "Entrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER DE LA IMAGEN */}
      <div className="relative h-64 md:h-80 w-full bg-gray-900">
        <img src={imagenCancha} alt="Cancha" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-[#0B0C15]/40 to-transparent"></div>
        
        <div className="absolute top-4 left-4 z-10">
          <Link href="/futbol" className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </Link>
        </div>

        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {partido.tipo_acceso === "privado" && (
            <span className="bg-white/95 text-indigo-800 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
              Privado
            </span>
          )}
          <span className="bg-white/95 text-emerald-800 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
            {partido.precio_creditos} créditos
          </span>
        </div>

        <div className="absolute bottom-6 left-4 right-4 md:left-8 z-10">
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{partido.cancha_lugar}</h1>
          <div className="flex items-center gap-1.5 mt-2 opacity-90">
            <svg className="w-4 h-4 text-[#00FF9D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
            <p className="text-white text-sm font-medium">{partido.zona} • {partido.sedes?.direccion}</p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 mt-6 flex flex-col gap-6">
        
        {/* PANEL DEL CREADOR (Contraseña) */}
        {esCreador && partido.tipo_acceso === "privado" && (
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">👑</span>
                <h3 className="font-black text-indigo-900 text-lg">Eres el organizador</h3>
              </div>
              <p className="text-indigo-700/80 text-sm font-medium">Comparte este PIN con tus amigos para que puedan unirse gratis a tu cancha.</p>
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-2xl px-6 py-4 flex flex-col items-center justify-center shrink-0 shadow-sm">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">PIN DE ACCESO</span>
              <span className="text-3xl font-black text-indigo-900 tracking-[0.2em]">{partido.password}</span>
            </div>
          </div>
        )}

        {mensaje && (
          <div className={`p-4 rounded-2xl text-sm font-bold text-center border ${mensaje.includes("éxito") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
            {mensaje}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</p>
              <p className="text-sm font-black text-gray-900">{formatFechaCompleta(partido.fecha)}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora</p>
              <p className="text-sm font-black text-gray-900">{formatHora12(partido.hora)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-gray-900">Jugadores</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                {cuposOcupados} / {cuposTotales} Inscritos
              </p>
            </div>
            <div className="w-12 h-12 relative">
              <svg viewBox="0 0 36 36" className="w-full h-full text-gray-100 transform -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={lleno ? "#f43f5e" : "#00FF9D"} strokeWidth="4" strokeDasharray={`${(cuposOcupados/cuposTotales)*100}, 100`} />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {jugadores.map((jugador) => (
              <div key={jugador.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                  {jugador.profiles?.avatar_url ? (
                    <img src={jugador.profiles.avatar_url} alt={jugador.profiles.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-lg">
                      {jugador.profiles?.nombre ? jugador.profiles.nombre[0].toUpperCase() : "U"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight truncate">
                    {jugador.profiles?.nombre || "Usuario"}
                  </p>
                  {jugador.user_id === partido.creador_id && (
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Organizador</span>
                  )}
                </div>
              </div>
            ))}
            {/* Espacios vacíos */}
            {Array.from({ length: cuposTotales - cuposOcupados }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-gray-100 opacity-50">
                <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0 flex items-center justify-center text-gray-300">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Libre</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* FOOTER FLOTANTE PARA ACCIONES */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-3xl mx-auto flex gap-3">
          {inscrito ? (
            <button
              onClick={cancelarInscripcion}
              disabled={procesando}
              className="flex-1 bg-red-50 text-red-600 font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-red-100 transition-colors disabled:opacity-50 text-sm border border-red-100"
            >
              Cancelar Inscripción
            </button>
          ) : (
            <button
              onClick={handleUnirmeClick}
              disabled={lleno || procesando}
              className={`flex-1 font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm ${
                lleno 
                ? "bg-gray-100 text-gray-400" 
                : "bg-[#0B0C15] text-[#00FF9D] hover:bg-gray-900 shadow-lg shadow-gray-900/20"
              }`}
            >
              {procesando ? "..." : lleno ? "Partido Lleno" : "Unirme al Partido"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}