/**
 * POST /api/bitrix/attach-pdf
 * Прикрепляет PDF к сделке Bitrix24.
 *
 * Body: { dealId: string, pdfBase64: string, filename: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { attachPdfToDeal } from '@/lib/bitrix';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { dealId?: string; pdfBase64?: string; filename?: string };

    if (!body.dealId || !body.pdfBase64 || !body.filename) {
      return NextResponse.json({ error: 'Missing required fields: dealId, pdfBase64, filename' }, { status: 400 });
    }

    const result = await attachPdfToDeal(body.dealId, body.pdfBase64, body.filename);

    return NextResponse.json({ success: true, fileId: result.fileId });
  } catch (err) {
    console.error('[/api/bitrix/attach-pdf]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bitrix API error' },
      { status: 500 }
    );
  }
}
