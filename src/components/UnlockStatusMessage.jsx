import React from 'react';
import { useAuth } from '../context/AuthContext';

const UnlockStatusMessage = () => {
  const { user } = useAuth();

  // Don't show the message for professors or admins
  if (!user || user.role === 'professor' || user.role === 'admin') {
    return null;
  }
  
  // --- START OF THE FIX ---
  // Use the correct property names from the user.team object
  const fichaEntregue = user.team?.has_submitted_sheet || false;
  const revisaoEntregue = user.team?.has_submitted_review || false;
  // --- END OF THE FIX ---

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
    bgColor = 'bg-yellow-800'; // Changed to yellow to better represent "in progress"
    borderColor = 'border-yellow-600';
    textColor = 'text-yellow-200';
  } else if (fichaEntregue && revisaoEntregue) {
    // This message is positive, so we don't need to show a big status box.
    // Returning null makes the UI cleaner once everything is unlocked.
    return null;
  }

  // This condition handles the case where a team might not be assigned yet.
  if (!user.team) {
    return null;
  }
  
  if (!message) {
    return null;
  }

  return (
    <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
      <h3 className={`font-bold ${textColor}`}>Estado da Ficha Informativa</h3>
      <p className={`${textColor} mt-1 text-sm`}>{message}</p>
    </div>
  );
};

export default UnlockStatusMessage;