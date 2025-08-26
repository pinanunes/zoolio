import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import ChatMessage from './ChatMessage';
import FeedbackModal from './FeedbackModal';
import FeedbackNegativoModal from './FeedbackNegativoModal';
import TimeoutMessage from './TimeoutMessage';
import { BOTS } from '../config/bots';

const BotJuniorChat = () => {
  const { user, updateFeedbackQuota } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showNegativeFeedbackModal, setShowNegativeFeedbackModal] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [showTimeout, setShowTimeout] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const [lastClassification, setLastClassification] = useState(null); // <-- ADD THIS LINE
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { id: Date.now(), type: 'user', content: inputValue.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowTimeout(false);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(() => setShowTimeout(true), 10000);
    const startTime = Date.now();

    try {
      const response = await fetch(BOTS.bot_junior.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          user: { id: user.id, email: user.email, full_name: user.name, role: user.role, team_id: user.teamId }
        }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);
      setShowTimeout(false);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const rawData = await response.json();
      const responseTime = (Date.now() - startTime) / 1000;

      // --- START: THE NEW, SIMPLIFIED PARSER ---
      let messageContent = 'Desculpe, ocorreu um erro ao processar a resposta.';
      let classification = 'Não Especificada';

      // 1. Get the first object from the N8N response array
      const payload = Array.isArray(rawData) ? rawData[0] : rawData;
      
      // 2. The actual content is inside the 'output' property of the payload
      const innerData = payload?.output;

      if (innerData && typeof innerData === 'object') {
        // 3. Extract the final data from the inner object
        messageContent = innerData.output || 'Não foi possível extrair a resposta.';
        classification = innerData.disease_classification || 'Não Especificada';
      }

      // 4. Save the classification to the component's state
      setLastClassification(classification);
      // --- END: THE NEW, SIMPLIFIED PARSER ---

      const botMessage = {
        id: Date.now() + 1, type: 'bot', content: messageContent, timestamp: new Date().toISOString(),
        originalQuestion: userMessage.content, responseTime, botId: BOTS.bot_junior.id
      };
      setMessages(prev => [...prev, botMessage]);
      
      // Log every interaction
      try {
        await supabase.from('chat_logs').insert({
          user_id: user.id, team_id: user.teamId,
          question: botMessage.originalQuestion, answer: botMessage.content,
          bot_id: botMessage.botId, is_archived: false,
          disease_classification: classification
        });
      } catch (logError) { console.error("Error saving chat log:", logError); }

    } catch (error) {
      clearTimeout(timeoutId);
      setShowTimeout(false);
      if (error.name === 'AbortError') return;
      console.error('Error calling webhook:', error);
      const errorMessage = {
        id: Date.now() + 1, type: 'bot', content: 'Desculpe, ocorreu um erro ao processar a sua pergunta. Tente novamente.',
        timestamp: new Date().toISOString(), originalQuestion: userMessage.content, botId: BOTS.bot_junior.id
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFeedback = (feedbackData) => {
    console.log('BotJuniorChat handleFeedback called with:', feedbackData);
    
    // Set current feedback and open appropriate modal
    // Note: Quota checking is already handled in ChatMessage component
    setCurrentFeedback(feedbackData);
    
    if (feedbackData.type === 'positive') {
      console.log('Opening positive feedback modal');
      setShowFeedbackModal(true);
    } else {
      console.log('Opening negative feedback modal');
      setShowNegativeFeedbackModal(true);
    }
  };

    const saveFeedback = async (feedback, feedbackData = '') => {
    try {
      // Use the new quota system
      const quotaResult = await updateFeedbackQuota('bot_junior');

      if (!quotaResult.success) {
        alert(quotaResult.message);
        return;
      }

      // --- START OF THE FIX ---
      // Prepare the insert data, now including the disease_classification
      const insertData = {
        user_id: user.id,
        team_id: user.teamId,
        question: feedback.question,
        answer: feedback.answer,
        feedback: feedback.type === 'positive' ? 1 : -1,
        bot_id: 'bot_junior',
        disease_classification: lastClassification // Add the saved classification
      };
      // --- END OF THE FIX ---

      // If it's positive feedback with structured data, add the details
      if (feedback.type === 'positive' && typeof feedbackData === 'object' && feedbackData.feedback) {
        insertData.positive_feedback_details = {
          options: feedbackData.feedback.options,
          comment: feedbackData.feedback.comment
        };
      }

      const { error } = await supabase
        .from('chat_logs')
        .insert(insertData);

      if (error) throw error;

      console.log('Feedback saved successfully with classification:', lastClassification);

    } catch (error) {
      console.error('Error saving feedback:', error);
      alert('Erro ao guardar feedback. Tente novamente.');
    }
  };

  const handlePositiveFeedbackSubmit = async (feedbackData) => {
    await saveFeedback(currentFeedback, feedbackData);
    setShowFeedbackModal(false);
    setCurrentFeedback(null);
  };

  const handleNegativeFeedbackSubmit = async (comment) => {
    await saveFeedback(currentFeedback, comment);
    setShowNegativeFeedbackModal(false);
    setCurrentFeedback(null);
  };

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setShowTimeout(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: '#475569', backgroundColor: '#334155' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: BOTS.bot_junior.color }}
            >
              {BOTS.bot_junior.icon ? (
                <img 
                  src={BOTS.bot_junior.icon} 
                  alt={BOTS.bot_junior.name}
                  className="w-7 h-7 rounded-full object-contain"
                />
              ) : (
                <span className="text-white text-sm font-medium">
                  {BOTS.bot_junior.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{BOTS.bot_junior.name}</h2>
              <p className="text-sm text-gray-300">{BOTS.bot_junior.description}</p>
            </div>
          </div>
          
          {/* Quota Display */}
          {user && user.role === 'student' && user.feedbackQuotas && user.feedbackQuotas.bot_junior && (
            <div className="text-right">
              <p className="text-sm text-gray-300">Feedbacks restantes</p>
              <p className="text-lg font-bold text-white">
                {user.feedbackQuotas.bot_junior.remaining}/{user.feedbackQuotas.bot_junior.max}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="mb-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-lg"
                style={{ backgroundColor: BOTS.bot_junior.color }}
              >
                <span className="text-white text-2xl font-medium">
                  {BOTS.bot_junior.name.charAt(0)}
                </span>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Olá! Sou o {BOTS.bot_junior.name}</h3>
            <p className="text-gray-300 max-w-md mx-auto">
              Estou aqui para ajudar com as suas perguntas sobre medicina veterinária. 
              Como sou um bot junior, as minhas respostas podem ter algumas incertezas, 
              mas farei o meu melhor para ajudar!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onFeedback={handleFeedback}
            user={user}
          />
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: BOTS.bot_junior.color }}
              >
                <span className="text-white text-sm font-medium">
                  {BOTS.bot_junior.name.charAt(0)}
                </span>
              </div>
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {showTimeout && (
          <TimeoutMessage onCancel={cancelRequest} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t" style={{ borderColor: '#475569', backgroundColor: '#334155' }}>
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Faça uma pergunta ao Bot Junior..."
            className="flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500 text-white"
            style={{ 
              backgroundColor: '#1e293b', 
              borderColor: '#475569',
              '::placeholder': { color: '#94a3b8' }
            }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>

      {/* Modals */}
      <>
        <FeedbackModal
          isOpen={showFeedbackModal}
          onSubmit={handlePositiveFeedbackSubmit}
          onClose={() => setShowFeedbackModal(false)}
          question={currentFeedback?.question || ''}
          answer={currentFeedback?.answer || ''}
        />

        <FeedbackNegativoModal
          isOpen={showNegativeFeedbackModal}
          onSubmit={handleNegativeFeedbackSubmit}
          onClose={() => setShowNegativeFeedbackModal(false)}
          question={currentFeedback?.question || ''}
          answer={currentFeedback?.answer || ''}
        />
      </>
    </div>
  );
};

export default BotJuniorChat;
