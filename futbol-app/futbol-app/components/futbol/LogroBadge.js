export default function LogroBadge({ label, desc, bonus, desbloqueado }) {
  return (
    <div
      className={`flex flex-col items-center text-center gap-1.5 rounded-2xl border p-4 transition-all ${
        desbloqueado
          ? "bg-cancha-gris border-cancha-verde/30"
          : "bg-white border-gray-100 opacity-40 grayscale"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          desbloqueado ? "bg-cancha-verde/15" : "bg-gray-100"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 ${desbloqueado ? "text-cancha-verdeoscuro" : "text-gray-400"}`}
          fill="currentColor"
        >
          {desbloqueado ? (
            <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 2z" />
          ) : (
            <path d="M17 9V7a5 5 0 00-10 0v2a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-8a2 2 0 00-2-2zm-8-2a3 3 0 016 0v2H9V7z" />
          )}
        </svg>
      </div>
      <p className="text-xs font-bold text-gray-700 leading-tight">{label}</p>
      <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
      {bonus && (
        <span
          className={`text-[9px] font-bold rounded-full px-2 py-0.5 ${
            desbloqueado ? "bg-cancha-verde/15 text-cancha-verdeoscuro" : "bg-gray-100 text-gray-400"
          }`}
        >
          {bonus}
        </span>
      )}
    </div>
  );
}