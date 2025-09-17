/**
 * Simple debounce utility function
 * Delays function execution until after a specified period of inactivity
 *
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function with cancel method
 */
export const debounce = (func, delay) => {
  let timeoutId

  const debouncedFunction = function (...args) {
    // Clear the previous timer if it exists
    clearTimeout(timeoutId)

    // Set a new timer
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }

  // Add cancel method for cleanup
  debouncedFunction.cancel = () => {
    clearTimeout(timeoutId)
  }

  return debouncedFunction
}