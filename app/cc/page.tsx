'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Calculation {
  id: string
  client_name: string
  project_name: string
  sale_type: string
  status: string
  created_at: string
  needs_cc: boolean
  cc_comment: string | null
  profiles: { full_name: string | null; email: string } | null
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function CCPage() {
  const router = useRouter()
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [searchClient, setSearchClient] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const loadCalcs = useCallback(async () => {
    const { data } = await supabase
      .from('calculations')
      .select('*, profiles!calculations_created_by_fkey(full_name, email)')
      .order('created_at', { ascending: false })
    setCalculations((data as any) || [])
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof || prof.role !== 'competence_center') { router.push('/dashboard'); return }
      setProfile(prof)

      await loadCalcs()
      setLoading(false)
    }
    load()
  }, [])

  const pending = calculations.filter(c => c.needs_cc && c.status === 'in_review')
  const filtered = (filter === 'pending' ? pending : calculations)
    .filter(c => searchClient ? (c.client_name || '').toLowerCase().includes(searchClient.toLowerCase()) : true)
    .filter(c => filterDateFrom ? new Date(c.created_at) >= new Date(filterDateFrom) : true)
    .filter(c => filterDateTo ? new Date(c.created_at) <= new Date(filterDateTo + 'T23:59:59') : true)

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Загрузка...</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Центр компетенций</h1>
            <p className="text-sm text-gray-500">{profile?.full_name || profile?.email}</p>
          </div>
        </div>
        {pending.length > 0 && (
          <span className="bg-amber-100 text-amber-700 text-sm font-medium px-3 py-1 rounded-lg">
            {pending.length} заявок ожидают подбора
          </span>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setFilter('pending')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors flex items-center gap-2 ${filter === 'pending' ? 'bg-amber-100 text-amber-800' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Ожидают подбора
            {pending.length > 0 && <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pending.length}</span>}
          </button>
          <button onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            Все КП
          </button>
        </div>

        {/* Панель фильтров */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="text" value={searchClient} onChange={e => setSearchClient(e.target.value)}
            placeholder="Поиск по клиенту..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48" />
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {(searchClient || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setSearchClient(''); setFilterDateFrom(''); setFilterDateTo('') }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
              Сбросить
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">
              {filter === 'pending' ? 'Нет заявок на подбор оборудования' : 'Нет расчётов'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id}
                className={`bg-white rounded-2xl border p-5 cursor-pointer hover:shadow-sm transition-shadow ${c.needs_cc && c.status === 'in_review' ? 'border-amber-200' : 'border-gray-200'}`}
                onClick={() => router.push(`/cc/${c.id}`)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{c.client_name || '—'}</p>
                      {c.needs_cc && c.status === 'in_review' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-medium">Ожидает подбора</span>
                      )}
                      {c.needs_cc && c.status !== 'in_review' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-lg font-medium">Подбор выполнен</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{c.project_name || 'Без названия'}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>Менеджер: {(c.profiles as any)?.full_name || (c.profiles as any)?.email || '—'}</span>
                      <span>{formatDate(c.created_at)}</span>
                    </div>
                    {c.cc_comment && (
                      <div className="mt-2 text-xs bg-blue-50 text-blue-700 rounded-lg px-2 py-1.5">
                        <span className="font-medium">Ваш комментарий: </span>{c.cc_comment}
                      </div>
                    )}
                  </div>
                  <span className="text-blue-600 text-sm">Открыть →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}