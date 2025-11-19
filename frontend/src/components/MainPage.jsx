import { useState, useEffect } from 'react'
import * as yaml from 'js-yaml'
import backendClient from '../api/backendClient'
import OrquestulatorEditor from './OrquestulatorEditor'
import { useSessionState } from '../hooks/useSessionState'

function MainPage() {

    const [dataFormat, _setDataFormat, setDataFormatImmediate] = useSessionState('orquestulator_data_format', 'yaml')
    const [queryType, _setQueryType, setQueryTypeImmediate] = useSessionState('orquestulator_query_type', 'orquesta')
    const [query, setQuery, setQueryImmediate] = useSessionState('orquestulator_query', '')
    const [contextData, setContextData, setContextDataImmediate] = useSessionState('orquestulator_context_data', '')
    const [evaluation, _setEvaluation, setEvaluationImmediate] = useSessionState('orquestulator_evaluation', '')
    const [evaluationStatus, setEvaluationStatus] = useState('') // 'success', 'error', 'loading' or ''
    const [isLoading, setIsLoading] = useState(false)

    // Orquesta-specific settings
    const [taskStatusOverride, setTaskStatus] = useState('succeeded') // 'succeeded' or 'failed'
    const [resultData, setResultData, setResultDataImmediate] = useSessionState('orquestulator_result_data', '')

    // StackStorm-specific states - now persisted
    const [st2ExecutionId, setSt2ExecutionId, _setSt2ExecutionIdImmediate] = useSessionState('st2_execution_id', '')
    const [st2Loading, setSt2Loading] = useState(false)

    // StackStorm connection state - now persisted
    const [st2AvailableConnections, setSt2AvailableConnections] = useState([])
    const [st2CurrentConnection, _setSt2CurrentConnection, setSt2CurrentConnectionImmediate] = useSessionState('st2_current_connection', null)

    // StackStorm connection status for status indicator
    const [st2ConnectionStatus, setSt2ConnectionStatus] = useState('') // 'success', 'error', 'loading' or ''

    // StackStorm alert for error messages
    const [st2Alert, setSt2Alert] = useState('') // Error message for StackStorm panel

    // Custom connection form (now persisted)
    const [st2CustomUrl, setSt2CustomUrl, setSt2CustomUrlImmediate] = useSessionState('st2_custom_url', '')
    const [st2CustomApiKey, setSt2CustomApiKey, setSt2CustomApiKeyImmediate] = useSessionState('st2_custom_api_key', '')

    // Load StackStorm connections and current session state
    const loadStackStormConnections = async () => {
        setSt2ConnectionStatus('loading')

        try {
            const connectionData = await backendClient.getStackStormConnections()
            if (connectionData) {
                setSt2AvailableConnections(connectionData.connections || [])

                // Only update connection if not already set in session state
                if (!st2CurrentConnection) {
                    setSt2CurrentConnectionImmediate(connectionData.current || connectionData.default)
                }

                // Reset status when loading connections - don't assume connection works
                setSt2ConnectionStatus('')

                // If current connection is custom and we don't have URL set, populate from backend
                if (connectionData.current === 'custom' && connectionData.custom_connection) {
                    if (!st2CustomUrl) {
                        setSt2CustomUrlImmediate(connectionData.custom_connection.url || '')
                    }
                    if (!st2CustomApiKey) {
                        setSt2CustomApiKeyImmediate(connectionData.custom_connection.api_key || '')
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load StackStorm connections:', error)
            setSt2ConnectionStatus('error')
        }
    }

    // Load cached values on component mount
    useEffect(() => {
        // Session state variables now load automatically via useSessionState hook
        // Only need to load StackStorm connections from backend session
        loadStackStormConnections()
    }, [])

    // Handle StackStorm connection selection change
    const handleConnectionChange = async (connectionId) => {
        // Clear any previous alert when changing connections
        setSt2Alert('')

        // For non-custom connections, update immediately
        if (connectionId !== 'custom') {
            setSt2CurrentConnectionImmediate(connectionId)
            setSt2ConnectionStatus('loading')

            try {
                await backendClient.setStackStormConnection(connectionId, null)
                setSt2ConnectionStatus('') // Reset to ready state, not "success"
            } catch (error) {
                console.error('Failed to update StackStorm connection:', error)
                setSt2ConnectionStatus('error')
                setSt2Alert(`Failed to update connection: ${error.message}`)
                await loadStackStormConnections()
            }
        } else {
            // For custom connections, just update the UI state - don't submit yet
            setSt2CurrentConnectionImmediate(connectionId)
            setSt2ConnectionStatus('') // Reset status for custom until they set it
        }
    }

    // Helper function to ensure connection is set before StackStorm operations
    const ensureStackStormConnectionSet = async () => {
        if (!st2CurrentConnection) {
            setSt2Alert('Please select a connection first')
            return false
        }

        // For custom connections, ensure the connection is set first
        if (st2CurrentConnection === 'custom') {
            if (!st2CustomUrl.trim()) {
                setSt2Alert('StackStorm URL is required for custom connection')
                return false
            }
            try {
                // Update the backend session with current custom connection values
                await backendClient.setStackStormConnection('custom', {
                    url: st2CustomUrl.trim(),
                    api_key: st2CustomApiKey.trim() || null
                })
                return true
            } catch (error) {
                setSt2Alert(`Failed to update custom connection: ${error.message}`)
                return false
            }
        }

        return true // Non-custom connections are already set
    }

    // Handle testing the current StackStorm connection
    const handleTestConnection = async () => {
        // Clear any previous alert
        setSt2Alert('')

        // Ensure connection is set before testing
        const connectionReady = await ensureStackStormConnectionSet()
        if (!connectionReady) {
            return
        }

        setSt2ConnectionStatus('loading')

        try {
            const testResult = await backendClient.testStackStormConnection()

            if (testResult && testResult.success) {
                setSt2ConnectionStatus('success')
                // Don't set an alert for successful connection test - let the status indicator show success
            } else {
                setSt2ConnectionStatus('error')
                setSt2Alert(`Connection test failed: ${testResult?.message || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Failed to test StackStorm connection:', error)
            setSt2ConnectionStatus('error')
            setSt2Alert(`Connection test failed: ${error.message}`)
        }
    }

    // Handle fetching the latest execution ID
    const handleGetLatestExecution = async () => {
        // Clear any previous alert
        setSt2Alert('')

        // Ensure connection is set before fetching executions
        const connectionReady = await ensureStackStormConnectionSet()
        if (!connectionReady) {
            return
        }

        setSt2Loading(true)

        try {
            const executionsResult = await backendClient.getStackStormExecutions()

            if (executionsResult && executionsResult.executions && executionsResult.executions.length > 0) {
                // Get the most recent execution (should be first in the list)
                const latestExecution = executionsResult.executions[0]
                setSt2ExecutionId(latestExecution.id)
                setSt2ConnectionStatus('success') // Set status to success, no alert needed
            } else {
                setSt2ConnectionStatus('error')
                setSt2Alert('No executions found')
            }
        } catch (error) {
            console.error('Failed to get latest execution:', error)
            setSt2ConnectionStatus('error')
            setSt2Alert(`Failed to get latest execution: ${error.message}`)
        } finally {
            setSt2Loading(false)
        }
    }

    const validateAndParseData = (dataText) => {
        if (!dataText.trim()) {
            throw new Error('Cannot parse empty data')
        }

        try {
            // Try to parse with yaml.load (which is safe by default in js-yaml v4+)
            return yaml.load(dataText)
        } catch (error) {
            // Provide more specific error messages
            if (dataText.trim().startsWith('{') || dataText.trim().startsWith('[')) {
                throw new Error(`Invalid JSON: ${error.message}`)
            } else {
                throw new Error(`Invalid YAML: ${error.message}`)
            }
        }
    }

    const formatData = (data, format) => {
        if (format === 'json') {
            return JSON.stringify(data, null, 2)
        } else {
            // For YAML format, handle primitives as strings to avoid YAML formatting quirks
            if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
                return String(data)
            }
            return yaml.dump(data, { indent: 2 })
        }
    }

    const handleDataFormatting = (newFormat) => {
        if (contextData.trim()) {
            try {
                // Parse the data as YAML (works for both JSON and YAML input)
                // Use the validation function for better error handling
                const parsedData = validateAndParseData(contextData)

                // Batch state updates to avoid multiple re-renders
                const formattedData = formatData(parsedData, newFormat)

                setContextDataImmediate(formattedData)
            } catch (error) {
                // TODO: Show error in evaluation
                console.error('Data conversion error:', error)
            }
        }

        // Also convert task result if it exists
        if (resultData.trim()) {
            try {
                const parsedData = validateAndParseData(resultData)

                const formattedData = formatData(parsedData, newFormat)

                setResultDataImmediate(formattedData)
            } catch (error) {
                // TODO: Show error in evaluation
                console.error('Result conversion error:', error)
            }
        }

        // Also convert evaluation result if it exists
        if (evaluation.trim()) {
            try {
                const parsedData = validateAndParseData(evaluation)
                const formattedData = formatData(parsedData, newFormat)
                setEvaluationImmediate(formattedData)
            } catch (error) {
                // Don't reformat evaluation if it's not valid structured data (e.g., error messages, plain text)
                console.warn('Evaluation data not reformattable - likely a plain text message:', error.message)
                // Keep the evaluation as-is if it can't be parsed as structured data
            }
        }

        setDataFormatImmediate(newFormat)
    }

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text)
            // Could add toast notification here for better UX
            return { success: true }
        } catch (err) {
            console.error('Failed to copy to clipboard:', err)
            return { success: false, error: err }
        }
    }

    const evaluateExpression = async () => {
        // Input validation
        if (!query.trim()) {
            const errorMsg = 'Error: Query cannot be empty'
            setEvaluationImmediate(errorMsg)
            setEvaluationStatus('error')
            return
        }

        let parsedContextData = {}
        if (contextData.trim()) {
            try {
                parsedContextData = validateAndParseData(contextData)
            } catch (e) {
                const errorMsg = `${queryType === 'orquesta' ? 'Context' : 'Data'} Parse Error: ${e.message}`
                setEvaluationImmediate(errorMsg)
                setEvaluationStatus('error')
                return
            }
        }

        // Add validation to prevent arrays at the top level
        if (Array.isArray(parsedContextData)) {
            const errorMsg = `${queryType === 'orquesta' ? 'Context' : 'Data'} Error: Arrays are not supported at the top level. Please wrap your array in an object, e.g., {"items": [...]}`
            setEvaluationImmediate(errorMsg)
            setEvaluationStatus('error')
            return
        }

        let parsedResultData = {}
        if (queryType === 'orquesta' && resultData) {
            try {
                parsedResultData = validateAndParseData(resultData)
            } catch (e) {
                const errorMsg = `Task Result Parse Error: ${e.message}`
                setEvaluationImmediate(errorMsg)
                setEvaluationStatus('error')
                return
            }
        }

        setIsLoading(true)
        setEvaluationStatus('')

        try {
            const responseData = await backendClient.evaluateExpression(
                queryType,
                query,
                queryType === 'orquesta'
                    ? {
                        ...parsedContextData,
                        __task_status: taskStatusOverride,
                        __task_result: parsedResultData
                    }
                    : parsedContextData
            )

            if (responseData) {
                // Format result according to current dataFormat
                try {
                    const formattedResult = formatData(responseData.result, dataFormat)
                    setEvaluationImmediate(formattedResult)
                    setEvaluationStatus('success')
                } catch (formatError) {
                    console.error('Format error:', formatError)
                    // Fallback: display the raw result
                    const fallbackResult = String(responseData.result)
                    setEvaluationImmediate(fallbackResult)
                    setEvaluationStatus('success')
                }
            } else {
                console.error('No response data received')
                setEvaluationImmediate('Error: No response data received')
                setEvaluationStatus('error')
            }
        } catch (error) {
            const errorMessage = `Error: ${error.message}`
            setEvaluationImmediate(errorMessage)
            setEvaluationStatus('error')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchStackStormResult = async () => {
        // Clear any previous alert
        setSt2Alert('')

        if (!st2ExecutionId) {
            setSt2Alert('Please provide an execution ID')
            return
        }

        // Ensure connection is set before fetching execution data
        const connectionReady = await ensureStackStormConnectionSet()
        if (!connectionReady) {
            return
        }

        setSt2Loading(true)
        try {
            const responseData = await backendClient.getStackStormExecution(st2ExecutionId)

            if (responseData) {
                const executionData = responseData.execution_data

                // Validate that we received execution data
                if (!executionData || !executionData.id) {
                    setSt2Alert('Invalid execution data received from StackStorm')
                    setSt2Loading(false)
                    return
                }

                // Extract the result data from the execution for display
                const resultData = executionData.result || {}
                
                // Set the result data to the task result field instead of context field
                // Format the data according to the current task result format
                const formattedData = formatData(resultData, dataFormat)
                setResultDataImmediate(formattedData)
                setSt2ConnectionStatus('success')
            }
        } catch (error) {
            const errorMessage = backendClient.formatNetworkError(error)
            setSt2Alert(errorMessage)
        } finally {
            setSt2Loading(false)
        }
    }

    return (
        <>
            <div className={`panes-container ${queryType === 'orquesta' ? 'orquesta-mode' : 'compact-mode'}`}>
                {/* Query Pane - Full Width at Top */}
                <div className="pane wide-pane">
                    <div className="pane-header">
                        <h3>
                            <span className="pane-icon">Q</span>
                            query
                        </h3>
                        <div className="pane-actions">
                            <div className="btn-group">
                                <button
                                    onClick={() => {
                                        setQueryTypeImmediate('orquesta')
                                    }}
                                    className={`btn btn--secondary${queryType === 'orquesta' ? ' active' : ''}`}
                                >
                                    orquesta
                                </button>
                                <button
                                    onClick={() => {
                                        setQueryTypeImmediate('yaql')
                                    }}
                                    className={`btn btn--secondary${queryType === 'yaql' ? ' active' : ''}`}
                                >
                                    yaql
                                </button>
                                <button
                                    onClick={() => {
                                        setQueryTypeImmediate('jinja2')
                                    }}
                                    className={`btn btn--secondary${queryType === 'jinja2' ? ' active' : ''}`}
                                >
                                    jinja2
                                </button>
                            </div>
                            <div className="btn-group">
                                <button
                                    className={`btn btn--secondary${dataFormat === 'yaml' ? ' active' : ''}`}
                                    onClick={() => handleDataFormatting('yaml')}
                                >
                                    yaml
                                </button>
                                <button
                                    className={`btn btn--secondary${dataFormat === 'json' ? ' active' : ''}`}
                                    onClick={() => handleDataFormatting('json')}
                                >
                                    json
                                </button>
                            </div>
                            <button
                                className="btn btn--secondary"
                                onClick={() => {
                                    setQueryImmediate('')
                                }}
                                title="Clear Query"
                                disabled={!query}
                            >
                                clear
                            </button>
                            <button
                                className="btn btn--secondary"
                                onClick={() => copyToClipboard(query)}
                                title="Copy Query"
                                disabled={!query}
                            >
                                copy
                            </button>
                        </div>
                    </div>
                    <OrquestulatorEditor
                        height="80px"
                        language='plaintext'
                        value={query}
                        onChange={(value) => {
                            const newQuery = value || ''
                            setQuery(newQuery)
                        }}
                        options={{
                            placeholder: `${queryType === "orquesta" ? "<% ctx() %>" : "Enter your query here..."}`
                        }}
                    />
                </div>

                {/* Data Pane - Left Side */}
                <div className="pane">
                    <div className="pane-header">
                        <h3>
                            <span className="pane-icon">{queryType === 'orquesta' ? 'C' : 'D'}</span>
                            {queryType === 'orquesta' ? 'Context' : 'Data'}
                        </h3>
                        <div className="pane-actions">
                            <button
                                className="btn btn--secondary"
                                onClick={() => {
                                    setContextDataImmediate('')
                                }}
                                title={queryType === 'orquesta' ? "Clear context" : "Clear data"}
                                disabled={!contextData}
                            >
                                clear
                            </button>
                            <button
                                className="btn btn--secondary"
                                onClick={() => copyToClipboard(contextData)}
                                title={queryType === 'orquesta' ? "Copy context" : "Copy data"}
                                disabled={!contextData}
                            >
                                copy
                            </button>
                            <button
                                className="format-btn"
                                onClick={() => handleDataFormatting(dataFormat)}
                                title={`Format ${dataFormat}`}
                            >
                                format
                            </button>
                        </div>
                    </div>
                    <OrquestulatorEditor
                        language={dataFormat}
                        value={contextData}
                        onChange={(value) => {
                            const newContextData = value || ''
                            setContextData(newContextData)
                        }}
                    />
                </div>
                {/* Evaluation Pane - Right Side */}
                <div className="pane">
                    <div className="pane-header">
                        <h3>
                            <span className="pane-icon">E</span>
                            Evaluation
                        </h3>
                        <div className="pane-actions">
                            <div className={`status-indicator ${isLoading ? 'loading' : evaluationStatus}`}>
                                {
                                    isLoading ? '• Loading...' :
                                        evaluationStatus === 'success' ? '✓ Success' :
                                            evaluationStatus === 'error' ? '✗ Error' :
                                                '• Ready'
                                }
                            </div>
                            <button
                                className="btn btn--secondary"
                                onClick={() => {
                                    setEvaluationImmediate('')
                                    setEvaluationStatus('')
                                }}
                                title="Clear result"
                                disabled={!evaluation}
                            >
                                clear
                            </button>
                            <button
                                className="btn btn--secondary"
                                onClick={() => copyToClipboard(evaluation)}
                                title="Copy result"
                                disabled={!evaluation}
                            >
                                copy
                            </button>
                            <button
                                onClick={evaluateExpression}
                                disabled={isLoading}
                                className="btn btn--primary"
                            >
                                evaluate
                            </button>
                        </div>
                    </div>
                    <OrquestulatorEditor
                        language={evaluationStatus === 'error' ? 'plaintext' : dataFormat}
                        value={evaluation}
                        options={{
                            readOnly: true,
                            placeholder: "// awaiting evaluation..."
                        }}
                    />
                </div>

                {/* Orquesta-specific panels - Always rendered but hidden when not in Orquesta mode */}
                {/* Result Panel */}
                <div className={`pane pane-bottom ${queryType !== 'orquesta' ? 'hidden' : ''}`}>
                    <div className="pane-header">
                        <h3>
                            <span className="pane-icon">R</span>
                            Result
                        </h3>
                        <div className="pane-actions">
                            <button
                                className="btn btn--secondary"
                                onClick={() => {
                                    setResultDataImmediate('')
                                }}
                                title="Clear result"
                                disabled={!resultData}
                            >
                                clear
                            </button>
                            <button
                                className="btn btn--secondary"
                                onClick={() => copyToClipboard(resultData)}
                                title="Copy result"
                                disabled={!resultData}
                            >
                                copy
                            </button>
                            <button
                                className="btn btn--secondary"
                                onClick={() => handleDataFormatting(dataFormat)}
                                title="Format result"
                                disabled={!resultData}
                            >
                                format
                            </button>
                        </div>
                    </div>
                    <OrquestulatorEditor
                        language={dataFormat}
                        value={resultData}
                        onChange={(value) => {
                            const newResultData = value || ''
                            setResultData(newResultData)
                        }}
                    />
                </div>
                {/* StackStorm Integration Panel */}
                <div className={`pane pane-bottom ${queryType !== 'orquesta' ? 'hidden' : ''}`}>
                    <div className="pane-header">
                        <h3>
                            <span className="pane-icon">S</span>
                            StackStorm
                        </h3>
                        <div className="pane-actions">
                            <div className={`status-indicator ${st2ConnectionStatus === 'loading' ? 'loading' : st2ConnectionStatus}`}>
                                {
                                    st2ConnectionStatus === 'loading' ? '• Connecting...' :
                                        st2ConnectionStatus === 'success' ? '✓ Connected' :
                                            st2ConnectionStatus === 'error' ? '✗ Error' :
                                                st2CurrentConnection ? '• Ready' : '• No Connection'
                                }
                            </div>
                        </div>
                    </div>
                    <div className="inputs-vertical">
                        {st2Alert && (
                            <div className="alert error">
                                {st2Alert}
                            </div>
                        )}
                        <div className="control-group">
                            <label>Connection:</label>
                            <div className="control-group control-group-inline">
                                <select
                                    value={st2CurrentConnection || ''}
                                    onChange={(e) => handleConnectionChange(e.target.value)}
                                    disabled={st2ConnectionStatus === 'loading'}
                                    className="input input--flex-fill"
                                >
                                    <option value="" disabled>Select a connection...</option>
                                    {st2AvailableConnections.map(conn => (
                                        <option key={conn.id} value={conn.id}>
                                            {conn.alias}
                                        </option>
                                    ))}
                                    <option value="custom">Custom</option>
                                </select>
                                <button
                                    className="btn btn--secondary"
                                    onClick={handleTestConnection}
                                    disabled={st2ConnectionStatus === 'loading' || !st2CurrentConnection}
                                    title="Test the current connection"
                                >
                                    Test Connection
                                </button>
                            </div>
                        </div>

                        {/* Show URL and API Key inputs only for custom connection */}
                        {st2CurrentConnection === 'custom' && (
                            <>
                                <div className="control-group">
                                    <label>StackStorm URL:</label>
                                    <input
                                        type="text"
                                        value={st2CustomUrl}
                                        onChange={(e) => setSt2CustomUrl(e.target.value)}
                                        placeholder="http://localhost:9101"
                                        className="input"
                                    />
                                </div>
                                <div className="control-group">
                                    <label>API Key:</label>
                                    <input
                                        type="password"
                                        value={st2CustomApiKey}
                                        onChange={(e) => setSt2CustomApiKey(e.target.value)}
                                        placeholder="Optional API key"
                                        className="input"
                                    />
                                </div>
                            </>
                        )}

                        <div className="control-group">
                            <label>Execution ID:</label>
                            <div className="control-group control-group-inline">
                                <input
                                    type="text"
                                    value={st2ExecutionId}
                                    onChange={(e) => setSt2ExecutionId(e.target.value)}
                                    placeholder="5f2b6c8d9e1a2b3c4d5e6f7g"
                                    className="input input--flex-fill"
                                />
                                <button
                                    className="btn btn--secondary"
                                    onClick={handleGetLatestExecution}
                                    disabled={st2Loading || st2ConnectionStatus === 'loading' || !st2CurrentConnection}
                                    title="Get the latest execution ID"
                                >
                                    Latest
                                </button>
                                <button
                                    className="btn btn--primary"
                                    onClick={fetchStackStormResult}
                                    disabled={st2Loading || st2ConnectionStatus === 'loading' || !st2CurrentConnection || !st2ExecutionId}
                                    title="Fetch execution result data"
                                >
                                    Result
                                </button>
                            </div>
                        </div>
                        <div className="control-group control-group-inline">
                            <label>Task Status Override:</label>
                            <label className="toggle-label">
                                <span className={`toggle-text fixed-width ${taskStatusOverride}`}>
                                    {taskStatusOverride}
                                </span>
                                <div className="toggle-switch">
                                    <input
                                        className="toggle-input"
                                        type="checkbox"
                                        checked={taskStatusOverride === 'succeeded'}
                                        onChange={(e) => setTaskStatus(e.target.checked ? 'succeeded' : 'failed')}
                                    />
                                    <span className="toggle-slider"></span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="footer">
                <div className="hint">
                    Inspired by orquestaevaluator by Daren Lord
                </div>
            </div>
        </>
    )

}

export default MainPage
