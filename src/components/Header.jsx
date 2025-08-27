import React from 'react';
import { useAuth } from '../context/AuthContext';
import BotaoSair from './BotaoSair';
import botSeniorAvatar from '../assets/bot_senior_avatar.svg';

const Header = () => {
  const { user } = useAuth();

  return (
    <header className="shadow-lg" style={{ backgroundColor: '#334155' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left side - Zoolio branding */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              {/* Zoolio Icon */}
              <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
                <img 
                  src={botSeniorAvatar} 
                  alt="Zoolio" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Zoolio</h1>
                <p className="text-sm text-gray-300">Plataforma Educativa de Medicina Veterinária</p>
              </div>
            </div>
          </div>

          {/* Right side - User info */}
          <div className="flex items-center space-x-6">
            {/* User info */}
            <div className="text-right">
              <p className="text-white font-medium">{user?.name}</p>
              <p className="text-sm text-gray-300 capitalize">
                {user?.role === 'student' ? 'Estudante' : user?.role}
              </p>
              {user?.role === 'student' && user?.team?.name && (
                <p className="text-xs text-green-400">{user.team.name}</p>
              )}
            </div>

            {/* Logout button */}
            <BotaoSair />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
