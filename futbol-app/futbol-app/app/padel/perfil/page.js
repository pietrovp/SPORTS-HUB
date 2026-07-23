"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import PadelStatsCard from "../../../components/padel/PadelStatsCard";
import Link from "next/link";

const NIVELES = ["Iniciación", "Intermedio", "Avanzado", "Competición"];
const POSICIONES = [
  { value: "Revés", label: "Revés" },
  { value: "Drive", label: "Drive" },
  { value: "Ambos", label: "Ambos" },
];
const HORARIOS = ["Mañana", "Tarde", "Noche", "Cualquiera"];
const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
  "Cualquiera",
];
const TIPOS_PARTIDO = ["Casual", "Competitivo", "Cualquiera"];

export default function PerfilPadel() {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(false);

  const [nivel, setNivel] = useState("Intermedio");
  const [posicion, setPosicion] = useState("Drive");
  const [manoHabil, setManoHabil] = useState("Derecha");
  const [horario, setHorario] = useState("Cualquiera");
  const [dia, setDia] = useState("Cualquiera");
  const [tipoPartido, setTipoPartido] = useState("Cualquiera");

  useEffect(() => {
    async function cargar() {
      try {
        if (!supabase) {
          setErrorCarga("Supabase no está disponible.");
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setUsuario(null);
          return;
        }

        setUsuario(user);

        const [{ data: cuentaData }, { data: perfilData, error: perfilError }] = await Promise.all([
          supabase
            .from("profiles")
            .select("nombre, apellido, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("padel_profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (perfilError) {
          setErrorCarga(perfilError.message || "No se pudo cargar el perfil de pádel.");
          return;
        }

        setCuenta(cuentaData || null);
        setPerfil(perfilData || null);

        if (perfilData) {
          setNivel(perfilData.nivel || "Intermedio");
          setPosicion(perfilData.posicion_preferida || perfilData.posicion || "Drive");
          setManoHabil(perfilData.mano_habil || "Derecha");
          setHorario(perfilData.horario_preferido || "Cualquiera");
          setDia(perfilData.dia_preferido || "Cualquiera");
          setTipoPartido(perfilData.tipo_partido_preferido || "Cualquiera");
        }
      } catch (err) {
        setErrorCarga("Ocurrió un error cargando el perfil.");
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, []);

  async function crearPerfil() {
    if (!supabase || !usuario) return;

    setCreando(true);
    setErrorCarga("");

    const payload = {
      id: usuario.id,
      nivel,
      posicion,
      posicion_preferida: posicion,
      mano_habil: manoHabil,
      horario_preferido: horario,
      dia_preferido: dia,
      tipo_partido_preferido: tipoPartido,
    };

    const { data, error } = await supabase
      .from("padel_profiles")
      .insert(payload)
      .select()
      .single();

    setCreando(false);

    if (error) {
      setErrorCarga(error.message || "No se pudo crear el perfil de pádel.");
      return;
    }

    setPerfil(data);
    setEditando(false);
  }

  async function guardarPreferencias() {
    if (!supabase || !usuario) return;

    setGuardando(true);
    setErrorCarga("");

    const payload = {
      nivel,
      posicion,
      posicion_preferida: posicion,
      mano_habil: manoHabil,
      horario_preferido: horario,
      dia_preferido: dia,
      tipo_partido_preferido: tipoPartido,
    };

    const { data, error } = await supabase
      .from("padel_profiles")
      .update(payload)
      .eq("id", usuario.id)
      .select()
      .single();

    setGuardando(false);

    if (error) {
      setErrorCarga(error.message || "No se pudieron guardar las preferencias.");
      return;
    }

    setPerfil(data);
    setEditando(false);
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-4xl">🎾</div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <div className="text-6xl">🔐</div>
        <h1 className="text-2xl font-bold text-gray-800">Accede a tu perfil de pádel</h1>
        <p className="text-gray-500 text-center max-w-sm">
          Inicia sesión con tu cuenta para ver o crear tu perfil de pádel.
        </p>
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (errorCarga && !perfil) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
        {errorCarga}
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-6 py-8">
        <div className="text-center">
          <span className="text-5xl">🎾</span>
          <h1 className="text-2xl font-black text-gray-900 mt-3">Crea tu perfil de pádel</h1>
          <p className="text-sm text-gray-500 mt-2">
            Tu cuenta ya existe; solo falta activar el perfil de pádel para empezar a llevar tus estadísticas y preferencias.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-blue-100 flex flex-col gap-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nivel</label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
              >
                {NIVELES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posición en cancha</label>
              <select
                value={posicion}
                onChange={(e) => setPosicion(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
              >
                {POSICIONES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mano dominante</label>
              <select
                value={manoHabil}
                onChange={(e) => setManoHabil(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
              >
                <option value="Derecha">Diestro</option>
                <option value="Izquierda">Zurdo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Horario preferido</label>
              <select
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
              >
                {HORARIOS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Día preferido</label>
              <select
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
              >
                {DIAS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo de partido</label>
              <select
                value={tipoPartido}
                onChange={(e) => setTipoPartido(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
              >
                {TIPOS_PARTIDO.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorCarga && <p className="text-xs text-red-600">{errorCarga}</p>}

          <button
            onClick={crearPerfil}
            disabled={creando}
            className="mt-2 py-3 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-500 disabled:opacity-50 transition-all"
          >
            {creando ? "Creando..." : "Crear mi perfil de pádel"}
          </button>
        </div>
      </div>
    );
  }

  const nombreCompleto =
    [cuenta?.nombre, cuenta?.apellido].filter(Boolean).join(" ") || "Jugador";

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0C2A] p-6 md:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-blue-300 font-bold uppercase tracking-[0.2em] text-xs">Sports Hub · Pádel</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-2">Mi perfil de pádel</h1>
            <p className="text-blue-100/80 text-sm mt-2 max-w-xl">
              Configura tus preferencias, mantén tu nivel al día y prepara tu perfil para los partidos y reservas que llegarán al hub.
            </p>
          </div>

          <button
            onClick={() => (editando ? guardarPreferencias() : setEditando(true))}
            disabled={guardando}
            className="px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-black uppercase tracking-wide transition-all shadow-[0_0_30px_rgba(59,130,246,0.25)] disabled:opacity-50"
          >
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Editar preferencias"}
          </button>
        </div>
      </div>

      {errorCarga && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
          {errorCarga}
        </div>
      )}

      <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold text-gray-700">🎾 Mis estadísticas</h2>
          <PadelStatsCard
            nombre={nombreCompleto}
            nivel={perfil.nivel || nivel}
            posicion={POSICIONES.find((p) => p.value === (perfil.posicion_preferida || perfil.posicion))?.label || perfil.posicion || "Drive"}
            avatar={cuenta?.avatar_url}
            stats={{
              partidos_jugados: perfil.partidos_jugados || 0,
              victorias: perfil.victorias || 0,
              derrotas: perfil.derrotas || 0,
              rating: perfil.rating || 0,
            }}
            size="lg"
          />
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-6 md:p-7 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Preferencias</p>
              <h2 className="text-xl font-black text-gray-900 mt-1">Cómo te gusta jugar</h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
              {perfil.nivel || nivel}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nivel</label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value)}
                disabled={!editando}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                {NIVELES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posición preferida</label>
              <select
                value={posicion}
                onChange={(e) => setPosicion(e.target.value)}
                disabled={!editando}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                {POSICIONES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mano dominante</label>
              <select
                value={manoHabil}
                onChange={(e) => setManoHabil(e.target.value)}
                disabled={!editando}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="Derecha">Diestro</option>
                <option value="Izquierda">Zurdo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Horario preferido</label>
              <select
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                disabled={!editando}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                {HORARIOS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Día preferido</label>
              <select
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                disabled={!editando}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                {DIAS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo de partido</label>
              <select
                value={tipoPartido}
                onChange={(e) => setTipoPartido(e.target.value)}
                disabled={!editando}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                {TIPOS_PARTIDO.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900">
            Aquí podrás dejar preparado tu perfil para que el sistema te recomiende partidos según tu disponibilidad y estilo de juego cuando el módulo de pádel esté completo.
          </div>

          <Link href="/perfil" className="text-sm font-bold text-blue-700 hover:underline">
            ← Volver a mi cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
