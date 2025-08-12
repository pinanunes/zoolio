import React, { useState } from 'react';

const FeedbackNegativoModal = ({ isOpen, onClose, onSubmit, question, answer }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [justification, setJustification] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasons = [
    'Resposta errada',
    'Resposta incompleta', 
    'Resposta desatualizada'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedReason || !justification.trim()) {
      alert('Por favor, selecione um motivo e forneça uma justificação.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        feedback_type: 'negative',
        negative_reason: selectedReason,
        student_justification: justification.trim(),
        question: question,
        answer: answer
      });
      
      // Reset form
      setSelectedReason('');
      setJustification('');
      onClose();
    } catch (error) {
      console.error('Error submitting negative feedback:', error);
      alert('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setJustification('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#1e293b' }}>
        {/* Header */}
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #475569' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              Feedback Negativo
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-300 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-300 mt-2">
            Ajude-nos a melhorar fornecendo detalhes sobre o que não funcionou bem nesta resposta.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {/* Original Question and Answer */}
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: '#334155' }}>
            <div className="mb-3">
              <h4 className="font-medium text-white mb-1">Pergunta:</h4>
              <p className="text-sm text-gray-300">{question}</p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">Resposta:</h4>
              <p className="text-sm text-gray-300">{answer}</p>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white mb-3">
              Qual é o principal problema com esta resposta? *
            </label>
            <div className="space-y-2">
              {reasons.map((reason) => (
                <label key={reason} className="flex items-center">
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    disabled={isSubmitting}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Justification */}
          <div className="mb-6">
            <label htmlFor="justification" className="block text-sm font-medium text-white mb-2">
              Justificação detalhada *
            </label>
            <textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              disabled={isSubmitting}
              placeholder="Explique em detalhe o que está errado, incompleto ou desatualizado na resposta. Esta informação será revista por um professor."
              rows={4}
              className="w-full px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#475569', 
                border: '1px solid #64748b',
                color: '#ffffff'
              }}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Mínimo 10 caracteres. Seja específico para ajudar a melhorar o sistema.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4" style={{ borderTop: '1px solid #475569' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#475569', border: '1px solid #64748b' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedReason || !justification.trim() || justification.trim().length < 10}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'A enviar...' : 'Enviar Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackNegativoModal;
