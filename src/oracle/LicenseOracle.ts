import { OracleResult } from '../types'

export class LicenseOracle {
  async verifyLicense(licenseNumber: string): Promise<OracleResult> {
    console.log(`🔮 Running Oracle verification for license: ${licenseNumber}`)
    
    // Mock verification logic with improved handling
    // Extract numbers from license for verification
    const numbers = licenseNumber.replace(/[^0-9]/g, '')
    console.log(`🔢 Extracted numbers: ${numbers}`)
    
    if (numbers.length === 0) {
      console.log(`⚠️ No numbers found in license, marking as Invalid`)
      return 'Invalid'
    }
    
    // Use sum of all digits for more realistic verification
    const digitSum = numbers.split('').reduce((sum, digit) => sum + parseInt(digit), 0)
    console.log(`🧮 Digit sum: ${digitSum}`)
    
    // More realistic verification logic (more Valid outcomes for demo)
    if (digitSum % 5 === 0 || digitSum % 5 === 1 || digitSum % 5 === 4) {
      console.log(`✅ License verified as Valid`)
      return 'Valid'
    } else if (digitSum % 5 === 2) {
      console.log(`⏰ License verified as Expired`)
      return 'Expired'
    } else {
      console.log(`❌ License verified as Invalid`)
      return 'Invalid'
    }
  }
}