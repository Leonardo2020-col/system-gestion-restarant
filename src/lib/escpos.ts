/* Generador ESC/POS para impresoras térmicas POS-58 / POS-80
   Funciona en el cliente (browser) — no depende de Node.js          */

type TicketItem = { nombre: string; cantidad: number; notas?: string | null }
export type TicketEscPos = {
  mesa: number | null
  items: TicketItem[]
  hora: string
  esAgregado: boolean
  paperSize: '58mm' | '80mm'
}

/* Tabla UTF-8 → CP850 (soporta caracteres en español) */
const CP850: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9,
  ñ: 0xa4, Ñ: 0xa5,
  ü: 0x81, Ü: 0x9a,
  '¿': 0xa8, '¡': 0xad, '°': 0xf8,
}

function encode(text: string): number[] {
  return [...text].map((c) => CP850[c] ?? (c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 63))
}

export function buildEscPos(data: TicketEscPos): Uint8Array {
  const cols = data.paperSize === '80mm' ? 48 : 32
  const sep  = '-'.repeat(cols)
  const b: number[] = []

  const esc = (...n: number[]) => b.push(...n)
  const str = (s: string)      => b.push(...encode(s))
  const ln  = (s = '')         => { str(s); b.push(0x0a) }

  /* Init + charset CP850 */
  esc(0x1b, 0x40)
  esc(0x1b, 0x74, 0x02)

  /* Título — centrado, doble tamaño */
  esc(0x1b, 0x61, 0x01)
  esc(0x1b, 0x21, 0x30)
  ln(data.esAgregado ? '++ ADICIONAL' : 'COMANDA')
  esc(0x1b, 0x21, 0x00)

  /* Mesa + hora */
  esc(0x1b, 0x45, 0x01)
  ln(`${data.mesa ? 'MESA ' + data.mesa : 'SIN MESA'}  ${data.hora}`)
  esc(0x1b, 0x45, 0x00)
  esc(0x1b, 0x61, 0x00)
  ln(sep)
  b.push(0x0a)

  /* Ítems */
  for (const item of data.items) {
    esc(0x1b, 0x21, 0x10) /* double height */
    esc(0x1b, 0x45, 0x01) /* bold */
    ln(`${item.cantidad}x  ${item.nombre}`)
    esc(0x1b, 0x21, 0x00)
    esc(0x1b, 0x45, 0x00)

    if (item.notas) {
      esc(0x1d, 0x42, 0x01) /* invert (fondo negro) */
      esc(0x1b, 0x45, 0x01)
      ln(` ! ${item.notas} `)
      esc(0x1d, 0x42, 0x00)
      esc(0x1b, 0x45, 0x00)
    }
    ln(sep)
  }

  /* Pie */
  b.push(0x0a)
  esc(0x1b, 0x61, 0x01)
  ln(new Date().toLocaleDateString('es-PE'))

  /* Avance + corte */
  b.push(0x0a, 0x0a, 0x0a)
  b.push(0x1d, 0x56, 0x41, 0x05) /* GS V A — corte parcial + avance 5 mm */

  return new Uint8Array(b)
}

/** Convierte Uint8Array a base64 (necesario para QZ Tray) */
export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}
