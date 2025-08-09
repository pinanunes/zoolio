import React from 'react';
import modelsData from '../config/models.json';

const ConfiguracaoPainel = ({ isOpen, onClose, config, onConfigChange }) => {
  const handleModelChange = (e) => {
    onConfigChange({
      ...config,
      modelo: e.target.value
    });
  };

  const handleMemoryChange = (value) => {
    onConfigChange({
      ...config,
      memoria: value
    });
  };

  const handlePromptChange = (e) => {
    onConfigChange({
      ...config,
      promptAdicional: e.target.value
    });
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      
      {/* Sliding Panel */}
      <div className={`
        fixed top-0 left-0 h-full w-80 bg-slate-900 shadow-2xl z-50 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Configuração</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Modelo
            </label>
            <select
              value={config.modelo}
              onChange={handleModelChange}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {modelsData.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Memory Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Memória
            </label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: 'sem_memoria', label: 'Sem memória' },
                { value: 'curto_prazo', label: 'Memória curto prazo' },
                { value: 'longo_prazo', label: 'Memória longo prazo' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleMemoryChange(option.value)}
                  className={`
                    px-3 py-2 text-sm rounded-lg border transition-colors text-left
                    ${config.memoria === option.value
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-gray-300 hover:bg-slate-700'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Adicionar à prompt
            </label>
            <textarea
              value={config.promptAdicional}
              onChange={handlePromptChange}
              placeholder="Instruções adicionais para o modelo..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-700">
          <p className="text-xs text-gray-400 text-center">
            As configurações são aplicadas imediatamente
          </p>
        </div>
      </div>
    </>
  );
};

export default ConfiguracaoPainel;
