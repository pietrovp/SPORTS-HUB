export function codigoABandera(codigo) {
  if (!codigo || codigo.length !== 2) return "🏳️";
  const base = 127397;
  return String.fromCodePoint(
    ...codigo
      .toUpperCase()
      .split("")
      .map((c) => base + c.charCodeAt(0))
  );
}

export default function CountryFlag({ codigo, className = "" }) {
  return (
    <span className={className} role="img" aria-label={`Bandera de ${codigo || "desconocido"}`}>
      {codigoABandera(codigo)}
    </span>
  );
}