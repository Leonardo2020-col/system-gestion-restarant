declare module 'qz-tray' {
  const qz: {
    websocket: {
      connect(opts?: Record<string, unknown>): Promise<void>
      disconnect(): Promise<void>
      isActive(): boolean
    }
    configs: {
      create(printer: string, opts?: Record<string, unknown>): unknown
    }
    print(config: unknown, data: unknown[]): Promise<void>
  }
  export default qz
}
