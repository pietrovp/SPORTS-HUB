"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlayerCard from "@/components/futbol/PlayerCard";
import LogroBadge from "@/components/futbol/LogroBadge";
import { bonusLabel } from "@/lib/futbol/logros";
import Link from "next/link";
import Cropper from "react-easy-crop";

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((file) => resolve(file), "image/jpeg");
  });
}

function formatFechaCorta(fechaStr) {
  if (!fechaStr) return "";

  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return "";

  const meses = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  return `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "--";

  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);

  if (Number.isNaN(fechaNac.getTime())) return "--";

  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const diferenciaMes = hoy.getMonth() - fechaNac.getMonth();

  if (
    diferenciaMes < 0 ||
    (diferenciaMes === 0 && hoy.getDate() < fechaNac.getDate())
  ) {
    edad--;
  }

  return edad >= 0 ? edad : "--";
}

function numeroSeguro(valor, valorPorDefecto = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : valorPorDefecto;
}

function obtenerMarcador(scoreText) {
  if (!scoreText) return { g1: 0, g2: 0 };

  const partes = String(scoreText)
    .split("-")
    .map((valor) => Number(valor.trim()));

  return {
    g1: Number.isFinite(partes[0]) ? partes[0] : 0,
    g2: Number.isFinite(partes[1]) ? partes[1] : 0,
  };
}

function estaFinalizado(status) {
  return ["finalizado", "terminado", "jugado"].includes(
    String(status || "").toLowerCase().trim()
  );
}

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [stats, setStats] = useState(null);
  const [logros, setLogros] = useState([]);
  const [logrosFiltro, setLogrosFiltro] = useState("todos");
  const [proximosPartidos, setProximosPartidos] = useState([]);
  const [partidosJugados, setPartidosJugados] = useState([]);
  const [filtroHistorial, setFiltroHistorial] = useState("todos");
  const [cantidadVisible, setCantidadVisible] = useState(5);
  const [cargandoPartidos, setCargandoPartidos] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [userId, setUserId] = useState(null);
  const [conSesion, setConSesion] = useState(false);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [editNacionalidad, setEditNacionalidad] = useState("VE");
  const [editPosicion, setEditPosicion] = useState("MED");
  const [editPierna, setEditPierna] = useState("Derecha");
  const [editDia, setEditDia] = useState("");
  const [editMes, setEditMes] = useState("");
  const [editAno, setEditAno] = useState("");
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [creandoPerfil, setCreandoPerfil] = useState(false);
  const [nacionalidadNueva, setNacionalidadNueva] = useState("VE");
  const [posicionNueva, setPosicionNueva] = useState("MED");
  const [piernaNueva, setPiernaNueva] = useState("Derecha");

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        if (!supabase) {
          if (activo) {
            setErrorCarga("Supabase no está disponible.");
            setCargando(false);
            setCargandoPartidos(false);
          }
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!activo) return;

        if (userError || !user) {
          setCargando(false);
          setCargandoPartidos(false);
          return;
        }

        setUserId(user.id);
        setConSesion(true);

        const [
          { data: fProfile, error: perfilError },
          { data: logrosCatalogo, error: logrosError },
          { data: logrosUsuario, error: userLogrosError },
          { data: misInscripciones, error: inscripcionesError },
        ] = await Promise.all([
          supabase
            .from("futbol_profiles")
            .select(
              "id, posicion, pierna_buena, rating, partidos_jugados, goles, victorias, derrotas, ritmo, tiro, pase, regate, defensa, fisico, profiles(nombre, apellido, telefono, pais, avatar_url, fecha_nacimiento)"
            )
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("logros")
            .select("id, titulo, descripcion, stat_mejora, valor_mejora, activo")
            .eq("activo", true),
          supabase
            .from("user_logros")
            .select("logro_id")
            .eq("user_id", user.id),
          supabase
            .from("match_players")
            .select("id, match_id, team, goals")
            .eq("user_id", user.id),
        ]);

        if (perfilError) throw perfilError;
        if (logrosError) throw logrosError;
        if (userLogrosError) throw userLogrosError;
        if (inscripcionesError) throw inscripcionesError;
        if (!activo) return;

        const idsDesbloqueados = new Set(
          (logrosUsuario || []).map((item) => String(item.logro_id))
        );

        setLogros(
          (logrosCatalogo || []).map((logro) => ({
            ...logro,
            nombre: logro.titulo || "Logro",
            desbloqueado: idsDesbloqueados.has(String(logro.id)),
          }))
        );

        if (fProfile) {
          const userData = Array.isArray(fProfile.profiles)
            ? fProfile.profiles[0] || {}
            : fProfile.profiles || {};

          const perfilMapeado = {
            ...fProfile,
            nombre: userData.nombre || "",
            apellido: userData.apellido || "",
            telefono: userData.telefono || "",
            nacionalidad: userData.pais || null,
            avatar_url: userData.avatar_url || null,
            fecha_nacimiento: userData.fecha_nacimiento || null,
            edad: calcularEdad(userData.fecha_nacimiento),
            posicion_preferida: fProfile.posicion || "MED",
            pierna_buena: fProfile.pierna_buena || "Derecha",
            goles_total: numeroSeguro(fProfile.goles, 0),
          };

          const partidos = numeroSeguro(fProfile.partidos_jugados, 0);
          const goles = numeroSeguro(fProfile.goles, 0);
          const victorias = numeroSeguro(fProfile.victorias, 0);
          const derrotas = numeroSeguro(fProfile.derrotas, 0);

          setPerfil(perfilMapeado);
          setEditNacionalidad(perfilMapeado.nacionalidad || "VE");
          setEditPosicion(perfilMapeado.posicion_preferida || "MED");
          setEditPierna(perfilMapeado.pierna_buena || "Derecha");

          if (perfilMapeado.fecha_nacimiento) {
            const partes = perfilMapeado.fecha_nacimiento.split("-");
            if (partes.length === 3) {
              setEditAno(partes[0]);
              setEditMes(partes[1]);
              setEditDia(partes[2]);
            }
          }

          setStats({
            partidos_jugados: partidos,
            goles_total: goles,
            media_general: Number.isFinite(Number(fProfile.rating))
              ? Math.round(Number(fProfile.rating))
              : 64,
            ritmo: Number.isFinite(Number(fProfile.ritmo))
              ? Math.round(Number(fProfile.ritmo))
              : 64,
            tiro: Number.isFinite(Number(fProfile.tiro))
              ? Math.round(Number(fProfile.tiro))
              : 64,
            pase: Number.isFinite(Number(fProfile.pase))
              ? Math.round(Number(fProfile.pase))
              : 64,
            regate: Number.isFinite(Number(fProfile.regate))
              ? Math.round(Number(fProfile.regate))
              : 64,
            defensa: Number.isFinite(Number(fProfile.defensa))
              ? Math.round(Number(fProfile.defensa))
              : 64,
            fisico: Number.isFinite(Number(fProfile.fisico))
              ? Math.round(Number(fProfile.fisico))
              : 64,
            victorias,
            derrotas,
            promedio_goles: partidos > 0 ? (goles / partidos).toFixed(2) : "0.00",
            win_rate: partidos > 0 ? `${Math.round((victorias / partidos) * 100)}%` : "0%",
          });
        }

        setCargando(false);

        const idsPartidos = (misInscripciones || [])
          .map((item) => item.match_id)
          .filter(Boolean);

        if (idsPartidos.length === 0) {
          setProximosPartidos([]);
          setPartidosJugados([]);
          setCargandoPartidos(false);
          return;
        }

        const [
          { data: partidosData, error: partidosError },
          { data: ocupacionData, error: ocupacionError },
        ] = await Promise.all([
          supabase
            .from("matches")
            .select(
              "id, scheduled_at, status, score_text, winner_team, is_private, club:clubs(name, city, address, image_url), court:courts!inner(name, sport_type)"
            )
            .in("id", idsPartidos)
            .eq("court.sport_type", "futbol"),
          supabase
            .from("match_players")
            .select("match_id")
            .in("match_id", idsPartidos),
        ]);

        if (partidosError) throw partidosError;
        if (ocupacionError) throw ocupacionError;
        if (!activo) return;

        const conteoPorPartido = {};
        (ocupacionData || []).forEach((row) => {
          conteoPorPartido[row.match_id] =
            (conteoPorPartido[row.match_id] || 0) + 1;
        });

        const proximos = [];
        const jugados = [];
        const ahora = new Date();

        (partidosData || []).forEach((partido) => {
          const inscripcion = (misInscripciones || []).find(
            (item) => String(item.match_id) === String(partido.id)
          );

          if (!inscripcion) return;

          const estado = String(partido.status || "").toLowerCase().trim();
          if (estado === "cancelado" || estado === "cancelada") return;

          const partidoObj = {
            ...partido,
            mi_equipo:
              String(inscripcion.team || "").toUpperCase() === "B" ? 2 : 1,
            mis_goles: numeroSeguro(inscripcion.goals, 0),
            cancha:
              partido.court?.name ||
              partido.club?.name ||
              "Cancha de Fútbol",
            club_nombre: partido.club?.name || "Complejo",
            cupos_ocupados: conteoPorPartido[partido.id] || 0,
          };

          const esPasado = new Date(partido.scheduled_at) < ahora;

          if (estaFinalizado(estado) || esPasado) {
            jugados.push(partidoObj);
          } else {
            proximos.push(partidoObj);
          }
        });

        proximos.sort(
          (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
        );
        jugados.sort(
          (a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)
        );

        setProximosPartidos(proximos);
        setPartidosJugados(jugados);
        setCargandoPartidos(false);
      } catch (error) {
        console.error("Error general perfil:", error);

        if (activo) {
          setErrorCarga(error.message || "Ocurrió un error cargando el perfil.");
          setCargando(false);
          setCargandoPartidos(false);
        }
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const onFileChange = (event) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];

    if (!file.type.startsWith("image/")) {
      setMensajeFoto("Solo puedes subir imágenes.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMensajeFoto("La imagen no puede pesar más de 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => setImageSrc(reader.result));
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const guardarFotoRecortada = async () => {
    if (!supabase || !userId || !imageSrc || !croppedAreaPixels) return;

    try {
      setSubiendoFoto(true);
      setMensajeFoto("");

      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const filePath = `${userId}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedImageBlob, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatar_url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url })
        .eq("id", userId);

      if (updateError) throw updateError;

      setPerfil((prev) => ({ ...prev, avatar_url }));
      setImageSrc(null);
      setMensajeFoto("¡Foto de perfil actualizada!");
      setTimeout(() => setMensajeFoto(""), 3000);
    } catch (error) {
      console.error("Error al recortar/subir foto:", error);
      setMensajeFoto(
        `Error: ${error.message || "Verifica políticas RLS del bucket avatars."}`
      );
    } finally {
      setSubiendoFoto(false);
    }
  };

  async function crearPerfilFutbol() {
    if (!supabase || !userId) return;

    setCreandoPerfil(true);
    setErrorCarga("");

    try {
      const { error: errorProfile } = await supabase
        .from("profiles")
        .update({ pais: nacionalidadNueva })
        .eq("id", userId);

      if (errorProfile) throw errorProfile;

      const { error } = await supabase.from("futbol_profiles").upsert({
        id: userId,
        posicion: posicionNueva,
        pierna_buena: piernaNueva,
      });

      if (error) throw error;

      window.location.reload();
    } catch (error) {
      console.error("Error creando perfil de fútbol:", error);
      setErrorCarga(error.message || "No se pudo crear el perfil de fútbol.");
    } finally {
      setCreandoPerfil(false);
    }
  }

  async function actualizarPerfilFutbol() {
    if (!supabase || !userId) return;

    setGuardandoPerfil(true);

    const fechaNacCombinada =
      editAno && editMes && editDia
        ? `${editAno}-${editMes}-${editDia}`
        : null;

    try {
      const { error: errorProfile } = await supabase
        .from("profiles")
        .update({
          pais: editNacionalidad,
          fecha_nacimiento: fechaNacCombinada,
        })
        .eq("id", userId);

      if (errorProfile) throw errorProfile;

      const { error: errorFutbol } = await supabase
        .from("futbol_profiles")
        .update({
          posicion: editPosicion,
          pierna_buena: editPierna,
        })
        .eq("id", userId);

      if (errorFutbol) throw errorFutbol;

      setPerfil((prev) => ({
        ...prev,
        nacionalidad: editNacionalidad,
        posicion_preferida: editPosicion,
        pierna_buena: editPierna,
        fecha_nacimiento: fechaNacCombinada,
        edad: calcularEdad(fechaNacCombinada),
      }));

      setEditandoPerfil(false);
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      alert("Hubo un error al actualizar los datos.");
    } finally {
      setGuardandoPerfil(false);
    }
  }

  const partidosHistorialProcesados = partidosJugados.map((partido) => {
    const { g1, g2 } = obtenerMarcador(partido.score_text);
    const ganador = String(partido.winner_team || "").toUpperCase();
    const esEmpate = ganador === "EMPATE" || g1 === g2;

    const esVictoria =
      !esEmpate &&
      ((partido.mi_equipo === 1 && (ganador === "A" || g1 > g2)) ||
        (partido.mi_equipo === 2 && (ganador === "B" || g2 > g1)));

    return {
      ...partido,
      g1,
      g2,
      esVictoria,
      esEmpate,
      tipo: esEmpate ? "empate" : esVictoria ? "victoria" : "derrota",
    };
  });

  const historialFiltrado = partidosHistorialProcesados.filter((partido) => {
    if (filtroHistorial === "todos") return true;
    return partido.tipo === filtroHistorial;
  });

  const historialVisible = historialFiltrado.slice(0, cantidadVisible);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!conSesion) {
    return (
      <div className="flex flex-col items-center gap-6 py-20 px-4 text-center">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mb-2">
          ⚽
        </div>
        <h1 className="text-2xl font-black text-gray-900">Accede a tu perfil</h1>
        <p className="text-gray-500 text-sm max-w-sm font-medium">
          Inicia sesión para consultar tu carta de jugador, estadísticas y logros.
        </p>
        <Link
          href="/login"
          className="px-8 py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-900 transition-colors shadow-lg"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (errorCarga && !perfil) {
    return (
      <div className="max-w-xl mx-auto my-8 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-center text-sm font-bold">
        {errorCarga}
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 py-12 px-4">
        <div className="text-center">
          <span className="text-5xl">⚽</span>
          <h1 className="text-2xl font-black text-gray-900 mt-3">
            Crea tu perfil de fútbol
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">
            Tu cuenta está lista — activa tu ficha de jugador para generar tu carta digital.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col gap-5 border border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Nacionalidad
            </label>
            <select
              value={nacionalidadNueva}
              onChange={(event) => setNacionalidadNueva(event.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
            >
              <option value="VE">🇻🇪 Venezuela</option>
              <option value="AR">🇦🇷 Argentina</option>
              <option value="CO">🇨🇴 Colombia</option>
              <option value="CL">🇨🇱 Chile</option>
              <option value="ES">🇪🇸 España</option>
              <option value="MX">🇲🇽 México</option>
              <option value="US">🇺🇸 USA</option>
              <option value="OTRO">🌍 Otro</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Posición preferida
              </label>
              <select
                value={posicionNueva}
                onChange={(event) => setPosicionNueva(event.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
              >
                <option value="POR">POR</option>
                <option value="DEF">DEF</option>
                <option value="MED">MED</option>
                <option value="DEL">DEL</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Pierna hábil
              </label>
              <select
                value={piernaNueva}
                onChange={(event) => setPiernaNueva(event.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
              >
                <option value="Derecha">Derecha</option>
                <option value="Izquierda">Izquierda</option>
                <option value="Ambidiestro">Ambidiestra</option>
              </select>
            </div>
          </div>

          <button
            onClick={crearPerfilFutbol}
            disabled={creandoPerfil}
            className="mt-2 py-4 rounded-2xl bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs hover:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {creandoPerfil ? "Creando..." : "Crear mi perfil de fútbol"}
          </button>
        </div>
      </div>
    );
  }

  const logrosDesbloqueadosCount = logros.filter(
    (logro) => logro.desbloqueado
  ).length;

  const logrosFiltrados = logros.filter((logro) => {
    if (logrosFiltro === "desbloqueados") return logro.desbloqueado;
    if (logrosFiltro === "bloqueados") return !logro.desbloqueado;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 pt-8 relative">
      {editandoPerfil && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <h3 className="font-black text-xl text-gray-900 uppercase tracking-tight text-center">
              Editar ficha
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Nacionalidad
              </label>
              <select
                value={editNacionalidad}
                onChange={(event) => setEditNacionalidad(event.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
              >
                <option value="VE">🇻🇪 Venezuela</option>
                <option value="AR">🇦🇷 Argentina</option>
                <option value="CO">🇨🇴 Colombia</option>
                <option value="CL">🇨🇱 Chile</option>
                <option value="ES">🇪🇸 España</option>
                <option value="MX">🇲🇽 México</option>
                <option value="US">🇺🇸 USA</option>
                <option value="OTRO">🌍 Otro</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Fecha de nacimiento
              </label>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={editDia}
                  onChange={(event) => setEditDia(event.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="" disabled>
                    Día
                  </option>
                  {Array.from({ length: 31 }, (_, index) => {
                    const value = String(index + 1).padStart(2, "0");
                    return (
                      <option key={value} value={value}>
                        {index + 1}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={editMes}
                  onChange={(event) => setEditMes(event.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="" disabled>
                    Mes
                  </option>
                  <option value="01">Ene</option>
                  <option value="02">Feb</option>
                  <option value="03">Mar</option>
                  <option value="04">Abr</option>
                  <option value="05">May</option>
                  <option value="06">Jun</option>
                  <option value="07">Jul</option>
                  <option value="08">Ago</option>
                  <option value="09">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dic</option>
                </select>

                <select
                  value={editAno}
                  onChange={(event) => setEditAno(event.target.value)}
                  className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="" disabled>
                    Año
                  </option>
                  {Array.from({ length: 100 }, (_, index) => {
                    const year = new Date().getFullYear() - 10 - index;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Posición
                </label>
                <select
                  value={editPosicion}
                  onChange={(event) => setEditPosicion(event.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="POR">POR</option>
                  <option value="DEF">DEF</option>
                  <option value="MED">MED</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Pierna hábil
                </label>
                <select
                  value={editPierna}
                  onChange={(event) => setEditPierna(event.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="Derecha">Derecha</option>
                  <option value="Izquierda">Izquierda</option>
                  <option value="Ambidiestro">Ambidiestra</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setEditandoPerfil(false)}
                disabled={guardandoPerfil}
                className="flex-1 py-3.5 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={actualizarPerfilFutbol}
                disabled={guardandoPerfil}
                className="flex-1 py-3.5 font-black text-white bg-[#0B0C15] rounded-xl hover:bg-gray-900 transition-colors text-xs uppercase tracking-wider shadow-md disabled:opacity-50"
              >
                {guardandoPerfil ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageSrc && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col">
          <div className="relative flex-1">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>

          <div className="bg-white p-6 flex flex-col gap-4 pb-10">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
              <span>Zoom</span>
              <span>Ajusta tu encuadre</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setImageSrc(null)}
                className="flex-1 py-3.5 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={guardarFotoRecortada}
                disabled={subiendoFoto}
                className="flex-1 py-3.5 font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors text-xs uppercase tracking-wider shadow-md disabled:opacity-50"
              >
                {subiendoFoto ? "Guardando..." : "Guardar foto"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 space-y-10">
        <div className="border-b border-gray-200/80 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            Mi perfil de fútbol
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Consulta tu carta digital, gestiona tu avatar y revisa tu rendimiento en la cancha.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Carta oficial
              </span>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                OVR {stats?.media_general ?? 64}
              </span>
            </div>

            <PlayerCard
              nombre={perfil.nombre || "Jugador"}
              apellido={perfil.apellido || ""}
              posicion={perfil.posicion_preferida || perfil.posicion || "MED"}
              media={stats?.media_general ?? 64}
              stats={{
                ritmo: stats?.ritmo ?? 64,
                tiro: stats?.tiro ?? 64,
                pase: stats?.pase ?? 64,
                regate: stats?.regate ?? 64,
                defensa: stats?.defensa ?? 64,
                fisico: stats?.fisico ?? 64,
              }}
              avatar={perfil.avatar_url || null}
              nacionalidad={perfil.nacionalidad || null}
              size="lg"
            />
          </div>

          <div className="md:col-span-7 flex flex-col gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-emerald-50 border-2 border-gray-200 flex items-center justify-center text-emerald-800 font-black text-xl shadow-sm">
                      {perfil.avatar_url ? (
                        <img
                          src={perfil.avatar_url}
                          alt="Foto de perfil"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        perfil.nombre
                          ? perfil.nombre.slice(0, 2).toUpperCase()
                          : "?"
                      )}
                    </div>
                    <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-white text-lg">📷</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                        className="hidden"
                        disabled={subiendoFoto}
                      />
                    </label>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-gray-900 leading-tight truncate">
                      {perfil.nombre || "Sin nombre"} {perfil.apellido || ""}
                    </h2>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">
                      {perfil.telefono || "Sin teléfono registrado"}
                    </p>
                    <label className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer transition-colors">
                      ✎ {subiendoFoto ? "Procesando..." : "Cambiar foto de perfil"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                        className="hidden"
                        disabled={subiendoFoto}
                      />
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => setEditandoPerfil(true)}
                  className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-[#0B0C15] hover:text-[#00FF9D] transition-all shadow-sm shrink-0"
                  title="Editar ficha"
                >
                  ⚙
                </button>
              </div>

              {mensajeFoto && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold text-center ${
                    mensajeFoto.includes("Error")
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  }`}
                >
                  {mensajeFoto}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Partidos jugados" value={stats?.partidos_jugados ?? 0} />
                <StatCard
                  label="Goles totales"
                  value={`${stats?.goles_total ?? 0} ⚽`}
                  color="text-emerald-600"
                />
                <StatCard label="Promedio goles" value={stats?.promedio_goles ?? "0.00"} />
                <StatCard
                  label="% victorias"
                  value={stats?.win_rate ?? "0%"}
                  color="text-emerald-600"
                />
                <StatCard label="Edad" value={perfil.edad ?? "--"} />
                <StatCard label="Pierna hábil" value={perfil.pierna_buena ?? "--"} />

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 col-span-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Récord de carrera
                    </p>
                    <p className="font-black text-gray-900 text-sm mt-0.5">
                      <span className="text-emerald-600">
                        {stats?.victorias ?? 0} Victorias
                      </span>{" "}
                      ·{" "}
                      <span className="text-red-500">
                        {stats?.derrotas ?? 0} Derrotas
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Posición
                    </p>
                    <p className="font-black text-gray-900 text-sm mt-0.5">
                      {perfil.posicion_preferida || perfil.posicion || "MED"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                🏆 Mis logros
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Desbloquea objetivos para subir tu media y atributos de carta.
              </p>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold shrink-0">
              <button
                onClick={() => setLogrosFiltro("todos")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  logrosFiltro === "todos"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Todos ({logros.length})
              </button>
              <button
                onClick={() => setLogrosFiltro("desbloqueados")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  logrosFiltro === "desbloqueados"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Completados ({logrosDesbloqueadosCount})
              </button>
            </div>
          </div>

          {logrosFiltrados.length === 0 ? (
            <p className="text-sm font-bold text-gray-400 text-center py-6">
              No hay logros en esta categoría.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide snap-x w-full">
              {logrosFiltrados.map((logro) => (
                <div key={logro.id} className="snap-start shrink-0 w-64 md:w-72">
                  <LogroBadge
                    label={logro.nombre}
                    desc={logro.descripcion}
                    bonus={bonusLabel(logro)}
                    desbloqueado={logro.desbloqueado}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              Próximos partidos
            </h2>
            {!cargandoPartidos && (
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                {proximosPartidos.length} Inscrito
              </span>
            )}
          </div>

          {cargandoPartidos ? (
            <Spinner />
          ) : proximosPartidos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
              <p className="text-gray-400 font-bold text-sm">
                No estás inscrito en ningún partido próximo.
              </p>
              <Link
                href="/futbol"
                className="inline-block mt-3 px-5 py-2.5 bg-[#0B0C15] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-colors"
              >
                Buscar partidos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proximosPartidos.map((partido) => (
                <Link
                  key={partido.id}
                  href={`/futbol/partidos/${partido.id}`}
                  className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between hover:border-gray-200 transition-all"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase text-emerald-600 block">
                      {partido.club_nombre}
                    </span>
                    <h3 className="font-black text-gray-900 text-base truncate">
                      {partido.cancha}
                    </h3>
                    <p className="text-xs text-gray-500 font-bold">
                      {formatFechaCorta(partido.scheduled_at)}
                    </p>
                  </div>
                  <span className="text-xs font-black bg-[#0B0C15] text-[#00FF9D] px-4 py-2.5 rounded-xl uppercase tracking-wider shrink-0 ml-3">
                    Ver partido →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">
              Historial de partidos
            </h2>

            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold w-fit shrink-0">
              <button
                onClick={() => {
                  setFiltroHistorial("todos");
                  setCantidadVisible(5);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroHistorial === "todos"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  setFiltroHistorial("victoria");
                  setCantidadVisible(5);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroHistorial === "victoria"
                    ? "bg-white text-emerald-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                V
              </button>
              <button
                onClick={() => {
                  setFiltroHistorial("empate");
                  setCantidadVisible(5);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroHistorial === "empate"
                    ? "bg-white text-yellow-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                E
              </button>
              <button
                onClick={() => {
                  setFiltroHistorial("derrota");
                  setCantidadVisible(5);
                }}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroHistorial === "derrota"
                    ? "bg-white text-red-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                D
              </button>
            </div>
          </div>

          {cargandoPartidos ? (
            <Spinner />
          ) : historialFiltrado.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
              <p className="text-gray-400 font-bold text-sm">
                {partidosJugados.length === 0
                  ? "Aún no has disputado partidos oficiales."
                  : "No hay partidos que coincidan con este filtro."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historialVisible.map((partido) => (
                  <HistorialCard key={partido.id} partido={partido} />
                ))}
              </div>

              {cantidadVisible < historialFiltrado.length && (
                <button
                  onClick={() => setCantidadVisible((prev) => prev + 5)}
                  className="w-full mt-2 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-500 font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
                >
                  Cargar anteriores
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, color = "text-gray-900" }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-black text-xl mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function HistorialCard({ partido }) {
  const colorBarra = partido.esEmpate
    ? "bg-yellow-400"
    : partido.esVictoria
      ? "bg-[#00FF9D]"
      : "bg-red-500";

  const etiqueta = partido.esEmpate
    ? "Empate"
    : partido.esVictoria
      ? "Victoria"
      : "Derrota";

  const colorEtiqueta = partido.esEmpate
    ? "bg-yellow-400/20 text-yellow-400"
    : partido.esVictoria
      ? "bg-[#00FF9D]/20 text-[#00FF9D]"
      : "bg-red-500/20 text-red-400";

  return (
    <Link
      href={`/futbol/partidos/${partido.id}`}
      className="bg-[#0B0C15] text-white rounded-3xl p-5 shadow-sm relative overflow-hidden flex items-center justify-between group hover:border border-gray-700 transition-all"
    >
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colorBarra}`} />

      <div className="pl-3 pr-2 space-y-1 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${colorEtiqueta}`}
          >
            {etiqueta}
          </span>
          <span className="text-[10px] text-gray-400 font-bold">
            {formatFechaCorta(partido.scheduled_at)}
          </span>
        </div>

        <h3 className="font-black text-white text-base leading-tight uppercase truncate">
          {partido.cancha}
        </h3>

        <p className="text-xs text-gray-400 font-bold">
          ⚽{" "}
          <span className="text-white">
            {partido.mis_goles}{" "}
            {partido.mis_goles === 1 ? "Gol anotado" : "Goles anotados"}
          </span>
        </p>
      </div>

      <div className="bg-[#121422] rounded-2xl px-4 py-2.5 border border-[#1f233a] text-center shrink-0 ml-auto">
        <p className="text-xl font-black text-white tracking-wider">
          {partido.g1}
          <span className="text-emerald-400 mx-1.5">-</span>
          {partido.g2}
        </p>
        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
          Resultado
        </p>
      </div>
    </Link>
  );
}