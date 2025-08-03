import { Agent } from '@openserv-labs/sdk'
import { AgentConfig } from '../types'

export class AgentManager {
  private agent: Agent<any>
  private currentAgentId: number
  private workspaceId: number
  private cachedAgents: AgentConfig[] = []
  private lastCacheTime: number = 0
  private cacheTimeout: number = 5 * 60 * 1000 // 5 minutes

  constructor(agent: Agent<any>, workspaceId: number, defaultAgentId: number) {
    this.agent = agent
    this.workspaceId = workspaceId
    this.currentAgentId = defaultAgentId
  }

  getCurrentAgentId(): number {
    return this.currentAgentId
  }

  setCurrentAgentId(agentId: number): void {
    this.currentAgentId = agentId
  }

  async getAgentName(agentId: number): Promise<string> {
    const agents = await this.getAvailableAgents()
    const agent = agents.find(a => a.id === agentId)
    return agent ? agent.name : `Agent ${agentId}`
  }

  async getAvailableAgents(): Promise<AgentConfig[]> {
    // Check if cache is still valid
    const now = Date.now()
    if (this.cachedAgents.length > 0 && (now - this.lastCacheTime) < this.cacheTimeout) {
      return this.cachedAgents
    }

    try {
      console.log('🔍 Fetching agents from workspace...')
      const response = await this.agent.getAgents({
        workspaceId: this.workspaceId
      })

      console.log('📋 Raw agents response:', JSON.stringify(response, null, 2))

      // Parse the response and convert to our AgentConfig format
      if (response && (response as any).agents) {
        this.cachedAgents = (response as any).agents.map((agent: any) => ({
          id: agent.id,
          name: agent.name || `Agent ${agent.id}`,
          description: agent.description || agent.capabilitiesDescription || 'No description available'
        }))
      } else if (Array.isArray(response)) {
        this.cachedAgents = response.map((agent: any) => ({
          id: agent.id,
          name: agent.name || `Agent ${agent.id}`,
          description: agent.description || agent.capabilitiesDescription || 'No description available'
        }))
      } else {
        console.log('⚠️  Unexpected response format, using fallback agents')
        this.cachedAgents = [
          { id: 1, name: 'Project Manager', description: 'Manages projects and coordinates tasks' },
          { id: 2, name: 'Research Assistant', description: 'Conducts research and provides detailed information' },
          { id: 3, name: 'General Assistant', description: 'Provides general help and support' }
        ]
      }

      this.lastCacheTime = now
      console.log(`✅ Found ${this.cachedAgents.length} agents:`, this.cachedAgents.map(a => `${a.name} (ID: ${a.id})`))
      
      return this.cachedAgents
    } catch (error) {
      console.error('❌ Failed to fetch agents from workspace:', error)
      
      // Return fallback agents if API call fails
      if (this.cachedAgents.length === 0) {
        console.log('🔄 Using fallback agents')
        this.cachedAgents = [
          { id: 1, name: 'Project Manager', description: 'Manages projects and coordinates tasks' },
          { id: 2, name: 'Research Assistant', description: 'Conducts research and provides detailed information' },
          { id: 3, name: 'General Assistant', description: 'Provides general help and support' }
        ]
      }
      
      return this.cachedAgents
    }
  }

  // Force refresh the agent cache
  async refreshAgents(): Promise<AgentConfig[]> {
    this.lastCacheTime = 0 // Invalidate cache
    return await this.getAvailableAgents()
  }

  async sendChatMessage(workspaceId: number, agentId: number, message: string): Promise<any> {
    console.log(`\n🌐 ===== OPENSERV API REQUEST =====`)
    console.log(`📤 API: sendChatMessage`)
    console.log(`🏢 Workspace ID: ${workspaceId}`)
    console.log(`🤖 Agent ID: ${agentId}`)
    console.log(`💬 Message: "${message}"`)
    console.log(`⏰ Request Time: ${new Date().toISOString()}`)
    console.log(`==================================\n`)
    
    try {
      const response = await this.agent.sendChatMessage({
        workspaceId,
        agentId,
        message
      })
      
      console.log(`\n📥 ===== OPENSERV API RESPONSE =====`)
      console.log(`✅ API: sendChatMessage`)
      console.log(`📊 Response Type: ${typeof response}`)
      console.log(`📋 Response Keys: ${response ? Object.keys(response).join(', ') : 'null'}`)
      console.log(`🔍 Full Response:`)
      console.log(JSON.stringify(response, null, 2))
      console.log(`⏰ Response Time: ${new Date().toISOString()}`)
      console.log(`===================================\n`)
      
      return response
    } catch (error) {
      console.log(`\n❌ ===== OPENSERV API ERROR =====`)
      console.log(`🚫 API: sendChatMessage`)
      console.log(`⚠️ Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`)
      console.log(`📝 Error Message: ${error instanceof Error ? error.message : String(error)}`)
      console.log(`🔍 Full Error:`)
      console.log(error)
      console.log(`⏰ Error Time: ${new Date().toISOString()}`)
      console.log(`=================================\n`)
      throw error
    }
  }

  async getChatMessages(workspaceId: number, agentId: number): Promise<any> {
    console.log(`\n🌐 ===== OPENSERV API REQUEST =====`)
    console.log(`📤 API: getChatMessages`)
    console.log(`🏢 Workspace ID: ${workspaceId}`)
    console.log(`🤖 Agent ID: ${agentId}`)
    console.log(`⏰ Request Time: ${new Date().toISOString()}`)
    console.log(`==================================\n`)
    
    try {
      const response = await this.agent.getChatMessages({
        workspaceId,
        agentId
      })
      
      console.log(`\n📥 ===== OPENSERV API RESPONSE =====`)
      console.log(`✅ API: getChatMessages`)
      console.log(`📊 Response Type: ${typeof response}`)
      console.log(`📋 Response Keys: ${response ? Object.keys(response).join(', ') : 'null'}`)
      console.log(`💬 Messages Count: ${response?.messages?.length || 0}`)
      console.log(`🔍 Latest Messages (last 3):`)
      if (response?.messages?.length > 0) {
        const latestMessages = response.messages.slice(-3)
        latestMessages.forEach((msg: any, index: number) => {
          console.log(`  ${index + 1}. [${msg.author}] ${new Date(msg.createdAt).toISOString()}: ${msg.message?.substring(0, 100)}...`)
        })
      }
      console.log(`⏰ Response Time: ${new Date().toISOString()}`)
      console.log(`===================================\n`)
      
      return response
    } catch (error) {
      console.log(`\n❌ ===== OPENSERV API ERROR =====`)
      console.log(`🚫 API: getChatMessages`)
      console.log(`⚠️ Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`)
      console.log(`📝 Error Message: ${error instanceof Error ? error.message : String(error)}`)
      console.log(`🔍 Full Error:`)
      console.log(error)
      console.log(`⏰ Error Time: ${new Date().toISOString()}`)
      console.log(`=================================\n`)
      throw error
    }
  }

  async getAgentResponse(workspaceId: number, agentId: number, _originalQuestion: string, timeoutMs: number = 120000): Promise<string | null> {
    const startTime = Date.now()
    const pollInterval = 5000 // Check every 5 seconds
    let attemptCount = 0
    
    console.log(`🔍 Starting to poll for agent response (timeout: ${timeoutMs}ms)`)
    
    while (Date.now() - startTime < timeoutMs) {
      attemptCount++
      console.log(`📡 Polling attempt ${attemptCount}...`)
      
      try {
        const chatMessages = await this.getChatMessages(workspaceId, agentId)
        
        console.log(`📬 Retrieved ${chatMessages?.messages?.length || 0} total messages`)
        
        if (chatMessages?.messages?.length > 0) {
          // Look for agent messages created after we started polling
          const recentAgentMessages = chatMessages.messages.filter((msg: any) => {
            const messageTime = new Date(msg.createdAt).getTime()
            const isAgent = msg.author === 'agent'
            const isRecent = messageTime > startTime - 30000 // Allow 30s buffer for agent response time
            
            console.log(`🔍 Message: ${msg.message?.substring(0, 50)}... | Author: ${msg.author} | Time: ${new Date(msg.createdAt).toISOString()} | StartTime: ${new Date(startTime).toISOString()} | IsRecent: ${isRecent}`)
            
            return isAgent && isRecent
          })
          
          // Also check for very recent messages (last 5 minutes) as fallback
          if (recentAgentMessages.length === 0) {
            const fallbackMessages = chatMessages.messages.filter((msg: any) => {
              const messageTime = new Date(msg.createdAt).getTime()
              const isAgent = msg.author === 'agent'
              const isVeryRecent = messageTime > Date.now() - 300000 // Last 5 minutes
              return isAgent && isVeryRecent
            })
            
            if (fallbackMessages.length > 0) {
              console.log(`🔄 No polling-time messages found, using latest from last 5 minutes`)
              const latestFallback = fallbackMessages[fallbackMessages.length - 1]
              console.log(`✅ Fallback response: "${latestFallback.message.substring(0, 100)}..."`)
              return latestFallback.message
            }
          }
          
          console.log(`🤖 Found ${recentAgentMessages.length} recent agent messages`)
          
          if (recentAgentMessages.length > 0) {
            const latestResponse = recentAgentMessages[recentAgentMessages.length - 1]
            console.log(`✅ Got agent response: "${latestResponse.message.substring(0, 100)}..."`)
            return latestResponse.message
          }
        }
        
        console.log(`⏳ No response yet, waiting ${pollInterval}ms before next attempt...`)
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
      } catch (error) {
        console.error(`❌ Error during polling attempt ${attemptCount}:`, error)
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }
    
    console.log(`⏰ Timeout reached after ${attemptCount} attempts`)
    return null // Timeout reached
  }
}