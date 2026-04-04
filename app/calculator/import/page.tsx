'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface DeviceRow {
  manufacturer: string
  model: string
  modelMissing: boolean
  clientFunctionality: string
  suggestedFunctionality: string
  maxAllowed: string
  inRegistry: boolean
  needsInspection: boolean
  warning: string
  selectedFunctionality: string
  manualModel: string
}

const FUNCTIONALITY_OPTIONS = [
  'Мониторинг по сети',
  'Персональная статистика',
  'Аппаратный терминал/Мобильное приложение "Смарт Принт"',
  'Программный терминал "Смарт Принт"',
]

const FUNCTIONALITY_TO_TYPE: Record<string, string> = {
  'Мониторинг по сети': 'Тип 1',
  'Персональная статистика': 'Тип 2',
  'Аппаратный терминал/Мобильное приложение "Смарт Принт"': 'Тип 3',
  'Программный терминал "Смарт Принт"': 'Тип 4',
}

const TYPE_ORDER = ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4']

function getAvailableOptions(device: DeviceRow): string[] {
  if (!device.inRegistry) {
    return FUNCTIONALITY_OPTIONS.filter(f => FUNCTIONALITY_TO_TYPE[f] !== 'Тип 4')
  }
  const maxIdx = TYPE_ORDER.indexOf(device.maxAllowed)
  return FUNCTIONALITY_OPTIONS.filter(f => {
    const t = FUNCTIONALITY_TO_TYPE[f]
    return TYPE_ORDER.indexOf(t) <= maxIdx
  })
}

export default function ImportDevicesPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [registry, setRegistry] = useState<any[]>([])
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saleType, setSaleType] = useState('partner')
  const [supportYears, setSupportYears] = useState(1)
  const [userRole, setUserRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof) setUserRole(prof.role)
      const { data: reg } = await supabase.from('device_registry').select('*')
      if (reg) setRegistry(reg)
    }
    load()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)
    setError('')
    setDevices([])

    const formData = new FormData()
    formData.append('file', file)
    formData.append('registry', JSON.stringify(registry))

    const res = await fetch('/api/parse-devices', { method: 'POST', body: formData })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Ошибка при разборе файла')
      setLoading(false)
      return
    }

    // Подставляем название клиента если не заполнено
    if (result.clientName && !clientName) {
      setClientName(result.clientName)
    }

    const parsed = result.devices.map((d: any) => ({
      ...d,
      selectedFunctionality: d.suggestedFunctionality,
      manualModel: '',
    }))

    setDevices(parsed)
    setLoading(false)
  }

  const updateFunctionality = (index: number, func: string) => {
    const updated = [...devices]
    updated[index].selectedFunctionality = func
    setDevices(updated)
  }

  const updateManualModel = (index: number, model: string) => {
    const updated = [...devices]
    updated[index].manualModel = model
    setDevices(updated)
  }

  // Валидация
  const issues: string[] = []
  if (!clientName) issues.push('Не указано название клиента')
  const missingModel = devices.filter(d => d.modelMissing && !d.manualModel)
  if (missingModel.length > 0) issues.push(`${missingModel.length} устройств без модели — введите модель вручную`)
  const missingFunc = devices.filter(d => !d.selectedFunctionality)
  if (missingFunc.length > 0) issues.push(`${missingFunc.length} устройств без функционала — выберите из списка`)
  const canSave = issues.length === 0 && devices.length > 0

  // Сводка по типам
  const summary = devices.reduce((acc, d) => {
    const type = FUNCTIONALITY_TO_TYPE[d.selectedFunctionality] || ''
    if (type) acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const isPartner = userRole === 'partner'

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prices } = await supabase.from('price_list')
      .select('*').in('category', ['license', 'support'])
    if (!prices) { setSaving(false); return }

    const totalQty = Object.values(summary).reduce((s, v) => s + v, 0)

    function getPrice(type: string, isSupport: boolean) {
      return prices!.filter(p =>
        p.license_type === type &&
        (isSupport ? p.article.includes('СТР') : !p.article.includes('СТР')) &&
        p.min_quantity <= totalQty
      ).sort((a: any, b: any) => b.min_quantity - a.min_quantity)[0] || null
    }

    const items: any[] = []
    const totals = { rrp: 0, partner: 0, distributor: 0 }

    for (const [type, qty] of Object.entries(summary)) {
      const p = getPrice(type, false)
      if (p) {
        items.push({
          license_type: type, article: p.article, name: p.name, quantity: qty,
          price_distributor: p.price_distributor, price_partner: p.price_partner, price_rrp: p.price_rrp,
          sum_distributor: p.price_distributor * qty,
          sum_partner: p.price_partner * qty,
          sum_rrp: p.price_rrp * qty,
        })
        totals.rrp += p.price_rrp * qty
        totals.partner += p.price_partner * qty
        totals.distributor += p.price_distributor * qty
      }

      const sp = getPrice(type, true)
      if (sp) {
        const sQty = qty * supportYears
        items.push({
          license_type: type, article: sp.article, name: sp.name, quantity: sQty,
          price_distributor: sp.price_distributor, price_partner: sp.price_partner, price_rrp: sp.price_rrp,
          sum_distributor: sp.price_distributor * sQty,
          sum_partner: sp.price_partner * sQty,
          sum_rrp: sp.price_rrp * sQty,
        })
        totals.rrp += sp.price_rrp * sQty
        totals.partner += sp.price_partner * sQty
        totals.distributor += sp.price_distributor * sQty
      }
    }

    const { data: calc, error: calcError } = await supabase.from('calculations').insert({
      created_by: user.id,
      client_name: clientName,
      project_name: projectName,
      sale_type: isPartner ? 'partner' : saleType,
      status: 'draft',
      total_rrp: totals.rrp,
      total_partner: totals.partner,
      total_distributor: totals.distributor,
    }).select().single()

    if (calcError || !calc) { setSaving(false); return }

    await supabase.from('calculation_items').insert(
      items.map(item => ({ ...item, calculation_id: calc.id }))
    )

    setSaving(false)
    router.push(`/calculator/${calc.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/calculator')}
          className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
        <h1 className="text-lg font-semibold text-gray-900">Загрузка анкеты клиента</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Карточка проекта */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Карточка проекта</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Клиент {!clientName && <span className="text-red-500">*</span>}
              </label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!clientName ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Название компании" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Проект</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <option value="partner">Партнёрское</option>
                  <option value="direct">Прямое (РРЦ)</option>
                  <option value="distributor">Дистрибьюторское</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Загрузка файла */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Анкета клиента</h2>
          <p className="text-sm text-gray-500 mb-4">Загрузите Excel файл с заполненным листом "Анкета. Парк техники"</p>
          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${fileName ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
          >
            {fileName ? (
              <>
                <p className="text-green-700 text-sm font-medium">✓ {fileName}</p>
                <p className="text-green-600 text-xs mt-1">Нажмите чтобы загрузить другой файл</p>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-sm font-medium">Нажмите чтобы выбрать файл</p>
                <p className="text-gray-400 text-xs mt-1">.xlsx, .xls</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </div>
          {loading && <p className="text-blue-600 text-sm mt-3">Разбираем файл...</p>}
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </div>

        {/* Предупреждения */}
        {devices.length > 0 && issues.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-red-800 mb-2">Нельзя создать расчёт — заполните обязательные поля:</p>
            <ul className="space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <span>•</span><span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Сводка */}
        {devices.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Итого устройств: {devices.length}
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4'].map(type => (
                summary[type] ? (
                  <div key={type} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500">{type}</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">{summary[type]}</p>
                  </div>
                ) : null
              ))}
            </div>
            {devices.some(d => d.needsInspection) && (
              <div className="mt-4 bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  {devices.filter(d => d.needsInspection).length} устройств требуют обследования
                </p>
              </div>
            )}
          </div>
        )}

        {/* Таблица устройств */}
        {devices.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Производитель</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Модель</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Функционал СУП</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${device.warning ? 'bg-amber-50' : ''} ${(device.modelMissing && !device.manualModel) || !device.selectedFunctionality ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 text-gray-900 font-medium">{device.manufacturer}</td>
                      <td className="px-4 py-3">
                        {device.modelMissing ? (
                          <input
                            value={device.manualModel}
                            onChange={e => updateManualModel(i, e.target.value)}
                            placeholder="Введите модель..."
                            className={`border rounded-lg px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!device.manualModel ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                          />
                        ) : (
                          <span className="text-gray-900">{device.model}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={device.selectedFunctionality}
                          onChange={e => updateFunctionality(i, e.target.value)}
                          className={`border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!device.selectedFunctionality ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                        >
                          {!device.selectedFunctionality && <option value="">— выберите —</option>}
                          {getAvailableOptions(device).map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {(device.modelMissing && !device.manualModel) ? (
                          <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-lg">Нужна модель</span>
                        ) : !device.selectedFunctionality ? (
                          <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-lg">Выберите функционал</span>
                        ) : device.warning ? (
                          <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">{device.warning}</span>
                        ) : device.inRegistry ? (
                          <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-lg">Обследован</span>
                        ) : (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">Требует обследования</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Кнопки */}
        {devices.length > 0 && (
          <div className="flex gap-3 justify-end pb-8">
            <button onClick={() => router.push('/calculator')}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              title={!canSave ? issues.join('\n') : ''}
            >
              {saving ? 'Сохраняем...' : 'Создать расчёт'}
            </button>
          </div>
        )}

      </main>
    </div>
  )
}