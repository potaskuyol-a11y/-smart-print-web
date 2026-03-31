'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  'Аппаратный терминал «Катюша»': 'Тип 3 — Безопасная печать с авторизацией через аппаратный терминал Катюша (карта, пин-код, логин). Включает весь функционал Тип 1-2.',
  'Программный терминал "Смарт Принт"': 'Тип 4 — Встроенный терминал на совместимых МФУ. Управление печатью, сканированием и копированием. Только для совместимых устройств. Включает весь функционал Тип 1-3.',
}

const TYPE_LABELS: Record<string, string> = {
  'Тип 1': 'Мониторинг',
  'Тип 2': 'Статистика',
  'Тип 3': 'Внешний терминал',
  'Тип 4': 'Встроенный терминал',
}

const TYPE_ORDER = ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4']

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

export default function CalculatorPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [userRole, setUserRole] = useState('')
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [registry, setRegistry] = useState<any[]>([])
  const [expertSupport, setExpertSupport] = useState<PriceRow | null>(null)

  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saleType, setSaleType] = useState('partner')
  const [licenseTerm, setLicenseTerm] = useState<'annual' | 'perpetual'>('annual')
  const [supportQty, setSupportQty] = useState(1)
  const [includeSupport, setIncludeSupport] = useState(true)

  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof) setUserRole(prof.role)

      const { data: p } = await supabase
        .from('price_list')
        .select('*')
        .eq('category', 'license')
        .eq('is_active', true)
      if (p) setPrices(p)

      const { data: etp } = await supabase
        .from('price_list')
        .select('*')
        .eq('article', 'C1-ETP-20')
        .single()
      if (etp) setExpertSupport(etp)

      const { data: reg } = await supabase.from('device_registry').select('*')
      if (reg) setRegistry(reg)
    }
    load()
  }, [])

  const isPartner = userRole === 'partner'

  const addDevice = () => {
    setDevices(prev => [...prev, {
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
    }])
  }

  const removeDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id))
  }

  const updateDevice = (id: string, field: keyof DeviceRow, value: any) => {
    setDevices(prev => prev.map(d => {
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
            updated.warning = 'Устройство не в реестре — требуется обследование'
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
    }))
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

    setDevices(prev => [...prev, ...imported])
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
          license_type: type,
          article: p.article,
          name: p.name,
          quantity: qty,
          price_distributor: p.price_distributor,
          price_partner: p.price_partner,
          price_rrp: p.price_rrp,
          sum_distributor: p.price_distributor * qty,
          sum_partner: p.price_partner * qty,
          sum_rrp: p.price_rrp * qty,
        })
        totals.rrp += p.price_rrp * qty
        totals.partner += p.price_partner * qty
        totals.distributor += p.price_distributor * qty
      }
    }

    if (includeSupport && expertSupport && supportQty > 0) {
      const etp = expertSupport
      items.push({
        license_type: '-',
        article: etp.article,
        name: etp.name,
        quantity: supportQty,
        price_distributor: etp.price_distributor,
        price_partner: etp.price_partner,
        price_rrp: etp.price_rrp,
        sum_distributor: etp.price_distributor * supportQty,
        sum_partner: etp.price_partner * supportQty,
        sum_rrp: etp.price_rrp * supportQty,
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

  const issues: string[] = []
  if (!clientName) issues.push('Укажите название клиента')
  const noFunc = devices.filter(d => !d.functionality)
  if (noFunc.length > 0) issues.push(`${noFunc.length} устройств без функционала`)
  if (totalQty === 0) issues.push('Нет устройств для расчёта')
  const canSave = issues.length === 0

  // Бессрочные требуют согласования руководителя
  const needsApproval = licenseTerm === 'perpetual'

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: calc, error } = await supabase.from('calculations').insert({
      created_by: user.id,
      client_name: clientName,
      project_name: projectName,
      sale_type: isPartner ? 'partner' : saleType,
      status: needsApproval ? 'in_review' : 'draft',
      license_term: licenseTerm,
      total_rrp: totals.rrp,
      total_partner: totals.partner,
      total_distributor: totals.distributor,
    }).select().single()

    if (error || !calc) { setSaving(false); return }

    await supabase.from('calculation_items').insert(
      calcResult.map(r => ({ ...r, calculation_id: calc.id }))
    )

    setSaving(false)
    router.push(`/calculator/${calc.id}`)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')}
          className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
        <h1 className="text-lg font-semibold text-gray-900">Новый расчёт</h1>
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
              <label className="block text-sm font-medium text-gray-800 mb-1">Проект</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название проекта" />
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
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Тип лицензий</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLicenseTerm('annual')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${licenseTerm === 'annual' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Годовые
                </button>
                <button
                  onClick={() => setLicenseTerm('perpetual')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${licenseTerm === 'perpetual' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  Бессрочные
                </button>
              </div>
            </div>
          </div>

          {/* Предупреждение о бессрочных */}
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
                            <input value={device.manufacturer}
                              onChange={e => updateDevice(device.id, 'manufacturer', e.target.value)}
                              placeholder="Производитель"
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 px-3">
                            <input value={device.model}
                              onChange={e => updateDevice(device.id, 'model', e.target.value)}
                              placeholder="Модель"
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
                              onChange={e => updateDevice(device.id, 'quantity', Number(e.target.value) || 1)}
                              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 px-3">
                            {!device.functionality ? (
                              <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-lg">Выберите функционал</span>
                            ) : device.warning ? (
                              <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">{device.warning}</span>
                            ) : device.inRegistry ? (
                              <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">В реестре</span>
                            ) : hasDevice ? (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">Не в реестре</span>
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

        {/* Экспертная техподдержка */}
        {expertSupport && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Техническая поддержка</h2>
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
                  <p className="text-xs text-gray-500 mt-0.5">Пакет 10 часов · {formatRub(expertSupport.price_rrp)} за пакет</p>
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
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">
                      <div>{r.name}</div>
                      <div className="text-xs text-gray-500">{r.article}</div>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900">{r.quantity}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{formatRub(getSaleSum(r) / r.quantity)}</td>
                    <td className="py-2 pl-3 text-right font-medium text-gray-900">{formatRub(getSaleSum(r))}</td>
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
          <button onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Сохраняем...' : needsApproval ? 'Отправить на согласование' : 'Сохранить расчёт'}
          </button>
        </div>

      </main>
    </div>
  )
}