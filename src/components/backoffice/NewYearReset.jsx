import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

const NewYearReset = () => {
  const { user } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const handleResetClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      
      // Call the database function to reset academic year
      const { data, error } = await supabase.rpc('reset_academic_year');
      
      if (error) {
        throw error;
      }
      
      setResetResult(data);
      
      if (data.success) {
        toast.success('Ano letivo reiniciado com sucesso!', {
          duration: 5000,
          position: 'top-right',
        });
      } else {
        toast.error('Erro ao reiniciar ano letivo: ' + data.message, {
          duration: 5000,
          position: 'top-right',
        });
      }
      
    } catch (error) {
      console.error('Error resetting academic year:', error);
      toast.error('Erro ao reiniciar ano letivo: ' + error.message, {
        duration: 5000,
        position: 'top-right',
      });
    } finally {
      setIsResetting(false);
      setShowConfirmModal(false);
    }
  };

  const handleCancelReset = () => {
    setShowConfirmModal(false);
  };

  // Only show this component to admins
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="p-6 rounded-lg border-2 border-red-500" style={{ backgroundColor: '#334155' }}>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-600">
              <span className="text-white text-xl">⚠️</span>
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Reiniciar Ano Letivo</h3>
            <p className="text-gray-300 text-sm mb-4">
              Esta função irá reiniciar todos os dados do ano letivo atual. 
              <strong className="text-red-400"> Esta ação é irreversível!</strong>
            </p>
            
            <div className="mb-4">
              <h4 className="text-white font-medium mb-2">O que será reiniciado:</h4>
              <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
                <li>Todos os pontos pessoais dos estudantes (voltam a 0)</li>
                <li>Todos os pontos das equipas (voltam a 0)</li>
                <li>Quotas de feedback de todos os estudantes (voltam a 5 para cada bot)</li>
                <li>Histórico de quotas de feedback utilizadas</li>
              </ul>
            </div>
            
            {resetResult && (
              <div className={`mb-4 p-3 rounded-lg ${
                resetResult.success ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'
              }`}>
                <p className={`text-sm font-medium ${
                  resetResult.success ? 'text-green-200' : 'text-red-200'
                }`}>
                  {resetResult.message}
                </p>
                {resetResult.success && (
                  <div className="mt-2 text-xs text-green-300">
                    <p>Estudantes afetados: {resetResult.students_reset}</p>
                    <p>Equipas afetadas: {resetResult.teams_reset}</p>
                    <p>Quotas reiniciadas: {resetResult.quotas_reset}</p>
                    <p>Data do reset: {new Date(resetResult.reset_date).toLocaleString('pt-PT')}</p>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={handleResetClick}
              disabled={isResetting}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isResetting ? 'A reiniciar...' : 'Iniciar Novo Ano Letivo'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-red-500">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-600">
                <span className="text-white text-lg">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-white">
                Confirmar Reinício do Ano Letivo
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-300 text-sm mb-4">
                Tem a certeza de que pretende reiniciar o ano letivo? 
                <strong className="text-red-400"> Esta ação é irreversível</strong> e irá:
              </p>
              
              <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside mb-4">
                <li>Apagar todos os pontos dos estudantes e equipas</li>
                <li>Reiniciar todas as quotas de feedback para 5</li>
                <li>Limpar o histórico de quotas utilizadas</li>
              </ul>
              
              <p className="text-red-400 text-sm font-medium">
                Certifique-se de que fez backup dos dados importantes antes de continuar.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelReset}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isResetting ? 'A reiniciar...' : 'Confirmar Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewYearReset;
