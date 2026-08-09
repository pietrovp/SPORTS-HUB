"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

const AMENIDADES_OPCIONES = [
  { id: "equipment_rental", label: "Alquiler de Equipo", icon: "🎾" },
  { id: "free_parking", label: "Estacionamiento Gratis", icon: "🚗" },
  { id: "store", label: "Tienda Deportiva", icon: "🛍️" },
  { id: "restaurant", label: "Restaurante", icon: "🍽️" },
  { id: "cafeteria", label: "Cafetería", icon: "☕" },
  { id: "changing_room", label: "Vestuarios y Duchas", icon: "🚿" },
  { id: "wifi", label: "WiFi Gratis", icon: "📶" },
  { id: "lockers", label: "Casilleros / Lockers", icon: "🔒" },
];

const DEPORTES_OPCIONES = [
  { id: "padel", label: "Pádel", icon: "🎾" },
  { id: "futbol", label: "Fútbol", icon: "⚽" },
];

export default function MiClubConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [club, setClub] = useState(null);
  const [canchas, setCanchas] = useState([]);

  const [formClub, setFormClub] = useState({
    name: "",
    city: "Barquisimeto",
    address: "",
    phone: "",
    description: "",
    image_url: "",
    slot_duration_minutes: 60,
    open_time: "07:00",
    close_time: "23:00",
    peak_start_time: "17:00",
    peak_end_time: "22:00",
    sports: ["padel", "futbol"],
    amenities: ["wifi", "free_parking", "changing_room"],
    opening_hours_text: {
      lunes_viernes: "06:00 - 23:00",
      sabado: "07:00 - 23:00",
      domingo: "07:00 - 23:00",
      feriados: "07:00 - 23:00",
    },
  });

  const [modalCanchaOpen, setModalCanchaOpen] = useState(false);
  const [editingCanchaId, setEditingCanchaId] = useState(null);
  
  const defaultCanchaForm = {
    name: "Pista 1",
    court_number: 1,
    sport_type: "padel", // NUEVO: Clasificación por Deporte
    surface_type: "Cristal",
    court_type: "indoor",
    has_lighting: true,
    pricing_blocks: [
      { start_time: "07:00", end_time: "12:00", price: 10 },
      { start_time: "12:00", end_time: "17:00", price: 15 },
    ],
  };

  const [formCancha, setFormCancha] = useState(defaultCanchaForm);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      setMensaje("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setLoading(false);
        return;
      }
      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("club_id, is_gerente")
        .eq("id", authUser.id)
        .maybeSingle();

      let targetClubId = profile?.club_id;

      if (!targetClubId) {
        const { data: clubCreado } = await supabase
          .from("padel_clubs")
          .select("id")
          .eq("created_by", authUser.id)
          .maybeSingle();

        targetClubId = clubCreado?.id || null;
      }

      if (targetClubId) {
        const { data: clubData } = await supabase
          .from("padel_clubs")
          .select("*")
          .eq("id", targetClubId)
          .maybeSingle();

        if (clubData) {
          setClub(clubData);

          const amenidadesCargadas = Array.isArray(clubData.amenities)
            ? clubData.amenities
            : ["wifi", "free_parking", "changing_room"];

          const deportesCargados = Array.isArray(clubData.sports)
            ? clubData.sports
            : ["padel", "futbol"];

          setFormClub({
            name: clubData.name || "",
            city: clubData.city || "Barquisimeto",
            address: clubData.address || "",
            phone: clubData.phone || "",
            description: clubData.description || "",
            image_url: clubData.image_url || "",
            slot_duration_minutes: clubData.slot_duration_minutes || 60,
            open_time: clubData.open_time?.slice(0, 5) || "07:00",
            close_time: clubData.close_time?.slice(0, 5) || "23:00",
            peak_start_time: clubData.peak_start_time?.slice(0, 5) || "17:00",
            peak_end_time: clubData.peak_end_time?.slice(0, 5) || "22:00",
            sports: deportesCargados,
            amenities: amenidadesCargadas,
            opening_hours_text: clubData.opening_hours_text || {
              lunes_viernes: "06:00 - 23:00",
              sabado: "07:00 - 23:00",
              domingo: "07:00 - 23:00",
              feriados: "07:00 - 23:00",
            },
          });

          const { data: courtsData } = await supabase
            .from("courts")
            .select("*")
            .eq("club_id", clubData.id)
            .order("court_number", { ascending: true });

          setCanchas(courtsData || []);
        }
      }
    } catch (err) {
      console.error("Error cargando configuración del club:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleAmenity(id) {
    setFormClub((prev) => {
      const exists = prev.amenities.includes(id);
      return {
        ...prev,
        amenities: exists ? prev.amenities.filter((a) => a !== id) : [...prev.amenities, id],
      };
    });
  }

  function toggleSport(id) {
    setFormClub((prev) => {
      const exists = prev.sports.includes(id);
      if (exists && prev.sports.length === 1) return prev;
      return {
        ...prev,
        sports: exists ? prev.sports.filter((s) => s !== id) : [...prev.sports, id],
      };
    });
  }

  async function guardarClub(e) {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setMensaje("");

      const slugCalculado = formClub.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const payload = {
        name: formClub.name.trim(),
        slug: slugCalculado,
        city: formClub.city,
        address: formClub.address.trim(),
        phone: formClub.phone.trim(),
        description: formClub.description.trim(),
        image_url: formClub.image_url.trim() || null,
        slot_duration_minutes: Number(formClub.slot_duration_minutes) || 60,
        open_time: `${formClub.open_time}:00`,
        close_time: `${formClub.close_time}:00`,
        peak_start_time: `${formClub.peak_start_time}:00`,
        peak_end_time: `${formClub.peak_end_time}:00`,
        amenities: formClub.amenities,
        sports: formClub.sports,
        opening_hours_text: formClub.opening_hours_text,
        is_active: true,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      let clubGuardado = null;
      const esNuevo = !club;

      if (club) {
        const { data, error } = await supabase
          .from("padel_clubs")
          .update(payload)
          .eq("id", club.id)
          .select()
          .single();

        if (error) throw error;
        clubGuardado = data;
      } else {
        const { data, error } = await supabase
          .from("padel_clubs")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        clubGuardado = data;
      }

      await supabase
        .from("profiles")
        .update({
          club_id: clubGuardado.id,
          is_gerente: true,
        })
        .eq("id", user.id);

      setClub(clubGuardado);
      setMensaje("✅ ¡Configuración del Complejo guardada exitosamente!");

      if (esNuevo) {
        router.push("/admin/recepcion");
      } else {
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar el complejo: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function abrirModalNuevaCancha() {
    setEditingCanchaId(null);
    setFormCancha({
      ...defaultCanchaForm,
      name: `Cancha ${canchas.length + 1}`,
      court_number: canchas.length + 1,
    });
    setModalCanchaOpen(true);
  }

  function abrirModalEditarCancha(cancha) {
    setEditingCanchaId(cancha.id);

    const bloquesPorDefecto = cancha.pricing_blocks && cancha.pricing_blocks.length > 0 
      ? cancha.pricing_blocks 
      : [
          { start_time: "07:00", end_time: "17:00", price: cancha.price_normal || 12 },
          { start_time: "17:00", end_time: "23:00", price: cancha.price_peak || 20 }
        ];

    setFormCancha({
      name: cancha.name,
      court_number: cancha.court_number,
      sport_type: cancha.sport_type || "padel",
      surface_type: cancha.surface_type || "Sintético",
      court_type: cancha.court_type || "outdoor",
      has_lighting: cancha.has_lighting ?? true,
      pricing_blocks: bloquesPorDefecto
    });
    setModalCanchaOpen(true);
  }

  function agregarBloque() {
    setFormCancha(prev => ({
      ...prev,
      pricing_blocks: [...prev.pricing_blocks, { start_time: "", end_time: "", price: 0 }]
    }));
  }

  function actualizarBloque(index, campo, valor) {
    const nuevosBloques = [...formCancha.pricing_blocks];
    nuevosBloques[index][campo] = valor;
    setFormCancha({ ...formCancha, pricing_blocks: nuevosBloques });
  }

  function eliminarBloque(index) {
    const nuevosBloques = formCancha.pricing_blocks.filter((_, i) => i !== index);
    setFormCancha({ ...formCancha, pricing_blocks: nuevosBloques });
  }

  async function guardarCancha(e) {
    e.preventDefault();
    if (!club) {
      alert("Debes guardar primero la información básica del complejo.");
      return;
    }
    
    if (formCancha.pricing_blocks.length === 0) {
      alert("Debes agregar al menos un bloque de precios.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        club_id: club.id,
        name: formCancha.name.trim(),
        court_number: Number(formCancha.court_number) || canchas.length + 1,
        sport_type: formCancha.sport_type, // NUEVO
        surface_type: formCancha.surface_type,
        court_type: formCancha.court_type,
        has_lighting: formCancha.has_lighting,
        pricing_blocks: formCancha.pricing_blocks,
        price_normal: parseFloat(formCancha.pricing_blocks[0].price) || 12,
        price_peak: parseFloat(formCancha.pricing_blocks[0].price) || 20,
        price_credits: parseFloat(formCancha.pricing_blocks[0].price) || 12, 
        is_active: true,
      };

      if (editingCanchaId) {
        const { error } = await supabase.from("courts").update(payload).eq("id", editingCanchaId);
        if (error) throw error;
        setMensaje(`✅ Pista ${payload.name} actualizada correctamente.`);
      } else {
        const { error } = await supabase.from("courts").insert(payload);
        if (error) throw error;
        setMensaje(`✅ Nueva Pista ${payload.name} agregada correctamente.`);
      }

      setModalCanchaOpen(false);
      await cargarDatos(); 
    } catch (err) {
      console.error(err);
      alert("Error guardando pista: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCancha(canchaId) {
    if (!confirm("🚨 ATENCIÓN: Borrar esta cancha eliminará su historial en el sistema.\n¿Estás completamente seguro de eliminarla?")) return;
    try {
      await supabase.from("courts").delete().eq("id", canchaId);
      setMensaje("🗑️ Pista eliminada.");
      await cargarDatos();
    } catch (err) {
      alert("Error eliminando pista. Puede que tenga reservas asociadas.");
    }
  }

  if (loading) {
    return <div className="p-10 text-center font-bold text-slate-500 animate-pulse">Cargando configuración de tu complejo...</div>;
  }

  const esOnboardingInicial = !club;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between md:items-end gap-4 ${
          esOnboardingInicial
            ? "bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white border-slate-800"
            : "bg-white border-slate-200"
        }`}>
          <div>
            <span className={`text-xs font-black uppercase tracking-widest ${esOnboardingInicial ? "text-[#00FF9D]" : "text-blue-600"}`}>
              {esOnboardingInicial ? "🚀 Onboarding B2B Obligatorio" : "Configuración B2B"}
            </span>
            <h1 className="text-2xl font-black mt-0.5">
              {esOnboardingInicial ? "Registra tu Complejo Deportivo" : "🏟️ Mi Complejo Deportivo"}
            </h1>
            <p className={`text-xs font-medium mt-1 ${esOnboardingInicial ? "text-slate-300" : "text-slate-500"}`}>
              Configura la ficha pública de tu club: deportes, amenidades, horarios y canchas registradas.
            </p>
          </div>

          {club && (
            <Link
              href={`/padel/clubes/${club.id}`}
              target="_blank"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors shrink-0"
            >
              👁️ Ver Ficha Pública →
            </Link>
          )}
        </div>

        {mensaje && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex justify-between items-center shadow-sm">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje("")}>✕</button>
          </div>
        )}

        <form onSubmit={guardarClub} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900">1. Información General del Complejo</h2>
            <p className="text-xs text-slate-400 font-bold">Esta información se mostrará a los jugadores en el directorio público y en la app.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Nombre del Complejo</label>
              <input
                type="text"
                required
                placeholder="Ej. Elite Pádel & Fútbol Center"
                value={formClub.name}
                onChange={(e) => setFormClub({ ...formClub, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Ciudad</label>
              <select
                value={formClub.city}
                onChange={(e) => setFormClub({ ...formClub, city: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="Barquisimeto">Barquisimeto</option>
                <option value="Cabudare">Cabudare</option>
                <option value="Caracas">Caracas</option>
                <option value="Valencia">Valencia</option>
                <option value="Maracaibo">Maracaibo</option>
                <option value="Otra">Otra</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Dirección Detallada</label>
              <input
                type="text"
                required
                placeholder="Ej. Av. Ribereña con C.C. Multimall, Barquisimeto"
                value={formClub.address}
                onChange={(e) => setFormClub({ ...formClub, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Teléfono de Contacto</label>
              <input
                type="tel"
                placeholder="Ej. +58 412-1234567"
                value={formClub.phone}
                onChange={(e) => setFormClub({ ...formClub, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">URL Foto Principal del Complejo</label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={formClub.image_url}
                onChange={(e) => setFormClub({ ...formClub, image_url: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Descripción del Club</label>
              <textarea
                rows={3}
                placeholder="Describe tu complejo, iluminación, servicios..."
                value={formClub.description}
                onChange={(e) => setFormClub({ ...formClub, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Deportes Disponibles en el Complejo</h3>
            <div className="flex flex-wrap gap-3">
              {DEPORTES_OPCIONES.map((dep) => {
                const checked = formClub.sports.includes(dep.id);
                return (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={() => toggleSport(dep.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black transition-all ${
                      checked
                        ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-md"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>{dep.icon}</span>
                    <span>{dep.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-colors"
          >
            {saving ? "Guardando..." : "💾 Guardar Información del Complejo"}
          </button>
        </form>

        {!esOnboardingInicial && club && (
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">2. Pistas y Canchas Registradas</h2>
                <p className="text-xs text-slate-400 font-bold">Configura el deporte, tipo y precios por bloque de cada pista.</p>
              </div>
              <button
                type="button"
                onClick={abrirModalNuevaCancha}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
              >
                + Añadir Pista
              </button>
            </div>

            {canchas.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl block mb-2">⚽🎾</span>
                <p className="text-xs font-bold text-slate-500">Aún no has registrado pistas en tu complejo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {canchas.map((c) => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-3 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{c.sport_type === "futbol" ? "⚽" : "🎾"}</span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white">
                            {c.sport_type === "futbol" ? "Fútbol" : "Pádel"}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-900 text-sm">{c.name}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {c.court_type} • {c.surface_type}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => abrirModalEditarCancha(c)} 
                        className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-xs transition-colors"
                        title="Editar cancha"
                      >
                        ✏️
                      </button>
                    </div>
                    
                    <div className="mt-2 bg-white p-2 rounded-xl border border-slate-100 shadow-xs flex flex-col gap-1 max-h-32 overflow-y-auto">
                      <p className="text-[8px] font-black text-slate-400 uppercase border-b border-slate-50 pb-1">Precios por Bloques</p>
                      {(c.pricing_blocks && c.pricing_blocks.length > 0) ? (
                        c.pricing_blocks.map((b, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px] font-bold py-0.5">
                            <span className="text-slate-500">{b.start_time} - {b.end_time}</span>
                            <span className="text-emerald-600 font-black">${b.price}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between items-center text-[10px] font-bold py-0.5">
                          <span className="text-slate-500">Precio Fijo</span>
                          <span className="text-emerald-600 font-black">${c.price_normal}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-200 pt-2 font-bold">
                      <span>Iluminación: {c.has_lighting ? "Sí 💡" : "No"}</span>
                      <button onClick={() => eliminarCancha(c.id)} className="text-rose-500 hover:underline">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {modalCanchaOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => setModalCanchaOpen(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingCanchaId ? "✏️ Editar Pista" : "Registrar Nueva Pista"}
              </h3>
              <button onClick={() => setModalCanchaOpen(false)} className="text-slate-400 font-bold hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={guardarCancha} className="space-y-3 text-xs font-bold text-slate-700">
              {/* SELECTOR DE DEPORTE PARA LA CANCHA */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Deporte Asignado</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "padel", label: "🎾 Pádel" },
                    { id: "futbol", label: "⚽ Fútbol" },
                  ].map((dep) => (
                    <button
                      key={dep.id}
                      type="button"
                      onClick={() => setFormCancha({ ...formCancha, sport_type: dep.id })}
                      className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase border transition-all ${
                        formCancha.sport_type === dep.id
                          ? "bg-slate-900 text-[#00FF9D] border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {dep.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nombre de la Pista</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cancha 1 / Pista Central"
                  value={formCancha.name}
                  onChange={(e) => setFormCancha({ ...formCancha, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Tipo</label>
                  <select
                    value={formCancha.court_type}
                    onChange={(e) => setFormCancha({ ...formCancha, court_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                  >
                    <option value="indoor">Indoor (Cubierta)</option>
                    <option value="outdoor">Outdoor (Descubierta)</option>
                    <option value="covered">Semi-cubierta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Superficie</label>
                  <select
                    value={formCancha.surface_type}
                    onChange={(e) => setFormCancha({ ...formCancha, surface_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                  >
                    <option value="Cristal">Cristal (Pádel)</option>
                    <option value="cesped_sintetico">Césped Sintético</option>
                    <option value="grama_natural">Grama Natural</option>
                    <option value="cemento">Cemento / Parquet</option>
                  </select>
                </div>
              </div>

              {/* BLOQUES DE PRECIO */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-black uppercase text-slate-400">Bloques de Precios ($ USD)</label>
                  <button 
                    type="button" 
                    onClick={agregarBloque} 
                    className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    + Añadir Bloque
                  </button>
                </div>
                
                <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                  {formCancha.pricing_blocks.map((bloque, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <div className="flex flex-col flex-1">
                        <label className="text-[8px] uppercase text-slate-400 mb-0.5">Desde</label>
                        <input 
                          type="time" 
                          required
                          value={bloque.start_time}
                          onChange={(e) => actualizarBloque(i, "start_time", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                        />
                      </div>
                      
                      <div className="flex flex-col flex-1">
                        <label className="text-[8px] uppercase text-slate-400 mb-0.5">Hasta</label>
                        <input 
                          type="time" 
                          required
                          value={bloque.end_time}
                          onChange={(e) => actualizarBloque(i, "end_time", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                        />
                      </div>
                      
                      <div className="flex flex-col flex-1">
                        <label className="text-[8px] uppercase text-emerald-600 mb-0.5">Precio</label>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2">
                          <span className="text-slate-400 text-xs font-black">$</span>
                          <input 
                            type="number" 
                            step="0.5"
                            required
                            min="0"
                            placeholder="0"
                            value={bloque.price}
                            onChange={(e) => actualizarBloque(i, "price", e.target.value)}
                            className="w-full p-1.5 text-xs font-black outline-none bg-transparent"
                          />
                        </div>
                      </div>
                      
                      <button 
                        type="button" 
                        onClick={() => eliminarBloque(i)} 
                        className="mt-3.5 w-6 h-6 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                        title="Eliminar bloque"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving || formCancha.pricing_blocks.length === 0} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black uppercase tracking-wider rounded-2xl shadow-md mt-2 transition-colors">
                {saving ? "Guardando..." : (editingCanchaId ? "✓ Actualizar Pista" : "Guardar Pista")}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}