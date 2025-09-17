import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import backendClient from '../api/backendClient'
import { debounce } from '../utils/debounce'

/**
 * Custom hook for managing state that automatically syncs with backend session storage
 * Provides transparent localStorage replacement with backend persistence
 *
 * @param {string} key - The session storage key
 * @param {any} defaultValue - Default value if no stored value exists
 * @param {Object} options - Configuration options
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 1000)
 * @param {boolean} options.autoLoad - Whether to auto-load from backend on mount (default: true)
 * @returns {Array} [value, setValue, setValueImmediate, isLoaded, error]
 *   - value: current state value
 *   - setValue: debounced setter (use for typing/continuous input)
 *   - setValueImmediate: immediate setter (use for deliberate actions)
 *   - isLoaded: whether initial data has been loaded
 *   - error: any loading/saving errors
 */
export const useSessionState = (key, defaultValue, options = {}) => {
  const {
    debounceMs = 1000,
    autoLoad = true
  } = options

  const [value, setValue] = useState(defaultValue)
  const [isLoaded, setIsLoaded] = useState(!autoLoad) // If autoLoad disabled, consider it loaded
  const [error, setError] = useState(null)
  const hasLoadedRef = useRef(false)

  // Load initial value from backend on mount
  useEffect(() => {
    if (!autoLoad || hasLoadedRef.current) return

    const loadInitialValue = async () => {
      try {
        setError(null)
        const response = await backendClient.getSessionData()

        if (response && response.success && response.data && key in response.data) {
          setValue(response.data[key])
        }
        // If key doesn't exist in session data, keep the defaultValue
      } catch (err) {
        // Only set error for non-authentication related errors
        if (err.message && !err.message.includes('401') && !err.message.includes('authentication')) {
          console.error(`Failed to load session data for ${key}:`, err)
          setError(`Failed to load ${key}: ${err.message}`)
        }
        // On 401 or auth errors, silently keep the defaultValue
      } finally {
        setIsLoaded(true)
        hasLoadedRef.current = true
      }
    }

    // Load data immediately since MainPage only renders after authentication
    loadInitialValue()
  }, [key, autoLoad])

  // Debounced save to backend
  const debouncedSave = useMemo(
    () => debounce(async (newValue) => {
      try {
        await backendClient.saveSessionData(key, newValue)
        setError(null) // Clear any previous save errors
      } catch (err) {
        console.error(`Failed to save session data for ${key}:`, err)
        setError(`Failed to save ${key}: ${err.message}`)
      }
    }, debounceMs),
    [key, debounceMs]
  )

  // Immediate save to backend (for deliberate actions)
  const immediateSave = useCallback(async (newValue) => {
    try {
      await backendClient.saveSessionData(key, newValue)
      setError(null) // Clear any previous save errors
    } catch (err) {
      console.error(`Failed to save session data for ${key}:`, err)
      setError(`Failed to save ${key}: ${err.message}`)
    }
  }, [key])

  const setValueWithSync = useCallback((newValue, immediate = false) => {
    setValue(prev => {
      // Handle function updates like useState does
      const actualValue = typeof newValue === 'function'
        ? newValue(prev)  // ✅ Use current value from setter
        : newValue

      // Only save to backend after initial load is complete
      // This prevents saving the defaultValue on mount
      if (hasLoadedRef.current) {
        if (immediate) {
          immediateSave(actualValue)
        } else {
          debouncedSave(actualValue)
        }
      }

      return actualValue
    })
  }, [debouncedSave, immediateSave])  // ✅ Remove 'value' dependency

  // Create an immediate setter function for convenience
  const setValueImmediate = useCallback((newValue) => {
    setValueWithSync(newValue, true)
  }, [setValueWithSync])

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      // Cancel any pending debounced saves
      if (debouncedSave.cancel) {
        debouncedSave.cancel()
      }
    }
  }, [debouncedSave])

  return [value, setValueWithSync, setValueImmediate, isLoaded, error]
}