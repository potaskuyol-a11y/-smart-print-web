'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  created_at: string
  approval_comment: string | null
  profiles: { full_name: string | null; email: string }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-600' },
  in_review: { label: 'На согласовании', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Согласован', color: 'bg-green-100 text-green-700' },
  sent: { label: 'Отправлен', color: 'bg-blue-100 text-blue-700' },
}

const saleTypeLabels: Record<string, string> = {
  partner: 'Партнёрское',
  direct: 'Прямое',
  distributor: 'Дистрибьюторское',
}

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }) ?? '—'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ManagerPage() {
  const router = useRouter()
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'in_review'>('in_review')
  const [approveModal, setApproveModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (!prof || prof.role !== 'manager') { router.push('/dashboard'); return }
      setProfile(prof)

      await loadCalcs()
    }
    load()
  }, [])

  const loadCalcs = async () => {
    const { data } = await supabase
      .from('calculations')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false })
    setCalculations((data as any) || [])
    setLoading(false)
  }

  const handleApprove = async () => {
    if (!approveModal) return
    setProcessing(true)

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('calculations').update({
      status: approveModal.action === 'approve' ? 'approved' : 'draft',
      approval_comment: comment || null,
      approved_by: approveModal.action === 'approve' ? user?.id : null,
      approved_at: approveModal.action === 'approve' ? new Date().toISOString() : null,
    }).eq('id', approveModal.id)

    setApproveModal(null)
    setComment('')
    setProcessing(false)
    await loadCalcs()
  }

  const filtered = filter === 'in_review'
    ? calculations.filter(c => c.status === 'in_review')
    : calculations

  const pendingCount = calculations.filter(c => c.status === 'in_review').length

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Загрузка...</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Согласование КП</h1>
            <p className="text-sm text-gray-500">{profile?.full_name || profile?.email}</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <span className="bg-yellow-100 text-yellow-700 text-sm font-medium px-3 py-1 rounded-lg">
            {pendingCount} ожидают согласования
          </span>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Фильтр */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('in_review')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${filter === 'in_review' ? 'bg-yellow-100 text-yellow-800' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            На согласовании {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Все КП
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">
              {filter === 'in_review' ? 'Нет КП на согласовании' : 'Нет расчётов'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-600">Клиент / Проект</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Менеджер</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Тип</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Лицензии</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Дата</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">РРЦ</th>
                  <th className="text-right px-6 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}
                    className={`border-b border-gray-100 ${i === filtered.length - 1 ? 'border-b-0' : ''} ${c.status === 'in_review' ? 'bg-yellow-50' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{c.client_name || '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.project_name || 'Без названия'}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-xs">
                      {(c.profiles as any)?.full_name || (c.profiles as any)?.email || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-600">{saleTypeLabels[c.sale_type] || c.sale_type}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${c.license_term === 'perpetual' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.license_term === 'perpetual' ? 'Бессрочные' : 'Годовые'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${statusLabels[c.status]?.color}`}>
                        {statusLabels[c.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900 font-medium">{formatRub(c.total_rrp)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => router.push(`/calculator/${c.id}`)}
                        className="text-sm text-blue-600 hover:text-blue-800 mr-3">
                        Открыть
                      </button>
                      {c.status === 'in_review' && (
                        <>
                          <button
                            onClick={() => { setApproveModal({ id: c.id, action: 'approve' }); setComment('') }}
                            className="text-sm text-green-600 hover:text-green-800 mr-3">
                            Согласовать
                          </button>
                          <button
                            onClick={() => { setApproveModal({ id: c.id, action: 'reject' }); setComment('') }}
                            className="text-sm text-red-500 hover:text-red-700">
                            Отклонить
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Модальное окно согласования */}
      {approveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              {approveModal.action === 'approve' ? 'Согласовать КП' : 'Отклонить КП'}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {approveModal.action === 'approve'
                ? 'КП будет переведено в статус "Согласован".'
                : 'КП будет возвращено в статус "Черновик" для доработки.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Комментарий {approveModal.action === 'reject' ? '(обязательно)' : '(необязательно)'}
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={approveModal.action === 'reject' ? 'Укажите причину отклонения...' : 'Дополнительные комментарии...'}
              />
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setApproveModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
              <button
                onClick={handleApprove}
                disabled={processing || (approveModal.action === 'reject' && !comment)}
                className={`px-6 py-2 text-sm rounded-lg font-medium disabled:opacity-50 text-white ${approveModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                {processing ? 'Обрабатываем...' : approveModal.action === 'approve' ? 'Согласовать' : 'Отклонить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}