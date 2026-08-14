# Agenda IPTV — Painel Administrativo (novo)

Este pacote contém:

- **Painel 1 (cliente)** — `index.html`, `app.js`, `styles.css` (o mesmo painel que você já tinha, com alguns ajustes).
- **Painel 2 (admin, novo)** — pasta `admin/` (`admin.html`, `admin.js`, `admin-styles.css`).
- `firestore.rules` — regras de segurança do banco compartilhado.

Os dois painéis usam **o mesmo projeto Firebase** (`agenda-iptv-dcf4e`), então tudo fica no mesmo banco, em tempo real, sem duplicidade — exatamente como pedido.

## O que mudou no Painel 1 (cliente)

1. **Cadastro** agora pede também **Nome** e **WhatsApp**, além de e-mail e senha (clique em "Criar conta" para revelar os campos, preencha e clique em "Confirmar cadastro").
2. Ao concluir o cadastro, o cliente é gravado automaticamente na coleção `clientesAdmin` (visível no painel administrativo), com:
   - status `teste`
   - início e fim do teste (duração padrão: 7 dias, configurável no painel admin)
3. **A cada login**, o sistema verifica o status da conta:
   - Em teste ou assinatura ativa → libera o acesso normalmente e mostra um selo no topo com o tempo restante.
   - Teste ou assinatura vencidos → bloqueia o acesso com uma tela informando o vencimento e mostrando o **link de pagamento** cadastrado por você no painel admin.
4. Contas criadas **antes** desta atualização (que não existem em `clientesAdmin`) são liberadas automaticamente por 30 dias na primeira vez que fizerem login após a atualização, para não travar ninguém — depois disso, gerencie normalmente pelo painel admin.

## Painel Administrativo (novo)

Abra `admin/admin.html` (hospede junto com os demais arquivos, mantendo a pasta `admin/` no mesmo nível de `styles.css`, já que ele reaproveita esse arquivo de estilo).

### 1. Defina o(s) e-mail(s) de administrador

Edite `admin/admin.js` e troque o valor de `ADMIN_EMAILS`:

```js
const ADMIN_EMAILS = ['seuemail@exemplo.com'];
```

### 2. Crie uma conta de login para o administrador

No **Firebase Console → Authentication → Users**, crie (ou use) um usuário com esse e-mail e uma senha seguem — essa será a conta de login do painel admin.

### 3. Autorize esse e-mail nas regras do Firestore

No **Firebase Console → Firestore Database**, crie a coleção `admins` com um documento cujo **ID seja exatamente o e-mail do administrador** (ex.: `admin@exemplo.com`), com qualquer campo, por exemplo `{ allowed: true }`.

> Isso é necessário porque as regras de segurança do Firestore (arquivo `firestore.rules`) usam essa coleção para saber quem pode ler/editar os dados de **todos** os clientes. Sem isso, o painel admin não conseguirá enxergar os cadastros.

### 4. Publique as regras de segurança

No **Firebase Console → Firestore Database → Regras**, cole o conteúdo do arquivo `firestore.rules` e publique.

Essas regras garantem que:
- cada cliente só edita nome/WhatsApp/e-mail do próprio cadastro (nunca datas de vencimento ou status — evitando fraude);
- só o(s) administrador(es) cadastrados em `admins` podem liberar assinaturas, editar ou excluir qualquer cliente, e alterar as configurações globais (link de pagamento, dias de teste).

### 5. Configure o link de pagamento

Faça login no painel admin → aba **Configuração** → informe o link de pagamento e a duração do teste grátis (em dias) → salvar.

## Fluxo completo

1. Cliente se cadastra no Painel 1 → aparece automaticamente no Painel 2 (tempo real).
2. Teste expira → cliente é bloqueado no login e vê o link de pagamento.
3. Você recebe o pagamento → abre o Painel 2 → aba **Clientes** → clica em **"30 dias"** no cadastro do cliente → status vira **Ativa** e o vencimento é atualizado automaticamente.
4. No próximo login, o cliente entra normalmente.

## Limitações importantes (honestidade técnica)

- **Excluir um cliente no painel admin remove o cadastro do Firestore** (ele some da lista e perde acesso aos dados do app), mas **não apaga a conta de login** do Firebase Authentication — isso exige o Firebase Admin SDK (backend) ou exclusão manual pelo Console (`Authentication → Users`). Se quiser esse passo 100% automático, é necessário criar uma Cloud Function; posso te ajudar a montar isso se for do seu interesse.
- Alterar o e-mail de um cliente pela tela de edição atualiza só o cadastro (`clientesAdmin`); o e-mail de login continua o mesmo até o cliente trocá-lo pelo Firebase Authentication.
- O envio de mensagens de WhatsApp (confirmação de pagamento, aviso de renovação) abre o WhatsApp Web/App com o texto pronto para envio manual — não há disparo automático, pois isso exigiria a API oficial do WhatsApp Business (paga, com aprovação da Meta).
