"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatHora12(hora24) {
  if (!hora24) return "";
  const [h, m] = hora24.split(":");
  const horas = parseInt(h, 10);
  const ampm = horas >= 12 ? "PM" : "AM";
  const h12 = horas % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function generarPassword() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function ReservarCancha() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [sedes, setSedes] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState(null);
  
  const [fechas, setFechas] = useState([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null);
  
  const [franjas, setFranjas] = useState([]);
  const [horasOcupadas, setHorasOcupadas] = useState([]);
  const [franjaSeleccionada, setFranjaSeleccionada] = useState(null);
  
  const [tipoPago, setTipoPago] = useState("parte");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const proximosDias = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      proximosDias.push(d);
    }
    setFechas(proximosDias);
    setFechaSeleccionada(proximosDias[0]);

    async function cargarSedes() {
      if (!supabase) return;
      const { data, error } = await supabase.from("sedes").select("*");
      if (!error && data) {
        setSedes(data);
        if (data.length > 0) setSedeSeleccionada(data[0]);
      }
      setCargando(false);
    }
    cargarSedes();
  }, []);

  useEffect(() => {
    async function buscarDisponibilidad() {
      if (!sedeSeleccionada || !fechaSeleccionada || !supabase) return;
      
      setFranjaSeleccionada(null);
      const diaSemana = fechaSeleccionada.getDay();
      const fechaStr = fechaSeleccionada.toISOString().split("T")[0];

      const { data: franjasData } = await supabase
        .from("franjas_horarias")
        .select("*")
        .eq("sede_id", sedeSeleccionada.id)
        .eq("dia_semana", diaSemana)
        .order("hora_inicio", { ascending: true });

      if (franjasData) setFranjas(franjasData);

      const { data: partidosData } = await supabase
        .from("partidos")
        .select("hora")
        .eq("sede_id", sedeSeleccionada.id)
        .eq("fecha", fechaStr)
        .neq("estado", "cancelado");

      if (partidosData) {
        setHorasOcupadas(partidosData.map(p => p.hora));
      } else {
        setHorasOcupadas([]);
      }
    }

    buscarDisponibilidad();
  }, [sedeSeleccionada, fechaSeleccionada]);

  async function confirmarReserva() {
    if (!franjaSeleccionada || !sedeSeleccionada || !fechaSeleccionada) return;
    setProcesando(true);
    setMensaje("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMensaje("Debes iniciar sesión para reservar.");
      setProcesando(false);
      return;
    }

    const cuposMaximos = franjaSeleccionada.cupos_maximos || 14;
    const cuposMinimos = franjaSeleccionada.cupos_minimos || 10;
    
    const costoTotalCancha = franjaSeleccionada.precio_creditos;
    const costoPorJugador = Math.ceil(costoTotalCancha / cuposMaximos);
    const costoReserva = tipoPago === "todo" ? costoTotalCancha : costoPorJugador;
    const precioParaUnirse = tipoPago === "todo" ? 0 : costoPorJugador;

    const esPrivado = tipoPago === "todo";
    const passwordPartido = esPrivado ? generarPassword() : null;

    const { data: perfil } = await supabase.from("profiles").select("creditos").eq("id", user.id).single();
    const creditosUser = perfil?.creditos || 0;

    if (creditosUser < costoReserva) {
      setMensaje(`No tienes créditos suficientes. Necesitas ${costoReserva} créditos.`);
      setProcesando(false);
      return;
    }

    const fechaStr = fechaSeleccionada.toISOString().split("T")[0];

    // 1. CREAR EL PARTIDO
    const { data: nuevoPartido, error: errorPartido } = await supabase
      .from("partidos")
      .insert({
        sede_id: sedeSeleccionada.id,
        creador_id: user.id,
        titulo: `Partido en ${sedeSeleccionada.nombre}`,
        cancha_lugar: sedeSeleccionada.nombre,
        zona: sedeSeleccionada.zona,
        fecha: fechaStr,
        hora: franjaSeleccionada.hora_inicio,
        precio_creditos: precioParaUnirse,
        cupos_totales: cuposMaximos,
        cupos_minimos: cuposMinimos,
        estado: "abierto",
        tipo_acceso: esPrivado ? "privado" : "publico", 
        password: passwordPartido 
      })
      .select()
      .single();

    if (errorPartido) {
      console.error("Error DB creando partido:", errorPartido);
      setMensaje(`Error BD: ${errorPartido.message}`);
      setProcesando(false);
      return;
    }

    // 2. ACTUALIZAR CRÉDITOS Y LEDGER
    const nuevoBalance = creditosUser - costoReserva;
    await supabase.from("profiles").update({ creditos: nuevoBalance }).eq("id", user.id);
    
    const { error: errorLedger } = await supabase.from("credit_ledger").insert({
      user_id: user.id,
      partido_id: nuevoPartido.id,
      delta: -costoReserva,
      reason: esPrivado ? "reserva_cancha_privada" : "reserva_cancha_compartida",
      balance_after: nuevoBalance,
    });
    
    if (errorLedger) console.error("Error insertando en ledger:", errorLedger);

    // 3. INSCRIBIR AL CREADOR
    const { error: errorInscripcion } = await supabase.from("partido_jugadores").insert({
      partido_id: nuevoPartido.id,
      user_id: user.id
    });
    
    if (errorInscripcion) {
      console.error("Error DB inscribiendo jugador:", errorInscripcion);
      setMensaje(`Partido creado, pero error al inscribirte: ${errorInscripcion.message}`);
      setProcesando(false);
      return;
    }

    router.push(`/futbol/partido/${nuevoPartido.id}`);
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-40">
      
      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        
        {/* ENCABEZADO ESTILO COMUNIDAD */}
        <div className="border-b border-gray-200/80 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            Reservar cancha
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Elige tu complejo favorito, selecciona la fecha y aparta el horario de tu próximo juego.
          </p>
        </div>
        
        {/* SECCIÓN: ELIGE TU COMPLEJO */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Elige tu complejo</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {sedes.map((sede) => (
              <button
                key={sede.id}
                onClick={() => setSedeSeleccionada(sede)}
                className={`snap-start shrink-0 w-64 rounded-3xl overflow-hidden border-2 transition-all text-left relative group ${
                  sedeSeleccionada?.id === sede.id 
                  ? "border-[#00FF9D] shadow-md ring-4 ring-[#00FF9D]/10" 
                  : "border-transparent bg-white shadow-sm hover:shadow-md"
                }`}
              >
                <div className="h-32 w-full bg-gray-200 relative overflow-hidden">
                  <img 
                    src={sede.imagen_url || "https://images.unsplash.com/photo-1518605368461-1ee7e53f090b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"} 
                    alt={sede.nombre}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  {sedeSeleccionada?.id === sede.id && (
                    <div className="absolute top-3 right-3 bg-[#00FF9D] text-[#0B0C15] p-1.5 rounded-full shadow-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-white">
                  <p className="font-black text-gray-900 text-lg leading-tight truncate">{sede.nombre}</p>
                  <div className="flex items-center gap-1 mt-1 text-gray-500">
                    <svg className="w-3.5 h-3.5 text-[#00FF9D]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    <p className="text-xs font-semibold">{sede.zona}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* SECCIÓN: FECHA */}
        {sedeSeleccionada && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha</h2>
              <span className="text-xs font-black text-white bg-[#0B0C15] px-3 py-1.5 rounded-lg tracking-widest uppercase">
                {MESES[fechaSeleccionada?.getMonth()]} {fechaSeleccionada?.getFullYear()}
              </span>
            </div>
            
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {fechas.map((fecha, i) => {
                const esHoy = i === 0;
                const isSelected = fechaSeleccionada?.toDateString() === fecha.toDateString();
                
                return (
                  <button
                    key={i}
                    onClick={() => setFechaSeleccionada(fecha)}
                    className={`snap-start shrink-0 w-16 h-20 flex flex-col items-center justify-center rounded-2xl transition-all ${
                      isSelected 
                      ? "bg-[#00FF9D] shadow-lg shadow-[#00FF9D]/20 border-2 border-[#00FF9D]" 
                      : "bg-gray-50 border-2 border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? "text-[#0B0C15]" : "text-gray-400"}`}>
                      {esHoy ? "Hoy" : DIAS_SEMANA[fecha.getDay()]}
                    </span>
                    <span className={`text-2xl font-black mt-0.5 ${isSelected ? "text-[#0B0C15]" : "text-gray-900"}`}>
                      {fecha.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SECCIÓN: HORARIOS DISPONIBLES */}
        {sedeSeleccionada && fechaSeleccionada && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5">Horarios disponibles</h2>
            
            {franjas.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <p className="text-sm font-bold text-gray-400">No hay canchas para este día.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {franjas.map((franja) => {
                  const isOcupada = horasOcupadas.includes(franja.hora_inicio);
                  const isSelected = franjaSeleccionada?.id === franja.id;
                  const cuposDisponibles = franja.cupos_maximos || 14;

                  return (
                    <button
                      key={franja.id}
                      disabled={isOcupada}
                      onClick={() => setFranjaSeleccionada(franja)}
                      className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl border-2 transition-all relative overflow-hidden ${
                        isOcupada
                        ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "border-[#0B0C15] bg-[#0B0C15] shadow-lg"
                        : "border-gray-100 bg-white hover:border-[#00FF9D]/50"
                      }`}
                    >
                      <span className={`text-base font-black ${isOcupada ? "text-gray-400 line-through" : isSelected ? "text-[#00FF9D]" : "text-gray-900"}`}>
                        {formatHora12(franja.hora_inicio)}
                      </span>
                      {!isOcupada && (
                        <span className={`text-[10px] font-bold mt-1 tracking-wider uppercase ${isSelected ? "text-white" : "text-gray-400"}`}>
                          {cuposDisponibles} Cupos
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER FLOTANTE PARA CONFIRMAR RESERVA */}
      {franjaSeleccionada && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 shadow-[0_-20px_40px_rgba(0,0,0,0.08)] z-50 rounded-t-3xl transition-transform transform translate-y-0">
          <div className="max-w-2xl mx-auto">
            
            <div className="mb-4 space-y-2">
              <div 
                onClick={() => setTipoPago("parte")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${tipoPago === "parte" ? "border-[#00FF9D] bg-[#00FF9D]/5" : "border-gray-100 bg-white hover:bg-gray-50"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${tipoPago === "parte" ? "border-[#00FF9D]" : "border-gray-300"}`}>
                    {tipoPago === "parte" && <div className="w-2.5 h-2.5 bg-[#00FF9D] rounded-full"></div>}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm">Pagas tu parte</p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">El partido será público</p>
                  </div>
                </div>
                <span className="font-black text-lg text-gray-900">
                  {Math.ceil(franjaSeleccionada.precio_creditos / (franjaSeleccionada.cupos_maximos || 14))} <span className="text-[10px] text-gray-400">créditos</span>
                </span>
              </div>

              <div 
                onClick={() => setTipoPago("todo")}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${tipoPago === "todo" ? "border-[#00FF9D] bg-[#00FF9D]/5" : "border-gray-100 bg-white hover:bg-gray-50"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${tipoPago === "todo" ? "border-[#00FF9D]" : "border-gray-300"}`}>
                    {tipoPago === "todo" && <div className="w-2.5 h-2.5 bg-[#00FF9D] rounded-full"></div>}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm flex items-center gap-1.5">
                      Reservar cancha completa
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    </p>
                    <p className="text-xs font-medium text-gray-500 mt-0.5">Cancha privada con contraseña</p>
                  </div>
                </div>
                <span className="font-black text-lg text-gray-900">
                  {franjaSeleccionada.precio_creditos} <span className="text-[10px] text-gray-400">créditos</span>
                </span>
              </div>
            </div>

            {mensaje && <p className="text-xs text-red-500 font-bold mb-3 text-center bg-red-50 py-2 rounded-lg">{mensaje}</p>}
            
            <button
              onClick={confirmarReserva}
              disabled={procesando}
              className="w-full bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors disabled:opacity-70 shadow-lg shadow-gray-900/20"
            >
              {procesando ? (
                "Procesando..."
              ) : (
                <>
                  Confirmar y Pagar
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}