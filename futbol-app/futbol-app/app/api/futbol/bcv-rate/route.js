import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const response = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo consultar DolarApi." },
        { status: 500 }
      );
    }

    const data = await response.json();

    const usdRate = data.promedio ?? data.valor ?? null;
    const fechaValor = data.fechaActualizacion ?? data.fecha ?? "";

    return NextResponse.json({
      usdRate,
      fechaValor,
      source: "dolarapi",
      raw: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Ocurrió un error consultando la tasa." },
      { status: 500 }
    );
  }
}
