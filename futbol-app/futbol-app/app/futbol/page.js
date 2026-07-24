"use client";

import { useEffect, useState } from "react";
import PartidoCard from "../../components/futbol/PartidoCard";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

export default function Home() {
  const [partidos, setPartidos] = useState([]);
  const [usuarioId, setUsuarioId] = useState(null);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      setIsUserLoggedIn(!!user);
      setUsuarioId(user?.id || null);

      const { data: partidosData, error: partidosError } = await supabase
        .from("partidos")
        .select("*, sedes(imagen_url)")
        .order("fecha", { ascending: true });

      if (partidosError) {
        console.error("Error al cargar partidos:", partidosError);
      } else if (partidosData) {
        
        const { data: jugadoresData } = await supabase
          .from("partido_jugadores")
          .select("partido_id, user_id, equipo");

        const conteoPorPartido = {};
        const inscritosPorPartido = {}; 
        const equipoDelUsuario = {}; 
        
        (jugadoresData || []).forEach((j) => {
          conteoPorPartido[j.partido_id] = (conteoPorPartido[j.partido_id] || 0) + 1;
          
          if (!inscritosPorPartido[j.partido_id]) {
            inscritosPorPartido[j.partido_id] = [];
          }
          inscritosPorPartido[j.partido_id].push(j.user_id);

          if (user && j.user_id === user.id) {
            equipoDelUsuario[j.partido_id] = Number(j.equipo);
          }
        });

        const partidosCompletos = partidosData.map((p) => ({
          ...p,
          cupos_ocupados: conteoPorPartido[p.id] || 0,
          jugadores_inscritos: inscritosPorPartido[p.id] || [],
          mi_equipo: equipoDelUsuario[p.id] || null, 
        }));
        
        setPartidos(partidosCompletos);
      }
      setCargando(false);
    }

    cargarDatos();
  }, []);

  const proximos = partidos.filter((p) => {
    if (p.estado === "finalizado" || p.estado === "cancelado") return false;
    
    if (p.tipo_acceso === "privado") {
      const soyCreador = p.creador_id === usuarioId;
      const estoyInscrito = p.jugadores_inscritos.includes(usuarioId);
      return soyCreador || estoyInscrito; 
    }
    return true;
  });
  
  const jugados = partidos
    .filter((p) => {
      if (p.estado !== "finalizado") return false;
      if (p.tipo_acceso === "privado") {
        const soyCreador = p.creador_id === usuarioId;
        const estoyInscrito = p.jugadores_inscritos.includes(usuarioId);
        return soyCreador || estoyInscrito;
      }
      return true;
    })
    .sort((a, b) => {
      const fechaA = new Date(`${a.fecha || ""}T${a.hora || "00:00:00"}`).getTime();
      const fechaB = new Date(`${b.fecha || ""}T${b.hora || "00:00:00"}`).getTime();
      return fechaB - fechaA;
    })
    .slice(0, 3); 

  const comoFuncionaSection = (
    <div className="w-full text-center mt-8">
      <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter mb-8">¿Cómo funciona?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <svg className="w-10 h-10 text-[#00FF9D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>, title: "Busca un partido", desc: "Encuentra juegos en tu zona." },
          { icon: <svg className="w-10 h-10 text-[#00FF9D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>, title: "Reserva tu cupo", desc: "Usa tus créditos para unirte." },
          { icon: <svg className="w-10 h-10 text-[#00FF9D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>, title: "Juega y disfruta", desc: "Preséntate en la cancha y dale." },
        ].map((item, i) => (
          <div key={i} className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center group hover:-translate-y-1 transition-transform duration-300">
            <div className="w-20 h-20 rounded-full bg-[#0B0C15] flex items-center justify-center mb-6 shadow-lg shadow-gray-300 group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
            <h3 className="font-black text-lg text-gray-900 uppercase">{item.title}</h3>
            <p className="text-gray-500 text-sm font-medium mt-2">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-12 max-w-6xl mx-auto pb-12">
      <div className="relative w-full min-h-[500px] md:min-h-[600px] bg-[#0B0C15] rounded-[2.5rem] overflow-hidden flex flex-col justify-center items-center text-center shadow-2xl border border-gray-800/50">
        <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1893&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Jugador de fútbol en la cancha" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-[#0B0C15]/70 to-[#0B0C15]/30 z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C15]/80 via-transparent to-[#0B0C15]/80 z-0"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#00FF9D]/15 blur-[120px] pointer-events-none z-0"></div>
        
        <div className="relative z-10 max-w-3xl flex flex-col items-center px-6 mt-12 md:mt-0">
          <span className="mb-4 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-xs font-bold uppercase tracking-widest shadow-lg">La cancha te espera</span>
          <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-[0.9] drop-shadow-2xl">Juega fútbol <br /><span className="text-[#00FF9D] drop-shadow-[0_0_25px_rgba(0,255,157,0.4)]">cuando quieras</span></h1>
          <p className="mt-6 text-gray-300 text-sm md:text-lg max-w-lg font-medium drop-shadow-md">Únete a partidos organizados en Barquisimeto sin compromisos. ¿Sin equipo? No hay excusas. Reserva tu primer partido ahora.</p>
          <div className="mt-10 flex gap-4">
            <Link href="#partidos" className="px-8 py-4 bg-[#00FF9D] text-[#0B0C15] font-black uppercase tracking-widest rounded-full text-sm hover:bg-[#00e58d] transition-all transform hover:scale-105 shadow-[0_0_40px_rgba(0,255,157,0.4)]">Ver partidos</Link>
          </div>
        </div>
      </div>

      {!cargando && (
        <>
          {!isUserLoggedIn && comoFuncionaSection}

          <div id="partidos" className="scroll-mt-24 mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Próximos juegos</h2>
              <span className="text-sm font-bold bg-[#00FF9D]/20 text-emerald-800 px-3 py-1 rounded-full">{proximos.length} disponibles</span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {proximos.length === 0 && (
                <div className="col-span-2 bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
                  <span className="text-gray-300 mb-3 block"><svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></span>
                  <p className="text-gray-500 font-medium text-lg">No hay partidos públicos próximos en este momento.</p>
                </div>
              )}

              {proximos.map((partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={{
                    id: partido.id,
                    cancha: partido.cancha_lugar || partido.cancha || partido.titulo || "Cancha",
                    zona: partido.zona,
                    fecha: partido.fecha,
                    hora: partido.hora,
                    cuposTotales: partido.cupos_totales || 14,
                    cuposOcupados: partido.cupos_ocupados || 0,
                    precio_creditos: partido.precio_creditos || 1,
                    estado: partido.estado,
                    imagenUrl: partido.sedes?.imagen_url || partido.imagen_url, 
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Resultados</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {jugados.length === 0 ? (
                <div className="col-span-2 bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
                  <p className="text-gray-500 font-medium">Aún no hay resultados para mostrar.</p>
                </div>
              ) : (
                jugados.map((partido) => {
                  
                  let resultadoTexto = partido.zona || "Amistoso"; 
                  let colorBarra = "bg-gray-600"; 
                  let colorTexto = "text-gray-400";

                  if (partido.mi_equipo) {
                    const g1 = partido.goles_equipo1 || 0;
                    const g2 = partido.goles_equipo2 || 0;
                    
                    if (g1 === g2) {
                      resultadoTexto = "Empate";
                      colorBarra = "bg-yellow-400";
                      colorTexto = "text-yellow-400";
                    } else if (
                      (partido.mi_equipo === 1 && g1 > g2) || 
                      (partido.mi_equipo === 2 && g2 > g1)
                    ) {
                      resultadoTexto = "Victoria";
                      colorBarra = "bg-[#00FF9D]";
                      colorTexto = "text-[#00FF9D]";
                    } else {
                      resultadoTexto = "Derrota";
                      colorBarra = "bg-red-500";
                      colorTexto = "text-red-500";
                    }
                  }

                  return (
                    <Link key={partido.id} href={`/futbol/partido/${partido.id}`} className="group bg-[#0B0C15] rounded-3xl p-6 transition-all flex items-center justify-between shadow-xl hover:shadow-[#00FF9D]/10 hover:-translate-y-1 relative overflow-hidden border border-[#1a1c2d]">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${colorBarra}`}></div>
                      
                      <div className="pl-4">
                        <div className="flex items-center gap-2 mb-2"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Finalizado</p></div>
                        <h3 className="font-black text-white text-xl leading-none uppercase">{partido.cancha_lugar || partido.cancha || partido.titulo || "Cancha"}</h3>
                        
                        <p className={`text-xs mt-2 font-bold uppercase tracking-wider ${colorTexto}`}>
                          {resultadoTexto}
                        </p>
                      </div>
                      
                      <div className="bg-[#121422] rounded-2xl px-5 py-3 flex items-center justify-center border border-[#1f233a]">
                        <p className="text-2xl font-black text-white tracking-wider">{partido.goles_equipo1 ?? 0}<span className="text-[#00FF9D] mx-2">-</span>{partido.goles_equipo2 ?? 0}</p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          {isUserLoggedIn && <div className="pt-12 mt-4 border-t border-gray-200/60">{comoFuncionaSection}</div>}
        </>
      )}
    </div>
  );
}