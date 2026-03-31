'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { pdf } from '@react-pdf/renderer'
import { KpDocument } from '@/lib/pdf'

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

interface PriceRow {
  license_type: string
  min_quantity: number
  price_distributor: number
  price_partner: number
  price_rrp: number
  article: string
  name: string
}

interface Calculation {
  id: string
  client_name: string
  project_name: string
  sale_type: string
  status: string
  total_rrp: number
  total_partner: number
  total_distributor: number
  notes: string
  created_at: string
  calculation_items: CalcItem[]
}

interface LicenseInput {
  type: string
  label: string
  quantity: number
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-600' },
  in_review: { label: 'На проверке', color: 'bg-yellow-100 text-yellow-700' },
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
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [prices, setPrices] = useState<PriceRow[]>([])

  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saleType, setSaleType] = useState('partner')
  const [supportYears, setSupportYears] = useState(1)
  const [licenses, setLicenses] = useState<LicenseInput[]>([
    { type: 'Тип 1', label: 'Тип 1 — Мониторинг', quantity: 0 },
    { type: 'Тип 2', label: 'Тип 2 — Статистика', quantity: 0 },
    { type: 'Тип 3', label: 'Тип 3 — Внешний терминал', quantity: 0 },
    { type: 'Тип 4', label: 'Тип 4 — Встроенный терминал', quantity: 0 },
  ])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (prof) setUserRole(prof.role)

      const { data } = await supabase
        .from('calculations')
        .select('*, calculation_items(*)')
        .eq('id', id)
        .single()

      if (data) {
        const c = data as Calculation
        setCalc(c)
        setClientName(c.client_name || '')
        setProjectName(c.project_name || '')
        setSaleType(c.sale_type || 'partner')

        const licItems = c.calculation_items.filter(i => !i.article.includes('СТР'))
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
        .from('price_list')
        .select('*')
        .in('category', ['license', 'support'])
      if (priceData) setPrices(priceData)

      setLoading(false)
    }
    load()
  }, [id])

  const isPartner = userRole === 'partner'
  const totalQty = licenses.reduce((s, l) => s + l.quantity, 0)

  const calcResults = () => {
    const results = licenses
      .filter(l => l.quantity > 0)
      .map(l => {
        const p = getPrice(
          prices.filter(r => r.license_type === l.type && !r.article.includes('СТР')),
          l.type, totalQty
        )
        if (!p) return null
        return {
          type: l.type, article: p.article, name: p.name, quantity: l.quantity,
          price_distributor: p.price_distributor, price_partner: p.price_partner, price_rrp: p.price_rrp,
          sum_distributor: p.price_distributor * l.quantity,
          sum_partner: p.price_partner * l.quantity,
          sum_rrp: p.price_rrp * l.quantity,
        }
      }).filter(Boolean) as any[]

    const supportResults = licenses
      .filter(l => l.quantity > 0)
      .map(l => {
        const p = getPrice(
          prices.filter(r => r.license_type === l.type && r.article.includes('СТР')),
          l.type, totalQty
        )
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

    const allResults = calcResults()
    const totals = allResults.reduce((acc, r) => ({
      distributor: acc.distributor + r.sum_distributor,
      partner: acc.partner + r.sum_partner,
      rrp: acc.rrp + r.sum_rrp,
    }), { distributor: 0, partner: 0, rrp: 0 })

    await supabase.from('calculations').update({
      client_name: clientName,
      project_name: projectName,
      sale_type: saleType,
      total_rrp: totals.rrp,
      total_partner: totals.partner,
      total_distributor: totals.distributor,
      updated_at: new Date().toISOString(),
    }).eq('id', calc.id)

    await supabase.from('calculation_items').delete().eq('calculation_id', calc.id)

    if (allResults.length > 0) {
      await supabase.from('calculation_items').insert(
        allResults.map(r => ({
          calculation_id: calc.id,
          license_type: r.type,
          article: r.article,
          name: r.name,
          quantity: r.quantity,
          price_distributor: r.price_distributor,
          price_partner: r.price_partner,
          price_rrp: r.price_rrp,
          sum_distributor: r.sum_distributor,
          sum_partner: r.sum_partner,
          sum_rrp: r.sum_rrp,
        }))
      )
    }

    const { data } = await supabase
      .from('calculations')
      .select('*, calculation_items(*)')
      .eq('id', calc.id)
      .single()
    if (data) setCalc(data as Calculation)

    setSaving(false)
    setIsEditing(false)
  }

  const handleCopy = async () => {
    if (!calc) return
    setCopying(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCopying(false); return }

    const { data: newCalc, error } = await supabase
      .from('calculations')
      .insert({
        created_by: user.id,
        client_name: calc.client_name + ' (копия)',
        project_name: calc.project_name,
        sale_type: calc.sale_type,
        status: 'draft',
        total_rrp: calc.total_rrp,
        total_partner: calc.total_partner,
        total_distributor: calc.total_distributor,
      })
      .select()
      .single()

    if (error || !newCalc) { setCopying(false); return }

    await supabase.from('calculation_items').insert(
      calc.calculation_items.map(item => ({
        calculation_id: newCalc.id,
        license_type: item.license_type,
        article: item.article,
        name: item.name,
        quantity: item.quantity,
        price_distributor: item.price_distributor,
        price_partner: item.price_partner,
        price_rrp: item.price_rrp,
        sum_distributor: item.sum_distributor,
        sum_partner: item.sum_partner,
        sum_rrp: item.sum_rrp,
      }))
    )

    setCopying(false)
    router.push(`/calculator/${newCalc.id}`)
  }

  const handleDownloadPdf = async () => {
    if (!calc) return
    setGeneratingPdf(true)
    const blob = await pdf(<KpDocument calc={calc} isPartner={isPartner} />).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `KP_${(calc.client_name || 'client').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setGeneratingPdf(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    )
  }

  if (!calc) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Расчёт не найден</p>
      </div>
    )
  }

  const licenseItems = calc.calculation_items.filter(i => !i.article.includes('СТР'))
  const supportItems = calc.calculation_items.filter(i => i.article.includes('СТР'))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-800 text-sm">
            ← Назад
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Редактирование расчёта' : (calc.client_name || 'Без клиента')}
            </h1>
            {!isEditing && <p className="text-sm text-gray-500">{calc.project_name || 'Без названия'}</p>}
          </div>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${statusLabels[calc.status]?.color}`}>
              {statusLabels[calc.status]?.label}
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      {saleTypeOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Лицензии</h2>
              <p className="text-sm text-gray-500 mb-4">
                Итого устройств: <span className="font-medium text-gray-900">{totalQty}</span>
              </p>
              <div className="space-y-3">
                {licenses.map((l, i) => (
                  <div key={l.type} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{l.label}</p>
                    </div>
                    <input type="number" min={0} value={l.quantity || ''}
                      placeholder="0"
                      onChange={e => {
                        const updated = [...licenses]
                        updated[i].quantity = Number(e.target.value) || 0
                        setLicenses(updated)
                      }}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-500 w-6">шт.</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pb-8">
              <button onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Сохраняем...' : 'Сохранить изменения'}
              </button>
            </div>
          </>
        ) : (
          <>
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
              </div>
            </div>

            {licenseItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Лицензии</h2>
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
            </div>

            <div className="flex gap-3 justify-end pb-8">
              <button onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                К списку
              </button>
              <button onClick={handleCopy} disabled={copying}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {copying ? 'Копируем...' : 'Копировать'}
              </button>
              <button onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Редактировать
              </button>
              <button onClick={handleDownloadPdf} disabled={generatingPdf}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {generatingPdf ? 'Генерируем...' : 'Скачать PDF'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}