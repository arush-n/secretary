'use client';

import { useState, useEffect, useRef } from 'react';
import advisorsData from '@/data/advisors.json';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Tab = 'chat' | 'budgeting' | 'investments' | 'vacations' | 'dashboard';

interface ChatHistory {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
}

export default function HomePage() {
  const [selectedAdvisor, setSelectedAdvisor] = useState(advisorsData[0].id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const advisor = advisorsData.find(a => a.id === selectedAdvisor);

  // Load from localStorage on mount
  useEffect(() => {
    const savedAdvisor = localStorage.getItem('selectedAdvisor');
    const savedMessages = localStorage.getItem('chatMessages');
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    const savedTab = localStorage.getItem('activeTab');
    const savedHistory = localStorage.getItem('chatHistory');
    const savedCurrentChatId = localStorage.getItem('currentChatId');
    
    if (savedAdvisor && advisorsData.find(a => a.id === savedAdvisor)) {
      setSelectedAdvisor(savedAdvisor);
    }
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error('Failed to parse saved messages');
      }
    }
    if (savedSidebarState !== null) {
      setSidebarOpen(savedSidebarState === 'true');
    }
    if (savedTab) {
      setActiveTab(savedTab as Tab);
    }
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse chat history');
      }
    }
    if (savedCurrentChatId) {
      setCurrentChatId(savedCurrentChatId);
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('selectedAdvisor', selectedAdvisor);
  }, [selectedAdvisor]);

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen.toString());
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem('currentChatId', currentChatId);
    }
  }, [currentChatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisorId: selectedAdvisor,
          messages: newMessages,
        }),
      });

      const data = await response.json();
      
      if (data.reply) {
        const assistantMessage: Message = { role: 'assistant', content: data.reply };
        const finalMessages = [...newMessages, assistantMessage];
        setMessages(finalMessages);
        // Auto-save chat after response
        setTimeout(() => saveCurrentChat(), 500);
      } else if (data.error) {
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: `Error: ${data.error}` 
        }]);
      }
    } catch (error) {
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    if (confirm('Clear all messages?')) {
      setMessages([]);
    }
  };

  const saveCurrentChat = () => {
    if (messages.length === 0) return;
    
    const title = messages[0].content.slice(0, 50) + (messages[0].content.length > 50 ? '...' : '');
    const chatId = currentChatId || Date.now().toString();
    
    const newChat: ChatHistory = {
      id: chatId,
      title,
      timestamp: Date.now(),
      messages: [...messages],
    };

    setChatHistory(prev => {
      const filtered = prev.filter(c => c.id !== chatId);
      return [newChat, ...filtered].slice(0, 20); // Keep last 20 chats
    });
    
    setCurrentChatId(chatId);
  };

  const loadChat = (chat: ChatHistory) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setActiveTab('chat');
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      saveCurrentChat();
    }
    setMessages([]);
    setCurrentChatId(null);
  };

  const deleteChat = (chatId: string) => {
    setChatHistory(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Left Sidebar */}
      <div 
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-black border-r border-gray-800 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 p-3 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium lowercase">new chat</span>
          </button>
        </div>
        
        <div className="flex-1 p-4 space-y-2">
          {/* Chat Tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full rounded-lg p-3 border transition-all ${
              activeTab === 'chat'
                ? 'bg-gray-900 border-gray-700'
                : 'bg-transparent border-transparent hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium lowercase">chat</span>
            </div>
          </button>

          {/* Budgeting Tab */}
          <button
            onClick={() => setActiveTab('budgeting')}
            className={`w-full rounded-lg p-3 border transition-all ${
              activeTab === 'budgeting'
                ? 'bg-gray-900 border-gray-700'
                : 'bg-transparent border-transparent hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="font-medium lowercase">budgeting</span>
            </div>
          </button>

          {/* Investments Tab */}
          <button
            onClick={() => setActiveTab('investments')}
            className={`w-full rounded-lg p-3 border transition-all ${
              activeTab === 'investments'
                ? 'bg-gray-900 border-gray-700'
                : 'bg-transparent border-transparent hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-medium lowercase">investments</span>
            </div>
          </button>

          {/* Vacations Tab */}
          <button
            onClick={() => setActiveTab('vacations')}
            className={`w-full rounded-lg p-3 border transition-all ${
              activeTab === 'vacations'
                ? 'bg-gray-900 border-gray-700'
                : 'bg-transparent border-transparent hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium lowercase">vacations</span>
            </div>
          </button>

          {/* Financial Dashboard Tab */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full rounded-lg p-3 border transition-all ${
              activeTab === 'dashboard'
                ? 'bg-gray-900 border-gray-700'
                : 'bg-transparent border-transparent hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-medium lowercase">financial dashboard</span>
            </div>
          </button>
        </div>

        {/* Chat History Section */}
        <div className="flex-1 overflow-y-auto border-t border-gray-800">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">recent chats</h3>
            <div className="space-y-1">
              {chatHistory.length === 0 ? (
                <p className="text-xs text-gray-600 lowercase py-2">no chat history yet</p>
              ) : (
                chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    className="group relative"
                  >
                    <button
                      onClick={() => loadChat(chat)}
                      className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                        currentChatId === chat.id
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-400 hover:bg-gray-900/50 hover:text-white'
                      }`}
                    >
                      <div className="lowercase truncate pr-6">{chat.title}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(chat.timestamp).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-800 rounded transition-opacity"
                      title="Delete chat"
                    >
                      <svg className="w-4 h-4 text-gray-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={clearChat}
            className="w-full text-sm text-gray-400 hover:text-white transition-colors font-medium lowercase"
          >
            clear current chat
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with logo and advisor dropdown at top */}
        <div className="border-b border-gray-800 p-4 bg-black">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Logo, Toggle and Advisor Dropdown */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-900 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Logo */}
              <div className="flex items-center gap-2">
                <img 
                  src="/secretary-logo.png" 
                  alt="Secretary Logo" 
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <h1 className="text-lg font-semibold tracking-tight lowercase">secretary</h1>
                  <p className="text-xs text-gray-500 font-medium lowercase">ai financial advisor</p>
                </div>
              </div>

              {activeTab === 'chat' && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400 font-medium lowercase">advisor:</label>
                  <select
                    value={selectedAdvisor}
                    onChange={(e) => setSelectedAdvisor(e.target.value)}
                    className="bg-gray-900 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500 font-medium lowercase"
                  >
                    {advisorsData.map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.name.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Right side - About toggle */}
            {advisor && activeTab === 'chat' && (
              <button
                onClick={() => setShowAbout(!showAbout)}
                className="text-sm text-gray-400 hover:text-white transition-colors font-medium lowercase"
              >
                {showAbout ? 'hide info' : 'show info'}
              </button>
            )}
          </div>
          
          {showAbout && advisor && (
            <div className="mt-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300 leading-relaxed">{advisor.description}</p>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Chat Tab Content */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium lowercase">start a conversation with {advisor?.name.toLowerCase()}</p>
                  <p className="text-sm mt-2 text-gray-600 lowercase">{advisor?.description.toLowerCase()}</p>
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
                    <div className="text-xs text-gray-400 mb-1 font-medium lowercase">
                      {msg.role === 'user' ? 'you' : advisor?.name.toLowerCase()}
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-2xl rounded-lg px-4 py-3 bg-gray-900 border border-gray-700">
                    <div className="text-xs text-gray-400 mb-1 font-medium lowercase">{advisor?.name.toLowerCase()}</div>
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
          )}

          {/* Budgeting Tab Content */}
          {activeTab === 'budgeting' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold lowercase mb-2">budgeting</h2>
                <p className="text-gray-400 text-sm lowercase">track your spending and manage your budget</p>
              </div>
              <div className="text-center text-gray-500 mt-20">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium lowercase">budgeting tools coming soon</p>
                <p className="text-sm mt-2 text-gray-600 lowercase">set spending limits and track expenses</p>
              </div>
            </div>
          )}

          {/* Investments Tab Content */}
          {activeTab === 'investments' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold lowercase mb-2">investments</h2>
                <p className="text-gray-400 text-sm lowercase">monitor your portfolio and investment performance</p>
              </div>
              <div className="text-center text-gray-500 mt-20">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-lg font-medium lowercase">investment tracking coming soon</p>
                <p className="text-sm mt-2 text-gray-600 lowercase">analyze your portfolio and investment returns</p>
              </div>
            </div>
          )}

          {/* Vacations Tab Content */}
          {activeTab === 'vacations' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold lowercase mb-2">vacations</h2>
                <p className="text-gray-400 text-sm lowercase">plan and budget for your dream getaways</p>
              </div>
              <div className="text-center text-gray-500 mt-20">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium lowercase">vacation planning coming soon</p>
                <p className="text-sm mt-2 text-gray-600 lowercase">save and budget for your next adventure</p>
              </div>
            </div>
          )}

          {/* Financial Dashboard Tab Content */}
          {activeTab === 'dashboard' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold lowercase mb-2">financial dashboard</h2>
                <p className="text-gray-400 text-sm lowercase">comprehensive overview of your finances</p>
              </div>
              <div className="text-center text-gray-500 mt-20">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium lowercase">financial dashboard coming soon</p>
                <p className="text-sm mt-2 text-gray-600 lowercase">all your financial data in one place</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area - Only show for chat tab */}
        {activeTab === 'chat' && (
          <div className="border-t border-gray-800 p-6 bg-black">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="ask your secretary..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 resize-none disabled:opacity-50 lowercase placeholder:lowercase"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed lowercase"
              >
                send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 lowercase">
              press enter to send, shift+enter for new line
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
