import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [professors, setProfessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});
  const [stats, setStats] = useState({
    withDisease: 0,
    withSupervisor: 0,
    withBlueTeam: 0,
    withRedTeams: 0,
    submittedSheet: 0,
    submittedReview: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load teams with all related data (COMPLETE VERSION WITH BLUE/RED TEAMS)
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          diseases:assigned_disease_id (id, name),
          supervisor:supervisor_id (id, full_name),
          blue_team:blue_team_review_target_id (id, team_name),
          red_team_1:red_team_1_target_id (id, team_name),
          red_team_2:red_team_2_target_id (id, team_name)
        `)
        .order('id');

      if (teamsError) throw teamsError;

      // Load diseases
      const { data: diseasesData, error: diseasesError } = await supabase
        .from('diseases')
        .select('*')
        .order('name');

      if (diseasesError) throw diseasesError;

      // Load professors AND admins
      const { data: professorsData, error: professorsError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['professor', 'admin'])
        .eq('is_approved', true)
        .order('full_name');

      if (professorsError) throw professorsError;

      setTeams(teamsData || []);
      setDiseases(diseasesData || []);
      setProfessors(professorsData || []);
      
      // Calculate statistics
      calculateStats(teamsData || []);
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (teamsData) => {
    const stats = {
      withDisease: teamsData.filter(t => t.assigned_disease_id).length,
      withSupervisor: teamsData.filter(t => t.supervisor_id).length,
      withBlueTeam: teamsData.filter(t => t.blue_team_review_target_id).length,
      withRedTeams: teamsData.filter(t => t.red_team_1_target_id && t.red_team_2_target_id).length,
      submittedSheet: teamsData.filter(t => t.has_submitted_sheet).length,
      submittedReview: teamsData.filter(t => t.has_submitted_review).length
    };
    setStats(stats);
  };

  const updateTeam = async (teamId, field, value) => {
    try {
      setUpdating(prev => ({ ...prev, [`${teamId}-${field}`]: true }));

      const updateData = { [field]: value === '' ? null : value };
      
      const { error } = await supabase
        .from('teams')
        .update(updateData)
        .eq('id', teamId);

      if (error) throw error;

      // Reload data to get updated relationships
      await loadData();
      
    } catch (error) {
      console.error('Error updating team:', error);
      alert('Erro ao atualizar grupo: ' + error.message);
    } finally {
      setUpdating(prev => ({ ...prev, [`${teamId}-${field}`]: false }));
    }
  };

  const toggleSubmission = async (teamId, field) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const newValue = !team[field];
    await updateTeam(teamId, field, newValue);
  };

  // Helper function to get available diseases for a team
  const getAvailableDiseases = (currentTeam) => {
    const assignedDiseaseIds = teams
      .filter(t => t.id !== currentTeam.id && t.assigned_disease_id)
      .map(t => t.assigned_disease_id);
    
    return diseases.filter(disease => 
      !assignedDiseaseIds.includes(disease.id) || disease.id === currentTeam.assigned_disease_id
    );
  };

  // Helper function to get available blue team targets
  const getAvailableBlueTeamTargets = (currentTeam) => {
    const assignedBlueTargetIds = teams
      .filter(t => t.id !== currentTeam.id && t.blue_team_review_target_id)
      .map(t => t.blue_team_review_target_id);
    
    return teams.filter(t => 
      t.id !== currentTeam.id && 
      (!assignedBlueTargetIds.includes(t.id) || t.id === currentTeam.blue_team_review_target_id)
    );
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
      <h1 className="text-3xl font-bold text-white mb-6">Gestão de Grupos</h1>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-lg font-bold text-white mb-2">Instruções</h2>
        <p className="text-gray-300">
          Configure as atribuições para cada grupo: doença a estudar, professor supervisor e grupo alvo para revisão (Blue Team).
        </p>
      </div>

      {/* Statistics */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Estatísticas</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{stats.withDisease}</p>
            <p className="text-sm text-gray-300">Grupos com doença atribuída</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.withSupervisor}</p>
            <p className="text-sm text-gray-300">Grupos com supervisor</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.withBlueTeam}</p>
            <p className="text-sm text-gray-300">Grupos com alvo Blue Team</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{stats.withRedTeams}</p>
            <p className="text-sm text-gray-300">Grupos com Red Teams</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-400">{stats.submittedSheet}</p>
            <p className="text-sm text-gray-300">Fichas entregues</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-pink-400">{stats.submittedReview}</p>
            <p className="text-sm text-gray-300">Revisões entregues</p>
          </div>
        </div>
      </div>

      {/* Teams Table */}
      <div className="overflow-x-auto">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <div className="min-w-full">
            {/* Header */}
            <div className="grid grid-cols-8 gap-4 p-4 border-b" style={{ borderColor: '#475569' }}>
              <div className="font-bold text-white">GRUPO</div>
              <div className="font-bold text-white">DOENÇA ATRIBUÍDA</div>
              <div className="font-bold text-white">PROFESSOR SUPERVISOR</div>
              <div className="font-bold text-white">ALVO BLUE TEAM</div>
              <div className="font-bold text-white">RED TEAM 1</div>
              <div className="font-bold text-white">RED TEAM 2</div>
              <div className="font-bold text-white">FICHA ENTREGUE</div>
              <div className="font-bold text-white">REVISÃO ENTREGUE</div>
            </div>

            {/* Team Rows */}
            {teams.map((team) => (
              <div key={team.id} className="grid grid-cols-8 gap-4 p-4 border-b hover:bg-gray-600 transition-colors" style={{ borderColor: '#475569' }}>
                {/* Team Name */}
                <div className="text-white font-medium">{team.team_name}</div>

                {/* Disease Assignment */}
                <div>
                  <select
                    value={team.assigned_disease_id || ''}
                    onChange={(e) => updateTeam(team.id, 'assigned_disease_id', e.target.value)}
                    disabled={updating[`${team.id}-assigned_disease_id`]}
                    className="w-full px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{ 
                      backgroundColor: '#475569', 
                      border: '1px solid #64748b',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Selecionar doença...</option>
                    {getAvailableDiseases(team).map(disease => (
                      <option key={disease.id} value={disease.id}>{disease.name}</option>
                    ))}
                  </select>
                </div>

                {/* Supervisor Assignment */}
                <div>
                  <select
                    value={team.supervisor_id || ''}
                    onChange={(e) => updateTeam(team.id, 'supervisor_id', e.target.value)}
                    disabled={updating[`${team.id}-supervisor_id`]}
                    className="w-full px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{ 
                      backgroundColor: '#475569', 
                      border: '1px solid #64748b',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Selecionar professor...</option>
                    {professors.map(professor => (
                      <option key={professor.id} value={professor.id}>{professor.full_name}</option>
                    ))}
                  </select>
                </div>

                {/* Blue Team Target */}
                <div>
                  <select
                    value={team.blue_team_review_target_id || ''}
                    onChange={(e) => updateTeam(team.id, 'blue_team_review_target_id', e.target.value)}
                    disabled={updating[`${team.id}-blue_team_review_target_id`]}
                    className="w-full px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{ 
                      backgroundColor: '#475569', 
                      border: '1px solid #64748b',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Selecionar grupo...</option>
                    {getAvailableBlueTeamTargets(team).map(otherTeam => (
                      <option key={otherTeam.id} value={otherTeam.id}>{otherTeam.team_name}</option>
                    ))}
                  </select>
                </div>

                {/* Red Team 1 */}
                <div>
                  <select
                    value={team.red_team_1_target_id || ''}
                    onChange={(e) => updateTeam(team.id, 'red_team_1_target_id', e.target.value)}
                    disabled={updating[`${team.id}-red_team_1_target_id`]}
                    className="w-full px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{ 
                      backgroundColor: '#475569', 
                      border: '1px solid #64748b',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Selecionar grupo...</option>
                    {teams.filter(t => t.id !== team.id && t.id !== team.red_team_2_target_id).map(otherTeam => (
                      <option key={otherTeam.id} value={otherTeam.id}>{otherTeam.team_name}</option>
                    ))}
                  </select>
                </div>

                {/* Red Team 2 */}
                <div>
                  <select
                    value={team.red_team_2_target_id || ''}
                    onChange={(e) => updateTeam(team.id, 'red_team_2_target_id', e.target.value)}
                    disabled={updating[`${team.id}-red_team_2_target_id`]}
                    className="w-full px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{ 
                      backgroundColor: '#475569', 
                      border: '1px solid #64748b',
                      color: '#ffffff'
                    }}
                  >
                    <option value="">Selecionar grupo...</option>
                    {teams.filter(t => t.id !== team.id && t.id !== team.red_team_1_target_id).map(otherTeam => (
                      <option key={otherTeam.id} value={otherTeam.id}>{otherTeam.team_name}</option>
                    ))}
                  </select>
                </div>

                {/* Sheet Submitted */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => toggleSubmission(team.id, 'has_submitted_sheet')}
                    disabled={updating[`${team.id}-has_submitted_sheet`]}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      team.has_submitted_sheet 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {team.has_submitted_sheet ? '✓' : '✗'}
                  </button>
                </div>

                {/* Review Submitted */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => toggleSubmission(team.id, 'has_submitted_review')}
                    disabled={updating[`${team.id}-has_submitted_review`]}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      team.has_submitted_review 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {team.has_submitted_review ? '✓' : '✗'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Legenda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <p><strong>Blue Team:</strong> O grupo que este grupo irá rever (validar a ficha informativa)</p>
            <p><strong>Red Team 1 & 2:</strong> Os grupos que irão testar o bot baseado na ficha deste grupo</p>
          </div>
          <div>
            <p><strong>Ficha Entregue:</strong> Se o grupo já submeteu a primeira versão da sua ficha informativa</p>
            <p><strong>Revisão Entregue:</strong> Se o grupo já submeteu a revisão da ficha da sua Blue Team</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamManagement;
