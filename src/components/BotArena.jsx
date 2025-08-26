import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { getArenaBotsForTeam, BOTS } from '../config/bots';
import FormattedArenaResponse from './FormattedArenaResponse';
import ArenaFeedbackModal from './ArenaFeedbackModal';

const BotArena = () => {
  const { user, updateFeedbackQuota } = useAuth();
  const [question, setQuestion] = useState('');
  const [responses, setResponses] = useState({
    bot1: { text: '', loading: false, responseTime: null },
    bot2: { text: '', loading: false, responseTime: null },
    bot3: { text: '', loading: false, responseTime: null }
  });
  const [selectedBot, setSelectedBot] = useState(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedBotInfo, setSelectedBotInfo] = useState(null);
  
  // --- START OF FIX 1: Add state to store the classification ---
  const [questionClassification, setQuestionClassification] = useState(null);
  // --- END OF FIX 1 ---

  const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin';

  const teamProgress = {
    hasSubmittedSheet: user?.team?.has_submitted_sheet || false,
    hasSubmittedReview: user?.team?.has_submitted_review || false
  };

  const isUnlocked = isProfessorOrAdmin || (teamProgress.hasSubmittedSheet && teamProgress.hasSubmittedReview);
  
const arenaBots = isUnlocked ? getArenaBotsForTeam(
    teamProgress.hasSubmittedReview,
    user?.role // Pass the user's role to the function
  ) : [];

  // --- START OF FIX 2: Update the sendToAllBots function ---
    const sendToAllBots = async () => {
    if (!question.trim() || !isUnlocked || arenaBots.length === 0) return;

    setResponses({
      bot1: { text: '', loading: true, responseTime: null },
      bot2: { text: '', loading: true, responseTime: null },
      bot3: { text: '', loading: true, responseTime: null }
    });
    setSelectedBot(null);
    setQuestionClassification(null);

    const parseBotResponse = (rawData) => {
      let classification = 'Não Especificada';
      let messageContent = 'Desculpe, ocorreu um erro ao processar a resposta.';

      try {
        const n8nOutput = Array.isArray(rawData) ? rawData[0] : rawData;

        if (n8nOutput && typeof n8nOutput.output === 'string') {
          let jsonString = n8nOutput.output;
          
          if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring(7, jsonString.length - 3).trim();
          }

          try {
            const innerData = JSON.parse(jsonString);
            messageContent = innerData.output || JSON.stringify(innerData);
            classification = innerData.disease_classification || 'Não Especificada';
          } catch (e) {
            messageContent = n8nOutput.output;
          }
        } else if (n8nOutput) {
          messageContent = n8nOutput.output || n8nOutput.answer || n8nOutput.text || JSON.stringify(n8nOutput);
        }
      } catch (error) {
        console.error("Error parsing bot response:", error);
      }

      return { messageContent, classification };
    };

    const promises = arenaBots.map(async (bot, index) => {
      const botKey = `bot${index + 1}`;
      const botStartTime = Date.now();
      
      try {
        const response = await fetch(bot.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: question,
            user: {
              id: user.id,
              email: user.email,
              full_name: user.name,
              role: user.role,
              team_id: user.teamId
            }
          }),
        });

        if (!response.ok) throw new Error(`Failed to get response from ${bot.name}`);

        const rawData = await response.json();
        const responseTime = (Date.now() - botStartTime) / 1000;
        
        const { messageContent, classification } = parseBotResponse(rawData);

        if (index === 0) {
          setQuestionClassification(classification);
        }
        
        // This part is an async update within the map, so we return the final text
        // to be used in the Promise.all resolution.
        setResponses(prev => ({
          ...prev,
          [botKey]: { text: messageContent, loading: false, responseTime }
        }));

        return { key: botKey, text: messageContent, classification: classification };

      } catch (error) {
        console.error(`Error with ${bot.name}:`, error);
        const responseTime = (Date.now() - botStartTime) / 1000;
        const errorText = 'Erro ao obter resposta deste bot.';
        setResponses(prev => ({
          ...prev,
          [botKey]: { text: errorText, loading: false, isError: true, responseTime }
        }));
        return { key: botKey, text: errorText, classification: 'Não Especificada' };
      }
    });

    // --- START OF THE FIX: Log Every Arena Interaction ---
    // Wait for all bot responses to come back
    const results = await Promise.all(promises);
    
    // Construct the final log entry object from the results
    const logEntry = {
        user_id: user.id,
        question: question,
        answer_1: results.find(r => r.key === 'bot1')?.text || '',
        answer_2: results.find(r => r.key === 'bot2')?.text || '',
        answer_3: results.find(r => r.key === 'bot3')?.text || '',
        disease_classification: results?.classification || 'Não Especificada',
        is_archived: false
        // We leave voted_best_answer and justification as null for now
    };

    try {
        // Insert the new log entry into the database
        await supabase.from('comparative_chat_logs').insert(logEntry);
        console.log("Arena interaction logged successfully.");
    } catch (logError) {
        console.error("Error saving comparative chat log:", logError);
    }
    // --- END OF THE FIX ---
  };

  const selectBestBot = (botNumber) => {
    if (selectedBot) return;

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

 // --- START OF FIX 3: Update the handleFeedbackSubmit function ---
  const handleFeedbackSubmit = async (justification) => {
    try {
      await supabase
        .from('comparative_chat_logs')
        .insert([{
          user_id: user.id,
          question: question,
          answer_1: responses.bot1.text,
          answer_2: responses.bot2.text,
          answer_3: responses.bot3.text,
          voted_best_answer: selectedBot,
          justification: justification,
          disease_classification: questionClassification // Add the classification here
        }]);

      if (user?.role === 'student') {
        await updateFeedbackQuota('bot_arena');
      }

      handleFeedbackModalClose();
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

  // The rest of your component remains the same...
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Arena de Bots</h2>
        <p className="text-gray-300">Compare as respostas de diferentes bots e vote na melhor resposta.</p>
      </div>

      <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-white">{user?.name}</h3>
            <p className="text-sm text-gray-300">
              {user?.team?.name} • {user?.team?.disease?.name || 'Doença não atribuída'}
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
          </div>
        </div>
      </div>

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
                      {bot.icon && (
                        <img 
                          src={bot.icon} 
                          alt={bot.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
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