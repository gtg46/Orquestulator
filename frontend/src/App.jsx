import { useState, useEffect } from 'react'
import * as yaml from 'js-yaml'
import Editor, { useMonaco } from '@monaco-editor/react'
import './App.css'

// Monaco Editor configuration
const monacoOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
  lineHeight: 1.4,
  wordWrap: 'on',
  automaticLayout: true,
  scrollbar: {
    vertical: 'auto',
    horizontal: 'auto',
    useShadows: false,
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8
  },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  overviewRulerLanes: 0,
  renderLineHighlight: 'line',
  selectionHighlight: false,
  occurrencesHighlight: false,
  codeLens: false,
  folding: false,
  lineNumbers: 'off',
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  theme: 'vs-dark'
}

function App() {
  const monaco = useMonaco()
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

  // Initialize Monaco theme when Monaco becomes available
  useEffect(() => {
    if (monaco) {
      monaco.editor.setTheme('vs-dark')
    }
  }, [monaco])

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
    if (newFormat === dataFormat) {
      return
    }


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

    const endpoint = `/api/evaluate/${queryType}`

    setIsLoading(true)
    setEvaluationStatus('')

    try {
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const responseData = await response.json()

        // Format result according to current dataFormat
        // TODO: This might fail if the result is a primitive (string, number, boolean)
        const formattedResult = formatData(responseData.result, dataFormat)

        setEvaluation(formattedResult)
        setEvaluationStatus('success')
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.detail?.error || errorData.detail || 'Unknown error'
        setEvaluation(`Error: ${errorMessage}`)
        setEvaluationStatus('error')
      }
    } catch (error) {
      setEvaluation(`Network Error: ${error.message}`)
      setEvaluationStatus('error')
    }
    setIsLoading(false)
  }

  const handleKeyPress = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
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

    // Use the backend proxy instead of direct StackStorm API calls
    const backendUrl = '/api/stackstorm/execution/' + st2ExecutionId

    const requestBody = {
      url: st2Url,
      api_key: st2ApiKey || null
    }

    setSt2Loading(true)
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const responseData = await response.json()
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

      } else {
        // Handle HTTP error responses from the backend
        try {
          const errorData = await response.json()
          setEvaluation(errorData.detail || `Backend Error (${response.status})`)
        } catch {
          const errorText = await response.text()
          setEvaluation(`Backend Error (${response.status}): ${errorText}`)
        }
        setEvaluationStatus('error')
      }
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setEvaluation(`Connection Error: Could not connect to backend at http://localhost:8000.
        • Check that the backend is running
        • Ensure the backend is accessible on port 8000`)
      } else if (error.name === 'AbortError') {
        setEvaluation('Request timed out. The backend server may be slow to respond.')
      } else {
        setEvaluation(`Network Error: ${error.message}`)
      }
      setEvaluationStatus('error')
    } finally {
      setSt2Loading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="header-icon">
            <img src="/favicon.svg" alt="Orquestulator" style={{ width: 28, height: 28, verticalAlign: 'middle' }} />
          </span>
          Orquestulator
        </h1>
        <p>Expression evaluator for Orquesta, YAQL, and Jinja2</p>
      </header>
      <div className="panes-container">
        {/* Query Pane - Full Width at Top */}
        <div className="pane query-pane">
          <div className="pane-header flex items-center justify-between">
            <h3 className="flex items-center gap-sm text-mono text-uppercase">
              <span className="pane-icon">Q</span>
              query
            </h3>
            <div className="query-controls flex gap-sm items-center">
              <div className="btn-group query-type-buttons">
                <button
                  onClick={() => setQueryType('orquesta')}
                  className={`btn btn--secondary ${queryType === 'orquesta' ? 'active' : ''}`}
                >
                  orquesta
                </button>
                <button
                  onClick={() => setQueryType('yaql')}
                  className={`btn btn--secondary ${queryType === 'yaql' ? 'active' : ''}`}
                >
                  yaql
                </button>
                <button
                  onClick={() => setQueryType('jinja2')}
                  className={`btn btn--secondary ${queryType === 'jinja2' ? 'active' : ''}`}
                >
                  jinja2
                </button>
              </div>
              <div className="btn-group data-format-buttons">
                <button
                  className={`btn btn--secondary ${dataFormat === 'yaml' ? 'active' : ''}`}
                  onClick={() => handleDataFormatting('yaml')}
                >
                  yaml
                </button>
                <button
                  className={`btn btn--secondary ${dataFormat === 'json' ? 'active' : ''}`}
                  onClick={() => handleDataFormatting('json')}
                >
                  json
                </button>
              </div>
              <div className="action-buttons">
                <button
                  className="btn btn--secondary"
                  onClick={() => setQuery('')}
                  title="Clear Query"
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
          </div>
          <div className="monaco-editor-container query-editor">
            <Editor
              // #TODO: put in a style
              height="80px"
              // language={queryType === 'yaql' ? 'javascript' : 'plaintext'}
              value={query}
              onChange={(value) => setQuery(value || '')}
              options={{
                ...monacoOptions,
                placeholder: "<% ctx() %>"
              }}
              onMount={(editor, monaco) => {
                // Handle Ctrl+Enter shortcut
                editor.onKeyDown((e) => {
                  if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.Enter) {
                    e.preventDefault()
                    handleKeyPress({ key: 'Enter', ctrlKey: e.ctrlKey, metaKey: e.metaKey, preventDefault: () => { } })
                  }
                })
              }}
            />
          </div>
          <div className="keyboard-hint">
            ctrl+enter to eval
          </div>
        </div>

        {/* Data Pane - Left Side */}
        <div className="pane">
          <div className="pane-header">
            <h3>
              <span className="pane-icon">{queryType === 'orquesta' ? 'C' : 'D'}</span>
              {queryType === 'orquesta' ? 'Context' : 'Data'}
            </h3>
            <div className="data-header">
              <div className="data-actions">
                <button
                  className="btn btn--secondary"
                  onClick={() => setContextData('')}
                  title={queryType === 'orquesta' ? "Clear context" : "Clear data"}
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
          </div>
          <div className="monaco-editor-container data-editor">
            <Editor
              // #TODO: put in a style
              height="300px"
              language={dataFormat}
              value={contextData}
              onChange={(value) => setContextData(value || '')}
              options={monacoOptions}
              onMount={(editor, monaco) => {
                // Handle Ctrl+Enter shortcut
                editor.onKeyDown((e) => {
                  if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.Enter) {
                    e.preventDefault()
                    handleKeyPress({ key: 'Enter', ctrlKey: e.ctrlKey, metaKey: e.metaKey, preventDefault: () => { } })
                  }
                })
              }}
            />
          </div>
        </div>
        {/* Evaluation Pane - Right Side */}
        <div className="pane">
          <div className="pane-header">
            <h3>
              <span className="pane-icon">E</span>
              Evaluation
            </h3>
            <div className="data-header">
              <div className="status-indicator">
                <span className={`status-dot ${isLoading ? 'loading' : evaluationStatus}`}></span>
              </div>
              <div className="data-actions">
                <button
                  className="btn btn--secondary"
                  onClick={() => copyToClipboard(evaluation)}
                  title="Copy result"
                  disabled={!evaluation}
                >
                  copy
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => handleDataFormatting(dataFormat)}
                  title={`Format ${dataFormat}`}
                  disabled={!evaluation}
                >
                  format
                </button>
                <button
                  onClick={evaluateExpression}
                  disabled={isLoading}
                  className={`btn btn--primary ${isLoading ? 'loading' : ''}`}
                >
                  evaluate
                </button>
              </div>
            </div>
          </div>
          <Editor
            // TODO: put in a style
            height="300px"
            language={evaluationStatus === 'error' ? 'plaintext' : dataFormat}
            value={evaluation}
            options={{
              ...monacoOptions,
              readOnly: true,
              placeholder: "// awaiting evaluation..."
            }}
          />
        </div>

        {/* Orquesta-specific panels - Only shown for Orquesta mode */}
        {queryType === 'orquesta' && (
          <>
            {/* Result Panel */}
            <div className="pane pane-bottom">
              <div className="pane-header">
                <h3>
                  <span className="pane-icon">R</span>
                  Result
                </h3>
                <div className="data-header">
                  <div className="data-actions">
                    <button
                      className="btn btn--secondary"
                      onClick={() => setResultData('')}
                      title="Clear result"
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
                    >
                      format
                    </button>
                  </div>
                </div>
              </div>
              <div className="monaco-editor-container task-result-editor">
                <Editor
                  // TODO: put in a style
                  height="200px"
                  language={dataFormat}
                  value={resultData}
                  onChange={(value) => handleResultChange(value || '')}
                  options={monacoOptions}
                  onMount={(editor, monaco) => {
                    // Handle Ctrl+Enter shortcut
                    editor.onKeyDown((e) => {
                      if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.Enter) {
                        e.preventDefault()
                        handleKeyPress({ key: 'Enter', ctrlKey: e.ctrlKey, metaKey: e.metaKey, preventDefault: () => { } })
                      }
                    })
                  }}
                />
              </div>
            </div>
            {/* StackStorm Integration Panel */}
            <div className="pane pane-bottom">
              <div className="pane-header">
                <h3>
                  <span className="pane-icon">S</span>
                  StackStorm
                </h3>
                <div className="data-header">
                  <div className="data-actions">
                    <button
                      className="btn btn--primary"
                      onClick={fetchStackStormResult}
                      disabled={st2Loading}
                    >
                      fetch result
                    </button>
                  </div>
                </div>
              </div>
              <div className="stackstorm-controls">
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
                <div className="control-group">
                  <label>StackStorm URL:</label>
                  <input
                    type="text"
                    value={st2Url}
                    onChange={(e) => setSt2Url(e.target.value)}
                    placeholder="http://localhost:9101"
                    className="st2-input"
                  />
                </div>
                <div className="control-group">
                  <label>API Key:</label>
                  <input
                    type="password"
                    value={st2ApiKey}
                    onChange={(e) => setSt2ApiKey(e.target.value)}
                    placeholder="Optional API key"
                    className="st2-input"
                  />
                </div>
                <div className="control-group">
                  <label>Execution ID:</label>
                  <input
                    type="text"
                    value={st2ExecutionId}
                    onChange={(e) => setSt2ExecutionId(e.target.value)}
                    placeholder="5f2b6c8d9e1a2b3c4d5e6f7g"
                    className="st2-input"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="footer">
        <div className="keyboard-hint">
          Inspired by orquestaevaluator by Daren Lord
        </div>
      </div>
    </div >
  )
}

export default App
