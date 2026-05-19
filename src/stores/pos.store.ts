'use client'
import { create } from 'zustand'
import type { Producto } from '@/types/supabase'

export type CartItem = {
  producto: Pick<Producto, 'id' | 'nombre' | 'precio_salon'>
  cantidad: number
  notas?: string
}

type PosStore = {
  mesaId: string | null
  tipoPedido: 'salon' | 'llevar' | 'delivery'
  cart: CartItem[]
  setMesa: (id: string | null) => void
  setTipo: (tipo: 'salon' | 'llevar' | 'delivery') => void
  addItem: (producto: Pick<Producto, 'id' | 'nombre' | 'precio_salon'>) => void
  removeItem: (productoId: string) => void
  updateCantidad: (productoId: string, cantidad: number) => void
  updateNotas: (productoId: string, notas: string) => void
  clearCart: () => void
  total: () => number
}

export const usePosStore = create<PosStore>((set, get) => ({
  mesaId: null,
  tipoPedido: 'salon',
  cart: [],
  setMesa: (id) => set({ mesaId: id }),
  setTipo: (tipoPedido) => set({ tipoPedido }),
  addItem: (producto) =>
    set((state) => {
      const existing = state.cart.find((i) => i.producto.id === producto.id)
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
          ),
        }
      }
      return { cart: [...state.cart, { producto, cantidad: 1 }] }
    }),
  removeItem: (productoId) =>
    set((state) => ({ cart: state.cart.filter((i) => i.producto.id !== productoId) })),
  updateCantidad: (productoId, cantidad) =>
    set((state) => ({
      cart:
        cantidad <= 0
          ? state.cart.filter((i) => i.producto.id !== productoId)
          : state.cart.map((i) =>
              i.producto.id === productoId ? { ...i, cantidad } : i
            ),
    })),
  updateNotas: (productoId, notas) =>
    set((state) => ({
      cart: state.cart.map((i) =>
        i.producto.id === productoId ? { ...i, notas } : i
      ),
    })),
  clearCart: () => set({ cart: [], mesaId: null, tipoPedido: 'salon' }),
  total: () => get().cart.reduce((sum, i) => sum + i.producto.precio_salon * i.cantidad, 0),
}))
