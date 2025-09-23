'use client'

import React, { useState, useEffect } from 'react'

export default function DebugTest() {
  const [testState, setTestState] = useState('Loading...')
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    try {
      console.log('DEBUG: React is working')
      setTestState('React state management works!')

      // Test if basic imports work
      const testElement = document.createElement('div')
      testElement.textContent = 'DOM manipulation works'
      console.log('DEBUG: DOM works')

      // Test fetch
      fetch('/api/health')
        .then(res => res.json())
        .then(data => {
          console.log('DEBUG: API fetch works', data)
          setTestState(prev => prev + ' | API fetch works!')
        })
        .catch(err => {
          console.error('DEBUG: API fetch failed', err)
          setErrors(prev => [...prev, `API fetch failed: ${err.message}`])
        })
    } catch (error) {
      console.error('DEBUG: Basic functionality failed', error)
      setErrors(prev => [...prev, `Basic functionality failed: ${error}`])
    }
  }, [])

  const testButtonClick = () => {
    console.log('DEBUG: Button click works')
    setTestState('Button clicks work!')
  }

  const testModalState = () => {
    setTestState('Modal state test - if you see this, React state is fine')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Debug Test Page</h1>

      <div className="space-y-4">
        <div className="p-4 bg-blue-100 rounded">
          <strong>Status:</strong> {testState}
        </div>

        {errors.length > 0 && (
          <div className="p-4 bg-red-100 rounded">
            <strong>Errors:</strong>
            <ul className="list-disc ml-4">
              {errors.map((error, i) => (
                <li key={i} className="text-red-800">{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-x-4">
          <button
            onClick={testButtonClick}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Button Click
          </button>

          <button
            onClick={testModalState}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test Modal State
          </button>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-bold">Console Instructions:</h3>
          <p>1. Open browser console (F12)</p>
          <p>2. Click the buttons above</p>
          <p>3. Look for "DEBUG:" messages in console</p>
          <p>4. Check for any error messages</p>
        </div>
      </div>
    </div>
  )
}