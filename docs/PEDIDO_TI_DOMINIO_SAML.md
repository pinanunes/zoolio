# Pedido à Equipa de TI — Zoolio: Domínio/Proxy e SSO SAML

## Contexto

O Zoolio (aplicação de ensino da FMV) está a ser migrado do Netlify + Supabase Cloud para
infraestrutura local, a correr no servidor IAAPPS. A aplicação já está instalada e testada
nesse servidor. Para avançar, ficam dois pedidos separados à equipa de TI.

## Pedido 1 — Domínio público + proxy (nginx)

- **Domínio**: um nome de domínio ou subdomínio para a aplicação (ex.: `zoolio.fmv.ulisboa.pt`
  — a confirmar convosco).
- **DNS**: um registo que aponte esse domínio para o IP público do servidor IAAPPS:
  `193.136.99.10`.
- **Certificado**: um certificado TLS/SSL para esse domínio (Let's Encrypt ou certificado
  institucional).
- **Rede/firewall**: confirmação de que o tráfego HTTPS para esse domínio consegue chegar ao
  servidor (o servidor está atrás de uma firewall institucional).

A aplicação corre localmente na porta `8000` do servidor (gateway interno). O proxy reverso
(nginx) pode ser configurado por nós no próprio servidor assim que o domínio, o certificado e o
acesso de rede estiverem disponíveis — ou pela vossa equipa, consoante o processo habitual. É
necessário suporte para WebSockets no proxy, porque a aplicação usa funcionalidades em tempo
real.

## Pedido 2 — SSO SAML (login institucional)

- Os **metadados SAML do IdP** da faculdade/universidade (ficheiro XML ou URL de metadados).
- **Registo do Zoolio como novo Service Provider (SP)** no IdP, com:
  - Entity ID do SP
  - URL do ACS (Assertion Consumer Service) — para onde o IdP envia a resposta após o login

  (estes dois valores só ficam definitivos depois de sabermos o domínio final do Pedido 1)
- Confirmação de **que atributos o IdP envia no login** — precisamos, no mínimo, de email e
  nome, e idealmente algo que distinga aluno de docente.

## Prazo

Sem urgência imediata, mas idealmente resolvido antes de meados de setembro de 2026, quando
arranca o novo ano letivo.
