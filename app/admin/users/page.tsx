'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: string
  company_name: string | null
  created_at: string
}

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager_sales: 'Менеджер по продажам',
  competence_center: 'Центр компетенций',
  manager: 'Руководитель',
  partner: 'Партнёр',
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-50 text-red-700',
  manager_sales: 'bg-blue-50 text-blue-700',
  competence_center: 'bg-purple-50 text-purple-700',
  manager: 'bg-amber-50 text-amber-700',
  partner: 'bg-green-50 text-green-700',
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'seller',
    company_name: '',
    password: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

      if (!prof || prof.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      await loadProfiles()
    }
    load()
  }, [])

  const loadProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setProfiles(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditProfile(null)
    setFormData({ email: '', full_name: '', role: 'seller', company_name: '', password: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (p: Profile) => {
    setEditProfile(p)
    setFormData({ email: p.email, full_name: p.full_name || '', role: p.role, company_name: p.company_name || '', password: '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')

    if (editProfile) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          role: formData.role,
          company_name: formData.company_name || null,
        })
        .eq('id', editProfile.id)

      if (updateError) {
        setError('Ошибка при сохранении')
        setSaving(false)
        return
      }
    } else {
      if (!formData.email || !formData.password) {
        setError('Email и пароль обязательны')
        setSaving(false)
        return
      }

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          company_name: formData.company_name,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Ошибка при создании пользователя')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setShowModal(false)
    await loadProfiles()
  }

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
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-800 text-sm">
            ← Назад
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Управление пользователями</h1>
            <p className="text-sm text-gray-500">{profiles.length} пользователей</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Добавить пользователя
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-600">Пользователь</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Роль</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Компания</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Добавлен</th>
                <th className="text-right px-6 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => (
                <tr key={p.id}
                  className={`border-b border-gray-100 ${i === profiles.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{p.full_name || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded-lg ${roleColors[p.role]}`}>
                      {roleLabels[p.role] || p.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-600">{p.company_name || '—'}</td>
                  <td className="px-4 py-4 text-gray-600">{formatDate(p.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {editProfile ? 'Редактировать пользователя' : 'Новый пользователь'}
            </h2>

            <div className="space-y-4">
              {!editProfile && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@company.ru"
                  />
                </div>
              )}

              {!editProfile && (
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Пароль</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Минимум 6 символов"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Имя</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Иван Иванов"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Роль</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
  <option key={value} value={value}>{label}</option>
))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Компания {formData.role === 'partner' ? '(обязательно)' : '(необязательно)'}
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ООО Компания"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editProfile && (!formData.email || !formData.password))}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Сохраняем...' : editProfile ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}