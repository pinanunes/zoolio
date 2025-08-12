import React from 'react';

const TimeoutMessage = ({ onWaitMore, onCancel, botName = null }) => {
  return (
    <div className="bg-yellow-600 rounded-lg p-4 mb-4">
      <div className="flex items-center mb-3">
        <div className="w-6 h-6 mr-2 flex items-center justify-center">
          <span className="text-lg">⏰</span>
        </div>
        <h3 className="text-white font-medium">
          {botName ? `${botName} - Timeout` : 'Timeout'}
        </h3>
      </div>
      
      <p className="text-white text-sm mb-4">
        {botName 
          ? `O ${botName} está a demorar mais tempo que o esperado a responder.`
          : 'A resposta está a demorar mais tempo que o esperado.'
        } Quer esperar mais 20 segundos?
      </p>
      
      <div className="flex space-x-3">
        <button
          onClick={onWaitMore}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          Sim, esperar mais
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Não, cancelar
        </button>
      </div>
    </div>
  );
};

export default TimeoutMessage;
