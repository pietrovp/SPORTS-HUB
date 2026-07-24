"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

const navItems = [
  { href: "/padel", label: "Inicio" },
  { href: "/padel/partidos", label: "Partidos" },
  { href: "/padel/clubes", label: "Clubes" },
  { href: "/padel/perfil", label: "Mis estadísticas" },
];

export default function PadelLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-8">
      <section className="sticky top-4 z-30">
        <div className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center rounded-full border border-emerald-300/40 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  Sports Hub · Pádel
                </div>
                <p className="mt-3 text-sm text-stone-600">
                  Clubes, partidos y estadísticas en una sola vista.
                </p>
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Volver al hub
              </Link>
            </div>

            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/padel"
                    ? pathname === "/padel"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                      isActive
                        ? "bg-slate-950 text-white shadow-sm"
                        : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </section>

      <div>{children}</div>
    </div>
  );
}
