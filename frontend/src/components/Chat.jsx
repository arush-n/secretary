import React, { useState, useRef, useEffect } from 'react'

// Mock advisor data
const advisorsData = [
  {
    id: 'warren_buffett',
    name: 'Warren Buffett',
    description: 'The Oracle of Omaha - seeks wonderful companies at fair prices with strong competitive moats and exceptional management.',
    personality: 'Value investor focused on long-term wealth building'
  },
  {
    id: 'peter_lynch',
    name: 'Peter Lynch',
    description: 'Former Fidelity manager known for "invest in what you know" philosophy and growth investing expertise.',
    personality: 'Growth investor who believes in thorough research'
  },
  {
    id: 'cathie_wood',
    name: 'Cathie Wood',
    description: 'Innovation-focused investor specializing in disruptive technologies and exponential growth companies.',
    personality: 'Technology and innovation focused investor'
  }
]

function Chat() {
  const [selectedAdvisor, setSelectedAdvisor] = useState(advisorsData[0].id)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const advisor = advisorsData.find(a => a.id === selectedAdvisor)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Mock AI response (replace with actual API call)
      setTimeout(() => {
        const responses = [
          `As ${advisor.name}, I'd say that's an interesting question about your finances. Let me share some thoughts based on my investment philosophy...`,
          `From my perspective as ${advisor.name}, here's how I would approach this situation...`,
          `That's a great question! As ${advisor.name}, I believe the key principle here is...`,
          `Let me give you some advice as ${advisor.name}. In my experience...`
        ]
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
        
        setMessages(prev => [...prev, { role: 'assistant', content: randomResponse }])
        setIsLoading(false)
      }, 1000 + Math.random() * 2000)
    } catch (error) {
      console.error('Error sending message:', error)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 bg-black">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-light text-white">AI Financial Advisors</h1>
            <p className="text-gray-500 mt-1 text-sm">Get personalized financial advice</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400 font-medium">Advisor:</label>
            <select
              value={selectedAdvisor}
              onChange={(e) => setSelectedAdvisor(e.target.value)}
              className="bg-gray-900 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 font-medium"
            >
              {advisorsData.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {advisor && (
          <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-300 leading-relaxed">{advisor.description}</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Start a conversation with {advisor?.name}</p>
              <p className="text-sm mt-2 text-gray-600">{advisor?.personality}</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-gray-900 border border-gray-700'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1 font-medium">
                  {msg.role === 'user' ? 'You' : advisor?.name}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed text-white">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-2xl rounded-lg px-4 py-3 bg-gray-900 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1 font-medium">{advisor?.name}</div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-6 bg-black">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask your financial advisor..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 resize-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

export default Chat