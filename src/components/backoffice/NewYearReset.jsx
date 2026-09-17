import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

// Suggests the next label by incrementing a "YYYY/YYYY" pattern; falls back to blank
// for any other format so the admin just types it themselves.
const suggestNextLabel = (currentLabel) => {
  const match = currentLabel?.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return '';
  const [, start, end] = match;
  return `${parseInt(start, 10) + 1}/${parseInt(end, 10) + 1}`;
};

const NewYearReset = () => {
  const { user } = useAuth();
  const [currentYear, setCurrentYear] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    loadCurrentYear();
  }, [user]);

  const loadCurrentYear = async () => {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, label')
      .eq('is_current', true)
      .single();
    if (!error && data) {
      setCurrentYear(data);
      setNewLabel(suggestNextLabel(data.label));
    }
  };

  const handleStartClick = () => {
    if (!newLabel.trim()) {
      toast.error('Indique o nome do novo ano letivo (ex: 2026/2027).');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmStart = async () => {
    try {
      setIsStarting(true);

      const { data, error } = await supabase.rpc('start_new_academic_year', {
        p_label: newLabel.trim()
      });

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast.success(data.message, { duration: 5000, position: 'top-right' });
        await loadCurrentYear();
      } else {
        toast.error(data.message, { duration: 5000, position: 'top-right' });
      }
    } catch (error) {
      console.error('Error starting new academic year:', error);
      toast.error('Erro ao iniciar novo ano letivo: ' + error.message, {
        duration: 5000,
        position: 'top-right',
      });
    } finally {
      setIsStarting(false);
      setShowConfirmModal(false);
    }
  };

  // Only show this component to admins
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="p-6 rounded-lg border-2 border-green-600" style={{ backgroundColor: '#334155' }}>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-600">
              <span className="text-white text-xl">🎓</span>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Iniciar Novo Ano Letivo</h3>
            <p className="text-gray-300 text-sm mb-4">
              Ano letivo atual: <strong className="text-white">{currentYear?.label || '...'}</strong>
            </p>
            <p className="text-gray-300 text-sm mb-4">
              Nada é apagado. Todos os dados do ano atual — equipas, doenças, feedback,
              pontos, quotas — ficam guardados e continuam visíveis como histórico. A partir
              deste momento, os novos registos (novas equipas em "Gestão de Grupos", novas
              doenças em "Gestão de Doenças", novos estudantes que se registem) passam a
              pertencer ao novo ano letivo.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome do novo ano letivo
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ex: 2026/2027"
                disabled={isStarting}
                className="w-full max-w-xs px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ backgroundColor: '#475569', border: '1px solid #64748b', color: '#ffffff' }}
              />
            </div>

            {result && (
              <div className={`mb-4 p-3 rounded-lg ${
                result.success ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'
              }`}>
                <p className={`text-sm font-medium ${result.success ? 'text-green-200' : 'text-red-200'}`}>
                  {result.message}
                </p>
              </div>
            )}

            <button
              onClick={handleStartClick}
              disabled={isStarting}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isStarting ? 'A iniciar...' : 'Iniciar Novo Ano Letivo'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-green-600">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-600">
                <span className="text-white text-lg">🎓</span>
              </div>
              <h3 className="text-lg font-semibold text-white">
                Confirmar Início do Ano Letivo {newLabel}
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-300 text-sm mb-4">
                <strong className="text-white">{currentYear?.label}</strong> passa a ano
                anterior (continua acessível como histórico) e{' '}
                <strong className="text-white">{newLabel}</strong> passa a ser o ano letivo
                atual. Nenhum dado é apagado.
              </p>
              <p className="text-gray-300 text-sm">
                Depois de confirmar, crie as equipas e as doenças deste novo ano em "Gestão
                de Grupos" e "Gestão de Doenças".
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isStarting}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStart}
                disabled={isStarting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isStarting ? 'A iniciar...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewYearReset;
