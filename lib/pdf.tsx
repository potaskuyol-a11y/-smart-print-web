import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ]
})

const styles = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 9, padding: 30, color: '#1a1a1a' },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: '#1e40af', marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 20, marginTop: 8 },
  metaItem: { flexDirection: 'column' },
  metaLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: 500, color: '#111827' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 6, marginTop: 14 },
  sectionNote: { fontSize: 8, color: '#6b7280', marginBottom: 4 },
  table: { width: '100%' },
  tableHead: { flexDirection: 'row', backgroundColor: '#1e40af', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, marginBottom: 2 },
  tableHeadCell: { color: '#ffffff', fontWeight: 700, fontSize: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: '#f9fafb', borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  colArticle: { width: '14%' },
  colName: { width: '38%' },
  colQty: { width: '8%', textAlign: 'right' },
  colDistrib: { width: '13%', textAlign: 'right' },
  colPartner: { width: '13%', textAlign: 'right' },
  colRrp: { width: '14%', textAlign: 'right' },
  colArticleNoDistrib: { width: '16%' },
  colNameNoDistrib: { width: '46%' },
  colQtyNoDistrib: { width: '10%', textAlign: 'right' },
  colPartnerNoDistrib: { width: '14%', textAlign: 'right' },
  colRrpNoDistrib: { width: '14%', textAlign: 'right' },
  totalsBlock: { marginTop: 16, flexDirection: 'row', gap: 10 },
  totalCard: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 6, padding: 10 },
  totalCardHighlight: { flex: 1, backgroundColor: '#eff6ff', borderRadius: 6, padding: 10 },
  totalLabel: { fontSize: 8, color: '#6b7280', marginBottom: 3 },
  totalValue: { fontSize: 13, fontWeight: 700, color: '#111827' },
  totalValueHighlight: { fontSize: 13, fontWeight: 700, color: '#1e40af' },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', marginVertical: 10 },
  badge: { backgroundColor: '#eff6ff', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  badgeText: { fontSize: 8, fontWeight: 500, color: '#1e40af' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9ca3af' },
  vatNote: { fontSize: 7, color: '#9ca3af', marginTop: 2 },
  ccBlock: { backgroundColor: '#fffbeb', borderRadius: 6, padding: 10, marginTop: 14 },
  ccText: { fontSize: 9, color: '#92400e' },
})

function formatRub(n: number) {
  if (!n && n !== 0) return '—'
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' руб.'
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

const saleTypeLabels: Record<string, string> = {
  partner: 'Партнёрское КП',
  direct: 'Прямое КП (РРЦ)',
  distributor: 'Дистрибьюторское КП',
}

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
}

interface Props {
  calc: Calculation
  isPartner: boolean
  saleType?: string
}

function TableRows({ items, priceCol }: { items: any[]; priceCol: 'distributor' | 'partner' | 'rrp' }) {
  const getSum = (item: any) => {
    if (priceCol === 'distributor') return item.sum_distributor
    if (priceCol === 'partner') return item.sum_partner
    return item.sum_rrp
  }
  const getPrice = (item: any) => {
    const sum = getSum(item)
    return sum > 0 && item.quantity > 0 ? sum / item.quantity : 0
  }

  const colLabel = priceCol === 'distributor' ? 'Дистрибьютор' : priceCol === 'partner' ? 'Партнёр' : 'РРЦ'

  return (
    <>
      <View style={styles.tableHead}>
        <Text style={[styles.tableHeadCell, styles.colArticleNoDistrib]}>Артикул</Text>
        <Text style={[styles.tableHeadCell, styles.colNameNoDistrib]}>Наименование</Text>
        <Text style={[styles.tableHeadCell, styles.colQtyNoDistrib]}>Кол-во</Text>
        <Text style={[styles.tableHeadCell, styles.colPartnerNoDistrib]}>Цена за ед.</Text>
        <Text style={[styles.tableHeadCell, styles.colRrpNoDistrib]}>{colLabel}</Text>
      </View>
      {items.map((item, i) => (
        <View key={item.id ?? i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
          <Text style={styles.colArticleNoDistrib}>{item.article}</Text>
          <Text style={styles.colNameNoDistrib}>{item.name}</Text>
          <Text style={styles.colQtyNoDistrib}>{item.quantity}</Text>
          <Text style={styles.colPartnerNoDistrib}>
            {getPrice(item) > 0 ? formatRub(getPrice(item)) : 'по запросу'}
          </Text>
          <Text style={styles.colRrpNoDistrib}>
            {getSum(item) > 0 ? formatRub(getSum(item)) : 'по запросу'}
          </Text>
        </View>
      ))}
    </>
  )
}

export function KpDocument({ calc, isPartner, saleType }: Props) {
  const effectiveSaleType = saleType || calc.sale_type
  const priceCol: 'distributor' | 'partner' | 'rrp' =
    effectiveSaleType === 'distributor' ? 'distributor' :
    effectiveSaleType === 'direct' ? 'rrp' : 'partner'
  // Лицензии — только позиции с license_type не hardware и не '-', без СТР
  const licenseItems = calc.calculation_items.filter(i =>
    i.license_type !== 'hardware' &&
    i.license_type !== '-' &&
    !i.article.includes('СТР') &&
    !i.article.includes('ETP')
  )

  // Оборудование из calculation_hardware
  const hardwareItems = calc.calculation_hardware || []

  // Техподдержка — ETP и СТР из items
  const supportItems = calc.calculation_items.filter(i =>
    i.article.includes('ETP') || i.article.includes('СТР')
  )

  const isPerpetual = calc.license_term === 'perpetual'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>

        {/* Шапка */}
        <View style={styles.header}>
          <Text style={styles.title}>Смарт Принт</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {saleTypeLabels[calc.sale_type] || calc.sale_type}
              {isPerpetual ? ' · Бессрочные лицензии' : ' · Годовые лицензии'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Клиент</Text>
              <Text style={styles.metaValue}>{calc.client_name || '—'}</Text>
            </View>
            {calc.project_name && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Проект</Text>
                <Text style={styles.metaValue}>{calc.project_name}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Дата</Text>
              <Text style={styles.metaValue}>{formatDate(calc.created_at)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Лицензии */}
        {licenseItems.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Лицензии</Text>
            <Text style={styles.sectionNote}>Цены без НДС</Text>
            <View style={styles.table}>
              <TableRows items={licenseItems} priceCol={priceCol} />
            </View>
          </View>
        )}

        {/* Оборудование */}
        {hardwareItems.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Оборудование</Text>
            <Text style={styles.sectionNote}>Цены с НДС</Text>
            <View style={styles.table}>
              <TableRows items={hardwareItems} priceCol={priceCol} />
            </View>
          </View>
        )}

        {/* Подбор ЦК */}
        {calc.needs_cc && (
          <View style={styles.ccBlock}>
            <Text style={styles.ccText}>* Оборудование передано на подбор в Центр компетенций и будет добавлено в КП отдельно</Text>
          </View>
        )}

        {/* Техподдержка */}
        {supportItems.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Техническая поддержка</Text>
            <Text style={styles.sectionNote}>Цены с НДС</Text>
            <View style={styles.table}>
              <TableRows items={supportItems} priceCol={priceCol} />
            </View>
          </View>
        )}

        {/* Итого */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalCardHighlight}>
            <Text style={styles.totalLabel}>
              {priceCol === 'distributor' ? 'Итого (Дистрибьютор)' :
               priceCol === 'rrp' ? 'Итого (РРЦ)' : 'Итого (Партнёр)'}
            </Text>
            <Text style={styles.totalValueHighlight}>
              {priceCol === 'distributor' ? formatRub(calc.total_distributor) :
               priceCol === 'rrp' ? formatRub(calc.total_rrp) : formatRub(calc.total_partner)}
            </Text>
          </View>
        </View>

        <Text style={styles.vatNote}>* Итоговая сумма включает лицензии (без НДС), оборудование и техподдержку (с НДС)</Text>

        {/* Футер */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Смарт Принт — Коммерческое предложение</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}