declare module '@ioc:Adonis/Core/Drive' {
  interface DisksList {
    local: {
      implementation: LocalDriverContract
      config: LocalDriverConfig
    }
  }
}
