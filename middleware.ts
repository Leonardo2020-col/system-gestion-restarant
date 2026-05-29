import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected =
    request.nextUrl.pathname.startsWith('/pos') ||
    request.nextUrl.pathname.startsWith('/cocina') ||
    request.nextUrl.pathname.startsWith('/mesas') ||
    request.nextUrl.pathname.startsWith('/carta') ||
    request.nextUrl.pathname.startsWith('/inventario') ||
    request.nextUrl.pathname.startsWith('/caja') ||
    request.nextUrl.pathname.startsWith('/compras') ||
    request.nextUrl.pathname.startsWith('/clientes') ||
    request.nextUrl.pathname.startsWith('/reportes') ||
    request.nextUrl.pathname.startsWith('/facturas') ||
    request.nextUrl.pathname.startsWith('/sucursales') ||
    request.nextUrl.pathname.startsWith('/ajustes')

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/')) {
    return NextResponse.redirect(new URL('/pos', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|menu|api/webhooks|icons|sw.js|manifest.json).*)',
  ],
}
