declare module '@point-of-sale/receipt-printer-encoder' {
  interface EncoderOptions {
    language?: 'esc-pos' | 'star-prnt' | 'star-line'
    columns?: number
    feedBeforeCut?: number
    autoFlush?: boolean
    [key: string]: unknown
  }

  interface RuleOptions {
    style?: 'single' | 'double' | 'none'
  }

  class ReceiptPrinterEncoder {
    constructor(options?: EncoderOptions)
    initialize(): this
    align(value: 'left' | 'center' | 'right'): this
    bold(value: boolean): this
    invert(value: boolean): this
    size(width: number, height: number): this
    line(value: string): this
    newline(): this
    rule(options?: RuleOptions): this
    cut(mode?: 'full' | 'partial'): this
    encode(): Uint8Array
  }

  export default ReceiptPrinterEncoder
}
