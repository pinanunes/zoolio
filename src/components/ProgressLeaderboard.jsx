import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

const ProgressLeaderboard = () => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [userTeam, setUserTeam] = useState(null);
  const [userStats, setUserStats] = useState({
    personalContribution: 0,
    teamRank: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get leaderboard data
      const { data: teams } = await supabase
        .from('teams')
        .select('id, team_name, points')
        .order('points', { ascending: false });

      setLeaderboard(teams || []);

      // Get user's team info - simplified approach
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (profile?.team_id) {
        // Get team details separately
        const { data: teamData } = await supabase
          .from('teams')
          .select('id, team_name, points, has_submitted_sheet')
          .eq('id', profile.team_id)
          .single();

        if (teamData) {
          setUserTeam(teamData);
          
          // Calculate team rank
          const teamRank = teams.findIndex(team => team.id === teamData.id) + 1;
        
          // Calculate personal contribution (simplified - could be more complex)
          const { data: userLogs } = await supabase
            .from('chat_logs')
            .select('feedback')
            .eq('user_id', user.id)
            .not('feedback', 'is', null);

          const personalContribution = userLogs?.filter(log => log.feedback === 1).length || 0;

          setUserStats({
            personalContribution,
            teamRank
          });
        }
      }

    } catch (error) {
      console.error('Error loading leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#FFD700'; // Gold
      case 2: return '#C0C0C0'; // Silver
      case 3: return '#CD7F32'; // Bronze
      default: return '#64748b'; // Gray
    }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Progresso e Leaderboard</h2>
        <p className="text-gray-300">Acompanhe o progresso da sua equipa e compare com outras equipas.</p>
      </div>

      {/* User Team Stats */}
      {userTeam && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
            <div className="text-3xl mb-2">🏆</div>
            <h3 className="text-lg font-bold text-white mb-1">Posição da Equipa</h3>
            <p className="text-2xl font-bold" style={{ color: getRankColor(userStats.teamRank) }}>
              {getRankIcon(userStats.teamRank)}
            </p>
          </div>

          <div className="p-6 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
            <div className="text-3xl mb-2">⭐</div>
            <h3 className="text-lg font-bold text-white mb-1">Pontos da Equipa</h3>
            <p className="text-2xl font-bold text-green-400">{userTeam.points}</p>
            <p className="text-sm text-gray-400">{userTeam.team_name}</p>
          </div>

          <div className="p-6 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
            <div className="text-3xl mb-2">👤</div>
            <h3 className="text-lg font-bold text-white mb-1">Pontos Pessoais</h3>
            <p className="text-2xl font-bold text-blue-400">{user?.personalPoints || 0}</p>
            <p className="text-sm text-gray-400">Seus pontos individuais</p>
          </div>

          <div className="p-6 rounded-lg text-center" style={{ backgroundColor: '#334155' }}>
            <div className="text-3xl mb-2">💬</div>
            <h3 className="text-lg font-bold text-white mb-1">Contribuição</h3>
            <p className="text-2xl font-bold text-purple-400">{userStats.personalContribution}</p>
            <p className="text-sm text-gray-400">Feedbacks dados</p>
          </div>
        </div>
      )}

      {/* Feedback Quotas */}
      {user?.feedbackQuotas && (
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-4">💎 Feedbacks Valiosos Restantes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#1e293b' }}>
              <div className="text-2xl mb-2" style={{ color: '#FFA500' }}>🤖</div>
              <h4 className="font-bold text-white mb-1">Bot Junior</h4>
              <p className="text-xl font-bold" style={{ color: user.feedbackQuotas.junior > 0 ? '#4ade80' : '#ef4444' }}>
                {user.feedbackQuotas.junior}/5
              </p>
              <p className="text-xs text-gray-400">restantes</p>
            </div>

            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#1e293b' }}>
              <div className="text-2xl mb-2" style={{ color: '#4CAF50' }}>🎓</div>
              <h4 className="font-bold text-white mb-1">Bot Senior</h4>
              <p className="text-xl font-bold" style={{ color: user.feedbackQuotas.senior > 0 ? '#4ade80' : '#ef4444' }}>
                {user.feedbackQuotas.senior}/5
              </p>
              <p className="text-xs text-gray-400">restantes</p>
            </div>

            <div className="p-4 rounded-lg text-center" style={{ backgroundColor: '#1e293b' }}>
              <div className="text-2xl mb-2" style={{ color: '#2196F3' }}>🏟️</div>
              <h4 className="font-bold text-white mb-1">Arena de Bots</h4>
              <p className="text-xl font-bold" style={{ color: user.feedbackQuotas.arena > 0 ? '#4ade80' : '#ef4444' }}>
                {user.feedbackQuotas.arena}/5
              </p>
              <p className="text-xs text-gray-400">restantes</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#1e293b' }}>
            <p className="text-sm text-gray-300">
              <strong>💡 Dica:</strong> Apenas os primeiros 5 feedbacks de cada área contam para pontos. 
              Pode continuar a dar feedback, mas só os "valiosos" são elegíveis para pontuação.
            </p>
          </div>
        </div>
      )}

      {/* Unlock Status */}
      {userTeam && (
        <div className="p-4 rounded-lg" style={{ backgroundColor: userTeam.is_sheet_validated ? '#065f46' : '#7c2d12' }}>
          <div className="flex items-center space-x-3">
            <div className="text-2xl">
              {userTeam.is_sheet_validated ? '✅' : '⏳'}
            </div>
            <div>
              <h3 className="font-bold text-white">
                Estado da Ficha Informativa
              </h3>
              <p className="text-sm text-gray-200">
                {userTeam.is_sheet_validated 
                  ? 'A sua equipa já submeteu e validou a Ficha Informativa. A Arena de Bots está desbloqueada!'
                  : 'A sua equipa ainda não submeteu ou validou a Ficha Informativa. A Arena de Bots permanece bloqueada.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">🏆 Classificação Geral</h3>
        <div className="space-y-2">
          {leaderboard.map((team, index) => {
            const rank = index + 1;
            const isUserTeam = userTeam && team.id === userTeam.id;
            
            return (
              <div
                key={team.id}
                className={`p-4 rounded-lg flex items-center justify-between transition-colors ${
                  isUserTeam 
                    ? 'ring-2 ring-green-500' 
                    : ''
                }`}
                style={{ 
                  backgroundColor: isUserTeam ? '#065f46' : '#334155'
                }}
              >
                <div className="flex items-center space-x-4">
                  <div 
                    className="text-xl font-bold w-12 text-center"
                    style={{ color: getRankColor(rank) }}
                  >
                    {getRankIcon(rank)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white">
                      {team.team_name}
                      {isUserTeam && <span className="ml-2 text-green-400">(Sua Equipa)</span>}
                    </h4>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">{team.points}</p>
                  <p className="text-sm text-gray-400">pontos</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gamification Info */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-3">ℹ️ Como Ganhar Pontos</h3>
        <div className="space-y-2 text-gray-300">
          <p>• <strong>Feedback Útil:</strong> Dê feedback positivo em respostas do chat que considera úteis</p>
          <p>• <strong>Participação na Arena:</strong> Vote nas melhores respostas na Arena de Bots</p>
          <p>• <strong>Validação de Professores:</strong> Receba pontos quando professores validam o seu feedback</p>
          <p>• <strong>Submissão de Fichas:</strong> Complete e submeta a Ficha Informativa da sua equipa</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressLeaderboard;
