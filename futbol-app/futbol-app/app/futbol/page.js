import PartidoCard from "../../components/futbol/PartidoCard";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  let partidos = [];

  if (supabase) {
    // 1. Consultamos los partidos directamente sin dependencias relacionales
    const { data: partidosData, error: partidosError } = await supabase
      .from("partidos")
      .select("*")
      .order("fecha", { ascending: true });

    if (partidosError) {
      console.error("Error al cargar partidos en Home:", partidosError);
    } else if (partidosData) {
      // 2. Consultamos las inscripciones para contar cupos ocupados
      const { data: jugadoresData } = await supabase
        .from("partido_jugadores")
        .select("partido_id");

      const conteoPorPartido = {};
      (jugadoresData || []).forEach((j) => {
        conteoPorPartido[j.partido_id] = (conteoPorPartido[j.partido_id] || 0) + 1;
      });

      // Mapeamos los cupos ocupados a cada partido
      partidos = partidosData.map((p) => ({
        ...p,
        cupos_ocupados: conteoPorPartido[p.id] || 0,
      }));
    }
  }

  const proximos = partidos.filter((p) => p.estado !== "finalizado");
  const jugados = partidos
    .filter((p) => p.estado === "finalizado")
    .sort((a, b) => {
      const fechaA = new Date(`${a.fecha || ""}T${a.hora || "00:00:00"}`).getTime();
      const fechaB = new Date(`${b.fecha || ""}T${b.hora || "00:00:00"}`).getTime();
      return fechaB - fechaA;
    })
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-12 max-w-6xl mx-auto pb-12">
      
      {/* --- HERO SECTION --- */}
      <div className="relative w-full bg-[#0B0C15] rounded-[2.5rem] overflow-hidden px-6 py-16 md:py-24 flex flex-col items-center text-center shadow-2xl">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#00FF9D]/10 blur-[120px] pointer-events-none"></div>
        
        <div className="relative z-10 max-w-3xl flex flex-col items-center">
          <h1 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter leading-[0.9]">
            Juega fútbol <br />
            <span className="text-[#00FF9D]">cuando quieras</span>
          </h1>
          <p className="mt-6 text-gray-400 text-sm md:text-lg max-w-lg font-medium">
            Únete a partidos organizados en Barquisimeto sin compromisos. ¿Sin equipo? No hay excusas. Reserva tu primer partido ahora.
          </p>
          
          <div className="mt-10 flex gap-4">
            <Link
              href="#partidos"
              className="px-8 py-4 bg-[#00FF9D] text-[#0B0C15] font-black uppercase tracking-wider rounded-full text-sm hover:bg-[#00e58d] transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(0,255,157,0.3)]"
            >
              Ver partidos
            </Link>
          </div>
        </div>

        <div className="relative w-full max-w-5xl h-48 md:h-64 mt-16 flex justify-center items-center gap-4 md:gap-8 z-10">
          <div className="w-32 h-40 md:w-56 md:h-72 rounded-2xl overflow-hidden shadow-2xl transform -rotate-6 translate-y-4 md:translate-y-8 border-4 border-[#121422]">
            <img src="https://images.unsplash.com/photo-1511886929837-354d827aae26?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Jugador" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          </div>
          <div className="w-40 h-48 md:w-72 md:h-80 rounded-2xl overflow-hidden shadow-2xl z-20 border-4 border-[#121422] relative group">
            <div className="absolute inset-0 bg-[#00FF9D]/20 group-hover:bg-transparent transition-colors z-10"></div>
            <img src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Cancha" className="w-full h-full object-cover" />
          </div>
          <div className="w-32 h-40 md:w-56 md:h-72 rounded-2xl overflow-hidden shadow-2xl transform rotate-6 translate-y-4 md:translate-y-8 border-4 border-[#121422]">
            <img src="https://images.unsplash.com/photo-1526232761682-d26e03ac148e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="Zapatos" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>

      {/* --- CÓMO FUNCIONA --- */}
      <div className="w-full text-center mt-8">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter mb-8">¿Cómo funciona?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { 
              icon: (
                <svg className="w-10 h-10 text-[#00FF9D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              ), 
              title: "Busca un partido", 
              desc: "Encuentra juegos en tu zona." 
            },
            { 
              icon: (
                <svg className="w-10 h-10 text-[#00FF9D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
              ), 
              title: "Reserva tu cupo", 
              desc: "Usa tus créditos para unirte." 
            },
            { 
              icon: (
                <svg className="w-10 h-10 text-[#00FF9D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              ), 
              title: "Juega y disfruta", 
              desc: "Preséntate en la cancha y dale." 
            },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center group">
              <div className="w-20 h-20 rounded-full bg-[#0B0C15] flex items-center justify-center mb-6 shadow-lg shadow-gray-300 group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </div>
              <h3 className="font-black text-lg text-gray-900 uppercase">{item.title}</h3>
              <p className="text-gray-500 text-sm font-medium mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* --- PRÓXIMOS PARTIDOS --- */}
      <div id="partidos" className="scroll-mt-24 mt-8">
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Próximos juegos</h2>
          <span className="text-sm font-bold bg-[#00FF9D]/20 text-emerald-800 px-3 py-1 rounded-full">
            {proximos.length} disponibles
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {proximos.length === 0 && (
            <div className="col-span-2 bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
              <span className="text-gray-300 mb-3 block">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </span>
              <p className="text-gray-500 font-medium text-lg">No hay partidos próximos en este momento.</p>
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
                imagenUrl: partido.imagen_url,
              }}
            />
          ))}
        </div>
      </div>

      {/* --- RESULTADOS JUGADOS --- */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Resultados</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {jugados.length === 0 ? (
            <div className="col-span-2 bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm">
              <p className="text-gray-500 font-medium">Aún no hay resultados para mostrar.</p>
            </div>
          ) : (
            jugados.map((partido) => (
              <Link
                key={partido.id}
                href={`/futbol/partido/${partido.id}`}
                className="group bg-[#0B0C15] rounded-3xl p-6 transition-all flex items-center justify-between shadow-xl hover:shadow-[#00FF9D]/10 hover:-translate-y-1 relative overflow-hidden border border-[#1a1c2d]"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00FF9D]"></div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Finalizado
                    </p>
                  </div>
                  <h3 className="font-black text-white text-xl leading-none uppercase">
                    {partido.cancha_lugar || partido.cancha || partido.titulo || "Cancha"}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2 font-medium">{partido.zona}</p>
                </div>
                
                <div className="bg-[#121422] rounded-2xl px-5 py-3 flex items-center justify-center border border-[#1f233a]">
                  <p className="text-2xl font-black text-white tracking-wider">
                    {partido.goles_equipo1 ?? 0}<span className="text-[#00FF9D] mx-2">-</span>{partido.goles_equipo2 ?? 0}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}