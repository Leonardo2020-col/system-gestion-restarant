'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  nombreRestaurante: z.string().min(2, 'Nombre demasiado corto'),
  ruc: z.string().length(11, 'RUC debe tener 11 dígitos'),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  nombreAdmin: z.string().min(2),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

export function RegisterForm() {
  const router = useRouter()
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Error al crear cuenta')
      return
    }

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ nombre: data.nombreRestaurante, slug: data.slug, ruc: data.ruc })
      .select()
      .single()
    if (tenantError) {
      toast.error('Error al crear el restaurante. El slug o RUC ya existe.')
      return
    }

    const { error: userError } = await supabase.from('usuarios').insert({
      id: authData.user.id,
      tenant_id: tenant.id,
      nombre: data.nombreAdmin,
      rol: 'admin',
    })
    if (userError) {
      toast.error('Error al crear el perfil de usuario')
      return
    }

    toast.success('Restaurante registrado correctamente')
    router.push('/pos')
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nombre del restaurante</Label>
              <Input {...register('nombreRestaurante')} />
              {errors.nombreRestaurante && (
                <p className="text-red-500 text-xs">{errors.nombreRestaurante.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>RUC</Label>
              <Input maxLength={11} {...register('ruc')} />
              {errors.ruc && <p className="text-red-500 text-xs">{errors.ruc.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>URL del menú (slug)</Label>
              <Input placeholder="mi-restaurante" {...register('slug')} />
              {errors.slug && <p className="text-red-500 text-xs">{errors.slug.message}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Tu nombre</Label>
              <Input {...register('nombreAdmin')} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Contraseña</Label>
              <Input type="password" {...register('password')} />
              {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 pb-6">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Registrando...' : 'Crear restaurante'}
          </Button>
          <p className="text-muted-foreground text-xs text-center">
            ¿Ya tienes cuenta?{' '}
            <a href="/login" className="text-foreground hover:underline">
              Ingresar
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
