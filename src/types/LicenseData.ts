export interface LicenseData {
  telegramId: string
  walletAddress: string
  licenseNumber: string
  licenseHash: string
  oracleResult: 'Valid' | 'Invalid' | 'Expired' | 'Processing'
  txHash: string
  timestamp: string
}