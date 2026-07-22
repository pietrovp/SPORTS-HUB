import Link from "next/link";

export const metadata = {
  title: "Pádel | Sports Hub",
  description: "Estadísticas y próximamente reservas de pádel.",
};

export default function PadelHome() {
  return (
    <div className="flex flex-col gap-12 max-w-6xl mx-auto pb-12">
      {/* --- HERO --- */}
      <div className="relative w-full bg-[#0B0C2A] rounded-[2.5rem] overflow-hidden px-6 py-16 md:py-24 flex flex-col items-center text-center shadow-2xl">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-500/20 blur-[120px] pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl flex flex-col items-center">
          <span className="text-5xl mb-4">🎾</span>
          <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-[0.9]">
            Pádel <span className="text-blue-400">está llegando</span>
          </h1>
          <p className="mt-6 text-gray-300 text-sm md:text-lg max-w-lg font-medium">
            Usa la misma cuenta con la que juegas fútbol para crear tu perfil de pádel:
            lleva tu nivel, tus victorias y tus puntos.
          </p>

          <div className="mt-10">
            <Link
              href="/padel/perfil"
              className="px-8 py-4 bg-blue-500 text-white font-black uppercase tracking-wider rounded-full text-sm hover:bg-blue-400 transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(59,130,246,0.35)]"
            >
              Ir a mi perfil de pádel
            </Link>
          </div>
        </div>
      </div>

      {/* --- QUÉ SIGUE --- */}
      <div className="w-full text-center mt-4">
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter mb-8">
          Qué puedes hacer hoy
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: "🪪",
              title: "Crea tu perfil",
              desc: "Define tu nivel y tu posición preferida en la pista.",
            },
            {
              icon: "📊",
              title: "Sigue tus estadísticas",
              desc: "Victorias, derrotas y puntos, listos para cuando lleguen los partidos.",
            },
            {
              icon: "🚧",
              title: "Próximamente",
              desc: "Reservas de pista y partidos organizados, igual que en fútbol.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 rounded-full bg-[#0B0C2A] flex items-center justify-center mb-6 shadow-lg shadow-gray-300 text-3xl">
                {item.icon}
              </div>
              <h3 className="font-black text-lg text-gray-900 uppercase">{item.title}</h3>
              <p className="text-gray-500 text-sm font-medium mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
