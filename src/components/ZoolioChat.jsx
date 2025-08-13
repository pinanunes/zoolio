import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ChatMessage from './ChatMessage';
import FeedbackNegativoModal from './FeedbackNegativoModal';
import { sendChatMessage } from '../services/api';

const ZoolioChat = () => {
  const { user, refreshUserProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    messageId: null,
    question: '',
    answer: ''
  });
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Add user message immediately using the same structure as PaginaChat
    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    
    const currentQuestion = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const startTime = Date.now();
      const response = await sendChatMessage(currentQuestion, user);
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;
      
      console.log('Webhook response:', response);
      console.log('Response time:', responseTime + 's');
      
      // Handle different response formats - same as PaginaChat
      let botContent;
      if (typeof response === 'string') {
        try {
          const parsed = JSON.parse(response);
          botContent = { answer: parsed.output || response };
        } catch (parseError) {
          botContent = { answer: response };
        }
      } else if (response && typeof response === 'object') {
        botContent = { 
          answer: response.output || response.answer || response.message || 
                  response.text || response.response || JSON.stringify(response) 
        };
      } else {
        botContent = { answer: 'Resposta recebida mas em formato inesperado.' };
      }
      
      const botMessage = {
        id: `bot-${Date.now()}`,
        type: 'bot',
        content: botContent,
        timestamp: new Date().toISOString(),
        originalQuestion: currentQuestion,
        responseTime: responseTime
      };

      setMessages(prev => [...prev, botMessage]);

      // Save to database
      await saveChatLog(currentQuestion, botContent.answer);

    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = {
        id: `bot-error-${Date.now()}`,
        type: 'bot',
        content: {
          answer: 'Peço desculpa, mas ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente em alguns instantes.'
        },
        timestamp: new Date().toISOString(),
        originalQuestion: currentQuestion
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveChatLog = async (question, answer) => {
    try {
      // Get user's team info
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      await supabase
        .from('chat_logs')
        .insert([{
          user_id: user.id,
          team_id: profile?.team_id,
          question: question,
          answer: answer
        }]);
    } catch (error) {
      console.error('Error saving chat log:', error);
    }
  };

  const handleFeedback = async (feedbackData) => {
    try {
      if (feedbackData.type === 'negative') {
        // Open modal for negative feedback
        const message = messages.find(msg => msg.id === feedbackData.messageId);
        if (message) {
          setFeedbackModal({
            isOpen: true,
            messageId: feedbackData.messageId,
            question: feedbackData.question,
            answer: feedbackData.answer
          });
        }
      } else {
        // Handle positive feedback directly
        await savePositiveFeedback(feedbackData);
      }
    } catch (error) {
      console.error('Error handling feedback:', error);
    }
  };

  const savePositiveFeedback = async (feedbackData) => {
    try {
      // Update the message with positive feedback
      setMessages(prev => prev.map(msg => 
        msg.id === feedbackData.messageId 
          ? { ...msg, feedback: 'positive' }
          : msg
      ));

      // Get the most recent chat log for this user
      const { data: latestLog } = await supabase
        .from('chat_logs')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestLog) {
        // Update chat_logs with positive feedback
        await supabase
          .from('chat_logs')
          .update({ feedback: 1 })
          .eq('id', latestLog.id);

        // Create entry in feedback_validations for positive feedback
        await supabase
          .from('feedback_validations')
          .insert([{
            log_id: latestLog.id,
            professor_id: null, // Will be filled when professor reviews
            comment: null, // Will be filled when professor reviews
            is_validated: null, // Will be set when professor reviews
            points_awarded: 0 // Will be set when professor reviews
          }]);
        
        // Refresh user profile to update quota
        await refreshUserProfile();
      }
    } catch (error) {
      console.error('Error saving positive feedback:', error);
    }
  };

  const handleNegativeFeedbackSubmit = async (feedbackData) => {
    try {
      // Update the message with negative feedback
      setMessages(prev => prev.map(msg => 
        msg.id === feedbackModal.messageId 
          ? { ...msg, feedback: 'negative' }
          : msg
      ));

      // Get the most recent chat log for this user
      const { data: latestLog } = await supabase
        .from('chat_logs')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestLog) {
        // Update chat_logs with negative feedback
        await supabase
          .from('chat_logs')
          .update({ feedback: -1 })
          .eq('id', latestLog.id);

        // Create detailed entry in feedback_validations
        const feedbackEntry = {
          log_id: latestLog.id,
          professor_id: null, // Will be filled when professor reviews
          comment: null, // Will be filled when professor reviews (this is professor's comment)
          is_validated: null, // Will be set when professor reviews
          points_awarded: 0 // Will be set when professor reviews
        };

        // Add new fields if database has been updated
        try {
          feedbackEntry.feedback_type = feedbackData.feedback_type;
          feedbackEntry.negative_reason = feedbackData.negative_reason;
          feedbackEntry.student_justification = feedbackData.student_justification;
        } catch (error) {
          console.log('New feedback columns not yet available in database');
        }

        await supabase
          .from('feedback_validations')
          .insert([feedbackEntry]);
      }

      // Close modal
      setFeedbackModal({
        isOpen: false,
        messageId: null,
        question: '',
        answer: ''
      });

      // Refresh user profile to update quota
      await refreshUserProfile();

    } catch (error) {
      console.error('Error saving negative feedback:', error);
      throw error; // Re-throw to show error in modal
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({
      isOpen: false,
      messageId: null,
      question: '',
      answer: ''
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Chat Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">Zoolio Chat</h2>
        <p className="text-gray-300">Faça perguntas sobre medicina veterinária e receba respostas personalizadas.</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p>Bem-vindo ao Zoolio Chat!</p>
            <p className="text-sm mt-2">Comece fazendo uma pergunta sobre medicina veterinária.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onFeedback={handleFeedback}
            showFeedback={message.sender === 'bot' && !message.isError}
          />
        ))}
        
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-600 rounded-lg px-4 py-2 max-w-xs">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex space-x-2">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Digite a sua pergunta..."
          className="flex-1 p-3 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
          style={{ 
            backgroundColor: '#475569', 
            border: '1px solid #64748b',
            color: '#ffffff'
          }}
          rows="2"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputMessage.trim()}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '...' : 'Enviar'}
        </button>
      </div>

      {/* Feedback Modal */}
      <FeedbackNegativoModal
        isOpen={feedbackModal.isOpen}
        onClose={closeFeedbackModal}
        onSubmit={handleNegativeFeedbackSubmit}
        question={feedbackModal.question}
        answer={feedbackModal.answer}
      />
    </div>
  );
};

export default ZoolioChat;
