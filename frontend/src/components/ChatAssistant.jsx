import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Send, Sparkles } from 'lucide-react';
import { addMessage, setLoading, setSuggestedFollowups } from '../store/chatSlice';
import { setFields } from '../store/interactionSlice';

export default function ChatAssistant() {
  const dispatch = useDispatch();
  const chat = useSelector((state) => state.chat);
  const form = useSelector((state) => state.interaction);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.loading]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || chat.loading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to Redux
    dispatch(addMessage({ role: 'user', content: userMessage }));
    dispatch(setLoading(true));

    // Construct full message history for the backend
    const updatedMessages = [...chat.messages, { role: 'user', content: userMessage }];

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages,
          current_fields: form,
        }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();

      // Dispatch actions to update state
      dispatch(addMessage({ role: 'assistant', content: data.reply }));
      
      // Update form fields reactively
      if (data.extracted_fields) {
        dispatch(setFields(data.extracted_fields));
      }
      
      // Set suggested follow-ups
      if (data.suggested_followups) {
        dispatch(setSuggestedFollowups(data.suggested_followups));
      }
    } catch (err) {
      console.error(err);
      dispatch(
        addMessage({
          role: 'assistant',
          content: 'Sorry, I encountered an error while processing your request. Please try again.',
        })
      );
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="card assistant-panel">
      <div className="card-title">
        <Sparkles size={16} style={{ color: 'var(--color-accent)' }} />
        AI Assistant
        <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
          Log interaction via chat
        </span>
      </div>

      <div className="chat-messages">
        {chat.messages.map((msg, index) => (
          <div
            key={index}
            className={`message-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
            dangerouslySetInnerHTML={{
              __html: msg.content
                .replace(/\n/g, '<br/>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/-\s(.*?)<br\/>/g, '<li>$1</li>')
            }}
          />
        ))}

        {chat.loading && (
          <div className="message-bubble assistant">
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-container">
        <div className="chat-input-wrapper">
          <input
            type="text"
            placeholder="Describe interaction..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={chat.loading}
          />
        </div>
        <button type="submit" className="chat-log-btn" disabled={chat.loading}>
          <Send size={14} /> Log
        </button>
      </form>
    </div>
  );
}
