"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import PlayerCard from "../../../components/futbol/PlayerCard";
import PartidoCard from "../../../components/futbol/PartidoCard";
import LogroBadge from "../../../components/futbol/LogroBadge";
import { bonusLabel } from "../../../lib/futbol/logros";
import Link from "next/link";
import Cropper from "react-easy-crop";

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
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
    canvas.toBlob((file) => {
      resolve(file);
    }, "image/jpeg");
  });
}

function formatFechaCorta(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

// Cálculo preciso de edad
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "--";
  const hoy = new Date();
  const fechaNac = new Date(fechaNacimiento);
  if (isNaN(fechaNac.getTime())) return "--";
  
  let edad = hoy.getFullYear() - fechaNac.getFullYear();
  const m = hoy.getMonth() - fechaNac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
    edad--;
  }
  return edad >= 0 ? edad : "--";
}

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [stats, setStats] = useState(null);
  const [logros, setLogros] = useState([]);
  const [logrosFiltro, setLogrosFiltro] = useState("todos");
  
  const [proximosPartidos, setProximosPartidos] = useState([]);
  const [partidosJugados, setPartidosJugados] = useState([]);

  // ESTADOS DE FILTRO Y PAGINACIÓN
  const [filtroHistorial, setFiltroHistorial] = useState("todos");
  const [cantidadVisible, setCantidadVisible] = useState(5);
  const [cargandoPartidos, setCargandoPartidos] = useState(true);

  const [cargando, setCargando] = useState(true);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [userId, setUserId] = useState(null);
  const [conSesion, setConSesion] = useState(false);

  // ESTADOS PARA EDITAR EL PERFIL DE FÚTBOL
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [editNacionalidad, setEditNacionalidad] = useState("VE");
  const [editPosicion, setEditPosicion] = useState("MED");
  const [editPierna, setEditPierna] = useState("Derecha");
  
  // FECHA DE NACIMIENTO EN TRES ESTADOS
  const [editDia, setEditDia] = useState("");
  const [editMes, setEditMes] = useState("");
  const [editAno, setEditAno] = useState("");

  // ESTADOS DEL CROPPER DE FOTO DE PERFIL
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Onboarding
  const [creandoPerfil, setCreandoPerfil] = useState(false);
  const [nacionalidadNueva, setNacionalidadNueva] = useState("VE");
  const [posicionNueva, setPosicionNueva] = useState("MED");
  const [piernaNueva, setPiernaNueva] = useState("Derecha");

  useEffect(() => {
    async function cargar() {
      try {
        if (!supabase) {
          setErrorCarga("Supabase no está disponible.");
          return;
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          setCargando(false);
          return;
        }

        setUserId(user.id);
        setConSesion(true);

        // 1. CARGA DE DATOS BÁSICOS
        const [
          { data: fProfile, error: perfilError },
          { data: logrosCatalogo },
          { data: logrosUsuario },
          { data: misInscripciones }
        ] = await Promise.all([
          supabase
            .from("futbol_profiles")
            .select("*, profiles(nombre, apellido, telefono, pais, avatar_url, creditos, fecha_nacimiento)")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.from("logros").select("*"),
          supabase.from("user_logros").select("logro_id").eq("user_id", user.id),
          supabase.from("partido_jugadores").select("partido_id, equipo, goles").eq("user_id", user.id)
        ]);

        if (perfilError) {
          setErrorCarga(perfilError.message || "No se pudo cargar el perfil.");
          setCargando(false);
          return;
        }

        // PROCESAMIENTO DEL PERFIL
        if (fProfile) {
          // Asegurarnos de extraer nombre y apellido correctamente incluso si viene en Array
          const userData = Array.isArray(fProfile.profiles) ? fProfile.profiles[0] : (fProfile.profiles || {});

          const p = {
            ...fProfile,
            nombre: userData.nombre,
            apellido: userData.apellido, // <--- EXTRACCIÓN SEGURA AQUÍ
            telefono: userData.telefono,
            nacionalidad: userData.pais,
            avatar_url: userData.avatar_url,
            creditos: userData.creditos,
            fecha_nacimiento: userData.fecha_nacimiento,
            edad: calcularEdad(userData.fecha_nacimiento),
            posicion_preferida: fProfile.posicion,
            pierna_buena: fProfile.pierna_buena || "Derecha",
            goles_total: fProfile.goles || 0,
          };

          setPerfil(p);
          
          setEditNacionalidad(p.nacionalidad || "VE");
          setEditPosicion(p.posicion_preferida || "MED");
          setEditPierna(p.pierna_buena || "Derecha");
          
          // Dividir la fecha que viene de la base de datos en los 3 selectores
          if (p.fecha_nacimiento) {
            const partes = p.fecha_nacimiento.split("-");
            if (partes.length === 3) {
              setEditAno(partes[0]);
              setEditMes(partes[1]);
              setEditDia(partes[2]);
            }
          }

          const partidos_jugados = p.partidos_jugados ?? 0;
          const goles_total = p.goles_total ?? 0;
          const victorias = p.victorias ?? 0;
          const derrotas = p.derrotas ?? 0;

          const win_rate = partidos_jugados > 0 
            ? `${Math.round((victorias / partidos_jugados) * 100)}%` 
            : "0%";

          setStats({
            partidos_jugados,
            goles_total,
            media_general: p.rating || 64,
            ritmo: p.ritmo || 64,
            tiro: p.tiro || 64,
            pase: p.pase || 64,
            regate: p.regate || 64,
            defensa: p.defensa || 64,
            fisico: p.fisico || 64,
            victorias,
            derrotas,
            promedio_goles: partidos_jugados > 0 ? (goles_total / partidos_jugados).toFixed(2) : "0.00",
            win_rate,
          });
        }

        // PROCESAMIENTO DE LOGROS
        const idsDesbloqueados = new Set((logrosUsuario || []).map((d) => d.logro_id));
        setLogros(
          (logrosCatalogo || []).map((l) => ({
            ...l,
            nombre: l.titulo,
            desbloqueado: idsDesbloqueados.has(l.id),
          }))
        );

        setCargando(false);

        // 2. CARGA DE PARTIDOS
        if (misInscripciones && misInscripciones.length > 0) {
          const misPartidoIds = misInscripciones.map(i => i.partido_id);

          const [{ data: partidosData }, { data: ocupacionData }] = await Promise.all([
            supabase
              .from("partidos")
              .select("*, sedes(imagen_url)")
              .in("id", misPartidoIds),
            supabase
              .from("partido_jugadores")
              .select("partido_id")
              .in("partido_id", misPartidoIds)
          ]);

          const conteoPorPartido = {};
          (ocupacionData || []).forEach(row => {
             conteoPorPartido[row.partido_id] = (conteoPorPartido[row.partido_id] || 0) + 1;
          });

          if (partidosData) {
            const proximos = [];
            const jugados = [];
            const ahora = new Date();

            partidosData.forEach((partido) => {
              const inscripcion = misInscripciones.find(i => String(i.partido_id) === String(partido.id));
              if (!inscripcion) return;

              const est = (partido.estado || "").toLowerCase().trim();
              if (est === "cancelado" || est === "cancelada") return;

              const partidoObj = {
                ...partido,
                mi_equipo: Number(inscripcion.equipo) || null,
                mis_goles: Number(inscripcion.goles) || 0,
                cancha: partido.cancha_lugar || partido.titulo || "Cancha",
                cupos_ocupados: conteoPorPartido[partido.id] || 0
              };

              const fechaHoraPartido = new Date(`${partido.fecha}T${partido.hora || "00:00:00"}`);
              const esPasado = fechaHoraPartido < ahora;

              if (est === "finalizado" || est === "terminado" || est === "completado" || est === "jugado" || esPasado) {
                jugados.push(partidoObj);
              } else {
                proximos.push(partidoObj);
              }
            });

            proximos.sort((a, b) => new Date(`${a.fecha}T${a.hora || "00:00:00"}`) - new Date(`${b.fecha}T${b.hora || "00:00:00"}`));
            jugados.sort((a, b) => new Date(`${b.fecha}T${b.hora || "00:00:00"}`) - new Date(`${a.fecha}T${a.hora || "00:00:00"}`));

            setProximosPartidos(proximos);
            setPartidosJugados(jugados);
          }
        }
        
        setCargandoPartidos(false);

      } catch (error) {
        console.error("Error general perfil:", error);
        setErrorCarga("Ocurrió un error cargando el perfil.");
        setCargando(false);
        setCargandoPartidos(false);
      }
    }

    cargar();
  }, []);

  const onFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
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
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const guardarFotoRecortada = async () => {
    try {
      setSubiendoFoto(true);
      setMensajeFoto("");

      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      setImageSrc(null);

      const filePath = `${userId}/avatar-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedImageBlob, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatar_url = publicUrlData.publicUrl;

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url }).eq("id", userId);

      if (updateError) throw updateError;

      setPerfil((prev) => ({ ...prev, avatar_url }));
      setMensajeFoto("¡Foto de perfil actualizada!");
      setTimeout(() => setMensajeFoto(""), 3000);
    } catch (error) {
      console.error("Error al recortar/subir foto:", error);
      setMensajeFoto(`Error: ${error.message || "Verifica políticas RLS del bucket avatars"}`);
    } finally {
      setSubiendoFoto(false);
    }
  };

  async function crearPerfilFutbol() {
    if (!supabase || !userId) return;
    setCreandoPerfil(true);
    setErrorCarga("");

    await supabase.from("profiles").update({ pais: nacionalidadNueva }).eq("id", userId);

    const { error } = await supabase.from("futbol_profiles").upsert({
      id: userId,
      posicion: posicionNueva,
      pierna_buena: piernaNueva,
    });

    setCreandoPerfil(false);

    if (error) {
      console.error("Error creando perfil de fútbol:", error);
      setErrorCarga(error.message || "No se pudo crear el perfil de fútbol.");
      return;
    }
    window.location.reload();
  }

  async function actualizarPerfilFutbol() {
    if (!supabase || !userId) return;
    setGuardandoPerfil(true);

    let fechaNacCombinada = null;
    if (editAno && editMes && editDia) {
      fechaNacCombinada = `${editAno}-${editMes}-${editDia}`;
    }

    try {
      const { error: errorProfile } = await supabase
        .from("profiles")
        .update({ 
          pais: editNacionalidad,
          fecha_nacimiento: fechaNacCombinada
        })
        .eq("id", userId);

      if (errorProfile) throw errorProfile;

      const { error: errorFutbol } = await supabase
        .from("futbol_profiles")
        .update({ 
          posicion: editPosicion,
          pierna_buena: editPierna 
        })
        .eq("id", userId);

      if (errorFutbol) throw errorFutbol;

      const nuevaEdad = calcularEdad(fechaNacCombinada);

      setPerfil((prev) => ({ 
        ...prev, 
        nacionalidad: editNacionalidad, 
        posicion_preferida: editPosicion,
        pierna_buena: editPierna,
        fecha_nacimiento: fechaNacCombinada,
        edad: nuevaEdad
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
    const g1 = partido.goles_equipo1 || 0;
    const g2 = partido.goles_equipo2 || 0;
    const eq = partido.mi_equipo;

    let esVictoria = false;
    let esEmpate = g1 === g2;

    if (eq === 1 && g1 > g2) esVictoria = true;
    if (eq === 2 && g2 > g1) esVictoria = true;

    const tipo = esEmpate ? "empate" : esVictoria ? "victoria" : "derrota";

    return { ...partido, g1, g2, esVictoria, esEmpate, tipo };
  });

  const historialFiltrado = partidosHistorialProcesados.filter(p => {
    if (filtroHistorial === "todos") return true;
    return p.tipo === filtroHistorial;
  });

  const historialVisible = historialFiltrado.slice(0, cantidadVisible);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!conSesion) {
    return (
      <div className="flex flex-col items-center gap-6 py-20 px-4 text-center">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mb-2">⚽</div>
        <h1 className="text-2xl font-black text-gray-900">Accede a tu perfil</h1>
        <p className="text-gray-500 text-sm max-w-sm font-medium">Inicia sesión para consultar tu carta de jugador, estadísticas y logros.</p>
        <Link href="/login" className="px-8 py-3.5 bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-900 transition-colors shadow-lg">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (errorCarga && !perfil) {
    return <div className="max-w-xl mx-auto my-8 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-center text-sm font-bold">{errorCarga}</div>;
  }

  if (!perfil) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-6 py-12 px-4">
        <div className="text-center">
          <span className="text-5xl">⚽</span>
          <h1 className="text-2xl font-black text-gray-900 mt-3">Crea tu perfil de fútbol</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">Tu cuenta está lista — activa tu ficha de jugador para generar tu carta digital.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col gap-5 border border-gray-100">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nacionalidad</label>
            <select 
              value={nacionalidadNueva} 
              onChange={(e) => setNacionalidadNueva(e.target.value)} 
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
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Posición preferida</label>
              <select value={posicionNueva} onChange={(e) => setPosicionNueva(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]">
                <option value="POR">POR</option>
                <option value="DEF">DEF</option>
                <option value="MED">MED</option>
                <option value="DEL">DEL</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pierna hábil</label>
              <select value={piernaNueva} onChange={(e) => setPiernaNueva(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]">
                <option value="Derecha">Derecha</option>
                <option value="Izquierda">Izquierda</option>
                <option value="Ambidiestro">Ambidiestra</option>
              </select>
            </div>
          </div>

          <button onClick={crearPerfilFutbol} disabled={creandoPerfil} className="mt-2 py-4 rounded-2xl bg-[#0B0C15] text-[#00FF9D] font-black uppercase tracking-widest text-xs hover:bg-gray-900 transition-colors disabled:opacity-50">
            {creandoPerfil ? "Creando..." : "Crear mi perfil de fútbol"}
          </button>
        </div>
      </div>
    );
  }

  const logrosDesbloqueadosCount = logros.filter((l) => l.desbloqueado).length;
  const logrosFiltrados = logros.filter((l) => {
    if (logrosFiltro === "desbloqueados") return l.desbloqueado;
    if (logrosFiltro === "bloqueados") return !l.desbloqueado;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 pt-8 relative">

      {/* MODAL ENGRANAJE: EDITAR FICHA DE FÚTBOL CON DROPDOWNS PARA FECHA */}
      {editandoPerfil && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <h3 className="font-black text-xl text-gray-900 uppercase tracking-tight text-center">Editar Ficha</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Nacionalidad</label>
              <select 
                value={editNacionalidad} 
                onChange={(e) => setEditNacionalidad(e.target.value)} 
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

            {/* SECCIÓN FECHA DE NACIMIENTO: TRES DROPDOWNS (UX SUPERIOR) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fecha de Nacimiento</label>
              <div className="grid grid-cols-3 gap-2">
                {/* Día */}
                <select 
                  value={editDia} 
                  onChange={(e) => setEditDia(e.target.value)} 
                  className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="" disabled>Día</option>
                  {Array.from({ length: 31 }, (_, i) => {
                    const val = String(i + 1).padStart(2, "0");
                    return <option key={val} value={val}>{i + 1}</option>;
                  })}
                </select>

                {/* Mes */}
                <select 
                  value={editMes} 
                  onChange={(e) => setEditMes(e.target.value)} 
                  className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="" disabled>Mes</option>
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

                {/* Año */}
                <select 
                  value={editAno} 
                  onChange={(e) => setEditAno(e.target.value)} 
                  className="border border-gray-200 rounded-xl px-2 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="" disabled>Año</option>
                  {Array.from({ length: 100 }, (_, i) => {
                    const year = new Date().getFullYear() - 10 - i; // Para que no empiecen en bebés
                    return <option key={year} value={year}>{year}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Posición</label>
                <select 
                  value={editPosicion} 
                  onChange={(e) => setEditPosicion(e.target.value)} 
                  className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 font-bold focus:outline-none focus:border-[#00FF9D]"
                >
                  <option value="POR">POR</option>
                  <option value="DEF">DEF</option>
                  <option value="MED">MED</option>
                  <option value="DEL">DEL</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Pierna Hábil</label>
                <select 
                  value={editPierna} 
                  onChange={(e) => setEditPierna(e.target.value)} 
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

      {/* MODAL DE RECORTE DE FOTO DE PERFIL */}
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
            <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="w-full accent-emerald-500" />
            <div className="flex gap-3 mt-2">
              <button onClick={() => setImageSrc(null)} className="flex-1 py-3.5 font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider">Cancelar</button>
              <button onClick={guardarFotoRecortada} className="flex-1 py-3.5 font-black text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors text-xs uppercase tracking-wider shadow-md">Guardar Foto</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 space-y-10">

        {/* ENCABEZADO ESTILO COMUNIDAD */}
        <div className="border-b border-gray-200/80 pb-5">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            Mi perfil de fútbol
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Consulta tu carta digital, gestiona tu avatar y revisa tu rendimiento en la cancha.
          </p>
        </div>

        {/* SECCIÓN SUPERIOR: CARTA + DATOS PERSONALES */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA: CARTA DIGITAL DE JUGADOR */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Carta Oficial</span>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">OVR {stats?.media_general || 64}</span>
            </div>

            {/* 🔥 AQUÍ ESTABA EL ERROR: Faltaba pasar el apellido a PlayerCard 🔥 */}
            <PlayerCard
              nombre={perfil.nombre || "Jugador"}
              apellido={perfil.apellido || ""}
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

          {/* COLUMNA DERECHA: DATOS, AVATAR Y ESTADÍSTICAS */}
          <div className="md:col-span-7 flex flex-col gap-6">
            
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-6">
              
              {/* ENCABEZADO DE TARJETA CON BOTÓN ENGRANAJE EN LA ESQUINA DERECHA */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-emerald-50 border-2 border-gray-200 flex items-center justify-center text-emerald-800 font-black text-xl shadow-sm">
                      {perfil.avatar_url ? (
                        <img src={perfil.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                      ) : (
                        perfil.nombre ? perfil.nombre.slice(0, 2).toUpperCase() : "?"
                      )}
                    </div>
                    
                    <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                      <input type="file" accept="image/*" onChange={onFileChange} className="hidden" disabled={subiendoFoto} />
                    </label>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-gray-900 leading-tight truncate">{perfil.nombre || "Sin nombre"} {perfil.apellido || ""}</h2>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">{perfil.telefono || "Sin teléfono registrado"}</p>
                    
                    <label className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      {subiendoFoto ? "Procesando..." : "Cambiar foto de perfil"}
                      <input type="file" accept="image/*" onChange={onFileChange} className="hidden" disabled={subiendoFoto} />
                    </label>
                  </div>
                </div>

                <button 
                  onClick={() => setEditandoPerfil(true)} 
                  className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-[#0B0C15] hover:text-[#00FF9D] transition-all shadow-sm shrink-0"
                  title="Editar Ficha"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
                  </svg>
                </button>
              </div>

              {mensajeFoto && (
                <div className={`p-3 rounded-xl text-xs font-bold text-center ${mensajeFoto.includes("Error") ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                  {mensajeFoto}
                </div>
              )}

              {/* CRÉDITOS */}
              <div className="flex items-center justify-between bg-yellow-50/60 border border-yellow-200/80 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34-.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.843c-.391-.015-.776-.11-1.116-.281-.51-.255-.884-.71-.884-1.22a1 1 0 10-2 0c0 1.25-.96 2.38-2.215-2.875A4.535 4.535 0 009 14.908V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.249c.391.015.776.11 1.116.281.51.255.884.71.884 1.22a1 1 0 102 0c0-1.25-.96-2.38-2.215-2.875A4.535 4.535 0 0011 5.092V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Saldo de Créditos</p>
                    <p className="font-black text-gray-900 text-xl leading-none mt-0.5">{perfil.creditos || 0} Créditos</p>
                  </div>
                </div>
                <Link href="/futbol/creditos" className="px-4 py-2 bg-[#0B0C15] text-[#00FF9D] text-xs font-black uppercase tracking-wider rounded-xl hover:bg-gray-900 transition-colors shadow-sm">
                  Recargar
                </Link>
              </div>

              {/* GRILLA DE ESTADÍSTICAS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Partidos Jugados</p>
                  <p className="font-black text-gray-900 text-xl mt-0.5">{stats?.partidos_jugados || 0}</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Goles Totales</p>
                  <p className="font-black text-emerald-600 text-xl mt-0.5">{stats?.goles_total || 0} ⚽</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Promedio Goles</p>
                  <p className="font-black text-gray-900 text-xl mt-0.5">{stats?.promedio_goles || "0.00"}</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">% Victorias</p>
                  <p className="font-black text-emerald-600 text-xl mt-0.5">{stats?.win_rate || "0%"}</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Edad</p>
                  <p className="font-black text-gray-900 text-xl mt-0.5">{perfil?.edad || "--"}</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pierna Hábil</p>
                  <p className="font-black text-gray-900 text-xl mt-0.5">{perfil?.pierna_buena || "--"}</p>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 col-span-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Récord de Carrera</p>
                    <p className="font-black text-gray-900 text-sm mt-0.5">
                      <span className="text-emerald-600">{stats?.victorias || 0} Victorias</span> · <span className="text-red-500">{stats?.derrotas || 0} Derrotas</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Posición</p>
                    <p className="font-black text-gray-900 text-sm mt-0.5">{perfil.posicion_preferida || perfil.posicion || "MED"}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* SECCIÓN 2: LOGROS */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">🏆 Mis Logros</h2>
              <p className="text-xs text-gray-400 font-medium">Desbloquea objetivos para subir tu media y atributos de carta.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold shrink-0">
                <button onClick={() => setLogrosFiltro("todos")} className={`px-3 py-1 rounded-lg transition-all ${logrosFiltro === "todos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                  Todos ({logros.length})
                </button>
                <button onClick={() => setLogrosFiltro("desbloqueados")} className={`px-3 py-1 rounded-lg transition-all ${logrosFiltro === "desbloqueados" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                  Completados ({logrosDesbloqueadosCount})
                </button>
              </div>
            </div>
          </div>

          {logrosFiltrados.length === 0 ? (
            <p className="text-sm font-bold text-gray-400 text-center py-6">No hay logros en esta categoría.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide snap-x w-full">
              {logrosFiltrados.map((l) => (
                <div key={l.id} className="snap-start shrink-0 w-64 md:w-72">
                  <LogroBadge label={l.nombre} desc={l.descripcion} bonus={bonusLabel(l)} desbloqueado={l.desbloqueado} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN 3: PRÓXIMOS PARTIDOS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200/80 pb-3">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Próximos Partidos</h2>
            {!cargandoPartidos && (
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                {proximosPartidos.length} Inscrito
              </span>
            )}
          </div>

          {cargandoPartidos ? (
             <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div></div>
          ) : proximosPartidos.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
              <p className="text-gray-400 font-bold text-sm">No estás inscrito en ningún partido próximo.</p>
              <Link href="/futbol" className="inline-block mt-3 px-5 py-2.5 bg-[#0B0C15] text-[#00FF9D] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-900 transition-colors">
                Buscar Partidos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proximosPartidos.map((partido) => (
                <PartidoCard
                  key={partido.id}
                  partido={{
                    id: partido.id,
                    cancha: partido.cancha,
                    zona: partido.zona,
                    fecha: partido.fecha,
                    hora: partido.hora,
                    cuposTotales: partido.cupos_totales || 14,
                    cuposOcupados: partido.cupos_ocupados || 0,
                    precio_creditos: partido.precio_creditos || 1,
                    estado: partido.estado,
                    imagenUrl: partido.sedes?.imagen_url || partido.imagen_url,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN 4: HISTORIAL DE PARTIDOS JUGADOS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200/80 pb-3">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Historial de Partidos</h2>
            
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold w-fit shrink-0">
              <button onClick={() => {setFiltroHistorial("todos"); setCantidadVisible(5);}} className={`px-3 py-1 rounded-lg transition-all ${filtroHistorial === "todos" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                Todos
              </button>
              <button onClick={() => {setFiltroHistorial("victoria"); setCantidadVisible(5);}} className={`px-3 py-1 rounded-lg transition-all ${filtroHistorial === "victoria" ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                V
              </button>
              <button onClick={() => {setFiltroHistorial("empate"); setCantidadVisible(5);}} className={`px-3 py-1 rounded-lg transition-all ${filtroHistorial === "empate" ? "bg-white text-yellow-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                E
              </button>
              <button onClick={() => {setFiltroHistorial("derrota"); setCantidadVisible(5);}} className={`px-3 py-1 rounded-lg transition-all ${filtroHistorial === "derrota" ? "bg-white text-red-600 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                D
              </button>
            </div>
          </div>

          {cargandoPartidos ? (
             <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-[#00FF9D] border-t-transparent rounded-full animate-spin"></div></div>
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
                {historialVisible.map((partido) => {
                  return (
                    <Link
                      key={partido.id}
                      href={`/futbol/partido/${partido.id}`}
                      className="bg-[#0B0C15] text-white rounded-3xl p-5 shadow-sm relative overflow-hidden flex items-center justify-between group hover:border border-gray-700 transition-all"
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${partido.esEmpate ? "bg-yellow-400" : partido.esVictoria ? "bg-[#00FF9D]" : "bg-red-500"}`}></div>

                      <div className="pl-3 pr-2 space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${partido.esEmpate ? "bg-yellow-400/20 text-yellow-400" : partido.esVictoria ? "bg-[#00FF9D]/20 text-[#00FF9D]" : "bg-red-500/20 text-red-400"}`}>
                            {partido.esEmpate ? "Empate" : partido.esVictoria ? "Victoria" : "Derrota"}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">{formatFechaCorta(partido.fecha)}</span>
                        </div>

                        <h3 className="font-black text-white text-base leading-tight uppercase truncate">{partido.cancha}</h3>
                        
                        <p className="text-xs text-gray-400 font-bold">
                          ⚽ <span className="text-white">{partido.mis_goles} {partido.mis_goles === 1 ? "Gol anotado" : "Goles anotados"}</span>
                        </p>
                      </div>

                      <div className="bg-[#121422] rounded-2xl px-4 py-2.5 border border-[#1f233a] text-center shrink-0 ml-auto">
                        <p className="text-xl font-black text-white tracking-wider">
                          {partido.g1}<span className="text-emerald-400 mx-1.5">-</span>{partido.g2}
                        </p>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Resultado</p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {cantidadVisible < historialFiltrado.length && (
                <button
                  onClick={() => setCantidadVisible(prev => prev + 5)}
                  className="w-full mt-2 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-500 font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
                >
                  Cargar anteriores
                </button>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}