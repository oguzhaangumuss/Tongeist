import dotenv from 'dotenv'
import { SimpleTelegramBot } from './bot/TelegramBot'

// Load environment variables
dotenv.config()

async function main() {
  try {
    const bot = new SimpleTelegramBot()
    await bot.start()
  } catch (error) {
    console.error('❌ Failed to start application:', error)
    process.exit(1)
  }
}

// Start the bot
if (require.main === module) {
  main()
}

export default SimpleTelegramBot