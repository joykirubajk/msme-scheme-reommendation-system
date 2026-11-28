import React, { useState, useRef, useEffect } from 'react';
import { chatAPI } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { normalizeScheme, errorMessage } from '../utils/format';
import SchemeDetails from './SchemeDetails';
import '../styles/ChatWidget.css';

const SUGGESTIONS = {
  en: [
    'Tamil Nadu 5 lakh pickle unit',
    'PMEGP subsidy details',
    'Women manufacturing loan 10L',
  ],
  ta: [
    'Tamil Nadu 5 lakh pickle unit',
    'PMEGP subsidy evlo?',
    'Women business schemes',
  ],
};

function ChatWidget() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const initialGreeting = (currentLang) => ({
    sender: 'bot',
    text:
      currentLang === 'ta'
        ? 'வணக்கம்! உங்கள் தொழில், முதலீடு (எ.கா. "5 lakh"), மாநிலம் அல்லது திட்டத்தின் பெயரைக் கேளுங்கள்.'
        : 'Hi! Ask me about MSME schemes by sharing your business idea, investment (e.g. "5 lakh"), and state.',
    schemes: [],
  });

  const [messages, setMessages] = useState(() => [initialGreeting(lang)]);

  const handleClearChat = () => {
    setMessages([initialGreeting(lang)]);
    setInput('');
    setSelectedScheme(null);
  };

  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendText = async (textToSend) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    setMessages((prev) => [...prev, { sender: 'user', text: trimmed, schemes: [] }]);
    setInput('');
    setSending(true);

    try {
      const res = await chatAPI.sendMessage(trimmed, lang);
      const data = res?.data || {};
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: data.reply || 'Here is what I found:',
          schemes: (data.schemes || []).map(normalizeScheme),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: errorMessage(err, 'Could not reach the assistant right now. Please try again.'),
          schemes: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendText(input);
  };

  return (
    <>
      {open && (
        <div className="chat-window" role="dialog" aria-label="MSME Assistant">
          <div className="chat-header">
            <div>
              <div className="chat-header-title">
                {lang === 'ta' ? 'MSME திட்ட உதவியாளர்' : 'MSME Scheme Assistant'}
              </div>
              <div className="chat-header-sub">
                {lang === 'ta' ? 'ஆஃப்லைன் ஸ்மார்ட் தேடல்' : 'Smart offline scheme finder'}
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-clear"
                onClick={handleClearChat}
                disabled={sending}
                title={lang === 'ta' ? 'உரையாடலை அழி' : 'Clear chat'}
              >
                {lang === 'ta' ? 'அழி' : 'Clear'}
              </button>
              <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
          </div>

          <div className="chat-chips">
            {(SUGGESTIONS[lang] || SUGGESTIONS.en).map((chip) => (
              <button key={chip} type="button" className="chat-chip" onClick={() => sendText(chip)}>
                {chip}
              </button>
            ))}
          </div>

          <div className="chat-messages" ref={listRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`chat-msg ${m.sender === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`}>
                <div>{m.text}</div>
                {m.schemes && m.schemes.length > 0 && (
                  <div className="chat-schemes">
                    {m.schemes.map((s) => (
                      <div key={s.id} className="chat-scheme-card">
                        <div className="chat-scheme-head">
                          <span>{s.name}</span>
                          {typeof s.score === 'number' && (
                            <span className="chat-scheme-score">{Math.round(s.score * 100)}%</span>
                          )}
                        </div>
                        {s.reasons?.[0] && <p className="chat-scheme-reason">{s.reasons[0]}</p>}
                        <button
                          type="button"
                          className="chat-scheme-link"
                          onClick={() => setSelectedScheme(s)}
                        >
                          {lang === 'ta' ? 'முழு விவரம் →' : 'View Details →'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="chat-msg chat-msg-bot">
                {lang === 'ta' ? 'தேடுகிறது...' : 'Searching schemes...'}
              </div>
            )}
          </div>

          <form className="chat-input-row" onSubmit={handleSubmit}>
            <input
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === 'ta' ? 'உங்கள் கேள்வியை தட்டச்சு செய்க...' : 'Ask about schemes, investment, state...'}
            />
            <button type="submit" className="chat-send" disabled={sending || !input.trim()}>
              {lang === 'ta' ? 'அனுப்பு' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle MSME Assistant"
      >
        <span>💬</span>
        <span>{lang === 'ta' ? 'உதவியாளர்' : 'MSME Assistant'}</span>
      </button>

      {selectedScheme && (
        <div className="chat-detail-modal" onClick={() => setSelectedScheme(null)}>
          <div className="chat-detail-inner" onClick={(e) => e.stopPropagation()}>
            <SchemeDetails scheme={selectedScheme} onBack={() => setSelectedScheme(null)} />
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWidget;
