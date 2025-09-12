import { useState, useEffect } from 'react'
import Header from './components/Header'
import MainPage from './components/MainPage'
import PassPhrase from './components/PassPhrase'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState('')

  // Check authentication status on app load
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/session/status', {
        method: 'GET',
        credentials: 'include', // Include cookies
      })

      if (response.ok) {
        const data = await response.json()
        if (data.authenticated) {
          setIsAuthenticated(true)
          setAuthError('')
        } else {
          setIsAuthenticated(false)
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
      ) : (
        <PassPhrase onAuthSuccess={handleAuthSuccess} authError={authError} />
      )}
    </div>
  )
}

export default App
