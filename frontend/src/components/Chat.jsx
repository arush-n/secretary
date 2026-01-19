import React, { useState, useRef, useEffect } from 'react'

// Mock advisor data
const advisorsData = [
    {
        id: 'warren_buffett',
        name: 'warren buffett',
        description: 'the oracle of omaha - seeks wonderful companies at fair prices with strong competitive moats and exceptional management.',
        personality: 'value investor focused on long-term wealth building'
    },
    {
        id: 'peter_lynch',
        name: 'peter lynch',
        description: 'former fidelity manager known for "invest in what you know" philosophy and growth investing expertise.',
        personality: 'growth investor who believes in thorough research'
    },
    {
        id: 'cathie_wood',
        name: 'cathie wood',
        description: 'innovation-focused investor specializing in disruptive technologies and exponential growth companies.',
        personality: 'technology and innovation focused investor'
    }
]

function Chat() {
    const [selectedAdvisor, setSelectedAdvisor] = useState(advisorsData[0].id)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState(null)
    const [showHistory, setShowHistory] = useState(false)
    const [conversationList, setConversationList] = useState([])
    const messagesEndRef = useRef(null)

    // ========== DELETE AFTER TESTING ==========
    const [testingMode, setTestingMode] = useState(true) // Start true for testing
    const [ragStats, setRagStats] = useState(null)
    // ========== END DELETE SECTION ==========

    const advisor = advisorsData.find(a => a.id === selectedAdvisor)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // ========== CHAT PERSISTENCE ==========

    // Generate unique conversation ID
    const generateConversationId = () => {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // Load chat history on mount
    useEffect(() => {
        loadChatHistory()
        loadConversationList()
    }, [])

    // Save to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0 && conversationId) {
            saveChatToLocalStorage()
        }
    }, [messages, conversationId])

    const loadChatHistory = () => {
        try {
            const savedConvId = localStorage.getItem('current_conversation_id')
            if (savedConvId) {
                const savedMessages = localStorage.getItem(`conversation_${savedConvId}`)
                if (savedMessages) {
                    setMessages(JSON.parse(savedMessages))
                    setConversationId(savedConvId)
                    return
                }
            }
            // Start new conversation
            const newConvId = generateConversationId()
            setConversationId(newConvId)
            localStorage.setItem('current_conversation_id', newConvId)
        } catch (error) {
            console.error('Error loading chat history:', error)
            const newConvId = generateConversationId()
            setConversationId(newConvId)
        }
    }

    const saveChatToLocalStorage = () => {
        try {
            localStorage.setItem(`conversation_${conversationId}`, JSON.stringify(messages))

            // Update conversation list metadata
            const metadata = {
                id: conversationId,
                lastMessage: messages[messages.length - 1]?.content?.substring(0, 50) || 'New conversation',
                timestamp: new Date().toISOString(),
                messageCount: messages.length
            }
            updateConversationList(metadata)
        } catch (error) {
            console.error('Error saving chat:', error)
        }
    }

    const loadConversationList = () => {
        try {
            const list = JSON.parse(localStorage.getItem('conversation_list') || '[]')
            setConversationList(list)
        } catch (error) {
            console.error('Error loading conversation list:', error)
        }
    }

    const updateConversationList = (metadata) => {
        try {
            let list = JSON.parse(localStorage.getItem('conversation_list') || '[]')
            const existingIndex = list.findIndex(c => c.id === metadata.id)

            if (existingIndex >= 0) {
                list[existingIndex] = metadata
            } else {
                list.push(metadata)
            }

            // Sort by timestamp (most recent first)
            list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

            localStorage.setItem('conversation_list', JSON.stringify(list))
            setConversationList(list)
        } catch (error) {
            console.error('Error updating conversation list:', error)
        }
    }

    const startNewConversation = () => {
        const newConvId = generateConversationId()
        setConversationId(newConvId)
        setMessages([])
        localStorage.setItem('current_conversation_id', newConvId)
    }

    const loadConversation = (convId) => {
        try {
            const savedMessages = localStorage.getItem(`conversation_${convId}`)
            if (savedMessages) {
                setMessages(JSON.parse(savedMessages))
                setConversationId(convId)
                localStorage.setItem('current_conversation_id', convId)
                setShowHistory(false)
            }
        } catch (error) {
            console.error('Error loading conversation:', error)
        }
    }

    const deleteConversation = async (convId, e) => {
        e.stopPropagation()
        try {
            // Delete from localStorage
            localStorage.removeItem(`conversation_${convId}`)
            let list = JSON.parse(localStorage.getItem('conversation_list') || '[]')
            list = list.filter(c => c.id !== convId)
            localStorage.setItem('conversation_list', JSON.stringify(list))
            setConversationList(list)

            // Delete from backend (SQLite + ChromaDB)
            try {
                await fetch(`http://localhost:5001/api/conversations/${convId}`, {
                    method: 'DELETE'
                })
            } catch (err) {
                console.warn('Backend delete failed:', err)
            }

            if (convId === conversationId) {
                startNewConversation()
            }
        } catch (error) {
            console.error('Error deleting conversation:', error)
        }
    }

    // ========== END CHAT PERSISTENCE ==========

    // ========== DELETE AFTER TESTING ==========
    // Fetch RAG stats on mount
    useEffect(() => {
        const fetchRagStats = async () => {
            try {
                const response = await fetch('http://localhost:5001/api/rag/stats')
                if (response.ok) {
                    const data = await response.json()
                    setRagStats(data)
                }
            } catch (error) {
                console.error('Error fetching RAG stats:', error)
            }
        }
        fetchRagStats()
    }, [])

    // Sync transactions to RAG
    const handleSyncRag = async () => {
        try {
            const response = await fetch('http://localhost:5001/api/rag/sync-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            const data = await response.json()
            alert(`Synced ${data.embedded_count} transactions to RAG`)
            // Refresh stats
            const statsResponse = await fetch('http://localhost:5001/api/rag/stats')
            if (statsResponse.ok) {
                setRagStats(await statsResponse.json())
            }
        } catch (error) {
            console.error('Error syncing RAG:', error)
            alert('Error syncing transactions')
        }
    }
    // ========== END DELETE SECTION ==========

    const handleSend = async (useRag = false) => {
        if (!input.trim() || isLoading) return

        const userMessage = { role: 'user', content: input }
        setMessages(prev => [...prev, userMessage])
        const userInput = input
        setInput('')
        setIsLoading(true)

        try {
            if (useRag) {
                // Agentic AI with full tool access (transactions + profile)
                // Include recent message history for conversation context
                const recentHistory = messages.slice(-6).map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp || new Date().toISOString()
                }))

                const response = await fetch('http://localhost:5001/api/chat/agentic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userInput,
                        conversation_id: conversationId,
                        message_history: recentHistory,
                        current_datetime: new Date().toISOString(),
                        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    })
                })

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json()

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response || 'Sorry, I couldn\'t generate a response.',
                    isRag: true,
                    toolCalls: data.tool_calls || []
                }])
            } else {
                // Non-RAG response (standard advisor)
                const response = await fetch('http://localhost:5001/chat/financial-advice', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: userInput,
                        advisor: selectedAdvisor
                    })
                })

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`)
                }

                const data = await response.json()

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: data.response || 'Sorry, I couldn\'t generate a response.',
                    isRag: false
                }])
            }
            setIsLoading(false)
        } catch (error) {
            console.error('Error sending message:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `I apologize, but I'm currently unable to connect to my AI systems. Please try again later.`
            }])
            setIsLoading(false)
        }
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend(true)  // Default to RAG mode
        }
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b border-gray-800 p-4 bg-black">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-light text-white">ai financial advisors</h1>
                        <p className="text-gray-500 mt-1 text-sm">get personalized financial advice</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* ========== DELETE AFTER TESTING ========== */}
                        <button
                            onClick={() => setTestingMode(!testingMode)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${testingMode
                                ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {testingMode ? '🔬 RAG Testing ON' : 'Production Mode'}
                        </button>
                        {/* ========== END DELETE SECTION ========== */}

                        {/* Chat History Controls */}
                        <button
                            onClick={startNewConversation}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                            title="Start new conversation"
                        >
                            ➕ New Chat
                        </button>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showHistory
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            title="View chat history"
                        >
                            📜 History
                        </button>

                        <label className="text-sm text-gray-400 font-medium">advisor:</label>
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

                {/* Conversation History Dropdown */}
                {showHistory && conversationList.length > 0 && (
                    <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-2 max-h-48 overflow-y-auto">
                        <div className="text-xs text-gray-400 mb-2 font-semibold">Recent Conversations</div>
                        {conversationList.slice(0, 10).map(conv => (
                            <div
                                key={conv.id}
                                className={`p-2 mb-1 rounded cursor-pointer flex justify-between items-center transition-colors ${conv.id === conversationId
                                    ? 'bg-blue-900/50 border border-blue-700'
                                    : 'bg-gray-800 hover:bg-gray-700'
                                    }`}
                                onClick={() => loadConversation(conv.id)}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white truncate">
                                        {conv.lastMessage || 'Empty conversation'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(conv.timestamp).toLocaleDateString()} • {conv.messageCount} messages
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => deleteConversation(conv.id, e)}
                                    className="ml-2 text-xs text-red-400 hover:text-red-300 px-1"
                                    title="Delete conversation"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {advisor && !testingMode && (
                    <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-white/10">
                        <p className="text-sm text-gray-300 leading-relaxed">{advisor.description}</p>
                    </div>
                )}

                {/* ========== DELETE AFTER TESTING ========== */}
                {testingMode && (
                    <div className="mt-3 p-3 bg-yellow-900/30 rounded-lg border border-yellow-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-300 font-medium">🔬 RAG Testing Mode Active</p>
                                <p className="text-xs text-yellow-200/70 mt-1">
                                    Responses will show side-by-side comparison: Without RAG vs With RAG (grounded in your data)
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-yellow-200/70">
                                    {ragStats?.available ? (
                                        <span>📊 {ragStats.collections?.transactions || 0} transactions in RAG</span>
                                    ) : (
                                        <span>⚠️ RAG not initialized</span>
                                    )}
                                </div>
                                <button
                                    onClick={handleSyncRag}
                                    className="px-2 py-1 bg-yellow-600 text-black text-xs rounded font-semibold hover:bg-yellow-500"
                                >
                                    Sync Data
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* ========== END DELETE SECTION ========== */}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center text-gray-500 mt-12">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-lg font-medium">
                                {testingMode ? 'test RAG grounding' : `start a conversation with ${advisor?.name}`}
                            </p>
                            <p className="text-sm mt-2 text-gray-600">
                                {testingMode
                                    ? 'ask questions about your spending to compare AI responses'
                                    : advisor?.personality
                                }
                            </p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx}>
                            {/* ========== DELETE AFTER TESTING ========== */}
                            {msg.role === 'comparison' ? (
                                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                                    <div className="text-xs text-yellow-400 font-semibold mb-3">🔬 A/B COMPARISON</div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Without RAG */}
                                        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                                            <div className="text-xs text-red-400 font-semibold mb-2 flex items-center gap-1">
                                                ❌ Without RAG (May Hallucinate)
                                            </div>
                                            <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                                {msg.original}
                                            </div>
                                        </div>

                                        {/* With RAG */}
                                        <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3">
                                            <div className="text-xs text-green-400 font-semibold mb-2 flex items-center gap-1">
                                                ✅ With RAG (Grounded in Your Data)
                                            </div>
                                            <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                                {msg.rag}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Context Used */}
                                    {msg.context && (
                                        <div className="mt-3 pt-3 border-t border-yellow-500/20">
                                            <div className="text-xs text-yellow-400/70 font-medium mb-1">
                                                📁 Context Retrieved: {msg.context.transactions_count} transactions
                                            </div>
                                            {msg.context.sample_data?.length > 0 && (
                                                <div className="text-xs text-gray-400 space-y-0.5">
                                                    {msg.context.sample_data.map((item, i) => (
                                                        <div key={i} className="truncate">• {item}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* ========== END DELETE SECTION ========== */
                                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-2xl rounded-lg px-4 py-3 border border-white/10 ${msg.role === 'user'
                                            ? 'bg-gray-800'
                                            : 'bg-gray-900'
                                            }`}
                                    >
                                        <div className="text-xs text-gray-400 mb-1 font-medium flex items-center gap-2">
                                            {msg.role === 'user' ? 'You' : advisor?.name}
                                            {msg.role === 'assistant' && msg.isRag !== undefined && (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${msg.isRag ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                                    {msg.isRag ? '✓ RAG' : 'No RAG'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm whitespace-pre-wrap leading-relaxed text-white">{msg.content}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-2xl rounded-lg px-4 py-3 bg-gray-900 border border-white/10">
                                <div className="text-xs text-gray-400 mb-1 font-medium">
                                    AI thinking...
                                </div>
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
                        placeholder="Ask about your finances (e.g., 'How much did I spend on dining?')"
                        rows={1}
                        disabled={isLoading}
                        className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 resize-none disabled:opacity-50"
                    />
                    <button
                        onClick={() => handleSend(true)}
                        disabled={!input.trim() || isLoading}
                        className="bg-green-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        title="Uses your transaction data for grounded responses"
                    >
                        🔍 RAG
                    </button>
                    <button
                        onClick={() => handleSend(false)}
                        disabled={!input.trim() || isLoading}
                        className="bg-gray-700 text-white px-4 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        title="Standard AI response without your data"
                    >
                        💬 No RAG
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    <span className="text-green-400">RAG</span> = grounded in your data | <span className="text-gray-400">No RAG</span> = general AI response
                </p>
            </div>
        </div>
    )
}

export default Chat
