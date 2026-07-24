import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0B0C15] text-white pt-16 pb-8 border-t border-gray-800 mt-auto">
      <div className="max-w-6xl mx-auto px-4">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-6 mb-12">
          
          {/* BLOQUE 1: MARCA Y DESCRIPCIÓN */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 w-fit group">
              <span className="text-2xl group-hover:scale-110 transition-transform">🏟️</span>
              <span className="text-xl font-black tracking-tight uppercase text-white group-hover:text-[#00FF9D] transition-colors">
                Sports Hub
              </span>
            </Link>
            <p className="text-sm text-gray-400 font-medium max-w-sm leading-relaxed">
              La plataforma definitiva para organizar partidos, reservar canchas y llevar tus estadísticas deportivas al siguiente nivel.
            </p>
          </div>

          {/* BLOQUE 2: DEPORTES */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D]">Deportes</h3>
            <div className="flex flex-col gap-3 text-sm font-semibold text-gray-400">
              <Link href="/futbol" className="hover:text-white transition-colors w-fit">Fútbol</Link>
              <Link href="/padel" className="hover:text-white transition-colors w-fit">Pádel</Link>
            </div>
          </div>

          {/* BLOQUE 3: EXPLORAR */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D]">Explorar</h3>
            <div className="flex flex-col gap-3 text-sm font-semibold text-gray-400">
              <Link href="/futbol/comunidad" className="hover:text-white transition-colors w-fit">Comunidad</Link>
              <Link href="/creditos" className="hover:text-white transition-colors w-fit">Créditos</Link>
              <Link href="/clubes" className="hover:text-white transition-colors w-fit">Sedes y Clubes</Link>
            </div>
          </div>

          {/* BLOQUE 4: LEGAL Y CONTACTO */}
          <div className="md:col-span-3 flex flex-col gap-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#00FF9D]">Soporte</h3>
            <div className="flex flex-col gap-3 text-sm font-semibold text-gray-400">
              <Link href="/terminos" className="hover:text-white transition-colors w-fit">Términos de servicio</Link>
              <Link href="/privacidad" className="hover:text-white transition-colors w-fit">Política de privacidad</Link>
              <a href="mailto:soporte@sportshub.com" className="hover:text-white transition-colors w-fit">Contacto</a>
            </div>
          </div>

        </div>

        {/* LÍNEA SEPARADORA Y COPYRIGHT */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center md:text-left">
            © {currentYear} Sports Hub. Todos los derechos reservados.
          </p>
          
          {/* REDES SOCIALES */}
          <div className="flex items-center gap-4">
            <a href="#" className="w-10 h-10 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#00FF9D] hover:text-[#0B0C15] hover:border-[#00FF9D] transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#00FF9D] hover:text-[#0B0C15] hover:border-[#00FF9D] transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>

        </div>
      </div>
    </footer>
  );
}