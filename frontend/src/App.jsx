import { useState } from 'react'
import * as yaml from 'js-yaml'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'

function App() {
  const [data, setData] = useState('{"name": "John Doe", "age": 30, "active": true}')
  const [expression, setExpression] = useState('$.name')
  const [queryType, setQueryType] = useState('orquesta')
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [resultType, setResultType] = useState('') // 'success', 'error', or ''
  const [detectedType, setDetectedType] = useState('')
  const [dataFormat, setDataFormat] = useState('json') // 'json' or 'yaml'
  const [detectedDataFormat, setDetectedDataFormat] = useState('json')
  const [st2Url, setSt2Url] = useState('http://localhost:9101')
  const [st2ApiKey, setSt2ApiKey] = useState('')
  const [st2ExecutionId, setSt2ExecutionId] = useState('')
  const [st2Loading, setSt2Loading] = useState(false)
  const [st2Collapsed, setSt2Collapsed] = useState(true)
  const [taskSucceeded, setTaskSucceeded] = useState(true) // For orquesta mode task status

  const detectDataFormat = (dataText) => {
    if (!dataText.trim()) return 'json'

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

  const formatData = () => {
    try {
      // Use the validation function for consistent parsing
      const parsedData = validateAndParseData(data)

      if (dataFormat === 'json') {
        setData(JSON.stringify(parsedData, null, 2))
      } else {
        setData(yaml.dump(parsedData, { indent: 2 }))
      }
    } catch (error) {
      // If formatting fails, leave data as is
      console.error('Format error:', error)
    }
  }

  const handleDataChange = (newData) => {
    setData(newData)
    const detected = detectDataFormat(newData)
    setDetectedDataFormat(detected)
    // Only auto-update format if user hasn't manually selected a different one
    // or if the detected format matches what user selected
    if (!newData.trim() || dataFormat === detected) {
      setDataFormat(detected)
    }
  }

  const handleDataFormatChange = (newFormat) => {
    if (newFormat === dataFormat) {
      return
    }

    if (!data.trim()) {
      setDataFormat(newFormat)
      return
    }

    try {
      // Parse the data as YAML (works for both JSON and YAML input)
      // Use the validation function for better error handling
      const parsedData = validateAndParseData(data)

      // Convert to the selected format
      if (newFormat === 'json') {
        setData(JSON.stringify(parsedData, null, 2))
      } else {
        setData(yaml.dump(parsedData, { indent: 2 }))
      }

      setDataFormat(newFormat)
      setDetectedDataFormat(newFormat)
    } catch (error) {
      // If conversion fails, just change format without converting data
      console.error('Conversion error:', error)
      setDataFormat(newFormat)
    }
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const clearData = () => {
    setData('')
    setDataFormat('json')
    setDetectedDataFormat('json')
  }

  const clearExpression = () => {
    setExpression('')
  }

  const evaluateExpression = async () => {
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

      const payload = {
        expression,
        data: queryType === 'orquesta'
          ? {
            ...parsedData,
            __task_status: taskSucceeded ? 'succeeded' : 'failed'
          }
          : parsedData  // For yaql/jinja2, send data as-is
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
        setResult(JSON.stringify(responseData.result, null, 2))
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

  const getDataFormatStatusText = () => {
    return `format: ${detectedDataFormat.toUpperCase()}`
  }

  const getDataFormatStatusClass = () => {
    return 'status-dot'
  }

  const fetchStackStormData = async () => {
    if (!st2Url || !st2ExecutionId) {
      setResult('StackStorm URL and Execution ID are required')
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
        setResult('StackStorm execution data loaded successfully!')
        setResultType('success')

      } else if (response.status === 401) {
        setResult('Authentication failed. Check your API key.')
        setResultType('error')
      } else if (response.status === 404) {
        setResult(`Execution ${st2ExecutionId} not found.`)
        setResultType('error')
      } else {
        const errorText = await response.text()
        setResult(`StackStorm API Error (${response.status}): ${errorText}`)
        setResultType('error')
      }
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setResult(`Connection Error: Could not connect to StackStorm at ${st2Url}. Check the URL and ensure StackStorm is running and CORS is configured.`)
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
          <span className="header-icon">⚙️</span>
          Orquestulator
        </h1>
        <p>Expression evaluator for Orquesta, YAQL, and Jinja2</p>
      </header>

      <div className="panes-container">
        {/* Query Pane - Full Width at Top */}
        <div className="pane query-pane">
          <div className="pane-header">
            <h3>
              <span className="pane-icon">Q</span>
              Query
            </h3>
            <div className="query-controls">
              <div className="query-type-buttons">
                <button
                  onClick={() => setQueryType('orquesta')}
                  className={`query-type-btn ${queryType === 'orquesta' ? 'active' : ''}`}
                >
                  ORQUESTA
                </button>
                <button
                  onClick={() => setQueryType('yaql')}
                  className={`query-type-btn ${queryType === 'yaql' ? 'active' : ''}`}
                >
                  YAQL
                </button>
                <button
                  onClick={() => setQueryType('jinja2')}
                  className={`query-type-btn ${queryType === 'jinja2' ? 'active' : ''}`}
                >
                  JINJA2
                </button>
              </div>
              <div className="action-buttons">
                <button
                  className="clear-btn"
                  onClick={clearExpression}
                  title="Clear expression"
                >
                  clear
                </button>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(expression)}
                  title="Copy expression"
                  disabled={!expression}
                >
                  copy
                </button>
                <button
                  onClick={evaluateExpression}
                  disabled={isLoading}
                  className={`evaluate-btn ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? '' : 'eval'}
                </button>
              </div>
            </div>
          </div>
          <div className="code-input-container">
            <SyntaxHighlighter
              language={queryType === 'yaql' ? 'javascript' : 'django'}
              style={vscDarkPlus}
              className="code-area-highlight"
              customStyle={{
                margin: 0,
                padding: '12px',
                fontSize: '14px',
                fontFamily: 'Consolas, Monaco, monospace',
                backgroundColor: 'transparent',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
              }}
            >
              {expression || ' '}
            </SyntaxHighlighter>
            <textarea
              className="code-area code-area-overlay"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="$.key or {{ name }}"
              onKeyDown={handleKeyPress}
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
              {queryType === 'orquesta' && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={taskSucceeded}
                    onChange={(e) => setTaskSucceeded(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className={`checkbox-text ${taskSucceeded ? 'succeeded' : 'failed'}`}>
                    {taskSucceeded ? 'succeeded' : 'failed'}
                  </span>
                </label>
              )}
              <div className="data-format-buttons">
                <button
                  className={`data-format-btn ${dataFormat === 'json' ? 'active' : ''}`}
                  onClick={() => handleDataFormatChange('json')}
                >
                  JSON
                </button>
                <button
                  className={`data-format-btn ${dataFormat === 'yaml' ? 'active' : ''}`}
                  onClick={() => handleDataFormatChange('yaml')}
                >
                  YAML
                </button>
              </div>
              <div className="data-actions">
                <button
                  className="clear-btn"
                  onClick={clearData}
                  title={queryType === 'orquesta' ? "Clear context" : "Clear data"}
                >
                  clear
                </button>
                <button
                  className="copy-btn"
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
          <div className="code-input-container">
            <SyntaxHighlighter
              language={dataFormat === 'json' ? 'json' : 'yaml'}
              style={vscDarkPlus}
              className="code-highlighter"
              customStyle={{
                margin: 0,
                background: 'transparent',
                padding: '12px',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
                overflow: 'hidden'
              }}
            >
              {data || ' '}
            </SyntaxHighlighter>
            <textarea
              className="code-area code-area-overlay"
              value={data}
              onChange={(e) => handleDataChange(e.target.value)}
              placeholder={
                queryType === 'orquesta'
                  ? (dataFormat === 'json'
                    ? '{"user_var": "value", "__task_status": "succeeded", "__task_result": {"output": "success"}}'
                    : 'user_var: value\n__task_status: succeeded\n__task_result:\n  output: success')
                  : (dataFormat === 'json'
                    ? '{"key": "value", "items": [1, 2, 3]}'
                    : 'name: John Doe\nage: 30\nactive: true')
              }
              onKeyDown={handleKeyPress}
            />
          </div>
          {queryType === 'orquesta' ? (
            // Orquesta mode: Split Context and Result panes
            <div className="pane orquesta-split-pane">
            // Context Pane
              <div className="split-section">
                <div className="pane-header">
                  <h3>
                    <span className="pane-icon">C</span>
                    Context
                  </h3>
                  <div className="data-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={taskSucceeded}
                        onChange={(e) => setTaskSucceeded(e.target.checked)}
                        className="checkbox-input"
                      />
                      <span className={`checkbox-text ${taskSucceeded ? 'succeeded' : 'failed'}`}>
                        {taskSucceeded ? 'succeeded' : 'failed'}
                      </span>
                    </label>
                    <div className="data-format-buttons">
                      <button
                        className={`data-format-btn ${dataFormat === 'json' ? 'active' : ''}`}
                        onClick={() => handleDataFormatChange('json')}
                      >
                        JSON
                      </button>
                      <button
                        className={`data-format-btn ${dataFormat === 'yaml' ? 'active' : ''}`}
                        onClick={() => handleDataFormatChange('yaml')}
                      >
                        YAML
                      </button>
                    </div>
                    <div className="data-actions">
                      <button
                        className="clear-btn"
                        onClick={clearData}
                        title="Clear context"
                      >
                        clear
                      </button>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(data)}
                        title="Copy context"
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
                <div className="code-input-container">
                  <SyntaxHighlighter
                    language={dataFormat === 'json' ? 'json' : 'yaml'}
                    style={vscDarkPlus}
                    className="code-highlighter"
                    customStyle={{
                      margin: 0,
                      background: 'transparent',
                      padding: '12px',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      pointerEvents: 'none',
                      overflow: 'hidden'
                    }}
                  >
                    {data || ' '}
                  </SyntaxHighlighter>
                  <textarea
                    className="code-area code-area-overlay"
                    value={data}
                    onChange={(e) => handleDataChange(e.target.value)}
                    placeholder={dataFormat === 'json' ? '{"user_var": "value"}' : 'user_var: value'}
                    onKeyDown={handleKeyPress}
                  />
                </div>
              </div>
            </div>
        {/* Result Pane - Right Side */}
          <div className="pane">
            <div className="pane-header">
              <h3>
                <span className="pane-icon">R</span>
                Result
              </h3>
              <div className="result-header">
                <div className="status-indicator">
                  <span className={getStatusDotClass()}></span>
                  {getStatusText()}
                </div>
                {result && (
                  <button
                    className="copy-btn"
                    onClick={() => copyToClipboard(result)}
                  >
                    copy
                  </button>
                )}
              </div>
            </div>
            {result ? (
              <SyntaxHighlighter
                language="json"
                style={vscDarkPlus}
                className={`result-display ${resultType ? `result-${resultType}` : ''}`}
                customStyle={{
                  margin: '0 0 8px 0',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '4px'
                }}
              >
                {result}
              </SyntaxHighlighter>
            ) : (
              <pre className="result-display result-placeholder">
              // awaiting evaluation...
              </pre>
            )}
          </div>
        </div>

        {/* StackStorm Section - Bottom */}
        <div className="stackstorm-section">
          <div className="stackstorm-header">
            <h3
              className="stackstorm-title"
              onClick={() => setSt2Collapsed(!st2Collapsed)}
            >
              <span className="pane-icon">S</span>
              StackStorm Integration
              <span className={`collapse-arrow ${st2Collapsed ? 'collapsed' : 'expanded'}`}>▼</span>
            </h3>
            {!st2Collapsed && (
              <button
                className="fetch-btn"
                onClick={fetchStackStormData}
                disabled={st2Loading}
              >
                {st2Loading ? 'fetching...' : 'fetch execution data'}
              </button>
            )}
          </div>
          {!st2Collapsed && (
            <>
              <div className="stackstorm-controls">
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
              <div className="stackstorm-note">
                <p><strong>Note:</strong> StackStorm must be configured with CORS headers to allow browser connections. Add <code>allowed_origins = ["http://localhost:5173"]</code> to your StackStorm configuration.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
