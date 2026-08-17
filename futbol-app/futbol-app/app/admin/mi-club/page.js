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
  const [profesores, setProfesores] = useState([]);

  // Formulario Información del Complejo + Tarifas Oficiales de Clases
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
    // TARIFAS DE CLASES ESTABLECIDAS POR ESTE COMPLEJO (USD por alumno/hora)
    class_price_1_pax: 25,
    class_price_2_pax: 18,
    class_price_3_pax: 14,
    class_price_4_pax: 10,
    has_coaching_service: true,
  });

  // Modal Cancha / Pista
  const [modalCanchaOpen, setModalCanchaOpen] = useState(false);
  const [editingCanchaId, setEditingCanchaId] = useState(null);

  const defaultCanchaForm = {
    name: "Pista 1",
    court_number: 1,
    sport_type: "padel",
    capacity: 4,
    surface_type: "Cristal",
    court_type: "indoor",
    has_lighting: true,
    pricing_blocks: [
      { start_time: "07:00", end_time: "12:00", price_60: 10, price_90: 14, price_120: 18 },
      { start_time: "12:00", end_time: "17:00", price_60: 15, price_90: 20, price_120: 25 },
      { start_time: "17:00", end_time: "23:00", price_60: 20, price_90: 27, price_120: 34 },
    ],
  };
  const [formCancha, setFormCancha] = useState(defaultCanchaForm);

  // Modal Profesor / Coach
  const [modalProfesorOpen, setModalProfesorOpen] = useState(false);
  const [editingProfesorId, setEditingProfesorId] = useState(null);
  const defaultProfesorForm = {
    name: "",
    phone: "",
    photo_url: "",
    bio: "",
    specialty: "Clases de Pádel (Iniciación y Avanzado)",
    is_active: true,
  };
  const [formProfesor, setFormProfesor] = useState(defaultProfesorForm);

  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      setMensaje(null);

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

      let targetClubId = profile ? profile.club_id : null;
      if (!targetClubId) {
        const { data: clubCreado } = await supabase
          .from("clubs")
          .select("id")
          .eq("created_by", authUser.id)
          .maybeSingle();
        targetClubId = clubCreado ? clubCreado.id : null;
      }

      if (targetClubId) {
        const { data: clubData } = await supabase
          .from("clubs")
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
            open_time: clubData.open_time ? clubData.open_time.slice(0, 5) : "07:00",
            close_time: clubData.close_time ? clubData.close_time.slice(0, 5) : "23:00",
            peak_start_time: clubData.peak_start_time ? clubData.peak_start_time.slice(0, 5) : "17:00",
            peak_end_time: clubData.peak_end_time ? clubData.peak_end_time.slice(0, 5) : "22:00",
            sports: deportesCargados,
            amenities: amenidadesCargadas,
            opening_hours_text: clubData.opening_hours_text || {
              lunes_viernes: "06:00 - 23:00",
              sabado: "07:00 - 23:00",
              domingo: "07:00 - 23:00",
              feriados: "07:00 - 23:00",
            },
            class_price_1_pax: clubData.class_price_1_pax !== null && clubData.class_price_1_pax !== undefined ? clubData.class_price_1_pax : 25,
            class_price_2_pax: clubData.class_price_2_pax !== null && clubData.class_price_2_pax !== undefined ? clubData.class_price_2_pax : 18,
            class_price_3_pax: clubData.class_price_3_pax !== null && clubData.class_price_3_pax !== undefined ? clubData.class_price_3_pax : 14,
            class_price_4_pax: clubData.class_price_4_pax !== null && clubData.class_price_4_pax !== undefined ? clubData.class_price_4_pax : 10,
            has_coaching_service: clubData.has_coaching_service !== false,
          });

          // Cargar Canchas
          const { data: courtsData } = await supabase
            .from("courts")
            .select("*")
            .eq("club_id", clubData.id)
            .order("court_number", { ascending: true });
          setCanchas(courtsData || []);

          // Cargar Profesores
          const { data: coachesData } = await supabase
            .from("club_coaches")
            .select("*")
            .eq("club_id", clubData.id)
            .order("name", { ascending: true });
          setProfesores(coachesData || []);
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
        amenities: exists
          ? prev.amenities.filter((a) => a !== id)
          : [...prev.amenities, id],
      };
    });
  }

  function toggleSport(id) {
    setFormClub((prev) => {
      const exists = prev.sports.includes(id);
      if (exists && prev.sports.length === 1) return prev;
      return {
        ...prev,
        sports: exists
          ? prev.sports.filter((s) => s !== id)
          : [...prev.sports, id],
      };
    });
  }

  async function guardarClub(e) {
    e.preventDefault();
    if (!user) return;
    try {
      setSaving(true);
      setMensaje(null);

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
        class_price_1_pax: parseFloat(formClub.class_price_1_pax) || 25,
        class_price_2_pax: parseFloat(formClub.class_price_2_pax) || 18,
        class_price_3_pax: parseFloat(formClub.class_price_3_pax) || 14,
        class_price_4_pax: parseFloat(formClub.class_price_4_pax) || 10,
        has_coaching_service: formClub.has_coaching_service,
        is_active: true,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      let clubGuardado = null;
      const esNuevo = !club;

      if (club) {
        const { data, error } = await supabase
          .from("clubs")
          .update(payload)
          .eq("id", club.id)
          .select()
          .single();
        if (error) throw error;
        clubGuardado = data;
      } else {
        const { data, error } = await supabase
          .from("clubs")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        clubGuardado = data;

        await supabase
          .from("profiles")
          .update({ club_id: clubGuardado.id, is_gerente: true })
          .eq("id", user.id);
      }

      setClub(clubGuardado);
      setMensaje("¡Configuración y Tarifas del Complejo guardadas exitosamente!");

      if (esNuevo) {
        router.push("/admin/recepcion");
      } else {
        await cargarDatos();
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar el complejo: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  // --- MÉTODOS CANCHAS ---
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
    const bloquesNormalizados =
      Array.isArray(cancha.pricing_blocks) && cancha.pricing_blocks.length > 0
        ? cancha.pricing_blocks.map((b) => ({
            start_time: b.start_time || "07:00",
            end_time: b.end_time || "12:00",
            price_60: parseFloat(b.price_60 ?? b.price ?? 10),
            price_90: parseFloat(b.price_90 ?? (b.price ? b.price * 1.3 : 14)),
            price_120: parseFloat(b.price_120 ?? (b.price ? b.price * 1.8 : 18)),
          }))
        : defaultCanchaForm.pricing_blocks;

    setFormCancha({
      name: cancha.name,
      court_number: cancha.court_number,
      sport_type: cancha.sport_type || "padel",
      capacity: cancha.capacity || (cancha.sport_type === "futbol" ? 10 : 4),
      surface_type: cancha.surface_type || "Cristal",
      court_type: cancha.court_type || "outdoor",
      has_lighting: cancha.has_lighting ?? true,
      pricing_blocks: bloquesNormalizados,
    });
    setModalCanchaOpen(true);
  }

  function agregarBloque() {
    setFormCancha((prev) => ({
      ...prev,
      pricing_blocks: [
        ...prev.pricing_blocks,
        { start_time: "17:00", end_time: "23:00", price_60: 15, price_90: 21, price_120: 27 },
      ],
    }));
  }

  function actualizarBloque(index, campo, valor) {
    const nuevosBloques = [...formCancha.pricing_blocks];
    nuevosBloques[index] = {
      ...nuevosBloques[index],
      [campo]: campo.startsWith("price") ? parseFloat(valor) || 0 : valor,
    };
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
      alert("Debes agregar al menos una franja horaria de precios.");
      return;
    }

    try {
      setSaving(true);
      const capFinal = formCancha.sport_type === "futbol" ? Number(formCancha.capacity) || 10 : 4;
      const primerBloque = formCancha.pricing_blocks[0];

      const payload = {
        club_id: club.id,
        name: formCancha.name.trim(),
        court_number: Number(formCancha.court_number) || canchas.length + 1,
        sport_type: formCancha.sport_type,
        capacity: capFinal,
        surface_type: formCancha.surface_type,
        court_type: formCancha.court_type,
        has_lighting: formCancha.has_lighting,
        pricing_blocks: formCancha.pricing_blocks,
        price_normal: primerBloque.price_60 || 10,
        price_peak: formCancha.pricing_blocks[formCancha.pricing_blocks.length - 1].price_60 || 15,
        price_credits: primerBloque.price_60 || 10,
        is_active: true,
      };

      if (editingCanchaId) {
        const { error } = await supabase.from("courts").update(payload).eq("id", editingCanchaId);
        if (error) throw error;
        setMensaje(`Cancha/Pista "${payload.name}" actualizada correctamente.`);
      } else {
        const { error } = await supabase.from("courts").insert(payload);
        if (error) throw error;
        setMensaje(`Nueva Cancha/Pista "${payload.name}" agregada correctamente.`);
      }

      setModalCanchaOpen(false);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      alert("Error guardando cancha: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCancha(canchaId) {
    if (!confirm("¿Estás completamente seguro de eliminar esta pista?")) return;
    try {
      await supabase.from("courts").delete().eq("id", canchaId);
      setMensaje("Cancha/Pista eliminada.");
      await cargarDatos();
    } catch (err) {
      alert("Error eliminando pista. Puede que tenga reservas asociadas.");
    }
  }

  // --- MÉTODOS PROFESORES (VINCULADOS AL COMPLEJO) ---
  function abrirModalNuevoProfesor() {
    setEditingProfesorId(null);
    setFormProfesor(defaultProfesorForm);
    setModalProfesorOpen(true);
  }

  function abrirModalEditarProfesor(profe) {
    setEditingProfesorId(profe.id);
    setFormProfesor({
      name: profe.name || "",
      phone: profe.phone || "",
      photo_url: profe.photo_url || "",
      bio: profe.bio || "",
      specialty: profe.specialty || "Clases de Pádel (Iniciación y Avanzado)",
      is_active: profe.is_active !== false,
    });
    setModalProfesorOpen(true);
  }

  async function guardarProfesor(e) {
    e.preventDefault();
    if (!club) {
      alert("Debes registrar primero la información del complejo.");
      return;
    }
    if (!formProfesor.name.trim()) {
      alert("Por favor ingresa el nombre del profesor.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        club_id: club.id,
        name: formProfesor.name.trim(),
        phone: formProfesor.phone.trim() || null,
        photo_url: formProfesor.photo_url.trim() || null,
        bio: formProfesor.bio.trim() || null,
        specialty: formProfesor.specialty.trim() || "Clases de Pádel",
        is_active: formProfesor.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingProfesorId) {
        const { error } = await supabase
          .from("club_coaches")
          .update(payload)
          .eq("id", editingProfesorId);
        if (error) throw error;
        setMensaje(`Profesor "${payload.name}" actualizado correctamente.`);
      } else {
        const { error } = await supabase.from("club_coaches").insert(payload);
        if (error) throw error;
        setMensaje(`Profesor "${payload.name}" registrado en el complejo.`);
      }

      setModalProfesorOpen(false);
      await cargarDatos();
    } catch (err) {
      console.error(err);
      alert("Error al guardar profesor: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function eliminarProfesor(profesorId) {
    if (!confirm("¿Deseas eliminar a este profesor del complejo?")) return;
    try {
      await supabase.from("club_coaches").delete().eq("id", profesorId);
      setMensaje("Profesor eliminado.");
      await cargarDatos();
    } catch (err) {
      alert("Error eliminando profesor. Puede que tenga reservas asociadas.");
    }
  }

  if (loading) {
    return (
      <div className="p-10 text-center font-bold text-slate-500 animate-pulse">
        Cargando configuración de tu complejo...
      </div>
    );
  }

  const esOnboardingInicial = !club;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* HEADER */}
        <div
          className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between md:items-end gap-4 ${
            esOnboardingInicial
              ? "bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          <div>
            <span
              className={`text-xs font-black uppercase tracking-widest ${
                esOnboardingInicial ? "text-[#00FF9D]" : "text-blue-600"
              }`}
            >
              {esOnboardingInicial ? "Onboarding B2B Obligatorio" : "Configuración B2B"}
            </span>
            <h1 className="text-2xl font-black mt-0.5">
              {esOnboardingInicial ? "Registra tu Complejo Deportivo" : "Mi Complejo Deportivo"}
            </h1>
            <p className={`text-xs font-medium mt-1 ${esOnboardingInicial ? "text-slate-300" : "text-slate-500"}`}>
              Configura la ficha pública de tu club: tarifas de pistas, precios de clases por alumno y tu staff de entrenadores.
            </p>
          </div>
          {club && (
            <Link
              href={`/padel/clubes/${club.id}`}
              target="_blank"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors shrink-0"
            >
              Ver Ficha Pública ↗
            </Link>
          )}
        </div>

        {/* MENSAJE DE ÉXITO */}
        {mensaje && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex justify-between items-center shadow-sm">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje(null)}>✕</button>
          </div>
        )}

        {/* 1. INFORMACIÓN GENERAL Y TARIFAS DE CLASES DEL COMPLEJO */}
        <form onSubmit={guardarClub} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900">1. Información General del Complejo</h2>
            <p className="text-xs text-slate-400 font-bold">
              Esta información y tus tarifas se mostrarán a todos los jugadores en el directorio público.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">Nombre del Complejo</label>
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
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">Ciudad</label>
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

            <div>
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">Duración Base de Turnos</label>
              <select
                value={formClub.slot_duration_minutes}
                onChange={(e) => setFormClub({ ...formClub, slot_duration_minutes: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              >
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos (1 hora)</option>
                <option value={90}>90 minutos (1.5 horas)</option>
                <option value={120}>120 minutos (2 horas)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">Dirección Detallada</label>
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
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">Teléfono de Contacto</label>
              <input
                type="tel"
                placeholder="Ej. +58 412-1234567"
                value={formClub.phone}
                onChange={(e) => setFormClub({ ...formClub, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">URL Foto Principal</label>
              <input
                type="url"
                placeholder="https://images.unsplash.com/..."
                value={formClub.image_url}
                onChange={(e) => setFormClub({ ...formClub, image_url: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-10px font-black uppercase text-slate-400 block mb-1">Descripción</label>
              <textarea
                rows={3}
                placeholder="Describe tu complejo, iluminación, servicios..."
                value={formClub.description}
                onChange={(e) => setFormClub({ ...formClub, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* TARIFAS DE CLASES OFICIALES DEL COMPLEJO */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <span>🎓</span> Tarifas de Clases de Pádel en tu Complejo
                </h3>
                <p className="text-10px font-bold text-slate-400 mt-0.5">
                  Establece los precios de tu club por alumno según el tamaño del grupo (1 a 4 personas por hora).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
              <div>
                <label className="block text-9px font-black uppercase text-emerald-900 mb-1">1 Alumno (Particular)</label>
                <div className="flex items-center bg-white border border-emerald-300 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-xs font-black text-slate-400 mr-1">$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={formClub.class_price_1_pax}
                    onChange={(e) => setFormClub({ ...formClub, class_price_1_pax: e.target.value })}
                    className="w-full text-xs font-black text-slate-900 outline-none"
                  />
                  <span className="text-8px font-bold text-slate-400 uppercase">/hr</span>
                </div>
              </div>

              <div>
                <label className="block text-9px font-black uppercase text-emerald-900 mb-1">2 Alumnos (Por alumno)</label>
                <div className="flex items-center bg-white border border-emerald-300 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-xs font-black text-slate-400 mr-1">$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={formClub.class_price_2_pax}
                    onChange={(e) => setFormClub({ ...formClub, class_price_2_pax: e.target.value })}
                    className="w-full text-xs font-black text-slate-900 outline-none"
                  />
                  <span className="text-8px font-bold text-slate-400 uppercase">c/u</span>
                </div>
              </div>

              <div>
                <label className="block text-9px font-black uppercase text-emerald-900 mb-1">3 Alumnos (Por alumno)</label>
                <div className="flex items-center bg-white border border-emerald-300 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-xs font-black text-slate-400 mr-1">$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={formClub.class_price_3_pax}
                    onChange={(e) => setFormClub({ ...formClub, class_price_3_pax: e.target.value })}
                    className="w-full text-xs font-black text-slate-900 outline-none"
                  />
                  <span className="text-8px font-bold text-slate-400 uppercase">c/u</span>
                </div>
              </div>

              <div>
                <label className="block text-9px font-black uppercase text-emerald-900 mb-1">4 Alumnos (Por alumno)</label>
                <div className="flex items-center bg-white border border-emerald-300 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-xs font-black text-slate-400 mr-1">$</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={formClub.class_price_4_pax}
                    onChange={(e) => setFormClub({ ...formClub, class_price_4_pax: e.target.value })}
                    className="w-full text-xs font-black text-slate-900 outline-none"
                  />
                  <span className="text-8px font-bold text-slate-400 uppercase">c/u</span>
                </div>
              </div>
            </div>
          </div>

          {/* DEPORTES */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Deportes Disponibles</h3>
            <div className="flex flex-wrap gap-3">
              {DEPORTES_OPCIONES.map((dep) => {
                const checked = formClub.sports.includes(dep.id);
                return (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={() => toggleSport(dep.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
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

          {/* AMENIDADES */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Amenidades y Servicios</h3>
            <div className="flex flex-wrap gap-2">
              {AMENIDADES_OPCIONES.map((am) => {
                const checked = formClub.amenities.includes(am.id);
                return (
                  <button
                    key={am.id}
                    type="button"
                    onClick={() => toggleAmenity(am.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      checked
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>{am.icon}</span>
                    <span>{am.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-colors cursor-pointer"
          >
            {saving ? "Guardando..." : "Guardar Información y Tarifas del Complejo"}
          </button>
        </form>

        {/* 2. GESTIÓN DE PISTAS Y CANCHAS */}
        {!esOnboardingInicial && club && (
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">2. Pistas y Canchas Registradas</h2>
                <p className="text-xs text-slate-400 font-bold">Configura el deporte, capacidad y tarifas por franja horaria.</p>
              </div>
              <button
                type="button"
                onClick={abrirModalNuevaCancha}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm cursor-pointer"
              >
                + Añadir Pista
              </button>
            </div>

            {canchas.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl block mb-2">🏟️</span>
                <p className="text-xs font-bold text-slate-500">Aún no has registrado pistas en tu complejo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {canchas.map((c) => {
                  const cap = c.capacity || (c.sport_type === "futbol" ? 10 : 4);
                  const vs = Math.floor(cap / 2);
                  return (
                    <div
                      key={c.id}
                      className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-3 relative overflow-hidden shadow-2xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm">{c.sport_type === "futbol" ? "⚽" : "🎾"}</span>
                            <span className="text-9px font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white">
                              {c.sport_type === "futbol" ? "Fútbol" : "Pádel"}
                            </span>
                          </div>
                          <h4 className="font-black text-slate-900 text-sm">{c.name}</h4>
                          <span className="text-10px font-bold text-emerald-600 uppercase block mt-0.5">
                            {c.sport_type === "futbol" ? `Fútbol ${vs} vs ${vs}` : `${cap} Jugadores`} · {c.court_type} · {c.surface_type}
                          </span>
                        </div>
                        <button
                          onClick={() => abrirModalEditarCancha(c)}
                          className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                          title="Editar cancha"
                        >
                          ✏️
                        </button>
                      </div>

                      <div className="mt-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col gap-1 max-h-40 overflow-y-auto">
                        <p className="text-8px font-black text-slate-400 uppercase border-b border-slate-100 pb-1">
                          Tarifas por Franja (1h / 1.5h / 2h)
                        </p>
                        {c.pricing_blocks && c.pricing_blocks.length > 0 ? (
                          c.pricing_blocks.map((b, i) => (
                            <div key={i} className="border-b border-slate-100 last:border-b-0 py-1 space-y-0.5">
                              <span className="text-slate-800 text-10px font-black block">{b.start_time} a {b.end_time}</span>
                              <div className="flex justify-between items-center text-9px font-bold text-slate-500">
                                <span>1h: <strong className="text-emerald-600">${parseFloat(b.price_60 ?? b.price ?? 10).toFixed(2)}</strong></span>
                                <span>1.5h: <strong className="text-emerald-600">${parseFloat(b.price_90 ?? (b.price ? b.price * 1.3 : 14)).toFixed(2)}</strong></span>
                                <span>2h: <strong className="text-emerald-600">${parseFloat(b.price_120 ?? (b.price ? b.price * 1.8 : 18)).toFixed(2)}</strong></span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between items-center text-10px font-bold py-0.5">
                            <span className="text-slate-500">Precio Fijo:</span>
                            <span className="text-emerald-600 font-black">${parseFloat(c.price_normal || 10).toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center text-10px text-slate-500 border-t border-slate-200 pt-2 font-bold">
                        <span>Iluminación: {c.has_lighting ? "Sí" : "No"}</span>
                        <button onClick={() => eliminarCancha(c.id)} className="text-rose-500 hover:underline cursor-pointer">
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. STAFF DE PROFESORES DEL COMPLEJO */}
        {!esOnboardingInicial && club && (
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">3. Profesores del Complejo</h2>
                <p className="text-xs text-slate-400 font-bold">
                  Registra al staff de instructores disponibles en tu club para impartir las clases.
                </p>
              </div>
              <button
                type="button"
                onClick={abrirModalNuevoProfesor}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-sm cursor-pointer"
              >
                + Añadir Profesor
              </button>
            </div>

            {profesores.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                <span className="text-3xl block mb-2">👨‍🏫</span>
                <p className="text-xs font-bold text-slate-500">No hay profesores registrados en este complejo.</p>
                <p className="text-10px text-slate-400 mt-1">Añade a los instructores disponibles para que los jugadores puedan agendar sus clases.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {profesores.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between space-y-3 relative overflow-hidden shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0 flex items-center justify-center">
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">👤</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-slate-900 text-sm truncate">{p.name}</h4>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${p.is_active ? "bg-emerald-500" : "bg-rose-400"}`} />
                        </div>
                        <p className="text-10px font-bold text-slate-400 truncate">{p.specialty || "Instructor de Pádel"}</p>
                        {p.phone && <p className="text-9px font-bold text-slate-500 mt-0.5">📞 {p.phone}</p>}
                      </div>
                      <button
                        onClick={() => abrirModalEditarProfesor(p)}
                        className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                        title="Editar profesor"
                      >
                        ✏️
                      </button>
                    </div>

                    {p.bio && (
                      <p className="text-10px text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200 line-clamp-2 italic">
                        "{p.bio}"
                      </p>
                    )}

                    <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2 font-bold">
                      <span className="text-9px text-slate-400 uppercase">Tarifas del Complejo</span>
                      <button onClick={() => eliminarProfesor(p.id)} className="text-rose-500 hover:underline cursor-pointer text-10px">
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

      {/* MODAL CONFIGURACIÓN CANCHA */}
      {modalCanchaOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => setModalCanchaOpen(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingCanchaId ? "Editar Cancha / Pista" : "Registrar Nueva Cancha"}
              </h3>
              <button onClick={() => setModalCanchaOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={guardarCancha} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-10px font-black uppercase text-slate-400 mb-1">Nombre de la Pista</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pista 1 (Panorámica)"
                  value={formCancha.name}
                  onChange={(e) => setFormCancha({ ...formCancha, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-10px font-black uppercase text-slate-400 mb-1">Tipo</label>
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
                  <label className="block text-10px font-black uppercase text-slate-400 mb-1">Superficie</label>
                  <select
                    value={formCancha.surface_type}
                    onChange={(e) => setFormCancha({ ...formCancha, surface_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none"
                  >
                    <option value="Cristal">Cristal Pádel</option>
                    <option value="cesped_sintetico">Césped Sintético</option>
                    <option value="cemento">Cemento / Parquet</option>
                  </select>
                </div>
              </div>

              {/* FRANJAS HORARIAS */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <label className="block text-10px font-black uppercase text-slate-800">Franjas y Tarifas USD</label>
                  <button type="button" onClick={agregarBloque} className="text-10px font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg">
                    + Añadir Franja
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto pr-1 space-y-3">
                  {formCancha.pricing_blocks.map((bloque, i) => (
                    <div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            required
                            value={bloque.start_time}
                            onChange={(e) => actualizarBloque(i, "start_time", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                          />
                          <span>a</span>
                          <input
                            type="time"
                            required
                            value={bloque.end_time}
                            onChange={(e) => actualizarBloque(i, "end_time", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-bold outline-none"
                          />
                        </div>
                        {formCancha.pricing_blocks.length > 1 && (
                          <button type="button" onClick={() => eliminarBloque(i)} className="text-rose-500 hover:bg-rose-50 p-1 rounded-md">✕</button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-8px font-black uppercase text-emerald-700">60 Min (1h)</label>
                          <input
                            type="number"
                            step="0.5"
                            required
                            min="0"
                            value={bloque.price_60}
                            onChange={(e) => actualizarBloque(i, "price_60", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-black outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-8px font-black uppercase text-emerald-700">90 Min (1.5h)</label>
                          <input
                            type="number"
                            step="0.5"
                            required
                            min="0"
                            value={bloque.price_90}
                            onChange={(e) => actualizarBloque(i, "price_90", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-black outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-8px font-black uppercase text-emerald-700">120 Min (2h)</label>
                          <input
                            type="number"
                            step="0.5"
                            required
                            min="0"
                            value={bloque.price_120}
                            onChange={(e) => actualizarBloque(i, "price_120", e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-black outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black uppercase tracking-wider rounded-2xl shadow-md cursor-pointer"
              >
                {saving ? "Guardando..." : editingCanchaId ? "Actualizar Pista" : "Guardar Pista"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIGURACIÓN PROFESOR */}
      {modalProfesorOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => setModalProfesorOpen(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingProfesorId ? "Editar Profesor" : "Registrar Profesor del Complejo"}
              </h3>
              <button onClick={() => setModalProfesorOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={guardarProfesor} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-10px font-black uppercase text-slate-400 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Carlos Mendoza"
                  value={formProfesor.name}
                  onChange={(e) => setFormProfesor({ ...formProfesor, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-10px font-black uppercase text-slate-400 mb-1">Teléfono</label>
                <input
                  type="tel"
                  placeholder="Ej. +58 412-1234567"
                  value={formProfesor.phone}
                  onChange={(e) => setFormProfesor({ ...formProfesor, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-10px font-black uppercase text-slate-400 mb-1">Especialidad / Enfoque</label>
                <input
                  type="text"
                  placeholder="Ej. Clases Infantiles, Iniciación, Avanzado / Táctica..."
                  value={formProfesor.specialty}
                  onChange={(e) => setFormProfesor({ ...formProfesor, specialty: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-10px font-black uppercase text-slate-400 mb-1">URL Foto de Perfil</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={formProfesor.photo_url}
                  onChange={(e) => setFormProfesor({ ...formProfesor, photo_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-10px font-black uppercase text-slate-400 mb-1">Biografía / Resumen de Experiencia</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Entrenador certificado con 5 años de trayectoria dictando clínicas..."
                  value={formProfesor.bio}
                  onChange={(e) => setFormProfesor({ ...formProfesor, bio: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="profe_activo"
                  checked={formProfesor.is_active}
                  onChange={(e) => setFormProfesor({ ...formProfesor, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="profe_activo" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Profesor Activo (disponible para impartir clases)
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-[#00FF9D] font-black uppercase tracking-wider rounded-2xl shadow-md cursor-pointer transition-all"
              >
                {saving ? "Guardando..." : editingProfesorId ? "Actualizar Profesor" : "Registrar Profesor"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}