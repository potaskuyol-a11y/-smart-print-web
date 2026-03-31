'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface CalcItem {
  license_type: string
  quantity: number
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
  created_at: string
  calculation_items: CalcItem[] | undefined
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-600' },
  in_review: { label: 'На проверке', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Согласован', color: 'bg-green-100 text-green-700' },
  sent: { label: 'Отправлен', color: 'bg-blue-100 text-blue-700' },
}

const saleTypeLabels: Record<string, { label: string; color: string }> = {
  partner: { label: 'Партнёрское', color: 'bg-purple-50 text-purple-700' },
  direct: { label: 'Прямое', color: 'bg-green-50 text-green-700' },
  distributor: { label: 'Дистрибьютор', color: 'bg-orange-50 text-orange-700' },
}

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  seller: 'Продавец',
  competence_center: 'Центр компетенций',
  manager: 'Руководитель',
  partner: 'Партнёр',
}

const licenseTypes = ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4']

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getSaleTotal(c: Calculation) {
  if (c.sale_type === 'distributor') return c.total_distributor
  if (c.sale_type === 'direct') return c.total_rrp
  return c.total_partner
}

function getLicenseQty(items: CalcItem[] | undefined, type: string) {
  if (!items) return null
  const qty = items
    .filter(i => i.license_type === type)
    .reduce((s, i) => s + i.quantity, 0)
  return qty > 0 ? qty : null
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: calcs } = await supabase
        .from('calculations')
        .select('*, calculation_items(license_type, quantity)')
        .order('created_at', { ascending: false })
      setCalculations((calcs as Calculation[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isPartner = profile?.role === 'partner'
  const isAdmin = profile?.role === 'admin'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Смарт Принт</h1>
          <p className="text-sm text-gray-500">Система расчёта КП</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-gray-500">{roleLabels[profile?.role] || profile?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Мои расчёты</h2>
            <p className="text-sm text-gray-500 mt-0.5">{calculations.length} расчётов</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin/users')}
                className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Пользователи
              </button>
            )}
            <button
              onClick={() => router.push('/calculator')}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Новый расчёт
            </button>
          </div>
        </div>

        {calculations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">Расчётов пока нет</p>
            <p className="text-gray-400 text-sm mt-1">Нажмите «Новый расчёт» чтобы начать</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-600 whitespace-nowrap">Клиент / Проект</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Тип КП</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Т1</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Т2</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Т3</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600">Т4</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Дата</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                  {!isPartner && (
                    <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Дистриб.</th>
                  )}
                  <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Партнёр</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-600 whitespace-nowrap">РРЦ</th>
                </tr>
              </thead>
              <tbody>
                {calculations.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/calculator/${c.id}`)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${i === calculations.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{c.client_name || '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.project_name || 'Без названия'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${saleTypeLabels[c.sale_type]?.color}`}>
                        {saleTypeLabels[c.sale_type]?.label || c.sale_type}
                      </span>
                    </td>
                    {licenseTypes.map(type => (
                      <td key={type} className="px-3 py-4 text-center">
                        {getLicenseQty(c.calculation_items, type)
                          ? <span className="font-medium text-gray-900">{getLicenseQty(c.calculation_items, type)}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                    ))}
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${statusLabels[c.status]?.color}`}>
                        {statusLabels[c.status]?.label || c.status}
                      </span>
                    </td>
                    {!isPartner && (
                      <td className="px-4 py-4 text-right text-gray-500 whitespace-nowrap">{formatRub(c.total_distributor)}</td>
                    )}
                    <td className="px-4 py-4 text-right text-gray-700 whitespace-nowrap">{formatRub(c.total_partner)}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900 whitespace-nowrap">{formatRub(c.total_rrp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}