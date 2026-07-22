"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function ActualizarClave() {
  const router = useRouter();

  const [clave, setClave] = useState("");
  const [claveConfirm, setClaveConfirm] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mensajeTipo, setMensajeTipo] = useState("neutral");
  const [cargando, setCargando] = useState(false);
  const [sesionLista, setSesionLista] = useState(false);

  // Supabase maneja el token del enlace de recuperación automáticamente
  // cuando el usuario llega desde el email. Escuchamos el evento
  // PASSWORD_RECOVERY para confirmar que la sesión está activa.
  useEffect(() => {
    if (!supabase) return;

    // Si ya hay sesión activa (p.ej. recarga de página), habilitamos el formulario.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSesionLista(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSesionLista(true);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function mostrarMensaje(texto, tipo = "neutral") {
    setMensaje(texto);
    setMensajeTipo(tipo);
  }

  async function guardar() {
    if (!clave || !claveConfirm) {
      mostrarMensaje("Por favor completa ambos campos.", "error");
      return;
    }
    if (clave !== claveConfirm) {
      mostrarMensaje("Las contraseñas no coinciden.", "error");
      return;
    }
    if (clave.length < 6) {
      mostrarMensaje("La contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }

    setCargando(true);
    mostrarMensaje("");

    const { error } = await supabase.auth.updateUser({ password: clave });
    setCargando(false);

    if (error) {
      mostrarMensaje(error.message, "error");
    } else {
      mostrarMensaje("✅ Contraseña actualizada correctamente. Redirigiendo...", "ok");
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
    }
  }

  const mensajeColor =
    mensajeTipo === "ok"
      ? "text-green-700"
      : mensajeTipo === "error"
      ? "text-red-600"
      : "text-gray-600";

  // Mientras Supabase no confirma el token del enlace
  if (!sesionLista) {
    return (
      <div className="max-w-sm mx-auto flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Actualizar contraseña</h1>
        <p className="text-sm text-gray-500">
          Verificando enlace de recuperación...
        </p>
        <p className="text-xs text-gray-400">
          Si esta página no carga, abre el enlace que recibiste en tu correo
          directamente desde el botón del email.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
      <p className="text-sm text-gray-500">
        Elige una contraseña nueva para tu cuenta.
      </p>

      {/* Nueva contraseña */}
      <input
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        placeholder="Nueva contraseña"
        type="password"
        value={clave}
        onChange={(e) => setClave(e.target.value)}
      />

      {/* Confirmar contraseña */}
      <input
        className={`border rounded-lg px-3 py-2 text-sm ${
          claveConfirm && clave !== claveConfirm
            ? "border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            : "border-gray-300"
        }`}
        placeholder="Confirmar nueva contraseña"
        type="password"
        value={claveConfirm}
        onChange={(e) => setClaveConfirm(e.target.value)}
      />
      {claveConfirm && clave !== claveConfirm && (
        <p className="text-xs text-red-500 -mt-2">Las contraseñas no coinciden.</p>
      )}

      {/* Botón */}
      <button
        disabled={cargando}
        onClick={guardar}
        className="bg-cancha-verde text-white rounded-lg py-2 text-sm font-medium hover:bg-cancha-verdeoscuro disabled:opacity-60"
      >
        {cargando ? "Guardando..." : "Guardar nueva contraseña"}
      </button>

      {/* Volver */}
      <button
        onClick={() => router.push("/login")}
        className="text-xs text-gray-500 underline"
      >
        Volver al inicio de sesión
      </button>

      {/* Mensaje */}
      {mensaje && <p className={`text-xs ${mensajeColor}`}>{mensaje}</p>}
    </div>
  );
}
