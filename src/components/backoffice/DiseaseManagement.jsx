import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getCurrentAcademicYearId } from '../../utils/academicYear';

const DiseaseManagement = () => {
  const [diseases, setDiseases] = useState([]);
  const [historicDiseases, setHistoricDiseases] = useState([]);
  const [showHistoric, setShowHistoric] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newDiseaseName, setNewDiseaseName] = useState('');
  const [editingDisease, setEditingDisease] = useState(null);
  const [editName, setEditName] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadDiseases();
  }, []);

  const loadDiseases = async () => {
    try {
      setLoading(true);

      const yearId = await getCurrentAcademicYearId();

      // Load diseases (every year) with team assignment count and year label
      const { data: diseasesData, error } = await supabase
        .from('diseases')
        .select(`
          *,
          academic_years (label),
          teams!teams_assigned_disease_id_fkey (id)
        `)
        .order('name');

      if (error) throw error;

      // Process data to include assignment count
      const processedDiseases = diseasesData.map(disease => ({
        ...disease,
        assignedTeamsCount: disease.teams ? disease.teams.length : 0
      }));

      setDiseases(processedDiseases.filter(d => d.academic_year_id === yearId));
      setHistoricDiseases(processedDiseases.filter(d => d.academic_year_id !== yearId));
    } catch (error) {
      console.error('Error loading diseases:', error);
      alert('Erro ao carregar doenças: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addDisease = async () => {
    if (!newDiseaseName.trim()) {
      alert('Por favor, insira o nome da doença.');
      return;
    }

    try {
      setProcessing(true);
      
      const { error } = await supabase
        .from('diseases')
        .insert([{ name: newDiseaseName.trim() }]);

      if (error) throw error;

      setNewDiseaseName('');
      await loadDiseases();
      alert('Doença adicionada com sucesso!');
    } catch (error) {
      console.error('Error adding disease:', error);
      alert('Erro ao adicionar doença: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const startEdit = (disease) => {
    setEditingDisease(disease.id);
    setEditName(disease.name);
  };

  const cancelEdit = () => {
    setEditingDisease(null);
    setEditName('');
  };

  const saveEdit = async (diseaseId) => {
    if (!editName.trim()) {
      alert('Por favor, insira o nome da doença.');
      return;
    }

    try {
      setProcessing(true);
      
      const { error } = await supabase
        .from('diseases')
        .update({ name: editName.trim() })
        .eq('id', diseaseId);

      if (error) throw error;

      setEditingDisease(null);
      setEditName('');
      await loadDiseases();
      alert('Doença atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating disease:', error);
      alert('Erro ao atualizar doença: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const deleteDisease = async (disease) => {
    if (disease.assignedTeamsCount > 0) {
      alert(`Não é possível remover "${disease.name}" porque está atribuída a ${disease.assignedTeamsCount} grupo(s). Remova primeiro as atribuições.`);
      return;
    }

    if (!confirm(`Tem a certeza que deseja remover a doença "${disease.name}"?`)) {
      return;
    }

    try {
      setProcessing(true);
      
      const { error } = await supabase
        .from('diseases')
        .delete()
        .eq('id', disease.id);

      if (error) throw error;

      await loadDiseases();
      alert('Doença removida com sucesso!');
    } catch (error) {
      console.error('Error deleting disease:', error);
      alert('Erro ao remover doença: ' + error.message);
    } finally {
      setProcessing(false);
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
      <h1 className="text-3xl font-bold text-white mb-6">Gestão de Doenças</h1>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-lg font-bold text-white mb-2">Instruções</h2>
        <p className="text-gray-300">
          Gerir a lista de doenças disponíveis para atribuição aos grupos. Só pode remover doenças que ainda não estejam atribuídas a nenhum grupo.
        </p>
      </div>

      {/* Add New Disease */}
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Adicionar Nova Doença</h3>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Nome da doença..."
            value={newDiseaseName}
            onChange={(e) => setNewDiseaseName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addDisease()}
            className="flex-1 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ 
              backgroundColor: '#475569', 
              border: '1px solid #64748b',
              color: '#ffffff'
            }}
            disabled={processing}
          />
          <button
            onClick={addDisease}
            disabled={processing || !newDiseaseName.trim()}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {processing ? 'A adicionar...' : 'Adicionar'}
          </button>
        </div>
      </div>

      {/* Diseases List */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Lista de Doenças</h3>
        
        {diseases.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
              <span className="text-2xl">🦠</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma doença registada</h3>
            <p className="text-gray-300">
              Adicione a primeira doença usando o formulário acima.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {diseases.map((disease) => (
              <div
                key={disease.id}
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ backgroundColor: '#475569' }}
              >
                <div className="flex-1">
                  {editingDisease === disease.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') saveEdit(disease.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      style={{ 
                        backgroundColor: '#334155', 
                        border: '1px solid #64748b',
                        color: '#ffffff'
                      }}
                      autoFocus
                    />
                  ) : (
                    <div>
                      <h4 className="text-white font-medium">{disease.name}</h4>
                      <p className="text-sm text-gray-400">
                        {disease.assignedTeamsCount === 0 
                          ? 'Não atribuída a nenhum grupo'
                          : `Atribuída a ${disease.assignedTeamsCount} grupo(s)`
                        }
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {editingDisease === disease.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(disease.id)}
                        disabled={processing}
                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={processing}
                        className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(disease)}
                        disabled={processing}
                        className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteDisease(disease)}
                        disabled={processing || disease.assignedTeamsCount > 0}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                        title={disease.assignedTeamsCount > 0 ? 'Não pode remover uma doença atribuída a grupos' : 'Remover doença'}
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historic diseases — read-only, from past academic years */}
      {historicDiseases.length > 0 && (
        <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
          <button
            onClick={() => setShowHistoric(!showHistoric)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-lg font-bold text-white">
              Doenças de anos anteriores ({historicDiseases.length})
            </h3>
            <span className="text-gray-300">{showHistoric ? '▲' : '▼'}</span>
          </button>
          {showHistoric && (
            <div className="space-y-2 mt-4">
              {historicDiseases.map((disease) => (
                <div
                  key={disease.id}
                  className="flex items-center justify-between p-3 rounded-lg opacity-75"
                  style={{ backgroundColor: '#475569' }}
                >
                  <div>
                    <h4 className="text-white font-medium">{disease.name}</h4>
                    <p className="text-sm text-gray-400">
                      {disease.academic_years?.label || 'Ano desconhecido'} · {disease.assignedTeamsCount === 0
                        ? 'Não atribuída a nenhum grupo'
                        : `Atribuída a ${disease.assignedTeamsCount} grupo(s)`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statistics */}
      <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h3 className="text-lg font-bold text-white mb-4">Estatísticas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{diseases.length}</p>
            <p className="text-sm text-gray-300">Total de doenças</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              {diseases.filter(d => d.assignedTeamsCount > 0).length}
            </p>
            <p className="text-sm text-gray-300">Doenças atribuídas</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiseaseManagement;
