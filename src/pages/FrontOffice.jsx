import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import BotJuniorChat from '../components/BotJuniorChat';
import BotSeniorChat from '../components/BotSeniorChat';
import BotArena from '../components/BotArena';
import ProgressLeaderboard from '../components/ProgressLeaderboard';
import MyFeedback from './MyFeedback';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getAvailableBotsForTeam } from '../config/bots';

const FrontOffice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bot-junior');
  const [loading, setLoading] = useState(false);

  // Check if user is professor or admin (bypass gamification)
  const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin';

  // Get team progress directly from user context
  const teamProgress = {
    hasSubmittedSheet: user?.team?.has_submitted_sheet || false,
    hasSubmittedReview: user?.team?.has_submitted_review || false
  };

  // Generate tabs based on team progress
  const generateTabs = () => {
    const tabs = [
      { id: 'bot-junior', name: 'Bot Junior', icon: '🤖', phase: 1, available: true }
    ];

    // Phase 2: Bot Senior
    const botSeniorAvailable = isProfessorOrAdmin || teamProgress.hasSubmittedSheet;
    tabs.push({
      id: 'bot-senior',
      name: 'Bot Senior',
      icon: botSeniorAvailable ? '🎓' : '🔒',
      phase: 2,
      available: botSeniorAvailable,
      tooltip: botSeniorAvailable ? '' : 'Disponível após submeter a ficha informativa'
    });

    // Phase 3: Bot Arena
    const botArenaAvailable = isProfessorOrAdmin || (teamProgress.hasSubmittedSheet && teamProgress.hasSubmittedReview);
    tabs.push({
      id: 'arena',
      name: 'Arena de Bots',
      icon: botArenaAvailable ? '⚔️' : '🔒',
      phase: 3,
      available: botArenaAvailable,
      tooltip: botArenaAvailable ? '' : 'Disponível após submeter a ficha e a revisão'
    });

    // Always available tabs
    tabs.push({ 
      id: 'progress', 
      name: 'Progresso', 
      icon: '🏆', 
      available: true 
    });

    // My Feedback tab (only for students)
    if (user?.role === 'student') {
      tabs.push({ 
        id: 'my-feedback', 
        name: 'O Meu Feedback', 
        icon: '📚', 
        available: true 
      });
    }

    // Add backoffice tab for professors and admins
    if (user?.role === 'professor' || user?.role === 'admin') {
      tabs.push({ 
        id: 'backoffice', 
        name: 'Backoffice', 
        icon: '⚙️', 
        available: true 
      });
    }

    return tabs;
  };

  const handleTabClick = (tabId, available) => {
    if (!available) return;
    
    if (tabId === 'backoffice') {
      navigate('/backoffice');
    } else {
      setActiveTab(tabId);
    }
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'bot-junior':
        return <BotJuniorChat />;
      case 'bot-senior':
        return (isProfessorOrAdmin || teamProgress.hasSubmittedSheet) ? <BotSeniorChat /> : <LockedPhaseMessage phase={2} />;
      case 'arena':
        return (isProfessorOrAdmin || (teamProgress.hasSubmittedSheet && teamProgress.hasSubmittedReview)) ? <BotArena /> : <LockedPhaseMessage phase={3} />;
      case 'progress':
        return <ProgressLeaderboard />;
      case 'my-feedback':
        return <MyFeedback />;
      default:
        return <BotJuniorChat />;
    }
  };

  const LockedPhaseMessage = ({ phase }) => {
    const messages = {
      2: {
        title: 'Bot Senior Bloqueado',
        description: 'O Bot Senior fica disponível após a sua equipa submeter a ficha informativa.',
        requirements: ['Submeter a ficha informativa da doença atribuída']
      },
      3: {
        title: 'Arena de Bots Bloqueada',
        description: 'A Arena de Bots fica disponível após a sua equipa submeter a revisão.',
        requirements: ['Submeter a ficha informativa', 'Submeter a revisão da doença de outra equipa']
      }
    };

    const message = messages[phase];

    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{message.title}</h2>
          <p className="text-gray-300 max-w-md mx-auto mb-6">
            {message.description}
          </p>
          
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white mb-3">Requisitos:</h3>
            <ul className="space-y-2">
              {message.requirements.map((req, index) => (
                <li key={index} className="flex items-center justify-center space-x-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                    (index === 0 && teamProgress.hasSubmittedSheet) || 
                    (index === 1 && teamProgress.hasSubmittedReview)
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-500 text-gray-300'
                  }`}>
                    {(index === 0 && teamProgress.hasSubmittedSheet) || 
                     (index === 1 && teamProgress.hasSubmittedReview) ? '✓' : index + 1}
                  </span>
                  <span className={`${
                    (index === 0 && teamProgress.hasSubmittedSheet) || 
                    (index === 1 && teamProgress.hasSubmittedReview)
                      ? 'text-green-400' 
                      : 'text-gray-300'
                  }`}>
                    {req}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const tabs = generateTabs();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1e293b' }}>
      {/* Header */}
      <Header />
      
      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: '#475569' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id, tab.available)}
                disabled={!tab.available}
                title={tab.tooltip}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-400'
                    : tab.available
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    : 'border-transparent text-gray-600 cursor-not-allowed opacity-50'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default FrontOffice;
