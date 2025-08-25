import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient'; // Import supabase
import TeamManagement from '../components/backoffice/TeamManagement';
import UserApprovals from '../components/backoffice/UserApprovals';
import UsageMonitoring from '../components/backoffice/UsageMonitoring';
import FeedbackValidation from '../components/backoffice/FeedbackValidation';
import DiseaseManagement from '../components/backoffice/DiseaseManagement';
import StudentAnalytics from '../components/backoffice/StudentAnalytics';
import BotaoSair from '../components/BotaoSair';
import Footer from '../components/Footer';

const BackOffice = () => {
  const { user } = useAuth();
  const location = useLocation();

  // --- START OF FIX 1: Add a "Return to App" link ---
  const menuItems = [
    { path: '/', name: 'Voltar à App', icon: '⬅️', isExternal: true },
    { path: '/backoffice', name: 'Dashboard', icon: '📊' },
    { path: '/backoffice/teams', name: 'Gestão de Grupos', icon: '👥' },
    { path: '/backoffice/diseases', name: 'Gestão de Doenças', icon: '🦠' },
    { path: '/backoffice/students', name: 'Análise de Estudantes', icon: '🎓' },
    { path: '/backoffice/approvals', name: 'Aprovações', icon: '✅' },
    { path: '/backoffice/monitoring', name: 'Monitorização', icon: '📈' },
    { path: '/backoffice/feedback', name: 'Validação de Feedback', icon: '💬' }
  ];
  // --- END OF FIX 1 ---

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1e293b' }}>
      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-64 shadow-lg" style={{ backgroundColor: '#334155' }}>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
                <span className="text-white font-bold text-lg">Z</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Zoolio</h1>
                <p className="text-sm text-gray-300">Backoffice</p>
              </div>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    location.pathname === item.path && !item.isExternal
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-600 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="absolute bottom-0 w-64 p-6 border-t" style={{ borderColor: '#475569' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{user?.name}</p>
                <p className="text-sm text-gray-300 capitalize">{user?.role}</p>
              </div>
              <BotaoSair />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/teams" element={<TeamManagement />} />
            <Route path="/diseases" element={<DiseaseManagement />} />
            <Route path="/students" element={<StudentAnalytics />} />
            <Route path="/approvals" element={<UserApprovals />} />
            <Route path="/monitoring" element={<UsageMonitoring />} />
            <Route path="/feedback" element={<FeedbackValidation />} />
          </Routes>
        </div>
      </div>
      <Footer />
    </div>
  );
};

// --- START OF FIX 2: Implement Real-Time Dashboard Stats ---
const Dashboard = () => {
  const [stats, setStats] = useState({
    total_teams: 0,
    pending_approvals: 0,
    messages_today: 0,
    active_users_today: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_dashboard_stats');
        if (error) throw error;
        if (data && data.length > 0) {
          setStats(data[0]);
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Total de Equipas</h3>
          <p className="text-3xl font-bold text-green-400">{loading ? '-' : stats.total_teams}</p>
        </div>
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Utilizadores Ativos (Hoje)</h3>
          <p className="text-3xl font-bold text-blue-400">{loading ? '-' : stats.active_users_today}</p>
        </div>
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Mensagens Hoje</h3>
          <p className="text-3xl font-bold text-yellow-400">{loading ? '-' : stats.messages_today}</p>
        </div>
        <div className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <h3 className="text-lg font-bold text-white mb-2">Aprovações Pendentes</h3>
          <p className="text-3xl font-bold text-red-400">{loading ? '-' : stats.pending_approvals}</p>
        </div>
      </div>
      
      <div className="mt-8 p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-xl font-bold text-white mb-4">Bem-vindo ao Backoffice do Zoolio</h2>
        <p className="text-gray-300">
          Use o menu lateral para navegar pelas diferentes secções de gestão da plataforma.
        </p>
      </div>
    </div>
  );
};
// --- END OF FIX 2 ---

export default BackOffice;