import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const sheetName = workbook.SheetNames.find(n =>
      n.toLowerCase().includes('устройств') || n.toLowerCase().includes('список')
    ) || workbook.SheetNames[0]

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: null })

    // Находим заголовочную строку
    let headerRow = -1
    let colManufacturer = -1
    let colModel = -1
    let colMaxType = -1

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] as any[]
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase()
        if (cell.includes('производитель')) colManufacturer = j
        if (cell.includes('модель')) colModel = j
        if (cell.includes('максимальный') || cell.includes('тип лицензии') || cell.includes('макс')) colMaxType = j
      }
      if (colManufacturer >= 0 && colModel >= 0) {
        headerRow = i
        break
      }
    }

    if (headerRow < 0) {
      return NextResponse.json({ error: 'Не найдены колонки Производитель и Модель' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let added = 0
    let skipped = 0

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] as any[]
      const manufacturer = String(row[colManufacturer] || '').trim()
      const model = String(row[colModel] || '').trim().replace(/\s+/g, ' ')
      const maxType = colMaxType >= 0 ? String(row[colMaxType] || '').trim() : 'ТИП-1/2/3'

      if (!manufacturer || !model || manufacturer === 'Производитель') continue
      if (manufacturer.toLowerCase().startsWith('внимание') || manufacturer.toLowerCase().startsWith('вся')) continue

      const normalizedType = maxType.includes('4') ? 'ТИП-1/2/3/4'
        : maxType === 'ТИП-4' ? 'ТИП-4'
        : 'ТИП-1/2/3'

      const { error } = await supabaseAdmin
        .from('device_registry')
        .insert({ manufacturer, model, max_license_type: normalizedType })

      if (error) {
        if (error.message.includes('unique') || error.code === '23505') {
          skipped++
        }
      } else {
        added++
      }
    }

    return NextResponse.json({ added, skipped })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}