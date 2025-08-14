import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

const ArenaFeedbackValidation = () => {
  const { user } = useAuth();
  const [arenaFeedback, setArenaFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [filters, setFilters] = useState({
    team: '',
    hasValidation: 'all',
    keyword: ''
  });
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadArenaFeedback();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, team_name')
        .order('team_name');

      setTeams(teamsData || []);
      
      await loadArenaFeedback();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadArenaFeedback = async () => {
    try {
      let query = supabase
        .from('comparative_chat_logs')
        .select(`
          *,
          profiles (full_name, team_id, teams (team_name))
        `)
        .not('justification', 'is', null)
        .order('created_at', { ascending: false });

      // Apply team filter
      if (filters.team) {
        const { data: usersInTeam } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', parseInt(filters.team));
        
        if (usersInTeam && usersInTeam.length > 0) {
          const userIds = usersInTeam.map(user => user.id);
          query = query.in('user_id', userIds);
        } else {
          setArenaFeedback([]);
          return;
        }
      }

      const { data } = await query.limit(50);
      
      let filteredData = data || [];
      
      // Apply validation filter
      if (filters.hasValidation === 'validated') {
        filteredData = filteredData.filter(log => log.is_validated === true);
      } else if (filters.hasValidation === 'pending') {
        filteredData = filteredData.filter(log => log.is_validated !== true);
      }

      // Apply keyword filter
      if (filters.keyword && filters.keyword.trim()) {
        const keyword = filters.keyword.trim().toLowerCase();
        filteredData = filteredData.filter(log => 
          (log.question && log.question.toLowerCase().includes(keyword)) ||
          (log.answer_1 && log.answer_1.toLowerCase().includes(keyword)) ||
          (log.answer_2 && log.answer_2.toLowerCase().includes(keyword)) ||
          (log.answer_3 && log.answer_3.toLowerCase().includes(keyword)) ||
          (log.justification && log.justification.toLowerCase().includes(keyword))
        );
      }

      setArenaFeedback(filteredData);
    } catch (error) {
      console.error('Error loading arena feedback:', error);
    }
  };

  const validateArenaFeedback = async (logId, comment, pointsAwarded) => {
    try {
      setProcessing(prev => ({ ...prev, [logId]: true }));

      // Update the comparative_chat_logs record
      const { error } = await supabase
        .from('comparative_chat_logs')
        .update({
          validation_comment: comment,
          points_awarded: pointsAwarded,
          is_validated: true,
          validated_by: user.id,
          validated_at: new Date().toISOString()
        })
        .eq('id', logId);

      if (error) throw error;

      // Update team points if points were awarded
      if (pointsAwarded > 0) {
        const log = arenaFeedback.find(l => l.id === logId);
        if (log?.profiles?.team_id) {
          const { error: pointsError } = await supabase.rpc('increment_team_points', {
            team_id: log.profiles.team_id,
            points_to_add: pointsAwarded
          });
          
          if (pointsError) {
            console.error('Error updating team points:', pointsError);
          }
        }
      }

      // Reload data
      await loadArenaFeedback();
      
      toast.success('Feedback da Arena validado com sucesso!', {
        duration: 3000,
        position: 'top-right',
      });
    } catch (error) {
      console.error('Error validating arena feedback:', error);
      toast.error('Erro ao validar feedback: ' + error.message, {
        duration: 4000,
        position: 'top-right',
      });
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  };

  const clearFilters = () => {
    setFilters({
      team: '',
      hasValidation: 'all',
      keyword: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex space-x-1">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Validação de Feedback - Arena de Bots</h2>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-2">Instruções</h3>
        <p className="text-gray-300">
          Revise o feedback dado pelos estudantes na Arena de Bots. Cada entrada mostra a pergunta, as três respostas dos bots, 
          a escolha do estudante e a justificação fornecida.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <select
            value={filters.team}
            onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
          >
            <option value="">Todas as equipas</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.team_name}</option>
            ))}
          </select>

          <select
            value={filters.hasValidation}
            onChange={(e) => setFilters(prev => ({ ...prev, hasValidation: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
          >
            <option value="all">Todos os feedbacks</option>
            <option value="pending">Pendentes de validação</option>
            <option value="validated">Já validados</option>
          </select>

          <input
            type="text"
            placeholder="Pesquisar por palavra-chave..."
            value={filters.keyword}
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
          />
        </div>
        
        <button
          onClick={clearFilters}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Limpar Filtros
        </button>
      </div>

      {/* Arena Feedback Logs */}
      <div className="space-y-6">
        {arenaFeedback.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
              <span className="text-2xl">⚔️</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhum feedback da Arena encontrado</h3>
            <p className="text-gray-300">
              Não há feedbacks da Arena que correspondam aos filtros selecionados.
            </p>
          </div>
        ) : (
          arenaFeedback.map((log) => (
            <ArenaFeedbackCard
              key={log.id}
              log={log}
              onValidate={validateArenaFeedback}
              processing={processing[log.id]}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Individual Arena feedback card component
const ArenaFeedbackCard = ({ log, onValidate, processing }) => {
  const [comment, setComment] = useState('');
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [showValidationForm, setShowValidationForm] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState({
    answer1: false,
    answer2: false,
    answer3: false,
    question: false,
    justification: false
  });

  const isValidated = log.is_validated === true;

  useEffect(() => {
    if (isValidated) {
      setComment(log.validation_comment || '');
      setPointsAwarded(log.points_awarded || 0);
    }
  }, [isValidated, log.validation_comment, log.points_awarded]);

  // Helper function to truncate text
  const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Helper function to check if text needs truncation
  const needsTruncation = (text, maxLength = 150) => {
    return text && text.length > maxLength;
  };

  const handleValidate = () => {
    if (!comment.trim()) {
      alert('Por favor, adicione um comentário.');
      return;
    }
    onValidate(log.id, comment, pointsAwarded);
    setShowValidationForm(false);
  };

  const toggleExpanded = (field) => {
    setExpandedAnswers(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-white font-medium">{log.profiles?.full_name}</p>
          <p className="text-sm text-gray-400">
            {log.profiles?.teams?.team_name} • {new Date(log.created_at).toLocaleString('pt-PT')}
          </p>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-500">Fonte:</span>
            <div className="flex items-center space-x-1">
              <span className="text-2xl">⚔️</span>
              <span className="text-xs text-orange-400 font-medium">Arena de Bots</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 rounded text-xs bg-orange-600 text-white">
            Arena
          </span>
          {isValidated && (
            <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
              Validado
            </span>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#475569' }}>
        <div className="mb-3">
          <p className="text-gray-300 text-sm">
            <strong>Pergunta:</strong>{' '}
            {expandedAnswers.question ? log.question : truncateText(log.question)}
          </p>
          {needsTruncation(log.question) && (
            <button
              onClick={() => toggleExpanded('question')}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
            >
              {expandedAnswers.question ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      </div>

      {/* Bot Answers */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((botNum) => {
          const answerKey = `answer_${botNum}`;
          const expandKey = `answer${botNum}`;
          const answer = log[answerKey];
          const isSelected = log.voted_best_answer === botNum;
          
          return (
            <div 
              key={botNum} 
              className={`p-3 rounded-lg ${isSelected ? 'ring-2 ring-green-400' : ''}`}
              style={{ backgroundColor: '#1e293b' }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-medium text-sm">Bot {botNum}</h4>
                {isSelected && (
                  <span className="px-2 py-1 rounded text-xs bg-green-600 text-white">
                    ✓ Selecionado
                  </span>
                )}
              </div>
              <p className="text-gray-300 text-xs">
                {expandedAnswers[expandKey] ? answer : truncateText(answer, 100)}
              </p>
              {needsTruncation(answer, 100) && (
                <button
                  onClick={() => toggleExpanded(expandKey)}
                  className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
                >
                  {expandedAnswers[expandKey] ? 'Ver menos' : 'Ver mais'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Student's Justification */}
      <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#1e293b' }}>
        <h4 className="text-white font-medium mb-3">💬 Justificação do Estudante</h4>
        <p className="text-gray-200 text-sm">
          {expandedAnswers.justification ? log.justification : truncateText(log.justification, 200)}
        </p>
        {needsTruncation(log.justification, 200) && (
          <button
            onClick={() => toggleExpanded('justification')}
            className="text-blue-400 hover:text-blue-300 text-xs mt-2 underline"
          >
            {expandedAnswers.justification ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>

      {/* Existing Validation */}
      {isValidated && (
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#065f46' }}>
          <div className="flex justify-between items-start mb-2">
            <p className="text-white font-medium">
              Validado por: Professor
            </p>
            <span className="text-xs text-green-200">
              {log.validated_at && new Date(log.validated_at).toLocaleString('pt-PT')}
            </span>
          </div>
          <p className="text-gray-200 text-sm mb-2">{log.validation_comment}</p>
          <p className="text-green-400 text-sm font-medium">
            Pontos atribuídos: {log.points_awarded}
          </p>
        </div>
      )}

      {/* Validation Form */}
      {showValidationForm && (
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#475569' }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Comentário sobre a justificação
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ 
                  backgroundColor: '#334155', 
                  border: '1px solid #64748b',
                  color: '#ffffff'
                }}
                rows="3"
                placeholder="Avalie a qualidade da justificação fornecida pelo estudante..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pontos de gamificação
              </label>
              <div className="flex space-x-2">
                {[0, 1, 2, 3].map((points) => (
                  <button
                    key={points}
                    type="button"
                    onClick={() => setPointsAwarded(points)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      pointsAwarded === points
                        ? 'bg-green-600 text-white border-2 border-green-400'
                        : 'bg-gray-600 text-gray-300 border-2 border-gray-500 hover:bg-gray-500'
                    }`}
                  >
                    {points}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                0 = Sem pontos, 1 = Justificação básica, 2 = Justificação boa, 3 = Justificação excelente
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleValidate}
                disabled={processing}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {processing ? 'A validar...' : 'Validar Feedback'}
              </button>
              <button
                onClick={() => setShowValidationForm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!showValidationForm && (
        <button
          onClick={() => setShowValidationForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isValidated ? 'Editar Validação' : 'Validar Feedback'}
        </button>
      )}
    </div>
  );
};

export default ArenaFeedbackValidation;
