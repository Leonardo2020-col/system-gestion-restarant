import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export const runtime = 'nodejs'

const execAsync = promisify(exec)

// ── Tabla de conversión UTF-8 → PC850 (soporta español) ──────────────────
const PC850: Record<string, number> = {
  'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3,
  'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ú': 0xE9,
  'ñ': 0xA4, 'Ñ': 0xA5,
  'ü': 0x81, 'Ü': 0x9A,
  '¿': 0xA8, '¡': 0xAD,
  '°': 0xF8, 'ª': 0xA6, 'º': 0xA7,
}

function toPC850(text: string): number[] {
  const out: number[] = []
  for (const ch of text) {
    if (PC850[ch] !== undefined) {
      out.push(PC850[ch])
    } else {
      const code = ch.charCodeAt(0)
      out.push(code < 128 ? code : 63) // '?' para chars no soportados
    }
  }
  return out
}

type TicketPayload = {
  mesa: number | null
  items: { nombre: string; cantidad: number; notas?: string | null }[]
  hora: string
  esAgregado: boolean
  paperSize: '58mm' | '80mm'
  printerName?: string
}

// ── Construir buffer ESC/POS ──────────────────────────────────────────────
function buildEscPos(data: TicketPayload): Buffer {
  const cols = data.paperSize === '80mm' ? 48 : 32
  const sep  = '-'.repeat(cols)
  const b: number[] = []

  const esc = (...n: number[]) => b.push(...n)
  const str = (s: string)      => b.push(...toPC850(s))
  const ln  = (s = '')         => { str(s); b.push(0x0A) }  // + LF

  // ── Inicializar ──
  esc(0x1B, 0x40)        // ESC @ — reset
  esc(0x1B, 0x74, 0x02)  // ESC t 2 — charset PC850

  // ── Título (centrado, doble tamaño) ──
  esc(0x1B, 0x61, 0x01)  // center
  esc(0x1B, 0x21, 0x30)  // double height + width
  ln(data.esAgregado ? '++ ADICIONAL' : 'COMANDA')
  esc(0x1B, 0x21, 0x00)  // normal

  // ── Mesa y hora ──
  esc(0x1B, 0x45, 0x01)  // bold on
  ln(`${data.mesa ? 'MESA ' + data.mesa : 'SIN MESA'}  ${data.hora}`)
  esc(0x1B, 0x45, 0x00)  // bold off
  esc(0x1B, 0x61, 0x00)  // left
  ln(sep)
  b.push(0x0A)

  // ── Ítems ──
  for (const item of data.items) {
    esc(0x1B, 0x21, 0x10)  // double height
    esc(0x1B, 0x45, 0x01)  // bold
    ln(`${item.cantidad}x  ${item.nombre}`)
    esc(0x1B, 0x21, 0x00)  // normal
    esc(0x1B, 0x45, 0x00)  // bold off

    if (item.notas) {
      esc(0x1D, 0x42, 0x01)  // GS B 1 — inverso (fondo negro)
      esc(0x1B, 0x45, 0x01)  // bold
      ln(` ! ${item.notas} `)
      esc(0x1D, 0x42, 0x00)  // GS B 0 — normal
      esc(0x1B, 0x45, 0x00)
    }

    ln(sep)
  }

  // ── Pie ──
  b.push(0x0A)
  esc(0x1B, 0x61, 0x01)  // center
  ln(new Date().toLocaleDateString('es-PE'))
  b.push(0x0A, 0x0A, 0x0A)           // 3 avances
  b.push(0x1D, 0x56, 0x41, 0x05)     // GS V A 5 — corte parcial + avance 5mm

  return Buffer.from(b)
}

// ── Enviar buffer al driver de Windows vía PowerShell (Win32 API raw) ─────
async function rawPrint(buf: Buffer, printerName: string): Promise<void> {
  const tmpBin = path.join(os.tmpdir(), `tk_${Date.now()}.bin`)
  const tmpPs  = path.join(os.tmpdir(), `tk_${Date.now()}.ps1`)

  await fs.writeFile(tmpBin, buf)

  const ps = `
$bytes = [IO.File]::ReadAllBytes('${tmpBin.replace(/\\/g, '\\\\')}')
$name  = '${printerName}'
Add-Type -Namespace Win -Name Prn -MemberDefinition @'
  [DllImport("winspool.drv",CharSet=CharSet.Auto)]
  public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv")]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv",CharSet=CharSet.Auto)]
  public static extern int StartDocPrinter(IntPtr h, int l, ref DI di);
  [DllImport("winspool.drv")]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv")]
  public static extern bool WritePrinter(IntPtr h, IntPtr b, int c, out int w);
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Auto)]
  public struct DI { public string dn; public string of; public string dt; }
'@
$h = [IntPtr]::Zero
[Win.Prn]::OpenPrinter($name, [ref]$h, [IntPtr]::Zero) | Out-Null
$di = New-Object Win.Prn+DI; $di.dn = 'Comanda'; $di.dt = 'RAW'
[Win.Prn]::StartDocPrinter($h, 1, [ref]$di) | Out-Null
[Win.Prn]::StartPagePrinter($h) | Out-Null
$p = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes, 0, $p, $bytes.Length)
$w = 0
[Win.Prn]::WritePrinter($h, $p, $bytes.Length, [ref]$w) | Out-Null
[Runtime.InteropServices.Marshal]::FreeHGlobal($p)
[Win.Prn]::EndPagePrinter($h) | Out-Null
[Win.Prn]::EndDocPrinter($h) | Out-Null
[Win.Prn]::ClosePrinter($h) | Out-Null
Write-Output "OK:$w"
`

  await fs.writeFile(tmpPs, ps, 'utf8')

  try {
    const { stdout, stderr } = await execAsync(
      `powershell -ExecutionPolicy Bypass -NonInteractive -File "${tmpPs}"`,
      { timeout: 15000 }
    )
    if (stderr && !stdout.includes('OK:')) {
      throw new Error(stderr.trim())
    }
  } finally {
    await fs.unlink(tmpBin).catch(() => {})
    await fs.unlink(tmpPs).catch(() => {})
  }
}

// ── Handler POST ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const data: TicketPayload = await req.json()
    const printerName = data.printerName ?? 'POS-58'
    const buf = buildEscPos(data)
    await rawPrint(buf, printerName)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[imprimir-ticket]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
