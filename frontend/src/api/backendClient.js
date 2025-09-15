/**
 * Backend API Client for Orquestulator
 * Handles all communication with the backend API
 */

class BackendClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_BACKEND_URL
    this.onSessionExpired = null
  }

  /**
   * Set callback for session expiration handling
   */
  setSessionExpiredCallback(callback) {
    this.onSessionExpired = callback
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
        body: JSON.stringify({ [key]: value })
      })

      if (response && !response.ok) {
        console.warn('Failed to save session data:', response.statusText)
      }
    } catch (error) {
      console.warn('Failed to save session data:', error)
    }
  }

  async getSessionCount() {
    const response = await this.makeRequest('/api/session/count')
    
    if (!response) return null
    
    if (response.ok) {
      return await response.json()
    } else {
      throw new Error('Failed to get session count')
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
  async fetchStackStormExecution(executionId, st2Url, apiKey) {
    const response = await this.makeRequest(`/api/stackstorm/execution/${executionId}`, {
      method: 'POST',
      body: JSON.stringify({
        url: st2Url,
        api_key: apiKey || null
      })
    })

    if (!response) return null

    if (response.ok) {
      return await response.json()
    } else {
      // Handle HTTP error responses from the backend
      try {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Backend Error (${response.status})`)
      } catch {
        const errorText = await response.text()
        throw new Error(`Backend Error (${response.status}): ${errorText}`)
      }
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
