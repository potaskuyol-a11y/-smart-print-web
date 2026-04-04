'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { pdf } from '@react-pdf/renderer'
import { KpDocument } from '@/lib/pdf'
// exceljs imported dynamically inside handleDownloadXlsx

interface CalcItem {
  id: number
  license_type: string
  article: string
  name: string
  quantity: number
  price_distributor: number
  price_partner: number
  price_rrp: number
  sum_distributor: number
  sum_partner: number
  sum_rrp: number
}
interface HardwareItem {
  id: number
  article: string
  name: string
  quantity: number
  price_distributor: number
  price_partner: number
  price_rrp: number
  sum_distributor: number
  sum_partner: number
  sum_rrp: number
  includes_vat: boolean
}
interface WorkItem {
  id: number
  name: string
  quantity: number
  unit: string
  price_rrp: number
  sum_rrp: number
}
interface TripItem {
  id: number
  days: number
  sum: number
}
interface Calculation {
  id: string
  client_name: string
  project_name: string
  sale_type: string
  status: string
  license_term: string
  total_rrp: number
  total_partner: number
  total_distributor: number
  notes: string
  created_at: string
  approval_comment: string | null
  manager_comment: string | null
  approved_by: string | null
  approved_at: string | null
  calculation_items: CalcItem[]
  calculation_hardware: HardwareItem[]
  calculation_works: WorkItem[]
  calculation_trips: TripItem[]
  needs_cc: boolean
  cc_comment: string | null
  partner_name?: string | null
  distributor_name?: string | null
}

interface PriceRow {
  license_type: string
  min_quantity: number
  price_distributor: number
  price_partner: number
  price_rrp: number
  article: string
  name: string
}

interface LicenseInput {
  type: string
  label: string
  quantity: number
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-600' },
  in_review: { label: 'На согласовании', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Согласован', color: 'bg-green-100 text-green-700' },
  sent: { label: 'Отправлен', color: 'bg-blue-100 text-blue-700' },
}

const saleTypeLabels: Record<string, string> = {
  partner: 'Партнёрское',
  direct: 'Прямое (РРЦ)',
  distributor: 'Дистрибьюторское',
}

const saleTypeOptions = [
  { value: 'partner', label: 'Партнёрское' },
  { value: 'direct', label: 'Прямое (РРЦ)' },
  { value: 'distributor', label: 'Дистрибьюторское' },
]

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getPrice(prices: PriceRow[], type: string, totalQty: number): PriceRow | null {
  const rows = prices
    .filter(p => p.license_type === type && p.min_quantity <= totalQty)
    .sort((a, b) => b.min_quantity - a.min_quantity)
  return rows[0] || null
}

export default function CalculationViewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [calc, setCalc] = useState<Calculation | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [generatingXlsx, setGeneratingXlsx] = useState(false)

  // Bitrix24 deal permissions
  const [bitrixPermissions, setBitrixPermissions] = useState<{ active: boolean; excel: boolean; pdf: boolean } | null>(null)
  const [showAttachModal, setShowAttachModal] = useState(false)
  const [attachingPdf, setAttachingPdf] = useState(false)
  const [lastPdfBlob, setLastPdfBlob] = useState<Blob | null>(null)
  const [lastPdfName, setLastPdfName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([])
  const [prices, setPrices] = useState<PriceRow[]>([])

  const [needsCCEdit, setNeedsCCEdit] = useState(false)
  const [editComment, setEditComment] = useState('')
  const [sendComment, setSendComment] = useState('')
  const [showSendModal, setShowSendModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState<'approve' | 'reject' | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [processing, setProcessing] = useState(false)

  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saleType, setSaleType] = useState('partner')
  const [partnerName, setPartnerName] = useState('')
  const [distributorName, setDistributorName] = useState('')
  const [supportYears, setSupportYears] = useState(1)
  const [licenses, setLicenses] = useState<LicenseInput[]>([
    { type: 'Тип 1', label: 'Тип 1 — Мониторинг', quantity: 0 },
    { type: 'Тип 2', label: 'Тип 2 — Статистика', quantity: 0 },
    { type: 'Тип 3', label: 'Тип 3 — Внешний терминал', quantity: 0 },
    { type: 'Тип 4', label: 'Тип 4 — Встроенный терминал', quantity: 0 },
  ])
  const [editItems, setEditItems] = useState<CalcItem[]>([])
  const [editWorks, setEditWorks] = useState<WorkItem[]>([])
  const [editTrips, setEditTrips] = useState<TripItem[]>([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (prof) setUserRole(prof.role)

      const { data } = await supabase
        .from('calculations')
        .select('*, calculation_items(*), calculation_hardware(*), calculation_works(*), calculation_trips(*)')
        .eq('id', id)
        .single()

      if (data) {
        const c = data as Calculation
        setCalc(c)
        setNeedsCCEdit(c.needs_cc || false)
        if (c.calculation_hardware?.length > 0) {
          setHardwareItems(c.calculation_hardware)
        }
        setEditItems(c.calculation_items || [])
        setEditWorks(c.calculation_works || [])
        setEditTrips(c.calculation_trips || [])
        setClientName(c.client_name || '')
        setProjectName(c.project_name || '')
        setSaleType(c.sale_type || 'partner')
        setPartnerName((c as any).partner_name || '')
        setDistributorName((c as any).distributor_name || '')

        // Проверяем стадию сделки Bitrix24
        const dealId = (c as any).bitrix_deal_id
        if (dealId) {
          fetch(`/api/bitrix/deal?id=${dealId}`)
            .then(r => r.ok ? r.json() : null)
            .then(json => { if (json?.permissions) setBitrixPermissions(json.permissions) })
            .catch(() => {})
        }

        const licItems = c.calculation_items.filter(i => ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4'].includes(i.license_type) && !i.article.includes('СТР'))
        const supportItem = c.calculation_items.find(i => i.article.includes('СТР'))
        const totalLic = licItems.reduce((s, i) => s + i.quantity, 0)
        if (supportItem && totalLic > 0) {
          setSupportYears(Math.round(supportItem.quantity / totalLic) || 1)
        }
        setLicenses(prev => prev.map(l => {
          const item = licItems.find(i => i.license_type === l.type)
          return { ...l, quantity: item ? item.quantity : 0 }
        }))
      }

      const { data: priceData } = await supabase
        .from('price_list').select('*').eq('is_active', true)
      if (priceData) setPrices(priceData)

      setLoading(false)
    }
    load()
  }, [id])

  const isPartner = userRole === 'partner'
  const isManager = userRole === 'manager'
  const isManagerSales = userRole === 'manager_sales'
  const totalQty = licenses.reduce((s, l) => s + l.quantity, 0)

  const calcResults = () => {
    const results = licenses.filter(l => l.quantity > 0).map(l => {
      const p = getPrice(prices.filter(r => r.license_type === l.type && !r.article.includes('СТР')), l.type, totalQty)
      if (!p) return null
      return {
        type: l.type, article: p.article, name: p.name, quantity: l.quantity,
        price_distributor: p.price_distributor, price_partner: p.price_partner, price_rrp: p.price_rrp,
        sum_distributor: p.price_distributor * l.quantity,
        sum_partner: p.price_partner * l.quantity,
        sum_rrp: p.price_rrp * l.quantity,
      }
    }).filter(Boolean) as any[]

    const supportResults = licenses.filter(l => l.quantity > 0).map(l => {
      const p = getPrice(prices.filter(r => r.license_type === l.type && r.article.includes('СТР')), l.type, totalQty)
      if (!p) return null
      return {
        type: l.type, article: p.article, name: p.name, quantity: l.quantity * supportYears,
        price_distributor: p.price_distributor, price_partner: p.price_partner, price_rrp: p.price_rrp,
        sum_distributor: p.price_distributor * l.quantity * supportYears,
        sum_partner: p.price_partner * l.quantity * supportYears,
        sum_rrp: p.price_rrp * l.quantity * supportYears,
      }
    }).filter(Boolean) as any[]

    return [...results, ...supportResults]
  }

  const handleSaveEdit = async () => {
    if (!calc) return
    setSaving(true)

    let updatedItems: any[] = []

    // All roles: use editItems directly with full price control
    updatedItems = editItems.map(({ id: _id, ...rest }: any) => rest)

    const totals = updatedItems.reduce((acc, r) => ({
      distributor: acc.distributor + (r.sum_distributor || 0),
      partner: acc.partner + (r.sum_partner || 0),
      rrp: acc.rrp + (r.sum_rrp || 0),
    }), { distributor: 0, partner: 0, rrp: 0 })

    const hwTotals = hardwareItems.reduce((acc, h) => ({
      rrp: acc.rrp + h.sum_rrp,
      partner: acc.partner + h.sum_partner,
      distributor: acc.distributor + h.sum_distributor,
    }), { rrp: 0, partner: 0, distributor: 0 })

    const finalWorks = editWorks
    const finalTrips = editTrips
    const worksTotalRrp = finalWorks.reduce((s, w) => s + (w.sum_rrp || 0), 0)
                        + finalTrips.reduce((s, t) => s + (t.sum || 0), 0)

    const updateData: any = {
      client_name: clientName,
      project_name: projectName,
      sale_type: saleType,
      needs_cc: needsCCEdit,
      status: needsCCEdit ? 'in_review' : calc.status === 'in_review' ? 'draft' : calc.status,
      total_rrp: totals.rrp + hwTotals.rrp + worksTotalRrp,
      total_partner: totals.partner + hwTotals.partner,
      total_distributor: totals.distributor + hwTotals.distributor,
      partner_name: (saleType === 'partner' || saleType === 'distributor') ? (partnerName.trim() || null) : null,
      distributor_name: saleType === 'distributor' ? (distributorName.trim() || null) : null,
    }

    if (isManager && editComment.trim()) {
      updateData.approval_comment = editComment.trim()
    } else if (isManagerSales && editComment.trim()) {
      updateData.manager_comment = editComment.trim()
    }

    await supabase.from('calculations').update(updateData).eq('id', calc.id)

    // Обновляем лицензии
    await supabase.from('calculation_items').delete().eq('calculation_id', calc.id)
    if (updatedItems.length > 0) {
      await supabase.from('calculation_items').insert(
        updatedItems.map(r => ({ ...r, calculation_id: calc.id }))
      )
    }

    // Обновляем работы и командировки
    if (true) {
      await supabase.from('calculation_works').delete().eq('calculation_id', calc.id)
      if (finalWorks.length > 0) {
        await supabase.from('calculation_works').insert(
          finalWorks.map(({ id: _id, ...r }: any) => ({ ...r, calculation_id: calc.id }))
        )
      }
      await supabase.from('calculation_trips').delete().eq('calculation_id', calc.id)
      if (finalTrips.length > 0) {
        await supabase.from('calculation_trips').insert(
          finalTrips.map(({ id: _id, ...r }: any) => ({ ...r, calculation_id: calc.id }))
        )
      }
    }

    // Обновляем оборудование
    await supabase.from('calculation_hardware').delete().eq('calculation_id', calc.id)
    const activeHw = hardwareItems.filter(h => h.quantity > 0)
    if (activeHw.length > 0) {
      await supabase.from('calculation_hardware').insert(
        activeHw.map(h => ({
          calculation_id: calc.id,
          article: h.article, name: h.name, quantity: h.quantity,
          price_distributor: h.price_distributor, price_partner: h.price_partner, price_rrp: h.price_rrp,
          sum_distributor: h.sum_distributor, sum_partner: h.sum_partner, sum_rrp: h.sum_rrp,
          includes_vat: true,
        }))
      )
    }

    const { data } = await supabase
      .from('calculations')
      .select('*, calculation_items(*), calculation_hardware(*), calculation_works(*), calculation_trips(*)')
      .eq('id', calc.id).single()
    if (data) {
      setCalc(data as Calculation)
      setHardwareItems(data.calculation_hardware || [])
      setEditItems(data.calculation_items || [])
      setEditWorks(data.calculation_works || [])
      setEditTrips(data.calculation_trips || [])
    }

    setSaving(false)
    setIsEditing(false)
    setEditComment('')
  }

const handleSendForApproval = async () => {
    if (!calc) return
    await supabase.from('calculations').update({
      status: 'in_review',
      manager_comment: sendComment.trim() || null,
      approval_comment: null, // сбрасываем старый комментарий руководителя
    }).eq('id', calc.id)
    setCalc({ ...calc, status: 'in_review', manager_comment: sendComment.trim() || null, approval_comment: null })
    setShowSendModal(false)
    setSendComment('')
  }

  const handleApproveAction = async () => {
    if (!calc || !showApproveModal) return
    if (showApproveModal === 'reject' && !approveComment.trim()) return
    setProcessing(true)

    await supabase.from('calculations').update({
      status: showApproveModal === 'approve' ? 'approved' : 'draft',
      approval_comment: approveComment.trim() || null,
      approved_by: showApproveModal === 'approve' ? userId : null,
      approved_at: showApproveModal === 'approve' ? new Date().toISOString() : null,
    }).eq('id', calc.id)

    const { data } = await supabase
      .from('calculations').select('*, calculation_items(*)').eq('id', calc.id).single()
    if (data) setCalc(data as Calculation)

    setShowApproveModal(null)
    setApproveComment('')
    setProcessing(false)
    router.push('/dashboard')
  }

  const handleCopy = async () => {
    if (!calc) return
    setCopying(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCopying(false); return }

    const { data: newCalc, error } = await supabase.from('calculations').insert({
      created_by: user.id,
      client_name: calc.client_name + ' (копия)',
      project_name: calc.project_name,
      sale_type: calc.sale_type,
      status: 'draft',
      license_term: calc.license_term,
      total_rrp: calc.total_rrp,
      total_partner: calc.total_partner,
      total_distributor: calc.total_distributor,
    }).select().single()

    if (error || !newCalc) { setCopying(false); return }

    await supabase.from('calculation_items').insert(
      calc.calculation_items.map(item => ({
        calculation_id: newCalc.id,
        license_type: item.license_type, article: item.article, name: item.name,
        quantity: item.quantity, price_distributor: item.price_distributor,
        price_partner: item.price_partner, price_rrp: item.price_rrp,
        sum_distributor: item.sum_distributor, sum_partner: item.sum_partner, sum_rrp: item.sum_rrp,
      }))
    )

    if (hardwareItems.length > 0) {
      await supabase.from('calculation_hardware').insert(
        hardwareItems.map(h => ({
          calculation_id: newCalc.id,
          article: h.article, name: h.name, quantity: h.quantity,
          price_distributor: h.price_distributor, price_partner: h.price_partner, price_rrp: h.price_rrp,
          sum_distributor: h.sum_distributor, sum_partner: h.sum_partner, sum_rrp: h.sum_rrp,
          includes_vat: h.includes_vat,
        }))
      )
    }

    if (calc.calculation_works?.length > 0) {
      await supabase.from('calculation_works').insert(
        calc.calculation_works.map(w => ({
          calculation_id: newCalc.id,
          name: w.name, quantity: w.quantity, unit: w.unit,
          price_rrp: w.price_rrp, sum_rrp: w.sum_rrp,
        }))
      )
    }

    if (calc.calculation_trips?.length > 0) {
      await supabase.from('calculation_trips').insert(
        calc.calculation_trips.map(t => ({
          calculation_id: newCalc.id,
          days: t.days, sum: t.sum,
        }))
      )
    }

    setCopying(false)
    router.push(`/calculator/${newCalc.id}`)
  }

  const handleDownloadPdf = async () => {
    if (!calc) return
    setGeneratingPdf(true)
    const calcWithHardware = { ...calc, calculation_hardware: hardwareItems, needs_cc: calc.needs_cc || false, calculation_trips: calc.calculation_trips || [] }
    const logoUrl = `${window.location.origin}/yoda-logo.png`
    const blob = await pdf(<KpDocument calc={calcWithHardware} isPartner={isPartner} logoUrl={logoUrl} />).toBlob()
    const pdfName = `KP_${(calc.client_name || 'client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = pdfName
    a.click()
    URL.revokeObjectURL(url)
    setGeneratingPdf(false)

    // Предлагаем прикрепить PDF к сделке Bitrix24
    const dealId = (calc as any).bitrix_deal_id
    if (dealId) {
      setLastPdfBlob(blob)
      setLastPdfName(pdfName)
      setShowAttachModal(true)
    }
  }

  const handleAttachPdf = async () => {
    if (!calc || !lastPdfBlob) return
    const dealId = (calc as any).bitrix_deal_id
    if (!dealId) return
    setAttachingPdf(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Убираем data:...;base64, префикс
          resolve(result.split(',')[1] || '')
        }
        reader.onerror = reject
        reader.readAsDataURL(lastPdfBlob)
      })
      const res = await fetch('/api/bitrix/attach-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, pdfBase64: base64, filename: lastPdfName }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Ошибка прикрепления: ${err.error || 'неизвестная ошибка'}`)
      }
    } catch (e) {
      alert('Не удалось прикрепить PDF к сделке')
    } finally {
      setAttachingPdf(false)
      setShowAttachModal(false)
    }
  }

  const handleDownloadXlsx = async () => {
    if (!calc) return
    setGeneratingXlsx(true)

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('КП')

    // Цена по типу КП (без подписи типа — только сумма)
    const getPriceVal = (item: any): number => {
      if (isPartner || calc.sale_type === 'direct') return item.sum_rrp
      if (calc.sale_type === 'distributor') return item.sum_distributor
      return item.sum_partner
    }
    const getUnitPrice = (item: any): number => {
      const s = getPriceVal(item)
      return s > 0 && item.quantity > 0 ? s / item.quantity : 0
    }
    const totalSum = isPartner || calc.sale_type === 'direct' ? calc.total_rrp
      : calc.sale_type === 'distributor' ? calc.total_distributor : calc.total_partner

    // Ширины колонок
    ws.columns = [
      { key: 'A', width: 20 },
      { key: 'B', width: 44 },
      { key: 'C', width: 10 },
      { key: 'D', width: 18 },
      { key: 'E', width: 18 },
    ]

    const BLUE     = '1A5276'
    const BLUE_LT  = 'DBEAFE'
    const TOTAL_BG = 'E8F4FD'
    const ALT_BG   = 'F8FAFC'
    const WHITE    = 'FFFFFF'
    const GRAY     = '6B7280'

    const border = (color = 'E5E7EB') => ({
      top: { style: 'thin' as const, color: { argb: color } },
      left: { style: 'thin' as const, color: { argb: color } },
      bottom: { style: 'thin' as const, color: { argb: color } },
      right: { style: 'thin' as const, color: { argb: color } },
    })

    const numFmt = '#,##0'

    // ─── Заголовок компании ─────────────────────────────────
    const r1 = ws.addRow(['ООО «ЙОДА» — Коммерческое предложение'])
    ws.mergeCells(`A${r1.number}:E${r1.number}`)
    r1.getCell(1).font = { bold: true, size: 13, color: { argb: BLUE } }
    r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_LT } }
    r1.height = 24

    // ─── Клиент / проект / дата ─────────────────────────────
    const r2 = ws.addRow([
      `Клиент: ${calc.client_name || '—'}`,
      `Проект: ${calc.project_name || '—'}`,
      '',
      '',
      `Дата: ${new Date(calc.created_at).toLocaleDateString('ru-RU')}`,
    ])
    r2.getCell(1).font = { bold: true, size: 10 }
    r2.getCell(2).font = { size: 10 }
    r2.getCell(5).font = { size: 10 }
    r2.getCell(5).alignment = { horizontal: 'right' }
    r2.height = 18

    const saleTypeLabel = calc.sale_type === 'distributor' ? 'Дистрибьюторское' : calc.sale_type === 'direct' ? 'Прямое (РРЦ)' : 'Партнёрское'
    const licTermLabel = calc.license_term === 'perpetual' ? 'Бессрочные лицензии' : 'Годовые лицензии'
    const r3 = ws.addRow([`Тип КП: ${saleTypeLabel} · ${licTermLabel}`])
    ws.mergeCells(`A${r3.number}:E${r3.number}`)
    r3.getCell(1).font = { italic: true, size: 9, color: { argb: GRAY } }
    r3.height = 15

    ws.addRow([])

    // ─── Хелперы для секций ─────────────────────────────────
    const addSecHeader = (title: string, note: string) => {
      const r = ws.addRow([`${title}  (${note})`])
      ws.mergeCells(`A${r.number}:E${r.number}`)
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_LT } }
      r.getCell(1).font = { bold: true, size: 10, color: { argb: BLUE } }
      r.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
      r.height = 18
    }

    const addTableHeader = (cols: string[]) => {
      const r = ws.addRow(cols)
      r.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        cell.font = { bold: true, size: 9, color: { argb: WHITE } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = border('344A5E')
      })
      r.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
      r.getCell(2).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
      r.height = 16
    }

    const addDataRow = (cells: (string | number | null)[], isAlt: boolean) => {
      const r = ws.addRow(cells)
      r.eachCell((cell, colIdx) => {
        if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_BG } }
        cell.border = border()
        cell.font = { size: 9 }
        cell.alignment = { vertical: 'middle', wrapText: colIdx === 2 }
      })
      r.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
      r.getCell(2).alignment = { horizontal: 'left', indent: 1, vertical: 'middle', wrapText: true }
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      if (typeof cells[3] === 'number') r.getCell(4).numFmt = numFmt
      if (typeof cells[4] === 'number') r.getCell(5).numFmt = numFmt
      r.height = 15
    }

    const addSubtotal = (label: string, value: number) => {
      const r = ws.addRow(['', label, '', '', value])
      ws.mergeCells(`B${r.number}:D${r.number}`)
      r.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
        cell.font = { bold: true, size: 9, color: { argb: BLUE } }
        cell.border = border('BDD7EE')
      })
      r.getCell(2).alignment = { horizontal: 'right', indent: 1, vertical: 'middle' }
      r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(5).numFmt = numFmt
      r.height = 16
    }

    // ─── Лицензии ───────────────────────────────────────────
    const licenseItems = calc.calculation_items.filter((i: CalcItem) =>
      !i.article.includes('СТР') && i.license_type !== '-' && !i.article.includes('ETP'))
    if (licenseItems.length > 0) {
      addSecHeader('Лицензии', 'без НДС')
      addTableHeader(['Артикул', 'Наименование', 'Кол-во', 'Цена за ед.', 'Сумма'])
      licenseItems.forEach((i: CalcItem, idx: number) =>
        addDataRow([i.article, i.name, i.quantity, getUnitPrice(i) || null, getPriceVal(i) || null], idx % 2 === 1))
      addSubtotal('Итого лицензии:', licenseItems.reduce((s: number, i: CalcItem) => s + getPriceVal(i), 0))
      ws.addRow([])
    }

    // ─── Техподдержка ───────────────────────────────────────
    const supportItems = calc.calculation_items.filter((i: CalcItem) =>
      i.article.includes('СТР') || i.article.includes('ETP'))
    if (supportItems.length > 0) {
      addSecHeader('Техническая поддержка', 'с НДС')
      addTableHeader(['Артикул', 'Наименование', 'Кол-во', 'Цена за ед.', 'Сумма'])
      supportItems.forEach((i: CalcItem, idx: number) =>
        addDataRow([i.article, i.name, i.quantity, getUnitPrice(i) || null, getPriceVal(i) || null], idx % 2 === 1))
      addSubtotal('Итого ТП:', supportItems.reduce((s: number, i: CalcItem) => s + getPriceVal(i), 0))
      ws.addRow([])
    }

    // ─── Оборудование ───────────────────────────────────────
    if (hardwareItems.length > 0) {
      addSecHeader('Оборудование', 'с НДС')
      addTableHeader(['Артикул', 'Наименование', 'Кол-во', 'Цена за ед.', 'Сумма'])
      hardwareItems.forEach((i: HardwareItem, idx: number) =>
        addDataRow([i.article, i.name, i.quantity, getUnitPrice(i) || null, getPriceVal(i) || null], idx % 2 === 1))
      addSubtotal('Итого оборудование:', hardwareItems.reduce((s: number, i: HardwareItem) => s + getPriceVal(i), 0))
      ws.addRow([])
    }

    // ─── Работы по внедрению ────────────────────────────────
    if (calc.calculation_works?.length > 0) {
      addSecHeader('Работы по внедрению', 'с НДС')
      const wh = ws.addRow(['Наименование', '', 'Кол-во', 'Ед.', 'Сумма'])
      ws.mergeCells(`A${wh.number}:B${wh.number}`)
      wh.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        cell.font = { bold: true, size: 9, color: { argb: WHITE } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = border('344A5E')
      })
      wh.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
      wh.height = 16
      calc.calculation_works.forEach((w: WorkItem, idx: number) => {
        const r = ws.addRow([w.name, '', w.quantity, w.unit, w.sum_rrp])
        ws.mergeCells(`A${r.number}:B${r.number}`)
        r.eachCell(cell => {
          if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_BG } }
          cell.border = border()
          cell.font = { size: 9 }
        })
        r.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle', wrapText: true }
        r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
        r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
        r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
        r.getCell(5).numFmt = numFmt
        r.height = 15
      })
      addSubtotal('Итого работы:', calc.calculation_works.reduce((s: number, w: WorkItem) => s + w.sum_rrp, 0))
      ws.addRow([])
    }

    // ─── Командировки ───────────────────────────────────────
    if (calc.calculation_trips?.length > 0) {
      addSecHeader('Командировочные расходы', 'с НДС')
      const th = ws.addRow(['Описание', '', '', '', 'Сумма'])
      ws.mergeCells(`A${th.number}:D${th.number}`)
      th.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
        cell.font = { bold: true, size: 9, color: { argb: WHITE } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = border('344A5E')
      })
      th.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
      th.height = 16
      calc.calculation_trips.forEach((t: TripItem, idx: number) => {
        const r = ws.addRow([`${t.days} дн.`, '', '', '', t.sum])
        ws.mergeCells(`A${r.number}:D${r.number}`)
        r.eachCell(cell => {
          if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_BG } }
          cell.border = border()
          cell.font = { size: 9 }
        })
        r.getCell(1).alignment = { horizontal: 'left', indent: 1, vertical: 'middle' }
        r.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
        r.getCell(5).numFmt = numFmt
        r.height = 15
      })
      addSubtotal('Итого командировки:', calc.calculation_trips.reduce((s: number, t: TripItem) => s + t.sum, 0))
      ws.addRow([])
    }

    // ─── Итого ──────────────────────────────────────────────
    const totRow = ws.addRow(['', 'ИТОГО ПО КП:', '', '', totalSum])
    ws.mergeCells(`B${totRow.number}:D${totRow.number}`)
    totRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
      cell.font = { bold: true, size: 11, color: { argb: WHITE } }
      cell.border = border(BLUE)
    })
    totRow.getCell(2).alignment = { horizontal: 'right', indent: 1, vertical: 'middle' }
    totRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
    totRow.getCell(5).numFmt = numFmt
    totRow.height = 22

    const noteRow = ws.addRow(['* Итого включает лицензии (без НДС), оборудование и ТП (с НДС)'])
    ws.mergeCells(`A${noteRow.number}:E${noteRow.number}`)
    noteRow.getCell(1).font = { italic: true, size: 8, color: { argb: GRAY } }
    noteRow.height = 14

    // ─── Скачивание ─────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `KP_${(calc.client_name || 'client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setGeneratingXlsx(false)
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Загрузка...</p></div>
  }

  if (!calc) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Расчёт не найден</p></div>
  }

  const licenseItems = calc.calculation_items.filter(i => !i.article.includes('СТР') && i.license_type !== '-' && i.license_type !== 'hardware' && !i.article.includes('ETP'))
  const supportItems = calc.calculation_items.filter(i => i.article.includes('СТР') || i.article.includes('ETP'))
  const isRejected = calc.status === 'draft' && calc.approval_comment

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Редактирование расчёта' : (calc.client_name || 'Без клиента')}
            </h1>
            {!isEditing && <p className="text-sm text-gray-500">{calc.project_name || 'Без названия'}</p>}
          </div>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2">
            {calc.license_term === 'perpetual' && (
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-purple-50 text-purple-700">Бессрочные</span>
            )}
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
              isManagerSales && isRejected ? 'bg-red-100 text-red-700' : statusLabels[calc.status]?.color
            }`}>
              {isManagerSales && isRejected ? 'Возвращён с правками' : statusLabels[calc.status]?.label}
            </span>
            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
              {saleTypeLabels[calc.sale_type]}
            </span>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {isEditing ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Карточка проекта</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Клиент</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Название компании" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Проект</label>
                  <input value={projectName} onChange={e => setProjectName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Название проекта" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Техподдержка, лет</label>
                  <input type="number" min={1} max={5} value={supportYears}
                    onChange={e => setSupportYears(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {!isPartner && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Тип КП</label>
                    <select value={saleType} onChange={e => setSaleType(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {saleTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                {(saleType === 'partner' || saleType === 'distributor') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Партнёр</label>
                    <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Название партнёра" />
                  </div>
                )}
                {saleType === 'distributor' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Дистрибьютор</label>
                    <input value={distributorName} onChange={e => setDistributorName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Название дистрибьютора" />
                  </div>
                )}
              </div>
            </div>

            {true ? (
              /* ── Полные таблицы с ценами ── */
              <>
                {editItems.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">Лицензии и техподдержка</h2>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 font-medium">
                          <th className="text-left py-2 pr-3 w-1/2">Наименование</th>
                          <th className="text-right py-2 px-2">Кол-во</th>
                          <th className="text-right py-2 px-2">Цена партн.</th>
                          <th className="text-right py-2 px-2">Цена РРЦ</th>
                          <th className="text-right py-2 pl-2">Сумма РРЦ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editItems.map((item, i) => (
                          <tr key={item.id ?? i} className="border-b border-gray-100">
                            <td className="py-2 pr-3">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.article}</p>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={item.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const qty = Number(e.target.value) || 0
                                  const upd = [...editItems]
                                  upd[i] = { ...upd[i], quantity: qty,
                                    sum_rrp: upd[i].price_rrp * qty,
                                    sum_partner: upd[i].price_partner * qty,
                                    sum_distributor: upd[i].price_distributor * qty,
                                  }
                                  setEditItems(upd)
                                }}
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={item.price_partner}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const price = Number(e.target.value) || 0
                                  const upd = [...editItems]
                                  upd[i] = { ...upd[i], price_partner: price, sum_partner: price * upd[i].quantity }
                                  setEditItems(upd)
                                }}
                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={item.price_rrp}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const price = Number(e.target.value) || 0
                                  const upd = [...editItems]
                                  upd[i] = { ...upd[i], price_rrp: price, sum_rrp: price * upd[i].quantity }
                                  setEditItems(upd)
                                }}
                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 pl-2 text-right text-gray-700 font-medium whitespace-nowrap">{formatRub(item.sum_rrp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {hardwareItems.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-gray-900">Оборудование</h2>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">с НДС</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 font-medium">
                          <th className="text-left py-2 pr-3 w-1/2">Наименование</th>
                          <th className="text-right py-2 px-2">Кол-во</th>
                          <th className="text-right py-2 px-2">Цена партн.</th>
                          <th className="text-right py-2 px-2">Цена РРЦ</th>
                          <th className="text-right py-2 pl-2">Сумма РРЦ</th>
                          <th className="py-2 w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {hardwareItems.map((h, i) => (
                          <tr key={h.id ?? i} className="border-b border-gray-100">
                            <td className="py-2 pr-3">
                              <p className="font-medium text-gray-900">{h.name}</p>
                              <p className="text-xs text-gray-500">{h.article}</p>
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={h.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const qty = Number(e.target.value) || 0
                                  const upd = [...hardwareItems]
                                  upd[i] = { ...upd[i], quantity: qty,
                                    sum_distributor: upd[i].price_distributor * qty,
                                    sum_partner: upd[i].price_partner * qty,
                                    sum_rrp: upd[i].price_rrp * qty,
                                  }
                                  setHardwareItems(upd)
                                }}
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={h.price_partner}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const price = Number(e.target.value) || 0
                                  const upd = [...hardwareItems]
                                  upd[i] = { ...upd[i], price_partner: price, sum_partner: price * upd[i].quantity }
                                  setHardwareItems(upd)
                                }}
                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={h.price_rrp}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const price = Number(e.target.value) || 0
                                  const upd = [...hardwareItems]
                                  upd[i] = { ...upd[i], price_rrp: price, sum_rrp: price * upd[i].quantity }
                                  setHardwareItems(upd)
                                }}
                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 pl-2 text-right text-gray-700 font-medium whitespace-nowrap">{formatRub(h.sum_rrp)}</td>
                            <td className="py-2 pl-2">
                              <button onClick={() => setHardwareItems(prev => prev.filter((_, idx) => idx !== i))}
                                className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {editWorks.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-gray-900">Работы по внедрению</h2>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">с НДС</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 font-medium">
                          <th className="text-left py-2 pr-3 w-1/2">Наименование</th>
                          <th className="text-right py-2 px-2">Кол-во</th>
                          <th className="text-right py-2 px-2">Ед.</th>
                          <th className="text-right py-2 px-2">Цена РРЦ</th>
                          <th className="text-right py-2 pl-2">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editWorks.map((w, i) => (
                          <tr key={w.id ?? i} className="border-b border-gray-100">
                            <td className="py-2 pr-3 text-gray-900">{w.name}</td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={w.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const qty = Number(e.target.value) || 0
                                  const upd = [...editWorks]
                                  upd[i] = { ...upd[i], quantity: qty, sum_rrp: upd[i].price_rrp * qty }
                                  setEditWorks(upd)
                                }}
                                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 px-2 text-right text-gray-500">{w.unit}</td>
                            <td className="py-2 px-2 text-right">
                              <input type="number" min={0} value={w.price_rrp}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const price = Number(e.target.value) || 0
                                  const upd = [...editWorks]
                                  upd[i] = { ...upd[i], price_rrp: price, sum_rrp: price * upd[i].quantity }
                                  setEditWorks(upd)
                                }}
                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                            <td className="py-2 pl-2 text-right text-gray-700 font-medium whitespace-nowrap">{formatRub(w.sum_rrp)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {editTrips.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-base font-semibold text-gray-900">Командировочные расходы</h2>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">с НДС</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500 font-medium">
                          <th className="text-left py-2 pr-3">Дней</th>
                          <th className="text-right py-2 pl-2">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editTrips.map((t, i) => (
                          <tr key={t.id ?? i} className="border-b border-gray-100">
                            <td className="py-2 pr-3">
                              <input type="number" min={1} value={t.days}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const upd = [...editTrips]
                                  upd[i] = { ...upd[i], days: Number(e.target.value) || 1 }
                                  setEditTrips(upd)
                                }}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <span className="text-gray-500 ml-2 text-xs">дн.</span>
                            </td>
                            <td className="py-2 pl-2 text-right">
                              <input type="number" min={0} value={t.sum}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                  const upd = [...editTrips]
                                  upd[i] = { ...upd[i], sum: Number(e.target.value) || 0 }
                                  setEditTrips(upd)
                                }}
                                className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}

            {/* Отправить в ЦК */}
            {!isManager && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={needsCCEdit} onChange={e => setNeedsCCEdit(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-900">Подбор через Центр компетенций</p>
                  {needsCCEdit && <p className="text-xs text-amber-600 mt-0.5">После сохранения расчёт будет отправлен в ЦК</p>}
                </div>
              </div>
            )}

            {/* Комментарий при редактировании */}
            <div className={`rounded-2xl border p-4 ${isManager ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-sm font-medium mb-2 ${isManager ? 'text-amber-800' : 'text-gray-700'}">
                {isManager ? 'Комментарий руководителя' : 'Комментарий к изменениям'}
              </p>
              <textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder={isManager ? 'Комментарий для менеджера...' : 'Комментарий к изменениям...'} />
            </div>

            <div className="flex gap-3 justify-end pb-8">
              <button onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
              {isManagerSales && (
                <button
                  onClick={async () => {
                    await handleSaveEdit()
                    setShowSendModal(true)
                  }}
                  disabled={saving}
                  className="px-5 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 font-medium">
                  {saving ? 'Сохраняем...' : 'Сохранить и отправить →'}
                </button>
              )}
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Сохраняем...' : 'Сохранить изменения'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Комментарий руководителя — для менеджера */}
            {isManagerSales && calc.approval_comment && calc.status !== 'in_review' && (
              <div className={`rounded-2xl border p-4 ${calc.status === 'approved' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-sm font-medium mb-1 ${calc.status === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
                  {calc.status === 'approved' ? '✓ Согласован руководителем' : '✕ Отклонён руководителем'}
                </p>
                <p className="text-sm text-gray-700 bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-500 text-xs">Комментарий руководителя: </span>
                  {calc.approval_comment}
                </p>
              </div>
            )}

            {/* Комментарий менеджера — для руководителя */}
            {isManager && calc.manager_comment && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <p className="text-sm font-medium text-blue-800 mb-1">Комментарий менеджера</p>
                <p className="text-sm text-gray-700 bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  {calc.manager_comment}
                </p>
              </div>
            )}

            {/* Комментарий Центра компетенций */}
            {calc.cc_comment && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                <p className="text-sm font-medium text-indigo-800 mb-1">Комментарий Центра компетенций</p>
                <p className="text-sm text-gray-700 bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  {calc.cc_comment}
                </p>
              </div>
            )}

            {/* Статус для руководителя */}
            {isManager && calc.status === 'in_review' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center justify-between">
                <p className="text-sm font-medium text-yellow-800">⏳ КП ожидает вашего решения</p>
                <div className="flex gap-2">
                  <button onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm border border-yellow-300 bg-white text-yellow-800 rounded-lg hover:bg-yellow-100 font-medium">
                    Редактировать
                  </button>
                  <button onClick={() => { setShowApproveModal('approve'); setApproveComment('') }}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                    Согласовать
                  </button>
                  <button onClick={() => { setShowApproveModal('reject'); setApproveComment('') }}
                    className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                    Отклонить
                  </button>
                </div>
              </div>
            )}

            {/* Статус in_review для менеджера */}
            {isManagerSales && calc.status === 'in_review' && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
                <p className="text-sm font-medium text-yellow-800">⏳ КП отправлено на согласование руководителю</p>
                {calc.manager_comment && (
                  <p className="text-xs text-yellow-700 mt-1">Ваш комментарий: {calc.manager_comment}</p>
                )}
              </div>
            )}

            {/* Детали проекта */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Детали проекта</h2>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Клиент</p>
                  <p className="text-sm font-medium text-gray-900">{calc.client_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Проект</p>
                  <p className="text-sm font-medium text-gray-900">{calc.project_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Дата создания</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(calc.created_at)}</p>
                </div>
                {(calc as any).partner_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Партнёр</p>
                    <p className="text-sm font-medium text-gray-900">{(calc as any).partner_name}</p>
                  </div>
                )}
                {(calc as any).distributor_name && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Дистрибьютор</p>
                    <p className="text-sm font-medium text-gray-900">{(calc as any).distributor_name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Лицензии */}
            {licenseItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Лицензии {calc.license_term === 'perpetual' && <span className="text-xs font-normal text-purple-600 ml-1">бессрочные</span>}
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/2">Наименование</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                      {!isPartner && <th className="text-right py-2 px-3 font-medium text-gray-600">Дистриб.</th>}
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Партнёр</th>
                      <th className="text-right py-2 pl-3 font-medium text-gray-600">РРЦ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenseItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">
                          <div>{item.name}</div>
                          <div className="text-xs text-gray-500">{item.article}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900">{item.quantity}</td>
                        {!isPartner && <td className="py-2 px-3 text-right text-gray-500">{formatRub(item.sum_distributor)}</td>}
                        <td className="py-2 px-3 text-right text-gray-700">{formatRub(item.sum_partner)}</td>
                        <td className="py-2 pl-3 text-right font-medium text-gray-900">{formatRub(item.sum_rrp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
{/* Оборудование */}
            {hardwareItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Оборудование</h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">с НДС</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/2">Наименование</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                      {!isPartner && <th className="text-right py-2 px-3 font-medium text-gray-600">Дистриб.</th>}
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Партнёр</th>
                      <th className="text-right py-2 pl-3 font-medium text-gray-600">РРЦ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hardwareItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">
                          <div>{item.name}</div>
                          <div className="text-xs text-gray-500">{item.article}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900">{item.quantity}</td>
                        {!isPartner && <td className="py-2 px-3 text-right text-gray-500">{formatRub(item.sum_distributor)}</td>}
                        <td className="py-2 px-3 text-right text-gray-700">{formatRub(item.sum_partner)}</td>
                        <td className="py-2 pl-3 text-right font-medium text-gray-900">
                          {item.sum_rrp > 0 ? formatRub(item.sum_rrp) : 'по запросу'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Работы по внедрению от ЦК */}
            {calc.calculation_works?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Работы по внедрению</h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">с НДС · от ЦК</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/2">Наименование</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Ед.</th>
                      <th className="text-right py-2 pl-3 font-medium text-gray-600">РРЦ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.calculation_works.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">{item.name}</td>
                        <td className="py-2 px-3 text-right text-gray-900">{item.quantity}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{item.unit}</td>
                        <td className="py-2 pl-3 text-right font-medium text-gray-900">{formatRub(item.sum_rrp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Командировки от ЦК — только дни и сумма */}
            {calc.calculation_trips?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Командировки</h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">с НДС · от ЦК</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-medium text-gray-600">Кол-во дней</th>
                      <th className="text-right py-2 pl-3 font-medium text-gray-600">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.calculation_trips.map((item: TripItem) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">{item.days} дн.</td>
                        <td className="py-2 pl-3 text-right font-medium text-gray-900">{formatRub(item.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Подбор ЦК */}
            {calc.needs_cc && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-sm font-medium text-amber-800">⏳ Оборудование передано на подбор в Центр компетенций</p>
              </div>
            )}
            {/* Техподдержка */}
            {supportItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Техническая поддержка</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/2">Наименование</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                      {!isPartner && <th className="text-right py-2 px-3 font-medium text-gray-600">Дистриб.</th>}
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Партнёр</th>
                      <th className="text-right py-2 pl-3 font-medium text-gray-600">РРЦ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">
                          <div>{item.name}</div>
                          <div className="text-xs text-gray-500">{item.article}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-gray-900">{item.quantity}</td>
                        {!isPartner && <td className="py-2 px-3 text-right text-gray-500">{formatRub(item.sum_distributor)}</td>}
                        <td className="py-2 px-3 text-right text-gray-700">{formatRub(item.sum_partner)}</td>
                        <td className="py-2 pl-3 text-right font-medium text-gray-900">{formatRub(item.sum_rrp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Итого */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Итого по расчёту</h2>
              <div className="grid grid-cols-3 gap-4">
                {!isPartner && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">Дистрибьютор</p>
                    <p className="text-lg font-semibold text-gray-700">{formatRub(calc.total_distributor)}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Партнёр</p>
                  <p className="text-lg font-semibold text-gray-700">{formatRub(calc.total_partner)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 mb-1">РРЦ (клиент)</p>
                  <p className="text-lg font-semibold text-blue-700">{formatRub(calc.total_rrp)}</p>
                </div>
              </div>
              {hardwareItems.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">* Итого включает оборудование и ТП с НДС</p>
              )}
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end pb-8">
              <button onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                К списку
              </button>
              {calc.status === 'draft' && isManagerSales && (
                <button onClick={() => setShowSendModal(true)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  На согласование
                </button>
              )}
              <button onClick={handleCopy} disabled={copying}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {copying ? 'Копируем...' : 'Копировать'}
              </button>
              {(isManagerSales || isManager) && (
                <button onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Редактировать
                </button>
              )}
              {(() => {
                const dealId = (calc as any).bitrix_deal_id
                // Если сделка есть — проверяем разрешения; если нет — блокируем оба
                const excelAllowed = dealId
                  ? (bitrixPermissions ? bitrixPermissions.excel : false)
                  : false
                const pdfAllowed = dealId
                  ? (bitrixPermissions ? bitrixPermissions.pdf : false)
                  : false
                const excelTitle = !dealId ? 'Привяжите расчёт к сделке в Битрикс24'
                  : !excelAllowed ? 'Экспорт Excel доступен начиная со стадии «Клиент на пресейл»'
                  : ''
                const isPerpetualLocked = calc.license_term === 'perpetual' && calc.status !== 'approved'
                const pdfTitle = !dealId ? 'Привяжите расчёт к сделке в Битрикс24'
                  : isPerpetualLocked ? 'Требуется согласование руководителя'
                  : !pdfAllowed ? 'Экспорт PDF доступен начиная со стадии «Подготовка/согласование КП»'
                  : ''
                return (
                  <>
                    <button onClick={handleDownloadXlsx}
                      disabled={generatingXlsx || !excelAllowed}
                      title={excelTitle}
                      className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 font-medium">
                      {generatingXlsx ? 'Генерируем...' : !dealId ? '🔒 Excel' : !excelAllowed ? '🔒 Excel' : 'Скачать Excel'}
                    </button>
                    <button onClick={handleDownloadPdf}
                      disabled={generatingPdf || isPerpetualLocked || !pdfAllowed}
                      title={pdfTitle}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                      {generatingPdf ? 'Генерируем...' :
                        isPerpetualLocked ? '🔒 Ожидает согласования' :
                        (!dealId || !pdfAllowed) ? '🔒 PDF' : 'Скачать PDF'}
                    </button>
                  </>
                )
              })()}
            </div>
          </>
        )}

        {/* Модалка — отправить на согласование */}
        {showSendModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Отправить на согласование</h2>
              <p className="text-sm text-gray-500 mb-4">КП будет отправлено руководителю на согласование.</p>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Комментарий (необязательно)</label>
                <textarea value={sendComment} onChange={e => setSendComment(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Дополнительная информация для руководителя..." />
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <button onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Отмена
                </button>
                <button onClick={handleSendForApproval}
                  className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  Отправить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модалка — согласовать/отклонить */}
        {showApproveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                {showApproveModal === 'approve' ? '✓ Согласовать КП' : '✕ Отклонить КП'}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {showApproveModal === 'approve'
                  ? 'КП будет переведено в статус "Согласован".'
                  : 'КП будет возвращено менеджеру на доработку.'}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Комментарий {showApproveModal === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={showApproveModal === 'reject' ? 'Укажите причину отклонения...' : 'Дополнительный комментарий (необязательно)...'} />
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <button onClick={() => setShowApproveModal(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Отмена
                </button>
                <button onClick={handleApproveAction}
                  disabled={processing || (showApproveModal === 'reject' && !approveComment.trim())}
                  className={`px-6 py-2 text-sm rounded-lg font-medium disabled:opacity-50 text-white ${showApproveModal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                  {processing ? 'Обрабатываем...' : showApproveModal === 'approve' ? 'Согласовать' : 'Отклонить'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модалка — прикрепить PDF к сделке Bitrix24 */}
        {showAttachModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Прикрепить PDF к сделке?</h2>
              <p className="text-sm text-gray-500 mb-1">
                PDF-файл <span className="font-medium text-gray-800">{lastPdfName}</span> успешно скачан.
              </p>
              <p className="text-sm text-gray-500 mb-5">
                Хотите также прикрепить его к сделке <span className="font-medium text-gray-800">{(calc as any)?.bitrix_deal_title || 'Битрикс24'}</span>?
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowAttachModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Нет, не нужно
                </button>
                <button onClick={handleAttachPdf} disabled={attachingPdf}
                  className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {attachingPdf ? 'Прикрепляем...' : 'Прикрепить к сделке'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}