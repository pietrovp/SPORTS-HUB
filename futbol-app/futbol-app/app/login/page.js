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
          "Te enviamos un correo para restablecer tu contrasena. Revisa tu bandeja de entrada.",
          "ok"
        );
      }
      return;
    }

    if (modo === "registro") {
      if (!form.nombre || !form.correo || !form.clave) {
        mostrarMensaje("Por favor completa todos los campos obligatorios.", "error");
        return;
      }

      if (form.clave !== form.claveConfirm) {
        mostrarMensaje("Las contrasenas no coinciden.", "error");
        return;
      }

      if (form.clave.length < 6) {
        mostrarMensaje("La contrasena debe tener al menos 6 caracteres.", "error");
        return;
      }

      setCargando(true);
      mostrarMensaje("");

      // Este alta solo crea la CUENTA NÚCLEO (auth.users + fila en `cuentas`,
      // esta última vía trigger en la base de datos). Los perfiles de fútbol
      // y/o pádel se crean después, desde /futbol/perfil y /padel/perfil.
      const { data, error } = await supabase.auth.signUp({
        email: form.correo,
        password: form.clave,
        options: {
          data: {
            nombre: form.nombre,
            telefono: form.telefono,
          },
        },
      });

      setCargando(false);

      if (error) {
        mostrarMensaje(error.message, "error");
      } else if (data.user) {
        mostrarMensaje("Cuenta creada con exito.", "ok");
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
    "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-cancha-verde/30 focus:border-cancha-verde transition-colors";

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col gap-6">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cancha-verde/10 flex items-center justify-center text-3xl mb-3">
            🏟️
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {modo === "registro"
              ? "Crea tu cuenta"
              : modo === "ingreso"
              ? "Bienvenido de vuelta"
              : "Recupera tu contrasena"}
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            {modo === "registro"
              ? "Una sola cuenta para fútbol, pádel y lo que venga después."
              : modo === "ingreso"
              ? "Ingresa con tu correo y contrasena."
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Nombre completo
                </label>
                <input
                  className={inputClass}
                  placeholder="Ej. Juan Perez"
                  value={form.nombre}
                  onChange={(e) => actualizar("nombre", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Telefono
                </label>
                <input
                  className={inputClass}
                  placeholder="Ej. 0414-1234567"
                  value={form.telefono}
                  onChange={(e) => actualizar("telefono", e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Correo
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
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Contrasena
              </label>
              <input
                className={inputClass}
                placeholder="Minimo 6 caracteres"
                type="password"
                value={form.clave}
                onChange={(e) => actualizar("clave", e.target.value)}
              />
            </div>
          )}

          {modo === "registro" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Confirmar contrasena
              </label>
              <input
                className={`${inputClass} ${
                  form.claveConfirm && form.clave !== form.claveConfirm
                    ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                    : ""
                }`}
                placeholder="Repite tu contrasena"
                type="password"
                value={form.claveConfirm}
                onChange={(e) => actualizar("claveConfirm", e.target.value)}
              />
              {form.claveConfirm && form.clave !== form.claveConfirm && (
                <p className="text-xs text-red-500">Las contrasenas no coinciden.</p>
              )}
            </div>
          )}

          <button
            disabled={cargando}
            onClick={enviar}
            className="mt-1 bg-cancha-verde text-white rounded-xl py-3 text-sm font-bold hover:bg-cancha-verdeoscuro active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm"
          >
            {cargando
              ? "Un momento..."
              : modo === "registro"
              ? "Crear cuenta"
              : modo === "ingreso"
              ? "Ingresar"
              : "Enviar correo de recuperacion"}
          </button>

          {modo === "ingreso" && (
            <button
              onClick={() => {
                setModo("recuperar");
                mostrarMensaje("");
              }}
              className="text-xs text-cancha-verde font-semibold hover:underline text-center"
            >
              Olvidaste tu contrasena?
            </button>
          )}

          {modo === "recuperar" && (
            <button
              onClick={() => {
                setModo("ingreso");
                mostrarMensaje("");
              }}
              className="text-xs text-gray-500 font-semibold hover:underline text-center"
            >
              Volver al inicio de sesion
            </button>
          )}
        </div>

        {mensaje && (
          <p className={`text-xs font-medium text-center rounded-xl border px-3 py-2.5 ${mensajeColor}`}>
            {mensaje}
          </p>
        )}
      </div>
    </div>
  );
}