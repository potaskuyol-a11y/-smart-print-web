/**
 * GET /api/bitrix/deals?email=<email>
 * Возвращает список активных сделок Bitrix24 для пользователя с указанным email.
 * Email передаётся клиентом после получения из supabase.auth.getUser().
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBitrixUser, getDealsByUser } from '@/lib/bitrix';

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Missing email param' }, { status: 400 });
    }

    // Ищем пользователя в Bitrix24 по email
    const b24user = await getBitrixUser(email);
    if (!b24user) {
      // Пользователь не найден в Bitrix — возвращаем пустой список (не ошибку)
      return NextResponse.json({ deals: [] });
    }

    // Получаем список активных сделок
    const deals = await getDealsByUser(b24user.ID);

    return NextResponse.json({ deals });
  } catch (err) {
    console.error('[/api/bitrix/deals]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bitrix API error' },
      { status: 500 }
    );
  }
}
