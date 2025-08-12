import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const StudentAnalytics = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    studentsWithTeam: 0,
    totalFeedbacks: 0,
    approvedFeedbacks: 0,
    averageScore: 0
  });

  useEffect(() => {
    loadStudentAnalytics();
  }, []);

  const loadStudentAnalytics = async () => {
    try {
      setLoading(true);
      
      // Call the database function to get student analytics
      const { data, error } = await supabase.rpc('get_student_analytics');
      
      if (error) throw error;
      
      setStudents(data || []);
      calculateStats(data || []);
      
    } catch (error) {
      console.error('Error loading student analytics:', error);
      alert('Erro ao carregar análise de estudantes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (studentsData) => {
    const stats = {
      totalStudents: studentsData.length,
      studentsWithTeam: studentsData.filter(s => s.team_id).length,
      totalFeedbacks: studentsData.reduce((sum, s) => sum + parseInt(s.total_feedbacks || 0), 0),
      approvedFeedbacks: studentsData.reduce((sum, s) => sum + parseInt(s.approved_feedbacks || 0), 0),
      averageScore: studentsData.length > 0 
        ? (studentsData.reduce((sum, s) => sum + parseFloat(s.average_points_per_feedback || 0), 0) / studentsData.length).toFixed(2)
        : 0
    };
    setStats(stats);
  };

  const exportToCSV = () => {
    if (students.length === 0) {
      alert('Não há dados para exportar');
      return;
    }

    // Define CSV headers
    const headers = [
      'Nome',
      'Número de Estudante',
      'Grupo',
      'Doença Atribuída',
      'Doença Red Team 1',
      'Doença Red Team 2',
      'Total de Feedbacks',
      'Feedbacks Aprovados',
      'Pontuação Total',
      'Pontuação Média por Feedback'
    ];

    // Convert data to CSV format
    const csvData = students.map(student => [
      student.full_name || '',
      student.student_number || '',
      student.team_name || 'Sem grupo',
      student.assigned_disease_name || 'Não atribuída',
      student.red_team_1_disease || 'N/A',
      student.red_team_2_disease || 'N/A',
      student.total_feedbacks || 0,
      student.approved_feedbacks || 0,
      student.total_points || 0,
      student.average_points_per_feedback || 0
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Análise de Estudantes</h1>
        <button
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Exportar CSV</span>
        </button>
      </div>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-lg font-bold text-white mb-2">Descrição</h2>
        <p className="text-gray-300">
          Esta página apresenta uma análise detalhada de todos os estudantes, incluindo métricas de participação, 
          feedbacks dados e pontuações obtidas. Os dados podem ser exportados para CSV para análise externa.
        </p>
      </div>

      {/* Statistics */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Estatísticas Gerais</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.totalStudents}</p>
            <p className="text-sm text-gray-300">Total de Estudantes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{stats.studentsWithTeam}</p>
            <p className="text-sm text-gray-300">Com Grupo Atribuído</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.totalFeedbacks}</p>
            <p className="text-sm text-gray-300">Total de Feedbacks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{stats.approvedFeedbacks}</p>
            <p className="text-sm text-gray-300">Feedbacks Aprovados</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-400">{stats.averageScore}</p>
            <p className="text-sm text-gray-300">Pontuação Média</p>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="overflow-x-auto">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <div className="min-w-full">
            {/* Header */}
            <div className="grid grid-cols-10 gap-4 p-4 border-b" style={{ borderColor: '#475569' }}>
              <div className="font-bold text-white">NOME</div>
              <div className="font-bold text-white">Nº ESTUDANTE</div>
              <div className="font-bold text-white">GRUPO</div>
              <div className="font-bold text-white">DOENÇA ATRIBUÍDA</div>
              <div className="font-bold text-white">RED TEAM 1</div>
              <div className="font-bold text-white">RED TEAM 2</div>
              <div className="font-bold text-white">FEEDBACKS</div>
              <div className="font-bold text-white">APROVADOS</div>
              <div className="font-bold text-white">PONTOS</div>
              <div className="font-bold text-white">MÉDIA</div>
            </div>

            {/* Student Rows */}
            {students.map((student) => (
              <div key={student.student_id} className="grid grid-cols-10 gap-4 p-4 border-b hover:bg-gray-600 transition-colors" style={{ borderColor: '#475569' }}>
                {/* Name */}
                <div className="text-white font-medium">{student.full_name}</div>
                
                {/* Student Number */}
                <div className="text-gray-300">{student.student_number || 'N/A'}</div>
                
                {/* Team */}
                <div className="text-gray-300">{student.team_name || 'Sem grupo'}</div>
                
                {/* Assigned Disease */}
                <div className="text-gray-300">{student.assigned_disease_name || 'Não atribuída'}</div>
                
                {/* Red Team 1 Disease */}
                <div className="text-gray-300 text-sm">{student.red_team_1_disease || 'N/A'}</div>
                
                {/* Red Team 2 Disease */}
                <div className="text-gray-300 text-sm">{student.red_team_2_disease || 'N/A'}</div>
                
                {/* Total Feedbacks */}
                <div className="text-center">
                  <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm">
                    {student.total_feedbacks || 0}
                  </span>
                </div>
                
                {/* Approved Feedbacks */}
                <div className="text-center">
                  <span className="bg-green-600 text-white px-2 py-1 rounded text-sm">
                    {student.approved_feedbacks || 0}
                  </span>
                </div>
                
                {/* Total Points */}
                <div className="text-center">
                  <span className="bg-purple-600 text-white px-2 py-1 rounded text-sm">
                    {student.total_points || 0}
                  </span>
                </div>
                
                {/* Average Points */}
                <div className="text-center">
                  <span className="bg-orange-600 text-white px-2 py-1 rounded text-sm">
                    {student.average_points_per_feedback || '0.00'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {students.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              Nenhum estudante encontrado
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Legenda</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <p><strong>Feedbacks:</strong> Total de feedbacks (positivos e negativos) dados pelo estudante</p>
            <p><strong>Aprovados:</strong> Feedbacks validados pelos professores como úteis</p>
          </div>
          <div>
            <p><strong>Pontos:</strong> Soma total de pontos atribuídos pelos professores</p>
            <p><strong>Média:</strong> Pontuação média por feedback aprovado</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAnalytics;
