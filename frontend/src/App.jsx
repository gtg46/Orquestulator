import { useState } from 'react'
import * as yaml from 'js-yaml'
import Editor from '@monaco-editor/react'
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
  const [data, setData] = useState('name: "John Doe"\nage: 30\nactive: true')
  const [expression, setExpression] = useState('$.name')
  const [queryType, setQueryType] = useState('orquesta')
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [resultType, setResultType] = useState('') // 'success', 'error', or ''
  const [detectedType, setDetectedType] = useState('')
  const [dataFormat, setDataFormat] = useState('yaml') // 'json' or 'yaml'
  const [detectedDataFormat, setDetectedDataFormat] = useState('yaml')
  const [st2Url, setSt2Url] = useState('http://localhost:9101')
  const [st2ApiKey, setSt2ApiKey] = useState('')
  const [st2ExecutionId, setSt2ExecutionId] = useState('')
  const [st2Loading, setSt2Loading] = useState(false)

  // Orquesta-specific settings
  const [taskStatus, setTaskStatus] = useState('succeeded') // 'succeeded' or 'failed'
  const [taskResult, setTaskResult] = useState('')
  const [taskResultFormat, setTaskResultFormat] = useState('yaml')
  const [detectedTaskResultFormat, setDetectedTaskResultFormat] = useState('yaml')

  const detectDataFormat = (dataText) => {
    if (!dataText.trim()) return 'yaml'

    try {
      JSON.parse(dataText)
      return 'json'
    } catch {
      // If it's not valid JSON, assume it's YAML
      return 'yaml'
    }
  }

  const validateAndParseData = (dataText) => {
    if (!dataText.trim()) {
      throw new Error('Input cannot be empty')
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

  // Reusable helper functions for data management
  const createDataHelpers = (
    dataValue,
    setDataValue,
    formatState,
    setFormatState,
    setDetectedFormatState
  ) => ({
    handleChange: (newData) => {
      setDataValue(newData)
      const detected = detectDataFormat(newData)
      setDetectedFormatState(detected)
      if (!newData.trim() || formatState === detected) {
        setFormatState(detected)
      }
    },
    clear: () => {
      setDataValue('')
      setFormatState('yaml')
      setDetectedFormatState('yaml')
    },
    format: () => {
      try {
        const parsedData = validateAndParseData(dataValue)
        if (formatState === 'json') {
          setDataValue(JSON.stringify(parsedData, null, 2))
        } else {
          setDataValue(yaml.dump(parsedData, { indent: 2 }))
        }
      } catch (error) {
        console.error('Format error:', error)
      }
    }
  })

  // Create helper instances
  const dataHelpers = createDataHelpers(
    data, setData, dataFormat, setDataFormat, setDetectedDataFormat
  )
  const taskResultHelpers = createDataHelpers(
    taskResult, setTaskResult, taskResultFormat, setTaskResultFormat, setDetectedTaskResultFormat
  )

  const handleDataFormatChange = (newFormat) => {
    if (newFormat === dataFormat) {
      return
    }

    if (!data.trim()) {
      setDataFormat(newFormat)
      setTaskResultFormat(newFormat)
      return
    }

    try {
      // Parse the data as YAML (works for both JSON and YAML input)
      // Use the validation function for better error handling
      const parsedData = validateAndParseData(data)

      // Batch state updates to avoid multiple re-renders
      const formattedData = newFormat === 'json'
        ? JSON.stringify(parsedData, null, 2)
        : yaml.dump(parsedData, { indent: 2 })

      // Update data-related states in batch
      setData(formattedData)
      setDataFormat(newFormat)
      setDetectedDataFormat(newFormat)
      setTaskResultFormat(newFormat)
      setDetectedTaskResultFormat(newFormat)

      // Also convert task result if it exists
      if (taskResult.trim()) {
        try {
          const parsedTaskResult = validateAndParseData(taskResult)
          const formattedTaskResult = newFormat === 'json'
            ? JSON.stringify(parsedTaskResult, null, 2)
            : yaml.dump(parsedTaskResult, { indent: 2 })
          setTaskResult(formattedTaskResult)
        } catch (error) {
          console.error('Task result conversion error:', error)
        }
      }
    } catch (error) {
      // If conversion fails, just change format without converting data
      console.error('Conversion error:', error)
      setDataFormat(newFormat)
      setTaskResultFormat(newFormat)
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      // Could add toast notification here for better UX
      return { success: true }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      // Fallback for older browsers or when clipboard API is not available
      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        return { success: true }
      } catch (fallbackErr) {
        console.error('Fallback copy method also failed:', fallbackErr)
        return { success: false, error: 'Could not copy to clipboard' }
      }
    }
  }

  // Wrapper functions using helpers
  const clearData = () => dataHelpers.clear()
  const clearExpression = () => setExpression('')
  const handleDataChange = (newData) => dataHelpers.handleChange(newData)
  const clearTaskResult = () => taskResultHelpers.clear()
  const formatData = () => dataHelpers.format()
  const formatTaskResult = () => taskResultHelpers.format()
  const handleTaskResultChange = (newTaskResult) => taskResultHelpers.handleChange(newTaskResult)

  const evaluateExpression = async () => {
    // Input validation
    if (!expression.trim()) {
      setResult('Error: Expression cannot be empty')
      setResultType('error')
      return
    }

    if (!data.trim() && queryType !== 'orquesta') {
      setResult('Error: Data cannot be empty for evaluation')
      setResultType('error')
      return
    }

    setIsLoading(true)
    setResultType('')
    try {
      let parsedData
      try {
        // Use the validation function for better error handling
        parsedData = validateAndParseData(data)
      } catch (e) {
        setResult(`${queryType === 'orquesta' ? 'Context' : 'Data'} Parse Error: ${e.message}`)
        setResultType('error')
        setIsLoading(false)
        return
      }

      let parsedTaskResult = {}
      if (queryType === 'orquesta' && taskResult) {
        try {
          parsedTaskResult = validateAndParseData(taskResult)
        } catch (e) {
          setResult(`Task Result Parse Error: ${e.message}`)
          setResultType('error')
          setIsLoading(false)
          return
        }
      }

      const payload = {
        expression,
        data: queryType === 'orquesta'
          ? {
            ...parsedData,
            __task_status: taskStatus,
            __task_result: parsedTaskResult
          }
          : parsedData  // Send data as-is for YAQL/Jinja2
      }

      const endpoint = `/api/evaluate/${queryType}`

      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const responseData = await response.json()
        setDetectedType(responseData.query_type)

        // Format result according to current dataFormat
        const formattedResult = dataFormat === 'json'
          ? JSON.stringify(responseData.result, null, 2)
          : yaml.dump(responseData.result, { indent: 2 })

        setResult(formattedResult)
        setResultType('success')
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.detail?.error || errorData.detail || 'Unknown error'
        setResult(`Error: ${errorMessage}`)
        setResultType('error')
        setDetectedType(errorData.detail?.query_type || '')
      }
    } catch (error) {
      setResult(`Network Error: ${error.message}`)
      setResultType('error')
    }
    setIsLoading(false)
  }

  const handleKeyPress = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      evaluateExpression()
    }
  }

  const fetchStackStormData = async () => {
    if (!st2Url || !st2ExecutionId) {
      setResult('Error: StackStorm URL and Execution ID are required')
      setResultType('error')
      return
    }

    // Basic URL validation
    try {
      new URL(st2Url)
    } catch {
      setResult('Error: Invalid StackStorm URL format')
      setResultType('error')
      return
    }

    setSt2Loading(true)
    try {
      // Clean up URL and build execution endpoint
      const baseUrl = st2Url.replace(/\/$/, '')
      const executionUrl = `${baseUrl}/v1/executions/${st2ExecutionId}`

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }

      if (st2ApiKey) {
        headers['X-Auth-Token'] = st2ApiKey
      }

      const response = await fetch(executionUrl, {
        method: 'GET',
        headers: headers,
        mode: 'cors'
      })

      if (response.ok) {
        const executionData = await response.json()

        // Validate that we received execution data
        if (!executionData || !executionData.id) {
          setResult('Error: Invalid execution data received from StackStorm')
          setResultType('error')
          return
        }

        // Extract the most useful data for expression testing
        const resultData = {
          execution_id: executionData.id,
          status: executionData.status,
          start_timestamp: executionData.start_timestamp,
          end_timestamp: executionData.end_timestamp,
          action: {
            name: executionData.action?.name,
            pack: executionData.action?.pack,
            runner_type: executionData.action?.runner_type
          },
          parameters: executionData.parameters || {},
          result: executionData.result || {},
          context: executionData.context || {},
          children: executionData.children || []
        }

        // Set the execution data as formatted JSON
        const formattedData = JSON.stringify(resultData, null, 2)
        setData(formattedData)
        setDataFormat('json')
        setDetectedDataFormat('json')
        setResult(`StackStorm execution data loaded successfully! Status: ${executionData.status}`)
        setResultType('success')

      } else if (response.status === 401) {
        setResult('Authentication failed: Invalid or missing API key')
        setResultType('error')
      } else if (response.status === 404) {
        setResult(`Execution ${st2ExecutionId} not found. Check the execution ID.`)
        setResultType('error')
      } else if (response.status === 403) {
        setResult('Access forbidden: Insufficient permissions for this execution')
        setResultType('error')
      } else {
        const errorText = await response.text()
        setResult(`StackStorm API Error (${response.status}): ${errorText}`)
        setResultType('error')
      }
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setResult(`Connection Error: Could not connect to StackStorm at ${st2Url}. 
        • Check that the URL is correct
        • Ensure StackStorm is running and accessible
        • Verify CORS is properly configured
        • Check if authentication is required`)
      } else if (error.name === 'AbortError') {
        setResult('Request timed out. The StackStorm server may be slow to respond.')
      } else {
        setResult(`Network Error: ${error.message}`)
      }
      setResultType('error')
    } finally {
      setSt2Loading(false)
    }
  }

  const getStatusText = () => {
    if (isLoading) return 'evaluating'
    if (resultType === 'success') return `success • ${detectedType}`
    if (resultType === 'error') return 'error'
    return 'ready'
  }

  const getStatusDotClass = () => {
    if (isLoading) return 'status-dot loading'
    if (resultType === 'success') return 'status-dot success'
    if (resultType === 'error') return 'status-dot error'
    return 'status-dot'
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
              Query
            </h3>
            <div className="query-controls flex gap-sm items-center">
              <div className="btn-group query-type-buttons">
                <button
                  onClick={() => setQueryType('orquesta')}
                  className={`btn btn--secondary ${queryType === 'orquesta' ? 'active' : ''}`}
                >
                  ORQUESTA
                </button>
                <button
                  onClick={() => setQueryType('yaql')}
                  className={`btn btn--secondary ${queryType === 'yaql' ? 'active' : ''}`}
                >
                  YAQL
                </button>
                <button
                  onClick={() => setQueryType('jinja2')}
                  className={`btn btn--secondary ${queryType === 'jinja2' ? 'active' : ''}`}
                >
                  JINJA2
                </button>
              </div>
              <div className="btn-group data-format-buttons">
                <button
                  className={`btn btn--secondary ${dataFormat === 'yaml' ? 'active' : ''}`}
                  onClick={() => handleDataFormatChange('yaml')}
                >
                  YAML
                </button>
                <button
                  className={`btn btn--secondary ${dataFormat === 'json' ? 'active' : ''}`}
                  onClick={() => handleDataFormatChange('json')}
                >
                  JSON
                </button>
              </div>
              <div className="action-buttons">
                <button
                  className="btn btn--secondary"
                  onClick={clearExpression}
                  title="Clear expression"
                >
                  clear
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => copyToClipboard(expression)}
                  title="Copy expression"
                  disabled={!expression}
                >
                  copy
                </button>
              </div>
            </div>
          </div>
          <div className="monaco-editor-container query-editor">
            <Editor
              height="80px"
              language={queryType === 'yaql' ? 'javascript' : 'plaintext'}
              value={expression}
              onChange={(value) => setExpression(value || '')}
              options={{
                ...monacoOptions,
                placeholder: "$.key or {{ name }}"
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
                  onClick={clearData}
                  title={queryType === 'orquesta' ? "Clear context" : "Clear data"}
                >
                  clear
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => copyToClipboard(data)}
                  title={queryType === 'orquesta' ? "Copy context" : "Copy data"}
                  disabled={!data}
                >
                  copy
                </button>
                <button
                  className="format-btn"
                  onClick={formatData}
                  title={`Format ${detectedDataFormat.toUpperCase()}`}
                >
                  format
                </button>
              </div>
            </div>
          </div>
          <div className="monaco-editor-container data-editor">
            <Editor
              height="300px"
              language={dataFormat === 'json' ? 'json' : 'yaml'}
              value={data}
              onChange={(value) => handleDataChange({ target: { value: value || '' } })}
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

        {/* Result Pane - Right Side */}
        <div className="pane">
          <div className="pane-header">
            <h3>
              <span className="pane-icon">E</span>
              Evaluation
            </h3>
            <div className="data-header">
              <div className="status-indicator">
                <span className={`status-dot ${resultType === 'success' ? 'success' : resultType === 'error' ? 'error' : isLoading ? 'loading' : ''}`}></span>
              </div>
              <div className="data-actions">
                <button
                  className="btn btn--secondary"
                  onClick={() => copyToClipboard(result)}
                  title="Copy result"
                  disabled={!result}
                >
                  copy
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => {
                    if (result) {
                      try {
                        const parsedResult = validateAndParseData(result)
                        const formattedResult = dataFormat === 'json'
                          ? JSON.stringify(parsedResult, null, 2)
                          : yaml.dump(parsedResult, { indent: 2 })
                        setResult(formattedResult)
                      } catch (error) {
                        console.error('Result format error:', error)
                      }
                    }
                  }}
                  title={`Format ${dataFormat.toUpperCase()}`}
                  disabled={!result}
                >
                  format
                </button>
                <button
                  onClick={evaluateExpression}
                  disabled={isLoading}
                  className={`btn btn--primary ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? '' : 'evaluate'}
                </button>
              </div>
            </div>
          </div>
          {result ? (
            <Editor
              height="300px"
              language={dataFormat === 'json' ? 'json' : 'yaml'}
              value={result}
              options={{
                ...monacoOptions,
                readOnly: true
              }}
            />
          ) : (
            <Editor
              height="300px"
              language="javascript"
              value="// awaiting evaluation..."
              options={{
                ...monacoOptions,
                readOnly: true
              }}
            />
          )}
        </div>

        {/* Orquesta-specific panels - Only shown for Orquesta mode */}
        {queryType === 'orquesta' && (
          <>
            {/* Task Result Panel */}
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
                      onClick={clearTaskResult}
                      title="Clear task result"
                    >
                      clear
                    </button>
                    <button
                      className="btn btn--secondary"
                      onClick={() => copyToClipboard(taskResult)}
                      title="Copy task result"
                      disabled={!taskResult}
                    >
                      copy
                    </button>
                    <button
                      className="btn btn--secondary"
                      onClick={formatTaskResult}
                      title={`Format ${detectedTaskResultFormat.toUpperCase()}`}
                    >
                      format
                    </button>
                  </div>
                </div>
              </div>
              <div className="monaco-editor-container task-result-editor">
                <Editor
                  height="200px"
                  language={taskResultFormat === 'json' ? 'json' : 'yaml'}
                  value={taskResult}
                  onChange={(value) => handleTaskResultChange({ target: { value: value || '' } })}
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
                      onClick={fetchStackStormData}
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
                    <span className={`toggle-text fixed-width ${taskStatus === 'succeeded' ? 'succeeded' : 'failed'}`}>
                      {taskStatus === 'succeeded' ? 'succeeded' : 'failed    '}
                    </span>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={taskStatus === 'succeeded'}
                        onChange={(e) => setTaskStatus(e.target.checked ? 'succeeded' : 'failed')}
                        className="toggle-input"
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
