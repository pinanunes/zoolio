import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BotaoSair from '../components/BotaoSair';
import ChatMessage from '../components/ChatMessage';
import FeedbackModal from '../components/FeedbackModal';
import { sendChatMessage, sendFeedback } from '../services/api';

const PaginaChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    messageId: null,
    question: '',
    answer: ''
  });
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll automático para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focar no input quando a página carrega
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // Adicionar mensagem do utilizador
    setMessages(prev => [...prev, userMessage]);
    const currentQuestion = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      // Record start time for response time calculation
      const startTime = Date.now();
      
      // Enviar mensagem para o webhook do chat com dados do utilizador
      const response = await sendChatMessage(currentQuestion, user);
      
      // Calculate response time
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000; // Convert to seconds
      
      // Debug: Log the webhook response to understand its structure
      console.log('Webhook response:', response);
      console.log('Response type:', typeof response);
      console.log('Response structure:', JSON.stringify(response, null, 2));
      console.log('Response time:', responseTime + 's');
      
      // Handle different response formats more robustly
      let botContent;
      if (typeof response === 'string') {
        // Check if it's a JSON string that needs parsing
        try {
          const parsed = JSON.parse(response);
          if (parsed.output) {
            botContent = { answer: parsed.output };
          } else {
            botContent = { answer: response };
          }
        } catch (parseError) {
          // If parsing fails, use the string directly
          botContent = { answer: response };
        }
      } else if (response && typeof response === 'object') {
        // If response is an object, try to extract the message
        if (response.output) {
          botContent = { answer: response.output };
        } else if (response.answer) {
          botContent = { answer: response.answer };
        } else if (response.message) {
          botContent = { answer: response.message };
        } else if (response.text) {
          botContent = { answer: response.text };
        } else if (response.response) {
          botContent = { answer: response.response };
        } else {
          // If none of the expected fields exist, stringify the object
          botContent = { answer: JSON.stringify(response) };
        }
      } else {
        // Fallback for unexpected response types
        botContent = { answer: 'Resposta recebida mas em formato inesperado.' };
      }
      
      // Criar mensagem do bot com a resposta
      const botMessage = {
        id: `bot-${Date.now()}`,
        type: 'bot',
        content: botContent,
        timestamp: new Date().toISOString(),
        originalQuestion: currentQuestion,
        responseTime: responseTime
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Mensagem de erro amigável
      const errorMessage = {
        id: `bot-error-${Date.now()}`,
        type: 'bot',
        content: {
          answer: 'Peço desculpa, mas ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente em alguns instantes.'
        },
        timestamp: new Date().toISOString(),
        originalQuestion: currentQuestion
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Focar novamente no input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleFeedback = async (feedbackData) => {
    if (feedbackData.type === 'negative') {
      // Abrir modal para feedback negativo
      setFeedbackModal({
        isOpen: true,
        messageId: feedbackData.messageId,
        question: feedbackData.question,
        answer: feedbackData.answer
      });
    } else {
      // Enviar feedback positivo diretamente
      try {
        await sendFeedback(feedbackData);
        console.log('Feedback positivo enviado com sucesso');
      } catch (error) {
        console.error('Erro ao enviar feedback positivo:', error);
      }
    }
  };

  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      await sendFeedback(feedbackData);
      console.log('Feedback negativo enviado com sucesso');
    } catch (error) {
      console.error('Erro ao enviar feedback negativo:', error);
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({
      isOpen: false,
      messageId: null,
      question: '',
      answer: ''
    });
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#1e293b' }}>
      {/* Cabeçalho */}
      <header className="border-b px-6 py-4 shadow-lg" style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}>
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>MarIA</h1>
              <p className="text-sm" style={{ color: '#cbd5e1' }}>Assistente Virtual de Saúde</p>
            </div>
          </div>
          <BotaoSair />
        </div>
      </header>

      {/* Área principal */}
      <main className="flex-1 flex flex-col">
        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              /* Estado inicial - sem mensagens */
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl mb-6" style={{ background: 'linear-gradient(135deg, #4ade80, #16a34a)' }}>
                  <span className="font-bold text-3xl" style={{ color: '#ffffff' }}>M</span>
                </div>
                <h2 className="text-2xl font-bold mb-3" style={{ color: '#ffffff' }}>
                  Olá, {user?.name || 'utilizador'}!
                </h2>
                <p className="text-lg mb-8 max-w-md" style={{ color: '#cbd5e1' }}>
                  Sou a MarIA, a sua assistente virtual de saúde. Como posso ajudá-lo hoje?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                  <button
                    onClick={() => setInputMessage('Quais são os sintomas da gripe?')}
                    className="p-4 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#475569'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#334155'}
                  >
                    <div className="font-medium mb-1">Sintomas</div>
                    <div className="text-sm" style={{ color: '#94a3b8' }}>Quais são os sintomas da gripe?</div>
                  </button>
                  <button
                    onClick={() => setInputMessage('Como posso melhorar o meu sono?')}
                    className="p-4 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#475569'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#334155'}
                  >
                    <div className="font-medium mb-1">Bem-estar</div>
                    <div className="text-sm" style={{ color: '#94a3b8' }}>Como posso melhorar o meu sono?</div>
                  </button>
                  <button
                    onClick={() => setInputMessage('Que exercícios são recomendados para dores nas costas?')}
                    className="p-4 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#475569'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#334155'}
                  >
                    <div className="font-medium mb-1">Exercício</div>
                    <div className="text-sm" style={{ color: '#94a3b8' }}>Exercícios para dores nas costas</div>
                  </button>
                  <button
                    onClick={() => setInputMessage('Como manter uma alimentação saudável?')}
                    className="p-4 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: '#334155', border: '1px solid #475569', color: '#e2e8f0' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#475569'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#334155'}
                  >
                    <div className="font-medium mb-1">Nutrição</div>
                    <div className="text-sm" style={{ color: '#94a3b8' }}>Alimentação saudável</div>
                  </button>
                </div>
              </div>
            ) : (
              /* Lista de mensagens */
              <div className="space-y-6">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onFeedback={handleFeedback}
                  />
                ))}
                
                {/* Indicador de carregamento */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-maria-green-400 to-maria-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">M</span>
                      </div>
                      <div className="px-4 py-3 bg-maria-gray-700 rounded-lg shadow-sm">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-maria-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-maria-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-maria-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Formulário de input - estilo Claude.ai */}
        <div className="border-t px-4 py-6" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSendMessage} className="relative">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Escreva a sua pergunta aqui... (Enter para enviar, Shift+Enter para nova linha)"
                  disabled={isLoading}
                  rows={1}
                  className="w-full px-4 py-4 pr-12 rounded-xl focus:outline-none resize-none chat-input"
                  style={{ 
                    minHeight: '56px', 
                    maxHeight: '200px',
                    backgroundColor: '#334155 !important',
                    border: '1px solid #475569',
                    color: '#ffffff !important',
                    fontSize: '16px',
                    fontWeight: '400',
                    lineHeight: '1.5'
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-maria-green-600 text-white rounded-lg hover:bg-maria-green-700 focus:outline-none focus:ring-2 focus:ring-maria-green-500 disabled:bg-maria-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            
            <p className="text-xs mt-3 text-center" style={{ color: '#94a3b8' }}>
              A MarIA é uma assistente virtual. As informações fornecidas não substituem o aconselhamento médico profissional.
            </p>
          </div>
        </div>
      </main>

      {/* Modal de feedback */}
      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={closeFeedbackModal}
        onSubmit={handleFeedbackSubmit}
        question={feedbackModal.question}
        answer={feedbackModal.answer}
      />
    </div>
  );
};

export default PaginaChat;
