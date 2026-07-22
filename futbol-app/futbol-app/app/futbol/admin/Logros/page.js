"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { STAT_OPCIONES, REQUISITO_OPCIONES, requisitoLabel, bonusLabel } from "../../../../lib/futbol/logros";

export default function AdminLogros() {
  const [verificando, setVerificando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  const [logros, setLogros] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    stat_mejora: "rating", // <--- Corregido a 'rating'
    valor_mejora: "",
    tipo_requisito: "partidos_jugados",
    requisito_valor: "",
    requisito_partidos: "",
  });

  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    async function verificar() {
      if (!supabase) {
        setVerificando(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setVerificando(false);
        return;
      }

      // Verificación con profiles e is_admin
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

      setAutorizado(!!data?.is_admin);
      setVerificando(false);

      if (data?.is_admin) {
        cargarLogros();
      }
    }
    verificar();
  }, []);

  async function cargarLogros() {
    setCargandoLista(true);
    const { data, error } = await supabase.from("logros").select("*").order("created_at", { ascending: false });
    
    // Mapeamos 'titulo' a 'nombre' para que la lista interna siga funcionando igual
    const logrosMapeados = data?.map(l => ({
      ...l,
      nombre: l.titulo || l.nombre
    })) || [];

    if (!error) setLogros(logrosMapeados);
    setCargandoLista(false);
  }

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function crearLogro() {
    setMensaje({ texto: "", tipo: "" });

    if (!form.nombre || !form.descripcion || !form.valor_mejora || !form.requisito_valor) {
      setMensaje({ texto: "Completa todos los campos obligatorios.", tipo: "error" });
      return;
    }

    if (form.tipo_requisito === "goles_en_partidos" && !form.requisito_partidos) {
      setMensaje({ texto: "Indica en cuántos partidos como máximo debe lograr esos goles.", tipo: "error" });
      return;
    }

    setGuardando(true);

    // Inserción usando 'titulo' y el stat corregido ('rating')
    const { error } = await supabase.from("logros").insert({
      titulo: form.nombre,
      descripcion: form.descripcion,
      stat_mejora: form.stat_mejora,
      valor_mejora: Number(form.valor_mejora),
      tipo_requisito: form.tipo_requisito,
      requisito_valor: Number(form.requisito_valor),
      requisito_partidos:
        form.tipo_requisito === "goles_en_partidos" ? Number(form.requisito_partidos) : null,
      activo: true
    });

    setGuardando(false);

    if (error) {
      setMensaje({ texto: "No se pudo crear: " + error.message, tipo: "error" });
      return;
    }

    setMensaje({ texto: "Logro creado con éxito.", tipo: "exito" });
    setForm({
      nombre: "",
      descripcion: "",
      stat_mejora: "rating", // <--- Corregido a 'rating'
      valor_mejora: "",
      tipo_requisito: "partidos_jugados",
      requisito_valor: "",
      requisito_partidos: "",
    });
    cargarLogros();
  }

  async function alternarActivo(logro) {
    await supabase.from("logros").update({ activo: !logro.activo }).eq("id", logro.id);
    cargarLogros();
  }

  async function eliminarLogro(logro) {
    if (!confirm(`¿Eliminar el logro "${logro.nombre}"? Esta acción no se puede deshacer.`)) return;
    await supabase.from("logros").delete().eq("id", logro.id);
    cargarLogros();
  }

  if (verificando) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border border-red-200 text-center shadow-sm mt-12">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h1>
        <p className="text-sm text-gray-500 font-medium">Esta sección es exclusiva para administradores.</p>
      </div>
    );
  }

  const inputClass =
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Logros</h1>
        <p className="text-sm text-gray-500 mt-1.5 font-medium">
          Crea objetivos que los jugadores puedan desbloquear jugando partidos.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 flex flex-col gap-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Nombre del objetivo
          </label>
          <input
            className={inputClass}
            placeholder="Ej. Cazagoles"
            value={form.nombre}
            onChange={(e) => actualizar("nombre", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Descripción
          </label>
          <input
            className={inputClass}
            placeholder="Ej. Anota 15 goles en total"
            value={form.descripcion}
            onChange={(e) => actualizar("descripcion", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Qué mejora
            </label>
            <select
              className={`${inputClass} appearance-none cursor-pointer`}
              value={form.stat_mejora}
              onChange={(e) => actualizar("stat_mejora", e.target.value)}
            >
              {STAT_OPCIONES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Cuánto mejora
            </label>
            <input
              className={inputClass}
              type="number"
              min="1"
              placeholder="Ej. 3"
              value={form.valor_mejora}
              onChange={(e) => actualizar("valor_mejora", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Requisito para desbloquear
          </label>
          <select
            className={`${inputClass} appearance-none cursor-pointer`}
            value={form.tipo_requisito}
            onChange={(e) => actualizar("tipo_requisito", e.target.value)}
          >
            {REQUISITO_OPCIONES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className={`grid ${form.tipo_requisito === "goles_en_partidos" ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              {form.tipo_requisito === "partidos_jugados" && "Cantidad de partidos"}
              {form.tipo_requisito === "goles_en_partidos" && "Cantidad de goles"}
              {form.tipo_requisito === "goles_en_un_partido" && "Goles en el partido"}
              {form.tipo_requisito === "victorias" && "Cantidad de victorias"}
              {form.tipo_requisito === "victorias_seguidas" && "Victorias seguidas"}
            </label>
            <input
              className={inputClass}
              type="number"
              min="1"
              placeholder="Ej. 10"
              value={form.requisito_valor}
              onChange={(e) => actualizar("requisito_valor", e.target.value)}
            />
          </div>

          {form.tipo_requisito === "goles_en_partidos" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                En máximo cuántos partidos
              </label>
              <input
                className={inputClass}
                type="number"
                min="1"
                placeholder="Ej. 5"
                value={form.requisito_partidos}
                onChange={(e) => actualizar("requisito_partidos", e.target.value)}
              />
            </div>
          )}
        </div>

        {mensaje.texto && (
          <div
            className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
              mensaje.tipo === "exito"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        <button
          disabled={guardando}
          onClick={crearLogro}
          className={`w-full rounded-xl py-3.5 text-sm font-bold shadow-sm transition-all ${
            guardando
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500 text-white active:scale-[0.98]"
          }`}
        >
          {guardando ? "Creando..." : "Crear logro"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
        <h2 className="font-bold text-gray-800 mb-4">Logros existentes</h2>

        {cargandoLista ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : logros.length === 0 ? (
          <p className="text-sm text-gray-400">Aún no has creado ningún logro.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logros.map((l) => (
              <div
                key={l.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  l.activo ? "bg-white border-gray-100" : "bg-gray-50 border-gray-100 opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{l.nombre}</p>
                  <p className="text-xs text-gray-500 truncate">{l.descripcion}</p>
                  <p className="text-xs text-cancha-verde font-semibold mt-0.5">
                    {bonusLabel(l)} · {requisitoLabel(l)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => alternarActivo(l)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                      l.activo
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-cancha-verde/10 text-cancha-verdeoscuro hover:bg-cancha-verde/20"
                    }`}
                  >
                    {l.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => eliminarLogro(l)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}