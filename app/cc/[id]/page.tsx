'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

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
}

interface WorkRow {
  id: string
  name: string
  quantity: number
  unit: string
  price_rrp: number
  sum_rrp: number
}

interface TripRow {
  id: string
  days: number
  accommodation: number
  rate: number
  sum: number
}

interface PriceItem {
  article: string
  name: string
  price_distributor: number
  price_partner: number
  price_rrp: number
  description: string | null
}

function uid() { return Math.random().toString(36).slice(2) }
function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

export default function CCDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [calc, setCalc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [hardware, setHardware] = useState<HardwareRow[]>([])
  const [works, setWorks] = useState<WorkRow[]>([])
  const [trips, setTrips] = useState<TripRow[]>([])
  const [hardwarePrices, setHardwarePrices] = useState<PriceItem[]>([])
  const [ccComment, setCcComment] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!prof || prof.role !== 'competence_center') { router.push('/dashboard'); return }

      const { data } = await supabase
        .from('calculations')
        .select('*, calculation_items(*), calculation_hardware(*), calculation_works(*)')
        .eq('id', id)
        .single()

      if (data) {
        setCalc(data)
        setCcComment(data.cc_comment || '')
        if (data.calculation_hardware?.length > 0) {
          setHardware(data.calculation_hardware.map((h: any) => ({ ...h, id: uid() })))
        }
      }

      const { data: hw } = await supabase.from('price_list').select('*')
        .eq('category', 'hardware').eq('is_active', true)
      if (hw) setHardwarePrices(hw)

      const { data: existingWorks } = await supabase
        .from('calculation_works')
        .select('*')
        .eq('calculation_id', id)
      if (existingWorks && existingWorks.length > 0) {
        setWorks(existingWorks.map((w: any) => ({ ...w, id: uid() })))
      }

      const { data: existingTrips } = await supabase
        .from('calculation_trips')
        .select('*')
        .eq('calculation_id', id)
      if (existingTrips && existingTrips.length > 0) {
        setTrips(existingTrips.map((t: any) => ({ ...t, id: uid() })))
      }

      setLoading(false)
    }
    load()
  }, [id])

  const addHardware = (article: string) => {
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
    }])
  }

  const updateHardwareQty = (id: string, qty: number) => {
    setHardware(prev => prev.map(h => h.id === id ? {
      ...h, quantity: qty,
      sum_distributor: h.price_distributor * qty,
      sum_partner: h.price_partner * qty,
      sum_rrp: h.price_rrp * qty,
    } : h))
  }

  const addWork = () => {
    setWorks(prev => [...prev, { id: uid(), name: '', quantity: 1, unit: 'час', price_rrp: 0, sum_rrp: 0 }])
  }

  const updateWork = (id: string, field: string, value: any) => {
    setWorks(prev => prev.map(w => {
      if (w.id !== id) return w
      const updated = { ...w, [field]: value }
      if (field === 'quantity' || field === 'price_rrp') {
        updated.sum_rrp = updated.quantity * updated.price_rrp
      }
      return updated
    }))
  }

  const addTrip = () => {
    setTrips(prev => [...prev, { id: uid(), days: 1, accommodation: 0, rate: 0, sum: 0 }])
  }

  const updateTrip = (id: string, field: string, value: number) => {
    setTrips(prev => prev.map(t => {
      if (t.id !== id) return t
      const updated = { ...t, [field]: value }
      updated.sum = updated.accommodation + updated.rate * updated.days
      return updated
    }))
  }

  const handleComplete = async () => {
    if (!calc) return
    setSaving(true)

    // Сохраняем оборудование
    await supabase.from('calculation_hardware').delete().eq('calculation_id', id)
    if (hardware.length > 0) {
      await supabase.from('calculation_hardware').insert(
        hardware.filter(h => h.quantity > 0).map(h => ({
          calculation_id: id,
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

    // Сохраняем работы
    await supabase.from('calculation_works').delete().eq('calculation_id', id)
    if (works.length > 0) {
      await supabase.from('calculation_works').insert(
        works.filter(w => w.name && w.quantity > 0).map(w => ({
          calculation_id: id,
          name: w.name,
          quantity: w.quantity,
          unit: w.unit,
          price_rrp: w.price_rrp,
          sum_rrp: w.sum_rrp,
          price_distributor: 0,
          price_partner: 0,
          sum_distributor: 0,
          sum_partner: 0,
          includes_vat: true,
        }))
      )
    }

    // Сохраняем командировки
    await supabase.from('calculation_trips').delete().eq('calculation_id', id)
    const validTrips = trips.filter(t => t.days > 0 && t.sum > 0)
    if (validTrips.length > 0) {
      await supabase.from('calculation_trips').insert(
        validTrips.map(t => ({
          calculation_id: id,
          days: t.days,
          accommodation: t.accommodation,
          rate: t.rate,
          sum: t.sum,
        }))
      )
    }

    // Пересчитываем итого
    const hwTotal = hardware.filter(h => h.quantity > 0).reduce((s, h) => ({
      rrp: s.rrp + h.sum_rrp,
      partner: s.partner + h.sum_partner,
      distributor: s.distributor + h.sum_distributor,
    }), { rrp: 0, partner: 0, distributor: 0 })

    const worksTotal = works.filter(w => w.name).reduce((s, w) => s + w.sum_rrp, 0)
    const tripsTotal = validTrips.reduce((s, t) => s + t.sum, 0)

    await supabase.from('calculations').update({
      needs_cc: false,
      status: 'draft',
      cc_comment: ccComment.trim() || null,
      total_rrp: calc.total_rrp + hwTotal.rrp + worksTotal + tripsTotal,
      total_partner: calc.total_partner + hwTotal.partner,
      total_distributor: calc.total_distributor + hwTotal.distributor,
    }).eq('id', id)

    setSaving(false)
    router.push('/cc')
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Загрузка...</p></div>
  }

  if (!calc) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">КП не найдено</p></div>
  }

  const licenseItems = calc.calculation_items?.filter((i: any) =>
    i.license_type !== '-' && i.license_type !== 'hardware' && !i.article.includes('СТР') && !i.article.includes('ETP')
  ) || []
  const supportItems = calc.calculation_items?.filter((i: any) =>
    i.article.includes('СТР') || i.article.includes('ETP')
  ) || []

  const tripsTotalSum = trips.filter(t => t.days > 0 && t.sum > 0).reduce((s, t) => s + t.sum, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/cc')} className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{calc.client_name || 'Без клиента'}</h1>
            <p className="text-sm text-gray-500">{calc.project_name || 'Без названия'}</p>
          </div>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium">Подбор оборудования</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── ДЕТАЛИ РАСЧЁТА (только для просмотра) ── */}

        {licenseItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Лицензии в расчёте</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Наименование</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Партнёр</th>
                  <th className="text-right py-2 pl-3 font-medium text-gray-600">РРЦ</th>
                </tr>
              </thead>
              <tbody>
                {licenseItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">
                      <div>{item.name}</div>
                      <div className="text-xs text-gray-500">{item.article}</div>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900">{item.quantity}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{formatRub(item.sum_partner)}</td>
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
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Наименование</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                  <th className="text-right py-2 pl-3 font-medium text-gray-600">РРЦ</th>
                </tr>
              </thead>
              <tbody>
                {supportItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">
                      <div>{item.name}</div>
                      <div className="text-xs text-gray-500">{item.article}</div>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-900">{item.quantity}</td>
                    <td className="py-2 pl-3 text-right font-medium text-gray-900">{formatRub(item.sum_rrp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Итого по лицензиям */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-blue-600 mb-1">Дистрибьютор (лицензии)</p>
            <p className="text-base font-semibold text-gray-900">{formatRub(calc.total_distributor)}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600 mb-1">Партнёр (лицензии)</p>
            <p className="text-base font-semibold text-gray-900">{formatRub(calc.total_partner)}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600 mb-1">РРЦ (лицензии)</p>
            <p className="text-base font-semibold text-blue-800">{formatRub(calc.total_rrp)}</p>
          </div>
        </div>

        {/* ── ПОДБОР ОБОРУДОВАНИЯ ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Оборудование</h2>
          <p className="text-xs text-gray-500 mb-4">Все позиции с НДС</p>

          {hardware.length > 0 && (
            <div className="space-y-2 mb-4">
              {hardware.map(h => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{h.name}</p>
                    <p className="text-xs text-gray-500">{h.article} · {formatRub(h.price_rrp)} за ед.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="number" min={0} value={h.quantity}
                      onChange={e => updateHardwareQty(h.id, Number(e.target.value) || 0)}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <span className="text-xs text-gray-500">шт.</span>
                    <span className="text-sm font-medium text-gray-900 w-32 text-right">{formatRub(h.sum_rrp)}</span>
                    <button onClick={() => setHardware(prev => prev.filter(x => x.id !== h.id))}
                      className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <select value="" onChange={e => addHardware(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">+ Добавить оборудование из прайса...</option>
            {hardwarePrices
              .filter(p => !hardware.find(h => h.article === p.article))
              .filter((p, i, arr) => arr.findIndex(x => x.article === p.article) === i)
              .map(p => (
                <option key={p.article} value={p.article}>{p.name} — {formatRub(p.price_rrp)}</option>
              ))}
          </select>
        </div>

        {/* ── РАБОТЫ ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Работы по внедрению / пилоту</h2>
              <p className="text-xs text-gray-500 mt-0.5">Добавьте работы если необходимо</p>
            </div>
            <button onClick={addWork}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              + Добавить работу
            </button>
          </div>

          {works.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">Работы не добавлены</p>
            </div>
          ) : (
            <div className="space-y-3">
              {works.map(w => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <input value={w.name} onChange={e => updateWork(w.id, 'name', e.target.value)}
                    placeholder="Название работы..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="number" min={0} value={w.quantity}
                    onChange={e => updateWork(w.id, 'quantity', Number(e.target.value) || 0)}
                    className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <select value={w.unit} onChange={e => updateWork(w.id, 'unit', e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="час">час</option>
                    <option value="день">день</option>
                    <option value="шт.">шт.</option>
                    <option value="усл.">усл.</option>
                  </select>
                  <input type="number" min={0} value={w.price_rrp}
                    onChange={e => updateWork(w.id, 'price_rrp', Number(e.target.value) || 0)}
                    placeholder="Цена"
                    className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-900 w-28 text-right shrink-0">{formatRub(w.sum_rrp)}</span>
                  <button onClick={() => setWorks(prev => prev.filter(x => x.id !== w.id))}
                    className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── КОМАНДИРОВКИ ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Командировки</h2>
              <p className="text-xs text-gray-500 mt-0.5">Менеджер увидит только кол-во дней и итоговую сумму</p>
            </div>
            <button onClick={addTrip}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              + Добавить командировку
            </button>
          </div>

          {trips.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-gray-400 text-sm">Командировок нет</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-3 px-3 text-xs font-medium text-gray-500">
                <span>Кол-во дней</span>
                <span>Проживание (руб.)</span>
                <span>Ставка сотрудника (руб./день)</span>
                <span className="text-right">Итого</span>
                <span></span>
              </div>
              {trips.map(t => (
                <div key={t.id} className="grid grid-cols-5 gap-3 items-center p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <input type="number" min={1} value={t.days}
                    onChange={e => updateTrip(t.id, 'days', Number(e.target.value) || 0)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <input type="number" min={0} value={t.accommodation}
                    onChange={e => updateTrip(t.id, 'accommodation', Number(e.target.value) || 0)}
                    placeholder="0"
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <input type="number" min={0} value={t.rate}
                    onChange={e => updateTrip(t.id, 'rate', Number(e.target.value) || 0)}
                    placeholder="0"
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  <span className="text-sm font-semibold text-indigo-800 text-right">{formatRub(t.sum)}</span>
                  <div className="flex justify-end">
                    <button onClick={() => setTrips(prev => prev.filter(x => x.id !== t.id))}
                      className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <span className="text-sm font-semibold text-indigo-900">
                  Итого командировки: {formatRub(tripsTotalSum)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── КОММЕНТАРИЙ ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Комментарий для менеджера</h2>
          <textarea value={ccComment} onChange={e => setCcComment(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Пояснения по подбору оборудования, рекомендации..." />
        </div>

        {/* ── КНОПКИ ── */}
        <div className="flex gap-3 justify-end pb-8">
          <button onClick={() => router.push('/cc')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Отмена
          </button>
          <button onClick={handleComplete} disabled={saving}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? 'Сохраняем...' : 'Готово — вернуть менеджеру'}
          </button>
        </div>

      </main>
    </div>
  )
}
