import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">RestaurantOS</h1>
          <p className="mt-1 text-muted-foreground text-sm">Ingresa a tu cuenta</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
