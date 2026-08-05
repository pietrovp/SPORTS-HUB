"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CierreCajaPage() {
  const [debugLog, setDebugLog] = useState("Cargando...");

  useEffect(() => {
    async function testQueries() {
      try {
        setDebugLog("Verificando usuario...");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setDebugLog("No hay usuario logueado.");
          return;
        }

        setDebugLog("Verificando club...");
        const { data: profile } = await supabase
          .from("profiles")
          .select("club_id")
          .eq("id", user.id)
          .maybeSingle();

        const clubId = profile?.club_id;
        if (!clubId) {
          setDebugLog("Usuario no tiene club asignado.");
          return;
        }

        const hoy = new Date().toISOString().split('T')[0];
        const startOfDay = new Date(`${hoy}T00:00:00`).toISOString();
        const endOfDay = new Date(`${hoy}T23:59:59`).toISOString();

        setDebugLog("Consultando Canchas (Sin relaciones complejas)...");
        // Quitamos la relación a padel_courts a ver si eso era lo que causaba el bloqueo
        const { data: matches, error: matchesError } = await supabase
          .from("padel_matches")
          .select(`id, total_price, scheduled_at, payment_method, payment_status`)
          .eq("club_id", clubId)
          .gte("scheduled_at", startOfDay)
          .lte("scheduled_at", endOfDay);

        if (matchesError) {
          setDebugLog("ERROR EN CANCHAS: " + JSON.stringify(matchesError));
          return;
        }

        setDebugLog("Consultando Tienda (Sin relaciones complejas)...");
        // Quitamos la relación a sales_items a ver si eso era lo que causaba el bloqueo
        const { data: sales, error: salesError } = await supabase
          .from("sales")
          .select(`id, total_amount, payment_method, created_at`)
          .eq("club_id", clubId)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        if (salesError) {
          setDebugLog("ERROR EN TIENDA: " + JSON.stringify(salesError));
          return;
        }

        setDebugLog("TODO EXITOSO. Las tablas base funcionan.\n\nCanchas encontradas: " + matches.length + "\nVentas POS encontradas: " + sales.length);

      } catch (error) {
        setDebugLog("ERROR CATCH (Sintaxis o Red): " + error.message);
      }
    }

    testQueries();
  }, []);

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4 text-red-500">Modo Debug (Encontrando el error)</h1>
      <pre className="bg-gray-900 text-green-400 p-4 rounded-xl whitespace-pre-wrap text-xs font-mono">
        {debugLog}
      </pre>
    </div>
  );
}
