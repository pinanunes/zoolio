import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PaginaRegisto = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('doente');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await register(name, email, password, role);
      
      if (result.needsConfirmation) {
        setSuccess(result.message);
        // Don't navigate, let user know they need to check email
      } else {
        navigate('/chat');
      }
    } catch (error) {
      setError(error.message || 'Erro ao criar conta');
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
          <h2 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Criar Conta</h2>
          <p className="mt-2 text-sm" style={{ color: '#cbd5e1' }}>
            Junte-se à MarIA e comece a cuidar da sua saúde
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium" style={{ color: '#e2e8f0' }}>
              Nome Completo
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-3 py-2 mt-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-maria-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite o seu nome completo"
            />
          </div>

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
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 mt-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-maria-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium" style={{ color: '#e2e8f0' }}>
              Confirmar Palavra-passe
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 mt-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-maria-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a palavra-passe"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium" style={{ color: '#e2e8f0' }}>
              Papel
            </label>
            <select
              id="role"
              name="role"
              required
              className="w-full px-3 py-2 mt-1 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-maria-green-500"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="doente">Doente</option>
              <option value="cuidador/familiar/amigo">Cuidador/Familiar/Amigo</option>
              <option value="profissional de saúde">Profissional de Saúde</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-md" style={{ backgroundColor: '#fecaca', border: '1px solid #f87171' }}>
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-md" style={{ backgroundColor: '#bbf7d0', border: '1px solid #4ade80' }}>
              <p className="text-sm" style={{ color: '#16a34a' }}>{success}</p>
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
              {loading ? 'A criar conta...' : 'Criar Conta'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            Já tem conta?{' '}
            <Link 
              to="/login" 
              className="font-medium hover:underline transition-colors"
              style={{ color: '#4ade80' }}
            >
              Inicie sessão
            </Link>
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs" style={{ color: '#64748b' }}>
            Ao criar uma conta, concorda com os nossos{' '}
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

export default PaginaRegisto;
