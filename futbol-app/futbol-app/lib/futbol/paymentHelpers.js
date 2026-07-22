export function formatCurrency(value, currency = "USD") {
  const number = Number(value || 0);

  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(number);
}

export function getMetodoLabel(method) {
  if (method === "pago_movil") return "Pago Móvil";
  if (method === "zelle") return "Zelle";
  return method;
}

export function getStatusLabel(status) {
  const labels = {
    pending: "Pendiente",
    submitted: "Reportado",
    under_review: "En revisión",
    confirmed: "Confirmado",
    rejected: "Rechazado",
  };

  return labels[status] || status;
}
