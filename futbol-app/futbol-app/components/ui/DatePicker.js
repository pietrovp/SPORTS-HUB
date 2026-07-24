"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import "react-day-picker/dist/style.css";

export default function DatePicker({ value, onChange, placeholder = "Seleccionar fecha" }) {
  const [abierto, setAbierto] = useState(false);
  const containerRef = useRef(null);

  // Convertir string "YYYY-MM-DD" a objeto Date seguro
  const fechaSeleccionada = value ? new Date(`${value}T00:00:00`) : undefined;

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (date) => {
    if (date) {
      // Formato YYYY-MM-DD para la base de datos
      const formattedDate = format(date, "yyyy-MM-dd");
      onChange(formattedDate);
    } else {
      onChange("");
    }
    setAbierto(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* BOTÓN TRIGGER */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-800 font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00FF9D]/30 focus:border-[#00FF9D] transition-colors"
      >
        <span className={fechaSeleccionada ? "text-gray-900" : "text-gray-400 font-normal"}>
          {fechaSeleccionada
            ? format(fechaSeleccionada, "d 'de' MMMM, yyyy", { locale: es })
            : placeholder}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* POPOVER CON EL CALENDARIO SHADCN STYLE */}
      {abierto && (
        <div className="absolute top-full mt-2 left-0 z-[300] bg-[#0B0C15] border border-gray-800 text-white rounded-3xl p-4 shadow-2xl backdrop-blur-md">
          <style>{`
            .rdp {
              --rdp-cell-size: 38px;
              --rdp-accent-color: #00FF9D;
              --rdp-background-color: rgba(0, 255, 157, 0.15);
              margin: 0;
            }
            .rdp-day_selected {
              color: #0B0C15 !important;
              font-weight: 900 !important;
              border-radius: 12px !important;
            }
            .rdp-day:hover:not(.rdp-day_selected) {
              background-color: #1a1d2e !important;
              border-radius: 12px !important;
            }
            .rdp-caption_label {
              font-weight: 900;
              text-transform: capitalize;
              color: #ffffff;
            }
            .rdp-nav_button {
              color: #9ca3af;
            }
            .rdp-nav_button:hover {
              color: #00FF9D;
            }
            .rdp-head_cell {
              color: #6b7280;
              font-size: 0.75rem;
              font-weight: 700;
              text-transform: uppercase;
            }
          `}</style>
          
          <DayPicker
            mode="single"
            selected={fechaSeleccionada}
            onSelect={handleSelect}
            locale={es}
            captionLayout="dropdown"
            fromYear={1950}
            toYear={new Date().getFullYear() + 2}
          />
        </div>
      )}
    </div>
  );
}