'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface PriceItem {
  id: number
  article: string
  name: string
  category: string
  license_type: string
  license_term: string
  min_quantity: number
  price_distributor: number
  price_partner: number
  price_rrp: number
  is_active: boolean
  includes_vat: boolean
  description: string | null
}

const categoryLabels: Record<string, string> = {
  license: 'Лицензия',
  hardware: 'Оборудование',
  support: 'Техподдержка',
}

function formatRub(n: number) {
  return n?.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' руб.'
}

export default function AdminPricePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editItem, setEditItem] = useState<PriceItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [formData, setFormData] = useState<Partial<PriceItem>>({})

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { router.push('/dashboard'); return }
      await loadItems()
    }
    check()
  }, [])

  const loadItems = async () => {
    const { data } = await supabase
      .from('price_list')
      .select('*')
      .order('category')
      .order('license_type')
      .order('min_quantity')
    setItems(data || [])
    setLoading(false)
  }

  const openEdit = (item: PriceItem) => {
    setEditItem(item)
    setFormData({ ...item })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditItem(null)
    setFormData({
      category: 'license',
      license_type: 'Тип 1',
      license_term: 'annual',
      min_quantity: 1,
      price_distributor: 0,
      price_partner: 0,
      price_rrp: 0,
      is_active: true,
      includes_vat: false,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.article || !formData.name) return
    setSaving(true)

    if (editItem) {
      await supabase.from('price_list').update(formData).eq('id', editItem.id)
    } else {
      await supabase.from('price_list').insert(formData)
    }

    setSaving(false)
    setShowModal(false)
    await loadItems()
  }

  const handleToggleActive = async (item: PriceItem) => {
    await supabase.from('price_list').update({ is_active: !item.is_active }).eq('id', item.id)
    await loadItems()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult('')

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/import-price', { method: 'POST', body: fd })
    const result = await res.json()

    if (!res.ok) {
      setImportResult(`Ошибка: ${result.error}`)
    } else {
      setImportResult(`Обновлено: ${result.updated}, добавлено: ${result.added}, пропущено: ${result.skipped}`)
      await loadItems()
    }

    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const filtered = items.filter(item => {
    const matchSearch = item.article.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter
    return matchSearch && matchCategory
  })

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Загрузка...</p></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-800 text-sm">← Назад</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Управление прайсом</h1>
            <p className="text-sm text-gray-500">{items.length} позиций</p>
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
            + Добавить позицию
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {importResult && (
          <div className={`mb-4 rounded-xl p-3 ${importResult.includes('Ошибка') ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className={`text-sm ${importResult.includes('Ошибка') ? 'text-red-700' : 'text-green-700'}`}>{importResult}</p>
          </div>
        )}

        {/* Фильтры */}
        <div className="flex gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по артикулу или названию..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Все категории</option>
            <option value="license">Лицензии</option>
            <option value="hardware">Оборудование</option>
            <option value="support">Техподдержка</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Артикул</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Наименование</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Категория</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Дистриб.</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Партнёр</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">РРЦ</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">НДС</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Активна</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id}
                  className={`border-b border-gray-100 ${i === filtered.length - 1 ? 'border-b-0' : ''} ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.article}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{item.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                      {categoryLabels[item.category] || item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">{formatRub(item.price_distributor)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 text-xs">{formatRub(item.price_partner)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 text-xs">{formatRub(item.price_rrp)}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">{item.includes_vat ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleActive(item)}
                      className={`text-xs px-2 py-1 rounded-lg ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_active ? 'Да' : 'Нет'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)}
                      className="text-sm text-blue-600 hover:text-blue-800">
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Модальное окно редактирования */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-screen overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {editItem ? 'Редактировать позицию' : 'Добавить позицию'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Артикул</label>
                  <input value={formData.article || ''} onChange={e => setFormData({ ...formData, article: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="С1-НРУ-0001-Е" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Категория</label>
                  <select value={formData.category || 'license'} onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="license">Лицензия</option>
                    <option value="hardware">Оборудование</option>
                    <option value="support">Техподдержка</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Наименование</label>
                <input value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Лицензия на ПО Смарт Принт..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Описание (подсказка)</label>
                <textarea value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Краткое описание для менеджера..." />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Цена дистриб.</label>
                  <input type="number" value={formData.price_distributor || ''} onChange={e => setFormData({ ...formData, price_distributor: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Цена партнёр</label>
                  <input type="number" value={formData.price_partner || ''} onChange={e => setFormData({ ...formData, price_partner: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">РРЦ</label>
                  <input type="number" value={formData.price_rrp || ''} onChange={e => setFormData({ ...formData, price_rrp: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Мин. кол-во</label>
                  <input type="number" value={formData.min_quantity || 1} onChange={e => setFormData({ ...formData, min_quantity: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1">Тип лицензии</label>
                  <select value={formData.license_type || '-'} onChange={e => setFormData({ ...formData, license_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="-">—</option>
                    <option value="Тип 1">Тип 1</option>
                    <option value="Тип 2">Тип 2</option>
                    <option value="Тип 3">Тип 3</option>
                    <option value="Тип 4">Тип 4</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.includes_vat || false}
                    onChange={e => setFormData({ ...formData, includes_vat: e.target.checked })}
                    className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Цены с НДС</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.is_active !== false}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Активна</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.license_term === 'perpetual'}
                    onChange={e => setFormData({ ...formData, license_term: e.target.checked ? 'perpetual' : 'annual' })}
                    className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Бессрочная</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving || !formData.article || !formData.name}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
                {saving ? 'Сохраняем...' : editItem ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}