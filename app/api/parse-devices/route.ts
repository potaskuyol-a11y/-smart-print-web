import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const FUNCTIONALITY_TO_TYPE: Record<string, string> = {
  'Мониторинг по сети': 'Тип 1',
  'Персональная статистика': 'Тип 2',
  'Аппаратный терминал/Мобильное приложение "Смарт Принт"': 'Тип 3',
  'Аппаратный терминал/Мобильное приложение «Смарт Принт»': 'Тип 3',
  'Аппаратный терминал «Катюша»': 'Тип 3',
  'Программный терминал "Смарт Принт"': 'Тип 4',
  'Программный терминал «Смарт Принт»': 'Тип 4',
}

// Маппинг из анкеты в наш формат
const FUNCTIONALITY_NORMALIZE: Record<string, string> = {
  'Мониторинг по сети': 'Мониторинг по сети',
  'Персональная статистика': 'Персональная статистика',
  'Аппаратный терминал/Мобильное приложение "Смарт Принт"': 'Аппаратный терминал «Катюша»',
  'Аппаратный терминал/Мобильное приложение «Смарт Принт»': 'Аппаратный терминал «Катюша»',
  'Аппаратный терминал «Катюша»': 'Аппаратный терминал «Катюша»',
  'Программный терминал "Смарт Принт"': 'Программный терминал "Смарт Принт"',
  'Программный терминал «Смарт Принт»': 'Программный терминал "Смарт Принт"',
}

const TYPE_ORDER = ['Тип 1', 'Тип 2', 'Тип 3', 'Тип 4']

function getMaxAllowedType(maxLicenseType: string): string {
  if (maxLicenseType.includes('4')) return 'Тип 4'
  if (maxLicenseType.includes('3')) return 'Тип 3'
  if (maxLicenseType.includes('2')) return 'Тип 2'
  return 'Тип 1'
}

function isTypeAllowed(requestedType: string, maxType: string): boolean {
  return TYPE_ORDER.indexOf(requestedType) <= TYPE_ORDER.indexOf(maxType)
}

function getFunctionalityForType(type: string): string {
  const map: Record<string, string> = {
    'Тип 1': 'Мониторинг по сети',
    'Тип 2': 'Персональная статистика',
    'Тип 3': 'Аппаратный терминал «Катюша»',
    'Тип 4': 'Программный терминал "Смарт Принт"',
  }
  return map[type] || 'Мониторинг по сети'
}

function extractClientName(workbook: XLSX.WorkBook): string {
  const generalSheet = workbook.SheetNames.find(n =>
    n.toLowerCase().includes('общие') || n.toLowerCase().includes('general')
  )
  if (!generalSheet) return ''

  const sheet = workbook.Sheets[generalSheet]
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: null })

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any[]
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase()
      if (cell.includes('наименование компании')) {
        if (row[j + 1] && String(row[j + 1]).trim()) return String(row[j + 1]).trim()
        if (row[j + 2] && String(row[j + 2]).trim()) return String(row[j + 2]).trim()
        if (rows[i + 1]) {
          const nextRow = rows[i + 1] as any[]
          for (let k = j; k < Math.min(j + 4, nextRow.length); k++) {
            const val = String(nextRow[k] || '').trim()
            if (val && !val.toLowerCase().includes('инн') && !val.toLowerCase().includes('наименование')) {
              return val
            }
          }
        }
      }
    }
  }
  return ''
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const registryRaw = formData.get('registry') as string
    const registry = JSON.parse(registryRaw) as Array<{
      manufacturer: string
      model: string
      max_license_type: string
    }>

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const clientName = extractClientName(workbook)

    const sheetName = workbook.SheetNames.find(n =>
      n.toLowerCase().includes('парк') || n.toLowerCase().includes('техник')
    )

    if (!sheetName) {
      return NextResponse.json({ error: 'Лист с парком техники не найден' }, { status: 400 })
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: null })

    let headerRow = -1
    let colManufacturer = -1
    let colModel = -1
    let colFunctionality = -1

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] as any[]
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase()
        if (cell.includes('производитель')) colManufacturer = j
        if (cell.includes('модель')) colModel = j
        if (cell.includes('функционал')) colFunctionality = j
      }
      if (colManufacturer >= 0 && colModel >= 0) {
        headerRow = i
        break
      }
    }

    if (headerRow < 0) {
      return NextResponse.json({ error: 'Не удалось найти колонки Производитель и Модель' }, { status: 400 })
    }

    const devices: any[] = []

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] as any[]
      const manufacturer = String(row[colManufacturer] || '').trim()
      const model = String(row[colModel] || '').trim()
      const functionalityRaw = colFunctionality >= 0 ? String(row[colFunctionality] || '').trim() : ''

      if (!manufacturer || manufacturer === 'null' || manufacturer === 'Незаполнено') continue

      const functionality = functionalityRaw === 'Незаполнено' ? '' : functionalityRaw
      const normalizedFunctionality = FUNCTIONALITY_NORMALIZE[functionality] || ''

      // Ищем в реестре
      const modelClean = model === 'null' ? '' : model
      const registryEntry = modelClean ? registry.find(r =>
        r.manufacturer.toLowerCase() === manufacturer.toLowerCase() &&
        r.model.toLowerCase().replace(/\s+/g, ' ') === modelClean.toLowerCase().replace(/\s+/g, ' ')
      ) : null

      const inRegistry = !!registryEntry
      const maxAllowed = registryEntry ? getMaxAllowedType(registryEntry.max_license_type) : 'Тип 3'

      const clientType = normalizedFunctionality ? FUNCTIONALITY_TO_TYPE[normalizedFunctionality] : ''

      let suggestedFunctionality = ''
      let warning = ''
      let needsInspection = false

      if (!inRegistry && modelClean) {
        needsInspection = true
        if (clientType === 'Тип 4') {
          suggestedFunctionality = 'Аппаратный терминал «Катюша»'
          warning = 'Тип 4 недоступен — устройство не в реестре'
        } else {
          suggestedFunctionality = normalizedFunctionality || 'Аппаратный терминал «Катюша»'
          warning = 'Устройство не в реестре — требуется обследование'
        }
      } else if (inRegistry && clientType) {
        if (isTypeAllowed(clientType, maxAllowed)) {
          suggestedFunctionality = normalizedFunctionality
        } else {
          suggestedFunctionality = getFunctionalityForType(maxAllowed)
          warning = `Запрошенный функционал недоступен. Максимальный: ${maxAllowed}`
        }
      } else if (inRegistry && !clientType) {
        suggestedFunctionality = getFunctionalityForType(maxAllowed)
      } else {
        suggestedFunctionality = normalizedFunctionality || ''
      }

      devices.push({
        manufacturer,
        model: modelClean,
        modelMissing: !modelClean,
        clientFunctionality: normalizedFunctionality,
        suggestedFunctionality,
        maxAllowed,
        inRegistry,
        needsInspection,
        warning,
      })
    }

    return NextResponse.json({ devices, sheetName, clientName })
  } catch (err: any) {
    console.error('Parse error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}