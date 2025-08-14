import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { BOTS } from '../config/bots';
import Header from '../components/Header';
import Footer from '../components/Footer';

const MyFeedback = () => {
  const { user } = useAuth();
  const [feedbackData, setFeedbackData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'mine', 'colleagues'
  const [botFilter, setBotFilter] = useState('all'); // 'all', 'bot_junior', 'bot_senior', 'arena'

  useEffect(() => {
    if (user?.teamId) {
      loadFeedbackData();
    }
  }, [user, filter, botFilter]);

  const loadFeedbackData = async () => {
    try {
      setLoading(true);
      
      // Get all team members
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('team_id', user.teamId);

      if (!teamMembers) {
        setFeedbackData([]);
        return;
      }

      const teamMemberIds = teamMembers.map(member => member.id);
      
      // Load regular chat feedback (Junior/Senior bots)
      let chatQuery = supabase
        .from('chat_logs')
        .select(`
          *,
          profiles (full_name),
          feedback_validations!inner (
            id,
            comment,
            points_awarded,
            created_at as validation_date,
            professor:profiles!feedback_validations_professor_id_fkey (full_name)
          )
        `)
        .in('user_id', teamMemberIds)
        .eq('feedback_validations.is_validated', true)
        .order('created_at', { ascending: false });

      // Load Arena feedback
      let arenaQuery = supabase
        .from('comparative_chat_logs')
        .select(`
          *,
          profiles (full_name)
        `)
        .in('user_id', teamMemberIds)
        .eq('is_validated', true)
        .not('justification', 'is', null)
        .order('created_at', { ascending: false });

      const [chatData, arenaData] = await Promise.all([
        chatQuery,
        arenaQuery
      ]);

      let allFeedback = [];

      // Process regular chat feedback
      if (chatData.data) {
        const chatFeedback = chatData.data.map(log => ({
          ...log,
          type: 'chat',
          source: log.bot_id === 'bot_junior' ? 'Bot Junior' : 'Bot Senior',
          validation: log.feedback_validations[0],
          studentName: log.profiles?.full_name,
          isMyFeedback: log.user_id === user.id
        }));
        allFeedback = [...allFeedback, ...chatFeedback];
      }

      // Process Arena feedback
      if (arenaData.data) {
        const arenaFeedback = arenaData.data.map(log => ({
          ...log,
          type: 'arena',
          source: 'Arena de Bots',
          validation: {
            comment: log.validation_comment,
            points_awarded: log.points_awarded,
            validation_date: log.validated_at,
            professor: { full_name: 'Professor' }
          },
          studentName: log.profiles?.full_name,
          isMyFeedback: log.user_id === user.id,
          // Format the answer to show all three bot responses
          answer: `Bot 1: ${log.answer_1}\n\nBot 2: ${log.answer_2}\n\nBot 3: ${log.answer_3}\n\nMelhor resposta selecionada: Bot ${log.voted_best_answer}`
        }));
        allFeedback = [...allFeedback, ...arenaFeedback];
      }

      // Apply filters
      let filteredFeedback = allFeedback;

      // Apply user filter
      if (filter === 'mine') {
        filteredFeedback = filteredFeedback.filter(item => item.isMyFeedback);
      } else if (filter === 'colleagues') {
        filteredFeedback = filteredFeedback.filter(item => !item.isMyFeedback);
      }

      // Apply bot filter
      if (botFilter !== 'all') {
        if (botFilter === 'arena') {
          filteredFeedback = filteredFeedback.filter(item => item.type === 'arena');
        } else {
          filteredFeedback = filteredFeedback.filter(item => item.bot_id === botFilter);
        }
      }

      // Sort by validation date (most recent first)
      filteredFeedback.sort((a, b) => {
        const dateA = new Date(a.validation?.validation_date || a.validation?.created_at);
        const dateB = new Date(b.validation?.validation_date || b.validation?.created_at);
        return dateB - dateA;
      });

      setFeedbackData(filteredFeedback);
    } catch (error) {
      console.error('Error loading feedback data:', error);
    } finally {
      setLoading(false);
    }
  };

  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1e293b' }}>
        <Header />
        <div className="flex items-center justify-center py-12">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1e293b' }}>
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">O Meu Feedback</h1>
          <p className="text-gray-300">
            Consulte o feedback validado pelos professores para si e para os seus colegas de equipa.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mostrar feedback de:
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ 
                  backgroundColor: '#475569', 
                  border: '1px solid #64748b',
                  color: '#ffffff'
                }}
              >
                <option value="all">Todo o grupo</option>
                <option value="mine">Apenas o meu</option>
                <option value="colleagues">Dos meus colegas</option>
              </select>
            </div>

            {/* Bot Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Filtrar por bot:
              </label>
              <select
                value={botFilter}
                onChange={(e) => setBotFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ 
                  backgroundColor: '#475569', 
                  border: '1px solid #64748b',
                  color: '#ffffff'
                }}
              >
                <option value="all">Todos os bots</option>
                <option value="bot_junior">Bot Junior</option>
                <option value="bot_senior">Bot Senior</option>
                <option value="arena">Arena de Bots</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedback Cards */}
        <div className="space-y-6">
          {feedbackData.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Nenhum feedback encontrado</h3>
              <p className="text-gray-300">
                Não há feedback validado que corresponda aos filtros selecionados.
              </p>
            </div>
          ) : (
            feedbackData.map((item) => (
              <FeedbackCard key={`${item.type}-${item.id}`} feedback={item} />
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

// Individual feedback card component
const FeedbackCard = ({ feedback }) => {
  const [expandedQuestion, setExpandedQuestion] = useState(false);
  const [expandedAnswer, setExpandedAnswer] = useState(false);
  const [expandedJustification, setExpandedJustification] = useState(false);

  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const needsTruncation = (text, maxLength = 200) => {
    return text && text.length > maxLength;
  };

  const getBotIcon = () => {
    if (feedback.type === 'arena') {
      return '⚔️';
    }
    
    const bot = Object.values(BOTS).find(b => b.id === feedback.bot_id);
    return bot ? (
      <div 
        className="w-5 h-5 rounded-full flex items-center justify-center"
        style={{ backgroundColor: bot.color }}
      >
        <span className="text-white text-xs font-medium">
          {bot.name.charAt(0)}
        </span>
      </div>
    ) : '🤖';
  };

  const getBotColor = () => {
    if (feedback.type === 'arena') return '#f97316'; // Orange for Arena
    
    const bot = Object.values(BOTS).find(b => b.id === feedback.bot_id);
    return bot?.color || '#6b7280';
  };

  return (
    <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-white font-medium">{feedback.studentName}</span>
            {feedback.isMyFeedback && (
              <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
                Você
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Fonte:</span>
            <div className="flex items-center space-x-1">
              {getBotIcon()}
              <span className="text-xs font-medium" style={{ color: getBotColor() }}>
                {feedback.source}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(feedback.created_at).toLocaleString('pt-PT')}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">
              {feedback.validation?.points_awarded || 0} pontos
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Validado em {new Date(feedback.validation?.validation_date || feedback.validation?.created_at).toLocaleDateString('pt-PT')}
          </p>
        </div>
      </div>

      {/* Question */}
      <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#475569' }}>
        <div className="mb-3">
          <p className="text-gray-300 text-sm">
            <strong>Pergunta:</strong>{' '}
            {expandedQuestion ? feedback.question : truncateText(feedback.question)}
          </p>
          {needsTruncation(feedback.question) && (
            <button
              onClick={() => setExpandedQuestion(!expandedQuestion)}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
            >
              {expandedQuestion ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      </div>

      {/* Answer */}
      <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#475569' }}>
        <div className="mb-3">
          <p className="text-gray-300 text-sm">
            <strong>Resposta:</strong>{' '}
            {expandedAnswer ? feedback.answer : truncateText(feedback.answer, 300)}
          </p>
          {needsTruncation(feedback.answer, 300) && (
            <button
              onClick={() => setExpandedAnswer(!expandedAnswer)}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
            >
              {expandedAnswer ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      </div>

      {/* Student's Original Feedback */}
      <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#1e293b' }}>
        <h4 className="text-white font-medium mb-3">💬 Feedback Original do Estudante</h4>
        
        {feedback.type === 'arena' ? (
          // Arena feedback - show justification
          <div>
            <p className="text-gray-300 text-sm mb-2">
              <strong>Melhor resposta selecionada:</strong> Bot {feedback.voted_best_answer}
            </p>
            <p className="text-gray-300 text-sm mb-2"><strong>Justificação:</strong></p>
            <p className="text-gray-200 text-sm italic bg-gray-700 p-2 rounded">
              "{expandedJustification ? feedback.justification : truncateText(feedback.justification, 150)}"
            </p>
            {needsTruncation(feedback.justification, 150) && (
              <button
                onClick={() => setExpandedJustification(!expandedJustification)}
                className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
              >
                {expandedJustification ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        ) : (
          // Regular chat feedback
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className={`px-2 py-1 rounded text-xs ${
                feedback.feedback === 1 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}>
                {feedback.feedback === 1 ? '👍 Útil' : '👎 Não útil'}
              </span>
            </div>
            
            {/* Positive feedback details */}
            {feedback.positive_feedback_details && (
              <div>
                {/* Selected Options */}
                {feedback.positive_feedback_details.options && (
                  <div className="mb-3">
                    <p className="text-gray-300 text-sm mb-2"><strong>Opções selecionadas:</strong></p>
                    <div className="flex flex-wrap gap-2">
                      {feedback.positive_feedback_details.options.informacaoCorreta && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                          ✓ Informação correta
                        </span>
                      )}
                      {feedback.positive_feedback_details.options.informacaoCompleta && (
                        <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                          ✓ Informação completa
                        </span>
                      )}
                      {feedback.positive_feedback_details.options.aprendiAlgo && (
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
                          ✓ Aprendi algo novo
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Written Comment */}
                {feedback.positive_feedback_details.comment && feedback.positive_feedback_details.comment.trim() && (
                  <div>
                    <p className="text-gray-300 text-sm mb-1"><strong>Comentário:</strong></p>
                    <p className="text-gray-200 text-sm italic bg-gray-700 p-2 rounded">
                      "{feedback.positive_feedback_details.comment}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Professor's Validation */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: '#065f46' }}>
        <div className="flex justify-between items-start mb-2">
          <p className="text-white font-medium">
            Validado por: {feedback.validation?.professor?.full_name || 'Professor'}
          </p>
          <span className="text-xs text-green-200">
            {new Date(feedback.validation?.validation_date || feedback.validation?.created_at).toLocaleString('pt-PT')}
          </span>
        </div>
        <p className="text-gray-200 text-sm mb-2">{feedback.validation?.comment}</p>
        <p className="text-green-400 text-sm font-medium">
          Pontos atribuídos: {feedback.validation?.points_awarded || 0}
        </p>
      </div>
    </div>
  );
};

export default MyFeedback;
