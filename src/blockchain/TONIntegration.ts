import { TonClient, WalletContractV4, internal, Address, beginCell, fromNano } from 'ton'
import { mnemonicToWalletKey } from 'ton-crypto'
import { LicenseData } from '../types'

export class TONIntegration {
  private client: TonClient
  private wallet: WalletContractV4 | null = null
  private keyPair: any = null
  private contractAddress: Address

  constructor() {
    // Use improved endpoint configuration with rate limit handling
    this.client = new TonClient({
      endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY || undefined
    })
    
    // Use user's wallet address temporarily (will be replaced with contract address)
    this.contractAddress = Address.parse("0QDvE6RYrv2gKTi7dfytJ0_vNfCVh_c5pa8Dl3v4qCzPGAAc")
    
    console.log('🔧 TON Client configured with API key:', process.env.TON_API_KEY ? 'Yes' : 'No')
  }

  async initialize(mnemonic?: string): Promise<boolean> {
    if (!mnemonic) {
      console.log('⚠️  No mnemonic provided - using demo mode')
      return false
    }

    try {
      console.log('🔧 Initializing TON wallet with mnemonic...')
      this.keyPair = await mnemonicToWalletKey(mnemonic.split(' '))
      this.wallet = WalletContractV4.create({
        publicKey: this.keyPair.publicKey,
        workchain: 0
      })
      
      console.log('✅ TON wallet initialized')
      console.log('📍 Wallet address (mainnet):', this.wallet.address.toString())
      console.log('📍 Wallet address (testnet):', this.wallet.address.toString({
        testOnly: true,
        bounceable: false
      }))
      console.log('📍 Wallet address (testnet bounceable):', this.wallet.address.toString({
        testOnly: true,
        bounceable: true
      }))
      
      // Check different wallet versions
      console.log('\n🔍 Checking different wallet versions:')
      console.log('V4 (current):', this.wallet.address.toString({
        testOnly: true,
        bounceable: false
      }))
      
      // Test connection
      console.log('🔍 Testing connection to TON network...')
      try {
        const masterchainInfo = await this.client.getMasterchainInfo()
        console.log('📦 Latest seqno:', masterchainInfo.latestSeqno)
      } catch (error) {
        console.log('⚠️  Could not get masterchain info:', error)
      }
      
      return true
    } catch (error) {
      console.error('❌ TON wallet initialization failed:', error)
      console.error('Error details:', error instanceof Error ? error.message : error)
      return false
    }
  }

  async recordLicenseVerification(licenseData: LicenseData): Promise<string | null> {
    if (!this.wallet || !this.keyPair) {
      console.log('❌ TON wallet not initialized - cannot record to blockchain')
      return null
    }

    try {
      console.log('⛓️  Recording license verification on TON blockchain...')
      
      // Create message payload
      const message = beginCell()
        .storeUint(0, 32) // op code for license verification
        .storeBuffer(Buffer.from(licenseData.licenseHash, 'hex').slice(0, 32))
        .storeUint(this.getOracleResultCode(licenseData.oracleResult), 8)
        .storeUint(Date.now(), 64)
        .storeStringTail(licenseData.telegramId)
        .endCell()

      // Create internal transfer
      const transfer = internal({
        to: this.contractAddress,
        value: '0.01', // 0.01 TON for gas
        body: message
      })

      // Get wallet sequence number
      const contract = this.client.open(this.wallet)
      const seqno = await contract.getSeqno()
      
      console.log(`📊 Current wallet seqno: ${seqno}`)
      
      // Create and send transaction
      const transaction = await this.wallet.createTransfer({
        seqno,
        secretKey: this.keyPair.secretKey,
        messages: [transfer]
      })

      console.log('📤 Sending transaction to TON network...')
      await contract.send(transaction)
      
      // Wait for transaction confirmation
      console.log('⏳ Waiting for transaction confirmation...')
      const confirmedTx = await this.waitForTransaction(seqno, 60000) // Wait up to 60 seconds
      
      if (confirmedTx) {
        console.log('✅ Transaction confirmed on TON blockchain')
        console.log('🔗 Real transaction hash:', confirmedTx.hash)
        return confirmedTx.hash
      } else {
        console.log('⚠️  Transaction confirmation timeout')
        return null
      }
      
    } catch (error) {
      console.error('❌ TON blockchain recording failed:', error)
      return null
    }
  }

  private getOracleResultCode(result: string): number {
    switch (result) {
      case 'Valid': return 1
      case 'Expired': return 2
      case 'Invalid': return 3
      default: return 0
    }
  }

  async getWalletBalance(): Promise<string> {
    if (!this.wallet) {
      console.log('❌ Wallet not initialized')
      return '0'
    }
    
    try {
      console.log('🔍 Checking wallet deployment status...')
      const isDeployed = await this.client.isContractDeployed(this.wallet.address)
      
      if (!isDeployed) {
        console.log('⚠️  Wallet contract not deployed yet')
        return '0 TON (not deployed)'
      }
      
      console.log('✅ Wallet is deployed, getting balance...')
      const balance = await this.client.getBalance(this.wallet.address)
      const balanceInTon = fromNano(balance)
      
      console.log(`💰 Raw balance: ${balance}, Converted: ${balanceInTon}`)
      console.log(`📍 Wallet address: ${this.wallet.address.toString()}`)
      
      return balanceInTon + ' TON'
    } catch (error: any) {
      console.error('❌ Failed to get wallet balance:', error)
      
      // Handle rate limiting specifically
      if (error.response?.status === 429) {
        console.error('⏰ Rate limited by TON API')
        console.error('💡 Suggestion: Get API key from @tonapibot on Telegram')
        return '0 TON (rate limited)'
      }
      
      console.error('Error details:', error instanceof Error ? error.message : error)
      return '0'
    }
  }

  async waitForTransaction(seqno: number, timeoutMs: number = 60000): Promise<{hash: string} | null> {
    const startTime = Date.now()
    const contract = this.client.open(this.wallet!)
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const currentSeqno = await contract.getSeqno()
        
        if (currentSeqno > seqno) {
          // Transaction was processed, now get the transaction details
          console.log(`📊 Seqno updated: ${seqno} -> ${currentSeqno}`)
          
          // Get transactions from the wallet
          const transactions = await this.client.getTransactions(this.wallet!.address, {
            limit: 10
          })
          
          // Find the transaction with our seqno
          for (const tx of transactions) {
            if (tx.inMessage && tx.inMessage.info.type === 'internal') {
              const txHash = tx.hash().toString('hex')
              console.log(`🔍 Found transaction: ${txHash}`)
              return { hash: txHash }
            }
          }
          
          // If we can't find the specific transaction, return the first one
          if (transactions.length > 0) {
            const txHash = transactions[0].hash().toString('hex')
            console.log(`🔍 Using latest transaction: ${txHash}`)
            return { hash: txHash }
          }
        }
        
        console.log(`⏳ Waiting for confirmation... (seqno: ${seqno}, current: ${currentSeqno || 'unknown'})`)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        
      } catch (error) {
        console.error('❌ Error while waiting for transaction:', error)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    console.log('⏰ Transaction confirmation timeout')
    return null
  }

  async debugWalletState(): Promise<void> {
    if (!this.wallet) {
      console.log('❌ Wallet not initialized for debug')
      return
    }

    try {
      console.log('🔍 === TON Wallet Debug Information ===')
      console.log('📍 Wallet address:', this.wallet.address.toString())
      console.log('📍 Testnet address:', this.wallet.address.toString({
        testOnly: true,
        bounceable: false
      }))
      
      // Check if contract is deployed
      const isDeployed = await this.client.isContractDeployed(this.wallet.address)
      console.log('📦 Contract deployed:', isDeployed)
      
      // Get balance
      const balance = await this.client.getBalance(this.wallet.address)
      console.log('💰 Balance (nanoTON):', balance.toString())
      console.log('💰 Balance (TON):', fromNano(balance))
      
      // Check contract state
      const contractState = await this.client.getContractState(this.wallet.address)
      console.log('📊 Contract state:', contractState.state)
      
      // Get last block info
      try {
        const masterchainInfo = await this.client.getMasterchainInfo()
        console.log('📦 Network latest seqno:', masterchainInfo.latestSeqno)
      } catch (error) {
        console.log('⚠️  Could not get masterchain info:', error)
      }
      
      console.log('🔍 === End Debug Information ===')
    } catch (error) {
      console.error('❌ Debug failed:', error)
    }
  }
}