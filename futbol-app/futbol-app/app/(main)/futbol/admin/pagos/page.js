"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import {
  formatCurrency,
  getMetodoLabel,
  getStatusLabel,
} from "../../../../lib/futbol/paymentHelpers";

const getBadgeStyle = (status) => {
  switch (status) {
    case "confirmed":
      return "bg-green-50 text-green-700 border-green-200";
    case "rejected":
      return "bg-red-50 text-red-700 border-red-200";
    case "under_review":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const DataBlock = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
  </div>
);

export default function AdminPagosPage() {
  const [pagos, setPagos] = useState([]);
  const [usuario, setUsuario] = useState(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eliminandoId, setEliminandoId] = useState(null);

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

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: perfil } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      const admin = !!perfil?.is_admin;
      setEsAdmin(admin);

      if (!admin) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("payments")
        .select(`
          *,
          profiles!payments_user_id_fkey(nombre),
          credit_packages(nombre, creditos)
        `)
        .order("created_at", { ascending: false });

      setPagos(data || []);
      setLoading(false);
    }

    cargar();
  }, []);

  async function actualizarEstado(paymentId, newStatus) {
    const { error } = await supabase
      .from("payments")
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: usuario.id,
      })
      .eq("id", paymentId);

    if (error) {
      alert(error.message);
      return;
    }

    if (newStatus === "confirmed") {
      const pago = pagos.find((p) => p.id === paymentId);
      if (pago) {
        const delta = pago.credit_packages?.creditos || 0;

        const { data: perfilUsuario } = await supabase
          .from("profiles")
          .select("creditos")
          .eq("id", pago.user_id)
          .single();

        const current = perfilUsuario?.creditos ?? 0;
        const nextBalance = current + delta;

        await supabase
          .from("profiles")
          .update({ creditos: nextBalance })
          .eq("id", pago.user_id);

        await supabase.from("credit_ledger").insert({
          user_id: pago.user_id,
          payment_id: pago.id,
          delta,
          reason: "payment_confirmed",
          balance_after: nextBalance,
        });
      }
    }

    setPagos((prev) =>
      prev.map((p) => (p.id === paymentId ? { ...p, status: newStatus } : p))
    );
  }

  async function eliminarPago(paymentId) {
    const confirmado = window.confirm(
      "¿Seguro que quieres eliminar este pago reportado? Esta acción no se puede deshacer."
    );

    if (!confirmado) return;

    setEliminandoId(paymentId);

    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    setEliminandoId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setPagos((prev) => prev.filter((p) => p.id !== paymentId));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center text-gray-500 shadow-sm mt-12">
        Inicia sesión para continuar.
      </div>
    );
  }

  if (!esAdmin) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-red-200 text-center text-red-500 shadow-sm bg-red-50/50 font-medium mt-12">
        No tienes acceso a esta página.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Pagos reportados</h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">
          Revisa, aprueba o rechaza los reportes de pago de los usuarios.
        </p>
      </div>

      <div className="grid gap-6">
        {pagos.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-200 text-gray-500 flex flex-col items-center">
            <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <p className="font-medium">No hay pagos reportados todavía.</p>
          </div>
        )}

        {pagos.map((pago) => (
          <div
            key={pago.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col transition-all hover:shadow-md"
          >
            <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-600 shadow-sm">
                  {(pago.profiles?.nombre || "J").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">
                    {pago.profiles?.nombre || "Jugador"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">
                    Paquete: <span className="text-gray-700">{pago.credit_packages?.nombre || "Paquete"}</span> • {pago.credit_packages?.creditos || 0} créditos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border uppercase tracking-wider ${getBadgeStyle(pago.status)}`}>
                  {getStatusLabel(pago.status)}
                </span>

                <button
                  onClick={() => eliminarPago(pago.id)}
                  disabled={eliminandoId === pago.id}
                  title="Eliminar pago reportado"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {eliminandoId === pago.id ? (
                    <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                <DataBlock label="Método" value={getMetodoLabel(pago.method)} />
                <DataBlock label="Monto USD" value={formatCurrency(pago.amount_usd, "USD")} />
                <DataBlock label="Monto Bs" value={pago.amount_bs} />
                <DataBlock label="Referencia" value={pago.reference} />
                
                <div className="col-span-2 md:col-span-4 h-px bg-gray-100 my-1"></div>
                
                <DataBlock label="Banco emisor" value={pago.payer_bank} />
                <DataBlock label="Titular emisor" value={pago.payer_name} />
                <DataBlock label="Documento" value={pago.payer_document} />
                <DataBlock label="Teléfono" value={pago.payer_phone} />
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                {pago.proof_url ? (
                  <a
                    href={pago.proof_url}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                    Ver comprobante
                  </a>
                ) : (
                  <span className="text-xs text-gray-400 italic">Sin comprobante adjunto</span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {pago.status !== "confirmed" && (
                  <button
                    onClick={() => actualizarEstado(pago.id, "confirmed")}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold shadow-sm transition-colors"
                  >
                    Aprobar
                  </button>
                )}
                {pago.status !== "rejected" && (
                  <button
                    onClick={() => actualizarEstado(pago.id, "rejected")}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-600 text-sm font-bold transition-colors shadow-sm"
                  >
                    Rechazar
                  </button>
                )}
                {pago.status !== "under_review" && (
                  <button
                    onClick={() => actualizarEstado(pago.id, "under_review")}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-bold transition-colors shadow-sm"
                  >
                    En revisión
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
