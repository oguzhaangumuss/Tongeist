import TelegramBot from 'node-telegram-bot-api'
import { Agent } from '@openserv-labs/sdk'
import { LicenseData } from '../types'
import { TONIntegration } from '../blockchain/TONIntegration'
import { OCRProcessor } from '../ocr/OCRProcessor'
import { LicenseOracle } from '../oracle/LicenseOracle'
import { LicenseDatabase } from '../database/LicenseDatabase'
import { UserWalletStore } from '../database/UserWalletStore'
import { AgentManager } from '../openserv/AgentManager'
import { HashGenerator } from '../utils/HashGenerator'
import { Environment } from '../config/Environment'

export class SimpleTelegramBot extends Agent {
  private bot: TelegramBot
  private workspaceId: number
  private licenseDatabase: LicenseDatabase
  private userWalletStore: UserWalletStore
  private tonIntegration: TONIntegration
  private ocrProcessor: OCRProcessor
  private licenseOracle: LicenseOracle
  private agentManager: AgentManager

  constructor() {
    // Validate required environment variables
    Environment.validateRequiredVars()

    // Initialize Agent (parent class)
    super({
      systemPrompt: 'You are a helpful assistant.',
      apiKey: Environment.OPENSERV_API_KEY
    })

    // Initialize bot
    this.bot = new TelegramBot(Environment.TELEGRAM_BOT_TOKEN, { polling: true })
    this.workspaceId = Environment.WORKSPACE_ID
    
    // Initialize services
    this.licenseDatabase = new LicenseDatabase()
    this.userWalletStore = new UserWalletStore()
    this.tonIntegration = new TONIntegration()
    this.ocrProcessor = new OCRProcessor()
    this.licenseOracle = new LicenseOracle()
    this.agentManager = new AgentManager(this, this.workspaceId, Environment.AGENT_ID)

    this.setupHandlers()
  }

  private setupHandlers() {
    // Handle /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id
      const currentAgent = await this.agentManager.getAgentName(this.agentManager.getCurrentAgentId())
      const startMessage = `🤖 Multi-Agent OpenServ Bot + License Oracle!

Current Agent: ${currentAgent}

🤖 AI Commands:
• /ask [question] - Ask current agent
• /agent - Switch agents
• /agents - List all agents

🆔 License Oracle:
• /setwallet EQCx...YtR9 - Set your TON wallet address
• Send photo - Upload license for verification
• /license - Check status
• /licenses - View all
• /export - Export Excel format

⛓️ TON Blockchain:
• /wallet - Check wallet & blockchain status

📸 Upload your license photo to get started!
Example: /ask What is OpenServ?`

      await this.bot.sendMessage(chatId, startMessage)
    })

    // Handle /ask command
    this.bot.onText(/\/ask (.+)/, async (msg, match) => {
      const chatId = msg.chat.id
      const question = match?.[1]

      if (!question) {
        await this.bot.sendMessage(chatId, '❌ Please write a question: /ask [your question]')
        return
      }

      // Send typing indicator
      this.bot.sendChatAction(chatId, 'typing')

      try {
        console.log(`📝 Question received: \"${question}\"`)
        console.log(`💬 Using marketplace agent ${this.agentManager.getCurrentAgentId()} via chat message...`)
        
        // Use sendChatMessage for marketplace agents
        const chatResponse = await this.agentManager.sendChatMessage(
          this.workspaceId,
          this.agentManager.getCurrentAgentId(),
          question
        )

        console.log(`✅ Chat response received:`, chatResponse)
        
        // Handle the response from marketplace agent
        if (chatResponse && (chatResponse.message || chatResponse.content)) {
          // Extract message from response (format may vary)
          const responseText = chatResponse.message || chatResponse.content
          const agentName = this.agentManager.getAgentName(this.agentManager.getCurrentAgentId())
          await this.bot.sendMessage(chatId, `🤖 ${agentName} Response:\n\n${responseText}`)
        } else {
          // Chat message sent but no immediate response - this is normal for marketplace agents
          console.log('📨 Chat message sent successfully, but no immediate response')
          console.log('🔍 Full response object:', JSON.stringify(chatResponse, null, 2))
          
          // Wait for agent to respond and get the latest message
          await this.bot.sendMessage(chatId, `✅ Question sent to agent. Getting response...`)
          
          // Enhanced polling with retry logic
          const response = await this.agentManager.getAgentResponse(
            this.workspaceId, 
            this.agentManager.getCurrentAgentId(), 
            question
          )
          
          if (response) {
            const agentName = await this.agentManager.getAgentName(this.agentManager.getCurrentAgentId())
            await this.bot.sendMessage(chatId, `🤖 ${agentName} Response:\n\n${response}`)
          } else {
            await this.bot.sendMessage(chatId, `⏰ No response received within timeout. Please try again.`)
          }
        }

      } catch (error) {
        console.error('Error processing question:', error)
        await this.bot.sendMessage(chatId, `❌ Error communicating with agent: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    // Handle /agents command - List all available agents
    this.bot.onText(/\/agents/, async (msg) => {
      const chatId = msg.chat.id
      
      try {
        await this.bot.sendMessage(chatId, '🔍 Fetching agents from workspace...')
        
        const agents = await this.agentManager.getAvailableAgents()
        const agentsList = agents
          .map(agent => `• ${agent.name} (ID: ${agent.id})\n  ${agent.description}`)
          .join('\n\n')
        
        const currentAgent = await this.agentManager.getAgentName(this.agentManager.getCurrentAgentId())
        await this.bot.sendMessage(chatId, 
          `🤖 Available Agents (${agents.length}):\n\n${agentsList}\n\n✅ Current: ${currentAgent}\n\nUse /agent to switch agents`
        )
      } catch (error) {
        console.error('❌ Error fetching agents:', error)
        await this.bot.sendMessage(chatId, '❌ Error fetching agents from workspace')
      }
    })

    // Handle /agent command - Switch between agents
    this.bot.onText(/\/agent/, async (msg) => {
      const chatId = msg.chat.id
      
      try {
        const agents = await this.agentManager.getAvailableAgents()
        const keyboard = agents.map(agent => [{
          text: `${agent.name} (ID: ${agent.id})`,
          callback_data: `agent_${agent.id}`
        }])
        
        await this.bot.sendMessage(chatId, 
          '🔄 Select an agent:', 
          { 
            reply_markup: { 
              inline_keyboard: keyboard 
            } 
          }
        )
      } catch (error) {
        console.error('❌ Error fetching agents for selection:', error)
        await this.bot.sendMessage(chatId, '❌ Error fetching agents from workspace')
      }
    })

    // Handle agent selection callbacks
    this.bot.on('callback_query', async (callbackQuery) => {
      const data = callbackQuery.data
      const chatId = callbackQuery.message?.chat.id
      
      if (data?.startsWith('agent_') && chatId) {
        const agentId = parseInt(data.split('_')[1])
        
        try {
          const agents = await this.agentManager.getAvailableAgents()
          const agent = agents.find(a => a.id === agentId)
          
          if (agent) {
            this.agentManager.setCurrentAgentId(agentId)
            await this.bot.editMessageText(
              `✅ Switched to: ${agent.name}\n\n${agent.description}\n\nYou can now use /ask to interact with this agent!`,
              {
                chat_id: chatId,
                message_id: callbackQuery.message?.message_id
              }
            )
          } else {
            await this.bot.editMessageText(
              `❌ Agent with ID ${agentId} not found`,
              {
                chat_id: chatId,
                message_id: callbackQuery.message?.message_id
              }
            )
          }
        } catch (error) {
          console.error('❌ Error switching agent:', error)
          await this.bot.editMessageText(
            `❌ Error switching to agent`,
            {
              chat_id: chatId,
              message_id: callbackQuery.message?.message_id
            }
          )
        }
      }
      
      await this.bot.answerCallbackQuery(callbackQuery.id)
    })

    // Handle /help command
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id
      const currentAgent = await this.agentManager.getAgentName(this.agentManager.getCurrentAgentId())
      const helpText = `
📖 Multi-Agent OpenServ Bot + License Oracle Help:

Current Agent: ${currentAgent}

🤖 AI Commands:
• /start - Start the bot
• /ask [question] - Ask current agent
• /agent - Switch agents
• /agents - List all agents

🆔 License Oracle Commands:
• /setwallet EQCx...YtR9 - Set your TON wallet address
• Send photo - Upload license image for OCR processing
• /license - Check your license status
• /licenses - View all processed licenses
• /export - Export data in Excel format

⛓️  TON Blockchain Commands:
• /wallet - Show TON wallet status and balance

• /help - Show this help message

Examples:
/ask Give information about OpenServ platform
/ask What is artificial intelligence?
/ask Can you help me with a project?

📸 To verify a license: Just send a photo of the license!
      `
      await this.bot.sendMessage(chatId, helpText)
    })

    // Handle photo uploads for license verification
    this.bot.on('photo', async (msg) => {
      const chatId = msg.chat.id
      const telegramId = msg.from?.username || msg.from?.id.toString() || 'unknown'
      
      console.log(`📸 Photo received from user: ${telegramId}`)
      
      try {
        // Send processing message
        await this.bot.sendMessage(chatId, '📸 Processing license image...')
        
        // Get the highest resolution photo
        if (!msg.photo || msg.photo.length === 0) {
          await this.bot.sendMessage(chatId, '❌ No photo received')
          return
        }
        
        const photo = msg.photo[msg.photo.length - 1]
        const fileId = photo.file_id
        
        // Download the photo
        const fileLink = await this.bot.getFileLink(fileId)
        const response = await fetch(fileLink)
        const imageBuffer = Buffer.from(await response.arrayBuffer())
        
        console.log(`💾 Image downloaded, size: ${imageBuffer.length} bytes`)
        
        // Process with OCR
        const ocrResult = await this.ocrProcessor.processLicenseImage(imageBuffer)
        
        if (ocrResult.licenseNumber) {
          // Check if user has set wallet address
          const userWallet = this.userWalletStore.getWallet(telegramId)
          if (!userWallet) {
            await this.bot.sendMessage(chatId, '❌ Please set your TON wallet address first: /setwallet EQCx...YtR9')
            return
          }
          
          // Generate license hash
          console.log('\n🚀 ===== STARTING BLOCKCHAIN PROCESS =====')
          console.log(`📸 Processing license for user: ${telegramId}`)
          console.log(`🔍 Extracted License Number: ${ocrResult.licenseNumber}`)
          console.log(`💰 User Wallet: ${userWallet}`)
          
          const licenseHash = HashGenerator.generateLicenseHash(ocrResult.licenseNumber, telegramId, userWallet)
          
          // Run Oracle verification
          const oracleResult = await this.licenseOracle.verifyLicense(ocrResult.licenseNumber)
          console.log(`🔮 Oracle Result: ${oracleResult}`)
          
          // Create license data first
          const licenseData: LicenseData = {
            telegramId,
            walletAddress: userWallet,
            licenseNumber: ocrResult.licenseNumber,
            licenseHash,
            oracleResult,
            txHash: '', // Will be set below
            timestamp: new Date().toISOString()
          }
          
          // Record on TON blockchain (real blockchain transaction)
          const txHash = await this.tonIntegration.recordLicenseVerification(licenseData)
          if (txHash) {
            licenseData.txHash = txHash
          } else {
            console.log('❌ Failed to record license on blockchain')
            await this.bot.sendMessage(chatId, '❌ Failed to record license on blockchain. Please try again or contact support.')
            return
          }
          
          console.log('\n📊 ===== DEMO BLOCKCHAIN SUMMARY =====')
          console.log(`👤 Telegram ID: @${telegramId}`)
          console.log(`💰 Wallet Address: ${userWallet}`)
          console.log(`📋 License Number: ${ocrResult.licenseNumber}`)
          console.log(`🔑 License Hash: 0x${licenseHash.substring(0, 8)}...${licenseHash.substring(-4)}`)
          console.log(`🔮 Oracle Result: ${oracleResult === 'Valid' ? '✅' : oracleResult === 'Expired' ? '⏰' : '❌'} ${oracleResult}`)
          console.log(`📦 TON Tx Hash: ${txHash ? txHash.substring(0, 16) + '...' : 'Error generating hash'}`)
          console.log(`🕒 Timestamp: ${new Date().toISOString()}`)
          console.log('📊 ===================================\n')
          
          this.licenseDatabase.save(licenseData)
          
          // Send result to user
          const resultIcon = oracleResult === 'Valid' ? '✅' : oracleResult === 'Expired' ? '⏰' : '❌'
          const resultMessage = `
🆔 License Processing Complete

📋 Results:
• License Number: ${ocrResult.licenseNumber}
• Oracle Status: ${resultIcon} ${oracleResult}
• Confidence: ${ocrResult.confidence.toFixed(2)}%
• Hash: ${licenseHash.substring(0, 16)}...

${ocrResult.expirationDate ? `• Expiration: ${ocrResult.expirationDate}` : ''}

⛓️ Blockchain:
• TON Status: ${txHash ? 'Recorded' : 'Demo Mode'}
${txHash ? `• Tx Hash: ${txHash.substring(0, 16)}...` : ''}
${txHash ? `🔗 Explorer: https://testnet.tonviewer.com/transaction/${txHash}` : ''}

          `
          
          await this.bot.sendMessage(chatId, resultMessage)
          
        } else {
          await this.bot.sendMessage(chatId, `❌ Could not extract license number from image.\n\nOCR Text:\n${ocrResult.text.substring(0, 300)}...`)
        }
        
      } catch (error) {
        console.error('❌ License processing error:', error)
        await this.bot.sendMessage(chatId, '❌ Error processing license image. Please try again.')
      }
    })

    // Handle /setwallet command - Set user's TON wallet address
    this.bot.onText(/\/set\s*wallet\s+(.+)/i, async (msg, match) => {
      const chatId = msg.chat.id
      const telegramId = msg.from?.username || msg.from?.id.toString() || 'unknown'
      const walletAddress = match?.[1]?.trim()
      
      console.log(`🔧 /setwallet command received from ${telegramId}`)
      console.log(`🔧 Raw message text: \"${msg.text}\"`)
      console.log(`🔧 Wallet address: ${walletAddress}`)
      console.log(`🔧 Match array:`, match)
      
      if (!walletAddress) {
        await this.bot.sendMessage(chatId, '❌ Please provide a TON wallet address: /setwallet EQCx...YtR9')
        return
      }
      
      try {
        // Basic validation for TON address format
        if (!walletAddress.match(/^(EQ|UQ|0Q)[A-Za-z0-9_-]{46}$/)) {
          await this.bot.sendMessage(chatId, '❌ Invalid TON wallet address format')
          return
        }
        
        // Save wallet address
        this.userWalletStore.setWallet(telegramId, walletAddress)
        
        await this.bot.sendMessage(chatId, `✅ TON wallet address set successfully!

📍 Address: ${walletAddress}
👤 Telegram ID: @${telegramId}
💡 Now you can upload license photos for verification`)
      } catch (error) {
        console.error('❌ Error setting wallet:', error)
        await this.bot.sendMessage(chatId, '❌ Error setting wallet address')
      }
    })

    // Handle /license command - Show license status
    this.bot.onText(/\/license/, async (msg) => {
      const chatId = msg.chat.id
      const telegramId = msg.from?.username || msg.from?.id.toString() || 'unknown'
      
      const licenseData = this.licenseDatabase.get(telegramId)
      
      if (licenseData) {
        const resultIcon = licenseData.oracleResult === 'Valid' ? '✅' : licenseData.oracleResult === 'Expired' ? '⏰' : '❌'
        const statusMessage = `
🆔 Your License Status

📋 Information:
• License Number: ${licenseData.licenseNumber}
• Status: ${resultIcon} ${licenseData.oracleResult}
• Hash: ${licenseData.licenseHash.substring(0, 16)}...
• Processed: ${new Date(licenseData.timestamp).toLocaleString()}

${licenseData.walletAddress ? `• Wallet: ${licenseData.walletAddress}` : ''}
${licenseData.txHash ? `• Tx Hash: ${licenseData.txHash.substring(0, 16)}...` : ''}
${licenseData.txHash ? `🔗 Explorer: https://testnet.tonviewer.com/transaction/${licenseData.txHash}` : ''}
        `
        
        await this.bot.sendMessage(chatId, statusMessage)
      } else {
        await this.bot.sendMessage(chatId, `❌ No license data found. Please upload your license photo first.`)
      }
    })

    // Handle /licenses command - Show all licenses (admin)
    this.bot.onText(/\/licenses/, async (msg) => {
      const chatId = msg.chat.id
      
      if (this.licenseDatabase.size() === 0) {
        await this.bot.sendMessage(chatId, '📋 No licenses processed yet.')
        return
      }
      
      let licensesList = '📋 All Processed Licenses:\n\n'
      
      for (const [telegramId, licenseData] of this.licenseDatabase.getAll()) {
        const resultIcon = licenseData.oracleResult === 'Valid' ? '✅' : licenseData.oracleResult === 'Expired' ? '⏰' : '❌'
        licensesList += `• ${telegramId}: ${licenseData.licenseNumber} ${resultIcon}\n`
      }
      
      await this.bot.sendMessage(chatId, licensesList)
    })

    // Handle /export command - Export license data in Excel format
    this.bot.onText(/\/export/, async (msg) => {
      const chatId = msg.chat.id
      
      if (this.licenseDatabase.size() === 0) {
        await this.bot.sendMessage(chatId, '📋 No license data to export.')
        return
      }
      
      // Send as formatted table
      const tableFormat = `
📊 Driver License Oracle TON - Export Data

\`\`\`
Telegram ID    Wallet Address (TON)    License Number    License Hash (SHA-256)    Oracle Result    Tx Hash (TON)    Timestamp
${Array.from(this.licenseDatabase.getAll().entries()).map(([telegramId, data]) => {
        const resultIcon = data.oracleResult === 'Valid' ? '✅ Valid' : 
                          data.oracleResult === 'Expired' ? '⏰ Expired' : 
                          '❌ Invalid'
        return `@${telegramId}    ${data.walletAddress.substring(0, 6)}...${data.walletAddress.substring(-4)}    ${data.licenseNumber}    0x${data.licenseHash.substring(0, 8)}...${data.licenseHash.substring(-4)}    ${resultIcon}    ${data.txHash.substring(0, 16)}...    ${new Date(data.timestamp).toLocaleDateString()}`
      }).join('\n')}
\`\`\`

💾 Total Records: ${this.licenseDatabase.size()}
⛓️  All transactions recorded on TON Testnet
      `
      
      await this.bot.sendMessage(chatId, tableFormat)
    })

    // Handle /wallet command - Show TON wallet info
    this.bot.onText(/\/wallet/, async (msg) => {
      const chatId = msg.chat.id
      
      try {
        // Run debug first to get detailed information
        await this.tonIntegration.debugWalletState()
        
        const balance = await this.tonIntegration.getWalletBalance()
        const isActive = balance !== '0' && !balance.startsWith('0.0000') && !balance.includes('not deployed')
        const statusIcon = isActive ? '🟢' : '🔵'
        const statusText = isActive ? 'Blockchain Recording Active' : 'Blockchain Recording Ready'
        
        const walletInfo = `
⛓️  TON Blockchain Integration

${statusIcon} ${statusText}
💰 Balance: ${balance}
🌐 Network: Testnet
📊 Recorded Licenses: ${this.licenseDatabase.size()}

✨ All license verifications are securely recorded on the blockchain for transparency and immutability.

🔗 Explorers:
• TON Viewer: https://testnet.tonviewer.com/
• TON Scan: https://testnet.tonscan.org/

🔍 Debug: Check logs for detailed wallet information
        `
        
        await this.bot.sendMessage(chatId, walletInfo)
      } catch (error) {
        console.error('❌ Wallet info error:', error)
        await this.bot.sendMessage(chatId, '❌ Could not get wallet information')
      }
    })

    // Debug: Log all messages
    this.bot.on('message', (msg) => {
      console.log(`📨 Message received: \"${msg.text}\" from ${msg.from?.username || msg.from?.id}`)
    })

    // Error handling
    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error)
    })

    console.log('✅ Telegram bot handlers set up successfully!')
  }

  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting Multi-Agent OpenServ Telegram Bot...')
      
      // Initialize TON integration
      const tonMnemonic = Environment.TON_MNEMONIC
      console.log('🔧 Reading TON_MNEMONIC from env...')
      console.log('🔧 Mnemonic exists:', !!tonMnemonic)
      console.log('🔧 Mnemonic length:', tonMnemonic?.split(' ').length || 0)
      if (tonMnemonic) {
        console.log('🔧 First 3 words:', tonMnemonic.split(' ').slice(0, 3).join(' '))
      }
      const tonInitialized = await this.tonIntegration.initialize(tonMnemonic)
      
      // Start the OpenServ agent server
      await super.start()
      
      console.log('✅ Multi-Agent Bot is running! Send /start to begin.')
      
      // Log available agents
      try {
        const agents = await this.agentManager.getAvailableAgents()
        console.log(`📋 Available agents (${agents.length}): ${agents.map(a => a.name).join(', ')}`)
        console.log(`🎯 Current agent: ${await this.agentManager.getAgentName(this.agentManager.getCurrentAgentId())}`)
      } catch (error) {
        console.log('⚠️  Could not fetch initial agent list')
      }
      
      console.log(`⛓️  TON Blockchain: ${tonInitialized ? 'Active' : 'Demo Mode'}`)

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n⏹️ Shutting down bot...')
        this.bot.stopPolling()
        process.exit(0)
      })

    } catch (error) {
      console.error('❌ Error starting bot:', error)
      process.exit(1)
    }
  }
}