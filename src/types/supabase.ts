export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          nombre: string
          slug: string
          ruc: string
          plan: 'ordena' | 'crece' | 'avanza'
          logo_url: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
          ruc: string
          plan?: 'ordena' | 'crece' | 'avanza'
          logo_url?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          slug?: string
          ruc?: string
          plan?: 'ordena' | 'crece' | 'avanza'
          logo_url?: string | null
          activo?: boolean
          created_at?: string
        }
      }
      usuarios: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          rol: 'admin' | 'mozo' | 'cajero' | 'cocina'
          activo: boolean
          created_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          nombre: string
          rol?: 'admin' | 'mozo' | 'cajero' | 'cocina'
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          rol?: 'admin' | 'mozo' | 'cajero' | 'cocina'
          activo?: boolean
          created_at?: string
        }
      }
      salones: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          orden: number
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          orden?: number
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          orden?: number
        }
      }
      mesas: {
        Row: {
          id: string
          tenant_id: string
          salon_id: string
          numero: number
          estado: 'libre' | 'ocupada' | 'reservada'
        }
        Insert: {
          id?: string
          tenant_id: string
          salon_id: string
          numero: number
          estado?: 'libre' | 'ocupada' | 'reservada'
        }
        Update: {
          id?: string
          tenant_id?: string
          salon_id?: string
          numero?: number
          estado?: 'libre' | 'ocupada' | 'reservada'
        }
      }
      clientes: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          dni_ruc: string | null
          telefono: string | null
          email: string | null
          puntos: number
          cumpleanios: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          dni_ruc?: string | null
          telefono?: string | null
          email?: string | null
          puntos?: number
          cumpleanios?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          dni_ruc?: string | null
          telefono?: string | null
          email?: string | null
          puntos?: number
          cumpleanios?: string | null
          created_at?: string
        }
      }
      categorias: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          area_produccion: 'cocina' | 'bar' | 'horno'
          orden: number
          activo: boolean
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          area_produccion?: 'cocina' | 'bar' | 'horno'
          orden?: number
          activo?: boolean
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          area_produccion?: 'cocina' | 'bar' | 'horno'
          orden?: number
          activo?: boolean
        }
      }
      productos: {
        Row: {
          id: string
          tenant_id: string
          categoria_id: string
          nombre: string
          descripcion: string | null
          imagen_url: string | null
          precio_salon: number
          precio_llevar: number | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          categoria_id: string
          nombre: string
          descripcion?: string | null
          imagen_url?: string | null
          precio_salon: number
          precio_llevar?: number | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          categoria_id?: string
          nombre?: string
          descripcion?: string | null
          imagen_url?: string | null
          precio_salon?: number
          precio_llevar?: number | null
          activo?: boolean
          created_at?: string
        }
      }
      pedidos: {
        Row: {
          id: string
          tenant_id: string
          mesa_id: string | null
          usuario_id: string
          cliente_id: string | null
          tipo: 'salon' | 'llevar' | 'delivery'
          estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
          canal: 'pos' | 'qr' | 'rappi' | 'pedidosya'
          total: number
          descuento: number
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          mesa_id?: string | null
          usuario_id: string
          cliente_id?: string | null
          tipo: 'salon' | 'llevar' | 'delivery'
          estado?: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
          canal?: 'pos' | 'qr' | 'rappi' | 'pedidosya'
          total: number
          descuento?: number
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          mesa_id?: string | null
          usuario_id?: string
          cliente_id?: string | null
          tipo?: 'salon' | 'llevar' | 'delivery'
          estado?: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
          canal?: 'pos' | 'qr' | 'rappi' | 'pedidosya'
          total?: number
          descuento?: number
          notas?: string | null
          created_at?: string
        }
      }
      pedido_items: {
        Row: {
          id: string
          pedido_id: string
          producto_id: string
          cantidad: number
          precio_unit: number
          descuento: number
          notas: string | null
          estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
        }
        Insert: {
          id?: string
          pedido_id: string
          producto_id: string
          cantidad: number
          precio_unit: number
          descuento?: number
          notas?: string | null
          estado?: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
        }
        Update: {
          id?: string
          pedido_id?: string
          producto_id?: string
          cantidad?: number
          precio_unit?: number
          descuento?: number
          notas?: string | null
          estado?: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
        }
      }
      comprobantes: {
        Row: {
          id: string
          pedido_id: string
          tipo: 'boleta' | 'factura' | 'nota_venta'
          serie: string
          correlativo: number
          estado_sunat: 'pendiente' | 'enviado' | 'aceptado' | 'rechazado'
          xml_url: string | null
          pdf_url: string | null
          emitido_at: string | null
        }
        Insert: {
          id?: string
          pedido_id: string
          tipo: 'boleta' | 'factura' | 'nota_venta'
          serie: string
          correlativo: number
          estado_sunat?: 'pendiente' | 'enviado' | 'aceptado' | 'rechazado'
          xml_url?: string | null
          pdf_url?: string | null
          emitido_at?: string | null
        }
        Update: {
          id?: string
          pedido_id?: string
          tipo?: 'boleta' | 'factura' | 'nota_venta'
          serie?: string
          correlativo?: number
          estado_sunat?: 'pendiente' | 'enviado' | 'aceptado' | 'rechazado'
          xml_url?: string | null
          pdf_url?: string | null
          emitido_at?: string | null
        }
      }
      insumos: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          unidad: 'kg' | 'lt' | 'und' | 'gr' | 'ml'
          stock_actual: number
          stock_minimo: number
          costo_unit: number
          activo: boolean
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          unidad: 'kg' | 'lt' | 'und' | 'gr' | 'ml'
          stock_actual?: number
          stock_minimo?: number
          costo_unit?: number
          activo?: boolean
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          unidad?: 'kg' | 'lt' | 'und' | 'gr' | 'ml'
          stock_actual?: number
          stock_minimo?: number
          costo_unit?: number
          activo?: boolean
        }
      }
      recetas: {
        Row: {
          id: string
          producto_id: string
          insumo_id: string
          cantidad: number
        }
        Insert: {
          id?: string
          producto_id: string
          insumo_id: string
          cantidad: number
        }
        Update: {
          id?: string
          producto_id?: string
          insumo_id?: string
          cantidad?: number
        }
      }
      movimientos_stock: {
        Row: {
          id: string
          tenant_id: string
          insumo_id: string
          tipo: 'entrada' | 'salida' | 'ajuste' | 'merma'
          cantidad: number
          origen: 'compra' | 'venta' | 'ajuste_manual'
          ref_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          insumo_id: string
          tipo: 'entrada' | 'salida' | 'ajuste' | 'merma'
          cantidad: number
          origen: 'compra' | 'venta' | 'ajuste_manual'
          ref_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          insumo_id?: string
          tipo?: 'entrada' | 'salida' | 'ajuste' | 'merma'
          cantidad?: number
          origen?: 'compra' | 'venta' | 'ajuste_manual'
          ref_id?: string | null
          created_at?: string
        }
      }
      proveedores: {
        Row: {
          id: string
          tenant_id: string
          nombre: string
          ruc: string | null
          contacto: string | null
          telefono: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          nombre: string
          ruc?: string | null
          contacto?: string | null
          telefono?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          nombre?: string
          ruc?: string | null
          contacto?: string | null
          telefono?: string | null
        }
      }
      compras: {
        Row: {
          id: string
          tenant_id: string
          proveedor_id: string
          total: number
          estado: string
          fecha: string
        }
        Insert: {
          id?: string
          tenant_id: string
          proveedor_id: string
          total: number
          estado?: string
          fecha?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          proveedor_id?: string
          total?: number
          estado?: string
          fecha?: string
        }
      }
      compra_items: {
        Row: {
          id: string
          compra_id: string
          insumo_id: string
          cantidad: number
          precio_unit: number
        }
        Insert: {
          id?: string
          compra_id: string
          insumo_id: string
          cantidad: number
          precio_unit: number
        }
        Update: {
          id?: string
          compra_id?: string
          insumo_id?: string
          cantidad?: number
          precio_unit?: number
        }
      }
      cajas: {
        Row: {
          id: string
          tenant_id: string
          usuario_id: string
          monto_apertura: number
          monto_cierre: number | null
          abierta_at: string
          cerrada_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          usuario_id: string
          monto_apertura: number
          monto_cierre?: number | null
          abierta_at?: string
          cerrada_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          usuario_id?: string
          monto_apertura?: number
          monto_cierre?: number | null
          abierta_at?: string
          cerrada_at?: string | null
        }
      }
      movimientos_caja: {
        Row: {
          id: string
          caja_id: string
          tipo: 'ingreso' | 'egreso'
          monto: number
          concepto: string
          created_at: string
        }
        Insert: {
          id?: string
          caja_id: string
          tipo: 'ingreso' | 'egreso'
          monto: number
          concepto: string
          created_at?: string
        }
        Update: {
          id?: string
          caja_id?: string
          tipo?: 'ingreso' | 'egreso'
          monto?: number
          concepto?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      get_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      get_user_rol: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      plan_tipo: 'ordena' | 'crece' | 'avanza'
      usuario_rol: 'admin' | 'mozo' | 'cajero' | 'cocina'
      mesa_estado: 'libre' | 'ocupada' | 'reservada'
      pedido_tipo: 'salon' | 'llevar' | 'delivery'
      pedido_estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'
      canal_pedido: 'pos' | 'qr' | 'rappi' | 'pedidosya'
      comprobante_tipo: 'boleta' | 'factura' | 'nota_venta'
      sunat_estado: 'pendiente' | 'enviado' | 'aceptado' | 'rechazado'
      mov_stock_tipo: 'entrada' | 'salida' | 'ajuste' | 'merma'
      mov_stock_origen: 'compra' | 'venta' | 'ajuste_manual'
      caja_mov_tipo: 'ingreso' | 'egreso'
      unidad_medida: 'kg' | 'lt' | 'und' | 'gr' | 'ml'
      area_produccion: 'cocina' | 'bar' | 'horno'
    }
    CompositeTypes: Record<string, never>
  }
}

// Convenience types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Tenant = Tables<'tenants'>
export type Usuario = Tables<'usuarios'>
export type Salon = Tables<'salones'>
export type Mesa = Tables<'mesas'>
export type Cliente = Tables<'clientes'>
export type Categoria = Tables<'categorias'>
export type Producto = Tables<'productos'>
export type Pedido = Tables<'pedidos'>
export type PedidoItem = Tables<'pedido_items'>
export type Comprobante = Tables<'comprobantes'>
export type Insumo = Tables<'insumos'>
export type Receta = Tables<'recetas'>
export type MovimientoStock = Tables<'movimientos_stock'>
export type Proveedor = Tables<'proveedores'>
export type Compra = Tables<'compras'>
export type CompraItem = Tables<'compra_items'>
export type Caja = Tables<'cajas'>
export type MovimientoCaja = Tables<'movimientos_caja'>

// Extended types with joins
export type PedidoConItems = Pedido & {
  mesa?: Pick<Mesa, 'numero'> & { salon?: Pick<Salon, 'nombre'> }
  usuario?: Pick<Usuario, 'nombre'>
  items?: (PedidoItem & {
    producto?: Pick<Producto, 'nombre'>
  })[]
}

export type MesaConSalon = Mesa & {
  salon?: Pick<Salon, 'nombre'>
  pedido_activo?: Pick<Pedido, 'id' | 'total' | 'created_at'> | null
}
