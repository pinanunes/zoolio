import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { getCurrentAcademicYearId } from '../../utils/academicYear';

const SortableHeader = ({ children, column, sortConfig, onSort }) => {
  const isSorted = sortConfig.key === column;
  const directionIcon = isSorted ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ' ↕';

  return (
    <th className="py-2 px-3">
      <div
        className="font-bold text-white cursor-pointer select-none flex items-center"
        onClick={() => onSort(column)}
      >
        {children}<span className="ml-1 opacity-60">{directionIcon}</span>
      </div>
    </th>
  );
};

const FeedbackDiseaseDashboard = ({ onSelectDisease }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ disease_classification: '', teacher_name: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'total_count', direction: 'descending' });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const yearId = await getCurrentAcademicYearId();
      const { data, error } = await supabase.rpc('get_feedback_dashboard_by_disease', { p_academic_year_id: yearId });
      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      console.error('Error loading feedback dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = rows.filter(row => {
      const diseaseMatch = row.disease_classification?.toLowerCase().includes(filters.disease_classification.toLowerCase());
      const teacherMatch = (row.teacher_name || '').toLowerCase().includes(filters.teacher_name.toLowerCase());
      return diseaseMatch && teacherMatch;
    });

    result.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? (typeof a.total_count === 'number' ? 0 : '');
      const bVal = b[sortConfig.key] ?? (typeof b.total_count === 'number' ? 0 : '');
      if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, filters, sortConfig]);

  const totals = filteredAndSortedRows.reduce(
    (acc, row) => ({
      validated: acc.validated + Number(row.validated_count),
      pending: acc.pending + Number(row.pending_count),
      total: acc.total + Number(row.total_count),
    }),
    { validated: 0, pending: 0, total: 0 }
  );

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
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <h2 className="text-lg font-bold text-white mb-2">Totais por Doença</h2>
        <p className="text-gray-300">
          Número de perguntas (chat e Arena) com feedback dado pelos estudantes, agrupadas por doença
          identificada e estado de validação, para o ano letivo atual. Clique numa linha para ver esse
          feedback na aba "Bot Junior & Senior".
        </p>
      </div>

      <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: '#475569' }}>
                <SortableHeader column="disease_classification" sortConfig={sortConfig} onSort={handleSort}>Doença</SortableHeader>
                <SortableHeader column="teacher_name" sortConfig={sortConfig} onSort={handleSort}>Professor</SortableHeader>
                <th className="py-2 px-3 text-white font-bold text-center">
                  <div onClick={() => handleSort('validated_count')} className="cursor-pointer select-none flex items-center justify-center">
                    Validados{sortConfig.key === 'validated_count' ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ' ↕'}
                  </div>
                </th>
                <th className="py-2 px-3 text-white font-bold text-center">
                  <div onClick={() => handleSort('pending_count')} className="cursor-pointer select-none flex items-center justify-center">
                    Pendentes{sortConfig.key === 'pending_count' ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ' ↕'}
                  </div>
                </th>
                <th className="py-2 px-3 text-white font-bold text-center">
                  <div onClick={() => handleSort('total_count')} className="cursor-pointer select-none flex items-center justify-center">
                    Total{sortConfig.key === 'total_count' ? (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ' ↕'}
                  </div>
                </th>
              </tr>
              <tr className="border-b" style={{ borderColor: '#475569' }}>
                <th className="py-2 px-3">
                  <input
                    type="text"
                    placeholder="Filtrar doença..."
                    value={filters.disease_classification}
                    onChange={(e) => handleFilterChange('disease_classification', e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-full"
                  />
                </th>
                <th className="py-2 px-3">
                  <input
                    type="text"
                    placeholder="Filtrar professor..."
                    value={filters.teacher_name}
                    onChange={(e) => handleFilterChange('teacher_name', e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-full"
                  />
                </th>
                <th colSpan={3}></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRows.map((row) => (
                <tr
                  key={row.disease_classification}
                  onClick={() => onSelectDisease && onSelectDisease(row.disease_classification)}
                  className="border-b hover:bg-gray-600 transition-colors cursor-pointer"
                  style={{ borderColor: '#475569' }}
                  title="Ver este feedback na aba Bot Junior & Senior"
                >
                  <td className="py-2 px-3 text-white">{row.disease_classification}</td>
                  <td className="py-2 px-3 text-gray-300">{row.teacher_name || '—'}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-sm">{row.validated_count}</span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-yellow-600 text-white px-2 py-1 rounded text-sm">{row.pending_count}</span>
                  </td>
                  <td className="py-2 px-3 text-center text-white font-medium">{row.total_count}</td>
                </tr>
              ))}
              {filteredAndSortedRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    Nenhum feedback encontrado para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredAndSortedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: '#475569' }}>
                  <td className="py-2 px-3 text-white font-bold" colSpan={2}>Total</td>
                  <td className="py-2 px-3 text-center text-green-400 font-bold">{totals.validated}</td>
                  <td className="py-2 px-3 text-center text-yellow-400 font-bold">{totals.pending}</td>
                  <td className="py-2 px-3 text-center text-white font-bold">{totals.total}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDiseaseDashboard;
