import React, { useState } from 'react';
import { Sparkles, Send, X, Bot } from 'lucide-react';

export const AIStudyAssistantModal = ({ token, isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Namaste! I am your AI Exam Assistant. Ask me to explain concepts in simple Hindi, memory tricks, or detailed question rationales!' }
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userMsg = prompt.trim();
    setPrompt('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: userMsg })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { sender: 'bot', text: 'Unable to process query right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-20 lg:right-6 z-50 w-full max-w-sm bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] shadow-xl space-y-3 text-[#252525]">
      
      <div className="flex justify-between items-center border-b border-[#E2DACB] pb-2">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-[#244A73]" />
          <h3 className="text-xs font-bold text-[#244A73]">AI Study Assistant</h3>
        </div>
        <button onClick={onClose} className="p-1 text-[#66635D] hover:text-[#252525]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-64 overflow-y-auto custom-scrollbar space-y-2 p-1 text-xs">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
              m.sender === 'user'
                ? 'bg-[#244A73] text-white ml-auto font-medium'
                : 'bg-[#F7F3EA] border border-[#E2DACB] text-[#252525]'
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="text-[10px] text-[#244A73] font-bold animate-pulse">AI is writing explanation...</div>}
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-1.5 pt-1">
        <input
          type="text"
          placeholder="Ask e.g. Memory trick for fundamental rights..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="flex-1 bg-white border border-[#D5CDBF] text-[#252525] placeholder-[#8C867A] text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#244A73]"
        />
        <button type="submit" className="p-2 rounded-lg bg-[#244A73] hover:bg-[#1B3857] text-white font-bold">
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

    </div>
  );
};
