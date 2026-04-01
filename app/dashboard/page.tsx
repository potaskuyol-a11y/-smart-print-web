'use client'

import { useEffect, useState, useCallback } from 'react'
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
  license_term: string
  total_rrp: number
  total_partner: number
  total_distributor: number
  created_at: string
  approval_comment: string | null
  manager_comment: string | null
  calculation_items: CalcItem[] | undefined
  profiles: { full_name: string | null; email: string } | null
}

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'bg-gray-100 text-gray-600' },
  in_review: { label: 'На согласовании', color: 'bg-yellow-100 text-yellow-700' },
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
  manager_sales: 'Менеджер по продажам',
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

function getLicenseQty(items: CalcItem[] | undefined, type: string) {
  if (!items) return null
  const qty = items.filter(i => i.license_type === type).reduce((s, i) => s + i.quantity, 0)
  return qty > 0 ? qty : null
}

function CommentBadge({ c, isManagerSales, isManager }: {
  c: Calculation
  isManagerSales: boolean
  isManager: boolean
}) {
  const isRejected = c.status === 'draft' && !!c.approval_comment

  // Менеджер по продажам видит комментарий руководителя если есть
  if (isManagerSales && c.approval_comment) {
    return (
      <div className={`mt-1.5 text-xs rounded-lg px-2 py-1.5 ${isRejected ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
        <span className="font-medium">💬 Руководитель: </span>{c.approval_comment}
      </div>
    )
  }

  // Менеджер по продажам видит свой комментарий если КП на согласовании
  if (isManagerSales && c.manager_comment && c.status === 'in_review') {
    return (
      <div className="mt-1.5 text-xs rounded-lg px-2 py-1.5 bg-yellow-100 text-yellow-700">
        <span className="font-medium">💬 Ваш комментарий: </span>{c.manager_comment}
      </div>
    )
  }

  // Руководитель видит только комментарий менеджера
  if (isManager && c.manager_comment) {
    return (
      <div className="mt-1.5 text-xs rounded-lg px-2 py-1.5 bg-blue-50 text-blue-700">
        <span className="font-medium">💬 Менеджер: </span>{c.manager_comment}
      </div>
    )
  }

  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'in_review'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState<'approve' | 'reject' | null>(null)
  const [bulkComment, setBulkComment] = useState('')

  const loadCalcs = useCallback(async () => {
    const { data: calcs } = await supabase
      .from('calculations')
      .select('*, calculation_items(license_type, quantity), profiles!calculations_created_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })
    setCalculations((calcs as any) || [])
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      await loadCalcs()
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const handleFocus = () => { if (profile) loadCalcs() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [profile, loadCalcs])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isPartner = profile?.role === 'partner'
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const isManagerSales = profile?.role === 'manager_sales'

  const pendingCount = calculations.filter(c => c.status === 'in_review').length

  const filtered = filter === 'in_review'
    ? calculations.filter(c => c.status === 'in_review')
    : calculations

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    const inReview = filtered.filter(c => c.status === 'in_review').map(c => c.id)
    if (selected.length === inReview.length) {
      setSelected([])
    } else {
      setSelected(inReview)
    }
  }

  const handleBulkAction = async () => {
    if (!showBulkModal) return
    if (showBulkModal === 'reject' && !bulkComment.trim()) return
    setBulkProcessing(true)

    const { data: { user } } = await supabase.auth.getUser()

    for (const id of selected) {
      await supabase.from('calculations').update({
        status: showBulkModal === 'approve' ? 'approved' : 'draft',
        approval_comment: bulkComment.trim() || null,
        approved_by: showBulkModal === 'approve' ? user?.id : null,
        approved_at: showBulkModal === 'approve' ? new Date().toISOString() : null,
      }).eq('id', id)
    }

    setSelected([])
    setBulkComment('')
    setShowBulkModal(null)
    setBulkProcessing(false)
    await loadCalcs()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    )
  }

  const inReviewIds = filtered.filter(c => c.status === 'in_review').map(c => c.id)

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
          <button onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
            Выйти
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isManager ? 'Все расчёты' : 'Мои расчёты'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{calculations.length} расчётов</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <button onClick={() => router.push('/admin/devices')}
                className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
                Реестр устройств
              </button>
            )}
            {isAdmin && (
              <button onClick={() => router.push('/admin/users')}
                className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
                Пользователи
              </button>
            )}
            {!isManager && (
              <button onClick={() => router.push('/calculator')}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                + Новый расчёт
              </button>
            )}
          </div>
        </div>

        {/* Фильтр для руководителя */}
        {isManager && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <button onClick={() => { setFilter('in_review'); setSelected([]) }}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2 ${filter === 'in_review' ? 'bg-yellow-100 text-yellow-800' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                На согласовании
                {pendingCount > 0 && (
                  <span className="bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
                )}
              </button>
              <button onClick={() => { setFilter('all'); setSelected([]) }}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                Все КП
              </button>
            </div>

            {selected.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Выбрано: {selected.length}</span>
                <button onClick={() => { setShowBulkModal('approve'); setBulkComment('') }}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Согласовать выбранные
                </button>
                <button onClick={() => { setShowBulkModal('reject'); setBulkComment('') }}
                  className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                  Отклонить выбранные
                </button>
                <button onClick={() => setSelected([])}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                  Снять выбор
                </button>
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">
              {filter === 'in_review' ? 'Нет КП на согласовании' : 'Расчётов пока нет'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {isManager && filter === 'in_review' && (
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox"
                        checked={selected.length === inReviewIds.length && inReviewIds.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300" />
                    </th>
                  )}
                  <th className="text-left px-6 py-3 font-medium text-gray-600 whitespace-nowrap">Клиент / Проект</th>
                  {isManager && (
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Менеджер</th>
                  )}
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
                {filtered.map((c, i) => {
                  const isSelected = selected.includes(c.id)
                  const needsApproval = c.status === 'in_review'
                  const isRejected = c.status === 'draft' && !!c.approval_comment
                  return (
                    <tr key={c.id}
                      className={`border-b border-gray-100 transition-colors ${i === filtered.length - 1 ? 'border-b-0' : ''}
                        ${isSelected ? 'bg-blue-50' : needsApproval ? 'bg-yellow-50 hover:bg-yellow-100' : isRejected && isManagerSales ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>

                      {isManager && filter === 'in_review' && (
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          {c.status === 'in_review' && (
                            <input type="checkbox" checked={isSelected}
                              onChange={() => toggleSelect(c.id)}
                              className="rounded border-gray-300" />
                          )}
                        </td>
                      )}

                      <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>
                        <p className="font-medium text-gray-900">{c.client_name || '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.project_name || 'Без названия'}</p>
                        <CommentBadge c={c} isManagerSales={isManagerSales} isManager={isManager} />
                      </td>

                      {isManager && (
                        <td className="px-4 py-4 text-xs text-gray-600 cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>
                          {(c.profiles as any)?.full_name || (c.profiles as any)?.email || '—'}
                        </td>
                      )}

                      <td className="px-4 py-4 cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>
                        <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${saleTypeLabels[c.sale_type]?.color}`}>
                          {saleTypeLabels[c.sale_type]?.label || c.sale_type}
                        </span>
                        {c.license_term === 'perpetual' && (
                          <span className="ml-1 inline-block text-xs font-medium px-1.5 py-0.5 rounded-lg bg-purple-50 text-purple-700">БС</span>
                        )}
                      </td>

                      {licenseTypes.map(type => (
                        <td key={type} className="px-3 py-4 text-center cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>
                          {getLicenseQty(c.calculation_items, type)
                            ? <span className="font-medium text-gray-900">{getLicenseQty(c.calculation_items, type)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      ))}

                      <td className="px-4 py-4 text-gray-600 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>{formatDate(c.created_at)}</td>

                      <td className="px-4 py-4 cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>
                        <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${
                          isManagerSales && isRejected ? 'bg-red-100 text-red-700' : statusLabels[c.status]?.color
                        }`}>
                          {isManagerSales && isRejected ? 'Отклонён' : (statusLabels[c.status]?.label || c.status)}
                        </span>
                      </td>

                      {!isPartner && (
                        <td className="px-4 py-4 text-right text-gray-500 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>{formatRub(c.total_distributor)}</td>
                      )}
                      <td className="px-4 py-4 text-right text-gray-700 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>{formatRub(c.total_partner)}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/calculator/${c.id}`)}>{formatRub(c.total_rrp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Массовое согласование */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              {showBulkModal === 'approve' ? `✓ Согласовать ${selected.length} КП` : `✕ Отклонить ${selected.length} КП`}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {showBulkModal === 'approve'
                ? 'Все выбранные КП будут переведены в статус "Согласован".'
                : 'Все выбранные КП будут возвращены менеджерам на доработку.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Комментарий {showBulkModal === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea value={bulkComment} onChange={e => setBulkComment(e.target.value)} rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={showBulkModal === 'reject' ? 'Укажите причину отклонения...' : 'Дополнительный комментарий (необязательно)...'} />
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setShowBulkModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={handleBulkAction}
                disabled={bulkProcessing || (showBulkModal === 'reject' && !bulkComment.trim())}
                className={`px-6 py-2 text-sm rounded-lg font-medium disabled:opacity-50 text-white ${showBulkModal === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                {bulkProcessing ? 'Обрабатываем...' : showBulkModal === 'approve' ? 'Согласовать все' : 'Отклонить все'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}