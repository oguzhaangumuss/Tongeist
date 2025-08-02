export class Environment {
  static validateRequiredVars(): void {
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'OPENSERV_API_KEY', 'WORKSPACE_ID', 'AGENT_ID']
    const missingVars = requiredVars.filter(varName => !process.env[varName])
    
    console.log('🔧 Environment Variables Debug:')
    requiredVars.forEach(varName => {
      const value = process.env[varName]
      const isSet = !!value
      const preview = value ? `${value.substring(0, 8)}...` : 'NOT SET'
      console.log(`  ${varName}: ${isSet ? '✅' : '❌'} ${preview}`)
    })
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars)
      process.exit(1)
    }
    
    console.log('✅ All required environment variables are set')
  }

  static get TELEGRAM_BOT_TOKEN(): string {
    return process.env.TELEGRAM_BOT_TOKEN!
  }

  static get OPENSERV_API_KEY(): string {
    return process.env.OPENSERV_API_KEY!
  }

  static get WORKSPACE_ID(): number {
    return parseInt(process.env.WORKSPACE_ID!)
  }

  static get AGENT_ID(): number {
    return parseInt(process.env.AGENT_ID!)
  }

  static get TON_API_KEY(): string | undefined {
    return process.env.TON_API_KEY
  }

  static get TON_MNEMONIC(): string | undefined {
    return process.env.TON_MNEMONIC
  }
}