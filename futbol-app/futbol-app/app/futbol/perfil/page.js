"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import PlayerCard from "../../../components/futbol/PlayerCard";
import LogroBadge from "../../../components/futbol/LogroBadge";
import { bonusLabel } from "../../../lib/futbol/logros";
import Link from "next/link";

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [stats, setStats] = useState(null);
  const [logros, setLogros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [userId, setUserId] = useState(null);
  const [conSesion, setConSesion] = useState(false);

  // Onboarding: solo se usa si el usuario aún no tiene perfil de fútbol
  const [creandoPerfil, setCreandoPerfil] = useState(false);
  const [nacionalidadNueva, setNacionalidadNueva] = useState("VE");
  const [posicionNueva, setPosicionNueva] = useState("MED");

  useEffect(() => {
    async function cargar() {
      try {
        if (!supabase) {
          setErrorCarga("Supabase no está disponible.");
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error("Error auth perfil:", userError);
          setErrorCarga("No se pudo validar la sesión.");
          return;
        }

        if (!user) return;

        setUserId(user.id);
        setConSesion(true);

        const [{ data: fProfile, error: perfilError }, { data: logrosCatalogo }, { data: logrosUsuario }] =
          await Promise.all([
            supabase
              .from("futbol_profiles")
              .select("*, profiles(nombre, telefono, pais, avatar_url, creditos)")
              .eq("id", user.id)
              .maybeSingle(),
            supabase.from("logros").select("*"),
            supabase.from("user_logros").select("logro_id").eq("user_id", user.id),
          ]);

        if (perfilError) {
          console.error("Error perfil:", perfilError);
          setErrorCarga(perfilError.message || "No se pudo cargar el perfil.");
          return;
        }

        if (!fProfile) {
          setPerfil(null);
          return;
        }

        const p = {
          ...fProfile,
          nombre: fProfile.profiles?.nombre,
          telefono: fProfile.profiles?.telefono,
          nacionalidad: fProfile.profiles?.pais,
          avatar_url: fProfile.profiles?.avatar_url,
          creditos: fProfile.profiles?.creditos,
          posicion_preferida: fProfile.posicion,
          goles_total: fProfile.goles || 0,
        };

        const partidos_jugados = p.partidos_jugados ?? 0;
        const goles_total = p.goles_total ?? 0;
        const victorias = p.victorias ?? 0; // Lee directo de BD
        const derrotas = p.derrotas ?? 0;   // Lee directo de BD

        const promedio_goles = partidos_jugados > 0 ? (goles_total / partidos_jugados).toFixed(2) : "0.00";
        const ratio_vd = derrotas > 0 ? (victorias / derrotas).toFixed(2) : victorias > 0 ? "∞" : "0.00";

        setPerfil(p);
        setStats({
          partidos_jugados,
          goles_total,
          media_general: p.rating || 64, // Lee el rating de la BD
          ritmo: p.ritmo || 64,
          tiro: p.tiro || 64,
          pase: p.pase || 64,
          regate: p.regate || 64,
          defensa: p.defensa || 64,
          fisico: p.fisico || 64,
          victorias,
          derrotas,
          promedio_goles,
          ratio_vd,
        });

        const idsDesbloqueados = new Set((logrosUsuario || []).map((d) => d.logro_id));
        setLogros(
          (logrosCatalogo || []).map((l) => ({
            ...l,
            nombre: l.titulo,
            desbloqueado: idsDesbloqueados.has(l.id),
          }))
        );
      } catch (error) {
        console.error("Error general perfil:", error);
        setErrorCarga("Ocurrió un error cargando el perfil.");
      } finally {
        setCargando(false);
      }
    }

    cargar();
  }, []);

  async function subirFoto(e) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !userId) return;

    setMensajeFoto("");

    if (!file.type.startsWith("image/")) {
      setMensajeFoto("Solo puedes subir imágenes.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMensajeFoto("La imagen no puede pesar más de 2MB.");
      return;
    }

    try {
      setSubiendoFoto(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar-futbol.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        setMensajeFoto(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatar_url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url }).eq("id", userId);

      if (updateError) {
        setMensajeFoto(updateError.message);
        return;
      }

      setPerfil((prev) => ({ ...prev, avatar_url }));
      setMensajeFoto("Foto actualizada correctamente.");
    } catch (error) {
      console.error("Error subiendo foto:", error);
      setMensajeFoto("Ocurrió un error subiendo la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function crearPerfilFutbol() {
    if (!supabase || !userId) return;
    setCreandoPerfil(true);
    setErrorCarga("");

    await supabase.from("profiles").update({ pais: nacionalidadNueva }).eq("id", userId);

    const { error } = await supabase.from("futbol_profiles").upsert({
      id: userId,
      posicion: posicionNueva,
    });

    setCreandoPerfil(false);

    if (error) {
      console.error("Error creando perfil de fútbol:", error);
      setErrorCarga(error.message || "No se pudo crear el perfil de fútbol.");
      return;
    }
    window.location.reload();
  }

  if (cargando) return <div className="flex items-center justify-center h-64"><div className="animate-spin text-4xl">⚽</div></div>;

  if (!conSesion) {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <div className="text-6xl">🔐</div>
        <h1 className="text-2xl font-bold text-gray-800">Accede a tu perfil</h1>
        <p className="text-gray-500 text-center max-w-sm">Inicia sesión para ver tu carta de jugador, tus estadísticas y tus logros.</p>
        <Link href="/login" className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (errorCarga && !perfil) return <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">{errorCarga}</div>;

  if (!perfil) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 py-8">
        <div className="text-center">
          <span className="text-5xl">⚽</span>
          <h1 className="text-2xl font-black text-gray-900 mt-3">Crea tu perfil de fútbol</h1>
          <p className="text-sm text-gray-500 mt-2">Tu cuenta ya existe — solo falta activar el perfil de fútbol para armar tu carta de jugador.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4 border border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nacionalidad</label>
            <input value={nacionalidadNueva} onChange={(e) => setNacionalidadNueva(e.target.value.toUpperCase())} maxLength={2} placeholder="Ej. VE" className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Posición preferida</label>
            <select value={posicionNueva} onChange={(e) => setPosicionNueva(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white">
              <option value="POR">Portero</option>
              <option value="DEF">Defensor</option>
              <option value="MED">Mediocampista</option>
              <option value="DEL">Delantero</option>
            </select>
          </div>

          {errorCarga && <p className="text-xs text-red-600">{errorCarga}</p>}

          <button onClick={crearPerfilFutbol} disabled={creandoPerfil} className="mt-2 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
            {creandoPerfil ? "Creando..." : "Crear mi perfil de fútbol"}
          </button>
        </div>
      </div>
    );
  }

  const logrosDesbloqueados = logros.filter((l) => l.desbloqueado).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">Mi perfil de fútbol</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-gray-700">🃏 Mi carta</h2>
          <PlayerCard
            nombre={perfil.nombre || "Jugador"}
            posicion={perfil.posicion_preferida || perfil.posicion || "MED"}
            media={stats?.media_general || 64}
            stats={{
              ritmo: stats?.ritmo || 64,
              tiro: stats?.tiro || 64,
              pase: stats?.pase || 64,
              regate: stats?.regate || 64,
              defensa: stats?.defensa || 64,
              fisico: stats?.fisico || 64,
            }}
            avatar={perfil.avatar_url || null}
            nacionalidad={perfil.nacionalidad || null}
            size="lg"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-5 border">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold text-xl">
                {perfil.avatar_url ? (
                  <img src={perfil.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  perfil.nombre ? perfil.nombre.slice(0, 2).toUpperCase() : "?"
                )}
              </div>

              <div className="flex-1">
                <p className="font-bold text-gray-800">{perfil.nombre || "Sin nombre"}</p>
                <p className="text-sm text-gray-500">{perfil.telefono || "Sin teléfono"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Subir foto de perfil</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={subirFoto} className="text-sm text-gray-600" disabled={subiendoFoto} />
              {subiendoFoto && <p className="text-xs text-gray-500">Subiendo foto...</p>}
              {mensajeFoto && <p className="text-xs text-gray-500">{mensajeFoto}</p>}
            </div>

            <div className="mt-4 flex items-center justify-between bg-gray-50 border rounded-xl p-3">
              <div>
                <p className="text-xs text-gray-500">Créditos disponibles</p>
                <p className="font-black text-emerald-800 text-xl">{perfil.creditos || 0} ⚡</p>
              </div>
              <Link href="/creditos" className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors">
                Recargar
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Nacionalidad</p>
                <p className="font-bold text-gray-800">{perfil.nacionalidad || "No definida"}</p>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Posición preferida</p>
                <p className="font-bold text-gray-800">{perfil.posicion_preferida || perfil.posicion || "MED"}</p>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Partidos jugados</p>
                <p className="font-bold text-gray-800">{stats?.partidos_jugados || 0}</p>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Ratio victorias / derrotas</p>
                <p className="font-bold text-gray-800">{stats?.ratio_vd || "0.00"}</p>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Goles</p>
                <p className="font-bold text-gray-800">{stats?.goles_total || 0}</p>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3">
                <p className="text-xs text-gray-500">Promedio goles / partido</p>
                <p className="font-bold text-gray-800">{stats?.promedio_goles || "0.00"}</p>
              </div>
              <div className="bg-gray-50 border rounded-xl p-3 col-span-2">
                <p className="text-xs text-gray-500">Récord</p>
                <p className="font-bold text-gray-800">{stats?.victorias || 0} victorias · {stats?.derrotas || 0} derrotas</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">🏆 Logros</h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                {logrosDesbloqueados}/{logros.length}
              </span>
            </div>

            {logros.length === 0 ? (
              <p className="text-sm text-gray-400">Todavía no hay logros disponibles.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {logros.map((l) => (
                  <LogroBadge key={l.id} label={l.nombre} desc={l.descripcion} bonus={bonusLabel(l)} desbloqueado={l.desbloqueado} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}