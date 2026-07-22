export const COUNTRIES = [
  { code: "VE", name: "Venezuela" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "EC", name: "Ecuador" },
  { code: "MX", name: "México" },
  { code: "US", name: "Estados Unidos" },
  { code: "ES", name: "España" },
  { code: "BR", name: "Brasil" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "BO", name: "Bolivia" },
  { code: "CR", name: "Costa Rica" },
  { code: "PA", name: "Panamá" },
  { code: "DO", name: "República Dominicana" },
];

export function getFlagEmoji(countryCode) {
  if (!countryCode) return "";

  const limpio = String(countryCode).trim().toUpperCase();

  const alias = {
    VENEZUELA: "VE",
    ARGENTINA: "AR",
    COLOMBIA: "CO",
    CHILE: "CL",
    PERU: "PE",
    PERÚ: "PE",
    ECUADOR: "EC",
    MEXICO: "MX",
    MÉXICO: "MX",
    USA: "US",
    EEUU: "US",
    "ESTADOS UNIDOS": "US",
    ESPANA: "ES",
    ESPAÑA: "ES",
    BRASIL: "BR",
    URUGUAY: "UY",
    PARAGUAY: "PY",
    BOLIVIA: "BO",
    "COSTA RICA": "CR",
    PANAMA: "PA",
    PANAMÁ: "PA",
    "REPUBLICA DOMINICANA": "DO",
    "REPÚBLICA DOMINICANA": "DO",
  };

  const code = alias[limpio] || limpio;

  if (!/^[A-Z]{2}$/.test(code)) return "";

  const base = 127397;
  return String.fromCodePoint(...code.split("").map((c) => base + c.charCodeAt(0)));
}