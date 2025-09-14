import { useState, useEffect } from 'react'
import Header from './components/Header'
import MainPage from './components/MainPage'
import PassPhrase from './components/PassPhrase'
import backendClient from './api/backendClient'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState('')
  const [passphraseRequired, setPassphraseRequired] = useState(true)

  // Check authentication status on app load
  useEffect(() => {
    // Set up session expired callback
    backendClient.setSessionExpiredCallback(handleSessionExpired)
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const data = await backendClient.checkAuthStatus()

      if (data) {
        setPassphraseRequired(data.passphrase_required)

        if (data.authenticated) {
          setIsAuthenticated(true)
          setAuthError('')
        } else {
          setIsAuthenticated(false)

          // If passphrase is not required, try to authenticate automatically
          if (!data.passphrase_required) {
            try {
              const authData = await backendClient.authenticate()
              if (authData) {
                setIsAuthenticated(true)
                setAuthError('')
              }
            } catch (error) {
              console.error('Auto-authentication failed:', error)
              setAuthError('Auto-authentication failed')
            }
          }
        }
      } else {
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setIsAuthenticated(false)
      setAuthError('Failed to connect to server')
    } finally {
      setIsCheckingAuth(false)
    }
  }

  const handleAuthSuccess = (data) => {
    setIsAuthenticated(true)
    setAuthError('')
  }

  const handleSessionExpired = (message) => {
    setIsAuthenticated(false)
    setAuthError(message || 'Session expired. Please log in again.')
  }

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="app">
        <Header />
        <div className="loading-container">
          <p>Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Header />
      {isAuthenticated ? (
        <MainPage onSessionExpired={handleSessionExpired} />
      ) : passphraseRequired ? (
        <PassPhrase
          onAuthSuccess={handleAuthSuccess}
          authError={authError}
        />
      ) : (
        <div className="loading-container">
          <p>Connecting...</p>
        </div>
      )}
    </div>
  )
}

export default App
