import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import ChatMessage from './ChatMessage';
import FeedbackModal from './FeedbackModal';
import FeedbackNegativoModal from './FeedbackNegativoModal';
import TimeoutMessage from './TimeoutMessage';
import { BOTS } from '../config/bots';

const BotSeniorChat = () => {
  const { user, updateFeedbackQuota } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showNegativeFeedbackModal, setShowNegativeFeedbackModal] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [showTimeout, setShowTimeout] = useState(false);
  const [diseaseStatus, setDiseaseStatus] = useState([]);
  const [loadingDiseases, setLoadingDiseases] = useState(true);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getDiseaseOutline = (diseaseId) => {
    if (user?.role !== 'student' || !user.team) return 'border-transparent';

    const { team } = user;
    if (diseaseId === team.assignedDiseaseId) {
      return 'border-green-500'; // Assigned to my team
    }
    if (diseaseId === team.blueTeamDiseaseId) {
      return 'border-blue-500'; // Assigned to blue team
    }
    if (diseaseId === team.redTeam1TargetId || diseaseId === team.redTeam2TargetId) {
      return 'border-red-500'; // Assigned to red teams
    }
    return 'border-transparent';
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadDiseaseStatus();
  }, []);

  const loadDiseaseStatus = async () => {
    try {
      setLoadingDiseases(true);
      
      // Get all diseases and their team status
      const { data, error } = await supabase
        .from('diseases')
        .select(`
          id,
          name,
          teams!teams_assigned_disease_id_fkey (
            id,
            team_name,
            has_submitted_sheet,
            has_submitted_review
          )
        `)
        .order('name');

      if (error) throw error;

      // Process the data to show disease status
      const processedDiseases = data.map(disease => {
        const team = disease.teams[0]; // Each disease should have one team
        let status = 'Não Atribuída';
        let statusColor = '#6B7280'; // Gray
        
        if (team) {
          if (team.has_submitted_review) {
            status = 'Versão Revista';
            statusColor = '#10B981'; // Green
          } else if (team.has_submitted_sheet) {
            status = 'Versão Inicial';
            statusColor = '#F59E0B'; // Yellow
          } else {
            status = 'Em Desenvolvimento';
            statusColor = '#EF4444'; // Red
          }
        }

        return {
          id: disease.id,
          name: disease.name,
          status,
          statusColor,
          teamName: team?.team_name || 'Nenhuma'
        };
      });

      // Custom sorting logic for students
      if (user?.role === 'student' && user?.team) {
        const { team } = user;
        
        processedDiseases.sort((a, b) => {
          // Assign priority based on team relationships
          const getPriority = (diseaseId) => {
            if (diseaseId === team.assignedDiseaseId) return 1; // Green - Own disease
            if (diseaseId === team.blueTeamDiseaseId) return 2; // Blue - Review target
            if (diseaseId === team.redTeam1TargetId || diseaseId === team.redTeam2TargetId) return 3; // Red - Challenge targets
            return 4; // Other diseases
          };
          
          const priorityA = getPriority(a.id);
          const priorityB = getPriority(b.id);
          
          // If priorities are different, sort by priority
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          
          // If same priority (especially for "other diseases"), sort alphabetically
          return a.name.localeCompare(b.name, 'pt-PT');
        });
      } else {
        // For professors/admins, just sort alphabetically
        processedDiseases.sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
      }

      setDiseaseStatus(processedDiseases);
    } catch (error) {
      console.error('Error loading disease status:', error);
    } finally {
      setLoadingDiseases(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowTimeout(false);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Set timeout for showing timeout message
    const timeoutId = setTimeout(() => {
      setShowTimeout(true);
    }, 10000); // Show after 10 seconds

    const startTime = Date.now();

    try {
      const response = await fetch(BOTS.bot_senior.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            team_id: user.teamId
          }
        }),
        signal: abortControllerRef.current.signal
      });

      clearTimeout(timeoutId);
      setShowTimeout(false);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;

      // Extract the actual message content from the JSON response
      const messageContent = data.output || data.answer || data.text || data.message || data.response ||
                            (data.data && (data.data.output || data.data.answer || data.data.text || data.data.message)) ||
                            (typeof data === 'string' ? data : 'Desculpe, não consegui processar a sua pergunta.');

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: messageContent,
        timestamp: new Date().toISOString(),
        originalQuestion: userMessage.content,
        responseTime: responseTime,
        botId: BOTS.bot_senior.id
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      clearTimeout(timeoutId);
      setShowTimeout(false);
      
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

      console.error('Error calling webhook:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Desculpe, ocorreu um erro ao processar a sua pergunta. Tente novamente.',
        timestamp: new Date().toISOString(),
        originalQuestion: userMessage.content,
        botId: BOTS.bot_senior.id
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFeedback = (feedbackData) => {
    console.log('BotSeniorChat handleFeedback called with:', feedbackData);
    
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
      const quotaResult = await updateFeedbackQuota('bot_senior');

      if (!quotaResult.success) {
        alert(quotaResult.message);
        return;
      }

      // Prepare the insert data
      const insertData = {
        user_id: user.id,
        team_id: user.teamId,
        question: feedback.question,
        answer: feedback.answer,
        feedback: feedback.type === 'positive' ? 1 : -1,
        bot_id: 'bot_senior'
      };

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

      console.log('Feedback saved successfully');

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
              style={{ backgroundColor: BOTS.bot_senior.color }}
            >
              <span className="text-white text-sm font-medium">
                {BOTS.bot_senior.name.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{BOTS.bot_senior.name}</h2>
              <p className="text-sm text-gray-300">{BOTS.bot_senior.description}</p>
            </div>
          </div>
          
          {/* Quota Display */}
          {user && user.role === 'student' && user.feedbackQuotas && user.feedbackQuotas.bot_senior && (
            <div className="text-right">
              <p className="text-sm text-gray-300">Feedbacks restantes</p>
              <p className="text-lg font-bold text-white">
                {user.feedbackQuotas.bot_senior.remaining}/{user.feedbackQuotas.bot_senior.max}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Disease Status Panel */}
      <div className="p-4 border-b" style={{ borderColor: '#475569', backgroundColor: '#1e293b' }}>
        <h3 className="text-sm font-bold text-white mb-3">Estado das Doenças Disponíveis</h3>
        
        {loadingDiseases ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full animate-bounce"></div>
            <span className="text-gray-300 text-sm">Carregando estado das doenças...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
            {diseaseStatus.map((disease) => (
              <div key={disease.id} className={`flex items-center justify-between p-2 rounded border-2 ${getDiseaseOutline(disease.id)}`} style={{ backgroundColor: '#334155' }}>
                <span className="text-white text-sm font-medium truncate">{disease.name}</span>
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ 
                    backgroundColor: disease.statusColor + '20',
                    color: disease.statusColor 
                  }}
                >
                  {disease.status}
                </span>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-2">
          <div>
            <span className="font-bold">Legenda de Estado:</span>
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 ml-2"></span>Em Desenvolvimento
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1 ml-2"></span>Versão Inicial
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 ml-2"></span>Versão Revista
          </div>
          {user?.role === 'student' && (
            <div>
              <span className="font-bold">Legenda de Equipa:</span>
              <span className="inline-block w-3 h-3 border-2 border-green-500 rounded-sm mr-1 ml-2"></span>Sua Doença
              <span className="inline-block w-3 h-3 border-2 border-blue-500 rounded-sm mr-1 ml-2"></span>Blue Team
              <span className="inline-block w-3 h-3 border-2 border-red-500 rounded-sm mr-1 ml-2"></span>Red Team
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
                style={{ backgroundColor: BOTS.bot_senior.color }}
              >
                <span className="text-white text-2xl font-medium">
                  {BOTS.bot_senior.name.charAt(0)}
                </span>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Olá! Sou o {BOTS.bot_senior.name}</h3>
            <p className="text-gray-300 max-w-md mx-auto">
              Estou treinado com o conhecimento compilado pelos estudantes. 
              Consulte o painel acima para ver que doenças estão disponíveis e o seu estado de desenvolvimento.
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
                style={{ backgroundColor: BOTS.bot_senior.color }}
              >
                <span className="text-white text-sm font-medium">
                  {BOTS.bot_senior.name.charAt(0)}
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
            placeholder="Faça uma pergunta ao Bot Senior..."
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
      {showFeedbackModal && (
        <FeedbackModal
          onSubmit={handlePositiveFeedbackSubmit}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {showNegativeFeedbackModal && (
        <FeedbackNegativoModal
          isOpen={showNegativeFeedbackModal}
          onSubmit={handleNegativeFeedbackSubmit}
          onClose={() => setShowNegativeFeedbackModal(false)}
          question={currentFeedback?.question || ''}
          answer={currentFeedback?.answer || ''}
        />
      )}
    </div>
  );
};

export default BotSeniorChat;
