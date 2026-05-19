import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">RestaurantOS</h1>
          <p className="mt-1 text-slate-400 text-sm">Registra tu restaurante</p>
        </div>
        <RegisterForm />
      </div>
    </div>
  )
}
