import { useState } from 'react'
import * as yaml from 'js-yaml'
import backendClient from '../api/backendClient'
import OrquestulatorEditor from './OrquestulatorEditor'

function MainPage({ onSessionExpired }) {
    const [dataFormat, setDataFormat] = useState('yaml') // 'json' or 'yaml'
    const [queryType, setQueryType] = useState('orquesta')
    const [query, setQuery] = useState('')
    const [contextData, setContextData] = useState('')
    const [evaluation, setEvaluation] = useState('')
    const [evaluationStatus, setEvaluationStatus] = useState('') // 'success', 'error', 'loading' or ''
    const [isLoading, setIsLoading] = useState(false)

    // Orquesta-specific settings
    const [taskStatusOverride, setTaskStatus] = useState('succeeded') // 'succeeded' or 'failed'
    const [resultData, setResultData] = useState('')

    // StackStorm-specific states
    const [st2Url, setSt2Url] = useState('http://localhost:9101')
    const [st2ApiKey, setSt2ApiKey] = useState('')
    const [st2ExecutionId, setSt2ExecutionId] = useState('')
    const [st2Loading, setSt2Loading] = useState(false)

    // Helper function to save data to session
    const saveToSession = async (key, value) => {
        await backendClient.saveSessionData(key, value)
    }

    // Save StackStorm API key when it changes
    const handleSt2ApiKeyChange = (newApiKey) => {
        setSt2ApiKey(newApiKey)
        if (newApiKey.trim()) {
            saveToSession('st2_api_key', newApiKey)
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
        return format === 'json'
            ? JSON.stringify(data, null, 2)
            : yaml.dump(data, { indent: 2 })
    }

    const handleDataFormatting = (newFormat) => {
        if (contextData.trim()) {
            try {
                // Parse the data as YAML (works for both JSON and YAML input)
                // Use the validation function for better error handling
                const parsedData = validateAndParseData(contextData)

                // Batch state updates to avoid multiple re-renders
                const formattedData = formatData(parsedData, newFormat)

                setContextData(formattedData)
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

                setResultData(formattedData)
            } catch (error) {
                // TODO: Show error in evaluation
                console.error('Result conversion error:', error)
            }
        }

        setDataFormat(newFormat)
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
            setEvaluation('Error: Query cannot be empty')
            setEvaluationStatus('error')
            return
        }

        let parsedContextData = {}
        if (resultData) {
            try {
                parsedContextData = validateAndParseData(contextData)
            } catch (e) {
                setEvaluation(`${queryType === 'orquesta' ? 'Context' : 'Data'} Parse Error: ${e.message}`)
                setEvaluationStatus('error')
                return
            }
        }

        let parsedResultData = {}
        if (queryType === 'orquesta' && resultData) {
            try {
                parsedResultData = validateAndParseData(resultData)
            } catch (e) {
                setEvaluation(`Task Result Parse Error: ${e.message}`)
                setEvaluationStatus('error')
                return
            }
        }

        const payload = {
            expression: query,
            data: queryType === 'orquesta'
                ? {
                    ...parsedContextData,
                    __task_status: taskStatusOverride,
                    __task_result: parsedResultData
                }
                : parsedContextData  // Send data as-is for YAQL/Jinja2
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
                // TODO: This might fail if the result is a primitive (string, number, boolean)
                const formattedResult = formatData(responseData.result, dataFormat)

                setEvaluation(formattedResult)
                setEvaluationStatus('success')
            }
        } catch (error) {
            setEvaluation(`Error: ${error.message}`)
            setEvaluationStatus('error')
        }
        setIsLoading(false)
    }

    const handleMonacoKeyDown = (e, monaco) => {
        if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.Enter) {
            e.preventDefault()
            evaluateExpression()
        }
    }

    const fetchStackStormResult = async () => {
        if (!st2Url || !st2ExecutionId || !st2ApiKey) {
            setEvaluation('Error: StackStorm URL, Execution ID, and API Key are required')
            setEvaluationStatus('error')
            return
        }

        // Basic URL validation
        try {
            new URL(st2Url)
        } catch {
            setEvaluation('Error: Invalid StackStorm URL format')
            setEvaluationStatus('error')
            return
        }

        setSt2Loading(true)
        try {
            const responseData = await backendClient.fetchStackStormExecution(
                st2ExecutionId,
                st2Url,
                st2ApiKey
            )

            if (responseData) {
                const executionData = responseData.execution_data

                // Validate that we received execution data
                if (!executionData || !executionData.id) {
                    setEvaluation('Error: Invalid execution data received from StackStorm')
                    setEvaluationStatus('error')
                    return
                }

                // Set the execution data to the task result field instead of context field
                // Format the data according to the current task result format
                const formattedData = formatData(executionData, dataFormat)
                setResultData(formattedData)
                setEvaluation(responseData.message)
                setEvaluationStatus('success')
            }
        } catch (error) {
            const errorMessage = backendClient.formatNetworkError(error)
            setEvaluation(errorMessage)
            setEvaluationStatus('error')
        } finally {
            setSt2Loading(false)
        }
    }

    return (
        <>
            <div className="panes-container">
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
                                    onClick={() => setQueryType('orquesta')}
                                    className={`btn btn--secondary${queryType === 'orquesta' ? ' active' : ''}`}
                                >
                                    orquesta
                                </button>
                                <button
                                    onClick={() => setQueryType('yaql')}
                                    className={`btn btn--secondary${queryType === 'yaql' ? ' active' : ''}`}
                                >
                                    yaql
                                </button>
                                <button
                                    onClick={() => setQueryType('jinja2')}
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
                                onClick={() => setQuery('')}
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
                        onChange={(value) => setQuery(value || '')}
                        options={{
                            placeholder: `${queryType === "orquesta" ? "<% ctx() %>" : "Enter your query here..."}`
                        }}
                    // onMount={(editor, monaco) => {
                    //   // Handle Ctrl+Enter shortcut
                    //   editor.onKeyDown((e) => handleMonacoKeyDown(e, monaco))
                    // }}
                    />
                    < div className="keyboard-hint" >
                        ctrl + enter to eval
                    </div>
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
                                onClick={() => setContextData('')}
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
                        onChange={(value) => setContextData(value || '')}
                    // onMount={(editor, monaco) => {
                    //   // Handle Ctrl+Enter shortcut
                    //   editor.onKeyDown((e) => handleMonacoKeyDown(e, monaco))
                    // }}
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
                                    setEvaluation('')
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
                                onClick={() => setResultData('')}
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
                        onChange={(value) => setResultData(value || '')}
                    // onMount={(editor, monaco) => {
                    //   // Handle Ctrl+Enter shortcut
                    //   editor.onKeyDown((e) => handleMonacoKeyDown(e, monaco))
                    // }}
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
                            <button
                                className="btn btn--primary"
                                onClick={fetchStackStormResult}
                                disabled={st2Loading || !st2Url || !st2ExecutionId || !st2ApiKey}
                            >
                                fetch result
                            </button>
                        </div>
                    </div>
                    <div className="inputs-vertical">
                        <div className="control-group">
                            <label>StackStorm URL:</label>
                            <input
                                type="text"
                                value={st2Url}
                                onChange={(e) => setSt2Url(e.target.value)}
                                placeholder="http://localhost:9101"
                                className="input"
                            />
                        </div>
                        <div className="control-group">
                            <label>API Key:</label>
                            <input
                                type="password"
                                value={st2ApiKey}
                                onChange={(e) => handleSt2ApiKeyChange(e.target.value)}
                                placeholder="Optional API key"
                                className="input"
                            />
                        </div>
                        <div className="control-group">
                            <label>Execution ID:</label>
                            <input
                                type="text"
                                value={st2ExecutionId}
                                onChange={(e) => setSt2ExecutionId(e.target.value)}
                                placeholder="5f2b6c8d9e1a2b3c4d5e6f7g"
                                className="input"
                            />
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
                <div className="keyboard-hint">
                    Inspired by orquestaevaluator by Daren Lord
                </div>
            </div>
        </>
    )
}

export default MainPage
