import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer"; // <-- Importamos el nuevo Footer

export const metadata = {
  title: "Sports Hub BQTO | Fútbol y Pádel",
  description: "Una sola cuenta para jugar fútbol, pádel y más deportes en Barquisimeto.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="scroll-smooth">
      {/* Cambiamos a fondo claro, texto oscuro y acentos verdes */}
      <body className="bg-gray-50 text-gray-900 font-sans antialiased min-h-screen flex flex-col selection:bg-green-500 selection:text-white">
        <Navbar />
        
        <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
          {children}
        </main>

        <Footer /> {/* <-- Agregamos el Footer aquí abajo */}
      </body>
    </html>
  );
}