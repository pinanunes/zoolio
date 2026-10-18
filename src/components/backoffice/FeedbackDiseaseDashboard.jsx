import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { getCurrentAcademicYearId } from '../../utils/academicYear';

const FeedbackDiseaseDashboard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const totals = rows.reduce(
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
          identificada e estado de validação, para o ano letivo atual.
        </p>
      </div>

      <div className="p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: '#475569' }}>
                <th className="py-2 px-3 text-white font-bold">Doença</th>
                <th className="py-2 px-3 text-white font-bold text-center">Validados</th>
                <th className="py-2 px-3 text-white font-bold text-center">Pendentes</th>
                <th className="py-2 px-3 text-white font-bold text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.disease_classification}
                  className="border-b hover:bg-gray-600 transition-colors"
                  style={{ borderColor: '#475569' }}
                >
                  <td className="py-2 px-3 text-white">{row.disease_classification}</td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-sm">{row.validated_count}</span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-yellow-600 text-white px-2 py-1 rounded text-sm">{row.pending_count}</span>
                  </td>
                  <td className="py-2 px-3 text-center text-white font-medium">{row.total_count}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    Nenhum feedback encontrado para o ano letivo atual.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: '#475569' }}>
                  <td className="py-2 px-3 text-white font-bold">Total</td>
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
