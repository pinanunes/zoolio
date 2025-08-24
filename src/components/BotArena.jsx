import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getArenaBotsForTeam, BOTS } from '../config/bots';
import FormattedArenaResponse from './FormattedArenaResponse';
import ArenaFeedbackModal from './ArenaFeedbackModal';

const BotArena = () => {
  const { user, refreshUserProfile, updateFeedbackQuota } = useAuth();
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState({
    bot1: { text: '', loading: false, responseTime: null },
    bot2: { text: '', loading: false, responseTime: null },
    bot3: { text: '', loading: false, responseTime: null }
  });
  const [selectedBot, setSelectedBot] = useState(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedBotInfo, setSelectedBotInfo] = useState(null);

  // Determine unlock status and available bots directly from user context
  const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin';
  const teamProgress = {
    hasSubmittedSheet: user?.team?.fichaEntregue || false,
    hasSubmittedReview: user?.team?.revisaoEntregue || false
  };

  const isUnlocked = isProfessorOrAdmin || (teamProgress.hasSubmittedSheet && teamProgress.hasSubmittedReview);
  
  const arenaBots = isUnlocked ? getArenaBotsForTeam(
    teamProgress.hasSubmittedSheet,
    teamProgress.hasSubmittedReview
  ) : [];

  const sendToAllBots = async () => {
    if (!question.trim() || !isUnlocked || arenaBots.length === 0) return;

    // Reset responses and set loading states
    setResponses({
      bot1: { text: '', loading: true, responseTime: null },
      bot2: { text: '', loading: true, responseTime: null },
      bot3: { text: '', loading: true, responseTime: null }
    });
    setSelectedBot(null);

    // Record start time for response time tracking
    const startTime = Date.now();

    // Send to all bots simultaneously
    const promises = arenaBots.map(async (bot, index) => {
      const botKey = `bot${index + 1}`;
      const botStartTime = Date.now();
      
      try {
        const response = await fetch(bot.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: question,
            user: {
              id: user.id,
              email: user.email,
              full_name: user.full_name,
              role: user.role,
              team_id: user.teamId
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to get response from ${bot.name}`);
        }

        const data = await response.json();
        console.log(`${bot.name} response:`, data); // Debug log
        
        // Calculate response time
        const responseTime = (Date.now() - botStartTime) / 1000;
        
        // Extract response text
        const botResponse = data.answer || data.response || data.message || data.text || data.output ||
                           (data.data && (data.data.answer || data.data.response || data.data.message || data.data.text)) ||
                           'Desculpe, não consegui processar a sua pergunta.';

        setResponses(prev => ({
          ...prev,
          [botKey]: { text: botResponse, loading: false, responseTime }
        }));

      } catch (error) {
        console.error(`Error with ${bot.name}:`, error);
        const responseTime = (Date.now() - botStartTime) / 1000;
        setResponses(prev => ({
          ...prev,
          [botKey]: { text: 'Erro ao obter resposta deste bot.', loading: false, isError: true, responseTime }
        }));
      }
    });

    await Promise.all(promises);
  };

  const selectBestBot = (botNumber) => {
    if (selectedBot) return; // Already selected

    // Check quota for students
    if (user?.role === 'student') {
      const arenaQuota = user?.feedbackQuotas?.bot_arena?.remaining || 0;
      if (arenaQuota <= 0) {
        alert('Não tem mais feedback disponível para a Arena de Bots este ano.');
        return;
      }
    }

    setSelectedBot(botNumber);
    const selectedBotData = arenaBots[botNumber - 1];
    setSelectedBotInfo({
      number: botNumber,
      name: selectedBotData.name
    });
    setIsFeedbackModalOpen(true);
  };

  const handleFeedbackSubmit = async (justification) => {
    try {
      // Save to comparative_chat_logs with justification
      await supabase
        .from('comparative_chat_logs')
        .insert([{
          user_id: user.id,
          question: question,
          answer_1: responses.bot1.text,
          answer_2: responses.bot2.text,
          answer_3: responses.bot3.text,
          voted_best_answer: selectedBot,
          justification: justification
        }]);

      // Update Arena feedback quota for students using the existing quota system
      if (user?.role === 'student') {
        await updateFeedbackQuota('bot_arena');
      }

    } catch (error) {
      console.error('Error saving comparative chat log:', error);
      throw error;
    }
  };

  const handleFeedbackModalClose = () => {
    setIsFeedbackModalOpen(false);
    setSelectedBotInfo(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendToAllBots();
    }
  };

  if (!isUnlocked) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Arena de Bots Bloqueada</h2>
          <p className="text-gray-300 max-w-md mx-auto">
            A Arena de Bots só fica disponível após a sua equipa submeter a ficha informativa e a revisão da outra equipa.
          </p>
          {user?.team && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <p className="text-white">
                <strong>Equipa:</strong> {user.team.name}
              </p>
              <div className="text-gray-300 text-sm mt-2 space-y-1">
                <p>Ficha Informativa: {teamProgress.hasSubmittedSheet ? 'Submetida ✅' : 'Pendente ⏳'}</p>
                <p>Revisão: {teamProgress.hasSubmittedReview ? 'Submetida ✅' : 'Pendente ⏳'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Arena de Bots</h2>
        <p className="text-gray-300">Compare as respostas de diferentes bots e vote na melhor resposta.</p>
      </div>

      {/* User Info and Quota Display */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">{user?.name}</h3>
            <p className="text-sm text-gray-300">
              {user?.team?.name} • {user?.team?.assignedDisease?.name || 'Doença não atribuída'}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">Feedback disponível:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                (user?.feedbackQuotas?.bot_arena?.remaining || 0) > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-red-600 text-white'
              }`}>
                {user?.feedbackQuotas?.bot_arena?.remaining || 0}/{user?.feedbackQuotas?.bot_arena?.max || 5}
              </span>
            </div>
            {user?.role !== 'student' && (
              <p className="text-xs text-green-400 mt-1">Sem limite (Professor/Admin)</p>
            )}
          </div>
        </div>
      </div>

      {/* Question Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Faça uma pergunta para todos os bots:
          </label>
          <div className="flex space-x-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite a sua pergunta..."
              className="flex-1 p-3 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              rows="3"
              disabled={responses.bot1.loading || responses.bot2.loading || responses.bot3.loading}
            />
            <button
              onClick={sendToAllBots}
              disabled={!question.trim() || responses.bot1.loading || responses.bot2.loading || responses.bot3.loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Enviar para Todos
            </button>
          </div>
        </div>
      </div>

      {/* Bot Responses */}
      {(question && (responses.bot1.text || responses.bot1.loading)) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {arenaBots.map((bot, index) => {
            const botKey = `bot${index + 1}`;
            const response = responses[botKey];
            
            return (
              <div key={bot.id} className="rounded-lg p-4" style={{ backgroundColor: '#334155', borderTop: `4px solid ${bot.color}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: bot.color }}
                    >
                      {bot.icon && bot.icon !== '/src/assets/bot_junior_icon.png' ? (
                        <img 
                          src={bot.icon} 
                          alt={bot.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-xs font-medium">
                          {bot.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white" style={{ color: bot.color }}>
                      {bot.name}
                    </h3>
                  </div>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bot.color }}></div>
                </div>
                
                <div className="min-h-[200px] mb-4">
                  {response?.loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  ) : (
                    <FormattedArenaResponse 
                      text={response?.text || ''} 
                      responseTime={response?.responseTime}
                      messageId={`${bot.id}-${Date.now()}`}
                    />
                  )}
                </div>
                
                {!response?.loading && response?.text && !response?.isError && (
                  <button
                    onClick={() => selectBestBot(index + 1)}
                    disabled={selectedBot !== null}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      selectedBot === index + 1
                        ? 'bg-green-600 text-white'
                        : selectedBot === null
                        ? 'bg-gray-600 text-white hover:bg-gray-500'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {selectedBot === index + 1 ? 'Selecionada ✓' : 'Esta é a melhor resposta'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedBot && !isFeedbackModalOpen && (
        <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <p className="text-green-400 font-medium">
            ✓ Obrigado pelo seu voto! A sua escolha foi registada.
          </p>
        </div>
      )}

      {/* Arena Feedback Modal */}
      <ArenaFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={handleFeedbackModalClose}
        onSubmit={handleFeedbackSubmit}
        selectedBotNumber={selectedBotInfo?.number}
        botName={selectedBotInfo?.name}
      />
    </div>
  );
};

export default BotArena;
