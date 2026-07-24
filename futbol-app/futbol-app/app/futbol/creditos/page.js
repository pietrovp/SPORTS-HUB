"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { formatCurrency, getMetodoLabel } from "../../../lib/futbol/paymentHelpers";

function formatBs(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Lista de beneficios limpia para el diseño estructurado
const BENEFICIOS_DEFAULT = [
  "Acceso a partidos organizados",
  "Canchas premium garantizadas",
  "Sistema de estadísticas y MVP",
  "Sin mensualidades ni contratos",
];

export default function CreditosPage() {
  const [usuario, setUsuario] = useState(null);
  const [creditosActuales, setCreditosActuales] = useState(null);
  const [packages, setPackages] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [paso, setPaso] = useState("paquetes");
  const [seleccionado, setSeleccionado] = useState(null);
  const [metodo, setMetodo] = useState("pago_movil");

  const [bcvRate, setBcvRate] = useState(null);
  const [bcvFecha, setBcvFecha] = useState("");
  const [bcvError, setBcvError] = useState("");

  const [form, setForm] = useState({
    reference: "",
    payer_phone: "",
    payer_document: "",
    payer_bank: "",
    payer_name: "",
    amount_bs: "",
  });

  useEffect(() => {
    async function cargar() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUsuario(user || null);

      const [pkgRes, setRes] = await Promise.all([
        supabase
          .from("credit_packages")
          .select("*")
          .eq("activo", true)
          .order("orden", { ascending: true }),
        supabase
          .from("merchant_payment_settings")
          .select("*")
          .eq("activo", true),
      ]);

      setPackages(pkgRes.data || []);
      setSettings(setRes.data || []);

      if (user) {
        // FIX: Buscamos en 'profiles' y con 'id'
        const { data: perfil } = await supabase
          .from("profiles")
          .select("creditos")
          .eq("id", user.id)
          .single();

        setCreditosActuales(perfil?.creditos ?? 0);
      }

      try {
        const res = await fetch("/api/futbol/bcv-rate", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          setBcvError(data.error || "No se pudo cargar la tasa BCV.");
        } else {
          setBcvRate(data.usdRate || null);
          setBcvFecha(data.fechaValor || "");
        }
      } catch (error) {
        setBcvError("No se pudo conectar con la tasa BCV.");
      }

      setLoading(false);
    }

    cargar();
  }, []);

  const paquete = useMemo(
    () => packages.find((p) => p.code === seleccionado) || null,
    [packages, seleccionado]
  );

  const metodoConfig = useMemo(
    () => settings.find((s) => s.metodo === metodo) || null,
    [settings, metodo]
  );

  const montoBsCalculado = useMemo(() => {
    if (!paquete || !bcvRate) return null;
    return Number(paquete.precio_usd) * Number(bcvRate);
  }, [paquete, bcvRate]);

  useEffect(() => {
    if (metodo === "pago_movil" && montoBsCalculado) {
      setForm((prev) => ({
        ...prev,
        amount_bs: montoBsCalculado.toFixed(2),
      }));
    }
  }, [metodo, montoBsCalculado]);

  function elegirPaquete(pkg) {
    setSeleccionado(pkg.code);
    setPaso("pasarela");
    setMensaje("");
  }

  function volverAPaquetes() {
    setPaso("paquetes");
    setMensaje("");
  }

  function avanzarAReporte() {
    setPaso("reporte");
    setMensaje("");
  }

  async function subirComprobante(file, userId) {
    const ext = file.name.split(".").pop();
    const filePath = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, file, { upsert: false });

    if (error) throw error;

    const { data } = supabase.storage
      .from("payment-proofs")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function reportarPago(e) {
    e.preventDefault();
    setMensaje("");

    if (!usuario) {
      setMensaje("Debes iniciar sesión para reportar el pago.");
      return;
    }

    if (!paquete) {
      setMensaje("Selecciona un paquete.");
      return;
    }

    setSubmitting(true);

    try {
      let proofUrl = null;
      const file = e.target.proof.files?.[0];

      if (file) {
        proofUrl = await subirComprobante(file, usuario.id);
      }

      const { error } = await supabase.from("payments").insert({
        user_id: usuario.id,
        package_id: paquete.id,
        method: metodo,
        status: "submitted",
        amount_usd: paquete.precio_usd,
        amount_bs: form.amount_bs ? Number(form.amount_bs) : null,
        reference: form.reference,
        payer_phone: form.payer_phone || null,
        payer_document: form.payer_document || null,
        payer_bank: form.payer_bank || null,
        payer_name: form.payer_name || null,
        proof_url: proofUrl,
      });

      if (error) throw error;

      setMensaje("Pago reportado correctamente. Quedó pendiente por aprobación.");
      setForm({
        reference: "",
        payer_phone: "",
        payer_document: "",
        payer_bank: "",
        payer_name: "",
        amount_bs: "",
      });
      e.target.reset();
      setPaso("confirmado");
    } catch (error) {
      setMensaje(error.message || "No se pudo reportar el pago.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-400"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 max-w-6xl mx-auto">
      {/* Encabezado Principal */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-900 uppercase tracking-tight">
            Planes y Créditos
          </h1>
          <p className="text-sm text-zinc-500 mt-1.5 font-medium">
            Elige la cantidad de partidos que deseas jugar esta semana.
          </p>
        </div>

        {creditosActuales !== null && (
          <div className="bg-white border border-zinc-200 rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Tus créditos
              </p>
              <p className="text-2xl font-black text-zinc-900 leading-none mt-1">
                {creditosActuales}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
              ⚡
            </div>
          </div>
        )}
      </div>

      {/* --- PASO 1: PARRILLA DE PAQUETES (TONOS GRISES PREMIUM) --- */}
      {paso === "paquetes" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {packages.map((pkg) => {
            const montoBs = bcvRate ? Number(pkg.precio_usd) * Number(bcvRate) : null;
            const precioPorCredito =
              pkg.creditos && Number(pkg.creditos) > 0
                ? Number(pkg.precio_usd) / Number(pkg.creditos)
                : null;

            const esMasPopular = pkg.code?.toLowerCase() === "pro";

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-[2rem] overflow-hidden border transition-all duration-300 bg-white ${
                  esMasPopular
                    ? "border-emerald-500 ring-4 ring-emerald-500/10 shadow-md lg:-translate-y-2"
                    : "border-zinc-200 shadow-sm hover:shadow-md"
                }`}
              >
                {/* Cinta superior naranja sutil para destacar */}
                {esMasPopular && (
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-widest text-center py-2 shadow-sm">
                    Más Popular 🔥
                  </div>
                )}

                <div className="flex flex-col flex-1 p-6 justify-between gap-6">
                  <div>
                    {/* Nombre y Badge de Créditos */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black uppercase tracking-wider ${
                          esMasPopular ? "text-emerald-600" : "text-zinc-400"
                        }`}
                      >
                        {pkg.code || "Plan"}
                      </span>
                      <span className="text-[11px] font-black bg-zinc-100 text-zinc-700 px-3 py-1 rounded-full uppercase tracking-wide border border-zinc-200/60">
                        {pkg.creditos} {pkg.creditos === 1 ? "partido" : "partidos"}
                      </span>
                    </div>

                    {/* Bloque de Precio (Fondo Gris Claro) */}
                    <div
                      className={`text-center rounded-2xl py-6 px-3 border mt-4 ${
                        esMasPopular
                          ? "bg-emerald-50/40 border-emerald-100"
                          : "bg-zinc-50 border-zinc-100"
                      }`}
                    >
                      <div className="text-3xl font-black text-zinc-900 tracking-tight">
                        {formatCurrency(pkg.precio_usd, "USD")}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mt-1.5">
                        {pkg.creditos} Créditos ⚡
                      </div>
                      {precioPorCredito !== null && (
                        <div className="text-[10px] text-zinc-400 font-medium mt-1">
                          {formatCurrency(precioPorCredito, "USD")} por partido
                        </div>
                      )}
                      {montoBs && (
                        <div className="text-xs text-zinc-500 font-semibold mt-1">
                          ó {formatBs(montoBs)}
                        </div>
                      )}
                    </div>

                    {/* Lista de Beneficios */}
                    <div className="flex flex-col gap-3 mt-5">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        Incluye
                      </p>
                      {BENEFICIOS_DEFAULT.map((beneficio, i) => (
                        <div key={i} className="flex items-start gap-3 text-left">
                          <span
                            className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              esMasPopular
                                ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                                : "border-zinc-200 text-zinc-400 bg-zinc-50"
                            }`}
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                            </svg>
                          </span>
                          <span className="text-xs text-zinc-600 font-medium leading-snug">
                            {beneficio}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botón de compra */}
                  <button
                    type="button"
                    onClick={() => elegirPaquete(pkg)}
                    className={`w-full rounded-xl py-3 text-sm font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm ${
                      esMasPopular
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10"
                        : "bg-zinc-800 hover:bg-zinc-700 text-white"
                    }`}
                  >
                    Seleccionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- PASO 2: SELECCIÓN DE PASARELA Y DATOS --- */}
      {paso === "pasarela" && paquete && (
        <div className="max-w-xl mx-auto w-full bg-white rounded-3xl p-6 md:p-8 border border-zinc-200 shadow-sm flex flex-col gap-6">
          <button
            type="button"
            onClick={volverAPaquetes}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1.5 self-start uppercase tracking-wider"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path>
            </svg>
            Volver a los planes
          </button>

          {/* Resumen del pedido */}
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-5 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Resumen de orden
            </span>
            <div className="flex justify-between items-baseline flex-wrap">
              <h3 className="font-black text-zinc-900 text-lg">
                {paquete.nombre} ({paquete.creditos} créditos)
              </h3>
              <span className="text-xl font-black text-zinc-900">
                {formatCurrency(paquete.precio_usd, "USD")}
              </span>
            </div>

            {metodo === "pago_movil" && montoBsCalculado && (
              <div className="mt-3 pt-3 border-t border-zinc-200 flex justify-between items-center">
                <span className="text-xs text-zinc-500 font-medium">
                  Total en Bolívares:
                </span>
                <span className="text-lg font-black text-emerald-600">
                  {formatBs(montoBsCalculado)}
                </span>
              </div>
            )}

            {metodo === "pago_movil" && bcvRate && (
              <p className="text-[10px] text-zinc-400 font-medium mt-1">
                Tasa Oficial BCV: {bcvRate.toFixed(2)} Bs/USD {bcvFecha ? `• Valor: ${bcvFecha}` : ""}
              </p>
            )}
            {bcvError && <p className="text-xs text-red-500 mt-1">{bcvError}</p>}
          </div>

          {/* Selector de métodos */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Método de pago
            </label>
            <div className="grid grid-cols-2 gap-3">
              {["pago_movil", "zelle"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    metodo === m
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                      : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {getMetodoLabel(m)}
                </button>
              ))}
            </div>
          </div>

          {/* Caja con los datos de cuenta */}
          {metodoConfig ? (
            <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-5">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Cuentas oficiales para transferencia
              </h4>
              {metodo === "pago_movil" ? (
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <span className="text-[10px] block font-bold text-zinc-400 uppercase tracking-wider">Banco</span>
                    <span className="font-semibold text-zinc-900">{metodoConfig.banco}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block font-bold text-zinc-400 uppercase tracking-wider">Teléfono</span>
                    <span className="font-semibold text-zinc-900">{metodoConfig.telefono}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block font-bold text-zinc-400 uppercase tracking-wider">RIF / C.I</span>
                    <span className="font-semibold text-zinc-900">{metodoConfig.documento}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block font-bold text-zinc-400 uppercase tracking-wider">Titular</span>
                    <span className="font-semibold text-zinc-900">{metodoConfig.titular}</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-y-3 text-sm">
                  <div>
                    <span className="text-[10px] block font-bold text-zinc-400 uppercase tracking-wider">Correo Electrónico</span>
                    <span className="font-semibold text-zinc-900">{metodoConfig.correo_zelle}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block font-bold text-zinc-400 uppercase tracking-wider">Beneficiario</span>
                    <span className="font-semibold text-zinc-900">{metodoConfig.nombre_zelle}</span>
                  </div>
                </div>
              )}
              {metodoConfig.instrucciones && (
                <p className="text-xs text-zinc-500 bg-white border border-zinc-200 p-2.5 rounded-lg mt-4 font-medium italic">
                  📢 {metodoConfig.instrucciones}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 p-4 text-sm font-medium">
              Información de cuenta no disponible en este momento.
            </div>
          )}

          <button
            type="button"
            disabled={!metodoConfig}
            onClick={avanzarAReporte}
            className={`rounded-xl py-3.5 text-sm font-black uppercase tracking-wider transition-all ${
              !metodoConfig
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            Ya realicé el pago, continuar
          </button>
        </div>
      )}

      {/* --- PASO 3: FORMULARIO DE REPORTE DETALLADO --- */}
      {paso === "reporte" && paquete && (
        <form
          onSubmit={reportarPago}
          className="max-w-xl mx-auto w-full bg-white rounded-3xl p-6 md:p-8 border border-zinc-200 shadow-sm flex flex-col gap-6"
        >
          <button
            type="button"
            onClick={() => setPaso("pasarela")}
            className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1.5 self-start uppercase tracking-wider"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path>
            </svg>
            Volver a cuentas
          </button>

          <div className="border-b border-zinc-100 pb-4">
            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
              Reportar Transacción
            </h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              Adjunta los datos del comprobante para acreditar tus tokens.
            </p>
          </div>

          {!usuario && (
            <div className="rounded-xl bg-amber-50 text-amber-800 p-3.5 text-xs font-bold">
              ⚠️ Inicia sesión con tu cuenta antes de reportar un pago.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Número de Referencia
              </label>
              <input
                placeholder="Ej. 48291039"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-zinc-900 placeholder-zinc-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Nombre del Titular
              </label>
              <input
                placeholder="Nombre de quien pagó"
                value={form.payer_name}
                onChange={(e) => setForm({ ...form, payer_name: e.target.value })}
                className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-zinc-900 placeholder-zinc-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Teléfono Emisor
              </label>
              <input
                placeholder="Opcional"
                value={form.payer_phone}
                onChange={(e) => setForm({ ...form, payer_phone: e.target.value })}
                className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                C.I. / RIF Emisor
              </label>
              <input
                placeholder="Opcional"
                value={form.payer_document}
                onChange={(e) => setForm({ ...form, payer_document: e.target.value })}
                className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Banco de origen
              </label>
              <input
                placeholder="Ej. Banesco"
                value={form.payer_bank}
                onChange={(e) => setForm({ ...form, payer_bank: e.target.value })}
                className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-zinc-900 placeholder-zinc-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Monto enviado (Bs.)
              </label>
              <input
                placeholder="Opcional"
                type="number"
                step="0.01"
                value={form.amount_bs}
                onChange={(e) => setForm({ ...form, amount_bs: e.target.value })}
                className="rounded-xl bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-all text-zinc-900 placeholder-zinc-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-zinc-50 border border-zinc-200 p-4 rounded-2xl">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Subir Foto del Comprobante
            </label>
            <input
              type="file"
              name="proof"
              accept="image/*,.pdf"
              className="block w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={!usuario || submitting}
            className={`w-full rounded-xl py-3.5 text-sm font-black uppercase tracking-wider transition-all ${
              !usuario || submitting
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {submitting ? "Procesando Reporte..." : "Enviar Reporte Oficial"}
          </button>

          {mensaje && (
            <p className="text-xs text-center font-bold text-gray-500 bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
              {mensaje}
            </p>
          )}
        </form>
      )}

      {/* --- PASO 4: PANTALLA DE ÉXITO --- */}
      {paso === "confirmado" && (
        <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 bg-green-50 border border-green-200 text-green-500 text-3xl flex items-center justify-center rounded-full shadow-inner">
            ✓
          </div>
          <div>
            <h2 className="font-black text-zinc-900 text-xl uppercase tracking-tight">
              Reporte Recibido
            </h2>
            <p className="text-sm text-zinc-500 mt-2 font-medium leading-relaxed">
              Tu recibo está en cola de revisión administrativa. Te notificaremos cuando tus créditos estén cargados en el sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPaso("paquetes");
              setSeleccionado(null);
            }}
            className="w-full px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold uppercase tracking-wider transition-all"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}