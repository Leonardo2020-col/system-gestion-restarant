'use client'
import { create } from 'zustand'
import type { Producto } from '@/types/supabase'

export type CartItem = {
  producto: Pick<Producto, 'id' | 'nombre' | 'precio_salon'>
  cantidad: number
  notas?: string
}

export type PedidoItemDetalle = {
  id: string
  producto_id: string
  nombre: string
  cantidad: number
  precio_unit: number
  estado: string
}

type PosStore = {
  /* Mesa seleccionada */
  mesaId: string | null
  mesaNumero: number | null

  /* Pedido activo (mesa ocupada) */
  pedidoActivoId: string | null
  pedidoActivoItems: PedidoItemDetalle[]
  pedidoActivoTotal: number

  /* Cliente ligado al pedido */
  clienteId: string | null
  clienteNombre: string

  /* Carrito de nuevos platos */
  tipoPedido: 'salon' | 'llevar' | 'delivery'
  cart: CartItem[]

  /* Actions */
  setMesa: (id: string, numero: number) => void
  setPedidoActivo: (id: string, items: PedidoItemDetalle[], total: number) => void
  setCliente: (id: string | null, nombre: string) => void
  setTipo: (tipo: 'salon' | 'llevar' | 'delivery') => void
  addItem: (producto: Pick<Producto, 'id' | 'nombre' | 'precio_salon'>) => void
  removeItem: (productoId: string) => void
  updateCantidad: (productoId: string, cantidad: number) => void
  updateNotas: (productoId: string, notas: string) => void
  clearCart: () => void
  clearAll: () => void
  total: () => number
}

export const usePosStore = create<PosStore>((set, get) => ({
  mesaId: null,
  mesaNumero: null,
  pedidoActivoId: null,
  pedidoActivoItems: [],
  pedidoActivoTotal: 0,
  clienteId: null,
  clienteNombre: '',
  tipoPedido: 'salon',
  cart: [],

  setMesa: (id, numero) => set({ mesaId: id, mesaNumero: numero }),

  setPedidoActivo: (id, items, total) =>
    set({ pedidoActivoId: id, pedidoActivoItems: items, pedidoActivoTotal: total }),

  setCliente: (id, nombre) => set({ clienteId: id, clienteNombre: nombre }),

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

  clearCart: () => set({ cart: [] }),

  clearAll: () =>
    set({
      mesaId: null,
      mesaNumero: null,
      pedidoActivoId: null,
      pedidoActivoItems: [],
      pedidoActivoTotal: 0,
      clienteId: null,
      clienteNombre: '',
      tipoPedido: 'salon',
      cart: [],
    }),

  total: () =>
    get().cart.reduce(
      (sum, i) => sum + Number(i.producto.precio_salon) * i.cantidad,
      0
    ),
}))
