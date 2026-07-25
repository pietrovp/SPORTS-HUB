'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import PadelRecentActivity from './PadelRecentActivity'

const CATEGORY_OPTIONS = {
  principiante: ['rookies', '7ma'],
  intermedio: ['6ta'],
  avanzado: ['5ta', '4ta'],
  profesional: ['3era', '2da', 'open'],
}

const DEFAULT_PROFILE = {
  nivel_base: 'principiante',
  categoria_solicitada: 'rookies',
  categoria_oficial: 'rookies',
  estado_categoria: 'pendiente',
  rating: 1.5,
  fiabilidad: 20,
  posicion: 'drive',
  posicion_preferida: 'lado_derecho',
  mano_habil: 'derecha',
  genero: 'masculino',
  edad: 25,
  horario_preferido: 'noche',
  dia_preferido: 'fin_de_semana',
  tipo_partido_preferido: 'amistoso',
}

const LABELS = {
  nivel_base: {
    principiante: 'Principiante',
    intermedio: 'Intermedio',
    avanzado: 'Avanzado',
    profesional: 'Profesional',
  },
  categoria: {
    rookies: 'Rookies',
    '7ma': '7ma',
    '6ta': '6ta',
    '5ta': '5ta',
    '4ta': '4ta',
    '3era': '3era',
    '2da': '2da',
    open: 'Open',
  },
  estado_categoria: {
    pendiente: 'En revisión',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    ajustada: 'Ajustada',
  },
  posicion: {
    drive: 'Drive',
    reves: 'Revés',
    ambos: 'Ambos lados',
  },
  mano_habil: {
    derecha: 'Derecha',
    izquierda: 'Izquierda',
    ambidiestro: 'Ambidiestro',
  },
  genero: {
    masculino: 'Masculino',
    femenino: 'Femenino',
    otro: 'Otro',
  },
  horario_preferido: {
    manana: 'Mañana',
    tarde: 'Tarde',
    noche: 'Noche',
  },
  dia_preferido: {
    semana: 'Entre semana',
    fin_de_semana: 'Fin de semana',
    cualquiera: 'Cualquiera',
  },
  tipo_partido_preferido: {
    amistoso: 'Amistoso',
    competitivo: 'Competitivo',
    mixto: 'Mixto',
  },
}

const TIPOS_VALIDOS = ['amistoso', 'competitivo', 'mixto']
const NIVELES_VALIDOS = ['principiante', 'intermedio', 'avanzado', 'profesional']

function normalizeNivelBase(value) {
  const n = String(value ?? '').trim().toLowerCase()
  return NIVELES_VALIDOS.includes(n) ? n : 'principiante'
}

function normalizeCategoria(value, nivelBase) {
  const nivel = normalizeNivelBase(nivelBase)
  const permitidas = CATEGORY_OPTIONS[nivel] ?? CATEGORY_OPTIONS.principiante
  const cat = String(value ?? '').trim().toLowerCase()
  return permitidas.includes(cat) ? cat : permitidas[0]
}

function normalizeEstadoCategoria(value) {
  const e = String(value ?? '').trim().toLowerCase()
  return ['pendiente', 'aprobada', 'rechazada', 'ajustada'].includes(e) ? e : 'pendiente'
}

function normalizarTiposPartido(value) {
  const arr = Array.isArray(value) ? value : value ? [value] : []
  const tipos = arr
    .map(t => String(t ?? '').trim().toLowerCase())
    .filter(t => TIPOS_VALIDOS.includes(t))
  const unique = [...new Set(tipos)]
  return unique.length ? unique : ['amistoso']
}

function normalizeMatchRelation(match) {
  if (!match) return null
  return Array.isArray(match) ? match[0] ?? null : match
}

function getInfoRating(ratingVal) {
  const r = Number(ratingVal ?? 1.5)
  if (r < 2.0) return { catActual: 'Rookies', nextCat: '7ma', floor: 1.0, ceiling: 2.0 }
  if (r < 3.0) return { catActual: '7ma', nextCat: '6ta', floor: 2.0, ceiling: 3.0 }
  if (r < 4.0) return { catActual: '6ta', nextCat: '5ta', floor: 3.0, ceiling: 4.0 }
  if (r < 4.5) return { catActual: '5ta', nextCat: '4ta', floor: 4.0, ceiling: 4.5 }
  if (r < 5.0) return { catActual: '4ta', nextCat: '3era', floor: 4.5, ceiling: 5.0 }
  if (r < 6.0) return { catActual: '3era', nextCat: 'Open', floor: 5.0, ceiling: 6.0 }
  return { catActual: 'Open', nextCat: 'MAX', floor: 6.0, ceiling: 7.0 }
}

function calcProgresoPorcentaje(ratingVal) {
  const r = Number(ratingVal ?? 1.5)
  const info = getInfoRating(r)
  if (info.nextCat === 'MAX') return 100
  return Math.round(Math.min(Math.max(((r - info.floor) / (info.ceiling - info.floor)) * 100, 0), 100))
}

function getEtiquetaFiabilidad(f) {
  const v = Number(f ?? 0)
  if (v < 35) return { texto: 'Baja', color: 'text-amber-400' }
  if (v < 70) return { texto: 'Media', color: 'text-cyan-300' }
  return { texto: 'Alta', color: 'text-emerald-400' }
}

const ONBOARDING_STEPS = [
  {
    id: 0,
    titulo: '¿En qué escala te colocarías?',
    campo: 'qnivelescala',
    opciones: [
      { label: 'Iniciación', value: 'iniciacion', cats: ['rookies', '7ma'], peso: 0 },
      { label: 'Intermedio', value: 'intermedio', cats: ['6ta'], peso: 0.8 },
      { label: 'Avanzado', value: 'avanzado', cats: ['5ta', '4ta'], peso: 1.6 },
      { label: 'Profesional', value: 'profesional', cats: ['3era', '2da', 'open'], peso: 2.5 },
    ],
  },
  {
    id: 1,
    titulo: '¿Cuántos años llevas practicando pádel o algún deporte de raqueta?',
    campo: 'qanios',
    opciones: [
      { label: 'Nunca he jugado previamente', value: 'nunca', peso: 0 },
      { label: 'Menos de un año', value: 'menos1', peso: 0.2 },
      { label: 'Entre 1 y 3 años', value: '1a3', peso: 0.5 },
      { label: 'Entre 3 y 5 años', value: '3a5', peso: 0.8 },
      { label: 'Más de 5 años', value: 'mas5', peso: 1.1 },
    ],
  },
  {
    id: 2,
    titulo: '¿Cuál es el nivel al que compites cuando juegas partidos competitivos?',
    campo: 'qcompeticion',
    opciones: [
      { label: 'Sólo partidos entre amigos', value: 'amigos', peso: 0 },
      { label: 'Torneos amistosos', value: 'torneos', peso: 0.3 },
      { label: 'Ligas amateur', value: 'amateur', peso: 0.6 },
      { label: 'Competiciones federadas', value: 'federado', peso: 1.0 },
    ],
  },
  {
    id: 3,
    titulo: '¿Has recibido o recibes formación en pádel?',
    campo: 'qformacion',
    opciones: [
      { label: 'No', value: 'no', peso: 0 },
      { label: 'Sí, en el pasado', value: 'pasado', peso: 0.15 },
      { label: 'Sí, actualmente', value: 'actual', peso: 0.3 },
    ],
  },
  {
    id: 4,
    titulo: 'En la volea...',
    campo: 'qvolea',
    opciones: [
      { label: 'Casi no subo a la red', value: 'v1', peso: 0 },
      { label: 'No me siento seguro/a en la red, cometo demasiados errores', value: 'v2', peso: 0.2 },
      { label: 'Logro volear de derecha y de revés con alguna dificultad', value: 'v3', peso: 0.45 },
      { label: 'Tengo buena colocación en la red y voleo con seguridad', value: 'v4', peso: 0.7 },
      { label: 'Voleo con profundidad y potencia', value: 'v5', peso: 1.0 },
    ],
  },
  {
    id: 5,
    titulo: 'En los rebotes...',
    campo: 'qrebotes',
    opciones: [
      { label: 'No sé cómo leer los rebotes, golpeo antes del rebote', value: 'r1', peso: 0 },
      { label: 'Intento, con dificultad, golpear los rebotes en la pared de fondo', value: 'r2', peso: 0.2 },
      { label: 'Devuelvo rebotes en la pared de fondo, me cuesta devolver los de doble pared', value: 'r3', peso: 0.45 },
      { label: 'Devuelvo rebotes a dos paredes y alcanzo rebotes rápidos', value: 'r4', peso: 0.7 },
      { label: 'Realizo bajadas de pared con potencia de derecha y de revés', value: 'r5', peso: 1.0 },
    ],
  },
  {
    id: 6,
    titulo: '¿Qué edad tienes?',
    campo: 'qedad',
    opciones: [
      { label: 'Entre 18 y 30 años', value: '1830', edadNum: 24, peso: 0 },
      { label: 'Entre 31 y 40 años', value: '3140', edadNum: 35, peso: 0.2 },
      { label: 'Entre 41 y 50 años', value: '4150', edadNum: 45, peso: 0.35 },
      { label: 'Más de 50 años', value: 'mas50', edadNum: 55, peso: 0.5 },
    ],
  },
]

function calcularRatingInicial(respuestas) {
  let suma = 1.0
  ONBOARDING_STEPS.forEach(step => {
    if (step.campo === 'qedad') return
    const op = step.opciones.find(o => o.value === respuestas[step.campo])
    if (op?.peso) suma += op.peso
  })
  return parseFloat(Math.min(Math.max(suma, 1.0), 7.0).toFixed(2))
}

function nivelDesdeRating(r) {
  if (r < 2.0) return { nivel_base: 'principiante', categoria: 'rookies' }
  if (r < 3.0) return { nivel_base: 'principiante', categoria: '7ma' }
  if (r < 4.0) return { nivel_base: 'intermedio', categoria: '6ta' }
  if (r < 4.5) return { nivel_base: 'avanzado', categoria: '5ta' }
  if (r < 5.0) return { nivel_base: 'avanzado', categoria: '4ta' }
  if (r < 6.0) return { nivel_base: 'profesional', categoria: '3era' }
  return { nivel_base: 'profesional', categoria: 'open' }
}

export default function PadelPerfilPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [baseProfile, setBaseProfile] = useState(null)
  const [padelProfile, setPadelProfile] = useState(null)
  const [matchesData, setMatchesData] = useState([])
  const [editando, setEditando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [form, setForm] = useState(DEFAULT_PROFILE)

  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [onboardingResp, setOnboardingResp] = useState({
    qnivelescala: null,
    qanios: null,
    qcompeticion: null,
    qformacion: null,
    qvolea: null,
    qrebotes: null,
    qedad: null,
  })
  const [ratingCalculado, setRatingCalculado] = useState(1.0)
  const [ratingAjuste, setRatingAjuste] = useState(0)
  const [onboardingGuardando, setOnboardingGuardando] = useState(false)
  const [shakeBtn, setShakeBtn] = useState(false)

  const TOTAL_STEPS = ONBOARDING_STEPS.length + 1

  useEffect(() => {
    cargarPerfil()
  }, [])

  async function cargarPerfil() {
    try {
      setLoading(true)
      setErrorMsg('')
      setMensaje('')

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!authUser) {
        setErrorMsg('No hay una sesión activa.')
        setLoading(false)
        return
      }

      setUser(authUser)

      const [{ data: profileData, error: profileError }, { data: padelData, error: padelError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        supabase.from('padel_profiles').select('*').eq('id', authUser.id).maybeSingle(),
      ])

      if (profileError) throw profileError
      if (padelError) throw padelError

      setBaseProfile(profileData ?? null)

      let finalPadel = padelData

      if (!finalPadel) {
        const { data: created, error: createError } = await supabase
          .from('padel_profiles')
          .upsert(
            {
              id: authUser.id,
              ...DEFAULT_PROFILE,
            },
            { onConflict: 'id' }
          )
          .select()
          .single()

        if (createError) throw createError
        finalPadel = created
      }

      const nivelBaseN = normalizeNivelBase(finalPadel?.nivel_base)
      const catSolicitada = normalizeCategoria(finalPadel?.categoria_solicitada, nivelBaseN)
      const catOficial = normalizeCategoria(finalPadel?.categoria_oficial, nivelBaseN)
      const estadoCat = normalizeEstadoCategoria(finalPadel?.estado_categoria)
      const tiposN = normalizarTiposPartido(finalPadel?.tipo_partido_preferido)

      finalPadel = {
        ...finalPadel,
        nivel_base: nivelBaseN,
        categoria_solicitada: catSolicitada,
        categoria_oficial: catOficial,
        estado_categoria: estadoCat,
        rating: Number(finalPadel?.rating ?? 1.5),
        fiabilidad: Number(finalPadel?.fiabilidad ?? 20),
        tipo_partido_preferido: tiposN,
      }

      setPadelProfile(finalPadel)
      setForm({
        nivel_base: nivelBaseN,
        categoria_solicitada: catSolicitada,
        categoria_oficial: catOficial,
        estado_categoria: estadoCat,
        rating: finalPadel.rating,
        fiabilidad: finalPadel.fiabilidad,
        posicion: finalPadel.posicion ?? DEFAULT_PROFILE.posicion,
        posicion_preferida: finalPadel.posicion_preferida ?? DEFAULT_PROFILE.posicion_preferida,
        mano_habil: finalPadel.mano_habil ?? DEFAULT_PROFILE.mano_habil,
        genero: finalPadel.genero ?? DEFAULT_PROFILE.genero,
        edad: finalPadel.edad ?? DEFAULT_PROFILE.edad,
        horario_preferido: finalPadel.horario_preferido ?? DEFAULT_PROFILE.horario_preferido,
        dia_preferido: finalPadel.dia_preferido ?? DEFAULT_PROFILE.dia_preferido,
        tipo_partido_preferido: tiposN,
      })

      if (!finalPadel.evaluacion_inicial_completada) {
        setOnboardingStep(0)
        setOnboardingResp({
          qnivelescala: null,
          qanios: null,
          qcompeticion: null,
          qformacion: null,
          qvolea: null,
          qrebotes: null,
          qedad: null,
        })
        setRatingAjuste(0)
        setOnboardingOpen(true)
      }

      const { data: playedMatches, error: matchesError } = await supabase
        .from('padel_match_players')
        .select(`
          id,
          team,
          joined_at,
          match:padel_matches!inner (
            id,
            status,
            winner_team,
            team_a_score,
            team_b_score,
            scheduled_at
          )
        `)
        .eq('user_id', authUser.id)
        .order('joined_at', { ascending: false })

      if (matchesError) throw matchesError
      setMatchesData((playedMatches ?? []).filter(row => {
        const m = normalizeMatchRelation(row.match)
        return m?.status === 'jugado'
      }))
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo cargar el perfil.')
    } finally {
      setLoading(false)
    }
  }

  async function guardarCambios() {
    if (!user) return
    try {
      setSaving(true)
      setErrorMsg('')
      setMensaje('')

      const nivelBase = normalizeNivelBase(form.nivel_base)
      const catSolicitada = normalizeCategoria(form.categoria_solicitada, nivelBase)
      const tiposN = normalizarTiposPartido(form.tipo_partido_preferido)
      const cambioCategoria = catSolicitada !== padelProfile?.categoria_solicitada || nivelBase !== padelProfile?.nivel_base

      const { data, error } = await supabase
        .from('padel_profiles')
        .update({
          nivel_base: nivelBase,
          categoria_solicitada: catSolicitada,
          estado_categoria: cambioCategoria ? 'pendiente' : padelProfile?.estado_categoria,
          posicion: form.posicion,
          posicion_preferida: form.posicion_preferida,
          mano_habil: form.mano_habil,
          genero: form.genero,
          edad: Number(form.edad ?? 25),
          horario_preferido: form.horario_preferido,
          dia_preferido: form.dia_preferido,
          tipo_partido_preferido: tiposN,
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      const nivelBaseN = normalizeNivelBase(data?.nivel_base)
      const catSolicitadaN = normalizeCategoria(data?.categoria_solicitada, nivelBaseN)
      const catOficialN = normalizeCategoria(data?.categoria_oficial, nivelBaseN)
      const estadoN = normalizeEstadoCategoria(data?.estado_categoria)

      const perfilN = {
        ...data,
        nivel_base: nivelBaseN,
        categoria_solicitada: catSolicitadaN,
        categoria_oficial: catOficialN,
        estado_categoria: estadoN,
        rating: Number(data?.rating ?? padelProfile?.rating ?? 1.5),
        fiabilidad: Number(data?.fiabilidad ?? padelProfile?.fiabilidad ?? 20),
        tipo_partido_preferido: normalizarTiposPartido(data?.tipo_partido_preferido),
      }

      setPadelProfile(perfilN)
      setForm(prev => ({
        ...prev,
        nivel_base: nivelBaseN,
        categoria_solicitada: catSolicitadaN,
        categoria_oficial: catOficialN,
        estado_categoria: estadoN,
        rating: perfilN.rating,
        fiabilidad: perfilN.fiabilidad,
        tipo_partido_preferido: perfilN.tipo_partido_preferido,
      }))
      setEditando(false)
      setMensaje('Perfil actualizado correctamente.')
    } catch (err) {
      setErrorMsg(err.message || 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  function seleccionarRespuesta(campo, value) {
    setOnboardingResp(prev => ({ ...prev, [campo]: value }))
    setShakeBtn(false)
  }

  function avanzarOnboarding() {
    const stepActual = ONBOARDING_STEPS[onboardingStep]
    if (!onboardingResp[stepActual.campo]) {
      setShakeBtn(true)
      setTimeout(() => setShakeBtn(false), 600)
      return
    }

    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      const rating = calcularRatingInicial(onboardingResp)
      setRatingCalculado(rating)
      setRatingAjuste(0)
      setOnboardingStep(prev => prev + 1)
      return
    }

    setOnboardingStep(ONBOARDING_STEPS.length)
  }

  async function guardarOnboarding() {
    if (!user) return
    try {
      setOnboardingGuardando(true)
      const ratingFinal = parseFloat(Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2))
      const categoriaData = nivelDesdeRating(ratingFinal)
      const opEdad = ONBOARDING_STEPS[6].opciones.find(o => o.value === onboardingResp.qedad)
      const edadNum = opEdad?.edadNum ?? 25

      const { data, error } = await supabase
        .from('padel_profiles')
        .update({
          nivel_base: categoriaData.nivel_base,
          categoria_solicitada: categoriaData.categoria,
          categoria_oficial: categoriaData.categoria,
          estado_categoria: 'pendiente',
          rating: ratingFinal,
          fiabilidad: 20,
          edad: edadNum,
          evaluacion_inicial_completada: true,
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error

      const nivelBaseN = normalizeNivelBase(data.nivel_base)
      const catSolicitadaN = normalizeCategoria(data.categoria_solicitada, nivelBaseN)
      const catOficialN = normalizeCategoria(data.categoria_oficial, nivelBaseN)

      setPadelProfile(prev => ({
        ...prev,
        ...data,
        nivel_base: nivelBaseN,
        categoria_solicitada: catSolicitadaN,
        categoria_oficial: catOficialN,
        estado_categoria: normalizeEstadoCategoria(data.estado_categoria),
        rating: Number(data.rating ?? ratingFinal),
        fiabilidad: Number(data.fiabilidad ?? 20),
        evaluacion_inicial_completada: true,
      }))

      setForm(prev => ({
        ...prev,
        nivel_base: nivelBaseN,
        categoria_solicitada: catSolicitadaN,
        categoria_oficial: catOficialN,
        estado_categoria: normalizeEstadoCategoria(data.estado_categoria),
        rating: Number(data.rating ?? ratingFinal),
        fiabilidad: Number(data.fiabilidad ?? 20),
        edad: edadNum,
      }))

      setOnboardingOpen(false)
      setMensaje(`¡Bienvenido! Tu nivel inicial es ${ratingFinal.toFixed(2)}.`)
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la evaluación.')
    } finally {
      setOnboardingGuardando(false)
    }
  }

  const estadisticas = useMemo(() => {
    const matches = matchesData
      .map(row => {
        const m = normalizeMatchRelation(row.match)
        if (!m || m.status !== 'jugado') return null
        return { team: row.team, winnerTeam: m.winner_team, scheduledAt: m.scheduled_at }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

    const partidos = matches.length
    const victorias = matches.filter(m => m.winnerTeam && m.winnerTeam === m.team).length
    const derrotas = Math.max(partidos - victorias, 0)
    const pct = partidos > 0 ? Math.round((victorias / partidos) * 100) : 0

    let racha = 0
    let mejorRacha = 0
    for (const m of matches) {
      if (m.winnerTeam && m.winnerTeam === m.team) {
        racha += 1
        mejorRacha = Math.max(racha, mejorRacha)
      } else {
        racha = 0
      }
    }

    return {
      partidos,
      victorias,
      derrotas,
      porcentajeVictorias: pct,
      racha,
      mejorRacha,
    }
  }, [matchesData])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-64 rounded-3xl bg-slate-200" />
          <div className="h-64 rounded-3xl bg-slate-200" />
          <div className="h-64 rounded-3xl bg-slate-200" />
        </div>
      </div>
    )
  }

  const nombreStr = baseProfile?.nombre || user?.user_metadata?.nombre || user?.email?.split('@')[0] || 'Jugador'
  const apellidoStr = baseProfile?.apellido || ''
  const nombreCompleto = `${nombreStr} ${apellidoStr}`.trim()
  const inicial = nombreStr.charAt(0).toUpperCase()
  const catOficialLabel = LABELS.categoria[padelProfile?.categoria_oficial] || 'Rookies'
  const ratingActual = Number(padelProfile?.rating ?? 1.5)
  const fiabilidadVal = Number(padelProfile?.fiabilidad ?? 20)
  const infoRating = getInfoRating(ratingActual)
  const progresoPct = calcProgresoPorcentaje(ratingActual)
  const fiabilidadInfo = getEtiquetaFiabilidad(fiabilidadVal)
  const categoriasDisponibles = CATEGORY_OPTIONS[normalizeNivelBase(form.nivel_base)] || CATEGORY_OPTIONS.principiante

  const stepActual = ONBOARDING_STEPS[onboardingStep] || null
  const esPantallaResultado = onboardingStep === ONBOARDING_STEPS.length
  const respActual = stepActual ? onboardingResp[stepActual.campo] : null
  const progresoBarPct = Math.round((onboardingStep / TOTAL_STEPS) * 100)
  const ratingConAjuste = parseFloat(Math.min(Math.max(ratingCalculado + ratingAjuste, 1.0), 7.0).toFixed(2))
  const catResult = nivelDesdeRating(ratingConAjuste)

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 md:px-8">
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-6">
        {mensaje && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-emerald-800">{mensaje}</span>
            <button onClick={() => setMensaje('')} className="text-emerald-600 hover:text-emerald-800">✕</button>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-rose-800">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800">✕</button>
          </div>
        )}

        {onboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
            <div className="flex w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-[#EEF0F5] sm:rounded-3xl" style={{ maxHeight: '92vh' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
                <button
                  onClick={() => onboardingStep > 0 && setOnboardingStep(s => s - 1)}
                  disabled={onboardingStep === 0}
                  className="h-9 w-9 flex items-center justify-center rounded-full disabled:opacity-0 hover:bg-black/5 transition-colors"
                >
                  ←
                </button>
                <span className="text-xs font-semibold text-gray-400">
                  {esPantallaResultado ? 'Tu resultado' : `Pregunta ${onboardingStep + 1} de ${ONBOARDING_STEPS.length}`}
                </span>
                <div className="w-9 h-9" />
              </div>

              <div className="px-5 pb-3 flex-shrink-0">
                <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full rounded-full bg-[#0B1120] transition-all duration-500" style={{ width: `${progresoBarPct}%` }} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6">
                {esPantallaResultado ? (
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="rounded-2xl bg-[#0B1120] text-white p-6 text-center">
                      <p className="text-xs text-gray-400 mb-1 uppercase tracking-widest">Tu rating inicial</p>
                      <p className="text-6xl font-black tracking-tight leading-none my-2">{ratingConAjuste.toFixed(2)}</p>
                      <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-emerald-400">
                        {LABELS.categoria[catResult.categoria]}
                      </span>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        {LABELS.categoria[catResult.categoria]}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 mb-1">¿El resultado te parece justo?</p>
                      <p className="text-xs text-gray-400 mb-3">Puedes ajustarlo ligeramente con ±0.3</p>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => setRatingAjuste(a => parseFloat(Math.max(a - 0.1, -0.3).toFixed(1)))}
                          disabled={ratingAjuste <= -0.3}
                          className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-30 text-xl font-bold transition-all"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold text-gray-700 min-w-[70px] text-center">
                          {ratingAjuste === 0 ? 'Sin ajuste' : ratingAjuste > 0 ? `+${ratingAjuste.toFixed(1)}` : ratingAjuste.toFixed(1)}
                        </span>
                        <button
                          onClick={() => setRatingAjuste(a => parseFloat(Math.min(a + 0.1, 0.3).toFixed(1)))}
                          disabled={ratingAjuste >= 0.3}
                          className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-30 text-xl font-bold transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={guardarOnboarding}
                      disabled={onboardingGuardando}
                      className="w-full rounded-2xl bg-[#0B1120] py-4 text-sm font-bold text-white hover:bg-[#1a2740] active:scale-98 disabled:opacity-60 transition-all duration-150"
                    >
                      {onboardingGuardando ? 'Guardando...' : 'Confirmar y comenzar'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pt-2">
                    <h2 className="text-base font-bold text-[#0B1120] leading-snug">
                      {stepActual?.titulo}
                    </h2>

                    <div className="flex flex-col gap-2">
                      {stepActual?.opciones.map(op => (
                        <button
                          key={op.value}
                          onClick={() => seleccionarRespuesta(stepActual.campo, op.value)}
                          className={`w-full text-left rounded-2xl border-2 px-4 py-3 transition-all duration-150 active:scale-98 ${
                            respActual === op.value
                              ? 'border-[#0B1120] bg-[#0B1120] text-white shadow-md border-transparent'
                              : 'border-white bg-white text-[#0B1120] hover:border-[#0B112020] shadow-sm'
                          } ${shakeBtn ? 'shake' : ''}`}
                        >
                          <span className="block text-sm font-bold leading-snug">{op.label}</span>
                          {op.cats && (
                            <span className={`block text-xs mt-0.5 font-medium tracking-wide ${respActual === op.value ? 'text-white/55' : 'text-gray-400'}`}>
                              {op.cats.join(', ')}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {shakeBtn && (
                      <p className="text-center text-xs font-semibold text-rose-500 mt-1">
                        Selecciona una opción para continuar
                      </p>
                    )}

                    <button
                      onClick={avanzarOnboarding}
                      className={`w-full rounded-2xl py-4 text-sm font-bold mt-2 transition-all duration-150 active:scale-98 ${
                        shakeBtn
                          ? 'shake bg-[#0B112025] text-black/60 cursor-not-allowed'
                          : !respActual
                            ? 'bg-[#0B1120] text-white hover:bg-[#1a2740] shadow-md'
                            : 'bg-[#0B1120] text-white hover:bg-[#1a2740] shadow-md'
                      }`}
                    >
                      Continuar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl bg-[#0B1120] p-6 text-white shadow-2xl md:p-8">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'radial-gradient(circle at 80% 20%, #4f98a3 0, transparent 60%)',
            }}
          />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black ring-2 ring-white/20">
                {inicial}
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">{nombreCompleto}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-semibold">
                    {catOficialLabel}
                  </span>
                  <span className={`text-xs font-semibold ${fiabilidadInfo.color}`}>
                    {fiabilidadInfo.texto}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">{user?.email}</p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-1 md:items-end">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Rating</p>
              <p className="text-5xl font-black leading-none">{ratingActual.toFixed(2)}</p>
              <p className="text-xs text-gray-400">{infoRating.catActual} → {infoRating.nextCat}</p>

              <div className="mt-1 w-48">
                <div className="mb-0.5 flex justify-between text-[10px] text-gray-500">
                  <span>{infoRating.floor.toFixed(1)}</span>
                  <span>{progresoPct}%</span>
                  <span>{infoRating.ceiling.toFixed(1)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${progresoPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Partidos', value: estadisticas.partidos },
              { label: 'Victorias', value: estadisticas.victorias },
              { label: 'Derrotas', value: estadisticas.derrotas },
              { label: 'Win rate', value: `${estadisticas.porcentajeVictorias}%` },
            ].map(item => (
              <div key={item.label} className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-lg font-black">{item.value}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">Datos del perfil</h2>
                {!editando ? (
                  <button
                    onClick={() => setEditando(true)}
                    className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditando(false)}
                      className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarCambios}
                      disabled={saving}
                      className="rounded-xl bg-[#0B1120] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60 hover:bg-[#1a2740] transition-colors"
                    >
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>

              {!editando ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldView label="Nivel base" value={LABELS.nivel_base[padelProfile?.nivel_base]} />
                  <FieldView label="Categoría solicitada" value={LABELS.categoria[padelProfile?.categoria_solicitada]} />
                  <FieldView label="Posición" value={LABELS.posicion[padelProfile?.posicion]} />
                  <FieldView label="Mano hábil" value={LABELS.mano_habil[padelProfile?.mano_habil]} />
                  <FieldView label="Género" value={LABELS.genero[padelProfile?.genero]} />
                  <FieldView label="Edad" value={`${padelProfile?.edad ?? 25} años`} />
                  <FieldView label="Horario preferido" value={LABELS.horario_preferido[padelProfile?.horario_preferido]} />
                  <FieldView label="Día preferido" value={LABELS.dia_preferido[padelProfile?.dia_preferido]} />
                  <div className="sm:col-span-2">
                    <div className="mb-1 text-xs font-semibold text-gray-500">Tipo de partido preferido</div>
                    <div className="flex flex-wrap gap-2">
                      {(normalizarTiposPartido(padelProfile?.tipo_partido_preferido)).map(t => (
                        <span key={t} className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700 capitalize">
                          {LABELS.tipo_partido_preferido[t]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Nivel base</label>
                    <select
                      value={form.nivel_base}
                      onChange={e => {
                        const nivel = e.target.value
                        const cats = CATEGORY_OPTIONS[nivel] || CATEGORY_OPTIONS.principiante
                        setForm(f => ({
                          ...f,
                          nivel_base: nivel,
                          categoria_solicitada: cats[0],
                        }))
                      }}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {NIVELES_VALIDOS.map(n => (
                        <option key={n} value={n}>{LABELS.nivel_base[n]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Categoría solicitada</label>
                    <select
                      value={form.categoria_solicitada}
                      onChange={e => setForm(f => ({ ...f, categoria_solicitada: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {categoriasDisponibles.map(c => (
                        <option key={c} value={c}>{LABELS.categoria[c]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Posición</label>
                    <select
                      value={form.posicion}
                      onChange={e => setForm(f => ({ ...f, posicion: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {Object.entries(LABELS.posicion).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Mano hábil</label>
                    <select
                      value={form.mano_habil}
                      onChange={e => setForm(f => ({ ...f, mano_habil: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {Object.entries(LABELS.mano_habil).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Género</label>
                    <select
                      value={form.genero}
                      onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {Object.entries(LABELS.genero).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Edad</label>
                    <input
                      type="number"
                      min={10}
                      max={99}
                      value={form.edad}
                      onChange={e => setForm(f => ({ ...f, edad: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Horario preferido</label>
                    <select
                      value={form.horario_preferido}
                      onChange={e => setForm(f => ({ ...f, horario_preferido: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {Object.entries(LABELS.horario_preferido).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Día preferido</label>
                    <select
                      value={form.dia_preferido}
                      onChange={e => setForm(f => ({ ...f, dia_preferido: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B112020]"
                    >
                      {Object.entries(LABELS.dia_preferido).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="mb-1 text-xs font-semibold text-gray-500">Tipo de partido preferido</p>
                    <div className="flex flex-wrap gap-2">
                      {TIPOS_VALIDOS.map(t => {
                        const actual = normalizarTiposPartido(form.tipo_partido_preferido)
                        const selected = actual.includes(t)
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              const updated = selected ? actual.filter(x => x !== t) : [...actual, t]
                              setForm(f => ({
                                ...f,
                                tipo_partido_preferido: updated.length ? updated : ['amistoso'],
                              }))
                            }}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors capitalize ${
                              selected
                                ? 'border-[#0B1120] bg-[#0B1120] text-white'
                                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0B112040]'
                            }`}
                          >
                            {LABELS.tipo_partido_preferido[t]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Estado de categoría</h3>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    padelProfile?.estado_categoria === 'aprobada'
                      ? 'bg-emerald-400'
                      : padelProfile?.estado_categoria === 'rechazada'
                        ? 'bg-rose-400'
                        : padelProfile?.estado_categoria === 'ajustada'
                          ? 'bg-blue-400'
                          : 'bg-amber-400'
                  }`}
                />
                <span className="text-sm font-bold text-gray-800">
                  {LABELS.estado_categoria[padelProfile?.estado_categoria] || 'En revisión'}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Categoría oficial: <span className="font-semibold text-gray-700">{catOficialLabel}</span>
              </p>
              {padelProfile?.categoria_solicitada !== padelProfile?.categoria_oficial && (
                <p className="mt-1 text-xs text-amber-600">
                  Solicitud pendiente: <span className="font-bold">{LABELS.categoria[padelProfile?.categoria_solicitada]}</span>
                </p>
              )}
            </div>

            <div className="rounded-3xl bg-[#0B1120] p-5 text-white shadow-sm">
              <p className="mb-1 text-xs uppercase tracking-wider text-gray-400">Mejor racha</p>
              <p className="text-4xl font-black">{estadisticas.mejorRacha}</p>
              <p className="text-xs text-gray-400">victorias consecutivas</p>
            </div>

            <PadelRecentActivity userId={user?.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldView({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value ?? '—'}</div>
    </div>
  )
}
