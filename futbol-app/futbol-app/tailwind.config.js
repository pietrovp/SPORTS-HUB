/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        cancha: {
          verde: "#1D9E75",
          verdeoscuro: "#085041",
          amarillo: "#F5C518",
          gris: "#F4F6F8",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 16px 0 rgba(8,80,65,0.08)",
      },
      keyframes: {
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 16px -6px var(--glow-color)" },
          "50%": { boxShadow: "0 0 34px 0px var(--glow-color)" },
        },
        sparkleTwinkle: {
          "0%, 100%": { opacity: "0", transform: "scale(0.3) rotate(0deg)" },
          "40%": { opacity: "1", transform: "scale(1) rotate(15deg)" },
          "60%": { opacity: "1", transform: "scale(0.85) rotate(-10deg)" },
        },
        lightningFlash: {
          "0%, 100%": { opacity: "0" },
          "2%": { opacity: "1" },
          "4%": { opacity: "0.15" },
          "6%": { opacity: "1" },
          "9%": { opacity: "0" },
        },
        sheenSweep: {
          "0%": { transform: "translateX(-60%) skewX(-20deg)", opacity: "0" },
          "6%": { opacity: "1" },
          "22%": { transform: "translateX(320%) skewX(-20deg)", opacity: "0" },
          "100%": { transform: "translateX(320%) skewX(-20deg)", opacity: "0" },
        },
      },
      animation: {
        "glow-toty": "glowPulse 2.2s ease-in-out infinite",
        "glow-icono": "glowPulse 2.6s ease-in-out infinite",
        "glow-oro": "glowPulse 3s ease-in-out infinite",
        "glow-plata": "glowPulse 3.6s ease-in-out infinite",
        "glow-bronce": "glowPulse 4s ease-in-out infinite",
        sparkle: "sparkleTwinkle 2.4s ease-in-out infinite",
        lightning: "lightningFlash 4.5s ease-in-out infinite",
        sheen: "sheenSweep 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};