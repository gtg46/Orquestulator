/**
 * Backend API Client for Orquestulator
 * Handles all communication with the backend API
 */

class BackendClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_BACKEND_URL
    this.onSessionExpired = null
    this.sessionCheckInterval = null
    this.isCheckingSession = false
  }

  /**
   * Set callback for session expiration handling
   */
  setSessionExpiredCallback(callback) {
    this.onSessionExpired = callback
  }

  /**
   * Start periodic session validation
   */
  startSessionHeartbeat(intervalMs = 60000) { // Check every minute by default
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval)
    }

    this.sessionCheckInterval = setInterval(async () => {
      if (this.isCheckingSession) return // Prevent overlapping checks

      this.isCheckingSession = true
      try {
        await this.checkAuthStatus()
      } catch (error) {
        // Session check failed - this will trigger the session expired callback
        console.debug('Session heartbeat check failed:', error.message)
      } finally {
        this.isCheckingSession = false
      }
    }, intervalMs)
  }

  /**
   * Stop periodic session validation
   */
  stopSessionHeartbeat() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval)
      this.sessionCheckInterval = null
    }
  }

  /**
   * Clear all session-related data (for session expiration)
   */
  clearSessionState() {
    // This will be called when session expires
    // Individual useSessionState hooks should handle their own cleanup
    console.debug('Session state cleared due to expiration')
  }

  /**
   * Make an authenticated request to the backend
   */
  async makeRequest(endpoint, options = {}) {
    const defaultOptions = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      ...options
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, defaultOptions)

      // Handle session timeout
      if (response.status === 401) {
        if (this.onSessionExpired) {
          this.onSessionExpired('Your session has expired.')
        }
        return null
      }

      return response
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  /**
   * Session Management
   */
  async authenticate(passphrase = null) {
    const body = passphrase ? { passphrase } : {}
    const response = await this.makeRequest('/api/session/auth', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Authentication failed')
    }
  }

  async checkAuthStatus() {
    const response = await this.makeRequest('/api/session/status')

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      throw new Error('Failed to check authentication status')
    }
  }

  async saveSessionData(key, value) {
    try {
      const response = await this.makeRequest('/api/session/data', {
        method: 'POST',
        body: JSON.stringify({
          data: { [key]: value }
        })
      })

      if (response && !response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to save session data')
      }
    } catch (error) {
      // Re-throw with consistent error format
      throw new Error(`Session save failed: ${error.message}`)
    }
  }

  async getSessionData() {
    const response = await this.makeRequest('/api/session/data')

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      throw new Error('Failed to get session data')
    }
  }

  /**
   * Expression Evaluation
   */
  async evaluateExpression(queryType, expression, data) {
    const response = await this.makeRequest(`/api/evaluate/${queryType}`, {
      method: 'POST',
      body: JSON.stringify({
        expression,
        data
      })
    })

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      const errorMessage = errorData.detail?.error || errorData.detail || 'Unknown error'
      throw new Error(errorMessage)
    }
  }

  /**
   * StackStorm Integration
   */

  /**
   * Get available StackStorm connections and current configuration
   * @returns {Promise<Object>} ConnectionResponse with connections, default, current, and custom_connection
   */
  async getStackStormConnections() {
    const response = await this.makeRequest('/api/stackstorm/connection')

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to get StackStorm connections')
    }
  }

  /**
   * Set the user's StackStorm connection configuration
   * @param {string} connectionId - Connection ID or "custom" for custom connection
   * @param {Object} customConnection - Custom connection object with {url, api_key?}
   * @returns {Promise<Object>} ConnectionUpdateResponse with success and message
   */
  async setStackStormConnection(connectionId, customConnection = null) {
    const body = {
      current: connectionId
    }

    // Validate custom connection format according to CustomConnection schema
    if (customConnection) {
      if (!customConnection.url) {
        throw new Error('Custom connection must have a url property')
      }
      body.custom_connection = {
        url: customConnection.url,
        api_key: customConnection.api_key || null
      }
    }

    const response = await this.makeRequest('/api/stackstorm/connection', {
      method: 'PUT',
      body: JSON.stringify(body)
    })

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to set StackStorm connection')
    }
  }

  /**
   * Test the current StackStorm connection configuration
   * @returns {Promise<Object>} ConnectionTestResponse with success and message
   */
  async testStackStormConnection() {
    const response = await this.makeRequest('/api/stackstorm/connection/test', {
      method: 'POST'
    })

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to test StackStorm connection')
    }
  }

  /**
   * Get a list of recent StackStorm executions from the configured connection
   * @returns {Promise<Object>} ExecutionsListResponse with executions array
   */
  async getStackStormExecutions() {
    const response = await this.makeRequest('/api/stackstorm/executions')

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to get StackStorm executions')
    }
  }

  /**
   * Get specific StackStorm execution data using the configured connection
   * @param {string} executionId - The execution ID to fetch
   * @returns {Promise<Object>} ExecutionResponse with execution_data and message
   */
  async getStackStormExecution(executionId) {
    const response = await this.makeRequest(`/api/stackstorm/executions/${executionId}`)

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      const errorData = await response.json()
      throw new Error(errorData.detail || 'Failed to get StackStorm execution')
    }
  }

  /**
   * Error handling helpers
   */
  formatNetworkError(error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return `Connection Error: Could not connect to backend at ${this.baseURL}.
        • Check that the backend is running
        • Ensure the backend is accessible on the configured port`
    } else if (error.name === 'AbortError') {
      return 'Request timed out. The backend server may be slow to respond.'
    } else {
      return `Network Error: ${error.message}`
    }
  }
}

// Create a singleton instance
const backendClient = new BackendClient()

export default backendClient
