import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
  title: "Sports Hub BQTO | Fútbol y Pádel",
  description: "Una sola cuenta para jugar fútbol, pádel y más deportes en Barquisimeto.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="scroll-smooth">
      {/* NOTA EL pb-24 AL FINAL DE LA CLASE DEL BODY */}
      <body className="bg-gray-50 text-gray-900 font-sans antialiased min-h-screen flex flex-col selection:bg-green-500 selection:text-white pb-24 md:pb-0">
        <Navbar />
        
        <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}