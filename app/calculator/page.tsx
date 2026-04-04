'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── Комбо-поле: выпадающий список + свободный ввод ─────────────────────────
function ComboInput({ value, onChange, options, placeholder, inputClass }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  inputClass?: string
}) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(value)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(value) }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleFocus = () => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    setOpen(true)
  }

  const filtered = options.filter(o => !local || o.toLowerCase().includes(local.toLowerCase()))

  const dropdown = open && filtered.length > 0 && rect ? createPortal(
    <div
      style={{
        position: 'fixed',
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
    >
      {filtered.map(opt => (
        <div key={opt}
          onMouseDown={e => { e.preventDefault(); onChange(opt); setLocal(opt); setOpen(false) }}
          className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${opt === value ? 'font-medium text-blue-700 bg-blue-50' : 'text-gray-800'}`}>
          {opt}
        </div>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <>
      <input
        ref={inputRef}
        value={local}
        placeholder={placeholder}
        className={inputClass}
        onChange={e => { setLocal(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={handleFocus}
      />
      {dropdown}
    </>
  )
}

const FUNCTIONALITY_OPTIONS = [
  'Мониторинг по сети',
  'Персональная статистика',
  'Аппаратный терминал «Катюша»',
  'Программный терминал "Смарт Принт"',
]

const FUNCTIONALITY_TO_TYPE: Record<string, string> = {
  'Мониторинг по сети': 'Тип 1',
  'Персональная статистика': 'Тип 2',
  'Аппаратный терминал «Катюша»': 'Тип 3',
  'Программный терминал "Смарт Принт"': 'Тип 4',
}

const FUNCTIONALITY_HINTS: Record<string, string> = {
  'Мониторинг по сети': 'Тип 1 — Сбор статистики печати на сетевых МФУ и принтерах по протоколу SNMP. Базовый мониторинг без идентификации пользователей.',
  'Персональная статистика': 'Тип 2 — Сбор персонализированной статистики в разрезе пользователь/объём печати. Включает весь функционал Тип 1.',
  'Аппаратный терминал «Катюша»': 'Тип 3 — Безопасная печать с авторизацией через аппаратный терминал Катюша. Включает весь функционал Тип 1-2.',
  'Программный терминал "Смарт Принт"': 'Тип 4 — Встроенный терминал на совместимых МФУ. Управление печатью, сканированием и копированием. Только для совместимых устройств.',
}

const TYPE_LABELS: Record<string, string> = {
  'Тип 1': 'Мониторинг',
  'Тип 2': 'Статистика',
  'Тип 3': 'Внешний терминал',
  'Тип 4': 'Встроенный терминал',
}

const TYPE_ORDER = ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4']

const HARDWARE_TYPE3 = ['СР-ТВТ-01', 'М3-КРН-01']
const HARDWARE_TYPE4_KATUSHA = ['CK223', '685621.013', '685621.015', 'CK121', '685621.011', 'СК3111', 'М3-КРН-02']
const HARDWARE_TYPE4_DEFAULT = ['TWN4']
const KATUSHA_KEYWORDS = ['katusha', 'катюша']

interface DeviceRow {
  id: string
  manufacturer: string
  model: string
  functionality: string
  quantity: number
  warning: string
  inRegistry: boolean
  needsInspection: boolean
  maxAllowed: string
  fromImport: boolean
}

interface HardwareRow {
  id: string
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

interface PriceRow {
  license_type: string
  min_quantity: number
  price_distributor: number
  price_partner: number
  price_rrp: number
  article: string
  name: string
  category: string
  is_active: boolean
  license_term: string
  includes_vat: boolean
  description: string | null
}

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

function getAvailableOptions(maxAllowed: string, inRegistry: boolean, hasDevice: boolean): string[] {
  if (!hasDevice) return FUNCTIONALITY_OPTIONS
  if (!inRegistry) return FUNCTIONALITY_OPTIONS.filter(f => FUNCTIONALITY_TO_TYPE[f] !== 'Тип 4')
  const maxIdx = TYPE_ORDER.indexOf(maxAllowed)
  return FUNCTIONALITY_OPTIONS.filter(f => TYPE_ORDER.indexOf(FUNCTIONALITY_TO_TYPE[f]) <= maxIdx)
}

function uid() {
  return Math.random().toString(36).slice(2)
}
function Tooltip({ text, children }: { text: string | null; children: React.ReactNode }) {
  if (!text) return <>{children}</>
  return (
    <div className="relative group inline-block w-full">
      {children}
      <div className="absolute left-0 top-full mt-1 z-30 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-72 shadow-lg pointer-events-none">
        {text}
      </div>
    </div>
  )
}
export default function CalculatorPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [userRole, setUserRole] = useState('')
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [hardwarePrices, setHardwarePrices] = useState<PriceRow[]>([])
  const [registry, setRegistry] = useState<any[]>([])
  const [expertSupport, setExpertSupport] = useState<PriceRow | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  // Bitrix24 deals
  const [bitrixDeals, setBitrixDeals] = useState<{ id: string; title: string; stage: string }[]>([])
  const [bitrixDealId, setBitrixDealId] = useState<string>('')
  const [bitrixDealTitle, setBitrixDealTitle] = useState<string>('')
  const [bitrixLoading, setBitrixLoading] = useState(false)

  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saleType, setSaleType] = useState('partner')
  const [licenseTerm, setLicenseTerm] = useState<'annual' | 'perpetual'>('annual')
  const [supportQty, setSupportQty] = useState(1)
  const [includeSupport, setIncludeSupport] = useState(true)

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [hardware, setHardware] = useState<HardwareRow[]>([])
  const [needsCC, setNeedsCC] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const [distributorName, setDistributorName] = useState('')

  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalComment, setApprovalComment] = useState('')

  const buildHardwareRow = useCallback((article: string, qty: number, hwPrices: PriceRow[]): HardwareRow | null => {
    const p = hwPrices.find(h => h.article === article)
    if (!p) return null
    return {
      id: uid(),
      article: p.article,
      name: p.name,
      quantity: qty,
      price_distributor: p.price_distributor,
      price_partner: p.price_partner,
      price_rrp: p.price_rrp,
      sum_distributor: p.price_distributor * qty,
      sum_partner: p.price_partner * qty,
      sum_rrp: p.price_rrp * qty,
      includes_vat: true,
    }
  }, [])

  const autoSelectHardware = useCallback((devs: DeviceRow[], hwPrices: PriceRow[]) => {
    if (hwPrices.length === 0) return
    const articleQty: Record<string, number> = {}

    const type3Qty = devs
      .filter(d => FUNCTIONALITY_TO_TYPE[d.functionality] === 'Тип 3')
      .reduce((s, d) => s + d.quantity, 0)

    if (type3Qty > 0) {
      HARDWARE_TYPE3.forEach(a => { articleQty[a] = (articleQty[a] || 0) + type3Qty })
    }

    devs.filter(d => FUNCTIONALITY_TO_TYPE[d.functionality] === 'Тип 4').forEach(dev => {
      const isKatusha = KATUSHA_KEYWORDS.some(k => dev.manufacturer.toLowerCase().includes(k))
      const articles = isKatusha ? HARDWARE_TYPE4_KATUSHA : HARDWARE_TYPE4_DEFAULT
      articles.forEach(a => { articleQty[a] = (articleQty[a] || 0) + dev.quantity })
    })

    const newHardware: HardwareRow[] = []
    Object.entries(articleQty).forEach(([article, qty]) => {
      const row = buildHardwareRow(article, qty, hwPrices)
      if (row) newHardware.push(row)
    })

    setHardware(newHardware)
  }, [buildHardwareRow])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof) setUserRole(prof.role)

      // Загружаем сделки Bitrix24
      if (user.email) {
        setBitrixLoading(true)
        try {
          const dealsRes = await fetch(`/api/bitrix/deals?email=${encodeURIComponent(user.email)}`)
          if (dealsRes.ok) {
            const dealsJson = await dealsRes.json()
            if (Array.isArray(dealsJson.deals)) {
              setBitrixDeals(dealsJson.deals.map((d: any) => ({
                id: d.ID,
                title: d.TITLE,
                stage: d.STAGE_ID,
              })))
            }
          }
        } catch {
          // Bitrix недоступен — работаем без сделок
        } finally {
          setBitrixLoading(false)
        }
      }

      const { data: p } = await supabase.from('price_list').select('*')
        .eq('category', 'license').eq('is_active', true)
      if (p) setPrices(p)

      const { data: hw } = await supabase.from('price_list').select('*')
        .eq('category', 'hardware').eq('is_active', true)
      if (hw) setHardwarePrices(hw)

      const { data: etp } = await supabase.from('price_list').select('*')
        .eq('article', 'C1-ETP-20').single()
      if (etp) setExpertSupport(etp)

      const { data: reg } = await supabase.from('device_registry').select('*')
      if (reg) setRegistry(reg)

      // Режим редактирования
      const params = new URLSearchParams(window.location.search)
      const editParam = params.get('edit')
      if (editParam) {
        setEditId(editParam)
        setEditLoading(true)

        const { data: calcData } = await supabase
          .from('calculations')
          .select('*, calculation_items(*), calculation_hardware(*)')
          .eq('id', editParam)
          .single()

        if (calcData) {
          setClientName(calcData.client_name || '')
          setProjectName(calcData.project_name || '')
          if ((calcData as any).bitrix_deal_id) {
            setBitrixDealId((calcData as any).bitrix_deal_id)
            setBitrixDealTitle((calcData as any).bitrix_deal_title || '')
          }
          setSaleType(calcData.sale_type || 'partner')
          setLicenseTerm(calcData.license_term || 'annual')
          setNeedsCC(calcData.needs_cc || false)
          setPartnerName((calcData as any).partner_name || '')
          setDistributorName((calcData as any).distributor_name || '')

          const etpItem = calcData.calculation_items?.find((i: any) => i.article === 'C1-ETP-20')
          if (etpItem) {
            setIncludeSupport(true)
            setSupportQty(etpItem.quantity)
          } else {
            setIncludeSupport(false)
          }

          if (calcData.calculation_hardware?.length > 0) {
            setHardware(calcData.calculation_hardware.map((h: any) => ({
              id: uid(),
              article: h.article,
              name: h.name,
              quantity: h.quantity,
              price_distributor: h.price_distributor,
              price_partner: h.price_partner,
              price_rrp: h.price_rrp,
              sum_distributor: h.sum_distributor,
              sum_partner: h.sum_partner,
              sum_rrp: h.sum_rrp,
              includes_vat: true,
            })))
          }

          const licItems = calcData.calculation_items?.filter((i: any) =>
            i.license_type !== '-' && i.license_type !== 'hardware' && !i.article.includes('СТР')
          ) || []

          const restoredDevices: DeviceRow[] = licItems.map((item: any) => ({
            id: uid(),
            manufacturer: '',
            model: '',
            functionality: Object.entries(FUNCTIONALITY_TO_TYPE).find(([, t]) => t === item.license_type)?.[0] || '',
            quantity: item.quantity,
            warning: '',
            inRegistry: false,
            needsInspection: false,
            maxAllowed: 'Тип 4',
            fromImport: false,
          }))
          setDevices(restoredDevices)
        }
        setEditLoading(false)
      }
    }
    load()
  }, [])

  const isPartner = userRole === 'partner'

  const addDevice = () => {
    const newDevice: DeviceRow = {
      id: uid(),
      manufacturer: '',
      model: '',
      functionality: '',
      quantity: 1,
      warning: '',
      inRegistry: false,
      needsInspection: false,
      maxAllowed: 'Тип 3',
      fromImport: false,
    }
    const newDevices = [...devices, newDevice]
    setDevices(newDevices)
    autoSelectHardware(newDevices, hardwarePrices)
  }

  const removeDevice = (id: string) => {
    const newDevices = devices.filter(d => d.id !== id)
    setDevices(newDevices)
    autoSelectHardware(newDevices, hardwarePrices)
    // Снимаем статус загруженного файла, если импортированных устройств больше нет
    if (fileName && !newDevices.some(d => d.fromImport)) setFileName('')
  }

  const clearAllDevices = () => {
    setDevices([])
    setHardware([])
    setFileName('')
  }

  const updateDevice = (id: string, field: keyof DeviceRow, value: any) => {
    const newDevices = devices.map(d => {
      if (d.id !== id) return d
      const updated = { ...d, [field]: value }

      if (field === 'manufacturer' || field === 'model') {
        const man = field === 'manufacturer' ? value : d.manufacturer
        const mod = field === 'model' ? value : d.model
        if (man && mod) {
          const entry = registry.find(r =>
            r.manufacturer.toLowerCase() === man.toLowerCase() &&
            r.model.toLowerCase().replace(/\s+/g, ' ') === mod.toLowerCase().replace(/\s+/g, ' ')
          )
          if (entry) {
            updated.inRegistry = true
            updated.needsInspection = false
            const max = entry.max_license_type.includes('4') ? 'Тип 4'
              : entry.max_license_type.includes('3') ? 'Тип 3'
              : entry.max_license_type.includes('2') ? 'Тип 2' : 'Тип 1'
            updated.maxAllowed = max
            updated.warning = ''
          } else {
            updated.inRegistry = false
            updated.needsInspection = true
            updated.maxAllowed = 'Тип 3'
            updated.warning = 'Устройство требует обследования'
          }
        } else {
          updated.inRegistry = false
          updated.needsInspection = false
          updated.warning = ''
        }
      }

      if (field === 'functionality' && updated.inRegistry) {
        const reqType = FUNCTIONALITY_TO_TYPE[value as string]
        const maxIdx = TYPE_ORDER.indexOf(updated.maxAllowed)
        const reqIdx = TYPE_ORDER.indexOf(reqType)
        if (reqIdx > maxIdx) {
          updated.warning = `${reqType} недоступен для этого устройства. Максимум: ${updated.maxAllowed}`
        } else {
          updated.warning = updated.needsInspection ? 'Устройство не в реестре — требуется обследование' : ''
        }
      }

      return updated
    })
    setDevices(newDevices)
    autoSelectHardware(newDevices, hardwarePrices)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportLoading(true)
    setImportError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('registry', JSON.stringify(registry))

    const res = await fetch('/api/parse-devices', { method: 'POST', body: formData })
    const result = await res.json()

    if (!res.ok) {
      setImportError(result.error || 'Ошибка при разборе файла')
      setImportLoading(false)
      return
    }

    if (result.clientName && !clientName) setClientName(result.clientName)

    const imported: DeviceRow[] = result.devices.map((d: any) => ({
      id: uid(),
      manufacturer: d.manufacturer,
      model: d.model || '',
      functionality: d.suggestedFunctionality || '',
      quantity: 1,
      warning: d.warning || '',
      inRegistry: d.inRegistry,
      needsInspection: d.needsInspection,
      maxAllowed: d.maxAllowed || 'Тип 3',
      fromImport: true,
    }))

    const allDevices = [...devices, ...imported]
    setDevices(allDevices)
    autoSelectHardware(allDevices, hardwarePrices)
    setImportLoading(false)
  }

  const summary = devices.reduce((acc, d) => {
    const type = FUNCTIONALITY_TO_TYPE[d.functionality]
    if (type && d.quantity > 0) acc[type] = (acc[type] || 0) + d.quantity
    return acc
  }, {} as Record<string, number>)

  const totalQty = Object.values(summary).reduce((s, v) => s + v, 0)

  function getPrice(type: string) {
    return prices.filter(p =>
      p.license_type === type &&
      p.license_term === licenseTerm &&
      p.min_quantity <= totalQty
    ).sort((a, b) => b.min_quantity - a.min_quantity)[0] || null
  }

  const calcItems = () => {
    const items: any[] = []
    const totals = { rrp: 0, partner: 0, distributor: 0 }

    for (const [type, qty] of Object.entries(summary)) {
      const p = getPrice(type)
      if (p) {
       items.push({
          license_type: type, article: p.article, name: p.name, quantity: qty,
          price_distributor: p.price_distributor, price_partner: p.price_partner, price_rrp: p.price_rrp,
          sum_distributor: p.price_distributor * qty,
          sum_partner: p.price_partner * qty,
          sum_rrp: p.price_rrp * qty,
          description: p.description || null,
        })
        totals.rrp += p.price_rrp * qty
        totals.partner += p.price_partner * qty
        totals.distributor += p.price_distributor * qty
      }
    }

    if (!needsCC) {
      hardware.filter(h => h.quantity > 0).forEach(h => {
       items.push({
          license_type: 'hardware',
          article: h.article,
          name: h.name + ' (с НДС)',
          quantity: h.quantity,
          price_distributor: h.price_distributor,
          price_partner: h.price_partner,
          price_rrp: h.price_rrp,
          sum_distributor: h.sum_distributor,
          sum_partner: h.sum_partner,
          sum_rrp: h.sum_rrp,
          description: hardwarePrices.find(p => p.article === h.article)?.description || null,
        })
        totals.rrp += h.sum_rrp
        totals.partner += h.sum_partner
        totals.distributor += h.sum_distributor
      })
    }

    if (includeSupport && expertSupport && supportQty > 0) {
      const etp = expertSupport
      items.push({
          license_type: '-',
          article: etp.article,
          name: etp.name + ' (с НДС)',
          quantity: supportQty,
          price_distributor: etp.price_distributor,
          price_partner: etp.price_partner,
          price_rrp: etp.price_rrp,
          sum_distributor: etp.price_distributor * supportQty,
          sum_partner: etp.price_partner * supportQty,
          sum_rrp: etp.price_rrp * supportQty,
          description: etp.description || null,
        })
      totals.rrp += etp.price_rrp * supportQty
      totals.partner += etp.price_partner * supportQty
      totals.distributor += etp.price_distributor * supportQty
    }

    return { items, totals }
  }

  const { items: calcResult, totals } = calcItems()

  const getSaleTotal = () =>
    saleType === 'distributor' ? totals.distributor
    : saleType === 'direct' ? totals.rrp
    : totals.partner

  const getSaleSum = (item: any) =>
    saleType === 'distributor' ? item.sum_distributor
    : saleType === 'direct' ? item.sum_rrp
    : item.sum_partner

  const priceColLabel = saleType === 'distributor' ? 'Дистрибьютор'
    : saleType === 'direct' ? 'РРЦ' : 'Партнёр'

  const hasDeal = !!bitrixDealId

  const issues: string[] = []
  if (!clientName) issues.push('Укажите название клиента')
  const noFunc = devices.filter(d => !d.functionality)
  if (noFunc.length > 0) issues.push(`${noFunc.length} устройств без функционала`)
  if (totalQty === 0) issues.push('Нет устройств для расчёта')
  if ((needsCC || licenseTerm === 'perpetual') && !hasDeal) issues.push('Для отправки на согласование необходимо выбрать сделку в Битрикс24')
  const canSave = issues.length === 0
  const needsApproval = licenseTerm === 'perpetual'

  const doSave = async (comment: string) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const calcData: any = {
      client_name: clientName,
      project_name: projectName,
      sale_type: isPartner ? 'partner' : saleType,
      status: needsApproval || needsCC ? 'in_review' : 'draft',
      license_term: licenseTerm,
      needs_cc: needsCC,
      partner_name: (saleType === 'partner' || saleType === 'distributor') ? (partnerName.trim() || null) : null,
      distributor_name: saleType === 'distributor' ? (distributorName.trim() || null) : null,
      total_rrp: totals.rrp,
      total_partner: totals.partner,
      total_distributor: totals.distributor,
      bitrix_deal_id: bitrixDealId || null,
      bitrix_deal_title: bitrixDealTitle || null,
      ...(comment ? { manager_comment: comment } : {}),
    }

    let calcId = editId

    if (editId) {
      await supabase.from('calculations').update(calcData).eq('id', editId)
      await supabase.from('calculation_items').delete().eq('calculation_id', editId)
      await supabase.from('calculation_hardware').delete().eq('calculation_id', editId)
    } else {
      const { data: calc, error } = await supabase.from('calculations').insert({
        ...calcData,
        created_by: user.id,
      }).select().single()
      if (error || !calc) { setSaving(false); return }
      calcId = calc.id
    }

    if (!calcId) { setSaving(false); return }

    if (calcResult.length > 0) {
      await supabase.from('calculation_items').insert(
        calcResult.map(({ description, ...r }: any) => ({ ...r, calculation_id: calcId }))
      )
    }

    if (!needsCC && hardware.filter(h => h.quantity > 0).length > 0) {
      await supabase.from('calculation_hardware').insert(
        hardware.filter(h => h.quantity > 0).map(h => ({
          calculation_id: calcId,
          article: h.article,
          name: h.name,
          quantity: h.quantity,
          price_distributor: h.price_distributor,
          price_partner: h.price_partner,
          price_rrp: h.price_rrp,
          sum_distributor: h.sum_distributor,
          sum_partner: h.sum_partner,
          sum_rrp: h.sum_rrp,
          includes_vat: true,
        }))
      )
    }

    setSaving(false)
    router.push(`/calculator/${calcId}`)
  }

  const handleSave = async () => {
    if (!canSave) return
    if (needsApproval || needsCC) {
      setShowApprovalModal(true)
      return
    }
    await doSave('')
  }

  const supportHint = isPartner
    ? 'Экспертная ТП включена в КП.'
    : saleType === 'partner' || saleType === 'distributor'
    ? 'Экспертная ТП включается в КП для партнёра.'
    : 'Экспертная ТП включается в КП для клиента.'

  const supportOffHint = isPartner
    ? 'ТП не включена. Обратитесь к вашему менеджеру для приобретения экспертной поддержки.'
    : saleType === 'partner' || saleType === 'distributor'
    ? 'ТП не включена в КП. Предложите партнёру приобрести экспертную ТП отдельно.'
    : 'ТП не включена в КП. Предложите клиенту приобрести экспертную ТП отдельно.'

  const hasHardware = summary['Тип 3'] > 0 || summary['Тип 4'] > 0

  if (editLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Загружаем данные расчёта...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push(editId ? `/calculator/${editId}` : '/dashboard')}
          className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
        <h1 className="text-lg font-semibold text-gray-900">
          {editId ? 'Редактирование расчёта' : 'Новый расчёт'}
        </h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Карточка проекта */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Карточка проекта</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Клиент <span className="text-red-500">*</span>
              </label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!clientName ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Название компании" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Сделка в Битрикс24
                {bitrixLoading && <span className="ml-2 text-xs text-gray-400">загружаем...</span>}
              </label>
              <select
                value={bitrixDealId}
                onChange={e => {
                  const id = e.target.value
                  setBitrixDealId(id)
                  if (!id) {
                    setBitrixDealTitle('')
                    return
                  }
                  const deal = bitrixDeals.find(d => d.id === id)
                  setBitrixDealTitle(deal?.title || '')
                  // Автоматически заполняем поле "Проект" по названию сделки
                  if (!projectName && deal) setProjectName(deal.title)
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!hasDeal && (needsCC || licenseTerm === 'perpetual') ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
              >
                <option value="">— Без проекта —</option>
                {bitrixDeals.map(d => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
              {!hasDeal && (
                <p className="text-xs text-amber-700 mt-1">
                  Без привязки к сделке недоступны: согласование, ЦК, экспорт Excel и PDF
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Проект</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название проекта (необязательно)" />
            </div>
            {!isPartner && (
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Тип КП</label>
                <select value={saleType} onChange={e => setSaleType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="partner">Партнёрское</option>
                  <option value="direct">Прямое (РРЦ)</option>
                  <option value="distributor">Дистрибьюторское</option>
                </select>
              </div>
            )}
            {!isPartner && (saleType === 'partner' || saleType === 'distributor') && (
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Партнёр</label>
                <input value={partnerName} onChange={e => setPartnerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Название партнёра" />
              </div>
            )}
            {!isPartner && saleType === 'distributor' && (
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Дистрибьютор</label>
                <input value={distributorName} onChange={e => setDistributorName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Название дистрибьютора" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Тип лицензий</label>
              <div className="flex gap-2">
                <button onClick={() => setLicenseTerm('annual')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${licenseTerm === 'annual' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Годовые
                </button>
                <button onClick={() => setLicenseTerm('perpetual')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${licenseTerm === 'perpetual' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Бессрочные
                </button>
              </div>
            </div>
          </div>
          {needsApproval && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
              <span className="text-amber-500 text-base mt-0.5">⚠</span>
              <div>
                <p className="text-sm font-medium text-amber-800">Бессрочные лицензии требуют согласования</p>
                <p className="text-xs text-amber-700 mt-0.5">После сохранения КП автоматически отправится на согласование руководителю.</p>
              </div>
            </div>
          )}
        </div>

        {/* Устройства */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Устройства</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Итого: <span className="font-medium text-gray-900">{totalQty}</span> устройств
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click() } }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                ↑ {fileName ? 'Загрузить ещё' : 'Загрузить анкету'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              {devices.length > 0 && (
                <button onClick={clearAllDevices}
                  className="px-3 py-2 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                  Очистить всё
                </button>
              )}
              <button onClick={addDevice}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                + Добавить устройство
              </button>
            </div>
          </div>

          {importLoading && <div className="bg-blue-50 rounded-xl p-3 mb-4"><p className="text-sm text-blue-700">Разбираем файл...</p></div>}
          {importError && <div className="bg-red-50 rounded-xl p-3 mb-4"><p className="text-sm text-red-700">{importError}</p></div>}
          {fileName && !importLoading && <div className="bg-green-50 rounded-xl p-3 mb-4"><p className="text-sm text-green-700">✓ Загружено: {fileName}</p></div>}

          {devices.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
              <p className="text-gray-500 text-sm font-medium">Нет устройств</p>
              <p className="text-gray-400 text-xs mt-1">Загрузите анкету клиента или добавьте устройства вручную</p>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click() } }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Загрузить анкету
                </button>
                <button onClick={addDevice}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  + Добавить вручную
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-600 w-36">Производитель</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600 w-40">Модель</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Функционал СУП <span className="text-red-500">*</span></th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600 w-24">Кол-во</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600 w-48">Статус</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map(device => {
                      const hasDevice = !!(device.manufacturer || device.model)
                      return (
                        <tr key={device.id}
                          className={`border-b border-gray-100 ${!device.functionality ? 'bg-red-50' : device.warning ? 'bg-amber-50' : ''}`}>
                          <td className="py-2 px-3">
                            <ComboInput
                              value={device.manufacturer}
                              onChange={v => updateDevice(device.id, 'manufacturer', v)}
                              options={[...new Set(registry.map((r: any) => r.manufacturer as string).filter(Boolean))].sort()}
                              placeholder="Производитель"
                              inputClass="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <ComboInput
                              value={device.model}
                              onChange={v => updateDevice(device.id, 'model', v)}
                              options={registry
                                .filter((r: any) => !device.manufacturer || r.manufacturer.toLowerCase() === device.manufacturer.toLowerCase())
                                .map((r: any) => r.model as string)
                                .filter(Boolean)
                                .sort()}
                              placeholder="Модель"
                              inputClass="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <div className="relative group">
                              <select
                                value={device.functionality}
                                onChange={e => updateDevice(device.id, 'functionality', e.target.value)}
                                className={`w-full border rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${!device.functionality ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                                {!device.functionality && <option value="">— выберите функционал —</option>}
                                {getAvailableOptions(device.maxAllowed, device.inRegistry, hasDevice).map(f => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                              {device.functionality && (
                                <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-80 shadow-lg pointer-events-none">
                                  {FUNCTIONALITY_HINTS[device.functionality]}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <input type="number" min={1}
                              value={device.quantity}
                              onFocus={e => e.target.select()}
                              onChange={e => updateDevice(device.id, 'quantity', Number(e.target.value) || 1)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 px-3">
                            {!device.functionality ? (
                              <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-lg">Выберите функционал</span>
                            ) : device.warning ? (
                              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">{device.warning}</span>
                            ) : device.inRegistry ? (
                              <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">Обследован</span>
                            ) : hasDevice ? (
                              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">Требует обследования</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-1 text-center">
                            <button onClick={() => removeDevice(device.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors text-xl leading-none">×</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalQty > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-4 gap-3">
                  {Object.entries(summary).map(([type, qty]) => (
                    <div key={type} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500">{TYPE_LABELS[type] || type}</p>
                      <p className="text-xl font-semibold text-gray-900 mt-1">{qty} шт.</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Оборудование */}
        {hasHardware && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Оборудование</h2>
                <p className="text-xs text-gray-500 mt-0.5">Все позиции указаны с НДС</p>
              </div>
              {summary['Тип 4'] > 0 && (
                <div className="flex items-center gap-3">
                  <label className={`relative inline-flex items-center ${hasDeal ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input type="checkbox" checked={needsCC} onChange={e => hasDeal && setNeedsCC(e.target.checked)} className="sr-only peer" disabled={!hasDeal} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                  <span className={`text-sm ${hasDeal ? 'text-gray-700' : 'text-gray-400'}`}>
                    Подбор через Центр компетенций
                    {!hasDeal && <span className="ml-1 text-xs">(выберите сделку)</span>}
                  </span>
                </div>
              )}
            </div>

            {needsCC ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800">Оборудование будет подобрано Центром компетенций</p>
                <p className="text-xs text-amber-600 mt-1">После сохранения расчёт будет отправлен в ЦК для подбора оборудования</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {hardware.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <Tooltip text={hardwarePrices.find(p => p.article === h.article)?.description || null}>
                          <div className="cursor-help">
                            <p className="text-sm font-medium text-gray-900 truncate">{h.name}</p>
                            <p className="text-xs text-gray-500">{h.article}</p>
                          </div>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input type="number" min={0} value={h.quantity}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const qty = Number(e.target.value) || 0
                            const updated = [...hardware]
                            updated[i] = {
                              ...updated[i],
                              quantity: qty,
                              sum_distributor: updated[i].price_distributor * qty,
                              sum_partner: updated[i].price_partner * qty,
                              sum_rrp: updated[i].price_rrp * qty,
                            }
                            setHardware(updated)
                          }}
                          className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        <span className="text-xs text-gray-500">шт.</span>
                        <span className="text-sm font-medium text-gray-900 w-36 text-right">
                          {h.sum_rrp > 0 ? formatRub(h.sum_rrp) : 'по запросу'}
                        </span>
                        <button onClick={() => setHardware(prev => prev.filter(x => x.id !== h.id))}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xl leading-none">×</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <select value="" onChange={e => {
                    const article = e.target.value
                    if (!article) return
                    const p = hardwarePrices.find(h => h.article === article)
                    if (!p) return
                    if (hardware.find(h => h.article === article)) return
                    setHardware(prev => [...prev, {
                      id: uid(),
                      article: p.article,
                      name: p.name,
                      quantity: 1,
                      price_distributor: p.price_distributor,
                      price_partner: p.price_partner,
                      price_rrp: p.price_rrp,
                      sum_distributor: p.price_distributor,
                      sum_partner: p.price_partner,
                      sum_rrp: p.price_rrp,
                      includes_vat: true,
                    }])
                  }}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="">+ Добавить позицию оборудования...</option>
                    {hardwarePrices
                      .filter(p => !hardware.find(h => h.article === p.article))
                      .filter((p, i, arr) => arr.findIndex(x => x.article === p.article) === i)
                      .map(p => (
                        <option key={p.article} value={p.article}>{p.name} — {p.article}</option>
                      ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        {/* Экспертная техподдержка */}
        {expertSupport && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Техническая поддержка <span className="text-xs font-normal text-gray-500">(с НДС)</span>
            </h2>
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-3 flex-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={includeSupport}
                    onChange={e => setIncludeSupport(e.target.checked)}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-900">Экспертная техподдержка (уровень 2)</p>
                  <p className="text-xs text-gray-500 mt-0.5">Пакет 10 часов · {formatRub(expertSupport.price_rrp)} за пакет с НДС</p>
                </div>
              </div>
              {includeSupport && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Пакетов:</label>
                  <input type="number" min={1} max={99} value={supportQty}
                    onChange={e => setSupportQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
            <div className={`mt-4 rounded-xl p-3 ${includeSupport ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <p className={`text-xs ${includeSupport ? 'text-blue-700' : 'text-amber-700'}`}>
                {includeSupport ? supportHint : supportOffHint}
              </p>
            </div>
          </div>
        )}

        {/* Предупреждения */}
        {devices.length > 0 && issues.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-800 mb-1">Нельзя сохранить расчёт:</p>
            <ul className="space-y-0.5">
              {issues.map((issue, i) => (
                <li key={i} className="text-sm text-red-700">• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Результат расчёта */}
        {calcResult.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Результат расчёта</h2>
              <div className="flex gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                  {licenseTerm === 'perpetual' ? 'Бессрочные лицензии' : 'Годовые лицензии'}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                  {isPartner ? 'Партнёрское' : saleType === 'distributor' ? 'Дистрибьюторское' : saleType === 'direct' ? 'Прямое (РРЦ)' : 'Партнёрское'}
                </span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/2">Наименование</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Цена за ед.</th>
                  <th className="text-right py-2 pl-3 font-medium text-gray-600">{priceColLabel}</th>
                </tr>
              </thead>
              <tbody>
                {calcResult.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${r.license_type === 'hardware' || r.license_type === '-' ? 'bg-gray-50' : ''}`}>
                    <td className="py-2 pr-4 text-gray-900">
                      <Tooltip text={r.description || null}>
                        <div className="cursor-help">
                          <div>{r.name}</div>
                          <div className="text-xs text-gray-500">{r.article}</div>
                        </div>
                      </Tooltip>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900">{r.quantity}</td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {getSaleSum(r) > 0 ? formatRub(getSaleSum(r) / r.quantity) : 'по запросу'}
                    </td>
                    <td className="py-2 pl-3 text-right font-medium text-gray-900">
                      {getSaleSum(r) > 0 ? formatRub(getSaleSum(r)) : 'по запросу'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="py-3 font-semibold text-gray-900">Итого</td>
                  <td></td><td></td>
                  <td className="py-3 pl-3 text-right font-bold text-gray-900">{formatRub(getSaleTotal())}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-3 justify-end pb-8">
          <button onClick={() => router.push(editId ? `/calculator/${editId}` : '/dashboard')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Сохраняем...' : needsApproval || needsCC ? 'Отправить на согласование' : editId ? 'Сохранить изменения' : 'Сохранить расчёт'}
          </button>
        </div>

        {/* Модалка отправки на согласование */}
        {showApprovalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                {needsCC ? 'Отправить в Центр компетенций' : 'Отправить на согласование'}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {needsCC
                  ? 'КП будет отправлено в ЦК для подбора оборудования.'
                  : 'Бессрочные лицензии требуют согласования руководителя.'}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Комментарий (необязательно)</label>
                <textarea value={approvalComment} onChange={e => setApprovalComment(e.target.value)} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Дополнительная информация..." />
              </div>
              <div className="flex gap-3 justify-end mt-5">
                <button onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Отмена
                </button>
                <button onClick={async () => { setShowApprovalModal(false); await doSave(approvalComment) }}
                  className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  {needsCC ? 'Отправить в ЦК' : 'Отправить на согласование'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}