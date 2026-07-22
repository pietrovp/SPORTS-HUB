"use client";

import { useState, useRef, useEffect } from "react";
import { COUNTRIES, getFlagEmoji } from "../lib/countries";

export default function CountrySelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const seleccionado = COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];

  const filtrados = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(busqueda.toLowerCase())
  );

  useEffect(() => {
    function handleClickFuera(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setBusqueda("");
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  function seleccionar(code) {
    onChange(code);
    setOpen(false);
    setBusqueda("");
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-800 shadow-sm hover:border-cancha-verde transition-colors focus:outline-none focus:ring-2 focus:ring-cancha-verde/30"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-lg leading-none">{getFlagEmoji(seleccionado.code)}</span>
          <span className="truncate">{seleccionado.name}</span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-dropdown-in origin-top">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar pais..."
              className="w-full text-sm px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-cancha-verde/30 text-gray-800 placeholder-gray-400"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">Sin resultados.</p>
            ) : (
              filtrados.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => seleccionar(c.code)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    c.code === value
                      ? "bg-cancha-verde/10 text-cancha-verdeoscuro font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg leading-none">{getFlagEmoji(c.code)}</span>
                  <span className="truncate">{c.name}</span>
                  {c.code === value && (
                    <svg
                      className="w-4 h-4 ml-auto text-cancha-verde shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}