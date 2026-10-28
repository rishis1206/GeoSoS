import { useState, useEffect } from 'react'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

const MODELS = [
  'gemini-2.5-flash'
]

async function askGemini(prompt) {
  for (const model of MODELS) {
    for (let retry = 0; retry < 3; retry++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        )

        if (response.status === 503) {
          console.log(`503 from ${model}. Retrying ${retry + 1}/3...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }

        if (response.status === 429) {
          return null
        }

        if (!response.ok) {
          continue
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (text) {
          return text
        }

      } catch (err) {
        console.error(`${model} failed:`, err)
      }
    }
  }
  return null
}

export default function AIAssistant({ category, description, language = 'en' }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [severity, setSeverity] = useState('medium')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)

  const getLanguagePrompt = (lang) => {
    const prompts = {
      en: 'You MUST respond ONLY in English. Do not use any other language.',
      hi: 'You MUST respond ONLY in Hindi using Devanagari script. Do not use English or any other language.',
      kn: 'You MUST respond ONLY in Kannada script. Do not use English or any other language.'
    }
    return prompts[lang] || prompts.en
  }

  useEffect(() => {
    const analyzeEmergency = async () => {
      const languageInstruction = getLanguagePrompt(language)
      
      const prompt = `You are an emergency analysis AI. Analyze this emergency situation:
Category: ${category?.replace('_', ' ') || 'unknown'}
Description: ${description || 'No description provided'}

${languageInstruction}.

Provide a JSON response with this exact structure:
{
  "severity": "low|medium|high|critical",
  "severity_reason": "brief explanation",
  "immediate_actions": ["action 1", "action 2", "action 3"],
  "what_not_to_do": ["don't 1", "don't 2"],
  "safety_precautions": ["precaution 1", "precaution 2"],
  "reassurance": "calming message",
  "recommendation": "call emergency services|wait for volunteer"
}

Keep responses brief and actionable. Return ONLY valid JSON.`

      try {
        const reply = await askGemini(prompt)
        if (reply) {
          // Try to parse JSON from response
          const jsonMatch = reply.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            setAnalysis(parsed)
            setSeverity(parsed.severity || 'medium')
          } else {
            // Fallback if JSON parsing fails
            setAnalysis({
              severity: 'medium',
              severity_reason: 'Unable to determine severity',
              immediate_actions: ['Stay calm', 'Stay in safe location', 'Wait for help'],
              what_not_to_do: ['Do not panic', 'Do not move unless necessary'],
              safety_precautions: ['Stay aware of surroundings', 'Keep phone accessible'],
              reassurance: 'Help is on the way. Stay calm.',
              recommendation: 'wait for volunteer'
            })
          }
        }
      } catch (err) {
        console.error('AI analysis failed:', err)
        setAnalysis({
          severity: 'medium',
          severity_reason: 'AI analysis unavailable',
          immediate_actions: ['Stay calm', 'Stay in safe location', 'Wait for help'],
          what_not_to_do: ['Do not panic', 'Do not move unless necessary'],
          safety_precautions: ['Stay aware of surroundings', 'Keep phone accessible'],
          reassurance: 'Help is on the way. Stay calm.',
          recommendation: 'wait for volunteer'
        })
      } finally {
        setLoading(false)
      }
    }

    analyzeEmergency()
  }, [category, description])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    const languageInstruction = getLanguagePrompt(language)
    const prompt = `You are an emergency assistant helping someone in distress. 
Emergency Category: ${category?.replace('_', ' ') || 'unknown'}
Emergency Description: ${description || 'No description provided'}

${languageInstruction}.

User asks: ${userMessage}

Provide a helpful, calm, and reassuring response. Keep it concise and actionable.`

    try {
      const reply = await askGemini(prompt)
      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'I apologize, but I am unable to respond right now. Please stay calm and wait for help.' }])
      }
    } catch (err) {
      console.error('Chat failed:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'I apologize, but I am unable to respond right now. Please stay calm and wait for help.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const getSeverityColor = (sev) => {
    switch(sev) {
      case 'low': return '#00cc44'
      case 'medium': return '#ffaa00'
      case 'high': return '#ff6600'
      case 'critical': return '#cc0000'
      default: return '#ffaa00'
    }
  }

  const getSeverityLabel = (sev) => {
    switch(sev) {
      case 'low': return '🟢 Low'
      case 'medium': return '🟡 Medium'
      case 'high': return '🟠 High'
      case 'critical': return '⚫ Critical'
      default: return '🟡 Medium'
    }
  }

  if (loading) {
    return (
      <div style={{ background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '20px' }}>
        <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '16px' }}>
          ✦ AI Emergency Analysis
        </div>
        <div style={{ fontSize: '12px', color: '#555', letterSpacing: '2px' }}>
          Analyzing emergency situation...
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '4px', padding: '20px' }}>
      <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '16px' }}>
        ✦ AI Emergency Analysis
      </div>

      {/* Severity Indicator */}
      <div style={{ 
        background: '#110000', 
        border: `1px solid ${getSeverityColor(severity)}`, 
        borderRadius: '4px', 
        padding: '16px', 
        marginBottom: '16px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Severity Assessment
          </div>
          <div style={{ fontSize: '12px', color: getSeverityColor(severity), letterSpacing: '2px', fontWeight: '600' }}>
            {getSeverityLabel(severity)}
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#666', letterSpacing: '1px' }}>
          {analysis?.severity_reason || 'Unable to determine severity'}
        </div>
      </div>

      {/* Immediate Actions */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
          ⚡ Immediate Actions
        </div>
        {analysis?.immediate_actions?.map((action, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '6px',
            fontSize: '12px', 
            color: '#aaa', 
            letterSpacing: '1px' 
          }}>
            <span style={{ color: '#cc0000' }}>{i + 1}.</span>
            <span>{action}</span>
          </div>
        ))}
      </div>

      {/* What NOT To Do */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#ff6600', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
          🚫 What NOT To Do
        </div>
        {analysis?.what_not_to_do?.map((dont, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '6px',
            fontSize: '12px', 
            color: '#888', 
            letterSpacing: '1px' 
          }}>
            <span style={{ color: '#ff6600' }}>✗</span>
            <span>{dont}</span>
          </div>
        ))}
      </div>

      {/* Safety Precautions */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: '#00cc44', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
          🛡️ Safety Precautions
        </div>
        {analysis?.safety_precautions?.map((precaution, i) => (
          <div key={i} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '6px',
            fontSize: '12px', 
            color: '#aaa', 
            letterSpacing: '1px' 
          }}>
            <span style={{ color: '#00cc44' }}>✓</span>
            <span>{precaution}</span>
          </div>
        ))}
      </div>

      {/* Reassurance */}
      {analysis?.reassurance && (
        <div style={{ 
          background: '#001a00', 
          border: '1px solid #00cc44', 
          borderRadius: '4px', 
          padding: '12px', 
          marginBottom: '16px' 
        }}>
          <div style={{ fontSize: '11px', color: '#00cc44', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
            💬 Stay Calm
          </div>
          <div style={{ fontSize: '12px', color: '#aaa', letterSpacing: '1px', lineHeight: '1.5' }}>
            {analysis.reassurance}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {analysis?.recommendation && (
        <div style={{ 
          background: analysis.recommendation === 'call emergency services' ? '#1a0000' : '#001a1a',
          border: analysis.recommendation === 'call emergency services' ? '1px solid #cc0000' : '1px solid #00cccc',
          borderRadius: '4px', 
          padding: '12px',
          marginBottom: '16px' 
        }}>
          <div style={{ fontSize: '11px', color: analysis.recommendation === 'call emergency services' ? '#cc0000' : '#00cccc', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '6px' }}>
            📞 AI Recommendation
          </div>
          <div style={{ fontSize: '12px', color: '#aaa', letterSpacing: '1px' }}>
            {analysis.recommendation === 'call emergency services' 
              ? 'Consider calling emergency services (911/112) for immediate professional assistance.'
              : 'Wait for volunteer response. Help is on the way.'}
          </div>
        </div>
      )}

      {/* Chat Toggle Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        style={{ 
          width: '100%', 
          padding: '10px', 
          background: '#111', 
          border: '1px solid #cc0000', 
          color: '#cc0000', 
          fontFamily: 'Oswald, sans-serif', 
          fontSize: '11px', 
          letterSpacing: '2px', 
          textTransform: 'uppercase', 
          cursor: 'pointer', 
          borderRadius: '3px' 
        }}
      >
        {showChat ? '✕ Close AI Chat' : '💬 Chat with AI Assistant'}
      </button>

      {/* Chat Interface */}
      {showChat && (
        <div style={{ 
          marginTop: '16px', 
          background: '#0a0a0a', 
          border: '1px solid #1c1c1c', 
          borderRadius: '4px', 
          padding: '16px' 
        }}>
          <div style={{ fontSize: '11px', color: '#cc0000', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>
            💬 AI Emergency Chat
          </div>
          
          {/* Messages */}
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            marginBottom: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {messages.length === 0 && (
              <div style={{ fontSize: '12px', color: '#444', textAlign: 'center', padding: '20px' }}>
                Ask me anything about your emergency situation
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                background: msg.role === 'user' ? '#1a1a1a' : '#0d0d0d',
                border: msg.role === 'user' ? '1px solid #333' : '1px solid #cc0000',
                borderRadius: '4px',
                padding: '10px 12px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                fontSize: '12px',
                color: '#aaa',
                letterSpacing: '0.5px',
                lineHeight: '1.4'
              }}>
                {msg.content}
              </div>
            ))}
            {chatLoading && (
              <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                AI is thinking...
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask a question..."
              disabled={chatLoading}
              style={{
                flex: 1,
                background: '#111',
                border: '1px solid #222',
                color: '#fff',
                padding: '10px 12px',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '12px',
                letterSpacing: '1px',
                borderRadius: '3px',
                outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={chatLoading || !input.trim()}
              style={{
                padding: '10px 16px',
                background: '#cc0000',
                border: 'none',
                color: '#fff',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: chatLoading || !input.trim() ? 'not-allowed' : 'pointer',
                borderRadius: '3px',
                opacity: chatLoading || !input.trim() ? 0.5 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}