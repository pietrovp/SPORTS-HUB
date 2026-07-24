import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getAccessTokenFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim();
}

function normalizeNivelBase(value) {
  const nivel = String(value || "").trim().toLowerCase();
  if (["principiante", "intermedio", "avanzado", "profesional"].includes(nivel)) return nivel;
  if (nivel === "competitivo") return "profesional";
  return "principiante";
}

const CATEGORY_OPTIONS = {
  principiante: ["rookies", "7ma"],
  intermedio: ["6ta"],
  avanzado: ["5ta", "4ta"],
  profesional: ["3era", "2da", "open"],
};

function normalizeCategoria(value, nivelBase) {
  const nivel = normalizeNivelBase(nivelBase);
  const permitidas = CATEGORY_OPTIONS[nivel] || CATEGORY_OPTIONS.principiante;
  const categoria = String(value || "").trim().toLowerCase();

  if (permitidas.includes(categoria)) return categoria;
  return permitidas[0];
}

function normalizeEstado(value) {
  const estado = String(value || "").trim().toLowerCase();
  if (["pendiente", "aprobada", "ajustada", "rechazada"].includes(estado)) return estado;
  return "pendiente";
}

export async function POST(request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Faltan variables públicas de Supabase en el servidor." },
        { status: 500 }
      );
    }

    const token = getAccessTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "No autorizado. Falta token." },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: userError?.message || "Sesión inválida o expirada." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message || "No se pudo validar el admin." },
        { status: 500 }
      );
    }

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: "No tienes permisos de administrador." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      padelProfileId,
      categoria_oficial,
      estado_categoria,
      categoria_comentario_admin,
    } = body || {};

    if (!padelProfileId) {
      return NextResponse.json(
        { error: "Falta padelProfileId." },
        { status: 400 }
      );
    }

    const { data: currentRow, error: rowError } = await supabaseAdmin
      .from("padel_profiles")
      .select("id, nivel_base, categoria_solicitada")
      .eq("id", padelProfileId)
      .maybeSingle();

    if (rowError) {
      return NextResponse.json(
        { error: rowError.message || "No se pudo cargar el perfil de pádel." },
        { status: 500 }
      );
    }

    if (!currentRow) {
      return NextResponse.json(
        { error: "Perfil de pádel no encontrado." },
        { status: 404 }
      );
    }

    const nivelBase = normalizeNivelBase(currentRow.nivel_base);
    const categoriaSolicitada = String(currentRow.categoria_solicitada || "").trim().toLowerCase();
    const categoriaFinal = normalizeCategoria(categoria_oficial, nivelBase);

    let estadoFinal = normalizeEstado(estado_categoria);
    if (estadoFinal === "aprobada" && categoriaFinal !== categoriaSolicitada) {
      estadoFinal = "ajustada";
    }

    const payload = {
      categoria_oficial: categoriaFinal,
      estado_categoria: estadoFinal,
      categoria_comentario_admin: String(categoria_comentario_admin || "").trim() || null,
      categoria_revision_admin: user.id,
      categoria_revisada_por: user.id,
      categoria_revisada_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("padel_profiles")
      .update(payload)
      .eq("id", padelProfileId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "No se pudo guardar la revisión." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
