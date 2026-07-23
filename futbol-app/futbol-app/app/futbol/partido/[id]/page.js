import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import AccionesPartido from "../../../../components/futbol/AccionesPartido";
import EstadoMiPartido from "../../../../components/futbol/EstadoMiPartido";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatFechaLarga(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()];
}

function formatHora(horaStr) {
  if (!horaStr) return "";
  const partes = horaStr.split(":");
  const h = partes[0];
  const m = partes[1];
  const hora = parseInt(h, 10);
  const ampm = hora >= 12 ? "PM" : "AM";
  const hora12 = hora % 12 === 0 ? 12 : hora % 12;
  return hora12 + ":" + m + " " + ampm;
}

export default async function DetallePartido({ params }) {
  const { id } = params;
  let partido = null;
  let inscritos = [];

  if (supabase) {
    const { data: partidoData } = await supabase
      .from("partidos")
      .select("*")
      .eq("id", id)
      .single();

    partido = partidoData;

    const { data: inscripcionesData } = await supabase
      .from("partido_jugadores")
      .select("id, user_id, goles, asistencias, equipo")
      .eq("partido_id", id);

    const idsUsuarios = (inscripcionesData || []).map((i) => i.user_id);

    let perfilesFutbol = [];
    let perfilesGenerales = [];

    if (idsUsuarios.length > 0) {
      const [{ data: fData }, { data: pData }] = await Promise.all([
        supabase
          .from("futbol_profiles")
          .select("id, posicion, rating")
          .in("id", idsUsuarios),
        supabase
          .from("profiles")
          .select("id, nombre, avatar_url")
          .in("id", idsUsuarios),
      ]);

      perfilesFutbol = fData || [];
      perfilesGenerales = pData || [];
    }

    inscritos = (inscripcionesData || []).map((i) => {
      const fPerfil = perfilesFutbol.find((p) => p.id === i.user_id);
      const pPerfil = perfilesGenerales.find((p) => p.id === i.user_id);

      return {
        id: i.id,
        nombre: pPerfil?.nombre || "Jugador",
        posicion: fPerfil?.posicion || "MED",
        media: fPerfil?.rating != null ? Math.round(Number(fPerfil.rating)) : 64,
        avatarUrl: pPerfil?.avatar_url || null,
        equipo: i.equipo ? Number(i.equipo) : null,
        goles: Number(i.goles) || 0,
        asistencias: Number(i.asistencias) || 0,
      };
    });
  }

  if (!partido) {
    return <p className="text-sm text-gray-500 text-center py-10">Partido no encontrado.</p>;
  }

  // ✅ CORRECCIÓN DE IMAGEN PARA EL DETALLE
  const urlBaseStorage = "https://exrrcqwfiapfdcwjxzbf.supabase.co/storage/v1/object/public/canchas/";
  const rawImagen = partido.imagen_url;
  const imagenFinal = rawImagen?.startsWith("http") ? rawImagen : rawImagen ? `${urlBaseStorage}${rawImagen}` : null;

  const cuposLibres = (partido.cupos_totales || 14) - inscritos.length;
  const ocupacion = Math.round((inscritos.length / (partido.cupos_totales || 14)) * 100);
  const estaFinalizado = partido.estado === "finalizado";
  const equipo1 = inscritos.filter((j) => j.equipo === 1);
  const equipo2 = inscritos.filter((j) => j.equipo === 2);

  const coloresPosicion = {
    POR: "bg-yellow-100 text-yellow-700",
    DEF: "bg-blue-100 text-blue-700",
    MED: "bg-emerald-100 text-emerald-700",
    DEL: "bg-red-100 text-red-700",
  };

  function renderJugador(jugador, finalizado = false) {
    return (
      <div
        key={jugador.id}
        className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow"
      >
        {jugador.avatarUrl ? (
          <img
            src={jugador.avatarUrl}
            alt={jugador.nombre}
            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-50"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center font-black text-emerald-600 text-lg">
            {jugador.nombre.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">{jugador.nombre}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={
                "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider " +
                (coloresPosicion[jugador.posicion] || "bg-gray-100 text-gray-600")
              }
            >
              {jugador.posicion}
            </span>
          </div>
        </div>

        {finalizado ? (
          <div className="text-right bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
            <p className="text-sm font-black text-emerald-800">{jugador.goles} ⚽</p>
            <p className="text-[10px] font-bold text-blue-500 uppercase">{jugador.asistencias} AST</p>
          </div>
        ) : (
          <div className="text-center bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
            <p className="text-lg font-black text-gray-800">{jugador.media}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest -mt-1">OVR</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto pb-10">
      <Link href="/futbol" className="text-sm text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg w-fit flex items-center gap-1.5 font-semibold transition-colors -ml-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
        Volver a partidos
      </Link>

      {/* --- HERO SECTION MEJORADO --- */}
      <div className="relative rounded-3xl overflow-hidden h-48 md:h-56 shadow-md border border-gray-100/10">
        {imagenFinal ? (
          <img
            src={imagenFinal}
            alt={partido.cancha_lugar || partido.cancha}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

        <div className="absolute top-4 left-5 flex flex-wrap items-center gap-2">
          <span className={`text-white text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full backdrop-blur-md ${estaFinalizado ? "bg-gray-900/60 border border-gray-500/30" : "bg-emerald-600/80 border border-emerald-400/30"}`}>
            {estaFinalizado ? "Finalizado" : "Próximo partido"}
          </span>
          <span className="text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            Fútbol {partido.cupos_totales ? partido.cupos_totales / 2 : 7}
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight drop-shadow-xl tracking-tight">
            {partido.cancha_lugar || partido.cancha || partido.titulo}
          </h1>
          <div className="flex items-center gap-1.5 mt-2 opacity-90">
            <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
            <p className="text-white text-sm font-medium drop-shadow-md">{partido.zona}</p>
          </div>
        </div>
      </div>

      {/* --- FECHA Y HORA CONSOLIDADAS --- */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-evenly gap-4">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha del juego</p>
            <p className="font-bold text-gray-900 text-sm md:text-base">{formatFechaLarga(partido.fecha)}</p>
          </div>
        </div>
        <div className="w-px h-10 bg-gray-100"></div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex bg-emerald-50 p-3 rounded-2xl text-emerald-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hora de inicio</p>
            <p className="font-bold text-gray-900 text-sm md:text-base">{formatHora(partido.hora)}</p>
          </div>
        </div>
      </div>

      {estaFinalizado ? (
        <>
          <div className="bg-gray-900 rounded-3xl p-6 shadow-md border border-gray-800 flex flex-col items-center gap-2">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Resultado Final</p>
            <div className="flex items-center gap-6 mt-1">
              <span className="text-sm font-bold text-gray-300">Equipo 1</span>
              <span className="text-5xl font-black text-white tracking-tighter">
                {partido.goles_equipo1 ?? 0} <span className="text-emerald-500 opacity-50 text-4xl">-</span> {partido.goles_equipo2 ?? 0}
              </span>
              <span className="text-sm font-bold text-gray-300">Equipo 2</span>
            </div>
          </div>

          <EstadoMiPartido
            partidoId={partido.id}
            golesEquipo1={partido.goles_equipo1 ?? 0}
            golesEquipo2={partido.goles_equipo2 ?? 0}
            estado={partido.estado}
          />
        </>
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5">
          <div>
            <div className="flex justify-between items-end mb-3">
              <div>
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Disponibilidad</span>
                <span className={`font-black text-lg ${cuposLibres > 0 ? "text-gray-900" : "text-red-500"}`}>
                  {cuposLibres > 0 ? cuposLibres + " cupos libres" : "Cupos agotados"}
                </span>
              </div>
              <span className="text-gray-400 font-bold text-sm bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
                <span className="text-gray-800">{inscritos.length}</span> / {partido.cupos_totales || 14}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={
                  "h-full rounded-full transition-all duration-500 " +
                  (cuposLibres <= 0
                    ? "bg-red-500"
                    : ocupacion > 75
                    ? "bg-yellow-400"
                    : "bg-emerald-500")
                }
                style={{ width: Math.min(ocupacion, 100) + "%" }}
              />
            </div>
          </div>

          <AccionesPartido
            partidoId={partido.id}
            cuposLibres={cuposLibres}
            estado={partido.estado}
            inscritos={inscritos}
          />
        </div>
      )}

      {estaFinalizado ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-black text-gray-800 mb-4 px-1">Equipo 1</h2>
            <div className="flex flex-col gap-2">
              {equipo1.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center bg-gray-50 rounded-2xl">Sin jugadores.</p>
              ) : (
                equipo1.map((jugador) => renderJugador(jugador, true))
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-black text-gray-800 mb-4 px-1">Equipo 2</h2>
            <div className="flex flex-col gap-2">
              {equipo2.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center bg-gray-50 rounded-2xl">Sin jugadores.</p>
              ) : (
                equipo2.map((jugador) => renderJugador(jugador, true))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5 px-1">
            <h2 className="font-black text-gray-900 text-lg">
              Jugadores confirmados
            </h2>
            <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-xl text-sm">
              {inscritos.length}
            </span>
          </div>

          {inscritos.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <span className="text-4xl mb-2 block">🏟️</span>
              <p className="text-sm text-gray-500 font-medium">Nadie ha entrado a la cancha aún.</p>
              <p className="text-xs text-gray-400 mt-1">¡Sé el primero en unirte!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {inscritos.map((jugador) => renderJugador(jugador, false))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}