"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// Catálogo estandarizado de Ciudades para garantizar Rankings sin typos
const CIUDADES_POR_PAIS = {
  VE: ["Barquisimeto", "Caracas", "Valencia", "Maracaibo", "Maracay", "Puerto La Cruz", "San Cristóbal", "Mérida", "Ciudad Guayana", "Barinas", "Otra"],
  AR: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata", "San Miguel de Tucumán", "Otra"],
  CO: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Otra"],
  CL: ["Santiago", "Valparaíso", "Concepción", "Antofagasta", "Temuco", "Otra"],
  ES: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Málaga", "Alicante", "Bilbao", "Otra"],
  MX: ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Querétaro", "Cancún", "Otra"],
  US: ["Miami", "Orlando", "New York", "Houston", "Los Angeles", "Otra"],
  OTRO: ["Otra Ciudad"],
};

const CODIGOS_TELEFONO = {
  VE: "+58",
  AR: "+54",
  CO: "+57",
  CL: "+56",
  ES: "+34",
  MX: "+52",
  US: "+1",
  OTRO: "+1",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modo, setModo] = useState(searchParams.get("modo") === "registro" ? "registro" : "ingreso");
  
  // NUEVO ESTADO PARA MODO ADMIN
  const [modoAdmin, setModoAdmin] = useState(false); 
  
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    nacionalidad: "VE",
    ciudad: "Barquisimeto",
    ciudadPersonalizada: "",
    fecha_nacimiento: "",
    genero: "Masculino",
    codigoArea: "+58",
    telefono: "",
    correo: "",
    clave: "",
    claveConfirm: "",
  });

  const [mensaje, setMensaje] = useState("");
  const [mensajeTipo, setMensajeTipo] = useState("neutral");
  const [cargando, setCargando] = useState(false);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Cambio de país con auto-sincronización de Ciudad y Código de Área
  function cambiarPais(nuevoPais) {
    const ciudades = CIUDADES_POR_PAIS[nuevoPais] || ["Otra"];
    const nuevoCodigo = CODIGOS_TELEFONO[nuevoPais] || "+58";
    
    setForm((f) => ({
      ...f,
      nacionalidad: nuevoPais,
      ciudad: ciudades[0],
      ciudadPersonalizada: "",
      codigoArea: nuevoCodigo,
    }));
  }

  function mostrarMensaje(texto, tipo = "neutral") {
    setMensaje(texto);
    setMensajeTipo(tipo);
  }

  async function enviar() {
    if (!supabase) {
      mostrarMensaje("Falta conectar Supabase (revisa .env.local).", "error");
      return;
    }

    if (modo === "recuperar") {
      if (!form.correo) {
        mostrarMensaje("Ingresa tu correo para continuar.", "error");
        return;
      }

      setCargando(true);
      mostrarMensaje("");

      const { error } = await supabase.auth.resetPasswordForEmail(form.correo, {
        redirectTo: `${window.location.origin}/actualizar-clave`,
      });

      setCargando(false);

      if (error) {
        mostrarMensaje(error.message, "error");
      } else {
        mostrarMensaje(
          "Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.",
          "ok"
        );
      }
      return;
    }

    if (modo === "registro") {
      const ciudadFinal = form.ciudad === "Otra" ? form.ciudadPersonalizada.trim() : form.ciudad;

      if (
        !form.nombre ||
        !form.apellido ||
        !form.nacionalidad ||
        !ciudadFinal ||
        !form.fecha_nacimiento ||
        !form.genero ||
        !form.telefono ||
        !form.correo ||
        !form.clave
      ) {
        mostrarMensaje("Por favor completa todos los campos obligatorios.", "error");
        return;
      }

      if (form.clave !== form.claveConfirm) {
        mostrarMensaje("Las contraseñas no coinciden.", "error");
        return;
      }

      if (form.clave.length < 6) {
        mostrarMensaje("La contraseña debe tener al menos 6 caracteres.", "error");
        return;
      }

      setCargando(true);
      mostrarMensaje("");

      const telefonoCompleto = `${form.codigoArea} ${form.telefono.trim()}`;

      const { data, error } = await supabase.auth.signUp({
        email: form.correo.trim(),
        password: form.clave,
        options: {
          data: {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            pais: form.nacionalidad,
            ciudad: ciudadFinal,
            fecha_nacimiento: form.fecha_nacimiento,
            genero: form.genero,
            telefono: telefonoCompleto,
          },
        },
      });

      if (error) {
        setCargando(false);
        mostrarMensaje(error.message, "error");
        return;
      }

      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.correo.trim(),
          pais: form.nacionalidad,
          ciudad: ciudadFinal,
          telefono: telefonoCompleto,
        });

        setCargando(false);
        mostrarMensaje("¡Cuenta creada con éxito!", "ok");
        // REDIRECCIÓN LIMPIA PARA REGISTRO
        window.location.href = "/";
      }

      return;
    }

    // INGRESO (Jugador o Admin)
    setCargando(true);
    mostrarMensaje("");

    const { error } = await supabase.auth.signInWithPassword({
      email: form.correo.trim(),
      password: form.clave,
    });

    setCargando(false);

    if (error) {
      mostrarMensaje(error.message, "error");
    } else {
      mostrarMensaje("Ingresaste correctamente.", "ok");
      
      // REDIRECCIÓN LIMPIA (Evita error removeChild de Next.js)
      if (modoAdmin) {
        window.location.href = "/admin/recepcion"; 
      } else {
        window.location.href = "/"; 
      }
    }
  }

  const mensajeColor =
    mensajeTipo === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : mensajeTipo === "error"
      ? "text-red-600 bg-red-50 border-red-100"
      : "text-gray-600 bg-gray-50 border-gray-100";

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00FF9D]/40 focus:border-[#00FF9D] transition-colors";

  const ciudadesDisponibles = CIUDADES_POR_PAIS[form.nacionalidad] || ["Otra"];

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 bg-slate-50">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
        
        {/* LINEA VERDE DE ADMIN (SOLO VISIBLE EN MODO ADMIN) */}
        {modoAdmin && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#00FF9D]"></div>
        )}

        {/* ENCABEZADO */}
        <div className="text-center">
          <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-3 ${modoAdmin ? 'bg-slate-900' : 'bg-[#00FF9D]/10'}`}>
            {modoAdmin ? '🏢' : '🏟️'}
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {modoAdmin 
              ? "Acceso Administrativo" 
              : modo === "registro"
                ? "Crea tu cuenta"
                : modo === "ingreso"
                  ? "Bienvenido de vuelta"
                  : "Recupera tu contraseña"}
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {modoAdmin 
              ? "Panel exclusivo para Recepción y Gerencia."
              : modo === "registro"
                ? "Una sola cuenta para fútbol, pádel y tus estadísticas."
                : modo === "ingreso"
                  ? "Ingresa con tu correo y contraseña."
                  : "Te enviaremos un enlace para restablecerla."}
          </p>
        </div>

        {/* SELECTOR MODO (OCULTO EN MODO ADMIN Y RECUPERAR) */}
        {!modoAdmin && modo !== "recuperar" && (
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => {
                setModo("ingreso");
                mostrarMensaje("");
              }}
              className={`py-2 rounded-full text-xs font-extrabold transition-all ${
                modo === "ingreso"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("registro");
                mostrarMensaje("");
              }}
              className={`py-2 rounded-full text-xs font-extrabold transition-all ${
                modo === "registro"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {/* FORMULARIO */}
        <div className="flex flex-col gap-3.5">
          {modo === "registro" && !modoAdmin && (
            <>
              {/* NOMBRES Y APELLIDOS */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Nombre
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Ej. Juan"
                    value={form.nombre}
                    onChange={(e) => actualizar("nombre", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Apellido
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Ej. Pérez"
                    value={form.apellido}
                    onChange={(e) => actualizar("apellido", e.target.value)}
                  />
                </div>
              </div>

              {/* PAÍS Y CIUDAD */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    País
                  </label>
                  <select
                    className={inputClass}
                    value={form.nacionalidad}
                    onChange={(e) => cambiarPais(e.target.value)}
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

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Ciudad
                  </label>
                  <select
                    className={inputClass}
                    value={form.ciudad}
                    onChange={(e) => actualizar("ciudad", e.target.value)}
                  >
                    {ciudadesDisponibles.map((ciudad) => (
                      <option key={ciudad} value={ciudad}>
                        {ciudad}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CAMPO TEXTO SI ELIGE OTRA CIUDAD */}
              {form.ciudad === "Otra" && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Escribe tu ciudad
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Ej. Barinas..."
                    value={form.ciudadPersonalizada}
                    onChange={(e) => actualizar("ciudadPersonalizada", e.target.value)}
                  />
                </div>
              )}

              {/* NACIMIENTO Y GÉNERO */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Nacimiento
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.fecha_nacimiento}
                    onChange={(e) => actualizar("fecha_nacimiento", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                    Género
                  </label>
                  <select
                    className={inputClass}
                    value={form.genero}
                    onChange={(e) => actualizar("genero", e.target.value)}
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="No binario">No binario</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* TELÉFONO */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                  Teléfono
                </label>
                <div className="flex w-full items-center border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-[#00FF9D]/40 focus-within:border-[#00FF9D] transition-all">
                  <select
                    className="bg-transparent border-none text-xs font-extrabold text-gray-800 px-3 py-2.5 outline-none shrink-0 cursor-pointer"
                    value={form.codigoArea}
                    onChange={(e) => actualizar("codigoArea", e.target.value)}
                  >
                    <option value="+58">🇻🇪 +58</option>
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+57">🇨🇴 +57</option>
                    <option value="+56">🇨🇱 +56</option>
                    <option value="+34">🇪🇸 +34</option>
                    <option value="+52">🇲🇽 +52</option>
                    <option value="+1">🇺🇸 +1</option>
                  </select>
                  <div className="h-5 w-[1px] bg-gray-200 shrink-0" />
                  <input
                    className="w-full bg-transparent border-none px-3 py-2.5 text-xs font-semibold text-gray-800 placeholder-gray-400 outline-none min-w-0"
                    placeholder="0414 1234567"
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => actualizar("telefono", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* CORREO (SIEMPRE VISIBLE) */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
              Correo Electrónico
            </label>
            <input
              className={inputClass}
              placeholder="tucorreo@ejemplo.com"
              type="email"
              value={form.correo}
              onChange={(e) => actualizar("correo", e.target.value)}
            />
          </div>

          {/* CONTRASEÑA */}
          {modo !== "recuperar" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                Contraseña
              </label>
              <input
                className={inputClass}
                placeholder="Mínimo 6 caracteres"
                type="password"
                value={form.clave}
                onChange={(e) => actualizar("clave", e.target.value)}
              />
            </div>
          )}

          {/* CONFIRMAR CONTRASEÑA (SOLO REGISTRO Y NO ADMIN) */}
          {modo === "registro" && !modoAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                Confirmar contraseña
              </label>
              <input
                className={`${inputClass} ${
                  form.claveConfirm && form.clave !== form.claveConfirm
                    ? "border-rose-300 focus:ring-rose-200 focus:border-rose-400"
                    : ""
                }`}
                placeholder="Repite tu contraseña"
                type="password"
                value={form.claveConfirm}
                onChange={(e) => actualizar("claveConfirm", e.target.value)}
              />
            </div>
          )}

          {/* BOTÓN PRINCIPAL */}
          <button
            disabled={cargando}
            onClick={enviar}
            className={`mt-3 rounded-2xl py-3.5 text-xs font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-60 ${
              modoAdmin 
                ? "bg-slate-900 text-[#00FF9D] hover:bg-slate-800" 
                : "bg-[#0B0C15] text-[#00FF9D] hover:bg-slate-900"
            }`}
          >
            {cargando
              ? "Un momento..."
              : modoAdmin 
                ? "Acceder al Panel"
                : modo === "registro"
                  ? "Crear cuenta"
                  : modo === "ingreso"
                    ? "Ingresar"
                    : "Enviar correo de recuperación"}
          </button>

          {modo === "ingreso" && !modoAdmin && (
            <button
              onClick={() => {
                setModo("recuperar");
                mostrarMensaje("");
              }}
              className="text-xs text-gray-500 font-bold hover:text-gray-900 text-center transition-colors mt-1"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {modo === "recuperar" && (
            <button
              onClick={() => {
                setModo("ingreso");
                mostrarMensaje("");
              }}
              className="text-xs text-gray-500 font-bold hover:text-gray-900 text-center transition-colors mt-1"
            >
              Volver al inicio de sesión
            </button>
          )}

          {/* ⚡ BOTON: ¿ERES ADMIN O GERENCIA? ⚡ */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-center">
            <button 
              onClick={() => {
                setModoAdmin(!modoAdmin);
                setModo("ingreso"); // Forzamos ir a modo ingreso al cambiar
                mostrarMensaje("");
              }}
              className="text-[11px] font-black text-slate-800 hover:text-emerald-600 transition-colors uppercase tracking-widest"
            >
              {modoAdmin ? "← Volver a acceso de Jugadores" : "⚙️ ¿Eres Admin o Gerencia?"}
            </button>
          </div>

        </div>

        {mensaje && (
          <p className={`text-xs font-bold text-center rounded-2xl border px-3 py-3 ${mensajeColor}`}>
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}