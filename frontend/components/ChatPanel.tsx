'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/hooks/useLiveKit';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isConnected: boolean;
}

export default function ChatPanel({ messages, onSendMessage, isConnected }: ChatPanelProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputMessage.trim() && isConnected) {
      onSendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <h2 className="text-2xl font-bold mb-5 text-slate-100 flex items-center gap-2">
        <span>💬</span>
        <span>Chat History</span>
      </h2>

      {/* Chat Container */}
      <div className="h-[400px] overflow-y-auto p-4 bg-slate-900 rounded-lg mb-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-700/20 flex gap-2.5">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-xl">ℹ️</span>
              <span>
                {isConnected
                  ? "Chat is active. You can type messages or use voice."
                  : "Connect to start chatting."}
              </span>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-3 p-3 rounded-lg ${
                msg.sender === 'user'
                  ? 'bg-indigo-600/30 ml-8'
                  : msg.sender === 'agent'
                  ? 'bg-slate-700/30 mr-8'
                  : 'bg-slate-700/20'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {msg.sender === 'user' ? '👤' : msg.sender === 'agent' ? '🤖' : 'ℹ️'}
                </span>
                <div className="flex-1">
                  <div className="text-sm text-slate-400 mb-1">
                    {msg.sender === 'user' ? 'You' : msg.sender === 'agent' ? 'Agent 007' : 'System'}
                    <span className="ml-2 text-xs">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-slate-100 whitespace-pre-wrap">{msg.text}</div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="flex gap-2.5">
        <input
          type="text"
          placeholder={isConnected ? "Type a message..." : "Connect to chat..."}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isConnected}
          className="flex-1 px-3 py-3 border-2 border-slate-700 rounded-lg bg-slate-900 text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !inputMessage.trim()}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 transition-colors"
        >
          <span className="text-xl">📤</span>
          <span>Send</span>
        </button>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0f172a;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}
