"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

function parsearFechaBD(fechaStr) {
  if (!fechaStr) return new Date();
  const str = fechaStr.replace(" ", "T");
  return new Date(str.endsWith("Z") || str.includes("+") ? str : `${str}Z`);
}

function formatearHora12(hora24Str) {
  if (!hora24Str) return "";
  const [h, m] = hora24Str.split(":").map(Number);
  const periodo = h >= 12 ? "PM" : "AM";
  const hora12 = h % 12 || 12;
  return `${hora12}:${String(m).padStart(2, "0")} ${periodo}`;
}

// CALENDARIO FLOTANTE EN MODO OSCURO
function CustomDarkDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const dateObj = useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = [value.getFullYear(), value.getMonth(), value.getDate()];
    return new Date(y, m, d);
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
    const nueva = new Date(year, month, dia);
    onChange(nueva);
    setOpen(false);
  };

  const mesAnterior = () => setViewDate(new Date(year, month - 1, 1));
  const mesSiguiente = () => setViewDate(new Date(year, month + 1, 1));

  const fechaFormat = `${String(value.getDate()).padStart(2, "0")} / ${String(value.getMonth() + 1).padStart(2, "0")} / ${value.getFullYear()}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-3.5 py-2 bg-slate-900 text-[#00FF9D] border border-slate-800 hover:border-[#00FF9D] rounded-xl text-xs sm:text-sm font-black outline-none flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
      >
        <span>📅 {fechaFormat}</span>
        <span className="text-[10px] text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 bg-[#0B0C15] border border-slate-800 rounded-2xl p-3 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
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
              const esMismoDia = value.getDate() === dia && value.getMonth() === month && value.getFullYear() === year;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => seleccionarDia(dia)}
                  className={`p-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    esMismoDia
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

export default function RecepcionElite() {
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [clubId, setClubId] = useState(null);
  const [clubInfo, setClubInfo] = useState(null);
  
  // Tasa BCV
  const [tasaBCV, setTasaBCV] = useState(36.65);

  // Vistas Calendario
  const [vistaCalendario, setVistaCalendario] = useState("dia");
  const [canchaFiltro, setCanchaFiltro] = useState("todas");
  const [alertaNuevaReserva, setAlertaNuevaReserva] = useState(null);
  const [fechaBase, setFechaBase] = useState(new Date());

  // Datos
  const [canchas, setCanchas] = useState([]);
  const [partidosPeriodo, setPartidosPeriodo] = useState([]);
  const [productos, setProductos] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [promocionesPeriodo, setPromocionesPeriodo] = useState([]); 
  const [bloqueosActivos, setBloqueosActivos] = useState([]);

  // Notificaciones
  const [popupNotif, setPopupNotif] = useState({ open: false, title: "", message: "", type: "info" });
  const [modalConfirm, setModalConfirm] = useState({ open: false, title: "", message: "", action: null });

  // Modal Agendar POS Cancha
  const [modalAgendarOpen, setModalAgendarOpen] = useState(false);
  const [bloqueAgendar, setBloqueAgendar] = useState(null);
  const [monedaAgendarPOS, setMonedaAgendarPOS] = useState("USD");
  const [formAgendarPOS, setFormAgendarPOS] = useState({
    nombreCliente: "",
    telefonoCliente: "",
    metodoPago: "pago_movil",
    montoCustomUSD: "",
    numReferencia: "",
    previewComprobante: "",
  });

  // Modal Reserva Existente
  const [modalDetalleMatch, setModalDetalleMatch] = useState(false);
  const [matchSeleccionado, setMatchSeleccionado] = useState(null);
  const [extrasBackup, setExtrasBackup] = useState([]);
  const [modalConfirmCambios, setModalConfirmCambios] = useState(false);
  const [imagenEngrande, setImagenEngrande] = useState(null);

  // Modal Venta Directa Tienda
  const [modalTiendaOpen, setModalTiendaOpen] = useState(false);
  const [busquedaTienda, setBusquedaTienda] = useState("");
  const [carritoTienda, setCarritoTienda] = useState([]);
  const [formVentaTienda, setFormVentaTienda] = useState({
    nombreCliente: "",
    telefonoCliente: "",
    metodoPago: "pago_movil",
    numReferencia: "",
    previewComprobante: "",
  });

  const [historialAbierto, setHistorialAbierto] = useState(true);
  const [cobroAbierto, setCobroAbierto] = useState(true);
  const [monedaCobroPOS, setMonedaCobroPOS] = useState("USD");
  const [montoAbonoManualPOS, setMontoAbonoManualPOS] = useState("");
  const [metodoAbonoManualPOS, setMetodoAbonoManualPOS] = useState("pago_movil");
  const [numRefAbonoManualPOS, setNumRefAbonoManualPOS] = useState("");
  const [previewAbonoManualPOS, setPreviewAbonoManualPOS] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    setMounted(true);
    cargarDatosGenerales();
    obtenerTasaBCV();
  }, []);

  const diasVisibles = useMemo(() => {
    const list = [];
    const base = new Date(fechaBase);
    base.setHours(0, 0, 0, 0);

    let cantidadDias = 1;
    if (vistaCalendario === "4dias") cantidadDias = 4;
    if (vistaCalendario === "semana") cantidadDias = 7;

    for (let i = 0; i < cantidadDias; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, [fechaBase, vistaCalendario]);

  useEffect(() => {
    if (clubId) {
      cargarPartidosPeriodo();
      cargarPromocionesPeriodo(clubId);
    }
  }, [clubId, diasVisibles]);

  useEffect(() => {
    if (!clubId || !supabase) return;

    cargarBloqueos();

    const channel = supabase
      .channel("pos-realtime-matches-full-v44")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `club_id=eq.${clubId}` },
        (payload) => {
          cargarPartidosPeriodo();
          
          if (payload.eventType === 'INSERT') {
            const nuevaReserva = payload.new;
            const canchaReserva = canchas.find((c) => c.id === nuevaReserva.court_id);
            
            if (canchaReserva) {
              const esFutbol = canchaReserva.sport_type === 'futbol';
              const deporteAviso = esFutbol ? 'Fútbol ⚽' : 'Pádel 🎾';

              if (canchaFiltro !== "todas" && canchaFiltro !== canchaReserva.id) {
                setAlertaNuevaReserva({
                  canchaNombre: canchaReserva.name,
                  deporte: deporteAviso
                });
              }
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `club_id=eq.${clubId}` },
        () => cargarDatosGenerales()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "padel_locks" },
        () => cargarBloqueos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, diasVisibles, canchas, canchaFiltro]);

  const mostrarNotificacion = (title, message, type = "info") => {
    setPopupNotif({ open: true, title, message, type });
  };

  const pedirConfirmacion = (title, message, action) => {
    setModalConfirm({ open: true, title, message, action });
  };

  async function obtenerTasaBCV() {
    try {
      const res = await fetch("/api/bcv-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.usdRate) return setTasaBCV(parseFloat(data.usdRate));
      }
      const resFallback = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
      if (resFallback.ok) {
        const dataFallback = await resFallback.json();
        if (dataFallback?.promedio) return setTasaBCV(parseFloat(dataFallback.promedio));
      }
    } catch (e) {
      console.error("Fallo al consultar BCV:", e);
    }
  }

  async function cargarBloqueos() {
    try {
      const ahoraISO = new Date().toISOString();
      const { data } = await supabase
        .from("padel_locks")
        .select("*")
        .gt("expires_at", ahoraISO); 
      setBloqueosActivos(data || []);
    } catch (error) {
      console.error("Error cargando bloqueos en POS:", error);
    }
  }

  async function cargarPromocionesPeriodo(clubIdActual) {
    if (!clubIdActual || diasVisibles.length === 0) return;
    
    const inicioStr = `${diasVisibles[0].getFullYear()}-${String(diasVisibles[0].getMonth() + 1).padStart(2, '0')}-${String(diasVisibles[0].getDate()).padStart(2, '0')}`;
    const finStr = `${diasVisibles[diasVisibles.length - 1].getFullYear()}-${String(diasVisibles[diasVisibles.length - 1].getDate()).padStart(2, '0')}-${String(diasVisibles[diasVisibles.length - 1].getDate()).padStart(2, '0')}`;

    try {
      const { data } = await supabase
        .from("padel_promotions")
        .select("*")
        .eq("club_id", clubIdActual)
        .lte("start_date", finStr)
        .gte("end_date", inicioStr);
        
      setPromocionesPeriodo(data || []);
    } catch (error) {
      console.error("Error buscando promociones del periodo:", error);
    }
  } 

  const promocionHoy = useMemo(() => {
    const hoyStr = `${fechaBase.getFullYear()}-${String(fechaBase.getMonth() + 1).padStart(2, '0')}-${String(fechaBase.getDate()).padStart(2, '0')}`;
    return promocionesPeriodo.find(p => p.start_date <= hoyStr && p.end_date >= hoyStr) || null;
  }, [promocionesPeriodo, fechaBase]);

  async function cargarDatosGenerales() {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id")
        .eq("id", authUser.id)
        .single();

      let targetClubId = profile?.club_id;
      if (!targetClubId) {
        const { data: clubCreado } = await supabase
          .from("clubs")
          .select("id")
          .eq("created_by", authUser.id)
          .maybeSingle();

        targetClubId = clubCreado?.id || null;
      }

      if (!targetClubId) return setLoading(false);
      setClubId(targetClubId);

      const { data: clubData } = await supabase.from("clubs").select("*").eq("id", targetClubId).maybeSingle();
      setClubInfo(clubData || { slot_duration_minutes: 60, open_time: "07:00:00", close_time: "23:00:00" });

      const { data: courts } = await supabase.from("courts").select("*").eq("club_id", targetClubId).eq("is_active", true).order("court_number");
      setCanchas(courts || []);

      const { data: inventory } = await supabase.from("products").select("*").eq("club_id", targetClubId).order("name");
      setProductos(inventory || []);
    } catch (err) {
      console.error("Error al cargar datos del POS:", err);
    } finally {
      setLoading(false);
    }
  }

  async function cargarPartidosPeriodo() {
    if (!clubId || diasVisibles.length === 0) return;

    const dIni = diasVisibles[0];
    const inicioFijo = `${dIni.getFullYear()}-${String(dIni.getMonth() + 1).padStart(2, '0')}-${String(dIni.getDate()).padStart(2, '0')}T00:00:00`;

    const dFin = diasVisibles[diasVisibles.length - 1];
    const finFijo = `${dFin.getFullYear()}-${String(dFin.getMonth() + 1).padStart(2, '0')}-${String(dFin.getDate()).padStart(2, '0')}T23:59:59`;

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("*, court:courts(name)")
      .eq("club_id", clubId)
      .gte("scheduled_at", inicioFijo)
      .lte("scheduled_at", finFijo)
      .neq("status", "cancelado");

    if (matchErr) {
      console.error("Error cargando reservas:", matchErr);
      return;
    }

    const matchIds = (matches || []).map((m) => m.id);

    if (matchIds.length > 0) {
      const { data: players } = await supabase
        .from("match_players")
        .select("id, match_id, user_id, team")
        .in("match_id", matchIds);

      const allUserIds = Array.from(new Set((players || []).map((p) => p.user_id).filter(Boolean)));
      let userProfilesMap = {};

      if (allUserIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre, apellido, telefono, email").in("id", allUserIds);
        (profs || []).forEach((p) => { userProfilesMap[p.id] = p; });
      }

      const playersMap = {};
      (players || []).forEach((p) => {
        if (!playersMap[p.match_id]) playersMap[p.match_id] = [];
        playersMap[p.match_id].push({
          ...p,
          profile: userProfilesMap[p.user_id] || null
        });
      });

      const finalMatches = (matches || []).map((m) => ({
        ...m,
        creator_profile: userProfilesMap[m.created_by] || null,
        players: playersMap[m.id] || [],
      }));

      setPartidosPeriodo(finalMatches);

      if (matchSeleccionado) {
        const actualizado = finalMatches.find(m => m.id === matchSeleccionado.id);
        if (actualizado) setMatchSeleccionado(actualizado);
      }
    } else {
      setPartidosPeriodo(matches || []);
    }
  }

  const irNavegacionFecha = (offset) => {
    const nueva = new Date(fechaBase);
    let salto = 1;
    if (vistaCalendario === "4dias") salto = 4;
    if (vistaCalendario === "semana") salto = 7;

    nueva.setDate(nueva.getDate() + offset * salto);
    setFechaBase(nueva);
  };

  const irAHoy = () => setFechaBase(new Date());

  const canchasFiltradas = useMemo(() => {
    if (canchaFiltro === "todas") return canchas;
    return canchas.filter((c) => c.id === canchaFiltro);
  }, [canchas, canchaFiltro]);

  const bloquesPorDia = useMemo(() => {
    return diasVisibles.map((diaObj, diaIdx) => {
      const nombreDiaLargo = diaObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
      const nombreDiaLargoMayus = nombreDiaLargo.charAt(0).toUpperCase() + nombreDiaLargo.slice(1);

      return {
        diaObj,
        diaIdx,
        nombreDiaLargoMayus,
        canchas: canchasFiltradas.map((cancha) => ({
          cancha,
          keyCol: `${cancha.id}_${diaObj.toISOString()}`,
        })),
      };
    });
  }, [diasVisibles, canchasFiltradas]);

  const abrirModalDetalle = (reservado) => {
    setMatchSeleccionado(reservado);
    setExtrasBackup(Array.isArray(reservado.extra_items) ? [...reservado.extra_items] : []);
    setHistorialAbierto(true);
    setCobroAbierto(reservado.payment_status !== "liquidado");
    setModalDetalleMatch(true);
  };

  const solicitarCerrarModalDetalle = () => {
    const actualStr = JSON.stringify(matchSeleccionado?.extra_items || []);
    const backupStr = JSON.stringify(extrasBackup || []);

    if (actualStr !== backupStr) {
      setModalConfirmCambios(true);
    } else {
      setModalDetalleMatch(false);
    }
  };

  const descartarCambiosExtras = async () => {
    if (!matchSeleccionado) return;
    try {
      setProcesando(true);

      const totalAbonado = (Array.isArray(matchSeleccionado.payments_history) ? matchSeleccionado.payments_history : [])
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = matchSeleccionado.total_price || 15;
      const fee = matchSeleccionado.app_fee || precioBase * 0.10;
      const totalExtrasBackup = extrasBackup.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
      const totalGranEsperado = precioBase + fee + totalExtrasBackup;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const estadoPagoFinal = matchSeleccionado.payment_status === "liquidado" 
        ? "liquidado" 
        : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

      await supabase
        .from("matches")
        .update({
          extra_items: extrasBackup,
          payment_status: estadoPagoFinal,
        })
        .eq("id", matchSeleccionado.id);

      await cargarPartidosPeriodo();
    } catch (e) {
      console.error("Error restaurando extras:", e);
    } finally {
      setProcesando(false);
      setModalConfirmCambios(false);
      setModalDetalleMatch(false);
    }
  };

  const guardarCambiosExtras = () => {
    setModalConfirmCambios(false);
    setModalDetalleMatch(false);
    mostrarNotificacion("Cambios Guardados", "✅ Se han conservado las modificaciones en la reserva.", "success");
  };

  const obtenerNombreCliente = (reservado) => {
    if (!reservado) return "Cliente Mostrador";
    if (reservado.notes && reservado.notes.trim()) {
      return reservado.notes.replace(/^Cliente:\s*/i, "");
    }
    if (reservado.creator_profile) {
      return `${reservado.creator_profile.nombre || ""} ${reservado.creator_profile.apellido || ""}`.trim();
    }
    return "Cliente Mostrador";
  };

  const calcularPrecioPorBloque = (cancha, dateObj) => {
    try {
      const hora = dateObj.getUTCHours();
      const minutos = dateObj.getUTCMinutes();
      const horaFormateada = `${String(hora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;

      if (!cancha.pricing_blocks || !Array.isArray(cancha.pricing_blocks) || cancha.pricing_blocks.length === 0) {
        const precioNormal = parseFloat(cancha.price_normal);
        return { precio: isNaN(precioNormal) ? 15 : precioNormal, esPico: false };
      }

      const bloqueEncontrado = cancha.pricing_blocks.find(bloque => {
        return horaFormateada >= (bloque.start_time || "00:00") && horaFormateada < (bloque.end_time || "23:59");
      });

      if (bloqueEncontrado && !isNaN(parseFloat(bloqueEncontrado.price))) {
        return { precio: parseFloat(bloqueEncontrado.price), esPico: false };
      }

      const primerPrecio = parseFloat(cancha.pricing_blocks[0].price);
      return { precio: isNaN(primerPrecio) ? 15 : primerPrecio, esPico: false };
    } catch (error) {
      console.error("Error calculando precio bloque:", error);
      return { precio: 15, esPico: false }; 
    }
  };

  const bloquesHorarios = useMemo(() => {
    const duracion = clubInfo?.slot_duration_minutes || 60;
    const horaApertura = parseInt((clubInfo?.open_time || "07:00:00").split(":")[0], 10);
    const horaCierre = parseInt((clubInfo?.close_time || "23:00:00").split(":")[0], 10);

    const bloques = [];
    let curH = horaApertura;
    let curM = 0;

    while (curH < horaCierre || (curH === horaCierre && curM === 0)) {
      if (curH === horaCierre && curM > 0) break;
      const periodo = curH >= 12 ? "PM" : "AM";
      const hora12 = curH % 12 || 12;
      const hStr = `${hora12}:${String(curM).padStart(2, "0")} ${periodo}`;

      bloques.push({
        etiqueta: hStr,
        horaInt: curH,
        minutosInt: curM,
      });

      curM += duracion;
      if (curM >= 60) {
        curH += Math.floor(curM / 60);
        curM = curM % 60;
      }
    }
    return bloques;
  }, [clubInfo]);

  const obtenerReserva = (canchaId, bloqueDateObj) => {
    return partidosPeriodo.find((p) => {
      if (p.court_id !== canchaId) return false;
      const fechaCitaDB = p.scheduled_at.substring(0, 16); 
      
      const ano = bloqueDateObj.getUTCFullYear();
      const mes = String(bloqueDateObj.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(bloqueDateObj.getUTCDate()).padStart(2, '0');
      const hora = String(bloqueDateObj.getUTCHours()).padStart(2, '0');
      const minutos = String(bloqueDateObj.getUTCMinutes()).padStart(2, '0');
      
      const fechaSlotGrid = `${ano}-${mes}-${dia}T${hora}:${minutos}`;
      return fechaCitaDB === fechaSlotGrid;
    });
  };

  const abrirModalAgendarPOS = async (cancha, dateObj, horaLabel, precioCalculado) => {
    if (!user) return;
    
    const ano = dateObj.getUTCFullYear();
    const mes = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(dateObj.getUTCDate()).padStart(2, '0');
    const hora = String(dateObj.getUTCHours()).padStart(2, '0');
    const minutos = String(dateObj.getUTCMinutes()).padStart(2, '0');
    const fechaFija = `${ano}-${mes}-${dia}T${hora}:${minutos}:00`;

    const lockExistente = bloqueosActivos.find((l) => {
      if (l.court_id !== cancha.id) return false;
      const fechaLockStr = l.scheduled_at.replace(" ", "T").substring(0, 16);
      return fechaLockStr === fechaFija.substring(0, 16);
    });

    if (lockExistente && lockExistente.user_id !== user.id) {
      return mostrarNotificacion(
        "Pista ocupada temporalmente", 
        "Un usuario u otro cajero está procesando el pago para esta pista en este momento. Intenta de nuevo en unos minutos.", 
        "warning"
      );
    }

    try {
      setProcesando(true);
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); 
      
      const { error: lockErr } = await supabase
        .from("padel_locks")
        .upsert({
          court_id: cancha.id,
          scheduled_at: fechaFija,
          user_id: user.id,
          expires_at: expiresAt
        }, { onConflict: 'court_id,scheduled_at' });

      if (lockErr) {
        console.error("Error al bloquear pista en POS:", lockErr);
        setProcesando(false);
        return mostrarNotificacion("Error al Bloquear", lockErr.message || "No se pudo registrar el bloqueo.", "error");
      }

      await cargarBloqueos();

      const precioBaseTotal = precioCalculado || cancha.price_credits || 15;
      const feeSugerido = precioBaseTotal * 0.10;
      const totalSugerido = precioBaseTotal + feeSugerido;

      setBloqueAgendar({ cancha, dateObj, horaLabel, precioBaseTotal });
      setMonedaAgendarPOS("USD");
      setFormAgendarPOS({
        nombreCliente: "",
        telefonoCliente: "",
        metodoPago: "pago_movil",
        montoCustomUSD: totalSugerido.toFixed(2),
        numReferencia: "",
        previewComprobante: "",
      });
      setModalAgendarOpen(true);
    } catch (e) {
      console.error("Error bloqueando la pista en POS:", e);
      mostrarNotificacion("Error", "Ocurrió un fallo al intentar bloquear la pista.", "error");
    } finally {
      setProcesando(false);
    }
  };

  const cerrarModalAgendarPOS = async () => {
    setModalAgendarOpen(false);
    if (bloqueAgendar && user) {
      const d = bloqueAgendar.dateObj;
      const fechaFija = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:00`;
      
      await supabase
        .from("padel_locks")
        .delete()
        .match({
          court_id: bloqueAgendar.cancha.id,
          scheduled_at: fechaFija,
          user_id: user.id
        });

      await cargarBloqueos();
    }
  };

  const calculosAgendarPOS = useMemo(() => {
    if (!bloqueAgendar) return { base: 0, fee: 0, totalSugerido: 0 };
    const base = bloqueAgendar.precioBaseTotal;
    const fee = base * 0.10;
    const totalSugerido = base + fee;
    return { base, fee, totalSugerido };
  }, [bloqueAgendar]);

  const handleSeleccionarImagenPOS = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return mostrarNotificacion("Archivo Inválido", "Por favor selecciona una imagen válida (JPG, PNG).", "error");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result);
    };
    reader.readAsDataURL(file);
  };

  async function ejecutarAgendarPOS(e) {
    e.preventDefault();
    if (!bloqueAgendar) return;

    const valIngresado = parseFloat(formAgendarPOS.montoCustomUSD);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Por favor ingresa un monto válido a cobrar.", "error");
    }

    if (formAgendarPOS.metodoPago !== "efectivo" && !formAgendarPOS.numReferencia.trim()) {
      return mostrarNotificacion("Falta Referencia", `Por favor ingresa el N° de Referencia para ${formAgendarPOS.metodoPago.toUpperCase().replace("_", " ")}.`, "error");
    }

    const montoUSD = monedaAgendarPOS === "VES" ? valIngresado / tasaBCV : valIngresado;
    const { cancha, dateObj } = bloqueAgendar;
    const scheduledAtFijo = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')}T${String(dateObj.getUTCHours()).padStart(2, '0')}:${String(dateObj.getUTCMinutes()).padStart(2, '0')}:00`;

    try {
      setProcesando(true);

      const { data: matchExistente } = await supabase
        .from("matches")
        .select("id")
        .eq("court_id", cancha.id)
        .eq("scheduled_at", scheduledAtFijo)
        .neq("status", "cancelado")
        .maybeSingle();

      if (matchExistente) {
        await supabase.from("padel_locks").delete().match({ court_id: cancha.id, scheduled_at: scheduledAtFijo, user_id: user.id });
        await cargarBloqueos();
        setModalAgendarOpen(false);
        return mostrarNotificacion("Pista Ocupada", "Un usuario acaba de confirmar la reserva en esta pista para el mismo horario.", "warning");
      }

      const { base, fee, totalSugerido } = calculosAgendarPOS;
      const nombreCliente = formAgendarPOS.nombreCliente.trim() || "Cliente Mostrador";
      const telefonoCliente = formAgendarPOS.telefonoCliente.trim();
      const notaFinal = telefonoCliente ? `${nombreCliente} (${telefonoCliente})` : nombreCliente;

      const nuevoAbonoPOS = {
        id: `pay-pos-${Date.now()}`,
        user_id: user.id,
        user_name: nombreCliente,
        user_phone: telefonoCliente || "En sitio",
        amount: montoUSD,
        method: formAgendarPOS.metodoPago,
        reference: formAgendarPOS.numReferencia.trim() || "Venta Directa POS",
        receipt_url: formAgendarPOS.previewComprobante || null,
        status: "aprobado",
        created_at: new Date().toISOString(),
      };

      const pagoCompleto = montoUSD >= totalSugerido - 0.05;
      const estadoPagoInicial = pagoCompleto ? "aprobado" : "pendiente_aprobacion";

      const { data: newMatch, error: matchErr } = await supabase
        .from("matches")
        .insert({
          club_id: clubId,
          court_id: cancha.id,
          scheduled_at: scheduledAtFijo,
          total_price: base,
          price_per_player: base / 4,
          app_fee: fee,
          match_type: "privado",
          is_private: true,
          status: "programado",
          payment_status: estadoPagoInicial,
          payment_method: formAgendarPOS.metodoPago,
          payment_proof_urls: formAgendarPOS.previewComprobante ? [formAgendarPOS.previewComprobante] : [],
          payments_history: [nuevoAbonoPOS],
          created_by: user.id,
          notes: notaFinal,
        })
        .select()
        .single();

      if (matchErr) throw matchErr;

      await supabase.from("match_players").insert({
        match_id: newMatch.id,
        user_id: user.id,
        team: "A",
      });

      await supabase
        .from("padel_locks")
        .delete()
        .match({
          court_id: cancha.id,
          scheduled_at: scheduledAtFijo
        });

      await cargarBloqueos();
      setModalAgendarOpen(false);
      mostrarNotificacion(
        "¡Reserva Agendada!",
        `✅ Pista agendada con éxito por $${montoUSD.toFixed(2)} USD (${monedaAgendarPOS === "VES" ? `Bs. ${valIngresado.toFixed(2)}` : `Bs. ${(montoUSD * tasaBCV).toFixed(2)}`}) mediante ${formAgendarPOS.metodoPago.toUpperCase()}.`,
        "success"
      );
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes("unique_court_time")) {
        mostrarNotificacion("Pista ya no disponible", "Alguien más acaba de confirmar una reserva para esta pista hace unos instantes.", "error");
      } else {
        mostrarNotificacion("Error al Agendar", err.message || "Error al procesar la reserva.", "error");
      }
    } finally {
      setProcesando(false);
    }
  }

  // VENTA DIRECTA TIENDA
  const abrirModalTienda = () => {
    setCarritoTienda([]);
    setBusquedaTienda("");
    setFormVentaTienda({
      nombreCliente: "",
      telefonoCliente: "",
      metodoPago: "pago_movil",
      numReferencia: "",
      previewComprobante: "",
    });
    setModalTiendaOpen(true);
  };

  const agregarAlCarritoTienda = (producto) => {
    const stockDisponible = producto.is_rental ? 999999 : (parseInt(producto.stock, 10) || 0);
    const itemExistente = carritoTienda.find((item) => item.id === producto.id);
    const qtyActual = itemExistente ? itemExistente.qty : 0;

    if (!producto.is_rental && qtyActual >= stockDisponible) {
      return mostrarNotificacion("Stock Insuficiente", `Disponibilidad máxima de "${producto.name}" alcanzada (${stockDisponible} und).`, "warning");
    }

    if (itemExistente) {
      setCarritoTienda(
        carritoTienda.map((item) =>
          item.id === producto.id ? { ...item, qty: item.qty + 1 } : item
        )
      );
    } else {
      setCarritoTienda([...carritoTienda, { ...producto, qty: 1 }]);
    }
  };

  const cambiarCantidadCarrito = (productoId, delta) => {
    setCarritoTienda((prev) =>
      prev
        .map((item) => {
          if (item.id === productoId) {
            const nuevaQty = item.qty + delta;
            const stockDisponible = item.is_rental ? 999999 : (parseInt(item.stock, 10) || 0);
            if (!item.is_rental && nuevaQty > stockDisponible) {
              mostrarNotificacion("Stock Limite", `Solo hay ${stockDisponible} und disponibles de ${item.name}`, "warning");
              return item;
            }
            return nuevaQty > 0 ? { ...item, qty: nuevaQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const productosTiendaFiltrados = useMemo(() => {
    if (!busquedaTienda.trim()) return productos;
    const term = busquedaTienda.toLowerCase();
    return productos.filter(p => p.name.toLowerCase().includes(term) || (p.brand && p.brand.toLowerCase().includes(term)));
  }, [productos, busquedaTienda]);

  const totalCarritoUSD = useMemo(() => {
    return carritoTienda.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * item.qty, 0);
  }, [carritoTienda]);

  async function ejecutarVentaDirectaTienda(e) {
    e.preventDefault();
    if (carritoTienda.length === 0) {
      return mostrarNotificacion("Carrito Vacío", "Selecciona al menos un producto para realizar la venta.", "warning");
    }

    if (formVentaTienda.metodoPago !== "efectivo" && !formVentaTienda.numReferencia.trim()) {
      return mostrarNotificacion("Falta Referencia", "Ingresa el N° de Referencia para el pago.", "error");
    }

    try {
      setProcesando(true);

      const nombreCliente = formVentaTienda.nombreCliente.trim() || "Cliente Mostrador (Tienda)";
      const telefonoCliente = formVentaTienda.telefonoCliente.trim() || "En sitio";
      const itemsAInsertar = [];
      const productosAActualizarStock = {};

      const { data: ventaDirecta, error: errVenta } = await supabase
        .from("sales")
        .insert({
          club_id: clubId,
          cashier_id: user.id,
          total_amount: totalCarritoUSD,
          payment_method: formVentaTienda.metodoPago,
          exchange_rate: tasaBCV,
        })
        .select("id")
        .single();

      if (errVenta) throw errVenta;

      const detalleTiendaStr = `Tienda POS | Cliente: ${nombreCliente} | Tel: ${telefonoCliente} | Ref: ${formVentaTienda.numReferencia || 'N/A'}${
        formVentaTienda.previewComprobante ? ` | Proof: ${formVentaTienda.previewComprobante}` : ''
      }`;

      carritoTienda.forEach((item) => {
        itemsAInsertar.push({
          sale_id: ventaDirecta.id,
          item_type: "producto",
          item_name: `Tienda: ${item.name}`,
          item_detail: detalleTiendaStr,
          quantity: item.qty,
          price_unit: parseFloat(item.price) || 0,
        });

        if (!item.is_rental) {
          productosAActualizarStock[item.id] = item.qty;
        }
      });

      await supabase.from("sales_items").insert(itemsAInsertar);

      if (Object.keys(productosAActualizarStock).length > 0) {
        const { data: currentProducts } = await supabase
          .from("products")
          .select("id, stock, is_rental")
          .in("id", Object.keys(productosAActualizarStock));

        if (currentProducts) {
          const updates = currentProducts
            .filter((p) => !p.is_rental)
            .map((p) => {
              const qtyVendida = productosAActualizarStock[p.id] || 0;
              const nuevoStock = Math.max(0, p.stock - qtyVendida);
              return supabase.from("products").update({ stock: nuevoStock }).eq("id", p.id);
            });

          if (updates.length > 0) await Promise.all(updates);
        }
      }

      setModalTiendaOpen(false);
      mostrarNotificacion(
        "Venta Exitosa",
        `✅ Venta de tienda registrada por $${totalCarritoUSD.toFixed(2)} USD (${nombreCliente}) e inventario actualizado.`,
        "success"
      );

      await cargarDatosGenerales();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error en Venta", "Error procesando la venta de tienda.", "error");
    } finally {
      setProcesando(false);
    }
  }

  const calcularTotalExtras = (match) => {
    const extras = Array.isArray(match?.extra_items) ? match.extra_items : [];
    return extras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
  };

  const extrasAgrupados = useMemo(() => {
    const list = Array.isArray(matchSeleccionado?.extra_items) ? matchSeleccionado.extra_items : [];
    const map = {};
    list.forEach((ex) => {
      const itemKey = String(ex.id);
      if (!map[itemKey]) {
        map[itemKey] = { id: ex.id, name: ex.name, price: parseFloat(ex.price) || 0, qty: 0 };
      }
      map[itemKey].qty += 1;
    });
    return Object.values(map);
  }, [matchSeleccionado?.extra_items]);

  async function agregarAbonoManualPOS(match) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "No se pueden agregar más cobros a un ticket que ya fue liquidado.", "warning");
    }

    const valIngresado = parseFloat(montoAbonoManualPOS);
    if (isNaN(valIngresado) || valIngresado <= 0) {
      return mostrarNotificacion("Monto Inválido", "Ingresa un monto válido a cobrar.", "error");
    }

    if (metodoAbonoManualPOS !== "efectivo" && !numRefAbonoManualPOS.trim()) {
      return mostrarNotificacion("Falta Referencia", `Por favor ingresa el N° de referencia para el pago.`, "error");
    }

    const montoFinalUSD = monedaCobroPOS === "VES" ? valIngresado / tasaBCV : valIngresado;

    try {
      setProcesando(true);
      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const nuevoAbono = {
        id: `pay-pos-${Date.now()}`,
        user_id: user.id,
        user_name: "Cliente Mostrador (POS)",
        user_phone: "En sitio",
        amount: montoFinalUSD,
        method: metodoAbonoManualPOS,
        reference: numRefAbonoManualPOS.trim() || (monedaCobroPOS === "VES" ? `Cobro Bs. ${valIngresado.toFixed(2)}` : "Cobro POS"),
        receipt_url: previewAbonoManualPOS || null,
        status: "aprobado",
        created_at: new Date().toISOString(),
      };

      const historialNuevo = [...historialActual, nuevoAbono];

      const totalAbonado = historialNuevo
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const nuevoEstadoGeneral = match.payment_status === "liquidado" 
        ? "liquidado" 
        : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

      await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      mostrarNotificacion(
        "Abono Registrado",
        `✅ Registrado $${montoFinalUSD.toFixed(2)} USD (${monedaCobroPOS === "VES" ? `Bs. ${valIngresado.toFixed(2)}` : `Bs. ${(montoFinalUSD * tasaBCV).toFixed(2)}`}).`,
        "success"
      );
      setMontoAbonoManualPOS("");
      setNumRefAbonoManualPOS("");
      setPreviewAbonoManualPOS("");
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error registrando el abono.", "error");
    } finally {
      setProcesando(false);
    }
  }

  async function registrarDevolucionCambioPOS(match, cambioUSD) {
    if (cambioUSD <= 0.05) return;
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "No se puede registrar cambio en una reserva ya liquidada.", "warning");
    }

    try {
      setProcesando(true);
      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const nuevoAbono = {
        id: `pay-pos-change-${Date.now()}`,
        user_id: user.id,
        user_name: "Devolución de Cambio (POS)",
        user_phone: "En sitio",
        amount: -Math.abs(cambioUSD),
        method: "efectivo",
        reference: `Entrega Cambio $${cambioUSD.toFixed(2)}`,
        receipt_url: null,
        status: "aprobado",
        created_at: new Date().toISOString(),
      };

      const historialNuevo = [...historialActual, nuevoAbono];

      await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
        })
        .eq("id", match.id);

      mostrarNotificacion(
        "Cambio Registrado",
        `💵 Se registró la entrega de $${cambioUSD.toFixed(2)} USD (Bs. ${(cambioUSD * tasaBCV).toFixed(2)}) en cambio.`,
        "success"
      );
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error al registrar la devolución de cambio.", "error");
    } finally {
      setProcesando(false);
    }
  }

  async function aprobarPagoPendiente(match, pagoId) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "Esta reserva ya está liquidada.", "warning");
    }

    try {
      setProcesando(true);
      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      
      const historialNuevo = historialActual.map(p => 
        p.id === pagoId ? { ...p, status: "aprobado" } : p
      );

      const totalAbonado = historialNuevo
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const pagoCompleto = totalAbonado >= totalGranEsperado - 0.05;
      const nuevoEstadoGeneral = match.payment_status === "liquidado" 
        ? "liquidado" 
        : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

      await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", match.id);

      const matchActualizado = { 
        ...match, 
        payments_history: historialNuevo, 
        payment_status: nuevoEstadoGeneral 
      };

      setMatchSeleccionado(matchActualizado);
      mostrarNotificacion("Pago Aprobado", "✅ El pago ha sido verificado y aprobado correctamente.", "success");
      await cargarPartidosPeriodo();

    } catch (err) {
      console.error("Error al aprobar pago:", err);
      mostrarNotificacion("Error", "No se pudo aprobar el pago.", "error");
    } finally {
      setProcesando(false);
    }
  }

  async function agregarUnExtraSilencioso(match, producto) {
    if (!producto || !match) return;

    const currentMatch = (matchSeleccionado && matchSeleccionado.id === match.id) ? matchSeleccionado : match;
    
    if (currentMatch.payment_status === "liquidado") {
      return mostrarNotificacion("🔒 Reserva Liquidada", "No se pueden agregar más consumos a una reserva que ya fue liquidada.", "warning");
    }

    const extrasActuales = Array.isArray(currentMatch.extra_items) ? currentMatch.extra_items : [];
    const realStock = producto.is_rental ? 999999 : (parseInt(producto.stock, 10) || 0);

    if (!producto.is_rental) {
      const cantidadEnTicket = extrasActuales.filter((ex) => String(ex.id) === String(producto.id)).length;
      if (cantidadEnTicket >= realStock) {
        return mostrarNotificacion(
          "Stock Insuficiente",
          `No puedes agregar más de ${realStock} und. de "${producto.name}". Disponibilidad máxima alcanzada.`,
          "warning"
        );
      }
    }

    const nuevoExtraItem = {
      id_unic: `extra-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      id: producto.id,
      name: producto.name,
      price: parseFloat(producto.price) || 0,
    };

    const nuevosExtras = [...extrasActuales, nuevoExtraItem];

    const totalAbonado = (Array.isArray(currentMatch.payments_history) ? currentMatch.payments_history : [])
      .filter((item) => item.status === "aprobado")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const precioBase = currentMatch.total_price || 15;
    const fee = currentMatch.app_fee || precioBase * 0.10;
    const totalExtrasNuevo = nuevosExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
    const totalGranEsperadoNuevo = precioBase + fee + totalExtrasNuevo;

    const pagoCompleto = totalAbonado >= totalGranEsperadoNuevo - 0.05;
    const nuevoEstadoGeneral = currentMatch.payment_status === "liquidado" 
      ? "liquidado" 
      : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

    const updatedMatch = { ...currentMatch, extra_items: nuevosExtras, payment_status: nuevoEstadoGeneral };
    setMatchSeleccionado(updatedMatch);
    setPartidosPeriodo((prev) =>
      prev.map((m) => (m.id === currentMatch.id ? updatedMatch : m))
    );

    try {
      await supabase
        .from("matches")
        .update({
          extra_items: nuevosExtras,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", currentMatch.id);
    } catch (err) {
      console.error("Error guardando extra en BD:", err);
    }
  }

  async function quitarUnExtraSilencioso(match, productoId) {
    if (!match) return;

    const currentMatch = (matchSeleccionado && matchSeleccionado.id === match.id) ? matchSeleccionado : match;
    
    if (currentMatch.payment_status === "liquidado") {
      return mostrarNotificacion("🔒 Reserva Liquidada", "No se pueden eliminar consumos de una reserva que ya fue liquidada.", "warning");
    }

    const extrasActuales = Array.isArray(currentMatch.extra_items) ? currentMatch.extra_items : [];
    
    const idxToRemove = extrasActuales.findIndex((ex) => String(ex.id) === String(productoId));
    if (idxToRemove === -1) return;

    const nuevosExtras = [...extrasActuales];
    nuevosExtras.splice(idxToRemove, 1);

    const totalAbonado = (Array.isArray(currentMatch.payments_history) ? currentMatch.payments_history : [])
      .filter((item) => item.status === "aprobado")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const precioBase = currentMatch.total_price || 15;
    const fee = currentMatch.app_fee || precioBase * 0.10;
    const totalExtrasNuevo = nuevosExtras.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
    const totalGranEsperadoNuevo = precioBase + fee + totalExtrasNuevo;

    const pagoCompleto = totalAbonado >= totalGranEsperadoNuevo - 0.05;
    const nuevoEstadoGeneral = currentMatch.payment_status === "liquidado" 
      ? "liquidado" 
      : (pagoCompleto ? "aprobado" : "pendiente_aprobacion");

    const updatedMatch = { ...currentMatch, extra_items: nuevosExtras, payment_status: nuevoEstadoGeneral };
    setMatchSeleccionado(updatedMatch);
    setPartidosPeriodo((prev) =>
      prev.map((m) => (m.id === currentMatch.id ? updatedMatch : m))
    );

    try {
      await supabase
        .from("matches")
        .update({
          extra_items: nuevosExtras,
          payment_status: nuevoEstadoGeneral,
        })
        .eq("id", currentMatch.id);
    } catch (err) {
      console.error("Error removiendo extra en BD:", err);
    }
  }

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto.trim()) return productos;
    const term = busquedaProducto.toLowerCase();
    return productos.filter(p => p.name.toLowerCase().includes(term) || (p.brand && p.brand.toLowerCase().includes(term)));
  }, [productos, busquedaProducto]);

  async function cerrarTicketYLiquidarReserva(match) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ya Liquidado", "Esta reserva ya fue liquidada e ingresada al historial de ventas.", "info");
    }

    try {
      setProcesando(true);

      const precioBase = match.total_price || 15;
      const fee = match.app_fee || precioBase * 0.10;
      const totalExtras = calcularTotalExtras(match);
      const totalGranEsperado = precioBase + fee + totalExtras;

      const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
      const totalAbonadoAprobado = historialActual
        .filter((item) => item.status === "aprobado")
        .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      const restante = Math.max(0, totalGranEsperado - totalAbonadoAprobado);

      let historialNuevo = [...historialActual];
      if (restante > 0) {
        historialNuevo.push({
          id: `pay-pos-close-${Date.now()}`,
          user_id: user.id,
          user_name: "Liquidación Recepción POS",
          user_phone: "En sitio",
          amount: restante,
          method: metodoAbonoManualPOS || "pago_movil",
          reference: numRefAbonoManualPOS.trim() || "Cierre de Ticket POS",
          receipt_url: previewAbonoManualPOS || null,
          status: "aprobado",
          created_at: new Date().toISOString(),
        });
      }

      historialNuevo = historialNuevo.map((item) => ({ ...item, status: "aprobado" }));

      const { data: ventaCaja, error: errVenta } = await supabase
        .from("sales")
        .insert({
          club_id: clubId,
          cashier_id: user.id,
          total_amount: totalGranEsperado,
          payment_method: metodoAbonoManualPOS || match.payment_method || "efectivo",
          exchange_rate: tasaBCV,
        })
        .select("id")
        .single();

      if (errVenta) throw errVenta;

      let nombreItemCancha = `Reserva Completa: ${match.court?.name || "Pista"}`;
      if (promocionHoy) {
        nombreItemCancha = `Reserva (Promo ${promocionHoy.name}): ${match.court?.name || "Pista"}`;
      }

      const itemsAInsertar = [
        {
          sale_id: ventaCaja.id,
          item_type: "cancha",
          item_name: nombreItemCancha,
          item_detail: `MatchID:${match.id} | Cliente: ${obtenerNombreCliente(match)}`,
          quantity: 1,
          price_unit: precioBase,
        },
      ];

      if (fee > 0) {
        itemsAInsertar.push({
          sale_id: ventaCaja.id,
          item_type: "comision_app",
          item_name: "Comisión App Sports Hub",
          item_detail: "Cobrado al usuario",
          quantity: 1,
          price_unit: fee,
        });
      }

      const extrasList = Array.isArray(match.extra_items) ? match.extra_items : [];
      const productosVendidos = {};

      extrasList.forEach((ex) => {
        itemsAInsertar.push({
          sale_id: ventaCaja.id,
          item_type: "producto",
          item_name: `Extra: ${ex.name}`,
          item_detail: "Consumo de tienda",
          quantity: 1,
          price_unit: parseFloat(ex.price) || 0,
        });

        if (ex.id) {
          productosVendidos[ex.id] = (productosVendidos[ex.id] || 0) + 1;
        }
      });

      await supabase.from("sales_items").insert(itemsAInsertar);

      if (Object.keys(productosVendidos).length > 0) {
        const { data: currentProducts } = await supabase
          .from("products")
          .select("id, stock, is_rental")
          .in("id", Object.keys(productosVendidos));

        if (currentProducts) {
          const updates = currentProducts
            .filter(p => !p.is_rental)
            .map(p => {
              const cantidadVendida = productosVendidos[p.id] || 0;
              const nuevoStock = Math.max(0, p.stock - cantidadVendida);
              return supabase.from("products").update({ stock: nuevoStock }).eq("id", p.id);
            });
          
          if (updates.length > 0) await Promise.all(updates);
        }
      }

      await supabase
        .from("matches")
        .update({
          payments_history: historialNuevo,
          payment_status: "liquidado",
        })
        .eq("id", match.id);

      setModalDetalleMatch(false);
      mostrarNotificacion(
        "Ticket Liquidado",
        `🔒 ¡RESERVA CONFIRMADA! Se registraron $${totalGranEsperado.toFixed(2)} (Bs. ${(totalGranEsperado * tasaBCV).toFixed(2)}) en el historial.`,
        "success"
      );
      
      await cargarDatosGenerales();
      await cargarPartidosPeriodo();

    } catch (err) {
      console.error("Error al liquidar:", err);
      mostrarNotificacion("Error", "Error al liquidar el ticket.", "error");
    } finally {
      setProcesando(false);
    }
  }

  // PROCESAR REEMBOLSO Y LIBERAR CANCHA (+6H)
  async function procesarDevolucionYLiberarCancha(match) {
    const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
    const totalAbonado = historialActual
      .filter((item) => item.status === "aprobado" || item.status === "pendiente")
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    const clienteNom = obtenerNombreCliente(match);

    try {
      setProcesando(true);

      // 1. Insertar la devolución en el historial de ventas
      const { data: ventaDevolucion } = await supabase
        .from("sales")
        .insert({
          club_id: clubId,
          cashier_id: user.id,
          total_amount: -Math.abs(totalAbonado),
          payment_method: "efectivo",
          exchange_rate: tasaBCV,
        })
        .select("id")
        .single();

      if (ventaDevolucion) {
        await supabase.from("sales_items").insert({
          sale_id: ventaDevolucion.id,
          item_type: "reembolso_pendiente",
          item_name: `🔵 Reembolso Devuelto (+6h): ${match.court?.name || "Pista"}`,
          item_detail: `Cliente: ${clienteNom} | Devuelto en sitio: $${totalAbonado.toFixed(2)} USD`,
          quantity: 1,
          price_unit: -Math.abs(totalAbonado),
        });
      }

      // 2. Eliminar jugadores
      await supabase.from("match_players").delete().eq("match_id", match.id);

      // 3. Eliminar el partido (se libera la grilla para nuevas reservas)
      const { error: errMatch } = await supabase.from("matches").delete().eq("id", match.id);
      if (errMatch) throw errMatch;

      // 4. Eliminar bloqueos
      await supabase.from("padel_locks").delete().eq("court_id", match.court_id).eq("scheduled_at", match.scheduled_at);

      setModalDetalleMatch(false);
      mostrarNotificacion(
        "Devolución Exitosa y Pista Liberada",
        `💵 Se registraron -$${totalAbonado.toFixed(2)} USD en caja y la cancha ha quedado completamente libre.`,
        "success"
      );

      await cargarBloqueos();
      await cargarPartidosPeriodo();
    } catch (err) {
      console.error(err);
      mostrarNotificacion("Error", "Error al procesar la devolución.", "error");
    } finally {
      setProcesando(false);
    }
  }

  // CANCELACIÓN DIRECTA DE DESDE POS CON EVALUACIÓN DE 6 HORAS
  async function cancelarReserva(match) {
    if (match.payment_status === "liquidado") {
      return mostrarNotificacion("Ticket Liquidado", "No se puede anular una reserva que ya fue liquidada e ingresada en las ventas oficiales.", "warning");
    }

    const fechaPartido = parsearFechaBD(match.scheduled_at);
    const ahora = new Date();
    const diferenciaHoras = (fechaPartido.getTime() - ahora.getTime()) / (1000 * 60 * 60);

    const esConMasDe6Horas = diferenciaHoras >= 6;

    const mensajeModal = esConMasDe6Horas
      ? `La reserva se anula con más de 6h de anticipación (${diferenciaHoras.toFixed(1)}h).\n\n¿Deseas marcar esta reserva en AZUL (Reembolso Pendiente) para entregar el dinero en sitio y luego liberar la pista?`
      : `La reserva se anula con menos de 6h de anticipación (${diferenciaHoras.toFixed(1)}h).\n\nNO HABRÁ DEVOLUCIÓN. Se liberará la pista para volver a ser reservada y el abono se conservará como ingreso retenido.`;

    pedirConfirmacion(
      esConMasDe6Horas ? "Anular Reserva (+6h Reembolso)" : "Anular Reserva (<6h Sin Reembolso)",
      mensajeModal,
      async () => {
        try {
          setProcesando(true);

          const historialActual = Array.isArray(match.payments_history) ? match.payments_history : [];
          const totalAbonado = historialActual
            .filter((item) => item.status === "aprobado" || item.status === "pendiente")
            .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

          const clienteNom = obtenerNombreCliente(match);

          if (esConMasDe6Horas) {
            // Se marca en azul
            await supabase
              .from("matches")
              .update({
                status: "cancelado_pendiente_reembolso",
                payment_status: "reembolso_pendiente",
              })
              .eq("id", match.id);

            setModalDetalleMatch(false);
            mostrarNotificacion(
              "Reserva en Reembolso", 
              `🔵 La reserva cambió a Azul. Entrega el dinero al cliente en recepción y presiona "Devolver y Liberar Cancha".`, 
              "info"
            );
          } else {
            // Menos de 6h: retener dinero e ingresar a caja
            if (totalAbonado > 0) {
              const { data: ventaCancelacion } = await supabase
                .from("sales")
                .insert({
                  club_id: clubId,
                  cashier_id: user.id,
                  total_amount: totalAbonado,
                  payment_method: match.payment_method || "efectivo",
                  exchange_rate: tasaBCV,
                })
                .select("id")
                .single();

              if (ventaCancelacion) {
                await supabase.from("sales_items").insert({
                  sale_id: ventaCancelacion.id,
                  item_type: "ingreso_pista_cancelada",
                  item_name: `🟢 Ingreso Pista Cancelada (<6h): ${match.court?.name || "Pista"}`,
                  item_detail: `Cliente: ${clienteNom} | Tel: ${match.creator_profile?.telefono || "En sitio"}`,
                  quantity: 1,
                  price_unit: totalAbonado,
                });
              }
            }

            // Eliminar relaciones y liberar pista inmediatamente
            await supabase.from("match_players").delete().eq("match_id", match.id);
            await supabase.from("matches").delete().eq("id", match.id);
            await supabase.from("padel_locks").delete().eq("court_id", match.court_id).eq("scheduled_at", match.scheduled_at);

            setModalDetalleMatch(false);
            mostrarNotificacion(
              "Reserva Anulada", 
              `🚨 Pista liberada. El dinero abonado ($${totalAbonado.toFixed(2)}) quedó retenido en las ventas del club.`, 
              "warning"
            );
          }

          await cargarBloqueos(); 
          await cargarPartidosPeriodo();

        } catch (err) {
          console.error("Error cancelando reserva:", err);
          mostrarNotificacion("Error", err.message || "Error al anular la reserva.", "error");
        } finally {
          setProcesando(false);
        }
      }
    );
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-500">Cargando Sistema POS...</div>;
  }

  const numIngresadoAgendar = parseFloat(formAgendarPOS.montoCustomUSD) || 0;
  const equivalenteAgendar = monedaAgendarPOS === "USD"
    ? numIngresadoAgendar * tasaBCV
    : numIngresadoAgendar / tasaBCV;

  return (
    <div className="flex flex-col w-full min-h-screen bg-slate-100 font-sans p-2 sm:p-4 space-y-3">

      {/* CONTENEDOR PRINCIPAL POS */}
      <div className="w-full flex flex-col flex-1 min-w-0 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-300 overflow-hidden">
        
        {/* BARRA SUPERIOR HEADER POS */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap justify-between items-center bg-white gap-3">
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏟️</span>
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Gestión de Canchas & Recepción POS
              </h1>
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400">
              Agenda multideporte en vivo, control de reservas y ventas de mostrador
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => irNavegacionFecha(-1)}
                className="px-2.5 py-1.5 bg-white text-slate-800 shadow-xs border border-slate-200 rounded-lg text-xs font-black hover:bg-slate-50 transition-colors cursor-pointer"
                title="Anterior"
              >
                ◄
              </button>
              <CustomDarkDatePicker value={fechaBase} onChange={(nueva) => setFechaBase(nueva)} />
              <button
                type="button"
                onClick={() => irNavegacionFecha(1)}
                className="px-2.5 py-1.5 bg-white text-slate-800 shadow-xs border border-slate-200 rounded-lg text-xs font-black hover:bg-slate-50 transition-colors cursor-pointer"
                title="Siguiente"
              >
                ►
              </button>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setVistaCalendario("dia")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  vistaCalendario === "dia" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"
                }`}
              >
                1 Día
              </button>
              <button
                type="button"
                onClick={() => setVistaCalendario("4dias")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  vistaCalendario === "4dias" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"
                }`}
              >
                4 Días
              </button>
              <button
                type="button"
                onClick={() => setVistaCalendario("semana")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  vistaCalendario === "semana" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"
                }`}
              >
                Semana
              </button>
            </div>

            <select
              value={canchaFiltro}
              onChange={(e) => setCanchaFiltro(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs outline-none cursor-pointer"
            >
              <option value="todas">🏟️ Todas las Canchas</option>
              {canchas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sport_type === "futbol" ? "⚽" : "🎾"} {c.name}
                </option>
              ))}
            </select>

            {alertaNuevaReserva && (
              <button
                type="button"
                onClick={() => {
                  setCanchaFiltro("todas");
                  setAlertaNuevaReserva(null);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-md border border-rose-700 rounded-xl text-[11px] font-black animate-pulse flex items-center gap-2 cursor-pointer transition-colors"
              >
                <span>⚠️</span>
                <span className="hidden sm:inline">¡Atención! Nueva reserva en {alertaNuevaReserva.deporte}</span>
                <span className="sm:hidden">{alertaNuevaReserva.deporte}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {tasaBCV && (
              <div className="hidden xl:flex flex-col text-right px-2.5 py-1 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-[8px] font-black uppercase text-slate-400">Tasa BCV</span>
                <span className="text-xs font-black text-slate-800">Bs. {tasaBCV.toFixed(2)}</span>
              </div>
            )}

            <button
              type="button"
              onClick={abrirModalTienda}
              className="bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase px-3.5 py-2 rounded-xl shadow-md transition-all active:scale-98 flex items-center gap-1.5 cursor-pointer"
            >
              <span>🛒</span>
              <span>Venta Directa Tienda</span>
            </button>
          </div>

        </div>

        {/* BANNER PROMOCIÓN */}
        {promocionHoy && (
          <div className="bg-rose-50 border-b border-rose-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-3">
              <span className="text-xl animate-bounce">🎁</span>
              <div>
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-tight">
                  TARIFA PROMOCIONAL ACTIVA: {promocionHoy.name}
                </h4>
                <p className="text-[10px] font-bold text-rose-700">
                  Precios reducidos aplicados automáticamente a las canchas en la fecha mostrada.
                </p>
              </div>
            </div>
            <div className="bg-rose-100 border border-rose-200 px-3 py-1 rounded-xl flex items-center gap-4 text-xs font-black text-rose-800">
              <div className="text-center">
                <span className="block text-[9px] uppercase opacity-70">Normal</span>
                ${promocionHoy.price_normal.toFixed(2)}
              </div>
              <div className="text-center border-l border-rose-300 pl-4">
                <span className="block text-[9px] uppercase opacity-70">Hora Pico</span>
                ${promocionHoy.price_peak.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* GRILLA RESPONSIVA POS */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 bg-slate-100 relative">
          <div className="flex gap-3 w-full min-w-full items-start relative">
            
            <div className="w-[72px] sm:w-[84px] shrink-0 sticky left-0 z-30 flex flex-col bg-slate-100 pr-3">
              <div className="bg-white rounded-2xl border-2 border-slate-300 shadow-md flex flex-col overflow-hidden mb-2">
                <div className="h-[88px] bg-slate-900 text-[#00FF9D] font-black text-xs uppercase flex items-center justify-center border-b-4 border-[#00FF9D] shrink-0">
                  HORA
                </div>
                
                <div className="flex flex-col">
                  {bloquesHorarios.map((bloque, idx) => (
                    <div key={idx} className="h-24 flex flex-col items-center justify-center p-1 text-center border-b border-slate-100 last:border-b-0">
                      <span className="text-[11px] sm:text-xs font-black text-slate-900">{bloque.etiqueta.split(" ")[0]}</span>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase">{bloque.etiqueta.split(" ")[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 flex gap-3 min-w-0 w-full relative z-0">
              {bloquesPorDia.map((bloqueDia) => (
                <div
                  key={bloqueDia.diaIdx}
                  className={`bg-white rounded-2xl border-2 border-slate-300 shadow-md flex flex-col overflow-hidden mb-2 ${
                    vistaCalendario === "dia" ? "w-full flex-1" : "shrink-0 w-auto"
                  }`}
                >
                  
                  <div className="h-12 bg-slate-900 text-white px-3 flex items-center justify-center border-b-4 border-[#00FF9D]">
                    <h3 className="text-xs sm:text-sm font-black tracking-wider uppercase text-[#00FF9D] truncate">
                      {bloqueDia.nombreDiaLargoMayus}
                    </h3>
                  </div>

                  <div className="h-10 flex border-b border-slate-200 bg-slate-100/80 items-center">
                    {bloqueDia.canchas.map((col) => (
                      <div
                        key={col.keyCol}
                        className={`p-2 text-center uppercase tracking-tight border-r border-slate-200 last:border-r-0 truncate ${
                          vistaCalendario === "dia" ? "flex-1 min-w-[140px]" : "w-[160px] shrink-0"
                        }`}
                      >
                        <span className="text-slate-900 text-[10px] sm:text-[11px] font-black flex items-center justify-center gap-1">
                          <span>{col.cancha.sport_type === "futbol" ? "⚽" : "🎾"}</span>
                          <span className="truncate">{col.cancha.name}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col">
                    {bloquesHorarios.map((bloque, idx) => {
                      const esFilaPar = idx % 2 === 0;

                      return (
                        <div key={idx} className={`flex h-24 border-b border-slate-100 last:border-b-0 ${esFilaPar ? "bg-white" : "bg-slate-50/50"}`}>
                          {bloqueDia.canchas.map((col) => {
                            const dateObjSlot = new Date(Date.UTC(
                              bloqueDia.diaObj.getFullYear(),
                              bloqueDia.diaObj.getMonth(),
                              bloqueDia.diaObj.getDate(),
                              bloque.horaInt,
                              bloque.minutosInt,
                              0, 0
                            ));

                            const reservado = obtenerReserva(col.cancha.id, dateObjSlot);

                            const { precio: precioOriginal } = calcularPrecioPorBloque(col.cancha, dateObjSlot);

                            const slotFechaStr = `${dateObjSlot.getUTCFullYear()}-${String(dateObjSlot.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObjSlot.getUTCDate()).padStart(2, '0')}`;
                            const promoSlot = promocionesPeriodo.find(p => p.start_date <= slotFechaStr && p.end_date >= slotFechaStr);
                            
                            const ano = dateObjSlot.getUTCFullYear();
                            const mes = String(dateObjSlot.getUTCMonth() + 1).padStart(2, '0');
                            const dia = String(dateObjSlot.getUTCDate()).padStart(2, '0');
                            const hora = String(dateObjSlot.getUTCHours()).padStart(2, '0');
                            const minutos = String(dateObjSlot.getUTCMinutes()).padStart(2, '0');
                            const fechaFija = `${ano}-${mes}-${dia}T${hora}:${minutos}`;

                            const lockOcupado = bloqueosActivos.find((l) => {
                              if (l.court_id !== col.cancha.id) return false;
                              const fechaLockStr = l.scheduled_at.replace(" ", "T").substring(0, 16);
                              return fechaLockStr === fechaFija.substring(0, 16);
                            });

                            let precioUSD = precioOriginal;
                            let esPromoAplicada = false;

                            if (promoSlot) {
                              esPromoAplicada = true;
                              const hasBlocks = promoSlot.time_blocks && promoSlot.time_blocks.length > 0;
                              if (hasBlocks) {
                                const horaBotonStr = `${String(bloque.horaInt).padStart(2, '0')}:${String(bloque.minutosInt).padStart(2, '0')}`;
                                const bloqueAplicable = promoSlot.time_blocks.find(b => horaBotonStr >= b.start_time && horaBotonStr < b.end_time);
                                if (bloqueAplicable) {
                                  precioUSD = parseFloat(bloqueAplicable.price); 
                                } else {
                                  esPromoAplicada = false;
                                }
                              } else {
                                precioUSD = promoSlot.price_normal;
                              }
                            }

                            return (
                              <div
                                key={col.keyCol}
                                className={`p-1 border-r border-slate-100 last:border-r-0 relative group ${
                                  vistaCalendario === "dia" ? "flex-1 min-w-[140px]" : "w-[160px] shrink-0"
                                }`}
                              >
                                {reservado ? (() => {
                                  const esReembolsoPendiente = reservado.status === "cancelado_pendiente_reembolso" || reservado.payment_status === "reembolso_pendiente";
                                  const isLiquidado = reservado.payment_status === "liquidado";
                                  const precioCanchaBaseFee = (reservado.total_price || 15) + (reservado.app_fee || 1.50);
                                  const totalAbonado = (Array.isArray(reservado.payments_history) ? reservado.payments_history : [])
                                    .filter((a) => a.status === "aprobado")
                                    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
                                  const totalExtras = (Array.isArray(reservado.extra_items) ? reservado.extra_items : [])
                                    .reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0);
                                  const totalGranEsperado = precioCanchaBaseFee + totalExtras;

                                  const canchaCubierta = totalAbonado >= (precioCanchaBaseFee - 0.05);
                                  const todoPagado = totalAbonado >= (totalGranEsperado - 0.05);
                                  const esAbierto = reservado.match_type === "abierto" && !reservado.is_private;

                                  let cardStyle = "";
                                  let badgeText = "";
                                  let badgeStyle = "";

                                  if (esReembolsoPendiente) {
                                    cardStyle = "bg-sky-100/90 text-sky-950 border-sky-400 hover:bg-sky-200/90 shadow-sm animate-pulse";
                                    badgeText = "🔵 REEMBOLSO (+6H)";
                                    badgeStyle = "bg-sky-600 text-white font-black";
                                  } else if (isLiquidado) {
                                    cardStyle = "bg-emerald-100/90 text-emerald-950 border-emerald-400 hover:bg-emerald-200/90 shadow-sm";
                                    badgeText = "✅ LIQUIDADA";
                                    badgeStyle = "bg-emerald-600 text-white font-black";
                                  } else if (todoPagado) {
                                    cardStyle = "bg-slate-950 text-white border-slate-800 hover:border-emerald-400";
                                    badgeText = "✅ PAGADA";
                                    badgeStyle = "bg-emerald-500/20 text-[#00FF9D] font-black";
                                  } else if (canchaCubierta) {
                                    cardStyle = "bg-amber-400/90 text-slate-950 border-amber-500 animate-pulse hover:bg-amber-400";
                                    badgeText = "⚠️ EXTRAS PENDIENTES";
                                    badgeStyle = "bg-slate-950 text-amber-300 font-black";
                                  } else {
                                    cardStyle = "bg-rose-500/90 text-white border-rose-600 animate-pulse hover:bg-rose-500";
                                    badgeText = "🚨 PENDIENTE CONFIRMACIÓN";
                                    badgeStyle = "bg-slate-950 text-rose-300 font-black";
                                  }

                                  return (
                                    <button
                                      onClick={() => abrirModalDetalle(reservado)}
                                      className={`h-full w-full rounded-xl p-1.5 flex flex-col justify-between text-left transition-all shadow-xs border-2 overflow-hidden cursor-pointer ${cardStyle}`}
                                    >
                                      <div className="flex justify-between items-center w-full gap-1">
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full truncate ${badgeStyle}`}>
                                          {badgeText}
                                        </span>
                                        {esAbierto && (
                                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-900/20 rounded shrink-0">
                                            {reservado.players?.length || 1}/4
                                          </span>
                                        )}
                                      </div>
                                      <div className="my-0.5">
                                        <p className="text-[10px] sm:text-[11px] font-black truncate leading-tight">{obtenerNombreCliente(reservado)}</p>
                                      </div>

                                      {!isLiquidado && (
                                        <div className="pt-1 border-t border-black/10 flex justify-between items-center text-[8px] font-black uppercase tracking-wider opacity-90">
                                          <span>⚙️ Gestionar</span>
                                          <span>→</span>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })() : lockOcupado ? (
                                  <div className="h-full w-full rounded-xl p-2 flex flex-col items-center justify-center shadow-xs border-2 border-dashed border-amber-400 bg-amber-50/50 text-center cursor-not-allowed">
                                    <span className="text-xl animate-pulse">⏳</span>
                                    <p className="text-[10px] sm:text-[11px] font-black text-amber-600 mt-1 leading-tight">En proceso...</p>
                                    <p className="text-[8px] font-bold text-amber-700/60 mt-0.5">Alguien está pagando</p>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => abrirModalAgendarPOS(col.cancha, dateObjSlot, bloque.etiqueta, precioUSD)}
                                    className="h-full w-full hover:bg-emerald-50/90 text-emerald-800 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300/80 hover:border-emerald-500 transition-all shadow-2xs relative cursor-pointer opacity-80 hover:opacity-100"
                                  >
                                    {esPromoAplicada && (
                                      <span className="absolute top-1.5 left-1.5 text-[8px] font-black uppercase bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded shadow-sm">
                                        Promo
                                      </span>
                                    )}

                                    <span className="text-[10px] font-black text-emerald-700 transition-transform mb-1">
                                      + Agendar
                                    </span>

                                    {esPromoAplicada ? (
                                      <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[8px] font-bold text-slate-400 line-through">${precioOriginal.toFixed(2)}</span>
                                          <span className="text-[10px] sm:text-[11px] font-black text-rose-500">${precioUSD.toFixed(2)}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-500">${precioUSD.toFixed(2)}</span>
                                    )}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* MODAL VENTA DIRECTA TIENDA */}
      {mounted && modalTiendaOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-4" onClick={() => setModalTiendaOpen(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  POS Express Mostrador
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">🛒 Venta Directa de Tienda</h3>
              </div>
              <button onClick={() => setModalTiendaOpen(false)} className="text-slate-400 font-bold text-lg hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              <div className="md:col-span-7 space-y-3">
                <input
                  type="text"
                  placeholder="🔍 Buscar producto en inventario..."
                  value={busquedaTienda}
                  onChange={(e) => setBusquedaTienda(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold outline-none"
                />

                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {productosTiendaFiltrados.map((prod) => {
                    const stockDisponible = prod.is_rental ? 999999 : (parseInt(prod.stock, 10) || 0);
                    const sinStock = !prod.is_rental && stockDisponible <= 0;

                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => agregarAlCarritoTienda(prod)}
                        disabled={sinStock}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          sinStock
                            ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                            : "bg-white border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50"
                        }`}
                      >
                        <div>
                          <span className="text-[8px] font-black uppercase text-blue-500 block truncate">{prod.brand || "Tienda"}</span>
                          <p className="text-xs font-black text-slate-900 truncate">{prod.name}</p>
                        </div>
                        <div className="mt-2 flex justify-between items-end">
                          <div>
                            <span className="text-xs font-black text-emerald-700 block">${parseFloat(prod.price).toFixed(2)}</span>
                            <span className="text-[8px] text-slate-400 font-bold block">Bs. {(parseFloat(prod.price) * tasaBCV).toFixed(2)}</span>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {prod.is_rental ? "Ilimitado" : `Stock: ${stockDisponible}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-5 space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-500 block border-b pb-1">
                    🛍️ Carrito de Venta ({carritoTienda.reduce((s, i) => s + i.qty, 0)} items)
                  </span>

                  {carritoTienda.length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 italic py-8 text-center">
                      Haz clic en los productos a la izquierda para agregarlos al pedido.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {carritoTienda.map((item) => (
                        <div key={item.id} className="bg-white p-2 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                          <div className="min-w-0 pr-1">
                            <p className="font-bold text-slate-900 truncate text-[11px]">{item.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold">${parseFloat(item.price).toFixed(2)} c/u</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => cambiarCantidadCarrito(item.id, -1)}
                              className="w-5 h-5 rounded bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-black text-xs">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => cambiarCantidadCarrito(item.id, 1)}
                              className="w-5 h-5 rounded bg-slate-900 text-[#00FF9D] font-black text-xs flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="bg-slate-900 text-white p-2.5 rounded-xl flex justify-between items-center text-xs font-black">
                    <span>Total a Cobrar:</span>
                    <div className="text-right">
                      <span className="text-emerald-400 text-sm block leading-none">${totalCarritoUSD.toFixed(2)}</span>
                      <span className="text-[9px] text-slate-400 block font-normal mt-0.5">
                        Bs. {(totalCarritoUSD * tasaBCV).toFixed(2)} VES
                      </span>
                    </div>
                  </div>

                  <form onSubmit={ejecutarVentaDirectaTienda} className="space-y-2 text-xs">
                    <div>
                      <input
                        type="text"
                        placeholder="Nombre Cliente (Opcional)"
                        value={formVentaTienda.nombreCliente}
                        onChange={(e) => setFormVentaTienda({ ...formVentaTienda, nombreCliente: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <select
                        value={formVentaTienda.metodoPago}
                        onChange={(e) => setFormVentaTienda({ ...formVentaTienda, metodoPago: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold outline-none cursor-pointer"
                      >
                        <option value="pago_movil">📱 Pago Móvil</option>
                        <option value="zelle">🇺🇸 Zelle</option>
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="punto">💳 Punto Venta</option>
                      </select>
                    </div>

                    {formVentaTienda.metodoPago !== "efectivo" && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          required
                          placeholder="N° Referencia / ID * "
                          value={formVentaTienda.numReferencia}
                          onChange={(e) => setFormVentaTienda({ ...formVentaTienda, numReferencia: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold outline-none"
                        />

                        <div>
                          <label className="block text-[9px] font-black uppercase text-slate-400 mb-0.5">
                            Adjuntar Comprobante (Opcional)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleSeleccionarImagenPOS(e, (img) => setFormVentaTienda({ ...formVentaTienda, previewComprobante: img }))}
                            className="w-full bg-white border border-slate-300 rounded-xl p-1 text-[10px] outline-none file:mr-1 file:py-0.5 file:px-1.5 file:rounded-md file:border-0 file:bg-slate-900 file:text-[#00FF9D]"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={procesando || carritoTienda.length === 0}
                      className="w-full py-2.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-40"
                    >
                      {procesando ? "Procesando Venta..." : "✓ Confirmar Venta POS"}
                    </button>
                  </form>
                </div>

              </div>

            </div>

          </div>
        </div>,
        document.body
      )}

      {/* MODAL AGENDAR EN POS */}
      {mounted && modalAgendarOpen && bloqueAgendar && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-3 sm:p-4" onClick={cerrarModalAgendarPOS}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Nueva Reserva POS</span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{bloqueAgendar.cancha.name}</h3>
                <p className="text-xs font-bold text-slate-500">{bloqueAgendar.horaLabel}</p>
              </div>
              <button onClick={cerrarModalAgendarPOS} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={ejecutarAgendarPOS} className="space-y-3.5 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nombre del Cliente</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={formAgendarPOS.nombreCliente}
                  onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, nombreCliente: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Teléfono de Contacto</label>
                <input
                  type="tel"
                  placeholder="Ej. 0414-1234567"
                  value={formAgendarPOS.telefonoCliente}
                  onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, telefonoCliente: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    Monto Aportado Hoy ({monedaAgendarPOS === "USD" ? "$" : "Bs."})
                  </label>
                  
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => {
                        if (monedaAgendarPOS !== "USD") {
                          const val = parseFloat(formAgendarPOS.montoCustomUSD) || 0;
                          setFormAgendarPOS({ ...formAgendarPOS, montoCustomUSD: val > 0 ? (val / tasaBCV).toFixed(2) : "" });
                          setMonedaAgendarPOS("USD");
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${monedaAgendarPOS === "USD" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"}`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (monedaAgendarPOS !== "VES") {
                          const val = parseFloat(formAgendarPOS.montoCustomUSD) || 0;
                          setFormAgendarPOS({ ...formAgendarPOS, montoCustomUSD: val > 0 ? (val * tasaBCV).toFixed(2) : "" });
                          setMonedaAgendarPOS("VES");
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${monedaAgendarPOS === "VES" ? "bg-slate-900 text-[#00FF9D] shadow-xs" : "text-slate-600"}`}
                    >
                      Bs. VES
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.01"
                  value={formAgendarPOS.montoCustomUSD}
                  onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, montoCustomUSD: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-lg font-black text-slate-900 outline-none"
                  required
                />

                {numIngresadoAgendar > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex justify-between items-center text-[10px] font-black text-emerald-900 mt-1.5">
                    <span>🧮 Conversión:</span>
                    <span>
                      {monedaAgendarPOS === "USD"
                        ? `Bs. ${equivalenteAgendar.toFixed(2)} VES`
                        : `$${equivalenteAgendar.toFixed(2)} USD`}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between items-start text-slate-400">
                  <span>Cancha Base (Pista Completa):</span>
                  <div className="text-right">
                    <span className="text-white font-black block">${calculosAgendarPOS.base.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 block">Bs. {(calculosAgendarPOS.base * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-start text-[#00FF9D]">
                  <span>Comisión App (+10%):</span>
                  <div className="text-right">
                    <span className="font-black block">+${calculosAgendarPOS.fee.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400/70 block">Bs. {(calculosAgendarPOS.fee * tasaBCV).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end border-t border-slate-800 pt-2 text-white">
                  <div>
                    <span className="text-xs font-black block">Total Pista Esperado:</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#00FF9D] block">${calculosAgendarPOS.totalSugerido.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      Bs. {(calculosAgendarPOS.totalSugerido * tasaBCV).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Método de Pago Recibido</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "pago_movil", label: "📱 Pago Móvil" },
                    { id: "zelle", label: "🇺🇸 Zelle" },
                    { id: "efectivo", label: "💵 Efectivo" },
                    { id: "punto", label: "💳 Punto Venta" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFormAgendarPOS({ ...formAgendarPOS, metodoPago: m.id })}
                      className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                        formAgendarPOS.metodoPago === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {formAgendarPOS.metodoPago !== "efectivo" && (
                <div className="space-y-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      N° de Referencia / ID Transacción *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={formAgendarPOS.metodoPago === "zelle" ? "Ej. Email de Zelle o Ref #1234" : "Ej. 123456"}
                      value={formAgendarPOS.numReferencia}
                      onChange={(e) => setFormAgendarPOS({ ...formAgendarPOS, numReferencia: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Adjuntar Captura / Comprobante (Opcional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSeleccionarImagenPOS(e, (img) => setFormAgendarPOS({ ...formAgendarPOS, previewComprobante: img }))}
                      className="w-full bg-white border border-slate-300 rounded-xl p-1 text-xs outline-none file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-slate-900 file:text-[#00FF9D]"
                    />

                    {formAgendarPOS.previewComprobante && (
                      <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 max-h-24 bg-slate-950 flex items-center justify-center">
                        <img src={formAgendarPOS.previewComprobante} alt="Preview Comprobante" className="max-h-24 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={procesando}
                className="w-full py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase text-xs tracking-wider rounded-2xl shadow-md mt-2 cursor-pointer"
              >
                {procesando ? "Guardando..." : "✓ Agendar y Registrar Cobro"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DETALLE DE RESERVA EN RECEPCIÓN */}
      {mounted && modalDetalleMatch && matchSeleccionado && createPortal(
        (() => {
          const esReembolsoPendiente = matchSeleccionado.status === "cancelado_pendiente_reembolso" || matchSeleccionado.payment_status === "reembolso_pendiente";
          const extras = Array.isArray(matchSeleccionado.extra_items) ? matchSeleccionado.extra_items : [];
          const precioBase = matchSeleccionado.total_price || 15;
          const feeApp = matchSeleccionado.app_fee || (matchSeleccionado.is_private ? 0 : precioBase * 0.10);
          const totalCanchaConFee = precioBase + feeApp;

          const totalExtras = calcularTotalExtras(matchSeleccionado);
          const totalGranEsperado = totalCanchaConFee + totalExtras;

          const historialAbonos = Array.isArray(matchSeleccionado.payments_history) ? matchSeleccionado.payments_history : [];
          const totalAbonadoAprobado = historialAbonos
            .filter((a) => a.status === "aprobado" || a.status === "pendiente")
            .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

          const pendientePorCobrar = Math.max(0, totalGranEsperado - totalAbonadoAprobado);
          const cambioDevolver = Math.max(0, totalAbonadoAprobado - totalGranEsperado);
          
          const esLiquidadoOficial = matchSeleccionado.payment_status === "liquidado";
          const canchaTotalmenteCubierta = totalAbonadoAprobado >= (totalCanchaConFee - 0.05);
          const todoPagadoConExtras = pendientePorCobrar <= 0.05;

          const montoNumIngresado = parseFloat(montoAbonoManualPOS) || 0;
          const equivalenteCalculado = monedaCobroPOS === "USD" 
            ? montoNumIngresado * tasaBCV 
            : montoNumIngresado / tasaBCV;

          return (
            <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-3 sm:p-4" onClick={solicitarCerrarModalDetalle}>
              <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-5xl shadow-2xl space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" onClick={(e) => e.stopPropagation()}>
                
                <div className="flex justify-between items-start border-b pb-3">
                  <div>
                    <span className={`text-[9px] sm:text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      esReembolsoPendiente 
                        ? "bg-sky-100 text-sky-800 border border-sky-300"
                        : esLiquidadoOficial
                          ? "bg-emerald-100 text-emerald-800"
                          : todoPagadoConExtras 
                            ? "bg-emerald-100 text-emerald-800" 
                            : canchaTotalmenteCubierta 
                              ? "bg-blue-100 text-blue-900 border border-blue-200" 
                              : "bg-amber-500 text-slate-950"
                    }`}>
                      {esReembolsoPendiente
                        ? "🔵 REEMBOLSO PENDIENTE (+6H)"
                        : esLiquidadoOficial 
                          ? "🔒 FACTURA LIQUIDADA EN VENTAS" 
                          : todoPagadoConExtras 
                            ? "✅ FACTURA TOTALMENTE PAGADA" 
                            : canchaTotalmenteCubierta 
                              ? "🎾 CANCHA RESERVADA (EXTRAS PENDIENTES)" 
                              : "⚠️ RESERVA PENDIENTE DE PAGO"}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{matchSeleccionado.court?.name || "Pista"}</h3>
                  </div>
                  <button onClick={solicitarCerrarModalDetalle} className="text-slate-400 font-bold text-lg hover:text-slate-700 cursor-pointer">✕</button>
                </div>

                {/* SI ESTÁ EN ESTADO DE REEMBOLSO PENDIENTE (+6H) */}
                {esReembolsoPendiente ? (
                  <div className="bg-sky-50 border-2 border-sky-300 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🔵</span>
                      <div>
                        <h4 className="text-sm font-black text-sky-950 uppercase">Solicitud de Reembolso Pendiente (+6 Horas)</h4>
                        <p className="text-xs font-bold text-sky-800">
                          El jugador canceló su reserva con más de 6h de anticipación. Debes entregarle **${totalAbonadoAprobado.toFixed(2)} USD** (Bs. {(totalAbonadoAprobado * tasaBCV).toFixed(2)}) en recepción.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => procesarDevolucionYLiberarCancha(matchSeleccionado)}
                      disabled={procesando}
                      className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all"
                    >
                      {procesando ? "Procesando Devolución..." : `💵 Entregar Devolución ($${totalAbonadoAprobado.toFixed(2)} USD) y Liberar Cancha`}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-6 space-y-4">
                      <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
                        <div className="grid grid-cols-2 gap-4 flex-1">
                          <div>
                            <span className="text-[9px] uppercase font-black text-slate-400 block">Cliente:</span>
                            <p className="text-slate-900 font-black text-xs sm:text-sm truncate">{obtenerNombreCliente(matchSeleccionado)}</p>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-black text-slate-400 block">Contacto:</span>
                            <p className="text-slate-900 font-black text-xs sm:text-sm">{matchSeleccionado.creator_profile?.telefono || "En sitio"}</p>
                          </div>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => cancelarReserva(matchSeleccionado)}
                          disabled={procesando}
                          className={`px-3 py-1.5 border font-black text-[10px] uppercase rounded-xl transition-colors shrink-0 ml-2 cursor-pointer ${
                            procesando
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          }`}
                        >
                          Anular Reserva
                        </button>
                      </div>

                      <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 font-bold">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D] border-b border-slate-800 pb-1">
                          Desglose de Factura
                        </p>
                        
                        <div className="space-y-2 text-xs border-b border-slate-800 pb-3">
                          <div className="flex justify-between items-start text-slate-300">
                            <span>Pista Completa:</span>
                            <div className="text-right">
                              <span className="text-white block font-black">${precioBase.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 block">Bs. {(precioBase * tasaBCV).toFixed(2)}</span>
                            </div>
                          </div>

                          {feeApp > 0 && (
                            <div className="flex justify-between items-start text-emerald-400">
                              <span>Comisión App (+10%):</span>
                              <div className="text-right">
                                <span className="block font-black">+${feeApp.toFixed(2)}</span>
                                <span className="text-[10px] text-emerald-400/70 block">Bs. {(feeApp * tasaBCV).toFixed(2)}</span>
                              </div>
                            </div>
                          )}

                          {extrasAgrupados.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                              <span className="text-[10px] font-black uppercase text-amber-300 block">
                                Consumos Tienda ({extrasAgrupados.reduce((s, x) => s + x.qty, 0)} items)
                              </span>
                              {extrasAgrupados.map((item) => {
                                const subtotalUSD = item.price * item.qty;
                                const subtotalBs = subtotalUSD * tasaBCV;
                                return (
                                  <div key={item.id} className="flex justify-between items-start text-[11px] bg-slate-850 p-1.5 rounded-lg border border-slate-800">
                                    <span className="text-slate-200">{item.name} <strong className="text-amber-400">x{item.qty}</strong></span>
                                    <div className="text-right">
                                      <span className="text-amber-300 font-black block">${subtotalUSD.toFixed(2)}</span>
                                      <span className="text-[9px] text-slate-400 block">Bs. {subtotalBs.toFixed(2)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Total Factura</span>
                            <p className="text-lg font-black text-white leading-none mt-1">${totalGranEsperado.toFixed(2)}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">Bs. {(totalGranEsperado * tasaBCV).toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[9px] font-black uppercase text-emerald-400 block">Total Abonado</span>
                            <p className="text-lg font-black text-emerald-400 leading-none mt-1">${totalAbonadoAprobado.toFixed(2)}</p>
                            <p className="text-[10px] font-bold text-emerald-500/70 mt-0.5">Bs. {(totalAbonadoAprobado * tasaBCV).toFixed(2)}</p>
                          </div>
                        </div>

                        {cambioDevolver > 0.05 ? (
                          <div className="p-3.5 rounded-2xl border bg-cyan-500/20 border-cyan-500/60 text-cyan-300 flex justify-between items-center shadow-inner">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider block text-cyan-300">DINERO A DEVOLVER (CAMBIO)</span>
                              <span className="text-xs font-bold block opacity-90 mt-0.5 text-cyan-200">
                                Bs. {(cambioDevolver * tasaBCV).toFixed(2)} VES
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-black block leading-none text-cyan-200">${cambioDevolver.toFixed(2)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className={`p-3.5 rounded-2xl border flex justify-between items-center transition-all ${
                            pendientePorCobrar > 0.05
                              ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                              : "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                          }`}>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider block">
                                SALDO RESTANTE A COBRAR
                              </span>
                              <span className="text-xs font-bold block opacity-90 mt-0.5">Bs. {(pendientePorCobrar * tasaBCV).toFixed(2)} VES</span>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-black block leading-none">${pendientePorCobrar.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                        <button
                          onClick={() => setHistorialAbierto(!historialAbierto)}
                          className="w-full p-3.5 flex justify-between items-center bg-slate-100/80 hover:bg-slate-200/70 transition-colors text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{historialAbierto ? "▼" : "▶"}</span>
                            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Historial de Pagos ({historialAbonos.length})</h4>
                          </div>
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Aprobado: ${totalAbonadoAprobado.toFixed(2)}
                          </span>
                        </button>

                        {historialAbierto && (
                          <div className="p-3.5 border-t border-slate-200 space-y-2 bg-white">
                            {historialAbonos.length === 0 ? (
                              <p className="text-xs font-bold text-slate-400 italic py-2 text-center">No hay abonos registrados.</p>
                            ) : (
                              <div className="space-y-2 max-h-40 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pr-1">
                                {historialAbonos.map((ab, idx) => {
                                  const amountUsd = parseFloat(ab.amount) || 0;
                                  const amountBs = amountUsd * tasaBCV;
                                  const esAprobado = ab.status === "aprobado";

                                  return (
                                    <div key={ab.id || idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-[#00FF9D]">
                                            {ab.method ? ab.method.replace("_", " ") : "POS"}
                                          </span>
                                          <span className="text-xs font-black text-slate-800 truncate">{ab.user_name || "Cliente"}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                                          Ref: <strong className="text-slate-800">{ab.reference || "S/R"}</strong>
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right">
                                          <span className={`text-xs font-black block leading-none ${
                                            amountUsd < 0 ? "text-cyan-600" : (esAprobado ? "text-emerald-700" : "text-amber-600")
                                          }`}>
                                            ${amountUsd < 0 ? `-Math.abs(amountUsd).toFixed(2)` : amountUsd.toFixed(2)}
                                          </span>
                                          <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                                            Bs. {amountBs.toFixed(2)}
                                          </span>
                                        </div>

                                        {!esAprobado && !esLiquidadoOficial && (
                                          <button
                                            type="button"
                                            onClick={() => aprobarPagoPendiente(matchSeleccionado, ab.id)}
                                            disabled={procesando}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-colors shadow-sm cursor-pointer"
                                          >
                                            Aprobar
                                          </button>
                                        )}

                                        {ab.receipt_url && (
                                          <button
                                            type="button"
                                            onClick={() => setImagenEngrande(ab.receipt_url)}
                                            className="w-8 h-8 rounded-lg border border-slate-300 bg-slate-100 overflow-hidden hover:border-blue-500 transition-all shrink-0 cursor-pointer"
                                          >
                                            <img src={ab.receipt_url} alt="Comprobante" className="w-full h-full object-cover" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!esLiquidadoOficial && (
                        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                          <button
                            onClick={() => setCobroAbierto(!cobroAbierto)}
                            className="w-full p-3.5 flex justify-between items-center bg-slate-100/80 hover:bg-slate-200/70 transition-colors text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">{cobroAbierto ? "▼" : "▶"}</span>
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                Registrar Cobro de Saldo en Sitio
                              </h4>
                            </div>
                            {pendientePorCobrar > 0.05 && (
                              <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                                Pendiente: ${pendientePorCobrar.toFixed(2)}
                              </span>
                            )}
                          </button>

                          {cobroAbierto && (
                            <div className="p-3.5 sm:p-4 border-t border-slate-200 space-y-3 bg-white">
                              
                              <div className="flex justify-between items-center">
                                <p className="text-[10px] font-black uppercase text-slate-500">Moneda de Pago</p>
                                <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-[10px] font-black">
                                  <button
                                    type="button"
                                    onClick={() => setMonedaCobroPOS("USD")}
                                    className={`px-2 py-0.5 rounded-lg cursor-pointer ${monedaCobroPOS === "USD" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}
                                  >
                                    $ USD
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMonedaCobroPOS("VES")}
                                    className={`px-2 py-0.5 rounded-lg cursor-pointer ${monedaCobroPOS === "VES" ? "bg-slate-900 text-[#00FF9D]" : "text-slate-600"}`}
                                  >
                                    Bs. VES
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {[
                                  { id: "pago_movil", label: "📱 Pago Móvil" },
                                  { id: "zelle", label: "🇺🇸 Zelle" },
                                  { id: "efectivo", label: "💵 Efectivo" },
                                  { id: "punto", label: "💳 Punto Venta" },
                                ].map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMetodoAbonoManualPOS(m.id)}
                                    className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase border transition-all cursor-pointer ${
                                      metodoAbonoManualPOS === m.id ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-xs" : "bg-slate-50 text-slate-600 border-slate-200"
                                    }`}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder={pendientePorCobrar.toFixed(2)}
                                  value={montoAbonoManualPOS}
                                  onChange={(e) => setMontoAbonoManualPOS(e.target.value)}
                                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold outline-none"
                                />
                                <button
                                  onClick={() => agregarAbonoManualPOS(matchSeleccionado)}
                                  disabled={procesando}
                                  className="px-4 py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shrink-0 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  Registrar
                                </button>
                              </div>

                              {cambioDevolver > 0.05 && (
                                <button
                                  type="button"
                                  onClick={() => registrarDevolucionCambioPOS(matchSeleccionado, cambioDevolver)}
                                  disabled={procesando}
                                  className="w-full py-2.5 bg-cyan-600 text-white font-black text-xs uppercase rounded-xl shadow-sm hover:bg-cyan-700 transition-colors cursor-pointer"
                                >
                                  Entregar y Registrar Cambio (${cambioDevolver.toFixed(2)} USD)
                                </button>
                              )}

                              {metodoAbonoManualPOS !== "efectivo" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  <input
                                    type="text"
                                    placeholder="N° Referencia / ID Transacción"
                                    value={numRefAbonoManualPOS}
                                    onChange={(e) => setNumRefAbonoManualPOS(e.target.value)}
                                    className="bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold outline-none"
                                  />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleSeleccionarImagenPOS(e, setPreviewAbonoManualPOS)}
                                    className="bg-slate-50 border border-slate-300 rounded-xl p-1 text-[10px] outline-none file:mr-1 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-slate-900 file:text-[#00FF9D]"
                                  />
                                </div>
                              )}

                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* CONSUMOS EXTRA EN SLIDER */}
                    <div className="lg:col-span-6 space-y-4">
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                        
                        <div className="p-3.5 sm:p-4 bg-white border-b border-slate-200 space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🏪</span>
                              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                                Consumos Extra
                              </h4>
                            </div>
                            
                            <div className="relative w-full sm:w-48">
                              <input
                                type="text"
                                placeholder="🔍 Buscar artículo..."
                                value={busquedaProducto}
                                onChange={(e) => setBusquedaProducto(e.target.value)}
                                disabled={esLiquidadoOficial}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-50"
                              />
                            </div>
                          </div>

                          {esLiquidadoOficial && (
                            <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                              🔒 Ticket Liquidado - No es posible modificar consumos en facturas cerradas.
                            </p>
                          )}
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1 bg-slate-50 rounded-2xl border border-slate-200 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                          
                          <div className={`flex gap-3 px-3 py-2 ${esLiquidadoOficial ? "opacity-60 pointer-events-none" : ""}`}>
                            {productosFiltrados.length === 0 ? (
                              <p className="text-xs text-slate-400 font-bold p-3">No se encontraron productos.</p>
                            ) : (
                              productosFiltrados.map((prod) => {
                                const qty = extras.filter((ex) => String(ex.id) === String(prod.id)).length;
                                const pPrice = parseFloat(prod.price) || 0;
                                const stockDisponible = prod.is_rental ? 999999 : (parseInt(prod.stock, 10) || 0);
                                
                                const alcanzadoLimiteStock = !prod.is_rental && qty >= stockDisponible;
                                const sinStock = !prod.is_rental && stockDisponible <= 0;

                                return (
                                  <div
                                    key={prod.id}
                                    className={`shrink-0 w-44 p-3 rounded-2xl border flex flex-col justify-between shadow-xs transition-all ${
                                      qty > 0 ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"
                                    }`}
                                  >
                                    <div>
                                      <div className="flex justify-between items-center mb-0.5">
                                        <span className="text-[9px] font-black uppercase text-blue-500 truncate">{prod.brand || "Tienda"}</span>
                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${
                                          prod.is_rental ? "bg-purple-100 text-purple-700" : (sinStock ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600")
                                        }`}>
                                          {prod.is_rental ? "Ilimitado" : (sinStock ? "Agotado" : `Stock: ${stockDisponible}`)}
                                        </span>
                                      </div>
                                      <p className="text-xs font-black text-slate-900 truncate" title={prod.name}>{prod.name}</p>
                                    </div>
                                    
                                    <div className="mt-0.5">
                                      <span className="text-[11px] font-black text-slate-900 block">${pPrice.toFixed(2)}</span>
                                      <span className="text-[9px] font-bold text-slate-400 block">Bs. {(pPrice * tasaBCV).toFixed(2)}</span>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                                      {qty > 0 ? (
                                        <div className="flex items-center justify-between w-full">
                                          <button
                                            type="button"
                                            onClick={() => quitarUnExtraSilencioso(matchSeleccionado, prod.id)}
                                            disabled={esLiquidadoOficial}
                                            className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 font-black text-xs flex items-center justify-center hover:bg-rose-200 transition-colors disabled:opacity-40 cursor-pointer"
                                          >
                                            -
                                          </button>
                                          <span className="text-xs font-black">{qty} und</span>
                                          <button
                                            type="button"
                                            onClick={() => agregarUnExtraSilencioso(matchSeleccionado, prod)}
                                            disabled={esLiquidadoOficial || alcanzadoLimiteStock}
                                            className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center transition-colors cursor-pointer ${
                                              esLiquidadoOficial || alcanzadoLimiteStock
                                                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                                : "bg-slate-900 text-[#00FF9D] hover:bg-slate-800"
                                            }`}
                                          >
                                            +
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => agregarUnExtraSilencioso(matchSeleccionado, prod)}
                                          disabled={esLiquidadoOficial || sinStock || alcanzadoLimiteStock}
                                          className={`w-full py-1.5 rounded-xl font-black text-[10px] uppercase transition-colors cursor-pointer ${
                                            esLiquidadoOficial || sinStock || alcanzadoLimiteStock
                                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                              : "bg-slate-900 text-[#00FF9D] hover:bg-slate-800"
                                          }`}
                                        >
                                          {sinStock ? "Agotado" : "+ Añadir"}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={solicitarCerrarModalDetalle}
                    disabled={procesando}
                    className="w-1/3 py-3.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Salir (Cerrar)
                  </button>

                  {!esReembolsoPendiente && (
                    <button
                      onClick={() => cerrarTicketYLiquidarReserva(matchSeleccionado)}
                      disabled={procesando || esLiquidadoOficial || pendientePorCobrar > 0.05}
                      className={`w-2/3 py-3.5 text-white font-black text-xs uppercase rounded-2xl shadow-md transition-all cursor-pointer ${
                        esLiquidadoOficial 
                          ? "bg-slate-400 cursor-not-allowed"
                          : pendientePorCobrar > 0.05
                            ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300"
                            : "bg-emerald-600 hover:bg-emerald-700 active:scale-98"
                      }`}
                    >
                      {esLiquidadoOficial 
                        ? "🔒 Ticket Ya Liquidado" 
                        : pendientePorCobrar > 0.05
                          ? `Falta Cobrar $${pendientePorCobrar.toFixed(2)} USD`
                          : "✅ Liquidar Reserva"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* POPUP NOTIFICACIÓN */}
      {mounted && popupNotif.open && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
            <h3 className="text-base font-black text-slate-900">{popupNotif.title}</h3>
            <p className="text-xs font-bold text-slate-600">{popupNotif.message}</p>
            <button
              onClick={() => setPopupNotif({ ...popupNotif, open: false })}
              className="w-full py-2.5 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE CONFIRMACIÓN ACCIÓN GENERAL */}
      {mounted && modalConfirm.open && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <span className="text-3xl block">⚠️</span>
            <h3 className="text-base font-black text-slate-900">{modalConfirm.title}</h3>
            <p className="text-xs font-bold text-slate-600">{modalConfirm.message}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalConfirm({ ...modalConfirm, open: false })}
                className="w-1/2 py-2.5 bg-slate-100 text-slate-700 font-black text-xs uppercase rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const act = modalConfirm.action;
                  setModalConfirm({ ...modalConfirm, open: false });
                  if (act) act();
                }}
                className="w-1/2 py-2.5 bg-rose-600 text-white font-black text-xs uppercase rounded-xl hover:bg-rose-700 shadow-md cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRMACIÓN DE DESCARTE DE CAMBIOS */}
      {mounted && modalConfirmCambios && createPortal(
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <span className="text-3xl block">💾</span>
            <h3 className="text-base font-black text-slate-900">¿Guardar cambios en la reserva?</h3>
            <p className="text-xs font-bold text-slate-600">
              Has modificado los consumos extra de la reserva. ¿Deseas conservar los cambios realizados o descartarlos?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={guardarCambiosExtras}
                className="w-full py-3 bg-slate-900 text-[#00FF9D] font-black text-xs uppercase rounded-xl shadow-md cursor-pointer"
              >
                ✓ Conservar Cambios
              </button>
              <button
                onClick={descartarCambiosExtras}
                className="w-full py-2.5 bg-rose-50 text-rose-700 border border-rose-200 font-black text-xs uppercase rounded-xl cursor-pointer"
              >
                ✕ Descartar Cambios
              </button>
              <button
                onClick={() => setModalConfirmCambios(false)}
                className="w-full py-2 text-slate-400 font-extrabold text-[11px] uppercase hover:underline cursor-pointer"
              >
                Continuar editando
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* LIGHTBOX DE COMPROBANTE */}
      {mounted && imagenEngrande && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-4" onClick={() => setImagenEngrande(null)}>
          <div className="relative max-w-2xl max-h-[85vh] w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagenEngrande(null)}
              className="absolute -top-10 right-0 text-white font-black text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cerrar Vista
            </button>
            <img src={imagenEngrande} alt="Comprobante Ampliado" className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl border border-slate-800" />
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}