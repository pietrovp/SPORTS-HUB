"use client";

const NIVELES = {
  Iniciación: "bg-gray-100 text-gray-700",
  Intermedio: "bg-blue-100 text-blue-700",
  Avanzado: "bg-indigo-100 text-indigo-700",
  Competición: "bg-violet-100 text-violet-700",
};

export default function PadelStatsCard({
  nombre,
  nivel = "Iniciación",
  posicionPreferida,
  avatar,
  stats = {},
  size = "md",
}) {
  const { partidos_jugados = 0, victorias = 0, derrotas = 0, puntos = 0 } = stats;
  const ratio = derrotas > 0 ? (victorias / derrotas).toFixed(2) : victorias > 0 ? "∞" : "0.00";
  const anchoClase = size === "lg" ? "max-w-xs" : "max-w-[240px]";

  return (
    <div
      className={`${anchoClase} w-full rounded-3xl overflow-hidden shadow-xl border border-blue-200/60 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white`}
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/10 border border-white/30 flex items-center justify-center overflow-hidden text-xl font-black">
            {avatar ? (
              <img src={avatar} alt={nombre} className="w-full h-full object-cover" />
            ) : (
              <span>🎾</span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-black text-lg leading-tight">{nombre || "Jugador"}</p>
            <span
              className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                NIVELES[nivel] || NIVELES["Iniciación"]
              }`}
            >
              {nivel}
            </span>
          </div>
        </div>

        {posicionPreferida && (
          <p className="text-xs text-blue-100/80">
            Posición preferida: <span className="font-bold text-white">{posicionPreferida}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-blue-100/70">Partidos</p>
            <p className="font-black text-xl">{partidos_jugados}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-blue-100/70">Puntos</p>
            <p className="font-black text-xl">{puntos}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-blue-100/70">Récord V/D</p>
            <p className="font-black text-xl">
              {victorias}/{derrotas}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wide text-blue-100/70">Ratio</p>
            <p className="font-black text-xl">{ratio}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
