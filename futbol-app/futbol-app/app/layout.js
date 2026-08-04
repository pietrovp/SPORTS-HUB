import './globals.css' // ¡Esto es lo que activa Tailwind!

export const metadata = {
  title: 'Sports Hub',
  description: 'Sistema de Gestión',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-slate-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}