import React from 'react';
import { useAuth } from '../context/AuthContext';

const UnlockStatusMessage = () => {
  const { user } = useAuth();

  // Don't show the message for professors or admins
  if (!user || user.role === 'professor' || user.role === 'admin') {
    return null;
  }

  const fichaEntregue = user.team?.fichaEntregue || false;
  const revisaoEntregue = user.team?.revisaoEntregue || false;

  let message = '';
  let bgColor = '';
  let borderColor = '';
  let textColor = '';

  if (!fichaEntregue && !revisaoEntregue) {
    message = 'A sua equipa ainda não submeteu a Ficha da sua Equipa nem validou a Ficha da Blue team. O Bot Senior e a Arena de Bots permanecem bloqueados.';
    bgColor = 'bg-red-800';
    borderColor = 'border-red-600';
    textColor = 'text-red-200';
  } else if (fichaEntregue && !revisaoEntregue) {
    message = 'A sua equipa já submeteu a Ficha da sua Equipa mas ainda não validou a Ficha da Blue team. Já tem acesso ao Bot Senior mas a Arena de Bots permanece bloqueada.';
    bgColor = 'bg-orange-800';
    borderColor = 'border-orange-600';
    textColor = 'text-orange-200';
  } else if (fichaEntregue && revisaoEntregue) {
    message = 'A sua equipa já submeteu a Ficha da sua Equipa e validou a Ficha da Blue team. Já tem acesso ao Bot Senior e à Arena de Bots.';
    bgColor = 'bg-green-800';
    borderColor = 'border-green-600';
    textColor = 'text-green-200';
  }

  if (!message) {
    return null;
  }

  return (
    <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
      <h3 className={`font-bold ${textColor}`}>Estado da Ficha Informativa</h3>
      <p className={`${textColor} mt-1`}>{message}</p>
    </div>
  );
};

export default UnlockStatusMessage;
