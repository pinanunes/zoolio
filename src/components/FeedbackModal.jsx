import React, { useState } from 'react';

const FeedbackModal = ({ isOpen, onClose, onSubmit, question, answer }) => {
  const [selectedOptions, setSelectedOptions] = useState({
    informacaoCorreta: false,
    informacaoCompleta: false,
    aprendiAlgo: false
  });
  const [comment, setComment] = useState('');

  const positiveFeedbackOptions = [
    { key: 'informacaoCorreta', label: 'A informação é correta' },
    { key: 'informacaoCompleta', label: 'A informação está completa' },
    { key: 'aprendiAlgo', label: 'Aprendi qualquer coisa com o bot hoje' }
  ];

  const handleOptionChange = (optionKey) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionKey]: !prev[optionKey]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check if at least one option is selected
    const hasSelectedOption = Object.values(selectedOptions).some(value => value);
    if (!hasSelectedOption) {
      alert('Por favor, selecione pelo menos uma opção.');
      return;
    }

    onSubmit({
      question,
      answer,
      feedback: {
        rating: 'positivo',
        options: selectedOptions,
        comment: comment.trim()
      }
    });

    // Reset form
    setSelectedOptions({
      informacaoCorreta: false,
      informacaoCompleta: false,
      aprendiAlgo: false
    });
    setComment('');
    onClose();
  };

  const handleClose = () => {
    setSelectedOptions({
      informacaoCorreta: false,
      informacaoCompleta: false,
      aprendiAlgo: false
    });
    setComment('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)' }}>
      <div className="rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: '#ffffff' }}>
              Feedback Positivo
            </h3>
            <button
              onClick={handleClose}
              className="transition-colors p-1 rounded-md"
              style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => {
                e.target.style.color = '#e2e8f0';
                e.target.style.backgroundColor = '#334155';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#94a3b8';
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-sm mb-6" style={{ color: '#cbd5e1' }}>
            Obrigado pelo feedback positivo! Selecione as opções que se aplicam:
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3" style={{ color: '#e2e8f0' }}>
                O que achou positivo na resposta:
              </label>
              <div className="space-y-3">
                {positiveFeedbackOptions.map((option) => (
                  <label 
                    key={option.key} 
                    className="flex items-center cursor-pointer p-2 rounded-lg transition-colors"
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#334155'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions[option.key]}
                      onChange={() => handleOptionChange(option.key)}
                      className="mr-3"
                      style={{ 
                        accentColor: '#4ade80',
                        backgroundColor: '#334155',
                        borderColor: '#475569'
                      }}
                    />
                    <span className="text-sm" style={{ color: '#e2e8f0' }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="comment" className="block text-sm font-medium mb-2" style={{ color: '#e2e8f0' }}>
                Descreva o que achou de positivo na resposta:
              </label>
              <textarea
                id="comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Descreva o que achou de positivo na resposta..."
                className="w-full px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-2"
                style={{ 
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  color: '#ffffff',
                  focusRingColor: '#4ade80',
                  focusBorderColor: '#4ade80'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#4ade80';
                  e.target.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#475569';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2"
                style={{ 
                  color: '#cbd5e1',
                  backgroundColor: '#334155',
                  border: '1px solid #475569'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#475569'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#334155'}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(148, 163, 184, 0.2)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2"
                style={{ 
                  color: '#ffffff',
                  backgroundColor: '#16a34a',
                  border: 'none'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#15803d'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#16a34a'}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px rgba(74, 222, 128, 0.2)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              >
                Enviar feedback
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
