"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

// --- PREGUNTAS Y PUNTUACIONES ---
const PREGUNTAS = [
  {
    titulo: "En la siguiente escala, ¿dónde te colocarías?",
    opciones: [
      { texto: "Iniciación", puntos: 1.0 },
      { texto: "Intermedio", puntos: 3.0 },
      { texto: "Avanzado", puntos: 5.0 },
      { texto: "Profesional", puntos: 7.0 },
    ]
  },
  {
    titulo: "¿Cuántos años llevas practicando pádel o un deporte de raqueta?",
    opciones: [
      { texto: "Nunca he jugado", puntos: -0.5 },
      { texto: "Menos de un año", puntos: 0.0 },
      { texto: "Entre 1 y 3 años", puntos: 0.5 },
      { texto: "Entre 3 y 5 años", puntos: 1.0 },
      { texto: "Más de 5 años", puntos: 1.5 },
    ]
  },
  {
    titulo: "En los rebotes...",
    opciones: [
      { texto: "No sé cómo leerlos, golpeo antes", puntos: -0.5 },
      { texto: "Intento, con dificultad, golpear en pared", puntos: 0.0 },
      { texto: "Devuelvo rebotes en pared de fondo", puntos: 0.5 },
      { texto: "Devuelvo rebotes a dos paredes", puntos: 1.0 },
      { texto: "Realizo bajadas de pared con potencia", puntos: 1.5 },
    ]
  },
  {
    titulo: "¿Has recibido o recibes formación en pádel?",
    opciones: [
      { texto: "No", puntos: 0.0 },
      { texto: "Sí, en el pasado", puntos: 0.5 },
      { texto: "Sí, actualmente", puntos: 1.0 },
    ]
  }
];

export default function NivelacionPadel() {
  const router = useRouter();
  const [paso, setPaso] = useState(0); 
  const [respuestas, setRespuestas] = useState({});
  const [ratingFinal, setRatingFinal] = useState(0);
  const [cargando, setCargando] = useState(false);

  // Extras básicos del perfil
  const [posicion, setPosicion] = useState("Drive");
  const [manoHabil, setManoHabil] = useState("Derecha");

  const seleccionarOpcion = (indexPregunta, puntos) => {
    setRespuestas({ ...respuestas, [indexPregunta]: puntos });
    
    // Pequeño timeout para que se vea el efecto de "click" antes de avanzar
    setTimeout(() => {
      if (paso < PREGUNTAS.length) {
        setPaso(paso + 1);
      } else {
        calcularNivel();
      }
    }, 150);
  };

  const calcularNivel = () => {
    let total = Object.values(respuestas).reduce((a, b) => a + b, 0);
    total = Math.max(0, Math.min(7.0, total));
    setRatingFinal(total);
    setPaso(5); 
  };

  const getEtiquetaNivel = (rating) => {
    if (rating < 2) return "Principiante";
    if (rating < 4) return "Intermedio";
    if (rating < 6) return "Avanzado";
    return "Profesional";
  };

  const guardarPerfil = async () => {
    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("Debes iniciar sesión primero");
      return;
    }

    const { error } = await supabase.from("padel_profiles").upsert({
      id: user.id,
      posicion: posicion,
      mano_habil: manoHabil,
      nivel: getEtiquetaNivel(ratingFinal),
      rating: parseFloat(ratingFinal).toFixed(2), 
    });

    setCargando(false);

    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      router.push("/padel/perfil");
    }
  };

  // Estilos de inputs reutilizables
  const inputClass = "w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none cursor-pointer font-medium";

  return (
    <div className="min-h-[90vh] flex flex-col items-center justify-center p-4 bg-gray-50/50">
      
      {/* 
        Inyectamos una animación CSS súper suave y nativa 
        para que los elementos "floten" hacia arriba al aparecer.
      */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* --- VISTA 0: BIENVENIDA --- */}
      {paso === 0 && (
        <div key="step-0" className="w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-8 flex flex-col items-center text-center animate-slide-up">
          <div className="w-24 h-24 bg-gradient-to-tr from-lime-100 to-green-50 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">
            🎾
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Mide tu progreso</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Crea tu nivel inicial para empezar a medir tu progreso y encontrar partidos equilibrados.
          </p>
          <button 
            onClick={() => setPaso(1)}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] transition-all"
          >
            Empezar nivelación
          </button>
        </div>
      )}

      {/* --- VISTAS 1-4: PREGUNTAS --- */}
      {paso > 0 && paso < 5 && (
        <div key={`step-${paso}`} className="w-full max-w-md bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8 flex flex-col animate-slide-up min-h-[500px]">
          
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => setPaso(paso - 1)} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              ←
            </button>
            <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${((paso - 1) / PREGUNTAS.length) * 100}%` }}
              ></div>
            </div>
            <span className="text-sm font-bold text-gray-400">{paso}/{PREGUNTAS.length}</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-8 leading-tight">
            {PREGUNTAS[paso - 1].titulo}
          </h2>

          <div className="flex flex-col gap-3 mt-auto">
            {PREGUNTAS[paso - 1].opciones.map((opcion, index) => (
              <button
                key={index}
                onClick={() => seleccionarOpcion(paso - 1, opcion.puntos)}
                className="w-full text-left bg-white border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/50 text-gray-700 hover:text-blue-900 font-medium p-4 sm:p-5 rounded-2xl transition-all active:scale-[0.98]"
              >
                {opcion.texto}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- VISTA 5: RESULTADO FINAL --- */}
      {paso === 5 && (
        <div key="step-5" className="w-full max-w-md flex flex-col gap-4 animate-slide-up">
          
          <div className="bg-slate-900 rounded-[2rem] p-8 text-center shadow-2xl relative overflow-hidden">
            {/* Efecto de brillo de fondo */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-lime-400/20 blur-3xl rounded-full"></div>
            
            <h1 className="text-white/80 font-bold mb-6 text-sm uppercase tracking-widest z-10 relative">Tu Nivel Inicial</h1>
            
            <div className="relative z-10">
              <h2 className="text-8xl font-black text-[#c2ff00] mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(194,255,0,0.4)]">
                {ratingFinal.toFixed(1)}
              </h2>
              <p className="text-2xl font-bold text-white mb-2">{getEtiquetaNivel(ratingFinal)}</p>
              <p className="text-sm text-gray-400 leading-relaxed px-4">
                Este nivel se irá ajustando automáticamente conforme juegues partidos competitivos.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col gap-5">
            <h3 className="font-bold text-gray-900 text-lg text-center">Completa tu perfil</h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Posición en la cancha</label>
              <select className={inputClass} value={posicion} onChange={(e) => setPosicion(e.target.value)}>
                <option value="Drive">Drive (Derecha)</option>
                <option value="Revés">Revés (Izquierda)</option>
                <option value="Ambos">Ambos</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Mano dominante</label>
              <select className={inputClass} value={manoHabil} onChange={(e) => setManoHabil(e.target.value)}>
                <option value="Derecha">Diestro</option>
                <option value="Izquierda">Zurdo</option>
              </select>
            </div>

            <button 
              onClick={guardarPerfil}
              disabled={cargando}
              className="mt-2 w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {cargando ? "Guardando..." : "¡Entendido y Guardar!"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}