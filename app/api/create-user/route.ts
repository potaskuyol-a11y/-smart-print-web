import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, role, company_name } = body

    console.log('Creating user:', email, role)
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    console.log('Result:', data, error)

    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || 'Ошибка' }, { status: 400 })
    }

    await supabaseAdmin.from('profiles').update({
      role: role || 'seller',
      company_name: company_name || null,
      full_name: full_name || null,
    }).eq('id', data.user.id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Catch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}