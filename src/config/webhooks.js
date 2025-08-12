// Webhook configuration for Zoolio
export const WEBHOOKS = {
  // Main chat webhook (also used as Bot 1 in arena)
  MAIN_CHAT: 'https://manuelnunes.duckdns.org/webhook/b02fc3cb-3e32-45a5-9cfe-fc5ac994a587',
  
  // Arena bots
  ARENA_BOTS: {
    BOT_1: {
      name: 'Baseado na ficha de doença',
      url: 'https://manuelnunes.duckdns.org/webhook/b02fc3cb-3e32-45a5-9cfe-fc5ac994a587',
      color: '#FFC107' // Yellow
    },
    BOT_2: {
      name: 'LLM',
      url: 'https://manuelnunes.duckdns.org/webhook/0617abad-ef75-4320-8231-1e4468ce6a84',
      color: '#2196F3' // Blue
    },
    BOT_3: {
      name: 'LLM+Pubmed',
      url: 'https://manuelnunes.duckdns.org/webhook-test/0617abad-ef75-4320-8231-1e4468ce6a85',
      color: '#4CAF50' // Green
    }
  }
};
