import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Сервисный ключ не настроен. Добавьте SUPABASE_SERVICE_ROLE_KEY в переменные окружения.' }, { status: 500 })
    }

    const body = await request.json()
    const { email, password, full_name, role, company_name } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create auth user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '' },
    })

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Ошибка создания пользователя' }, { status: 400 })
    }

    // Upsert profile (handles case where trigger already created it or didn't)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: email,
        role: role || 'manager_sales',
        company_name: company_name || null,
        full_name: full_name || null,
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
      // Don't fail — user was created, profile can be set manually
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err.message || 'Неизвестная ошибка' }, { status: 500 })
  }
}
