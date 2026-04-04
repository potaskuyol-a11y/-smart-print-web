import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ]
})

const S = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    paddingHorizontal: 45,
    paddingTop: 30,
    paddingBottom: 55,
    color: '#1a1a1a',
  },

  // ── Шапка ──────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1a5276',
    paddingBottom: 10,
    marginBottom: 10,
  },
  logo: { width: 110, height: 44, objectFit: 'contain' },
  logoPlaceholder: {
    width: 110,
    fontSize: 11,
    fontWeight: 700,
    color: '#1a5276',
    paddingTop: 10,
  },
  companyBlock: { flex: 1, textAlign: 'right' },
  companyName: { fontSize: 8, fontWeight: 700, color: '#111827', marginBottom: 2 },
  companyDetail: { fontSize: 7, color: '#555555', lineHeight: 1.5 },

  // ── Исх. / город ────────────────────────────────────
  docMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  docMetaText: { fontSize: 8, color: '#444444' },

  // ── Кому ────────────────────────────────────────────
  recipientLine: { fontSize: 9, marginBottom: 2 },

  // ── Заголовок КП ────────────────────────────────────
  kpTitle: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  // ── Вводный текст ───────────────────────────────────
  introText: { fontSize: 9, marginBottom: 8, lineHeight: 1.5 },

  // ── Краткие итоги (шапка стоимостей) ───────────────
  summaryBlock: { marginBottom: 12 },
  summaryLine: { fontSize: 9, marginBottom: 3, lineHeight: 1.4 },

  // ── Таблицы ─────────────────────────────────────────
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1a5276',
    marginTop: 14,
    marginBottom: 4,
  },
  sectionNote: { fontSize: 7, color: '#6b7280', marginBottom: 3 },
  table: { width: '100%' },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#1a5276',
    paddingVertical: 4,
    paddingHorizontal: 5,
    marginBottom: 1,
  },
  theadCell: { color: '#ffffff', fontWeight: 700, fontSize: 7.5 },
  trow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  trowAlt: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 5,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  cArt:   { width: '15%', fontSize: 7.5 },
  cName:  { width: '47%', fontSize: 7.5 },
  cQty:   { width: '8%',  textAlign: 'right', fontSize: 7.5 },
  cPrice: { width: '15%', textAlign: 'right', fontSize: 7.5 },
  cSum:   { width: '15%', textAlign: 'right', fontSize: 7.5 },

  // Works columns
  cwName:  { width: '57%', fontSize: 7.5 },
  cwQty:   { width: '8%',  textAlign: 'right', fontSize: 7.5 },
  cwUnit:  { width: '10%', fontSize: 7.5 },
  cwSum:   { width: '25%', textAlign: 'right', fontSize: 7.5 },

  // ── Итог / срок ──────────────────────────────────────
  totalsBlock: { marginTop: 14 },
  totalLine: { fontSize: 10, fontWeight: 700, color: '#1a5276', marginBottom: 3 },
  vatNote: { fontSize: 7, color: '#9ca3af', marginTop: 3 },
  validityText: { fontSize: 8.5, color: '#444444', marginTop: 10 },

  // ── Подпись ──────────────────────────────────────────
  signatureBlock: { marginTop: 28 },
  signatureLine: { fontSize: 9, lineHeight: 1.6 },

  // ── Сноски / прочее ──────────────────────────────────
  ccBlock: {
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    padding: 8,
    marginTop: 10,
  },
  ccText: { fontSize: 8, color: '#92400e' },

  // ── Нижний колонтитул (номер страницы) ──────────────
  pageFooter: {
    position: 'absolute',
    bottom: 20,
    left: 45,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pageFooterText: { fontSize: 7, color: '#9ca3af' },
})

// ─── helpers ────────────────────────────────────────────────────────────────

function formatRub(n: number) {
  if (!n && n !== 0) return '—'
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' руб.'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── interfaces ─────────────────────────────────────────────────────────────

interface CalcItem {
  id: number
  license_type: string
  article: string
  name: string
  quantity: number
  sum_distributor: number
  sum_partner: number
  sum_rrp: number
}

interface HardwareItem {
  id: number
  article: string
  name: string
  quantity: number
  sum_distributor: number
  sum_partner: number
  sum_rrp: number
  includes_vat: boolean
}

interface WorkItem {
  id: number
  name: string
  quantity: number
  unit: string
  price_rrp: number
  sum_rrp: number
}

interface TripItem {
  id: number
  days: number
  sum: number
}

interface Calculation {
  id: string
  client_name: string
  project_name: string
  sale_type: string
  license_term: string
  total_rrp: number
  total_partner: number
  total_distributor: number
  created_at: string
  needs_cc: boolean
  calculation_items: CalcItem[]
  calculation_hardware?: HardwareItem[]
  calculation_works?: WorkItem[]
  calculation_trips?: TripItem[]
}

interface Props {
  calc: Calculation
  isPartner: boolean
  saleType?: string
  logoUrl?: string
}

// ─── sub-components ─────────────────────────────────────────────────────────

function TableRows({ items, priceCol }: { items: CalcItem[] | HardwareItem[]; priceCol: 'distributor' | 'partner' | 'rrp' }) {
  const getSum = (item: any) => {
    if (priceCol === 'distributor') return item.sum_distributor
    if (priceCol === 'partner') return item.sum_partner
    return item.sum_rrp
  }
  const getPrice = (item: any) => {
    const s = getSum(item)
    return s > 0 && item.quantity > 0 ? s / item.quantity : 0
  }
  const colLabel = 'Сумма'

  return (
    <>
      <View style={S.thead}>
        <Text style={[S.theadCell, S.cArt]}>Артикул</Text>
        <Text style={[S.theadCell, S.cName]}>Наименование</Text>
        <Text style={[S.theadCell, S.cQty]}>Кол.</Text>
        <Text style={[S.theadCell, S.cPrice]}>Цена за ед.</Text>
        <Text style={[S.theadCell, S.cSum]}>{colLabel}</Text>
      </View>
      {items.map((item: any, i: number) => (
        <View key={item.id ?? i} style={i % 2 === 0 ? S.trow : S.trowAlt}>
          <Text style={S.cArt}>{item.article}</Text>
          <Text style={S.cName}>{item.name}</Text>
          <Text style={S.cQty}>{item.quantity}</Text>
          <Text style={S.cPrice}>{getPrice(item) > 0 ? formatRub(getPrice(item)) : 'по запросу'}</Text>
          <Text style={S.cSum}>{getSum(item) > 0 ? formatRub(getSum(item)) : 'по запросу'}</Text>
        </View>
      ))}
    </>
  )
}

function WorksTableRows({ items }: { items: WorkItem[] }) {
  return (
    <>
      <View style={S.thead}>
        <Text style={[S.theadCell, S.cwName]}>Наименование</Text>
        <Text style={[S.theadCell, S.cwQty]}>Кол.</Text>
        <Text style={[S.theadCell, S.cwUnit]}>Ед.</Text>
        <Text style={[S.theadCell, S.cwSum]}>Сумма</Text>
      </View>
      {items.map((item, i) => (
        <View key={item.id ?? i} style={i % 2 === 0 ? S.trow : S.trowAlt}>
          <Text style={S.cwName}>{item.name}</Text>
          <Text style={S.cwQty}>{item.quantity}</Text>
          <Text style={S.cwUnit}>{item.unit}</Text>
          <Text style={S.cwSum}>{formatRub(item.sum_rrp)}</Text>
        </View>
      ))}
    </>
  )
}

// ─── main document ──────────────────────────────────────────────────────────

export function KpDocument({ calc, isPartner, saleType, logoUrl }: Props) {
  const effectiveSaleType = saleType || calc.sale_type
  const priceCol: 'distributor' | 'partner' | 'rrp' =
    effectiveSaleType === 'distributor' ? 'distributor' :
    effectiveSaleType === 'direct'      ? 'rrp'         : 'partner'

  const licenseItems  = calc.calculation_items.filter(i =>
    i.license_type !== 'hardware' &&
    i.license_type !== '-' &&
    !i.article.includes('СТР') &&
    !i.article.includes('ETP')
  )
  const supportItems  = calc.calculation_items.filter(i =>
    i.article.includes('ETP') || i.article.includes('СТР')
  )
  const hardwareItems = calc.calculation_hardware || []
  const worksItems    = calc.calculation_works    || []
  const tripsItems    = calc.calculation_trips    || []

  const isPerpetual = calc.license_term === 'perpetual'

  // Подитоги для вводного блока
  const getItemSum = (item: any) =>
    priceCol === 'distributor' ? item.sum_distributor :
    priceCol === 'partner'     ? item.sum_partner     : item.sum_rrp

  const licenseTotal  = licenseItems.reduce((s, i) => s + (getItemSum(i) || 0), 0)
  const supportTotal  = supportItems.reduce((s, i) => s + (getItemSum(i) || 0), 0)
  const hardwareTotal = hardwareItems.reduce((s, i) => s + (getItemSum(i) || 0), 0)
  const worksTotal    = worksItems.reduce((s, i) => s + (i.sum_rrp || 0), 0)
                      + tripsItems.reduce((s, i) => s + (i.sum || 0), 0)

  const totalSum = priceCol === 'distributor' ? calc.total_distributor :
                   priceCol === 'rrp'         ? calc.total_rrp         : calc.total_partner

  const totalLabel = 'Итого по КП'

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── ШАПКА ЙОДА ─────────────────────────────────────── */}
        <View style={S.headerRow}>
          {logoUrl ? (
            <Image style={S.logo} src={logoUrl} />
          ) : (
            <Text style={S.logoPlaceholder}>ООО «ЙОДА»</Text>
          )}
          <View style={S.companyBlock}>
            <Text style={S.companyName}>ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «ЙОДА»</Text>
            <Text style={S.companyDetail}>117246, г. Москва, Научный проезд, д. 19, пом. 51Т</Text>
            <Text style={S.companyDetail}>ИНН 7728286559 / КПП 772801001 / ОГРН 1037728018074</Text>
            <Text style={S.companyDetail}>Телефон: +7 (495) 445-55-20</Text>
          </View>
        </View>

        {/* ── Исх. / Москва ───────────────────────────────────── */}
        <View style={S.docMetaRow}>
          <Text style={S.docMetaText}>Исх.: № ___ от «__» _______ 202__ г.</Text>
          <Text style={S.docMetaText}>г. Москва</Text>
        </View>

        {/* ── Кому ────────────────────────────────────────────── */}
        <Text style={S.recipientLine}>
          <Text style={{ fontWeight: 700 }}>Кому: </Text>
          {calc.client_name || '—'}
        </Text>
        {calc.project_name ? (
          <Text style={[S.recipientLine, { color: '#555555', marginBottom: 2 }]}>
            <Text style={{ fontWeight: 700 }}>Проект: </Text>{calc.project_name}
          </Text>
        ) : null}
        <Text style={[S.recipientLine, { color: '#555555' }]}>
          <Text style={{ fontWeight: 700 }}>Дата: </Text>{formatDate(calc.created_at)}
          {'   '}
          <Text style={{ fontWeight: 700 }}>Тип: </Text>
          {isPerpetual ? 'Бессрочные лицензии' : 'Годовые лицензии'}
        </Text>

        {/* ── Заголовок ───────────────────────────────────────── */}
        <Text style={S.kpTitle}>Коммерческое предложение</Text>

        {/* ── Вводный текст ───────────────────────────────────── */}
        <Text style={S.introText}>
          В ответ на Ваш запрос, просим рассмотреть ценовое предложение на ПО Смарт Принт.
        </Text>

        {/* ── Краткие итоги стоимостей ────────────────────────── */}
        <View style={S.summaryBlock}>
          {licenseTotal > 0 && (
            <Text style={S.summaryLine}>
              {'• '}Стоимость лицензий Смарт Принт{isPerpetual ? ' (бессрочных)' : ''} —{' '}
              <Text style={{ fontWeight: 700 }}>{formatRub(licenseTotal)}</Text>
              {' '}(без НДС)
            </Text>
          )}
          {supportTotal > 0 && (
            <Text style={S.summaryLine}>
              {'• '}Стоимость технической поддержки Смарт Принт в год —{' '}
              <Text style={{ fontWeight: 700 }}>{formatRub(supportTotal)}</Text>
              {' '}(с НДС)
            </Text>
          )}
          {hardwareTotal > 0 && (
            <Text style={S.summaryLine}>
              {'• '}Стоимость оборудования —{' '}
              <Text style={{ fontWeight: 700 }}>{formatRub(hardwareTotal)}</Text>
              {' '}(с НДС)
            </Text>
          )}
          {worksTotal > 0 && (
            <Text style={S.summaryLine}>
              {'• '}Стоимость внедрения Смарт Принт —{' '}
              <Text style={{ fontWeight: 700 }}>{formatRub(worksTotal)}</Text>
              {' '}(с НДС, включая командировочные расходы)
            </Text>
          )}
        </View>

        {/* ── Лицензии ────────────────────────────────────────── */}
        {licenseItems.length > 0 && (
          <View>
            <Text style={S.sectionTitle}>Лицензии</Text>
            <Text style={S.sectionNote}>Цены без НДС</Text>
            <View style={S.table}>
              <TableRows items={licenseItems} priceCol={priceCol} />
            </View>
          </View>
        )}

        {/* ── Техническая поддержка ───────────────────────────── */}
        {supportItems.length > 0 && (
          <View>
            <Text style={S.sectionTitle}>Техническая поддержка</Text>
            <Text style={S.sectionNote}>Цены с НДС</Text>
            <View style={S.table}>
              <TableRows items={supportItems} priceCol={priceCol} />
            </View>
          </View>
        )}

        {/* ── Оборудование (подбор ЦК) ────────────────────────── */}
        {hardwareItems.length > 0 && (
          <View>
            <Text style={S.sectionTitle}>Оборудование</Text>
            <Text style={S.sectionNote}>Цены с НДС</Text>
            <View style={S.table}>
              <TableRows items={hardwareItems} priceCol={priceCol} />
            </View>
          </View>
        )}

        {/* Сноска — ЦК ещё не подобрал оборудование */}
        {calc.needs_cc && hardwareItems.length === 0 && (
          <View style={S.ccBlock}>
            <Text style={S.ccText}>
              * Оборудование передано на подбор в Центр компетенций и будет добавлено в КП отдельно.
            </Text>
          </View>
        )}

        {/* ── Работы по внедрению (включая командировки) ───────── */}
        {(worksItems.length > 0 || tripsItems.length > 0) && (
          <View>
            <Text style={S.sectionTitle}>Работы по внедрению</Text>
            <Text style={S.sectionNote}>Цены с НДС</Text>
            <View style={S.table}>
              {worksItems.length > 0 && <WorksTableRows items={worksItems} />}
              {tripsItems.length > 0 && (
                <>
                  {/* Разделитель если есть и работы и командировки */}
                  {worksItems.length > 0 && (
                    <View style={{ paddingHorizontal: 5, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 7, color: '#6b7280', fontWeight: 700 }}>Командировочные расходы</Text>
                    </View>
                  )}
                  <View style={S.thead}>
                    <Text style={[S.theadCell, { width: '70%' }]}>Описание</Text>
                    <Text style={[S.theadCell, { width: '30%', textAlign: 'right' }]}>Сумма</Text>
                  </View>
                  {tripsItems.map((item, i) => (
                    <View key={item.id ?? i} style={i % 2 === 0 ? S.trow : S.trowAlt}>
                      <Text style={{ width: '70%', fontSize: 7.5 }}>{item.days} дн.</Text>
                      <Text style={{ width: '30%', textAlign: 'right', fontSize: 7.5 }}>{formatRub(item.sum)}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Итого ────────────────────────────────────────────── */}
        <View style={S.totalsBlock}>
          <Text style={S.totalLine}>{totalLabel}: {formatRub(totalSum)}</Text>
          <Text style={S.vatNote}>* Итоговая сумма включает лицензии (без НДС), оборудование и техподдержку (с НДС)</Text>
        </View>

        {/* ── Срок действия ────────────────────────────────────── */}
        <Text style={S.validityText}>Срок действия КП: 3 месяца.</Text>

        {/* ── Подпись ──────────────────────────────────────────── */}
        <View style={S.signatureBlock}>
          <Text style={S.signatureLine}>
            Генеральный директор ООО «ЙОДА»{'    '}_________________{' '}/ Владимиров Д.А. /
          </Text>
        </View>

        {/* ── Нижний колонтитул (номер страницы) ───────────────── */}
        <View style={S.pageFooter} fixed>
          <Text style={S.pageFooterText}>ООО «ЙОДА» — Коммерческое предложение</Text>
          <Text
            style={S.pageFooterText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  )
}
