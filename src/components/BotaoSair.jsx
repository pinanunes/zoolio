import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const BotaoSair = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 mt-4 font-bold text-white bg-red-500 rounded hover:bg-red-700"
    >
      Sair
    </button>
  );
};

export default BotaoSair;
