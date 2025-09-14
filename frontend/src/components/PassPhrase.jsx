import { useState } from 'react'
import backendClient from '../api/backendClient'

function PassPhrase({ onAuthSuccess, authError }) {
    const [passphrase, setPassphrase] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(authError || '')

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!passphrase.trim()) {
            setError('Please enter a passphrase')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const data = await backendClient.authenticate(passphrase)

            if (data) {
                // Clear the form
                setPassphrase('')
                // Notify parent component of successful authentication
                if (onAuthSuccess) {
                    onAuthSuccess(data)
                }
            }
        } catch (error) {
            setError(error.message || 'Network error. Please check if the backend is running.')
        }

        setIsLoading(false)
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !isLoading) {
            handleSubmit(e)
        }
    }

    return (
        <div className="passphrase-container">
            {(error) && (
                <div className="alert error">
                    {error}
                </div>
            )}
            <form onSubmit={handleSubmit} className="pane passphrase-pane control-group">
                <label>Passphrase:</label>
                <input
                    type="password"
                    className="input"
                    placeholder="Enter your passphrase"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    onKeyUp={handleKeyPress}
                    disabled={isLoading}
                    autoFocus
                />
                <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={isLoading || !passphrase.trim()}
                >
                    {isLoading ? 'Authenticating...' : 'Submit'}
                </button>
            </form>
        </div>
    )
}

export default PassPhrase
