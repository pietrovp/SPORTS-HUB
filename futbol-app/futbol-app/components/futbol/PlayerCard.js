"use client";

import { getFlagEmoji } from "../../lib/countries";

const TIERS = [
  {
    min: 99,
    label: "TOTY",
    cardBg: "linear-gradient(155deg,#1d4ed8 0%,#0b1120 100%)",
    textColor: "#f8fafc",
    subText: "#93c5fd",
    barBg: "rgba(147,197,253,0.25)",
    ring: "ring-blue-400/70",
    glowColor: "rgba(59,130,246,0.6)",
    animClass: "animate-glow-toty",
    decor: null,
  },
  {
    min: 90,
    label: "ICONO",
    cardBg: "linear-gradient(155deg,#fffdf7 0%,#fde68a 100%)",
    textColor: "#78350f",
    subText: "#b45309",
    barBg: "rgba(180,83,9,0.15)",
    ring: "ring-yellow-400/80",
    glowColor: "rgba(234,179,8,0.55)",
    animClass: "animate-glow-icono",
    decor: "sparkle",
  },
  {
    min: 80,
    label: "ORO",
    cardBg: "linear-gradient(155deg,#fef9c3 0%,#fbbf24 100%)",
    textColor: "#78350f",
    subText: "#92400e",
    barBg: "rgba(146,64,14,0.15)",
    ring: "ring-amber-300/70",
    glowColor: "rgba(217,119,6,0.45)",
    animClass: "animate-glow-oro",
    decor: null,
  },
  {
    min: 65,
    label: "PLATA",
    cardBg: "linear-gradient(155deg,#f8fafc 0%,#94a3b8 100%)",
    textColor: "#1e293b",
    subText: "#334155",
    barBg: "rgba(51,65,85,0.15)",
    ring: "ring-slate-300/70",
    glowColor: "rgba(100,116,139,0.35)",
    animClass: "animate-glow-plata",
    decor: null,
  },
  {
    min: 0,
    label: "BRONCE",
    cardBg: "linear-gradient(155deg,#c2794f 0%,#6f3a20 100%)",
    textColor: "#fff7ed",
    subText: "#fed7aa",
    barBg: "rgba(0,0,0,0.2)",
    ring: "ring-orange-900/40",
    glowColor: "rgba(111,58,32,0.4)",
    animClass: "animate-glow-bronce",
    decor: null,
  },
];

const SIZES = {
  mini: {
    width: "w-[150px]",
    avatar: 52,
    ovr: "text-3xl",
    label: "text-[10px]",
    flag: "text-xs",
    posBadge: "text-[8px]",
    posBadgePad: "px-2 py-0.5",
    posGap: "gap-1",
    posMarginTop: "mt-10",
    avatarMargin: "mt-3 mb-3",
    name: "text-sm",
    nameMargin: "mb-4",
    pad: "px-3 pt-4 pb-5",
    barPad: "py-1.5",
    barText: "text-[11px]",
  },
  md: {
    width: "w-[230px]",
    avatar: 72,
    ovr: "text-4xl",
    label: "text-xs",
    flag: "text-lg",
    posBadge: "text-[10px]",
    posBadgePad: "px-3 py-0.5",
    posGap: "gap-1.5",
    posMarginTop: "mt-11",
    avatarMargin: "my-3",
    name: "text-sm",
    nameMargin: "",
    pad: "px-3 pt-4",
    barPad: "py-1.5",
    barText: "text-[11px]",
  },
  lg: {
    width: "w-[300px]",
    avatar: 108,
    ovr: "text-6xl",
    label: "text-sm",
    flag: "text-xl",
    posBadge: "text-xs",
    posBadgePad: "px-4 py-1",
    posGap: "gap-1.5",
    posMarginTop: "mt-16",
    avatarMargin: "my-3",
    name: "text-xl",
    nameMargin: "",
    pad: "px-6 pt-8",
    barPad: "py-2.5",
    barText: "text-sm",
  },
};

const POSICION_LABELS = {
  POR: "PORTERO",
  DEF: "DEFENSOR",
  MED: "MEDIOCAMPISTA",
  DEL: "DELANTERO",
};

function getTier(media) {
  return TIERS.find((t) => media >= t.min) ?? TIERS[TIERS.length - 1];
}

function normalizarPosicion(posicion) {
  const p = String(posicion || "").trim().toUpperCase();

  if (["POR", "PORTERO", "ARQUERO", "GK"].includes(p)) return "POR";
  if (["DEF", "DEFENSA", "DEFENSOR", "CB", "LB", "RB"].includes(p)) return "DEF";
  if (["MED", "MEDIO", "MEDIOCAMPO", "MEDIOCAMPISTA", "MC", "MCD", "MCO"].includes(p)) return "MED";
  if (["DEL", "DELANTERO", "ATACANTE", "ST", "DC", "FW"].includes(p)) return "DEL";

  return "MED";
}

function Avatar({ src, alt, size }) {
  return (
    <div
      className="rounded-full bg-white/70 border-4 border-white/80 shadow-md overflow-hidden flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 24 24" className="w-2/3 h-2/3 text-slate-400" fill="currentColor" aria-hidden="true">
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
        </svg>
      )}
    </div>
  );
}

function Sparkle({ className = "", size = 12, delay = "0s", color = "#fff" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      className={`pointer-events-none absolute animate-sparkle motion-reduce:animate-none ${className}`}
      style={{ width: size, height: size, animationDelay: delay }}
    >
      <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" />
    </svg>
  );
}

function Sheen() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 animate-sheen motion-reduce:animate-none"
      style={{
        background:
          "linear-gradient(75deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
      }}
    />
  );
}

export default function PlayerCard({
  nombre = "Jugador",
  posicion = "MED",
  media = 64,
  stats = null,
  nacionalidad = null,
  avatar = null,
  mini = false,
  size,
}) {
  const mediaSegura = Number(media) || 0;
  const nombreSeguro = nombre?.trim() || "Jugador";
  const posicionSegura = normalizarPosicion(posicion);

  const tier = getTier(mediaSegura);
  const resolvedSize = size || (mini ? "mini" : "md");
  const dims = SIZES[resolvedSize] ?? SIZES.md;
  const isMini = resolvedSize === "mini";

  const bandera = nacionalidad ? getFlagEmoji(nacionalidad) : "";

  const attrs = [
    { label: "RIT", value: stats?.ritmo },
    { label: "TIR", value: stats?.tiro },
    { label: "PAS", value: stats?.pase },
    { label: "REG", value: stats?.regate },
    { label: "DEF", value: stats?.defensa },
    { label: "FIS", value: stats?.fisico },
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-[1.4rem] ring-1 ${tier.ring} ${tier.animClass} motion-reduce:animate-none ${dims.width}`}
      style={{ background: tier.cardBg, "--glow-color": tier.glowColor }}
    >
      <Sheen />

      {tier.decor === "sparkle" && (
        <>
          <Sparkle className="top-[8%] left-[14%]" size={14} delay="0s" color={tier.subText} />
          <Sparkle className="top-[18%] right-[10%]" size={10} delay="0.6s" color={tier.subText} />
          <Sparkle className="bottom-[36%] right-[16%]" size={12} delay="1.1s" color={tier.subText} />
        </>
      )}

      <div className={`relative flex flex-col items-center ${dims.pad}`}>
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center text-center">
          <span className={`${dims.label} font-bold tracking-[0.2em]`} style={{ color: tier.subText }}>
            OVR
          </span>
          <span className={`${dims.ovr} font-black leading-none`} style={{ color: tier.textColor }}>
            {mediaSegura}
          </span>
        </div>

        <span
          className={`${dims.posMarginTop} ${dims.posBadge} ${dims.posBadgePad} inline-flex items-center ${dims.posGap} font-bold tracking-wide rounded-full whitespace-nowrap`}
          style={{ background: tier.barBg, color: tier.subText }}
        >
          <span>{POSICION_LABELS[posicionSegura]}</span>
          {bandera ? (
            <>
              <span className="opacity-50">|</span>
              <span
                className={`${dims.flag} leading-none`}
                aria-label={String(nacionalidad).toUpperCase()}
              >
                {bandera}
              </span>
            </>
          ) : null}
        </span>

        <div className={dims.avatarMargin}>
          <Avatar src={avatar} alt={nombreSeguro} size={dims.avatar} />
        </div>

        <p
          className={`text-center ${dims.name} ${dims.nameMargin} font-extrabold leading-tight line-clamp-2 px-1`}
          style={{ color: tier.textColor }}
        >
          {nombreSeguro}
        </p>

        {!isMini && (
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 w-full pb-3">
            {attrs.map((a) => (
              <div key={a.label} className="flex items-center justify-center gap-1">
                <span className={`${dims.attrValue} font-black`} style={{ color: tier.textColor }}>
                  {a.value ?? "-"}
                </span>
                <span className={`${dims.attrLabel} font-semibold opacity-70`} style={{ color: tier.subText }}>
                  {a.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={`relative ${dims.barPad} text-center ${dims.barText} font-bold tracking-[0.15em]`}
        style={{ background: tier.barBg, color: tier.subText }}
      >
        {tier.label}
      </div>
    </div>
  );
}