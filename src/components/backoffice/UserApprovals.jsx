import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

const UserApprovals = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'professor')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      setPendingUsers(data || []);
    } catch (error) {
      console.error('Error loading pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId) => {
    try {
      setProcessing(prev => ({ ...prev, [userId]: true }));

      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', userId);

      if (error) throw error;

      // Remove from pending list
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      alert('Professor aprovado com sucesso!');
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Erro ao aprovar professor: ' + error.message);
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: false }));
    }
  };

  const rejectUser = async (userId) => {
    if (!confirm('Tem certeza que deseja rejeitar este professor? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setProcessing(prev => ({ ...prev, [userId]: true }));

      // Delete the profile (this will also delete the auth user due to CASCADE)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      // Remove from pending list
      setPendingUsers(prev => prev.filter(user => user.id !== userId));
      
      alert('Professor rejeitado e removido do sistema.');
    } catch (error) {
      console.error('Error rejecting user:', error);
      alert('Erro ao rejeitar professor: ' + error.message);
    } finally {
      setProcessing(prev => ({ ...prev, [userId]: false }));
    }
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
      <h1 className="text-3xl font-bold text-white mb-6">Aprovações de Professores</h1>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-lg font-bold text-white mb-2">Instruções</h2>
        <p className="text-gray-300">
          Revise e aprove os registos de professores pendentes. Apenas professores aprovados podem aceder ao backoffice.
        </p>
      </div>

      {pendingUsers.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
            <span className="text-2xl">✅</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Nenhuma aprovação pendente</h3>
          <p className="text-gray-300">
            Todos os professores registados foram aprovados ou não há novos registos pendentes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <div key={user.id} className="p-6 rounded-lg" style={{ backgroundColor: '#334155' }}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
                      <span className="text-white font-bold text-lg">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{user.full_name}</h3>
                      <p className="text-gray-300">{user.email}</p>
                      <p className="text-sm text-gray-400">
                        Registado em: {new Date(user.created_at).toLocaleDateString('pt-PT')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => approveUser(user.id)}
                    disabled={processing[user.id]}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing[user.id] ? 'A aprovar...' : 'Aprovar'}
                  </button>
                  <button
                    onClick={() => rejectUser(user.id)}
                    disabled={processing[user.id]}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing[user.id] ? 'A rejeitar...' : 'Rejeitar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-2">Estatísticas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{pendingUsers.length}</p>
            <p className="text-sm text-gray-300">Aprovações pendentes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {pendingUsers.length === 0 ? 'Todas' : 'Pendente'}
            </p>
            <p className="text-sm text-gray-300">Estado das aprovações</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserApprovals;
