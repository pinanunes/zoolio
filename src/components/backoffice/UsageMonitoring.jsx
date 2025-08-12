import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const UsageMonitoring = () => {
  const [stats, setStats] = useState({
    totalChats: 0,
    totalComparativeChats: 0,
    todayChats: 0,
    activeTeams: 0
  });
  const [chatLogs, setChatLogs] = useState([]);
  const [comparativeLogs, setComparativeLogs] = useState([]);
  const [filters, setFilters] = useState({
    team: '',
    disease: '',
    dateFrom: '',
    dateTo: ''
  });
  const [teams, setTeams] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (filters.team || filters.disease || filters.dateFrom || filters.dateTo) {
      loadFilteredLogs();
    } else {
      loadRecentLogs();
    }
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load basic stats
      const today = new Date().toISOString().split('T')[0];
      
      const [
        { count: totalChats },
        { count: totalComparativeChats },
        { count: todayChats },
        { data: teamsData },
        { data: diseasesData }
      ] = await Promise.all([
        supabase.from('chat_logs').select('*', { count: 'exact', head: true }),
        supabase.from('comparative_chat_logs').select('*', { count: 'exact', head: true }),
        supabase.from('chat_logs').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('teams').select('id, team_name').order('team_name'),
        supabase.from('diseases').select('id, name').order('name')
      ]);

      // Count active teams (teams with at least one chat log)
      const { data: activeTeamsData } = await supabase
        .from('chat_logs')
        .select('team_id')
        .not('team_id', 'is', null);
      
      const uniqueTeams = new Set(activeTeamsData?.map(log => log.team_id) || []);

      setStats({
        totalChats: totalChats || 0,
        totalComparativeChats: totalComparativeChats || 0,
        todayChats: todayChats || 0,
        activeTeams: uniqueTeams.size
      });

      setTeams(teamsData || []);
      setDiseases(diseasesData || []);
      
      await loadRecentLogs();

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentLogs = async () => {
    try {
      // Load recent chat logs
      const { data: chatData } = await supabase
        .from('chat_logs')
        .select(`
          *,
          profiles (full_name),
          teams (team_name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      // Load recent comparative logs
      const { data: comparativeData } = await supabase
        .from('comparative_chat_logs')
        .select(`
          *,
          profiles (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      setChatLogs(chatData || []);
      setComparativeLogs(comparativeData || []);
    } catch (error) {
      console.error('Error loading recent logs:', error);
    }
  };

  const loadFilteredLogs = async () => {
    try {
      let chatQuery = supabase
        .from('chat_logs')
        .select(`
          *,
          profiles (full_name),
          teams (team_name, diseases (name))
        `)
        .order('created_at', { ascending: false });

      let comparativeQuery = supabase
        .from('comparative_chat_logs')
        .select(`
          *,
          profiles (full_name)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.team) {
        chatQuery = chatQuery.eq('team_id', parseInt(filters.team));
      }
      
      if (filters.dateFrom) {
        chatQuery = chatQuery.gte('created_at', filters.dateFrom);
        comparativeQuery = comparativeQuery.gte('created_at', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1); // Include the entire day
        chatQuery = chatQuery.lt('created_at', endDate.toISOString());
        comparativeQuery = comparativeQuery.lt('created_at', endDate.toISOString());
      }

      const [{ data: chatData }, { data: comparativeData }] = await Promise.all([
        chatQuery.limit(50),
        comparativeQuery.limit(50)
      ]);

      // Filter by disease if specified
      let filteredChatData = chatData || [];
      if (filters.disease) {
        filteredChatData = filteredChatData.filter(log => 
          log.teams?.diseases?.some(disease => disease.name === filters.disease)
        );
      }

      setChatLogs(filteredChatData);
      setComparativeLogs(comparativeData || []);
    } catch (error) {
      console.error('Error loading filtered logs:', error);
    }
  };

  const clearFilters = () => {
    setFilters({
      team: '',
      disease: '',
      dateFrom: '',
      dateTo: ''
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
      <h1 className="text-3xl font-bold text-white mb-6">Monitorização de Utilização</h1>
      
      {/* Stats Cards */}
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

      {/* Filters */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <option key={disease.id} value={disease.name}>{disease.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
            placeholder="Data início"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
            className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
            placeholder="Data fim"
          />

          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'stats' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            Estatísticas
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'chats' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            Chat Principal ({chatLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('arena')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'arena' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            Arena de Bots ({comparativeLogs.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'chats' && (
        <div className="space-y-4">
          {chatLogs.map((log) => (
            <div key={log.id} className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-white font-medium">{log.profiles?.full_name}</p>
                  <p className="text-sm text-gray-400">
                    {log.teams?.team_name} • {new Date(log.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                {log.feedback && (
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.feedback === 1 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {log.feedback === 1 ? '👍 Útil' : '👎 Não útil'}
                  </span>
                )}
              </div>
              <div className="text-gray-300 text-sm">
                <p><strong>Pergunta:</strong> {log.question}</p>
                <p className="mt-2"><strong>Resposta:</strong> {log.answer.substring(0, 200)}...</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'arena' && (
        <div className="space-y-4">
          {comparativeLogs.map((log) => (
            <div key={log.id} className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-white font-medium">{log.profiles?.full_name}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(log.created_at).toLocaleString('pt-PT')}
                  </p>
                </div>
                {log.voted_best_answer && (
                  <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
                    Votou no Bot {log.voted_best_answer}
                  </span>
                )}
              </div>
              <div className="text-gray-300 text-sm">
                <p><strong>Pergunta:</strong> {log.question}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsageMonitoring;
