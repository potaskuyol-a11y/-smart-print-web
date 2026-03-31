'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type LicenseType = 'Тип 1' | 'Тип 2' | 'Тип 3' | 'Тип 4'

interface LicenseInput {
  type: LicenseType
  label: string
  description: string
  quantity: number
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

interface ResultRow {
  type: string
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

function getPrice(prices: PriceRow[], type: string, totalQty: number): PriceRow | null {
  const rows = prices
    .filter(p => p.license_type === type && p.min_quantity <= totalQty)
    .sort((a, b) => b.min_quantity - a.min_quantity)
  return rows[0] || null
}

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

const saleTypeOptions = [
  { value: 'partner', label: 'Партнёрское' },
  { value: 'direct', label: 'Прямое (РРЦ)' },
  { value: 'distributor', label: 'Дистрибьюторское' },
]

export default function CalculatorPage() {
  const router = useRouter()
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [saleType, setSaleType] = useState<'partner' | 'direct' | 'distributor'>('partner')
  const [userRole, setUserRole] = useState<string>('')
  const [supportYears, setSupportYears] = useState(1)
  const [saving, setSaving] = useState(false)

  const [licenses, setLicenses] = useState<LicenseInput[]>([
    { type: 'Тип 1', label: 'Тип 1 — Мониторинг', description: 'Неуправляемые устройства', quantity: 0 },
    { type: 'Тип 2', label: 'Тип 2 — Статистика', description: 'Персонализированная статистика', quantity: 0 },
    { type: 'Тип 3', label: 'Тип 3 — Внешний терминал', description: 'Авторизация через внешний терминал', quantity: 0 },
    { type: 'Тип 4', label: 'Тип 4 — Встроенный терминал', description: 'Авторизация через встроенный терминал', quantity: 0 },
  ])

  useEffect(() => {
    supabase.from('price_list').select('*')
      .in('category', ['license', 'support'])
      .then(({ data }) => { if (data) setPrices(data) })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role')
          .eq('id', user.id).single()
          .then(({ data }) => {
            if (data) setUserRole(data.role)
          })
      }
    })
  }, [])

  const isPartner = userRole === 'partner'

  const totalQty = licenses.reduce((s, l) => s + l.quantity, 0)

  const results: ResultRow[] = licenses
    .filter(l => l.quantity > 0)
    .map(l => {
      const p = getPrice(
        prices.filter(r => r.license_type === l.type && !r.article.includes('СТР')),
        l.type, totalQty
      )
      if (!p) return null
      return {
        type: l.type,
        article: p.article,
        name: p.name,
        quantity: l.quantity,
        price_distributor: p.price_distributor,
        price_partner: p.price_partner,
        price_rrp: p.price_rrp,
        sum_distributor: p.price_distributor * l.quantity,
        sum_partner: p.price_partner * l.quantity,
        sum_rrp: p.price_rrp * l.quantity,
      }
    })
    .filter(Boolean) as ResultRow[]

  const supportResults: ResultRow[] = licenses
    .filter(l => l.quantity > 0)
    .map(l => {
      const p = getPrice(
        prices.filter(r => r.license_type === l.type && r.article.includes('СТР')),
        l.type, totalQty
      )
      if (!p) return null
      return {
        type: l.type,
        article: p.article,
        name: p.name,
        quantity: l.quantity * supportYears,
        price_distributor: p.price_distributor,
        price_partner: p.price_partner,
        price_rrp: p.price_rrp,
        sum_distributor: p.price_distributor * l.quantity * supportYears,
        sum_partner: p.price_partner * l.quantity * supportYears,
        sum_rrp: p.price_rrp * l.quantity * supportYears,
      }
    })
    .filter(Boolean) as ResultRow[]

  const allResults = [...results, ...supportResults]

  const totals = allResults.reduce((acc, r) => ({
    distributor: acc.distributor + r.sum_distributor,
    partner: acc.partner + r.sum_partner,
    rrp: acc.rrp + r.sum_rrp,
  }), { distributor: 0, partner: 0, rrp: 0 })

  // Какую цену показывать в зависимости от типа КП
  const priceLabel = saleType === 'distributor' ? 'Дистрибьютор'
    : saleType === 'direct' ? 'РРЦ' : 'Партнёр'

  const getSaleSum = (r: ResultRow) =>
    saleType === 'distributor' ? r.sum_distributor
    : saleType === 'direct' ? r.sum_rrp
    : r.sum_partner

  const getSaleTotal = () =>
    saleType === 'distributor' ? totals.distributor
    : saleType === 'direct' ? totals.rrp
    : totals.partner

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: calc, error } = await supabase
      .from('calculations')
      .insert({
        created_by: user.id,
        client_name: clientName,
        project_name: projectName,
        sale_type: isPartner ? 'partner' : saleType,
        status: 'draft',
        total_rrp: totals.rrp,
        total_partner: totals.partner,
        total_distributor: totals.distributor,
      })
      .select()
      .single()

    if (error || !calc) { setSaving(false); return }

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

    setSaving(false)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')}
          className="text-gray-500 hover:text-gray-800 text-sm">
          ← Назад
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Новый расчёт</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Карточка проекта */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Карточка проекта</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Клиент</label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название компании"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Название проекта</label>
              <input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название проекта"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Техподдержка, лет</label>
              <input
                type="number" min={1} max={5}
                value={supportYears}
                onChange={e => setSupportYears(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!isPartner && (
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Тип КП</label>
                <select
                  value={saleType}
                  onChange={e => setSaleType(e.target.value as typeof saleType)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {saleTypeOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Ввод лицензий */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Лицензии</h2>
          <p className="text-sm text-gray-500 mb-4">
            Итого устройств: <span className="font-medium text-gray-900">{totalQty}</span> — цена определяется автоматически по объёму
          </p>
          <div className="space-y-3">
            {licenses.map((l, i) => (
              <div key={l.type} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{l.label}</p>
                  <p className="text-xs text-gray-500">{l.description}</p>
                </div>
                <input
                  type="number" min={0}
                  value={l.quantity || ''}
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

        {/* Результат */}
        {allResults.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Результат расчёта</h2>
              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                {isPartner ? 'Партнёрское КП' : saleTypeOptions.find(o => o.value === saleType)?.label}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium text-gray-600 w-1/2">Наименование</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600">Цена</th>
                    <th className="text-right py-2 pl-3 font-medium text-gray-600">{priceLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {allResults.map((r, i) => (
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
                    <td className="py-3 pr-4 font-semibold text-gray-900">Итого</td>
                    <td></td>
                    <td></td>
                    <td className="py-3 pl-3 text-right text-gray-900 font-bold">{formatRub(getSaleTotal())}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex gap-3 justify-end pb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || allResults.length === 0 || !clientName}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Сохраняем...' : 'Сохранить расчёт'}
          </button>
        </div>

      </main>
    </div>
  )
}