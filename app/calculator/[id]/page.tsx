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

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function CalculationViewPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [calc, setCalc] = useState<Calculation | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

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

      if (data) setCalc(data as Calculation)
      setLoading(false)
    }
    load()
  }, [id])

  const isPartner = userRole === 'partner'

  const handleDownloadPdf = async () => {
    if (!calc) return
    setGeneratingPdf(true)

    const blob = await pdf(
      <KpDocument calc={calc} isPartner={isPartner} />
    ).toBlob()

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
            <h1 className="text-lg font-semibold text-gray-900">{calc.client_name || 'Без клиента'}</h1>
            <p className="text-sm text-gray-500">{calc.project_name || 'Без названия'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${statusLabels[calc.status]?.color}`}>
            {statusLabels[calc.status]?.label}
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
            {saleTypeLabels[calc.sale_type]}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Детали */}
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

        {/* Лицензии */}
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
        </div>

        {/* Действия */}
        <div className="flex gap-3 justify-end pb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            К списку
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {generatingPdf ? 'Генерируем...' : 'Скачать PDF'}
          </button>
        </div>

      </main>
    </div>
  )
}