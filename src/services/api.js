import axios from 'axios';
import { supabase } from '../supabaseClient';

// n8n webhook URLs (now secure HTTPS)
const CHAT_WEBHOOK_URL = 'https://manuelnunes.duckdns.org/webhook/0617abad-ef75-4320-8231-1e4468ce6a83';
const FEEDBACK_WEBHOOK_URL = 'https://manuelnunes.duckdns.org/webhook/429f2428-e083-4d60-84a1-610d4808b0a3';

// Secure API key for webhook authentication
const WEBHOOK_API_KEY = 'maria-secure-key-2024-supabase-v1';

// Create axios instance with default timeout
const api = axios.create({
  timeout: 20000, // Default 20 seconds
});

// Function to get user data from Supabase session (including role)
const getUserData = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Utilizador',
      role: session.user.user_metadata?.role || 'doente'
    };
  }
  return null;
};

// Send chat message to webhook
export const sendChatMessage = async (message, user, config = null, customTimeout = null) => {
  try {
    const userData = await getUserData();
    
    const payload = {
      message: message,
      user: userData || user, // Use Supabase user data if available, fallback to passed user
      timestamp: new Date().toISOString(),
      source: 'maria-chat-supabase'
    };

    // Add configuration if provided
    if (config) {
      payload.config = config;
    }
    
    // Create request config with custom timeout if provided
    const requestConfig = {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': WEBHOOK_API_KEY
      }
    };
    
    if (customTimeout) {
      requestConfig.timeout = customTimeout;
    }
    
    const response = await api.post(CHAT_WEBHOOK_URL, payload, requestConfig);

    return response.data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    // Check if it's a timeout error
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('TIMEOUT');
    }
    
    if (error.response) {
      throw new Error(`Erro do servidor: ${error.response.status} - ${error.response.data?.message || 'Erro desconhecido'}`);
    } else if (error.request) {
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    } else {
      throw new Error('Erro ao enviar mensagem. Tente novamente.');
    }
  }
};

// Send feedback to webhook
export const sendFeedback = async (feedbackData) => {
  try {
    const userData = await getUserData();
    
    const response = await api.post(FEEDBACK_WEBHOOK_URL, {
      ...feedbackData,
      user: userData,
      timestamp: new Date().toISOString(),
      source: 'maria-feedback-supabase'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': WEBHOOK_API_KEY
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error sending feedback:', error);
    
    if (error.response) {
      throw new Error(`Erro do servidor: ${error.response.status} - ${error.response.data?.message || 'Erro desconhecido'}`);
    } else if (error.request) {
      throw new Error('Erro de conexão. Verifique sua internet e tente novamente.');
    } else {
      throw new Error('Erro ao enviar feedback. Tente novamente.');
    }
  }
};

export default api;
