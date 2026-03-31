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
  subtitle: { fontSize: 10, fontWeight: 400, color: '#6b7280', marginBottom: 2 },
  metaRow: { flexDirection: 'row', gap: 20, marginTop: 8 },
  metaItem: { flexDirection: 'column' },
  metaLabel: { fontSize: 8, color: '#9ca3af', marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: 500, color: '#111827' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 6, marginTop: 14 },
  table: { width: '100%' },
  tableHead: { flexDirection: 'row', backgroundColor: '#1e40af', borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6, marginBottom: 2 },
  tableHeadCell: { color: '#ffffff', fontWeight: 700, fontSize: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: '#f9fafb', borderBottomWidth: 0.5, borderBottomColor: '#f3f4f6' },
  tableFooter: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, backgroundColor: '#eff6ff', borderRadius: 4, marginTop: 4 },
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

interface Calculation {
  id: string
  client_name: string
  project_name: string
  sale_type: string
  total_rrp: number
  total_partner: number
  total_distributor: number
  created_at: string
  calculation_items: CalcItem[]
}

interface Props {
  calc: Calculation
  isPartner: boolean
}

function TableSection({ title, items, isPartner }: { title: string; items: CalcItem[]; isPartner: boolean }) {
  if (items.length === 0) return null

  const colArticle = isPartner ? styles.colArticleNoDistrib : styles.colArticle
  const colName = isPartner ? styles.colNameNoDistrib : styles.colName
  const colQty = isPartner ? styles.colQtyNoDistrib : styles.colQty
  const colPartner = isPartner ? styles.colPartnerNoDistrib : styles.colPartner
  const colRrp = isPartner ? styles.colRrpNoDistrib : styles.colRrp

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, colArticle]}>Артикул</Text>
          <Text style={[styles.tableHeadCell, colName]}>Наименование</Text>
          <Text style={[styles.tableHeadCell, colQty]}>Кол-во</Text>
          {!isPartner && <Text style={[styles.tableHeadCell, styles.colDistrib]}>Дистриб.</Text>}
          <Text style={[styles.tableHeadCell, colPartner]}>Партнёр</Text>
          <Text style={[styles.tableHeadCell, colRrp]}>РРЦ</Text>
        </View>
        {items.map((item, i) => (
          <View key={item.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={colArticle}>{item.article}</Text>
            <Text style={colName}>{item.name}</Text>
            <Text style={colQty}>{item.quantity}</Text>
            {!isPartner && <Text style={[styles.colDistrib, { textAlign: 'right' }]}>{formatRub(item.sum_distributor)}</Text>}
            <Text style={colPartner}>{formatRub(item.sum_partner)}</Text>
            <Text style={colRrp}>{formatRub(item.sum_rrp)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export function KpDocument({ calc, isPartner }: Props) {
  const licenseItems = calc.calculation_items.filter(i => !i.article.includes('СТР'))
  const supportItems = calc.calculation_items.filter(i => i.article.includes('СТР'))

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>

        {/* Шапка */}
        <View style={styles.header}>
          <Text style={styles.title}>Смарт Принт</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{saleTypeLabels[calc.sale_type] || calc.sale_type}</Text>
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
        <TableSection title="Лицензии" items={licenseItems} isPartner={isPartner} />

        {/* Техподдержка */}
        <TableSection title="Техническая поддержка" items={supportItems} isPartner={isPartner} />

        {/* Итого */}
        <View style={styles.totalsBlock}>
          {!isPartner && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Дистрибьютор</Text>
              <Text style={styles.totalValue}>{formatRub(calc.total_distributor)}</Text>
            </View>
          )}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Партнёр</Text>
            <Text style={styles.totalValue}>{formatRub(calc.total_partner)}</Text>
          </View>
          <View style={styles.totalCardHighlight}>
            <Text style={styles.totalLabel}>РРЦ (клиент)</Text>
            <Text style={styles.totalValueHighlight}>{formatRub(calc.total_rrp)}</Text>
          </View>
        </View>

        {/* Футер */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Смарт Принт — Коммерческое предложение</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}