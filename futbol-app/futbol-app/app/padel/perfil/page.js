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

export default function PerfilPadel() {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [cuenta, setCuenta] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");

  const [creando, setCreando] = useState(false);
  const [nivel, setNivel] = useState(NIVELES[1]); // Intermedio por defecto
  const [posicion, setPosicion] = useState("Drive");
  const [manoHabil, setManoHabil] = useState("Derecha");

  useEffect(() => {
    async function cargar() {
      try {
        if (!supabase) {
          setErrorCarga("Supabase no está disponible.");
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUsuario(user);

        const [{ data: cuentaData }, { data: perfilData, error: perfilError }] = await Promise.all([
          supabase.from("profiles").select("nombre, avatar_url").eq("id", user.id).maybeSingle(),
          supabase.from("padel_profiles").select("*").eq("id", user.id).maybeSingle(),
        ]);

        if (perfilError) {
          setErrorCarga(perfilError.message || "No se pudo cargar el perfil de pádel.");
          return;
        }

        setCuenta(cuentaData || null);
        setPerfil(perfilData || null);
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

    const { data, error } = await supabase
      .from("padel_profiles")
      .insert({
        id: usuario.id,
        cuenta_id: usuario.id,
        nivel,
        posicion,
        posicion_preferida: posicion,
        mano_habil: manoHabil,
      })
      .select()
      .single();

    setCreando(false);

    if (error) {
      setErrorCarga(error.message || "No se pudo crear el perfil de pádel.");
      return;
    }

    setPerfil(data);
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
        <Link href="/login" className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (errorCarga && !perfil) {
    return <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">{errorCarga}</div>;
  }

  if (!perfil) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 py-8">
        <div className="text-center">
          <span className="text-5xl">🎾</span>
          <h1 className="text-2xl font-black text-gray-900 mt-3">Crea tu perfil de pádel</h1>
          <p className="text-sm text-gray-500 mt-2">
            Tu cuenta ya existe — solo falta activar el perfil de pádel para empezar a llevar tus estadísticas.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-4 border border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nivel</label>
            <select
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
            >
              {NIVELES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posición en cancha</label>
            <select
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
            >
              {POSICIONES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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

          {errorCarga && <p className="text-xs text-red-600">{errorCarga}</p>}

          <button
            onClick={crearPerfil}
            disabled={creando}
            className="mt-2 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            {creando ? "Creando..." : "Crear mi perfil de pádel"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Mi perfil de pádel</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700">🎾 Mis estadísticas</h2>
          <PadelStatsCard
            nombre={cuenta?.nombre || "Jugador"}
            nivel={perfil.nivel}
            posicion={POSICIONES.find((p) => p.value === perfil.posicion)?.label || perfil.posicion}
            avatar={cuenta?.avatar_url}
            stats={{
              partidos_jugados: perfil.partidos_jugados,
              victorias: perfil.victorias,
              derrotas: perfil.derrotas,
              rating: perfil.rating,
            }}
            size="lg"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col gap-3">
          <p className="text-sm text-gray-500">
            Las reservas y los partidos de pádel llegarán pronto. Por ahora, tus estadísticas se
            actualizarán aquí a medida que juegues.
          </p>
          <Link href="/perfil" className="text-sm font-bold text-blue-700 hover:underline">
            ← Volver a mi cuenta
          </Link>
        </div>
      </div>
    </div>
  );
}
