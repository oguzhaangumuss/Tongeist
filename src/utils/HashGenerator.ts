import crypto from 'crypto'

export class HashGenerator {
  static generateLicenseHash(licenseNumber: string, telegramId: string, userWalletAddress: string): string {
    const timestamp = Date.now()
    const data = `${licenseNumber}_${telegramId}_${userWalletAddress}_${timestamp}`
    const hash = crypto.createHash('sha256').update(data).digest('hex')
    
    // Terminal output for demo
    console.log('\n🔐 ===== BLOCKCHAIN HASH GENERATION =====')
    console.log(`📋 License Number: ${licenseNumber}`)
    console.log(`👤 Telegram ID: ${telegramId}`)
    console.log(`💰 User Wallet: ${userWalletAddress}`)
    console.log(`🕒 Timestamp: ${new Date().toISOString()}`)
    console.log(`🔑 Input Data: ${data}`)
    console.log(`🔗 SHA-256 Hash: ${hash}`)
    console.log(`📊 Hash Preview: 0x${hash.substring(0, 16)}...${hash.substring(-8)}`)
    console.log('🔐 =====================================\n')
    
    return hash
  }
}