import React from 'react';

const TimeoutMessage = ({ onWaitLonger, onCancel }) => {
  return (
    <div className="flex justify-start">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">M</span>
        </div>
        <div className="bg-slate-700 rounded-lg shadow-sm p-4 max-w-md">
          <div className="flex items-center space-x-2 mb-3">
            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-200 text-sm">
              A resposta está a demorar mais que o esperado. Deseja aguardar mais 20 segundos?
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onWaitLonger}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              Sim, aguardar
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              Não, cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeoutMessage;
