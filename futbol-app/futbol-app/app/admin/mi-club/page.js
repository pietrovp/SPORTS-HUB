"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

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
    sports: ["padel"],
    amenities: ["wifi", "free_parking", "changing_room"],
    opening_hours_text: {
      lunes_viernes: "06:00 - 23:00",
      sabado: "07:00 - 23:00",
      domingo: "07:00 - 23:00",
      feriados: "07:00 - 23:00",
    },
  });

  const [modalCanchaOpen, setModalCanchaOpen] = useState(false);
  const [formCancha, setFormCancha] = useState({
    name: "Pista 1",
    court_number: 1,
    surface_type: "Cristal",
    court_type: "indoor",
    has_lighting: true,
    price_credits: 16,
  });

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
            : ["padel"];

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
            .from("padel_courts")
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
        window.location.href = "/admin/recepcion";
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

  async function agregarCancha(e) {
    e.preventDefault();
    if (!club) {
      alert("Debes guardar primero la información básica del complejo.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        club_id: club.id,
        name: formCancha.name.trim(),
        court_number: Number(formCancha.court_number) || canchas.length + 1,
        surface_type: formCancha.surface_type,
        court_type: formCancha.court_type,
        has_lighting: formCancha.has_lighting,
        price_credits: parseFloat(formCancha.price_credits) || 16,
        is_active: true,
      };

      const { error } = await supabase.from("padel_courts").insert(payload);
      if (error) throw error;

      setModalCanchaOpen(false);
      setFormCancha({
        name: `Pista ${canchas.length + 2}`,
        court_number: canchas.length + 2,
        surface_type: "Cristal",
        court_type: "indoor",
        has_lighting: true,
        price_credits: 16,
      });

      await cargarDatos();
    } catch (err) {
      console.error(err);
      alert("Error agregando pista: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCancha(canchaId) {
    if (!confirm("¿Eliminar esta pista/cancha del complejo?")) return;
    try {
      await supabase.from("padel_courts").delete().eq("id", canchaId);
      await cargarDatos();
    } catch (err) {
      alert("Error eliminando pista.");
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
              {esOnboardingInicial
                ? "Bienvenido al Sistema POS. Registra los datos de tu club, deportes, horarios y pistas para activar el punto de venta."
                : "Configura la ficha pública de tu club: amenidades, horarios por día, fotos y pistas registradas."}
            </p>
          </div>

          {club && (
            <Link
              href={`/padel/clubes/${club.id}`}
              target="_blank"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors shrink-0"
            >
              👁️ Ver Vista Pública →
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
                placeholder="Describe tu complejo, iluminación, servicios de entrenamiento, ambiente..."
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

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Amenidades / Servicios Disponibles</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {AMENIDADES_OPCIONES.map((amenity) => {
                const checked = formClub.amenities.includes(amenity.id);
                return (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => toggleAmenity(amenity.id)}
                    className={`flex items-center gap-2 p-3 rounded-2xl border text-left text-xs font-bold transition-all ${
                      checked
                        ? "bg-blue-50 border-blue-400 text-blue-900 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-lg">{amenity.icon}</span>
                    <span className="truncate">{amenity.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Horarios de Atención y Operación</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Lunes a Viernes</label>
                <input
                  type="text"
                  placeholder="06:00 - 23:00"
                  value={formClub.opening_hours_text?.lunes_viernes || "06:00 - 23:00"}
                  onChange={(e) => setFormClub({
                    ...formClub,
                    opening_hours_text: { ...formClub.opening_hours_text, lunes_viernes: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Sábados</label>
                <input
                  type="text"
                  placeholder="07:00 - 23:00"
                  value={formClub.opening_hours_text?.sabado || "07:00 - 23:00"}
                  onChange={(e) => setFormClub({
                    ...formClub,
                    opening_hours_text: { ...formClub.opening_hours_text, sabado: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Domingos</label>
                <input
                  type="text"
                  placeholder="07:00 - 23:00"
                  value={formClub.opening_hours_text?.domingo || "07:00 - 23:00"}
                  onChange={(e) => setFormClub({
                    ...formClub,
                    opening_hours_text: { ...formClub.opening_hours_text, domingo: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Feriados</label>
                <input
                  type="text"
                  placeholder="07:00 - 23:00"
                  value={formClub.opening_hours_text?.feriados || "07:00 - 23:00"}
                  onChange={(e) => setFormClub({
                    ...formClub,
                    opening_hours_text: { ...formClub.opening_hours_text, feriados: e.target.value }
                  })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                />
              </div>
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

        {club && (
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">2. Pistas y Canchas Registradas</h2>
                <p className="text-xs text-slate-400 font-bold">Pistas activas para reserva del público y agendamiento POS.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalCanchaOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm"
              >
                + Añadir Pista
              </button>
            </div>

            {canchas.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl block mb-2">🎾</span>
                <p className="text-xs font-bold text-slate-500">Aún no has registrado pistas en tu complejo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {canchas.map((c) => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{c.name}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {c.court_type} • {c.surface_type}
                        </span>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        ${c.price_credits || 16} cr
                      </span>
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
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Registrar Nueva Pista</h3>
              <button onClick={() => setModalCanchaOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={agregarCancha} className="space-y-3 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Nombre de la Pista</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pista Central / Pista 1"
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
                    <option value="Cristal">Cristal</option>
                    <option value="cesped_sintetico">Césped Sintético</option>
                    <option value="moqueta">Moqueta</option>
                    <option value="hormigon_poroso">Hormigón Poroso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Precio Base en Créditos ($)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formCancha.price_credits}
                  onChange={(e) => setFormCancha({ ...formCancha, price_credits: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                />
              </div>

              <button type="submit" disabled={saving} className="w-full py-3.5 bg-slate-900 text-[#00FF9D] font-black uppercase tracking-wider rounded-2xl shadow-md">
                {saving ? "Guardando..." : "Guardar Pista"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}