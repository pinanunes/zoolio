// Import bot avatars
import botJuniorAvatar from '../assets/bot_junior_avatar.svg';
import botSeniorAvatar from '../assets/bot_senior_avatar.svg';
import botPubmedAvatar from '../assets/bot_pubmed_avatar.svg';
import botLLMAvatar from '../assets/bot_LLM_avatar.svg';

// Central configuration for all bots in the system
export const BOTS = {
  bot_junior: {
    id: 'bot_junior',
    name: 'Bot Junior',
    description: 'Bot inicial com respostas básicas e algumas incertezas',
    endpoint: 'https://manuelnunes.duckdns.org/webhook/b02fc3cb-3e32-45a5-9cfe-fc5ac994a587',
    icon: botJuniorAvatar,
    color: '#FFA500', // Orange for junior
    phase: 1,
    requiresSheetSubmitted: false,
    requiresReviewSubmitted: false
  },
  bot_senior: {
    id: 'bot_senior',
    name: 'Bot Senior',
    description: 'Bot treinado com informação compilada pelos estudantes',
    endpoint: 'https://manuelnunes.duckdns.org/webhook/eb8add01-d6e3-4e47-a6f2-14bc52d828ab',
    icon: botSeniorAvatar,
    color: '#4CAF50', // Green for senior
    phase: 2,
    requiresSheetSubmitted: true,
    requiresReviewSubmitted: false
  },
  bot_pubmed: {
    id: 'bot_pubmed',
    name: 'Bot PubMed',
    description: 'Bot especializado em literatura científica',
    endpoint: 'https://manuelnunes.duckdns.org/webhook/f889d515-b0c4-45fa-8fff-1b4e099775db',
    icon: botPubmedAvatar,
    color: '#2196F3', // Blue for PubMed
    phase: 3,
    requiresSheetSubmitted: true,
    requiresReviewSubmitted: true
  },
  bot_llm: {
    id: 'bot_llm',
    name: 'Bot LLM',
    description: 'Bot de linguagem avançado',
    endpoint: 'https://manuelnunes.duckdns.org/webhook/0cd725d3-7bd5-4ed9-83dc-1e9221747484',
    icon: botLLMAvatar,
    color: '#9C27B0', // Purple for LLM
    phase: 3,
    requiresSheetSubmitted: true,
    requiresReviewSubmitted: true
  }
};

// Helper function to get bot by ID
export const getBotById = (botId) => {
  return BOTS[botId] || null;
};

// Helper function to get available bots for a team's progress
export const getAvailableBotsForTeam = (hasSubmittedSheet, hasSubmittedReview) => {
  return Object.values(BOTS).filter(bot => {
    if (bot.requiresReviewSubmitted && !hasSubmittedReview) return false;
    if (bot.requiresSheetSubmitted && !hasSubmittedSheet) return false;
    return true;
  });
};

// Helper function to get bots for Bot Arena (phase 3)
export const getArenaBotsForTeam = (hasSubmittedReview, userRole) => {
  // --- START OF THE FIX ---
  // If the user is an admin or professor, always grant access.
  if (userRole === 'admin' || userRole === 'professor') {
    return [
      BOTS.bot_senior,
      BOTS.bot_pubmed,
      BOTS.bot_llm
    ];
  }
  // --- END OF THE FIX ---
  
  // For students, check their progress.
  if (!hasSubmittedReview) {
    return [];
  }
  
  return [
    BOTS.bot_senior,
    BOTS.bot_pubmed,
    BOTS.bot_llm
  ];
};

// Helper function to get bot display name with color
export const getBotDisplayInfo = (botId) => {
  const bot = getBotById(botId);
  if (!bot) return { name: 'Bot Desconhecido', color: '#666666' };
  
  return {
    name: bot.name,
    color: bot.color,
    icon: bot.icon
  };
};
