"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// COMPONENTE DE CALENDARIO FLOTANTE EN MODO OSCURO (0 DEPENDENCIAS EXTERNAS)
function CustomDarkDatePicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const dateObj = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [value]);

  const [viewDate, setViewDate] = useState(dateObj);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const diasSemana = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const seleccionarDia = (dia) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(dia).padStart(2, "0");
    onChange(`${year}-${mm}-${dd}`);
    setOpen(false);
  };

  const mesAnterior = () => setViewDate(new Date(year, month - 1, 1));
  const mesSiguiente = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-slate-900 text-[#00FF9D] border border-slate-800 hover:border-[#00FF9D] rounded-xl p-2.5 text-xs font-black outline-none flex items-center justify-between shadow-xs transition-colors cursor-pointer"
      >
        <span>📅 {value ? `${value.split("-")[2]} / ${value.split("-")[1]} / ${value.split("-")[0]}` : "Seleccionar fecha"}</span>
        <span className="text-[10px] text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-64 bg-[#0B0C15] border border-slate-800 rounded-2xl p-3 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800">
            <button type="button" onClick={mesAnterior} className="text-slate-400 hover:text-[#00FF9D] font-black text-sm px-2">❮</button>
            <span className="text-xs font-black uppercase text-[#00FF9D]">{meses[month]} {year}</span>
            <button type="button" onClick={mesSiguiente} className="text-slate-400 hover:text-[#00FF9D] font-black text-sm px-2">❯</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {diasSemana.map((d, i) => (
              <span key={i} className="text-[9px] font-black text-slate-500 uppercase">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`offset-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dia = i + 1;
              const mm = String(month + 1).padStart(2, "0");
              const dd = String(dia).padStart(2, "0");
              const fechaStr = `${year}-${mm}-${dd}`;
              const esSeleccionado = value === fechaStr;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => seleccionarDia(dia)}
                  className={`p-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    esSeleccionado
                      ? "bg-[#00FF9D] text-slate-950 font-black shadow-xs"
                      : "hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  {dia}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatearHora12(horaStr) {
  if (!horaStr) return "";
  const [h, m] = horaStr.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 || 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${periodo}`;
}

function esBloqueHoraPico(startTimeStr, endTimeStr, peakStartStr = "17:00", peakEndStr = "22:00") {
  if (!startTimeStr || !endTimeStr) return false;

  const toMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
  };

  const start = toMinutes(startTimeStr);
  const end = toMinutes(endTimeStr);
  const pStart = toMinutes(peakStartStr);
  const pEnd = toMinutes(peakEndStr);

  if (pStart <= pEnd) {
    return Math.max(start, pStart) < Math.min(end, pEnd);
  } else {
    return Math.max(start, pStart) < (end + 1440) || (start + 1440) < Math.min(end, pEnd);
  }
}

export default function PromocionesPage() {
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [clubId, setClubId] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  const [canchas, setCanchas] = useState([]);
  const [promociones, setPromociones] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todas");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    modoTarifa: "bloques",
    price_normal: "",
    price_peak: "",
    time_blocks: [],
    court_ids: [],
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", user.id)
        .single();

      if (!profile?.club_id) return;
      setClubId(profile.club_id);

      const { data: clubData } = await supabase
        .from("padel_clubs")
        .select("*")
        .eq("id", profile.club_id)
        .maybeSingle();

      setClubInfo(clubData || { peak_start_time: "17:00:00", peak_end_time: "22:00:00" });

      const { data: courts } = await supabase
        .from("padel_courts")
        .select("id, name")
        .eq("club_id", profile.club_id)
        .eq("is_active", true)
        .order("court_number");
      setCanchas(courts || []);

      const { data: promos } = await supabase
        .from("padel_promotions")
        .select("*")
        .eq("club_id", profile.club_id)
        .order("start_date", { ascending: true });

      setPromociones(promos || []);
    } catch (error) {
      console.error("Error cargando promociones:", error);
    } finally {
      setLoading(false);
    }
  }

  const peakStart = clubInfo?.peak_start_time || "17:00:00";
  const peakEnd = clubInfo?.peak_end_time || "22:00:00";

  const abrirModal = (promo = null) => {
    if (promo) {
      setEditandoId(promo.id);
      const tieneBloques = Array.isArray(promo.time_blocks) && promo.time_blocks.length > 0;
      setForm({
        name: promo.name || "",
        start_date: promo.start_date || "",
        end_date: promo.end_date || "",
        modoTarifa: tieneBloques ? "bloques" : "global",
        price_normal: promo.price_normal ? String(promo.price_normal) : "",
        price_peak: promo.price_peak ? String(promo.price_peak) : "",
        time_blocks: tieneBloques ? [...promo.time_blocks] : [],
        court_ids: Array.isArray(promo.court_ids) ? [...promo.court_ids] : [],
      });
    } else {
      setEditandoId(null);
      const hoy = new Date().toISOString().split("T")[0];
      setForm({
        name: "",
        start_date: hoy,
        end_date: hoy,
        modoTarifa: "bloques",
        price_normal: "",
        price_peak: "",
        time_blocks: [{ start_time: "07:00", end_time: "12:00", price: "" }],
        court_ids: [],
      });
    }
    setModalAbierto(true);
  };

  const agregarBloque = (start = "07:00", end = "12:00", price = "") => {
    setForm((prev) => ({
      ...prev,
      time_blocks: [...prev.time_blocks, { start_time: start, end_time: end, price }],
    }));
  };

  const actualizarBloque = (index, field, value) => {
    setForm((prev) => {
      const copy = [...prev.time_blocks];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, time_blocks: copy };
    });
  };

  const eliminarBloque = (index) => {
    setForm((prev) => ({
      ...prev,
      time_blocks: prev.time_blocks.filter((_, i) => i !== index),
    }));
  };

  const togglePistaSeleccionada = (canchaId) => {
    setForm((prev) => {
      const yaExiste = prev.court_ids.includes(canchaId);
      const nuevosIds = yaExiste
        ? prev.court_ids.filter((id) => id !== canchaId)
        : [...prev.court_ids, canchaId];

      return { ...prev, court_ids: nuevosIds };
    });
  };

  async function guardarPromocion(e) {
    e.preventDefault();
    if (!clubId) return;

    if (!form.name.trim()) return alert("Ingresa el nombre de la promoción.");
    if (!form.start_date || !form.end_date) return alert("Selecciona el rango de fechas.");
    if (new Date(form.start_date) > new Date(form.end_date)) {
      return alert("La fecha de inicio no puede ser posterior a la fecha fin.");
    }

    if (form.modoTarifa === "bloques") {
      if (form.time_blocks.length === 0) {
        return alert("Agrega al menos una franja horaria o cambia al modo Día Completo.");
      }
      for (const b of form.time_blocks) {
        if (!b.start_time || !b.end_time || b.price === "" || isNaN(parseFloat(b.price))) {
          return alert("Completa la hora de inicio, fin y precio válido para todos los bloques.");
        }
        if (b.start_time >= b.end_time) {
          return alert(`El bloque (${b.start_time} - ${b.end_time}) debe tener una hora fin mayor a la hora inicio.`);
        }
      }
    } else {
      if (!form.price_normal || isNaN(parseFloat(form.price_normal))) {
        return alert("Ingresa un precio promo válido para tarifa normal.");
      }
    }

    try {
      setGuardando(true);

      const promoData = {
        club_id: clubId,
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        price_normal: form.modoTarifa === "global" ? parseFloat(form.price_normal) || 0 : 0,
        price_peak: form.modoTarifa === "global" ? parseFloat(form.price_peak) || 0 : 0,
        time_blocks: form.modoTarifa === "bloques"
          ? form.time_blocks.map((b) => ({
              start_time: b.start_time,
              end_time: b.end_time,
              price: parseFloat(b.price) || 0,
            }))
          : [],
        court_ids: form.court_ids || [],
      };

      if (editandoId) {
        const { error } = await supabase.from("padel_promotions").update(promoData).eq("id", editandoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("padel_promotions").insert([promoData]);
        if (error) throw error;
      }

      setModalAbierto(false);
      cargarDatos();
    } catch (error) {
      alert("Error guardando la oferta: " + error.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarPromo(id) {
    if (!window.confirm("¿Deseas eliminar esta oferta? Las pistas volverán a sus precios estándar.")) return;
    try {
      await supabase.from("padel_promotions").delete().eq("id", id);
      cargarDatos();
    } catch (error) {
      alert("Error eliminando promoción");
    }
  }

  const duplicarPromo = (p) => {
    setEditandoId(null);
    const tieneBloques = Array.isArray(p.time_blocks) && p.time_blocks.length > 0;
    setForm({
      name: `${p.name} (Copia)`,
      start_date: p.start_date,
      end_date: p.end_date,
      modoTarifa: tieneBloques ? "bloques" : "global",
      price_normal: p.price_normal ? String(p.price_normal) : "",
      price_peak: p.price_peak ? String(p.price_peak) : "",
      time_blocks: tieneBloques ? [...p.time_blocks] : [],
      court_ids: Array.isArray(p.court_ids) ? [...p.court_ids] : [],
    });
    setModalAbierto(true);
  };

  const hoyStr = new Date().toISOString().split("T")[0];

  const promocionesFiltradas = useMemo(() => {
    return promociones.filter((p) => {
      const estaActiva = hoyStr >= p.start_date && hoyStr <= p.end_date;
      const esFutura = hoyStr < p.start_date;
      const esPasada = hoyStr > p.end_date;

      if (filtroEstado === "activas") return estaActiva;
      if (filtroEstado === "programadas") return esFutura;
      if (filtroEstado === "finalizadas") return esPasada;
      return true;
    });
  }, [promociones, filtroEstado, hoyStr]);

  const conteoEstadisticas = useMemo(() => {
    let activas = 0;
    let programadas = 0;
    promociones.forEach((p) => {
      if (hoyStr >= p.start_date && hoyStr <= p.end_date) activas++;
      else if (hoyStr < p.start_date) programadas++;
    });
    return { activas, programadas, total: promociones.length };
  }, [promociones, hoyStr]);

  const obtenerTextoPistas = (courtIds) => {
    if (!courtIds || courtIds.length === 0) return "🎾 Aplica a todas las pistas";
    const nombres = canchas
      .filter((c) => courtIds.includes(c.id))
      .map((c) => c.name);
    return nombres.length > 0 ? `🎯 Pistas: ${nombres.join(", ")}` : "🎾 Aplica a todas las pistas";
  };

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Cargando Panel de Ofertas...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 space-y-6">
      
      {/* CABECERA Y METRICAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎁</span>
            <h1 className="text-2xl font-black text-slate-900">Promociones y Ofertas</h1>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Configura ofertas por horario o por pista ({canchas.length} activas). Horario Pico del club:{" "}
            <strong className="text-amber-600">{formatearHora12(peakStart)} a {formatearHora12(peakEnd)}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setFiltroEstado("todas")}
              className={`px-3 py-1.5 rounded-xl transition-all ${filtroEstado === "todas" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600"}`}
            >
              Todas ({conteoEstadisticas.total})
            </button>
            <button
              onClick={() => setFiltroEstado("activas")}
              className={`px-3 py-1.5 rounded-xl transition-all ${filtroEstado === "activas" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600"}`}
            >
              Activas ({conteoEstadisticas.activas})
            </button>
            <button
              onClick={() => setFiltroEstado("programadas")}
              className={`px-3 py-1.5 rounded-xl transition-all ${filtroEstado === "programadas" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600"}`}
            >
              Próximas ({conteoEstadisticas.programadas})
            </button>
          </div>

          <button
            onClick={() => abrirModal()}
            className="bg-slate-900 text-[#00FF9D] text-xs font-black uppercase px-5 py-3 rounded-2xl shadow-md hover:bg-slate-800 transition-all active:scale-98 cursor-pointer ml-auto md:ml-0"
          >
            + Crear Nueva Oferta
          </button>
        </div>
      </div>

      {/* LISTADO DE TARJETAS */}
      {promocionesFiltradas.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center shadow-xs space-y-3">
          <span className="text-5xl">🏷️</span>
          <h3 className="text-lg font-black text-slate-900">No hay ofertas en esta categoría</h3>
          <p className="text-xs font-bold text-slate-400 max-w-md">
            Las pistas operan actualmente con las tarifas regulares. Crea una promoción para configurar ofertas por rangos de fecha, horas o pistas específicas.
          </p>
          <button
            onClick={() => abrirModal()}
            className="mt-2 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase px-5 py-2.5 rounded-xl shadow-sm"
          >
            + Agregar Promoción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {promocionesFiltradas.map((p) => {
            const estaActiva = hoyStr >= p.start_date && hoyStr <= p.end_date;
            const esFutura = hoyStr < p.start_date;
            const tieneBloques = Array.isArray(p.time_blocks) && p.time_blocks.length > 0;

            return (
              <div
                key={p.id}
                className={`bg-white rounded-3xl border transition-all relative flex flex-col justify-between overflow-hidden shadow-xs ${
                  estaActiva
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                    : esFutura
                    ? "border-blue-300"
                    : "border-slate-200 opacity-60"
                }`}
              >
                <div>
                  <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <div className="min-w-0 pr-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block truncate">
                        {obtenerTextoPistas(p.court_ids)}
                      </span>
                      <h3 className="text-base font-black truncate text-white leading-tight mt-0.5">{p.name}</h3>
                    </div>

                    {estaActiva ? (
                      <span className="bg-[#00FF9D] text-slate-950 text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 shadow-sm">
                        🔥 ACTIVA HOY
                      </span>
                    ) : esFutura ? (
                      <span className="bg-blue-500 text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0">
                        ⏳ PROGRAMADA
                      </span>
                    ) : (
                      <span className="bg-slate-700 text-slate-300 text-[9px] font-black uppercase px-2.5 py-1 rounded-full shrink-0">
                        FINALIZADA
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 grid grid-cols-2 gap-2 text-xs font-bold text-center">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Desde</span>
                        <span className="text-slate-900 font-black">{p.start_date}</span>
                      </div>
                      <div className="border-l border-slate-200 pl-2">
                        <span className="text-[9px] font-black uppercase text-slate-400 block">Hasta</span>
                        <span className="text-slate-900 font-black">{p.end_date}</span>
                      </div>
                    </div>

                    {tieneBloques ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 border-b border-slate-100 pb-1">
                          <span>⏰ Franja Horaria</span>
                          <span>Precio Oferta</span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                          {p.time_blocks.map((b, idx) => {
                            const esPico = esBloqueHoraPico(b.start_time, b.end_time, peakStart, peakEnd);

                            return (
                              <div
                                key={idx}
                                className={`flex justify-between items-center text-xs font-bold p-2.5 rounded-xl border transition-colors ${
                                  esPico
                                    ? "bg-amber-50/90 border-amber-300 text-amber-950"
                                    : "bg-slate-50 border-slate-200 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate pr-1">
                                  <span>{esPico ? "⚡" : "🕒"}</span>
                                  <span className="truncate">
                                    {formatearHora12(b.start_time)} - {formatearHora12(b.end_time)}
                                  </span>
                                  {esPico && (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 border border-amber-300 shrink-0">
                                      Hora Pico
                                    </span>
                                  )}
                                </div>

                                <span
                                  className={`font-black px-2.5 py-0.5 rounded-lg border text-xs shrink-0 ${
                                    esPico
                                      ? "bg-amber-400/30 text-amber-950 border-amber-400"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  ${parseFloat(b.price).toFixed(2)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 text-center italic pt-1">
                          Fuera de estos horarios aplica la tarifa normal del club.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl">
                          <span className="text-[9px] font-black text-emerald-800 uppercase block">Precio Promo</span>
                          <span className="text-lg font-black text-emerald-600">${parseFloat(p.price_normal || 0).toFixed(2)}</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl">
                          <span className="text-[9px] font-black text-amber-800 uppercase block">⚡ Hora Pico Promo</span>
                          <span className="text-lg font-black text-amber-600">${parseFloat(p.price_peak || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => duplicarPromo(p)}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-xl transition-colors"
                  >
                    📋 Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => abrirModal(p)}
                    className="px-3 py-1.5 bg-slate-900 text-[#00FF9D] text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarPromo(p.id)}
                    className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-black uppercase rounded-xl hover:bg-rose-100 transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CONFIGURADOR */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-xl shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {editandoId ? "Editar Configuración" : "Nueva Promoción POS"}
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {editandoId ? form.name || "Modificar Promoción" : "Crear Promoción de Precios"}
                </h2>
              </div>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 font-bold text-xl hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={guardarPromocion} className="space-y-4 text-xs font-bold text-slate-700">
              
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nombre de la Promoción *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Promoción Fin de Semana / Happy Hour"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-3 text-sm font-black outline-none focus:border-slate-900"
                />
              </div>

              {/* SELECCIÓN DE PISTAS APLICABLES */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-slate-400">
                  Pistas Aplicables
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, court_ids: [] })}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all ${
                      form.court_ids.length === 0
                        ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    🎾 Todas las Pistas
                  </button>

                  {canchas.map((cancha) => {
                    const estaSeleccionada = form.court_ids.includes(cancha.id);
                    return (
                      <button
                        key={cancha.id}
                        type="button"
                        onClick={() => togglePistaSeleccionada(cancha.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all ${
                          estaSeleccionada
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {estaSeleccionada ? "✓ " : ""}{cancha.name}
                      </button>
                    );
                  })}
                </div>
                {form.court_ids.length > 0 && (
                  <p className="text-[9px] font-bold text-emerald-700 pt-0.5">
                    🎯 Aplicará únicamente a las {form.court_ids.length} pista(s) seleccionada(s).
                  </p>
                )}
              </div>

              {/* RANGO DE FECHAS CON NUEVO SELECTOR FLOTANTE EN MODO OSCURO */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <CustomDarkDatePicker
                  label="Fecha de Inicio *"
                  value={form.start_date}
                  onChange={(val) => setForm({ ...form, start_date: val })}
                />

                <CustomDarkDatePicker
                  label="Fecha Fin *"
                  value={form.end_date}
                  onChange={(val) => setForm({ ...form, end_date: val })}
                />
              </div>

              {/* MODO TARIFARIO */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase text-slate-400">Modalidad de Aplicación de Precios</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, modoTarifa: "bloques" })}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      form.modoTarifa === "bloques"
                        ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    <span className="text-xs font-black uppercase">🕒 Franjas Horarias</span>
                    <span className="text-[10px] opacity-80 mt-1 font-bold">Precios por tramos del día (Ej. 17:00 a 22:00 = $15).</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, modoTarifa: "global" })}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      form.modoTarifa === "global"
                        ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    <span className="text-xs font-black uppercase">☀️ Día Completo</span>
                    <span className="text-[10px] opacity-80 mt-1 font-bold">Tarifa plana de Horario Normal / Pico todo el día.</span>
                  </button>
                </div>
              </div>

              {/* CONTENIDO SEGÚN MODO */}
              {form.modoTarifa === "global" ? (
                <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl space-y-3">
                  <p className="text-[10px] font-bold text-amber-900 leading-snug">
                    💡 <strong>Tarifa Día Completo:</strong> Sustituirá la tarifa normal y hora pico por defecto de la cancha en las fechas seleccionadas.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-emerald-800 mb-1">Precio Promo Normal ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="12.00"
                        value={form.price_normal}
                        onChange={(e) => setForm({ ...form, price_normal: e.target.value })}
                        className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 text-sm font-black text-emerald-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-amber-800 mb-1">⚡ Precio Promo Pico ($ USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="18.00"
                        value={form.price_peak}
                        onChange={(e) => setForm({ ...form, price_peak: e.target.value })}
                        className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-sm font-black text-amber-700 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">
                        Franjas Configuradas ({form.time_blocks.length})
                      </span>
                      <span className="text-[9px] font-bold text-amber-600 block">
                        ⚡ Horas Pico configuradas: {formatearHora12(peakStart)} - {formatearHora12(peakEnd)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => agregarBloque("07:00", "12:00", "")}
                      className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-200 transition-colors"
                    >
                      + Nueva Franja
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase w-full">Plantillas Rápidas:</span>
                    <button
                      type="button"
                      onClick={() => agregarBloque("07:00", "12:00", "10")}
                      className="text-[9px] font-bold bg-white border border-slate-300 px-2 py-1 rounded-md hover:bg-slate-100"
                    >
                      🌅 Mañana (07:00 - 12:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => agregarBloque("12:00", "17:00", "12")}
                      className="text-[9px] font-bold bg-white border border-slate-300 px-2 py-1 rounded-md hover:bg-slate-100"
                    >
                      ☀️ Tarde (12:00 - 17:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => agregarBloque("17:00", "23:00", "15")}
                      className="text-[9px] font-bold bg-amber-100 border border-amber-300 text-amber-900 px-2 py-1 rounded-md hover:bg-amber-200"
                    >
                      ⚡ Noche / Pico ({peakStart.slice(0, 5)} - {peakEnd.slice(0, 5)})
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {form.time_blocks.map((bloque, index) => {
                      const esPico = esBloqueHoraPico(bloque.start_time, bloque.end_time, peakStart, peakEnd);

                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-2xl border transition-all ${
                            esPico
                              ? "bg-amber-50/90 border-amber-300"
                              : "bg-white border-slate-300"
                          }`}
                        >
                          {esPico && (
                            <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-800 mb-1.5">
                              <span>⚡ COINCIDE CON HORARIO PICO DEL CLUB ({formatearHora12(peakStart)} - {formatearHora12(peakEnd)})</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Desde</label>
                              <input
                                type="time"
                                required
                                value={bloque.start_time}
                                onChange={(e) => actualizarBloque(index, "start_time", e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                              />
                            </div>

                            <div className="flex-1">
                              <label className="text-[8px] font-black uppercase text-slate-400 block mb-0.5">Hasta</label>
                              <input
                                type="time"
                                required
                                value={bloque.end_time}
                                onChange={(e) => actualizarBloque(index, "end_time", e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                              />
                            </div>

                            <div className="flex-1">
                              <label className={`text-[8px] font-black uppercase block mb-0.5 ${esPico ? "text-amber-800" : "text-emerald-600"}`}>
                                Precio ($)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                placeholder="0.00"
                                value={bloque.price}
                                onChange={(e) => actualizarBloque(index, "price", e.target.value)}
                                className={`w-full rounded-lg p-1.5 text-xs font-black outline-none ${
                                  esPico
                                    ? "bg-amber-100/80 border border-amber-400 text-amber-950"
                                    : "bg-emerald-50 border border-emerald-300 text-emerald-800"
                                }`}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => eliminarBloque(index)}
                              className="text-rose-500 hover:text-rose-700 text-sm font-black p-1.5 rounded-lg hover:bg-rose-50 shrink-0 self-end"
                              title="Eliminar franja"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="w-1/3 py-3 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-2xl hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="w-2/3 py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-2xl shadow-md hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : editandoId ? "💾 Guardar Cambios" : "✨ Guardar Oferta"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}