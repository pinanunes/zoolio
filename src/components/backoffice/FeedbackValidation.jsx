import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { BOTS } from '../../config/bots';

const FeedbackValidation = () => {
  const { user } = useAuth();
  const [feedbackLogs, setFeedbackLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [filters, setFilters] = useState({
    team: '',
    hasValidation: 'all', // 'all', 'validated', 'pending'
    keyword: '',
    disease: ''
  });
  const [teams, setTeams] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    validated: 0,
    pending: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadFeedbackLogs();
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

      // Load diseases
      const { data: diseasesData } = await supabase
        .from('diseases')
        .select('id, name')
        .order('name');

      setDiseases(diseasesData || []);
      
      // Load global statistics (unfiltered)
      await loadGlobalStats();
      
      await loadFeedbackLogs();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalStats = async () => {
    try {
      // Get total count of all feedbacks
      const { count: totalCount } = await supabase
        .from('chat_logs')
        .select('*', { count: 'exact', head: true })
        .not('feedback', 'is', null);

      // Get count of validated feedbacks (where is_validated = true)
      const { count: validatedCount } = await supabase
        .from('feedback_validations')
        .select('*', { count: 'exact', head: true })
        .eq('is_validated', true);

      // Calculate pending (total - validated)
      const pendingCount = (totalCount || 0) - (validatedCount || 0);

      setGlobalStats({
        total: totalCount || 0,
        validated: validatedCount || 0,
        pending: pendingCount
      });
    } catch (error) {
      console.error('Error loading global stats:', error);
    }
  };

  const loadFeedbackLogs = async () => {
    try {
      let query = supabase
        .from('chat_logs')
        .select(`
          *,
          profiles (full_name),
          teams (team_name),
          feedback_validations (
            id,
            comment,
            is_validated,
            points_awarded,
            created_at,
            professor:profiles!feedback_validations_professor_id_fkey (full_name)
          )
        `)
        .not('feedback', 'is', null)
        .order('created_at', { ascending: false });

      // Apply team filter
      if (filters.team) {
        query = query.eq('team_id', parseInt(filters.team));
      }

      // Apply disease filter (filter by teams that have this disease)
      if (filters.disease) {
        const { data: teamsWithDisease } = await supabase
          .from('teams')
          .select('id')
          .eq('assigned_disease_id', parseInt(filters.disease));
        
        if (teamsWithDisease && teamsWithDisease.length > 0) {
          const teamIds = teamsWithDisease.map(team => team.id);
          query = query.in('team_id', teamIds);
        } else {
          // No teams with this disease, return empty result
          setFeedbackLogs([]);
          return;
        }
      }

      const { data } = await query.limit(100);
      
      let filteredData = data || [];
      
      // Apply validation filter (FIXED LOGIC)
      if (filters.hasValidation === 'validated') {
        filteredData = filteredData.filter(log => 
          log.feedback_validations && 
          log.feedback_validations.length > 0 && 
          log.feedback_validations[0].is_validated === true
        );
      } else if (filters.hasValidation === 'pending') {
        filteredData = filteredData.filter(log => 
          !log.feedback_validations || 
          log.feedback_validations.length === 0 || 
          log.feedback_validations[0].is_validated !== true
        );
      }

      // Apply keyword filter
      if (filters.keyword && filters.keyword.trim()) {
        const keyword = filters.keyword.trim().toLowerCase();
        filteredData = filteredData.filter(log => 
          (log.question && log.question.toLowerCase().includes(keyword)) ||
          (log.answer && log.answer.toLowerCase().includes(keyword))
        );
      }

      setFeedbackLogs(filteredData);
    } catch (error) {
      console.error('Error loading feedback logs:', error);
    }
  };

  const validateFeedback = async (logId, comment, pointsAwarded) => {
    try {
      setProcessing(prev => ({ ...prev, [logId]: true }));

      // Check if validation already exists
      const existingValidation = feedbackLogs.find(log => log.id === logId)?.feedback_validations?.[0];
      
      if (existingValidation) {
        // Update existing validation
        const { error } = await supabase
          .from('feedback_validations')
          .update({
            comment: comment,
            points_awarded: pointsAwarded,
            is_validated: true
          })
          .eq('id', existingValidation.id);

        if (error) throw error;
      } else {
        // Create new validation
        const { error } = await supabase
          .from('feedback_validations')
          .insert([{
            log_id: logId,
            professor_id: user.id,
            comment: comment,
            points_awarded: pointsAwarded,
            is_validated: true
          }]);

        if (error) throw error;
      }

      // Update team points if points were awarded
      if (pointsAwarded > 0) {
        const log = feedbackLogs.find(l => l.id === logId);
        if (log?.team_id) {
          const { error: pointsError } = await supabase.rpc('increment_team_points', {
            team_id: log.team_id,
            points_to_add: pointsAwarded
          });
          
          if (pointsError) {
            console.error('Error updating team points:', pointsError);
          }
        }
      }

      // Reload data
      await loadFeedbackLogs();
      await loadGlobalStats(); // Update global stats after validation
      
      alert('Feedback validado com sucesso!');
    } catch (error) {
      console.error('Error validating feedback:', error);
      alert('Erro ao validar feedback: ' + error.message);
    } finally {
      setProcessing(prev => ({ ...prev, [logId]: false }));
    }
  };

  const clearFilters = () => {
    setFilters({
      team: '',
      hasValidation: 'all',
      keyword: '',
      disease: ''
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
      <h1 className="text-3xl font-bold text-white mb-6">Validação de Feedback</h1>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-lg font-bold text-white mb-2">Instruções</h2>
        <p className="text-gray-300">
          Revise o feedback dado pelos estudantes nas respostas do chat. Adicione comentários e atribua pontos de gamificação para bom feedback.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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

          <select
            value={filters.disease}
            onChange={(e) => setFilters(prev => ({ ...prev, disease: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
          >
            <option value="">Todas as doenças</option>
            {diseases.map(disease => (
              <option key={disease.id} value={disease.id}>{disease.name}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Pesquisar por palavra-chave (pergunta ou resposta)..."
            value={filters.keyword}
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
          />

          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Feedback Logs */}
      <div className="space-y-6">
        {feedbackLogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
              <span className="text-2xl">💬</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhum feedback encontrado</h3>
            <p className="text-gray-300">
              Não há feedbacks que correspondam aos filtros selecionados.
            </p>
          </div>
        ) : (
          feedbackLogs.map((log) => (
            <FeedbackLogCard
              key={log.id}
              log={log}
              onValidate={validateFeedback}
              processing={processing[log.id]}
            />
          ))
        )}
      </div>

      {/* Stats */}
      <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-2">Estatísticas Globais</h3>
        <p className="text-sm text-gray-400 mb-4">
          Estes números representam todos os feedbacks no sistema, independentemente dos filtros aplicados.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{globalStats.total}</p>
            <p className="text-sm text-gray-300">Total de feedbacks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{globalStats.validated}</p>
            <p className="text-sm text-gray-300">Feedbacks validados</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{globalStats.pending}</p>
            <p className="text-sm text-gray-300">Pendentes de validação</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual feedback log card component
const FeedbackLogCard = ({ log, onValidate, processing }) => {
  const [comment, setComment] = useState('');
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [showValidationForm, setShowValidationForm] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState(false);
  const [expandedAnswer, setExpandedAnswer] = useState(false);

  const existingValidation = log.feedback_validations?.[0];

  useEffect(() => {
    if (existingValidation) {
      setComment(existingValidation.comment || '');
      setPointsAwarded(existingValidation.points_awarded || 0);
    }
  }, [existingValidation]);

  // Helper function to truncate text
  const truncateText = (text, maxLength = 200) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Helper function to check if text needs truncation
  const needsTruncation = (text, maxLength = 200) => {
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

  return (
    <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-white font-medium">{log.profiles?.full_name}</p>
          <p className="text-sm text-gray-400">
            {log.teams?.team_name} • {new Date(log.created_at).toLocaleString('pt-PT')}
          </p>
          {/* Bot Information */}
          {log.bot_id && (
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-xs text-gray-500">Bot:</span>
              {(() => {
                const bot = Object.values(BOTS).find(b => b.id === log.bot_id);
                if (bot) {
                  return (
                    <div className="flex items-center space-x-1">
                      <div 
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: bot.color }}
                      >
                        <span className="text-white text-xs font-medium">
                          {bot.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: bot.color }}>
                        {bot.name}
                      </span>
                    </div>
                  );
                }
                return <span className="text-xs text-gray-500">Bot desconhecido</span>;
              })()}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-xs ${
            log.feedback === 1 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {log.feedback === 1 ? '👍 Útil' : '👎 Não útil'}
          </span>
          {existingValidation && existingValidation.is_validated === true && (
            <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
              Validado
            </span>
          )}
        </div>
      </div>

      {/* Chat Content */}
      <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#475569' }}>
        <div className="mb-3">
          <p className="text-gray-300 text-sm">
            <strong>Pergunta:</strong>{' '}
            {expandedQuestion ? log.question : truncateText(log.question)}
          </p>
          {needsTruncation(log.question) && (
            <button
              onClick={() => setExpandedQuestion(!expandedQuestion)}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
            >
              {expandedQuestion ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
        <div>
          <p className="text-gray-300 text-sm">
            <strong>Resposta:</strong>{' '}
            {expandedAnswer ? log.answer : truncateText(log.answer)}
          </p>
          {needsTruncation(log.answer) && (
            <button
              onClick={() => setExpandedAnswer(!expandedAnswer)}
              className="text-blue-400 hover:text-blue-300 text-xs mt-1 underline"
            >
              {expandedAnswer ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </div>
      </div>

      {/* Existing Validation */}
      {existingValidation && (
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#065f46' }}>
          <div className="flex justify-between items-start mb-2">
            <p className="text-white font-medium">
              Validado por: {existingValidation.professor?.full_name || 'Professor não identificado'}
            </p>
            <span className="text-xs text-green-200">
              {existingValidation.created_at && new Date(existingValidation.created_at).toLocaleString('pt-PT')}
            </span>
          </div>
          <p className="text-gray-200 text-sm mb-2">{existingValidation.comment}</p>
          <p className="text-green-400 text-sm font-medium">
            Pontos atribuídos: {existingValidation.points_awarded}
          </p>
        </div>
      )}

      {/* Validation Form */}
      {showValidationForm && (
        <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: '#475569' }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Comentário sobre o feedback
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
                placeholder="Adicione um comentário sobre a qualidade do feedback dado pelo estudante..."
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
                0 = Sem pontos, 1 = Feedback básico, 2 = Feedback bom, 3 = Feedback excelente
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
          {existingValidation ? 'Editar Validação' : 'Validar Feedback'}
        </button>
      )}
    </div>
  );
};

export default FeedbackValidation;
