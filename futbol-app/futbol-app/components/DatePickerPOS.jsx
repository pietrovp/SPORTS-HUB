"use client";

import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { es } from "date-fns/locale/es";

registerLocale("es", es);

export default function DatePickerPOS({ selectedDate, onChange, label }) {
  // Convertir string "YYYY-MM-DD" a objeto Date
  const dateObj = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();

  const handleDateChange = (date) => {
    if (!date) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${day}`);
  };

  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-[10px] font-black uppercase text-slate-400">
          {label}
        </label>
      )}
      <div className="relative">
        <DatePicker
          selected={dateObj}
          onChange={handleDateChange}
          dateFormat="dd / MM / yyyy"
          locale="es"
          className="w-full bg-slate-900 text-[#00FF9D] border border-slate-800 rounded-xl p-2.5 text-xs font-black outline-none focus:border-[#00FF9D] cursor-pointer shadow-sm text-center"
          calendarClassName="custom-calendar-dark"
        />
      </div>

      {/* ESTILOS PERSONALIZADOS PARA EL CALENDARIO */}
      <style jsx global>{`
        .react-datepicker-wrapper {
          width: 100%;
        }
        .custom-calendar-dark {
          background-color: #0b0c15 !important;
          border: 1px solid #1e293b !important;
          border-radius: 1.25rem !important;
          font-family: inherit !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5) !important;
          padding: 10px !important;
          color: #ffffff !important;
        }
        .react-datepicker__header {
          background-color: #0b0c15 !important;
          border-bottom: 1px solid #1e293b !important;
        }
        .react-datepicker__current-month,
        .react-datepicker-time__header,
        .react-datepicker-year-header {
          color: #00ff9d !important;
          font-weight: 900 !important;
          font-size: 0.85rem !important;
          text-transform: uppercase !important;
        }
        .react-datepicker__day-name {
          color: #64748b !important;
          font-weight: 800 !important;
        }
        .react-datepicker__day {
          color: #f8fafc !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
        }
        .react-datepicker__day:hover {
          background-color: #1e293b !important;
          color: #00ff9d !important;
        }
        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected {
          background-color: #00ff9d !important;
          color: #0b0c15 !important;
          font-weight: 900 !important;
        }
        .react-datepicker__navigation-icon::before {
          border-color: #00ff9d !important;
        }
      `}</style>
    </div>
  );
}