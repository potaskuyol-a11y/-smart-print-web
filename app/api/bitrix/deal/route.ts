/**
 * GET /api/bitrix/deal?id=<dealId>
 * Возвращает данные одной сделки Bitrix24 (в т.ч. STAGE_ID) и разрешения на экспорт.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDeal, canExcel, canPdf, isDealActive } from '@/lib/bitrix';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
    }

    const deal = await getDeal(id);
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    return NextResponse.json({
      deal,
      permissions: {
        active: isDealActive(deal.STAGE_ID),
        excel: canExcel(deal.STAGE_ID),
        pdf: canPdf(deal.STAGE_ID),
      },
    });
  } catch (err) {
    console.error('[/api/bitrix/deal]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bitrix API error' },
      { status: 500 }
    );
  }
}
