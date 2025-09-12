import { useState } from 'react'

function PassPhrase({ onAuthSuccess }) {
    const [passphrase, setPassphrase] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!passphrase.trim()) {
            setError('Please enter a passphrase')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            const response = await fetch('http://localhost:8000/api/session/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: includes cookies
                body: JSON.stringify({
                    passphrase: passphrase
                })
            })

            if (response.ok) {
                const data = await response.json()
                // Clear the form
                setPassphrase('')
                // Notify parent component of successful authentication
                if (onAuthSuccess) {
                    onAuthSuccess(data)
                }
            } else {
                const errorData = await response.json()
                setError(errorData.detail || 'Authentication failed')
            }
        } catch (error) {
            setError('Network error. Please check if the backend is running.')
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
            <form onSubmit={handleSubmit} className="pane passphrase-pane control-group">
                <label>Passphrase:</label>
                {error && (
                    <div className="alert error">
                        {error}
                    </div>
                )}
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
