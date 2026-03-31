'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Device {
  id: number
  manufacturer: string
  model: string
  max_license_type: string
  notes: string | null
  created_at: string
}

const LICENSE_TYPES = ['ТИП-1/2/3', 'ТИП-1/2/3/4', 'ТИП-4']

export default function AdminDevicesPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editDevice, setEditDevice] = useState<Device | null>(null)
  const [formData, setFormData] = useState({ manufacturer: '', model: '', max_license_type: 'ТИП-1/2/3', notes: '' })
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { router.push('/dashboard'); return }
      await loadDevices()
    }
    check()
  }, [])

  const loadDevices = async () => {
    const { data } = await supabase
      .from('device_registry')
      .select('*')
      .order('manufacturer', { ascending: true })
    setDevices(data || [])
    setLoading(false)
  }

  const openCreate = () => {
    setEditDevice(null)
    setFormData({ manufacturer: '', model: '', max_license_type: 'ТИП-1/2/3', notes: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (d: Device) => {
    setEditDevice(d)
    setFormData({ manufacturer: d.manufacturer, model: d.model, max_license_type: d.max_license_type, notes: d.notes || '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.manufacturer || !formData.model) { setError('Заполните производителя и модель'); return }
    setSaving(true)
    setError('')

    if (editDevice) {
      const { error: err } = await supabase.from('device_registry').update({
        manufacturer: formData.manufacturer,
        model: formData.model,
        max_license_type: formData.max_license_type,
        notes: formData.notes || null,
      }).eq('id', editDevice.id)
      if (err) { setError('Ошибка при сохранении'); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('device_registry').insert({
        manufacturer: formData.manufacturer,
        model: formData.model,
        max_license_type: formData.max_license_type,
        notes: formData.notes || null,
      })
      if (err) { setError(err.message.includes('unique') ? 'Такое устройство уже есть в реестре' : 'Ошибка при сохранении'); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    await loadDevices()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить устройство из реестра?')) return
    await supabase.from('device_registry').delete().eq('id', id)
    await loadDevices()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/import-devices', { method: 'POST', body: formData })
    const result = await res.json()

    if (!res.ok) {
      setImportResult(`Ошибка: ${result.error}`)
    } else {
      setImportResult(`Добавлено: ${result.added}, пропущено (уже есть): ${result.skipped}`)
      await loadDevices()
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const filtered = devices.filter(d =>
    d.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
    d.model.toLowerCase().includes(search.toLowerCase())
  )

  const licenseColor = (type: string) => {
    if (type.includes('4')) return 'bg-purple-50 text-purple-700'
    return 'bg-blue-50 text-blue-700'
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Загрузка...</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Реестр устройств</h1>
            <p className="text-sm text-gray-500">{devices.length} устройств</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click() } }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            {importing ? 'Импортируем...' : '↑ Импорт из Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <button onClick={openCreate}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Добавить устройство
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {importResult && (
          <div className={`mb-4 rounded-xl p-3 ${importResult.includes('Ошибка') ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className={`text-sm ${importResult.includes('Ошибка') ? 'text-red-700' : 'text-green-700'}`}>{importResult}</p>
          </div>
        )}

        <div className="mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по производителю или модели..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-600">Производитель</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Модель</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Макс. тип лицензии</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Примечание</th>
                <th className="text-right px-6 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} className={`border-b border-gray-100 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-6 py-3 font-medium text-gray-900">{d.manufacturer}</td>
                  <td className="px-4 py-3 text-gray-700">{d.model}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${licenseColor(d.max_license_type)}`}>
                      {d.max_license_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.notes || '—'}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => openEdit(d)} className="text-sm text-blue-600 hover:text-blue-800 mr-3">Изменить</button>
                    <button onClick={() => handleDelete(d.id)} className="text-sm text-red-400 hover:text-red-600">Удалить</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 text-sm">Устройства не найдены</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {editDevice ? 'Редактировать устройство' : 'Добавить устройство'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Производитель</label>
                <input value={formData.manufacturer} onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: Kyocera" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Модель</label>
                <input value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: ECOSYS M3645dn" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Максимальный тип лицензии</label>
                <select value={formData.max_license_type} onChange={e => setFormData({ ...formData, max_license_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Примечание (необязательно)</label>
                <input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: требует обновление прошивки" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Сохраняем...' : editDevice ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}