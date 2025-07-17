export class UserWalletStore {
  private wallets: Map<string, string> // telegramId -> walletAddress

  constructor() {
    this.wallets = new Map<string, string>()
  }

  setWallet(telegramId: string, walletAddress: string): void {
    this.wallets.set(telegramId, walletAddress)
    
    // Demo terminal output
    console.log('\n💰 ===== WALLET REGISTRATION =====')
    console.log(`👤 Telegram ID: @${telegramId}`)
    console.log(`📍 TON Wallet: ${walletAddress}`)
    console.log(`🔗 Network: TON Testnet`)
    console.log(`🕒 Registered: ${new Date().toISOString()}`)
    console.log(`✅ Status: Ready for license verification`)
    console.log('💰 ===============================\n')
  }

  getWallet(telegramId: string): string | undefined {
    return this.wallets.get(telegramId)
  }

  hasWallet(telegramId: string): boolean {
    return this.wallets.has(telegramId)
  }
}