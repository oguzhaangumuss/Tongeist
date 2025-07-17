import { LicenseData } from '../types'

export class LicenseDatabase {
  private database: Map<string, LicenseData>

  constructor() {
    this.database = new Map<string, LicenseData>()
  }

  save(licenseData: LicenseData): void {
    this.database.set(licenseData.telegramId, licenseData)
    
    // Demo terminal table output
    console.log('\n📊 ===== UPDATED LICENSE DATABASE =====')
    console.log('Telegram ID       | Wallet Address    | License Number | License Hash      | Oracle Result | Tx Hash          | Timestamp')
    console.log('------------------|-------------------|----------------|-------------------|---------------|------------------|------------------')
    
    for (const [telegramId, data] of this.database) {
      const resultIcon = data.oracleResult === 'Valid' ? '✅' : data.oracleResult === 'Expired' ? '⏰' : '❌'
      const formattedRow = `@${telegramId.padEnd(15)} | ${data.walletAddress.substring(0, 6)}...${data.walletAddress.substring(-4).padEnd(9)} | ${data.licenseNumber.padEnd(14)} | 0x${data.licenseHash.substring(0, 8)}...${data.licenseHash.substring(-4).padEnd(7)} | ${resultIcon} ${data.oracleResult.padEnd(7)} | ${data.txHash.substring(0, 16)}... | ${new Date(data.timestamp).toLocaleDateString()}`
      console.log(formattedRow)
    }
    
    console.log('📊 ===================================\n')
  }

  get(telegramId: string): LicenseData | undefined {
    return this.database.get(telegramId)
  }

  getAll(): Map<string, LicenseData> {
    return this.database
  }

  size(): number {
    return this.database.size
  }
}