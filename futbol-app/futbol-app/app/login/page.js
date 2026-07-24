"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

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
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    nacionalidad: "VE", // Predeterminado
    fecha_nacimiento: "",
    genero: "",
    codigoArea: "+58", // Predeterminado
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
      if (
        !form.nombre ||
        !form.apellido ||
        !form.nacionalidad ||
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

      const telefonoCompleto = `${form.codigoArea} ${form.telefono}`;

      const { data, error } = await supabase.auth.signUp({
        email: form.correo,
        password: form.clave,
        options: {
          data: {
            nombre: form.nombre,
            apellido: form.apellido,
            pais: form.nacionalidad,
            fecha_nacimiento: form.fecha_nacimiento,
            genero: form.genero,
            telefono: telefonoCompleto,
          },
        },
      });

      setCargando(false);

      if (error) {
        mostrarMensaje(error.message, "error");
      } else if (data.user) {
        mostrarMensaje("Cuenta creada con éxito.", "ok");
        router.push("/");
        router.refresh();
      }

      return;
    }

    setCargando(true);
    mostrarMensaje("");

    const { error } = await supabase.auth.signInWithPassword({
      email: form.correo,
      password: form.clave,
    });

    setCargando(false);

    if (error) {
      mostrarMensaje(error.message, "error");
    } else {
      mostrarMensaje("Ingresaste correctamente.", "ok");
      router.push("/");
      router.refresh();
    }
  }

  const mensajeColor =
    mensajeTipo === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-100"
      : mensajeTipo === "error"
      ? "text-red-600 bg-red-50 border-red-100"
      : "text-gray-600 bg-gray-50 border-gray-100";

  const inputClass =
    "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00FF9D]/30 focus:border-[#00FF9D] transition-colors";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col gap-6">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00FF9D]/10 flex items-center justify-center text-3xl mb-3">
            🏟️
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {modo === "registro"
              ? "Crea tu cuenta"
              : modo === "ingreso"
              ? "Bienvenido de vuelta"
              : "Recupera tu contraseña"}
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            {modo === "registro"
              ? "Una sola cuenta para fútbol, pádel y lo que venga después."
              : modo === "ingreso"
              ? "Ingresa con tu correo y contraseña."
              : "Te enviaremos un enlace para restablecerla."}
          </p>
        </div>

        {modo !== "recuperar" && (
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => {
                setModo("ingreso");
                mostrarMensaje("");
              }}
              className={`py-2 rounded-full text-sm font-bold transition-all ${
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
              className={`py-2 rounded-full text-sm font-bold transition-all ${
                modo === "registro"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Crear cuenta
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {modo === "registro" && (
            <>
              {/* NOMBRES Y APELLIDOS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Nombre
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Ej. Juan"
                    value={form.nombre}
                    onChange={(e) => actualizar("nombre", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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

              {/* NACIONALIDAD Y FECHA DE NACIMIENTO */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Nacionalidad
                  </label>
                  <select
                    className={inputClass}
                    value={form.nacionalidad}
                    onChange={(e) => actualizar("nacionalidad", e.target.value)}
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
                    Nacimiento
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.fecha_nacimiento}
                    onChange={(e) => actualizar("fecha_nacimiento", e.target.value)}
                  />
                </div>
              </div>

              {/* GÉNERO Y TELÉFONO (Con más espacio para el teléfono) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Género
                  </label>
                  <select
                    className={inputClass}
                    value={form.genero}
                    onChange={(e) => actualizar("genero", e.target.value)}
                  >
                    <option value="" disabled>Elige...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="No binario">No binario</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Teléfono
                  </label>
                  <div className="flex gap-2">
                    <select
                      className={`${inputClass} w-[105px] px-2 text-center shrink-0`}
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
                    <input
                      className={`${inputClass} flex-1 min-w-0`}
                      placeholder="0414 1234567"
                      type="tel"
                      value={form.telefono}
                      onChange={(e) => actualizar("telefono", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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

          {modo !== "recuperar" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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

          {modo === "registro" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Confirmar contraseña
              </label>
              <input
                className={`${inputClass} ${
                  form.claveConfirm && form.clave !== form.claveConfirm
                    ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                    : ""
                }`}
                placeholder="Repite tu contraseña"
                type="password"
                value={form.claveConfirm}
                onChange={(e) => actualizar("claveConfirm", e.target.value)}
              />
              {form.claveConfirm && form.clave !== form.claveConfirm && (
                <p className="text-xs text-red-500 font-medium">Las contraseñas no coinciden.</p>
              )}
            </div>
          )}

          <button
            disabled={cargando}
            onClick={enviar}
            className="mt-2 bg-[#0B0C15] text-[#00FF9D] rounded-xl py-3.5 text-sm font-black uppercase tracking-widest hover:bg-gray-900 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg"
          >
            {cargando
              ? "Un momento..."
              : modo === "registro"
              ? "Crear cuenta"
              : modo === "ingreso"
              ? "Ingresar"
              : "Enviar correo de recuperación"}
          </button>

          {modo === "ingreso" && (
            <button
              onClick={() => {
                setModo("recuperar");
                mostrarMensaje("");
              }}
              className="text-xs text-gray-500 font-semibold hover:text-[#0B0C15] hover:underline text-center transition-colors"
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
              className="text-xs text-gray-500 font-semibold hover:text-[#0B0C15] hover:underline text-center transition-colors"
            >
              Volver al inicio de sesión
            </button>
          )}
        </div>

        {mensaje && (
          <p className={`text-xs font-bold text-center rounded-xl border px-3 py-3 ${mensajeColor}`}>
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}