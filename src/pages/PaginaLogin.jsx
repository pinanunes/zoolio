import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PaginaLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/chat');
    } catch (error) {
      setError(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#1e293b' }}>
      <div className="w-full max-w-md p-8 space-y-6 rounded-lg shadow-lg" style={{ backgroundColor: '#334155' }}>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h2 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Bem-vindo de volta</h2>
          <p className="mt-2 text-sm" style={{ color: '#cbd5e1' }}>
            Inicie sessão na sua conta MarIA
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium" style={{ color: '#e2e8f0' }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 mt-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-maria-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite o seu email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium" style={{ color: '#e2e8f0' }}>
              Palavra-passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-3 py-2 mt-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-maria-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a sua palavra-passe"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="w-4 h-4 text-maria-green-600 border-gray-300 rounded focus:ring-maria-green-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm" style={{ color: '#cbd5e1' }}>
                Lembrar-me
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium hover:underline transition-colors" style={{ color: '#4ade80' }}>
                Esqueceu a palavra-passe?
              </a>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md" style={{ backgroundColor: '#fecaca', border: '1px solid #f87171' }}>
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-maria-green-500 disabled:opacity-50 transition-colors"
              style={{ 
                backgroundColor: '#16a34a',
                ':hover': { backgroundColor: '#15803d' }
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#15803d'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#16a34a'}
            >
              {loading ? 'A entrar...' : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Não tem conta?{' '}
            <Link 
              to="/register" 
              className="font-medium hover:underline transition-colors"
              style={{ color: '#4ade80' }}
            >
              Crie uma conta
            </Link>
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs" style={{ color: '#64748b' }}>
            Ao entrar, concorda com os nossos{' '}
            <a href="#" className="underline" style={{ color: '#4ade80' }}>
              Termos de Serviço
            </a>{' '}
            e{' '}
            <a href="#" className="underline" style={{ color: '#4ade80' }}>
              Política de Privacidade
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaginaLogin;
