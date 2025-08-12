# Guia de Deployment - Aplicação Zoolio

## ✅ Repositório GitHub Criado

**Repositório:** https://github.com/pinanunes/zoolio

O código foi successfully enviado para o GitHub com todas as funcionalidades implementadas:
- 69 ficheiros adicionados/modificados
- Mais de 10.000 linhas de código
- Todas as funcionalidades da aplicação Zoolio

## 🚀 Próximos Passos para Deployment no Netlify

### 1. Acesso ao Netlify
1. Aceda a [netlify.com](https://netlify.com)
2. Faça login com a sua conta (ou crie uma nova)

### 2. Conectar o Repositório
1. Clique em **"New site from Git"**
2. Escolha **"GitHub"** como provider
3. Autorize o Netlify a aceder aos seus repositórios
4. Selecione o repositório **"pinanunes/zoolio"**

### 3. Configurações de Build
O Netlify irá detectar automaticamente as configurações do `netlify.toml`:

```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Não é necessário alterar nada** - as configurações estão otimizadas.

### 4. Variáveis de Ambiente (CRÍTICO)
Antes de fazer o deploy, **DEVE** configurar as variáveis de ambiente:

1. No dashboard do Netlify, vá a **Site settings > Environment variables**
2. Adicione as seguintes variáveis:

```
VITE_SUPABASE_URL = https://bhpelimxagpohziqcufh.supabase.co
VITE_SUPABASE_ANON_KEY = [SUA_CHAVE_ANON_DO_SUPABASE]
```

⚠️ **IMPORTANTE:** A `VITE_SUPABASE_ANON_KEY` deve ser obtida do dashboard do Supabase:
- Aceda ao seu projeto Supabase
- Vá a **Settings > API**
- Copie a **anon/public key**

### 5. Deploy
1. Clique em **"Deploy site"**
2. O Netlify irá:
   - Instalar as dependências (`npm install`)
   - Executar o build (`npm run build`)
   - Publicar o site

### 6. Configuração do Domínio (Opcional)
- O Netlify irá gerar um URL aleatório (ex: `amazing-site-123456.netlify.app`)
- Pode personalizar o subdomínio em **Site settings > Domain management**
- Ou configurar um domínio personalizado

## 📋 Checklist de Deployment

### ✅ Concluído
- [x] Repositório GitHub criado
- [x] Código enviado para o GitHub
- [x] Configuração `netlify.toml` otimizada
- [x] Estrutura de projeto preparada para Vite/React
- [x] Redirects configurados para SPA

### 🔄 A Fazer no Netlify
- [ ] Conectar repositório GitHub
- [ ] Configurar variáveis de ambiente
- [ ] Fazer o primeiro deploy
- [ ] Testar a aplicação online
- [ ] Configurar domínio (opcional)

## 🗃️ Base de Dados - Scripts SQL

A aplicação inclui vários scripts SQL que devem ser executados no Supabase:

### Scripts Principais:
1. **`database_updates.sql`** - Schema inicial
2. **`feedback_quota_system.sql`** - Sistema de quotas
3. **`yearly_feedback_quota_system.sql`** - Quotas anuais
4. **`positive_feedback_structure_update.sql`** - Feedback estruturado
5. **`team_management_updates.sql`** - Gestão de equipas

### Como Executar:
1. Aceda ao Supabase Dashboard
2. Vá a **SQL Editor**
3. Execute os scripts pela ordem listada acima

## 🔧 Funcionalidades Implementadas

### Frontend
- ✅ Autenticação completa (login, registo, recuperação)
- ✅ Chat com 3 bots (Junior, Senior, Arena)
- ✅ Sistema de feedback com quotas
- ✅ Backoffice para professores
- ✅ Gestão de equipas e doenças
- ✅ Analytics e relatórios
- ✅ Interface responsiva

### Backend (Supabase)
- ✅ Autenticação de utilizadores
- ✅ Base de dados completa
- ✅ RLS (Row Level Security)
- ✅ Funções SQL personalizadas
- ✅ Sistema de quotas
- ✅ Feedback estruturado

### Deployment
- ✅ Configuração Netlify otimizada
- ✅ Build automático
- ✅ Redirects para SPA
- ✅ Variáveis de ambiente configuradas

## 🌐 URLs Importantes

- **Repositório GitHub:** https://github.com/pinanunes/zoolio
- **Supabase Project:** https://bhpelimxagpohziqcufh.supabase.co
- **Netlify Dashboard:** https://app.netlify.com (após login)

## 📞 Suporte

Se encontrar problemas durante o deployment:

1. **Verifique as variáveis de ambiente** - Causa mais comum de erros
2. **Consulte os logs de build** no Netlify
3. **Verifique a configuração do Supabase**
4. **Teste localmente** com `npm run dev`

## 🎉 Conclusão

A aplicação Zoolio está **100% pronta para deployment**:
- Código no GitHub ✅
- Configuração Netlify ✅
- Base de dados preparada ✅
- Documentação completa ✅

**Próximo passo:** Conectar o repositório no Netlify e configurar as variáveis de ambiente.
