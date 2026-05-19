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
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type FormData = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      toast.error('Credenciales incorrectas')
      return
    }
    router.push('/pos')
    router.refresh()
  }

  return (
    <Card className="bg-slate-900 border-slate-800">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <Label className="text-slate-300">Email</Label>
            <Input
              type="email"
              placeholder="admin@restaurante.com"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              {...register('email')}
            />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Contraseña</Label>
            <Input
              type="password"
              className="bg-slate-800 border-slate-700 text-white"
              {...register('password')}
            />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3 pb-6">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
          <p className="text-slate-500 text-xs text-center">
            ¿Sin cuenta?{' '}
            <a href="/register" className="text-slate-300 hover:text-white underline">
              Registra tu restaurante
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
