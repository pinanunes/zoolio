import React, { useState } from 'react';
import { marked } from 'marked';
import { getBotDisplayInfo } from '../config/bots';

const ChatMessage = ({ message, onFeedback, user }) => {
  const { type, content, timestamp, id, originalQuestion } = message;
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Função para processar markdown e citações no texto do bot
  const processCitations = (text) => {
    if (!text) return { processedText: '', citations: [] };

    // Configure marked options for better rendering
    marked.setOptions({
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });

    // First, convert markdown to HTML
    let htmlText;
    try {
      htmlText = marked(text);
    } catch (error) {
      console.error('Error processing markdown:', error);
      htmlText = text; // Fallback to original text
    }

    const citations = [];
    const citationMap = new Map(); // Track unique citations and their numbers
    let citationCounter = 1;
    
    // Then, find and process citations in the HTML
    const processedText = htmlText.replace(/\[([^\]]+)\]/g, (match, citation) => {
      let citationNumber;
      let citationId;
      
      // Check if this citation already exists
      if (citationMap.has(citation)) {
        // Use existing number for repeated citation
        citationNumber = citationMap.get(citation);
        citationId = `msg${id}-ref${citationNumber}`;
      } else {
        // New citation - assign new number
        citationNumber = citationCounter;
        citationId = `msg${id}-ref${citationNumber}`;
        
        // Store in map and citations array
        citationMap.set(citation, citationNumber);
        citations.push({
          id: citationId,
          text: citation,
          number: citationNumber
        });
        
        citationCounter++;
      }
      
      const result = `<sup><a href="#${citationId}" class="citation-link" style="color: #4ade80; text-decoration: none; font-weight: 500;">${citationNumber}</a></sup>`;
      return result;
    });

    return { processedText, citations };
  };

  const handlePositiveFeedback = () => {
    if (feedbackSubmitted) return; // Prevent double-clicks
    
    console.log('Positive feedback clicked for message:', id);
    setFeedbackSubmitted(true);
    
    const feedbackData = {
      messageId: id,
      question: originalQuestion,
      answer: typeof content === 'string' ? content : (content.answer || content.message || content.text || JSON.stringify(content)),
      type: 'positive'
    };
    console.log('Feedback data:', feedbackData);
    onFeedback(feedbackData);
  };

  const handleNegativeFeedback = () => {
    if (feedbackSubmitted) return; // Prevent double-clicks
    
    console.log('Negative feedback clicked for message:', id);
    setFeedbackSubmitted(true);
    
    const feedbackData = {
      messageId: id,
      question: originalQuestion,
      answer: typeof content === 'string' ? content : (content.answer || content.message || content.text || JSON.stringify(content)),
      type: 'negative'
    };
    console.log('Feedback data:', feedbackData);
    onFeedback(feedbackData);
  };

  if (type === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-xs lg:max-w-2xl px-4 py-3 bg-maria-blue-600 text-white rounded-2xl shadow-lg">
          <p className="text-sm leading-relaxed">{content}</p>
          <p className="text-xs text-maria-blue-200 mt-2 opacity-75">
            {new Date(timestamp).toLocaleTimeString('pt-PT', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'bot') {
    // Get bot information
    const botInfo = getBotDisplayInfo(message.botId);
    
    // Get quota information for this specific bot
    const getQuotaForBot = () => {
      if (!user || !user.feedbackQuotas || user.role !== 'student') return null;
      
      const botId = message.botId;
      if (botId === 'bot_junior' && user.feedbackQuotas.bot_junior) {
        return user.feedbackQuotas.bot_junior;
      } else if (botId === 'bot_senior' && user.feedbackQuotas.bot_senior) {
        return user.feedbackQuotas.bot_senior;
      } else if (botId === 'bot_arena' && user.feedbackQuotas.bot_arena) {
        return user.feedbackQuotas.bot_arena;
      }
      return null;
    };

    const quotaInfo = getQuotaForBot();
    const hasQuotaRemaining = quotaInfo && quotaInfo.remaining > 0;
    
    // Safely extract the answer text with fallbacks
    let answerText;
    try {
      if (typeof content === 'string') {
        answerText = content;
      } else if (content && typeof content === 'object') {
        answerText = content.answer || content.message || content.text || content.response || JSON.stringify(content);
      } else {
        answerText = 'Resposta em formato inesperado.';
      }
    } catch (error) {
      console.error('Error processing bot message content:', error);
      answerText = 'Erro ao processar resposta.';
    }

    const { processedText, citations } = processCitations(answerText);

    return (
      <div className="flex justify-start mb-6">
        <div className="max-w-xs lg:max-w-2xl w-full">
          {/* Avatar e mensagem do bot */}
          <div className="flex items-start space-x-3">
            <div className="shrink-0">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: botInfo.color }}
              >
                {botInfo.icon ? (
                  <img 
                    src={botInfo.icon} 
                    alt={botInfo.name}
                    className="w-7 h-7 rounded-full object-contain"
                  />
                ) : (
                  <span className="text-white text-sm font-medium">
                    {botInfo.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              {/* Bot name */}
              <div className="mb-1">
                <span className="text-xs font-medium" style={{ color: botInfo.color }}>
                  {botInfo.name}
                </span>
              </div>
              
              {/* Mensagem do bot */}
              <div className="px-4 py-3 rounded-2xl shadow-lg" style={{ backgroundColor: '#334155', border: '1px solid #475569' }}>
                <div 
                  className="text-sm leading-relaxed max-w-none"
                  style={{ color: '#ffffff' }}
                  dangerouslySetInnerHTML={{ __html: processedText }}
                />
                
                {/* Lista de citações */}
                {citations.length > 0 && (
                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid #475569' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: '#cbd5e1' }}>Referências:</p>
                    <ol className="text-xs space-y-1" style={{ color: '#94a3b8' }}>
                      {citations.map((citation) => (
                        <li key={citation.id} id={citation.id} className="citation-item">
                          <span className="font-medium" style={{ color: '#4ade80' }}>{citation.number}.</span>{' '}
                          <span dangerouslySetInnerHTML={{ __html: citation.text }} />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                
                <p className="text-xs mt-3" style={{ color: '#94a3b8' }}>
                  {new Date(timestamp).toLocaleTimeString('pt-PT', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                  {message.responseTime && (
                    <span className="ml-2" style={{ color: '#4ade80' }}>
                      ({message.responseTime.toFixed(1)}s)
                    </span>
                  )}
                </p>
              </div>
              
              {/* Botões de feedback */}
              <div className="flex items-center space-x-2 mt-2 ml-4">
                <button
                  onClick={handlePositiveFeedback}
                  disabled={!hasQuotaRemaining || feedbackSubmitted}
                  className={`p-1.5 transition-colors rounded-md ${
                    hasQuotaRemaining && !feedbackSubmitted
                      ? 'text-maria-gray-500 hover:text-maria-green-400 hover:bg-maria-gray-700 cursor-pointer' 
                      : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    feedbackSubmitted ? "Feedback já submetido" :
                    hasQuotaRemaining ? "Esta resposta foi útil" : "Quota de feedback esgotada"
                  }
                >
                  <span className="text-lg">👍</span>
                </button>
                <button
                  onClick={handleNegativeFeedback}
                  disabled={!hasQuotaRemaining || feedbackSubmitted}
                  className={`p-1.5 transition-colors rounded-md ${
                    hasQuotaRemaining && !feedbackSubmitted
                      ? 'text-maria-gray-500 hover:text-maria-pink-400 hover:bg-maria-gray-700 cursor-pointer' 
                      : 'text-gray-600 cursor-not-allowed opacity-50'
                  }`}
                  title={
                    feedbackSubmitted ? "Feedback já submetido" :
                    hasQuotaRemaining ? "Esta resposta não foi útil" : "Quota de feedback esgotada"
                  }
                >
                  <span className="text-lg">👎</span>
                </button>
                
                {/* Quota display */}
                {quotaInfo && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    quotaInfo.remaining > 0 
                      ? 'bg-blue-900 text-blue-200 border border-blue-700'
                      : 'bg-red-900 text-red-200 border border-red-700'
                  }`}>
                    {quotaInfo.remaining > 0 
                      ? `${quotaInfo.remaining}/${quotaInfo.max} restantes`
                      : 'Quota esgotada'
                    }
                  </span>
                )}
                
                {/* Show quota info for non-students (professors/admins) */}
                {user && user.role !== 'student' && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-900 text-green-200 border border-green-700">
                    Sem limite
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ChatMessage;
