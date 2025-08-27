import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BOTS } from '../../config/bots';

// --- START: FINAL LogCard with Error Display ---
const LogCard = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const isArena = !log.hasOwnProperty('answer');
  const bot = BOTS[log.bot_id] || { name: 'Bot Desconhecido', color: '#64748b' };
  
  const hasIntentionalError = log.bot_id === 'bot_junior' && log.error_details?.has_error === true;
  const noIntentionalError = log.bot_id === 'bot_junior' && log.error_details?.has_error === false;

  const answerText = isArena 
    ? `Bot 1: ${log.answer_1}\n\nBot 2: ${log.answer_2}\n\nBot 3: ${log.answer_3}`
    : log.answer;
  const truncatedAnswer = answerText && answerText.length > 200 ? answerText.substring(0, 200) + '...' : answerText;

  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-white font-medium">{log.profiles?.full_name}</p>
          <div className="text-sm text-gray-400 flex items-center flex-wrap gap-x-2">
            <span>{log.teams?.team_name || 'Sem Equipa'}</span>
            <span>•</span>
            <span>{new Date(log.created_at).toLocaleString('pt-PT')}</span>
            <span>•</span>
            {isArena ? (
                <span className="font-medium" style={{ color: '#FF9800' }}>Arena de Bots</span>
            ) : (
                <span className="font-medium" style={{ color: bot.color }}>{bot.name}</span>
            )}
            {log.disease_classification && log.disease_classification !== 'Não Especificada' && (
              <>
                <span>•</span>
                <span className="px-2 py-0.5 text-xs rounded-full text-white font-medium" style={{ backgroundColor: '#A682FF' }}>
                  {log.disease_classification}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
            {hasIntentionalError && (
                <span className="px-2 py-1 rounded text-xs bg-yellow-600 text-white font-medium">
                    ⚠️ Erro Intencional
                </span>
            )}
            {noIntentionalError && (
                <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white font-medium">
                    ✓ Sem Erro
                </span>
            )}
            {isArena ? (
                log.voted_best_answer &&
                <span className="px-2 py-1 rounded text-xs bg-orange-600 text-white font-medium">
                    Votou no Bot {log.voted_best_answer}
                </span>
            ) : (
            log.feedback !== null && log.feedback !== undefined && (
                <span className={`px-2 py-1 rounded text-xs ${
                log.feedback === 1 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                {log.feedback === 1 ? '👍 Útil' : '👎 Não útil'}
                </span>
            )
            )}
        </div>
      </div>
      <div className="text-gray-300 text-sm space-y-2">
        <p><strong>Pergunta:</strong> {log.question}</p>
        <div>
            <p><strong>Resposta:</strong></p>
            <p className="pl-2 border-l-2 border-gray-600 italic whitespace-pre-wrap">
                {isExpanded ? answerText : truncatedAnswer}
            </p>
            {answerText && answerText.length > 200 && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-blue-400 hover:underline text-xs mt-1"
                >
                    {isExpanded ? 'Ver menos' : 'Ver mais'}
                </button>
            )}
        </div>
        {log.justification && (
            <p><strong>Justificação:</strong> {log.justification}</p>
        )}
      </div>

      {hasIntentionalError && (
        <div className="mt-4 pt-3 border-t border-gray-600">
            <button onClick={() => setShowErrorDetails(!showErrorDetails)} className="text-xs text-yellow-400 hover:underline">
                {showErrorDetails ? 'Esconder Análise do Erro' : 'Mostrar Análise do Erro'}
            </button>
            {showErrorDetails && (
                <div className="mt-2 p-3 rounded-lg bg-yellow-900 bg-opacity-30">
                    <p className="text-sm font-semibold text-yellow-300 mb-1">{log.error_details.error_type}</p>
                    <p className="text-xs text-yellow-200">{log.error_details.error_description}</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
};
// --- END: FINAL LogCard ---


const UsageMonitoring = () => {
  const [stats, setStats] = useState({
    totalChats: 0,
    totalComparativeChats: 0,
    todayChats: 0,
    activeTeams: 0
  });
  const [allLogs, setAllLogs] = useState([]);
  const [filters, setFilters] = useState({
    team: '',
    disease: '',
    dateFrom: '',
    dateTo: ''
  });
  const [teams, setTeams] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const LOGS_PER_PAGE = 20;

  useEffect(() => {
    // This effect now correctly handles the initial load and filter changes
    loadInitialData();
  }, [filters]);

  const loadInitialData = async () => {
    setLoading(true);
    setPage(0); // Always reset to page 0 on filter change
    setAllLogs([]); // Clear old logs
    await loadData(0, true); // Fetch the first page and static data
    setLoading(false);
  };

  const loadMoreData = async () => {
    if (loading || loadingMore || !hasMoreData) return;
    const nextPage = page + 1;
    await loadData(nextPage, false);
    setPage(nextPage);
  };

  const loadData = async (currentPage, isInitialLoad) => {
    if (!isInitialLoad) setLoadingMore(true);

    try {
      // Fetch static data (teams, diseases, stats) only on the very first load
      if (isInitialLoad) {
        const [
          { count: totalChats }, { count: totalComparativeChats },
          { data: teamsData }, { data: diseaseClassificationsData },
          { count: todayChats }, { data: activeTeamsData }
        ] = await Promise.all([
          supabase.from('chat_logs').select('*', { count: 'exact', head: true }),
          supabase.from('comparative_chat_logs').select('*', { count: 'exact', head: true }),
          supabase.from('teams').select('id, team_name').order('id', { ascending: true }),
          supabase.rpc('get_unique_disease_classifications'),
          supabase.from('chat_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
          supabase.from('chat_logs').select('team_id').not('team_id', 'is', null)
        ]);

        const uniqueTeams = new Set(activeTeamsData?.map(log => log.team_id) || []);
        setStats({
            totalChats: totalChats || 0, totalComparativeChats: totalComparativeChats || 0,
            todayChats: todayChats || 0, activeTeams: uniqueTeams.size
        });
        setTeams(teamsData || []);
        setDiseases(diseaseClassificationsData || []);
      }
      
      const from = currentPage * LOGS_PER_PAGE;
      const to = from + LOGS_PER_PAGE - 1;

      let chatQuery = supabase.from('chat_logs').select(`*, profiles(full_name), teams(team_name)`).order('created_at', { ascending: false }).range(from, to);
      let comparativeQuery = supabase.from('comparative_chat_logs').select(`*, profiles!user_id(full_name)`).order('created_at', { ascending: false }).range(from, to);

      // Apply filters to both queries
      if (filters.team) chatQuery = chatQuery.eq('team_id', parseInt(filters.team));
      if (filters.disease) {
        chatQuery = chatQuery.eq('disease_classification', filters.disease);
        comparativeQuery = comparativeQuery.eq('disease_classification', filters.disease);
      }
      if (filters.dateFrom) {
        chatQuery = chatQuery.gte('created_at', filters.dateFrom);
        comparativeQuery = comparativeQuery.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        chatQuery = chatQuery.lt('created_at', endDate.toISOString());
        comparativeQuery = comparativeQuery.lt('created_at', endDate.toISOString());
      }

      const [{ data: chatData }, { data: comparativeData }] = await Promise.all([chatQuery, comparativeQuery]);
      
      const newLogs = [...(chatData || []), ...(comparativeData || [])];
      
      // A more accurate check for "has more data"
      const totalFetched = (chatData?.length || 0) + (comparativeData?.length || 0);
      setHasMoreData(totalFetched >= LOGS_PER_PAGE);

      newLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      if (isInitialLoad) {
        setAllLogs(newLogs);
      } else {
        setAllLogs(prevLogs => [...prevLogs, ...newLogs]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (!isInitialLoad) setLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setFilters({ team: '', disease: '', dateFrom: '', dateTo: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
          {/* ... loading spinner ... */}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Monitorização de Utilização</h1>     
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Total de Chats</h3>
          <p className="text-3xl font-bold text-green-400">{stats.totalChats}</p>
        </div>
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Arena de Bots</h3>
          <p className="text-3xl font-bold text-blue-400">{stats.totalComparativeChats}</p>
        </div>
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Chats Hoje</h3>
          <p className="text-3xl font-bold text-yellow-400">{stats.todayChats}</p>
        </div>
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Equipas Ativas</h3>
          <p className="text-3xl font-bold text-purple-400">{stats.activeTeams}</p>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <select value={filters.team} onChange={(e) => setFilters(prev => ({ ...prev, team: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: '#475569', border: '1px solid #64748b', color: '#ffffff' }}
          >
            <option value="">Todas as equipas</option>
            {teams.map(team => (<option key={team.id} value={team.id}>{team.team_name}</option>))}
          </select>
          <select value={filters.disease} onChange={(e) => setFilters(prev => ({ ...prev, disease: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: '#475569', border: '1px solid #64748b', color: '#ffffff' }}
          >
            <option value="">Todas as doenças</option>
            {diseases.map(d => (<option key={d.classification} value={d.classification}>{d.classification}</option>))}
          </select>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: '#475569', border: '1px solid #64748b', color: '#ffffff' }}
          />
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: '#475569', border: '1px solid #64748b', color: '#ffffff' }}
          />
          <button onClick={clearFilters} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
            Limpar Filtros
          </button>
        </div>
      </div>

        <h3 className="text-xl font-bold text-white mb-4">Registos Recentes</h3>
      <div className="space-y-4">
        {allLogs.length > 0 ? (
          allLogs.map((log) => (
            <LogCard key={`${log.id}-${!log.hasOwnProperty('answer')}`} log={log} />
          ))
        ) : (
          <p className="text-gray-400 text-center py-8">Nenhum registo encontrado.</p>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        {hasMoreData && (
          <button
            onClick={loadMoreData}
            disabled={loadingMore}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loadingMore ? 'A carregar...' : 'Carregar Mais'}
          </button>
        )}
      </div>
    </div>
  );
};

export default UsageMonitoring;