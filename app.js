    /* =========================================================
       PARTE 1 — GESTÃO DE CLIENTES
       ========================================================= */
    const STORAGE_KEY = 'iptv_clientes_v1';
    const STORAGE_KEY_TESTES = 'iptv_testes_v1';
    const STORAGE_KEY_INDICACOES = 'iptv_indicacoes_v1';
    const STORAGE_KEY_MESSAGE_TEMPLATES = 'iptv_message_templates_v1';
    const INIT_FLAG_KEY = 'iptv_clientes_v1_initialized';
    let clients = [];
    let testes = [];
    let indicacoes = [];
    let messageTemplates = {};
    const ITEMS_PER_PAGE = 10;
    const state = {
      todayPage: 1, tomorrowPage: 1, weekPage: 1, expiredPage: 1, pendingPaymentsPage: 1,
      clientesPage: 1, testesPage: 1, historicoPage: 1,
      indAtivasPage: 1, indAssinouPage: 1, indGanhouPage: 1, roletaPage: 1,
      filtroMes: 'all',
      dashChartYear: new Date().getFullYear(),
      dashChartMonth: String(new Date().getMonth() + 1).padStart(2, '0')
    };

    const FIREBASE_CONFIG = {
      apiKey: "AIzaSyBBkv5fxVQp9q1i9JqMB57T-AlULUUaCDs",
      authDomain: "agenda-iptv-dcf4e.firebaseapp.com",
      projectId: "agenda-iptv-dcf4e",
      storageBucket: "agenda-iptv-dcf4e.firebasestorage.app",
      messagingSenderId: "497773832104",
      appId: "1:497773832104:web:8b4bcc1934b4efb5b55f9d"
    };

    let firebaseAppInstance = null;
    let firebaseAuthInstance = null;
    let firebaseDbInstance = null;
    let currentFirebaseUser = null;
    let cloudSaveTimer = null;
    let lastCloudPayloadSerialized = '';
    let firebaseWired = false;
    const APP_TIMEZONE = 'America/Sao_Paulo';
    const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const MONTH_NAMES_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const zonedDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const zonedDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: APP_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const zonedClockFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: APP_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    function getZonedDateParts(dateLike = new Date()) {
      const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
      if (isNaN(d.getTime())) return null;
      const parts = zonedDateFormatter.formatToParts(d);
      const year = Number(parts.find(p => p.type === 'year')?.value);
      const month = Number(parts.find(p => p.type === 'month')?.value);
      const day = Number(parts.find(p => p.type === 'day')?.value);
      if (!year || !month || !day) return null;
      return { year, month, day };
    }

    function getCurrentZonedYear() {
      return getZonedDateParts(new Date())?.year || new Date().getFullYear();
    }


const DEFAULT_MESSAGE_TEMPLATES = Object.freeze({
  cobranca: [
    '👋 Olá *{{nome}}* Seu plano *{{status_vencimento}}*',
    '',
    'Para evitar cortes, acesse o link abaixo e realize o pagamento e fique sem preocupações!',
    '',
    '👤 *Usuário*: {{usuario}}',
    '🔑 *Senha*: {{senha}}',
    '📦 *Plano*: {{plano}}',
    '💰 *Valor*: {{valor}}',
    '',
    '🔗 *Link de renovação*: {{link_renovacao}}',
    '',
    '🙏 Obrigado pela preferência!'
  ].join('\n'),
  renovacao_confirmada: [
    '🎉 *Renovação confirmada!*',
    '',
    '✅ *Status*: {{status_pagamento}}',
    '',
    '👤 *Usuário*: {{usuario}}',
    '🔑 *Senha*: {{senha}}',
    '🗓️ *Nova data de vencimento*: {{data_renovacao}}',
    '',
    '🙏🏻 *Obrigado pela preferência!*'
  ].join('\n'),
  teste_criado: [
    '🎉 Olá *{{nome}}*, *Teste Gerado com Sucesso!*',
    '',
    '👤 *Usuário*: {{usuario}}',
    '🔑 *Senha*: {{senha}}',
    '',
    '🔗 *Link de renovação*: {{link_renovacao}}',
    '',
    '⏰ *{{duracao_teste}}*'
  ].join('\n'),
  ativacao: [
    '🎉 Olá *{{nome}}*, *Usuário Ativado com sucesso!*',
    '',
    '👤 *Usuário*: {{usuario}}',
    '🔑 *Senha*: {{senha}}',
    '🗓️ *Nova data de vencimento*: {{data_renovacao}}',
    '',
    '🙏 Obrigado pela preferência!'
  ].join('\n'),
  dias_extras: [
    '📅 *Ajuste no seu vencimento*',
    '',
    'Olá! Adicionamos *{{dias}}* ao seu plano.',
    '',
    '👤 *Usuário*: {{usuario}}',
    '🔑 *Senha*: {{senha}}',
    '💰 *Valor adicional a pagar*: {{valor_adicional}}',
    '🗓️ *Nova data de vencimento*: {{data_renovacao}}',
    '',
    '🙏🏻 *Obrigado pela preferência!*'
  ].join('\n'),
  pagamento_pendente: [
    '⏳ Olá *{{nome}}*, tudo bem?',
    '',
    'Passando para lembrar que o pagamento da sua renovação ainda está *pendente*.',
    '',
    '👤 *Usuário*: {{usuario}}',
    '🔑 *Senha*: {{senha}}',
    '📦 *Plano*: {{plano}}',
    '💰 *Valor*: {{valor}}',
    '🗓️ *Vencimento*: {{data_renovacao}}',
    '',
    '🔗 *Link de pagamento*: {{link_renovacao}}',
    '',
    '🙏 Assim que confirmar o pagamento, me avise por aqui. Obrigado pela preferência!'
  ].join('\n'),
  indicacao_teste: [
    '🎰 *Olá {{indicador_nome}}!*',
    '',
    'Sua indicação de *{{amigo_nome}}* foi registrada com sucesso! 🎉',
    '',
    '🎟️ Você ganhou *+1 número da sorte* para o sorteio mensal:',
    '',
    '🔢 *Número: {{numero}}*',
    '',
    '💡 Lembre-se: se o seu amigo fechar a assinatura, esse número se transforma em *1 mês grátis* para você automaticamente!',
    '',
    'Boa sorte! 🍀'
  ].join('\n'),
  indicacao_mes_gratis: [
    '🎉 *Parabéns {{indicador_nome}}!*',
    '',
    'Seu amigo *{{amigo_nome}}* fechou a assinatura!',
    '',
    '✅ O número *{{numero}}* gerado pela indicação foi convertido em *1 MÊS GRÁTIS* para você. 🥳',
    '',
    'Obrigado por indicar nossos serviços! Continue indicando para concorrer ao sorteio mensal. 🎰'
  ].join('\n'),
  indicacao_ganhador: [
    '🏆 *PARABÉNS {{indicador_nome}}!* 🎉',
    '',
    'Você foi o(a) *GANHADOR(A)* do sorteio mensal! 🎰',
    '',
    '🔢 Número sorteado: *{{numero}}*',
    '👤 Indicação de: *{{amigo_nome}}*',
    '',
    '🎁 Em breve entraremos em contato para entregar o seu prêmio!',
    '',
    'Obrigado por participar e por indicar nossos serviços. 🙏'
  ].join('\n')
});

const MESSAGE_TEMPLATE_META = Object.freeze({
  cobranca: { label: 'Cobrança / vencimento', variables: ['nome', 'status_vencimento', 'usuario', 'senha', 'plano', 'valor', 'link_renovacao'] },
  renovacao_confirmada: { label: 'Renovação confirmada', variables: ['status_pagamento', 'usuario', 'senha', 'data_renovacao'] },
  teste_criado: { label: 'Teste criado', variables: ['nome', 'usuario', 'senha', 'link_renovacao', 'duracao_teste'] },
  ativacao: { label: 'Ativação de usuário', variables: ['nome', 'usuario', 'senha', 'data_renovacao'] },
  dias_extras: { label: 'Dias extras', variables: ['dias', 'usuario', 'senha', 'valor_adicional', 'data_renovacao'] },
  pagamento_pendente: { label: 'Pagamento pendente', variables: ['nome', 'usuario', 'senha', 'plano', 'valor', 'data_renovacao', 'link_renovacao'] },
  indicacao_teste: { label: 'Indicação registrada', variables: ['indicador_nome', 'amigo_nome', 'numero'] },
  indicacao_mes_gratis: { label: 'Indicação convertida', variables: ['indicador_nome', 'amigo_nome', 'numero'] },
  indicacao_ganhador: { label: 'Ganhador do sorteio', variables: ['indicador_nome', 'amigo_nome', 'numero'] }
});

function mergeMessageTemplates(raw) {
  const merged = { ...DEFAULT_MESSAGE_TEMPLATES };
  if (raw && typeof raw === 'object') {
    Object.keys(DEFAULT_MESSAGE_TEMPLATES).forEach(key => {
      if (typeof raw[key] === 'string' && raw[key].trim()) merged[key] = raw[key];
    });
  }
  return merged;
}

function loadMessageTemplates() {
  try {
    const raw = readJsonCache(STORAGE_KEY_MESSAGE_TEMPLATES, null);
    if (!raw) { messageTemplates = { ...DEFAULT_MESSAGE_TEMPLATES }; return; }
    messageTemplates = mergeMessageTemplates(raw);
  } catch (e) {
    messageTemplates = { ...DEFAULT_MESSAGE_TEMPLATES };
  }
}

function saveMessageTemplates() {
  try {
    writeJsonCache(STORAGE_KEY_MESSAGE_TEMPLATES, messageTemplates);
    queueCloudSave('messageTemplates');
  } catch (e) { showToast('Falha ao salvar modelos de mensagem.', true); }
}

function getMessageTemplate(key) {
  return messageTemplates[key] || DEFAULT_MESSAGE_TEMPLATES[key] || '';
}

function renderMessageTemplate(key, data) {
  const template = getMessageTemplate(key);
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token) => {
    const value = data && Object.prototype.hasOwnProperty.call(data, token) ? data[token] : '';
    return value == null ? '' : String(value);
  });
}

function getMessageTemplateSamples() {
  const cli = clients[0] || {
    nome: 'Cliente Exemplo',
    usuario: 'usuario_teste',
    senha: '123456',
    plano: 'Plano Premium',
    valor: '30,00',
    linkRenovacao: 'https://pagamento.exemplo/renovar',
    dataRenovacao: toInputDate(addDays(todayLocalDate(), 30))
  };
  const teste = testes[0] || {
    nome: 'Teste Exemplo',
    usuario: 'teste_demo',
    senha: '654321',
    linkRenovacao: 'https://pagamento.exemplo/teste'
  };
  const ind = indicacoes[0] || {
    indicadorNome: 'Cliente Indicador',
    amigoNome: 'Amigo Indicado',
    numero: '074'
  };
  return {
    cobranca: {
      nome: cli.nome || 'Cliente Exemplo',
      status_vencimento: 'Vence hoje',
      usuario: cli.usuario || 'usuario_teste',
      senha: cli.senha || '123456',
      plano: cli.plano || 'Plano Premium',
      valor: cli.valor ? `R$ ${cli.valor}` : 'R$ 30,00',
      link_renovacao: cli.linkRenovacao || 'https://pagamento.exemplo/renovar'
    },
    renovacao_confirmada: {
      status_pagamento: 'Pago',
      usuario: cli.usuario || 'usuario_teste',
      senha: cli.senha || '123456',
      data_renovacao: formatDate(cli.dataRenovacao || toInputDate(addDays(todayLocalDate(), 30)))
    },
    teste_criado: {
      nome: teste.nome || 'Teste Exemplo',
      usuario: teste.usuario || 'teste_demo',
      senha: teste.senha || '654321',
      link_renovacao: teste.linkRenovacao || 'https://pagamento.exemplo/teste',
      duracao_teste: (teste.duracaoTeste && teste.duracaoTeste.trim()) || '3 Horas de Teste Grátis!'
    },
    ativacao: {
      nome: cli.nome || 'Cliente Exemplo',
      usuario: cli.usuario || 'usuario_teste',
      senha: cli.senha || '123456',
      data_renovacao: formatDate(cli.dataRenovacao || toInputDate(addDays(todayLocalDate(), 30)))
    },
    dias_extras: {
      dias: '5 dias',
      usuario: cli.usuario || 'usuario_teste',
      senha: cli.senha || '123456',
      valor_adicional: 'R$ 5,00',
      data_renovacao: formatDate(cli.dataRenovacao || toInputDate(addDays(todayLocalDate(), 35)))
    },
    pagamento_pendente: {
      nome: cli.nome || 'Cliente Exemplo',
      usuario: cli.usuario || 'usuario_teste',
      senha: cli.senha || '123456',
      plano: cli.plano || 'Plano Premium',
      valor: cli.valor ? `R$ ${cli.valor}` : 'R$ 30,00',
      data_renovacao: formatDate(cli.dataRenovacao || toInputDate(addDays(todayLocalDate(), 30))),
      link_renovacao: cli.linkRenovacao || 'https://pagamento.exemplo/renovar'
    },
    indicacao_teste: {
      indicador_nome: ind.indicadorNome || 'Cliente Indicador',
      amigo_nome: ind.amigoNome || 'Amigo Indicado',
      numero: ind.numero || '074'
    },
    indicacao_mes_gratis: {
      indicador_nome: ind.indicadorNome || 'Cliente Indicador',
      amigo_nome: ind.amigoNome || 'Amigo Indicado',
      numero: ind.numero || '074'
    },
    indicacao_ganhador: {
      indicador_nome: ind.indicadorNome || 'Cliente Indicador',
      amigo_nome: ind.amigoNome || 'Amigo Indicado',
      numero: ind.numero || '074'
    }
  };
}

const ALL_MESSAGE_VARIABLES = Array.from(new Set(
  Object.values(MESSAGE_TEMPLATE_META).flatMap(meta => meta.variables)
)).sort();

function getCurrentMessageTemplateKey() {
  const select = document.getElementById('messageTemplateSelect');
  return (select && select.value) || 'cobranca';
}

function insertVariableAtCursor(varName) {
  const editor = document.getElementById('messageTemplateEditor');
  if (!editor) return;
  const token = `{{${varName}}}`;
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? editor.value.length;
  editor.value = editor.value.slice(0, start) + token + editor.value.slice(end);
  const newPos = start + token.length;
  editor.focus();
  editor.setSelectionRange(newPos, newPos);
  updateMessageTemplatePreview();
}
window.insertVariableAtCursor = insertVariableAtCursor;

function updateMessageEditorInfo() {
  const key = getCurrentMessageTemplateKey();
  const meta = MESSAGE_TEMPLATE_META[key];
  const varsEl = document.getElementById('messageTemplateVariables');
  const helpEl = document.getElementById('messageTemplateHelp');
  if (varsEl && meta) {
    const relevantes = new Set(meta.variables);
    varsEl.innerHTML = ALL_MESSAGE_VARIABLES.map(v => {
      const ativa = relevantes.has(v);
      return `<button type="button" class="var-chip${ativa ? ' active' : ''}" onclick="insertVariableAtCursor('${v}')" title="${ativa ? 'Usada neste modelo' : 'Disponível em todos os modelos'} • clique para inserir">{{${escapeHtml(v)}}}</button>`;
    }).join('');
  }
  if (helpEl && meta) {
    helpEl.textContent = `Prévia com dados de exemplo para "${meta.label}". Clique em qualquer variável para inserir no texto — as destacadas são as mais usadas neste modelo, mas todas funcionam em qualquer mensagem.`;
  }
}

function getMergedMessageVariableSamples() {
  return Object.assign({}, ...Object.values(getMessageTemplateSamples()));
}

function updateMessageTemplatePreview() {
  const key = getCurrentMessageTemplateKey();
  const editor = document.getElementById('messageTemplateEditor');
  const preview = document.getElementById('messageTemplatePreview');
  if (!editor || !preview) return;
  const tempTemplates = { ...messageTemplates, [key]: editor.value };
  const current = messageTemplates;
  messageTemplates = tempTemplates;
  preview.textContent = renderMessageTemplate(key, getMergedMessageVariableSamples());
  messageTemplates = current;
}

function loadSelectedMessageTemplate() {
  const key = getCurrentMessageTemplateKey();
  const editor = document.getElementById('messageTemplateEditor');
  if (!editor) return;
  editor.value = getMessageTemplate(key);
  updateMessageEditorInfo();
  updateMessageTemplatePreview();
}

function renderMessageEditor() {
  const select = document.getElementById('messageTemplateSelect');
  if (!select) return;
  if (!select.dataset.loaded) {
    select.innerHTML = Object.entries(MESSAGE_TEMPLATE_META)
      .map(([key, meta]) => `<option value="${key}">${meta.label}</option>`)
      .join('');
    select.dataset.loaded = '1';
  }
  if (!select.value) select.value = 'cobranca';
  loadSelectedMessageTemplate();
}

function saveCurrentMessageTemplate() {
  const key = getCurrentMessageTemplateKey();
  const editor = document.getElementById('messageTemplateEditor');
  if (!editor) return;
  messageTemplates[key] = editor.value;
  saveMessageTemplates();
  updateMessageTemplatePreview();
  showToast('Modelo de mensagem salvo.');
}

function resetCurrentMessageTemplate() {
  const key = getCurrentMessageTemplateKey();
  const editor = document.getElementById('messageTemplateEditor');
  if (!editor) return;
  editor.value = DEFAULT_MESSAGE_TEMPLATES[key] || '';
  updateMessageTemplatePreview();
  updateMessageEditorInfo();
  showToast('Modelo restaurado para o padrão.');
}

function resetAllMessageTemplates() {
  if (!confirmar('Restaurar todos os modelos de mensagem?')) return;
  messageTemplates = { ...DEFAULT_MESSAGE_TEMPLATES };
  saveMessageTemplates();
  renderMessageEditor();
  showToast('Todos os modelos foram restaurados.');
}

function setupMessageEditor() {
  const select = document.getElementById('messageTemplateSelect');
  const editor = document.getElementById('messageTemplateEditor');
  const saveBtn = document.getElementById('saveMessageTemplateBtn');
  const resetBtn = document.getElementById('resetMessageTemplateBtn');
  const resetAllBtn = document.getElementById('resetAllMessageTemplatesBtn');
  if (!select || !editor || !saveBtn || !resetBtn || !resetAllBtn) return;
  if (select.dataset.bound === '1') return;
  select.dataset.bound = '1';
  select.addEventListener('change', loadSelectedMessageTemplate);
  editor.addEventListener('input', updateMessageTemplatePreview);
  saveBtn.addEventListener('click', saveCurrentMessageTemplate);
  resetBtn.addEventListener('click', resetCurrentMessageTemplate);
  resetAllBtn.addEventListener('click', resetAllMessageTemplates);
}


    const els = {
      tabs: document.querySelectorAll('.tab'),
      panels: document.querySelectorAll('.panel'),
      countToday: document.getElementById('countToday'),
      countTomorrow: document.getElementById('countTomorrow'),
      countWeek: document.getElementById('countWeek'),
      countExpired: document.getElementById('countExpired'),
      countPendingPayments: document.getElementById('countPendingPayments'),
      countClientes: document.getElementById('countClientes'),
      listToday: document.getElementById('listToday'),
      listTomorrow: document.getElementById('listTomorrow'),
      listWeek: document.getElementById('listWeek'),
      listExpired: document.getElementById('listExpired'),
      listPendingPayments: document.getElementById('listPendingPayments'),
      paginationToday: document.getElementById('paginationToday'),
      paginationTomorrow: document.getElementById('paginationTomorrow'),
      paginationWeek: document.getElementById('paginationWeek'),
      paginationExpired: document.getElementById('paginationExpired'),
      paginationPendingPayments: document.getElementById('paginationPendingPayments'),
      clientForm: document.getElementById('clientForm'),
      clientId: document.getElementById('clientId'),
      nome: document.getElementById('nome'),
      telefone: document.getElementById('telefone'),
      aplicativo: document.getElementById('aplicativo'),
      usuario: document.getElementById('usuario'),
      senha: document.getElementById('senha'),
      duracaoTeste: document.getElementById('duracaoTeste'),
      plano: document.getElementById('plano'),
      valor: document.getElementById('valor'),
      creditos: document.getElementById('creditos'),
      linkRenovacao: document.getElementById('linkRenovacao'),
      observacoes: document.getElementById('observacoes'),
      clientesList: document.getElementById('clientesList'),
      searchClientesInput: document.getElementById('searchClientesInput'),
      paginationClientes: document.getElementById('paginationClientes'),
      clearFormBtn: document.getElementById('clearFormBtn'),
      criarTesteBtn: document.getElementById('criarTesteBtn'),
      criarTesteBtnWrap: document.getElementById('criarTesteBtnWrap'),
      exportBtn: document.getElementById('exportBtn'),
      importFile: document.getElementById('importFile'),
      formTitle: document.getElementById('formTitle'),
      toast: document.getElementById('toast')
    };

    let toastTimer = null;
    function showToast(message, isError = false) {
      if (!els.toast) return;
      els.toast.textContent = message;
      els.toast.classList.toggle('error', !!isError);
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400);
    }

    function writeJsonCache(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
    function readJsonCache(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    }
    function persistLocalSnapshot() {
      try {
        writeJsonCache(STORAGE_KEY, clients);
        writeJsonCache(STORAGE_KEY_TESTES, testes);
        writeJsonCache(STORAGE_KEY_INDICACOES, indicacoes);
        writeJsonCache(STORAGE_KEY_MESSAGE_TEMPLATES, messageTemplates);
        writeJsonCache('iptv_paineis', paineis);
        writeJsonCache('iptv_pacotes', pacotes);
        writeJsonCache('iptv_planos', planos);
        writeJsonCache('iptv_aplicativos', aplicativos);
        writeJsonCache('iptv_movimentacoes', movimentacoes);
        writeJsonCache('iptv_lucros_custos', lucrosCustos);
      } catch (e) {}
    }
    function buildCloudPayload() {
      return {
        clients,
        testes,
        indicacoes,
        messageTemplates,
        paineis,
        pacotes,
        planos,
        aplicativos,
        movimentacoes,
        lucrosCustos
      };
    }
    function serializeCloudPayload() {
      try { return JSON.stringify(buildCloudPayload()); }
      catch (e) { return ''; }
    }
    function getCloudDocRef() {
      if (!firebaseDbInstance || !currentFirebaseUser) return null;
      return firebaseDbInstance.collection('users').doc(currentFirebaseUser.uid).collection('app').doc('painel_iptv');
    }
    function setCloudStatus(label, tone = 'warn', helperText = '') {
      const statusEl = document.getElementById('authStatusBadge');
      const syncEl = document.getElementById('cloudSyncTag');
      const helperEl = document.getElementById('authHelperText');
      const classes = ['status-ok', 'status-warn', 'status-error'];
      [statusEl, syncEl].forEach(el => {
        if (!el) return;
        el.textContent = label;
        el.classList.remove(...classes);
        if (tone === 'ok') el.classList.add('status-ok');
        else if (tone === 'error') el.classList.add('status-error');
        else el.classList.add('status-warn');
      });
      if (helperEl && helperText) helperEl.textContent = helperText;
    }
    function getDefaultPaineis() {
      return [
        { id: 'p1', nome: 'Painel 1', cor: '#39ff14', logo: '' },
        { id: 'p2', nome: 'Painel 2', cor: '#5cf0ff', logo: '' }
      ];
    }
    function normalizePaineis(list) {
      if (!Array.isArray(list) || !list.length) return getDefaultPaineis();
      return list.map((x, i) => ({
        id: x && x.id ? x.id : ('p' + (i + 1)),
        nome: x && x.nome ? String(x.nome).trim() : ('Painel ' + (i + 1)),
        cor: x && x.cor && /^#[0-9a-fA-F]{6}$/.test(String(x.cor)) ? String(x.cor) : getDefaultPaineis()[Math.min(i, 1)].cor,
        logo: x && typeof x.logo === 'string' ? x.logo : ''
      }));
    }
    function hasMeaningfulData(payload) {
      if (!payload || typeof payload !== 'object') return false;
      return [payload.clients, payload.testes, payload.indicacoes, payload.pacotes, payload.planos, payload.aplicativos, payload.movimentacoes, payload.lucrosCustos]
        .some(arr => Array.isArray(arr) && arr.length > 0);
    }
    function refreshUiAfterCloudLoad() {
      try { atualizarSelectsPaineis(); } catch (e) {}
      try { garantirReservasPagamentosPendentes(); } catch (e) {}
      try { renderAll(); renderTestes(); } catch (e) {}
      try { atualizarListaPacotes(); atualizarSelectPacotes(); atualizarSelectPacotesAddCredito(); } catch (e) {}
      try { atualizarListaPlanos(); atualizarSelectPlanos(); } catch (e) {}
      try { atualizarListaAplicativos(); atualizarSelectAplicativos(); } catch (e) {}
      try { atualizarCreditos(); atualizarHistorico(); atualizarListaLucrosCustos(); } catch (e) {}
      try { atualizarListaAssinaturas(); atualizarListaCustos(); } catch (e) {}
      try { atualizarSelectMesGestao(); atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao(); } catch (e) {}
      try { atualizarSelectDxPaineis(); popularSelectClientesDiasExtras(); } catch (e) {}
      try { popularSelectIndicadores(); popularSelectTestes(); renderIndicacoes(); } catch (e) {}
      try { renderMessageEditor(); } catch (e) {}
      try { renderRoleta(); } catch (e) {}
    }
    function applyCloudPayload(payload) {
      const data = payload && typeof payload === 'object' ? payload : {};
      clients = Array.isArray(data.clients) ? data.clients : [];
      testes = Array.isArray(data.testes) ? data.testes : [];
      indicacoes = Array.isArray(data.indicacoes) ? data.indicacoes : [];
      messageTemplates = mergeMessageTemplates(data.messageTemplates || {});
      paineis = normalizePaineis(data.paineis);
      pacotes = Array.isArray(data.pacotes) ? data.pacotes.map(p => ({ ...p, painelId: p.painelId || paineis[0].id })) : [];
      planos = Array.isArray(data.planos) ? data.planos.map(p => ({ ...p, painelId: p.painelId || paineis[0].id, creditos: Number.isFinite(parseInt(p.creditos)) ? p.creditos : 1, taxaTipo: p.taxaTipo || 'none', taxaValor: p.taxaValor ?? 0 })) : [];
      aplicativos = Array.isArray(data.aplicativos) ? data.aplicativos.map(normalizeAplicativo) : [];
      movimentacoes = Array.isArray(data.movimentacoes) ? data.movimentacoes.map(m => ({ ...m, painelId: m.painelId || paineis[0].id })) : [];
      lucrosCustos = Array.isArray(data.lucrosCustos) ? data.lucrosCustos : [];
      persistLocalSnapshot();
      lastCloudPayloadSerialized = serializeCloudPayload();
      refreshUiAfterCloudLoad();
    }
    async function syncCloudDataNow(reason = 'manual') {
      if (!currentFirebaseUser || !firebaseDbInstance) return;
      const ref = getCloudDocRef();
      if (!ref) return;
      const serialized = serializeCloudPayload();
      if (!serialized) return;
      if (serialized === lastCloudPayloadSerialized && reason !== 'force') {
        setCloudStatus('Sincronizado', 'ok', 'Seus dados já estão atualizados no Firestore.');
        return;
      }
      try {
        setCloudStatus('Salvando...', 'warn', 'Sincronizando alterações com o Firestore.');
        await ref.set({
          version: 1,
          email: currentFirebaseUser.email || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          payload: JSON.parse(serialized)
        }, { merge: true });
        lastCloudPayloadSerialized = serialized;
        setCloudStatus('Sincronizado', 'ok', 'Os dados do painel estão salvos no Firestore.');
      } catch (error) {
        console.error(error);
        setCloudStatus('Falha ao salvar', 'error', 'Não foi possível gravar no Firestore. Confira as regras e a autenticação.');
        showToast('Falha ao sincronizar com o Firebase.', true);
      }
    }
    function queueCloudSave(reason = 'update') {
      if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
      if (!currentFirebaseUser || !firebaseDbInstance) return;
      setCloudStatus('Alterações pendentes', 'warn', 'Existe uma atualização aguardando envio ao Firestore.');
      cloudSaveTimer = setTimeout(() => { syncCloudDataNow(reason); }, 900);
    }
    function applyAuthScreenState() {
      const authenticated = !!currentFirebaseUser;
      document.body.classList.toggle('auth-screen', !authenticated);
      document.body.classList.toggle('is-authenticated', authenticated);
      els.tabs.forEach(tab => {
        const isLoginTab = tab.dataset.tab === 'login';
        tab.classList.toggle('hidden', authenticated ? isLoginTab : !isLoginTab);
      });
      if (!authenticated) closeSidebar();
    }
    function updateAuthUi() {
      const emailEl = document.getElementById('authUserEmail');
      const headerLogoutBtn = document.getElementById('headerLogoutBtn');
      const registerBtn = document.getElementById('firebaseRegisterBtn');
      applyAuthScreenState();
      if (emailEl) emailEl.textContent = currentFirebaseUser && currentFirebaseUser.email ? currentFirebaseUser.email : 'Nenhuma';
      if (headerLogoutBtn) headerLogoutBtn.classList.toggle('hidden', !currentFirebaseUser);
      if (registerBtn) registerBtn.classList.toggle('hidden', !!currentFirebaseUser);
      els.tabs.forEach(tab => {
        const isFree = tab.dataset.authExempt === 'true';
        tab.classList.toggle('tab-locked', !currentFirebaseUser && !isFree);
      });
      if (currentFirebaseUser) {
        setCloudStatus('Conta conectada', 'ok', 'Login realizado. Carregando os dados da sua conta.');
        switchTab('dashboard');
      } else {
        setCloudStatus('Aguardando login', 'warn', 'Entre com email e senha para carregar e salvar seus dados no Firebase.');
        switchTab('login');
      }
    }
    function getFirebaseErrorMessage(error, fallback) {
      const code = error && error.code ? error.code : '';
      const map = {
        'auth/invalid-email': 'Email inválido.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-login-credentials': 'Email ou senha inválidos.',
        'auth/email-already-in-use': 'Este email já está em uso.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/operation-not-allowed': 'Ative o método Email/Senha no Firebase Authentication.',
        'auth/missing-password': 'Informe a senha.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
        'auth/network-request-failed': 'Falha de rede ao conectar no Firebase.',
        'auth/unauthorized-domain': 'Este domínio precisa ser autorizado no Firebase Authentication.'
      };
      return map[code] || fallback;
    }
    async function handleFirebaseLogin(event) {
      event.preventDefault();
      if (!firebaseAuthInstance) { showToast('Firebase Authentication não foi inicializado.', true); return; }
      const email = String(document.getElementById('firebaseEmail')?.value || '').trim();
      const password = String(document.getElementById('firebasePassword')?.value || '').trim();
      if (!email || !password) { showToast('Informe email e senha.', true); return; }
      try {
        setCloudStatus('Entrando...', 'warn', 'Validando suas credenciais no Firebase Authentication.');
        await firebaseAuthInstance.signInWithEmailAndPassword(email, password);
        document.getElementById('firebasePassword').value = '';
        showToast('Login realizado com sucesso.');
      } catch (error) {
        console.error(error);
        setCloudStatus('Falha no login', 'error', 'Não foi possível autenticar com o Firebase Authentication.');
        showToast(getFirebaseErrorMessage(error, 'Não foi possível entrar.'), true);
      }
    }
    const TRIAL_DIAS_PADRAO = 7;
    let registerStep = false;
    function setRegisterStep(active) {
      registerStep = active;
      const wrap = document.getElementById('registerOnlyFields');
      const registerBtn = document.getElementById('firebaseRegisterBtn');
      const cancelBtn = document.getElementById('firebaseCancelRegisterBtn');
      const loginBtn = document.getElementById('firebaseLoginBtn');
      if (wrap) wrap.style.display = active ? '' : 'none';
      if (registerBtn) registerBtn.innerHTML = active ? '<i class="fas fa-check"></i> Confirmar cadastro' : '<i class="fas fa-user-plus"></i> Criar conta';
      if (cancelBtn) cancelBtn.classList.toggle('hidden', !active);
      if (loginBtn) loginBtn.classList.toggle('hidden', active);
      if (active) document.getElementById('firebaseNome')?.focus();
    }
    async function buscarDiasTesteConfigurado() {
      try {
        if (!firebaseDbInstance) return TRIAL_DIAS_PADRAO;
        const snap = await firebaseDbInstance.collection('configAdmin').doc('geral').get();
        const dias = snap.exists ? Number(snap.data().diasTeste) : NaN;
        return Number.isFinite(dias) && dias > 0 ? dias : TRIAL_DIAS_PADRAO;
      } catch (e) { return TRIAL_DIAS_PADRAO; }
    }
    async function handleFirebaseRegister() {
      if (!firebaseAuthInstance) { showToast('Firebase Authentication não foi inicializado.', true); return; }
      if (!registerStep) { setRegisterStep(true); return; }
      const nome = String(document.getElementById('firebaseNome')?.value || '').trim();
      const whatsapp = String(document.getElementById('firebaseWhatsapp')?.value || '').trim();
      const email = String(document.getElementById('firebaseEmail')?.value || '').trim();
      const password = String(document.getElementById('firebasePassword')?.value || '').trim();
      if (!nome || !whatsapp) { showToast('Preencha nome e WhatsApp para criar a conta.', true); return; }
      if (!email || !password) { showToast('Preencha email e senha para criar a conta.', true); return; }
      try {
        setCloudStatus('Criando conta...', 'warn', 'Criando o usuário no Firebase Authentication.');
        const cred = await firebaseAuthInstance.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;
        const diasTeste = await buscarDiasTesteConfigurado();
        const agora = firebase.firestore.Timestamp.now();
        const testeFim = firebase.firestore.Timestamp.fromMillis(Date.now() + diasTeste * 24 * 60 * 60 * 1000);
        await firebaseDbInstance.collection('clientesAdmin').doc(uid).set({
          nome, whatsapp, email,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          statusConta: 'teste',
          testeInicio: agora,
          testeFim: testeFim,
          assinaturaFim: null,
          ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('firebasePassword').value = '';
        setRegisterStep(false);
        showToast('Conta criada com sucesso. Teste grátis iniciado!');
      } catch (error) {
        console.error(error);
        setCloudStatus('Falha no cadastro', 'error', 'Não foi possível criar o usuário no Firebase Authentication.');
        showToast(getFirebaseErrorMessage(error, 'Não foi possível criar a conta.'), true);
      }
    }
    async function handleFirebaseLogout() {
      if (!firebaseAuthInstance) return;
      try {
        await firebaseAuthInstance.signOut();
        setRegisterStep(false);
        document.getElementById('trialExpiredOverlay')?.classList.add('hidden');
        showToast('Sessão encerrada.');
      } catch (error) {
        console.error(error);
        showToast('Não foi possível sair.', true);
      }
    }
    async function loadCloudDataForUser() {
      const ref = getCloudDocRef();
      if (!ref) return;
      try {
        setCloudStatus('Carregando nuvem...', 'warn', 'Buscando seus dados no Firestore.');
        const snap = await ref.get();
        const raw = snap.exists ? (snap.data() || {}) : {};
        if (raw.payload && typeof raw.payload === 'object') {
          applyCloudPayload(raw.payload);
          setCloudStatus('Sincronizado', 'ok', 'Dados carregados do Firestore com sucesso.');
          if (document.querySelector('.panel.active')?.id === 'login') switchTab('dashboard');
          return;
        }
        setCloudStatus('Conta conectada', 'ok', 'Nenhum documento foi encontrado ainda. O próximo salvamento criará sua base no Firestore.');
        if (hasMeaningfulData(buildCloudPayload())) queueCloudSave('force');
        if (document.querySelector('.panel.active')?.id === 'login') switchTab('dashboard');
      } catch (error) {
        console.error(error);
        setCloudStatus('Erro na nuvem', 'error', 'Falha ao ler o documento do Firestore. Verifique as regras e o projeto configurado.');
        showToast('Não foi possível carregar os dados do Firebase.', true);
      }
    }
    function calcularStatusConta(dados) {
      const agora = Date.now();
      const assinaturaFimMs = dados.assinaturaFim && dados.assinaturaFim.toMillis ? dados.assinaturaFim.toMillis() : null;
      const testeFimMs = dados.testeFim && dados.testeFim.toMillis ? dados.testeFim.toMillis() : null;
      if (assinaturaFimMs) return assinaturaFimMs > agora ? { status: 'ativa', fimMs: assinaturaFimMs } : { status: 'expirada', fimMs: assinaturaFimMs };
      if (testeFimMs) return testeFimMs > agora ? { status: 'teste', fimMs: testeFimMs } : { status: 'expirada', fimMs: testeFimMs };
      return { status: 'ativa', fimMs: null };
    }
    function formatarDiasRestantes(fimMs) {
      if (!fimMs) return '';
      const diffMs = fimMs - Date.now();
      if (diffMs <= 0) return 'expirado';
      const dias = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      return dias <= 1 ? 'menos de 1 dia restante' : `${dias} dias restantes`;
    }
    async function verificarStatusConta() {
      const chip = document.getElementById('trialStatusChip');
      const overlay = document.getElementById('trialExpiredOverlay');
      if (!firebaseDbInstance || !currentFirebaseUser) return true;
      try {
        const ref = firebaseDbInstance.collection('clientesAdmin').doc(currentFirebaseUser.uid);
        const snap = await ref.get();
        if (!snap.exists) {
          // Conta criada antes deste recurso: liberar automaticamente por 30 dias.
          const assinaturaFim = firebase.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await ref.set({
            nome: currentFirebaseUser.email || '', whatsapp: '', email: currentFirebaseUser.email || '',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            statusConta: 'ativa', testeInicio: null, testeFim: null,
            assinaturaFim, ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
          });
          if (chip) { chip.textContent = 'Assinatura ativa'; chip.className = 'auth-status-chip trial-chip-ativa'; }
          overlay?.classList.add('hidden');
          return true;
        }
        const dados = snap.data() || {};
        const { status, fimMs } = calcularStatusConta(dados);
        if (status === 'expirada') {
          overlay?.classList.remove('hidden');
          chip?.classList.add('hidden');
          const linkEl = document.getElementById('trialExpiredPaymentLink');
          const msgEl = document.getElementById('trialExpiredMessage');
          try {
            const cfgSnap = await firebaseDbInstance.collection('configAdmin').doc('geral').get();
            const link = cfgSnap.exists ? String(cfgSnap.data().linkPagamento || '') : '';
            if (linkEl) { linkEl.href = link || '#'; linkEl.classList.toggle('hidden', !link); }
            if (msgEl) msgEl.textContent = dados.assinaturaFim
              ? 'Sua assinatura venceu. Para continuar utilizando a Agenda IPTV, realize o pagamento pelo link abaixo.'
              : 'Seu período de teste expirou. Para continuar utilizando a Agenda IPTV, realize o pagamento pelo link abaixo.';
          } catch (e) { /* segue sem link */ }
          document.body.classList.add('auth-screen');
          switchTab('login');
          document.getElementById('login')?.classList.remove('active');
          return false;
        }
        overlay?.classList.add('hidden');
        if (chip) {
          chip.classList.remove('hidden');
          chip.className = `auth-status-chip trial-chip-${status}`;
          chip.textContent = status === 'teste'
            ? `Teste grátis — ${formatarDiasRestantes(fimMs)}`
            : `Assinatura ativa — ${fimMs ? formatarDiasRestantes(fimMs) : 'sem vencimento'}`;
        }
        return true;
      } catch (error) {
        console.error(error);
        return true; // não bloquear o acesso por falha de leitura pontual
      }
    }

    function setupFirebaseAuth() {
      if (firebaseWired) return;
      firebaseWired = true;
      if (!window.firebase) {
        setCloudStatus('Firebase ausente', 'error', 'Os scripts do Firebase não foram carregados no navegador.');
        return;
      }
      try {
        firebaseAppInstance = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
        firebaseAuthInstance = firebase.auth();
        firebaseDbInstance = firebase.firestore();
        const form = document.getElementById('firebaseLoginForm');
        const registerBtn = document.getElementById('firebaseRegisterBtn');
        const cancelRegisterBtn = document.getElementById('firebaseCancelRegisterBtn');
        const headerLogoutBtn = document.getElementById('headerLogoutBtn');
        const trialExpiredLogoutBtn = document.getElementById('trialExpiredLogoutBtn');
        if (form) form.addEventListener('submit', handleFirebaseLogin);
        if (registerBtn) registerBtn.addEventListener('click', handleFirebaseRegister);
        if (cancelRegisterBtn) cancelRegisterBtn.addEventListener('click', () => setRegisterStep(false));
        if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', handleFirebaseLogout);
        if (trialExpiredLogoutBtn) trialExpiredLogoutBtn.addEventListener('click', handleFirebaseLogout);
        firebaseAuthInstance.onAuthStateChanged(async (user) => {
          currentFirebaseUser = user || null;
          updateAuthUi();
          if (currentFirebaseUser) {
            const liberado = await verificarStatusConta();
            if (liberado) await loadCloudDataForUser();
          } else {
            document.getElementById('trialExpiredOverlay')?.classList.add('hidden');
            document.getElementById('trialStatusChip')?.classList.add('hidden');
          }
        });
      } catch (error) {
        console.error(error);
        setCloudStatus('Falha no Firebase', 'error', 'Não foi possível inicializar o projeto Firebase com as credenciais informadas.');
      }
    }

    /* Substitui o confirm() nativo (bloqueado em iframes pelo Chrome).
       Padrão "clicar 2x em até 2.5s na mesma ação para confirmar". */
    const _pendingConfirms = new Map();
    function confirmar(message) {
      const key = String(message || '');
      const now = Date.now();
      const last = _pendingConfirms.get(key) || 0;
      if (now - last < 2500) {
        _pendingConfirms.delete(key);
        return true;
      }
      _pendingConfirms.set(key, now);
      showToast(`${message} Clique novamente para confirmar.`);
      return false;
    }

    function saveClients() {
      try {
        writeJsonCache(STORAGE_KEY, clients);
        queueCloudSave('clients');
      } catch (e) { showToast('Falha ao salvar localmente.', true); }
    }
    function loadClients() {
      const raw = readJsonCache(STORAGE_KEY, []);
      clients = Array.isArray(raw) ? raw : [];
    }
    function salvarTestes() {
      try {
        writeJsonCache(STORAGE_KEY_TESTES, testes);
        queueCloudSave('testes');
      } catch (e) {}
    }
    function carregarTestes() {
      const raw = readJsonCache(STORAGE_KEY_TESTES, []);
      testes = Array.isArray(raw) ? raw : [];
    }

    function pad(n) { return String(n).padStart(2, '0'); }
    function todayLocalDate() {
      const parts = getZonedDateParts(new Date());
      return parts ? new Date(parts.year, parts.month - 1, parts.day) : new Date();
    }
    function parseDate(value) {
      if (!value) return null;
      const parts = String(value).split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return null;
      const [y, m, d] = parts;
      return new Date(y, m - 1, d);
    }
    function toInputDate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
    function formatDate(value) {
      if (!value) return '—';
      const d = parseDate(value);
      if (!d || isNaN(d.getTime())) return '—';
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    function formatDateTimeSaoPaulo(dateLike) {
      if (!dateLike) return '—';
      const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
      if (isNaN(d.getTime())) return '—';
      return zonedDateTimeFormatter.format(d);
    }
    function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
    function addMonths(date, months) {
      const d = new Date(date);
      const day = d.getDate();
      d.setMonth(d.getMonth() + months);
      // Evita rolagem quando o dia original não existe no mês destino (ex: 31/01 + 1 mês)
      if (d.getDate() !== day) { d.setDate(0); }
      return d;
    }
    function addPlanPeriod(date, dias) {
      // Para planos de 30+ dias, soma meses calendário (1 mês per 30 dias)
      // Para planos menores, soma os dias exatos
      if (dias >= 30 && dias % 30 === 0) {
        return addMonths(date, Math.round(dias / 30));
      }
      return addDays(date, dias);
    }
    function diffInDays(a, b) {
      const ms = 86400000;
      const x = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      const y = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((x - y) / ms);
    }
    function getDaysUntil(client) { const due = parseDate(client.dataRenovacao); if (!due) return null; return diffInDays(due, todayLocalDate()); }
    function getStatus(client) {
      if (client.bloqueado) return { label: 'Bloqueado', cls: 'pill-blocked' };
      if (client.pagamentoPendente) return { label: 'Pagamento pendente', cls: 'pill-pending' };
      const diff = getDaysUntil(client);
      if (diff === null) return { label: 'Sem data', cls: 'pill-week' };
      if (diff < 0) return { label: `Vencido há ${Math.abs(diff)}d`, cls: 'pill-expired' };
      if (diff === 0) return { label: 'Vence hoje', cls: 'pill-today' };
      if (diff === 1) return { label: 'Vence amanhã', cls: 'pill-tomorrow' };
      if (diff <= 7) return { label: `Vence em ${diff}d`, cls: 'pill-week' };
      return { label: `${diff}d restantes`, cls: 'pill-ok' };
    }
    function escapeHtml(text) { return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
    function generateId() {
      if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    function resolverCreditosCliente(target) {
      if (target && Number.isFinite(parseInt(target.creditos))) {
        const v = parseInt(target.creditos);
        if (v >= 0) return v;
      }
      const planoCad = encontrarPlanoPorNome(target ? target.plano : '');
      if (planoCad && Number.isFinite(parseInt(planoCad.creditos))) return parseInt(planoCad.creditos);
      return 1;
    }

    /* === NOVO: cálculo de taxa bancária === */
    function calcularTaxaPlano(plano, valorVenda) {
      if (!plano || !plano.taxaTipo || plano.taxaTipo === 'none') return 0;
      const v = parseFloat(plano.taxaValor);
      if (!Number.isFinite(v) || v <= 0) return 0;
      const valorNum = parseFloat(valorVenda) || 0;
      if (plano.taxaTipo === 'pct') return (valorNum * v) / 100;
      if (plano.taxaTipo === 'fixed') return v;
      return 0;
    }
    function descricaoTaxaPlano(plano) {
      if (!plano || !plano.taxaTipo || plano.taxaTipo === 'none') return 'Sem taxa';
      const v = parseFloat(plano.taxaValor);
      if (!Number.isFinite(v) || v <= 0) return 'Sem taxa';
      if (plano.taxaTipo === 'pct') return `${v.toFixed(2).replace('.', ',')}%`;
      if (plano.taxaTipo === 'fixed') return `R$ ${v.toFixed(2).replace('.', ',')} fixo`;
      return 'Sem taxa';
    }


function buildMessage(client) {
  const diff = getDaysUntil(client);
  let statusTag;
  if (diff === null) statusTag = `Próximo do vencimento`;
  else if (diff > 1) statusTag = `Vence em ${diff} dias`;
  else if (diff === 1) statusTag = `Vence em 1 dia`;
  else if (diff === 0) statusTag = `Vence hoje`;
  else if (diff === -1) statusTag = `Venceu há 1 dia`;
  else statusTag = `Venceu há ${Math.abs(diff)} dias`;
  const valor = (client.valor || '').toString().trim();
  return renderMessageTemplate('cobranca', {
    nome: client.nome || '',
    status_vencimento: statusTag,
    usuario: client.usuario || '',
    senha: client.senha || '',
    plano: client.plano || '',
    valor: valor ? `R$ ${valor}` : '',
    link_renovacao: client.linkRenovacao || ''
  });
}

function copyMessage(id) {
      const client = clients.find(c => c.id === id);
      if (!client) return;
      const msg = buildMessage(client);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${client.nome}`)).catch(() => fallbackCopy(msg, client.nome));
      } else fallbackCopy(msg, client.nome);
    }
    function fallbackCopy(text, name) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        showToast(`Mensagem copiada para ${name}`);
      } catch (e) { showToast('Não foi possível copiar.', true); }
    }
    function openWhatsApp(id) {
      const client = clients.find(c => c.id === id);
      if (!client) return;
      if (getDaysUntil(client) === 0) { client.msgSentAt = new Date().toISOString(); saveClients(); }
      const phone = String(client.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildMessage(client));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      renderDashboard(); renderClientes();
    }
    function parseValor(v) {
      if (!v) return 0;
      const s = String(v).replace(/[^\d.,-]/g, '').replace(',', '.');
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }

    function buildPagamentoPendenteMessage(client) {
      const dados = client._renovacaoPendente || {};
      const valor = Number(dados.valorVenda) || parseValor(client.valor);
      return renderMessageTemplate('pagamento_pendente', {
        nome: client.nome || '',
        usuario: client.usuario || '',
        senha: client.senha || '',
        plano: client.plano || '',
        valor: valor ? `R$ ${valor.toFixed(2).replace('.', ',')}` : '',
        data_renovacao: formatDate(client.dataRenovacao),
        link_renovacao: client.linkRenovacao || ''
      });
    }
    function enviarWhatsAppPagamentoPendente(id) {
      const client = clients.find(c => c.id === id);
      if (!client) return;
      const phone = String(client.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildPagamentoPendenteMessage(client));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (!phone) showToast('Cliente sem telefone cadastrado. Adicione um telefone válido para enviar a mensagem.', true);
    }

    /* === RENOVAÇÃO COM CONFIRMAÇÃO === */
    let renovacaoPendente = null; // { client, dias, novaDataStr, valorVenda, painelId, creditosUsar, taxa }

    function abrirModalConfirmarRenovacao(id) {
      const client = clients.find(c => c.id === id);
      if (!client) return;
      const planoCadastrado = encontrarPlanoPorNome(client.plano);
      const dias = planoCadastrado ? planoCadastrado.dias : 30;
      const creditosUsar = resolverCreditosCliente(client);
      const today = todayLocalDate();
      const dueDate = parseDate(client.dataRenovacao);
      // Renovação antecipada (ainda não venceu): soma os dias do plano à data de vencimento atual,
      // preservando os dias restantes. Vencido ou vencendo hoje: conta a partir de hoje (data da renovação).
      const baseDate = (dueDate && dueDate > today) ? dueDate : today;
      const nd = addPlanPeriod(baseDate, dias);
      const novaDataStr = toInputDate(nd);
      const valorVenda = parseValor(client.valor);
      const taxa = calcularTaxaPlano(planoCadastrado, valorVenda);
      const painelId = (planoCadastrado && planoCadastrado.painelId) ? planoCadastrado.painelId : paineis[0].id;
      const painelNome = getPainelNome(painelId);
      const painelCls = getPainelIdxClass(painelId);

      // Informação sobre o cálculo
      const venceuHa = (dueDate && dueDate < today) ? diffInDays(today, dueDate) : 0;
      const diasRestantes = (dueDate && dueDate > today) ? diffInDays(dueDate, today) : 0;
      let baseInfo;
      if (diasRestantes > 0) {
        baseInfo = `<span style="color:var(--primary);">${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} restantes</span> — contando ${dias} dias a partir do vencimento atual (renovação antecipada, dias restantes preservados)`;
      } else if (venceuHa > 0) {
        baseInfo = `<span style="color:#ff9b9b;">Venceu há ${venceuHa} dia${venceuHa === 1 ? '' : 's'}</span> — contando ${dias} dias a partir de hoje`;
      } else {
        baseInfo = `Vence hoje — contando ${dias} dias a partir de hoje`;
      }

      renovacaoPendente = { id: client.id, dias, novaDataStr, valorVenda, painelId, creditosUsar, taxa };

      const grid = document.getElementById('renewConfirmGrid');
      grid.innerHTML = `
        <div class="renew-confirm-item full">
          <div class="lbl">Nome</div>
          <div class="val">${escapeHtml(client.nome || '—')} <span class="painel-badge ${painelCls}" style="margin-left:6px;"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span></div>
        </div>
        <div class="renew-confirm-item">
          <div class="lbl">Usuário</div>
          <div class="val">${escapeHtml(client.usuario || '—')}</div>
        </div>
        <div class="renew-confirm-item">
          <div class="lbl">Senha</div>
          <div class="val">${escapeHtml(client.senha || '—')}</div>
        </div>
        <div class="renew-confirm-item">
          <div class="lbl">Plano</div>
          <div class="val">${escapeHtml(client.plano || '—')}</div>
        </div>
        <div class="renew-confirm-item">
          <div class="lbl">Valor</div>
          <div class="val">R$ ${escapeHtml(String(client.valor || '0'))}</div>
        </div>
        <div class="renew-confirm-item">
          <div class="lbl">Vencimento atual</div>
          <div class="val">${escapeHtml(formatDate(client.dataRenovacao))}</div>
        </div>
        <div class="renew-confirm-item highlight">
          <div class="lbl">Nova data de vencimento</div>
          <div class="val" data-testid="confirm-nova-data">${escapeHtml(formatDate(novaDataStr))}</div>
        </div>
        <div class="renew-confirm-item full">
          <div class="lbl">Cálculo</div>
          <div class="val" style="font-size:13px;">${baseInfo}<br><span style="color:var(--muted); font-size:12px;">−${creditosUsar} crédito${creditosUsar === 1 ? '' : 's'} do <b>${escapeHtml(painelNome)}</b>${taxa > 0 ? ` • Taxa R$ ${taxa.toFixed(2)}` : ''}</span></div>
        </div>
      `;
      document.getElementById('modalConfirmarRenovacao').classList.add('active');
    }

    function fecharModalConfirmarRenovacao() {
      document.getElementById('modalConfirmarRenovacao').classList.remove('active');
      renovacaoPendente = null;
    }

    function confirmarRenovacao() {
      if (!renovacaoPendente) return;
      const { id, novaDataStr, valorVenda, painelId, creditosUsar, taxa } = renovacaoPendente;
      const client = clients.find(c => c.id === id);
      if (!client) { fecharModalConfirmarRenovacao(); return; }
      
      const today = todayLocalDate();
      client.dataInicio = toInputDate(today);
      client.dataPagamento = toInputDate(today);
      client.dataRenovacao = novaDataStr;
      client.msgSentAt = null;
      client.updatedAt = new Date().toISOString();
      
      // Verifica o status do pagamento
      const pagStatusEl = document.querySelector('input[name="pag_status"]:checked');
      const pagStatus = pagStatusEl ? pagStatusEl.value : 'realizado';
      
      if (pagStatus === 'realizado') {
        // Pagamento realizado - processa imediatamente
        client.pagamentoPendente = false;
        delete client._renovacaoPendente;
        
        movimentacoes.push({
          data: new Date().toISOString(), tipo: 'use', tipoCliente: 'renovacao',
          valor: valorVenda, quantidade: creditosUsar, taxa: taxa,
          planoNome: client.plano || '', clientId: client.id, clientNome: client.nome,
          painelId
        });
        salvarMovimentacoes();
        
        renderAll();
        atualizarCreditos(); atualizarHistorico();
        atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
        atualizarSelectMesGestao();
        
        fecharModalConfirmarRenovacao();
        abrirModalMensagemRenovacao(client);
        showToast(`Renovação confirmada • Novo vencimento: ${formatDate(client.dataRenovacao)} • -${creditosUsar} crédito${creditosUsar === 1 ? '' : 's'} (${getPainelNome(painelId)})${taxa > 0 ? ` • Taxa: R$ ${taxa.toFixed(2)}` : ''}`);
      } else {
        // Pagamento pendente - reserva o crédito agora, sem contabilizar lucro/taxa ainda
        client.pagamentoPendente = true;
        const reservaId = reservarCreditoPagamentoPendente(client, { valorVenda, painelId, creditosUsar, taxa });
        client._renovacaoPendente = { valorVenda, painelId, creditosUsar, taxa, reservaId };
        
        saveClients();
        renderAll();
        atualizarCreditos(); atualizarHistorico();
        atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
        atualizarSelectMesGestao();
        fecharModalConfirmarRenovacao();
        abrirModalMensagemRenovacao(client);
        showToast(`Renovação pendente • ${creditosUsar} crédito${creditosUsar === 1 ? '' : 's'} reservado${creditosUsar === 1 ? '' : 's'} em ${getPainelNome(painelId)}`);
      }
    }

    function confirmarPagamento(id, valorPago = null) {
      const client = clients.find(c => c.id === id);
      if (!client || !client.pagamentoPendente) return;
      const dados = client._renovacaoPendente || {};
      const valorEsperado = Number(dados.valorVenda) || parseValor(client.valor);
      const valorFinal = (valorPago !== null && Number.isFinite(Number(valorPago))) ? Number(valorPago) : valorEsperado;
      const painelId = dados.painelId || ((encontrarPlanoPorNome(client.plano) || {}).painelId) || paineis[0].id;
      const creditosUsar = Number(dados.creditosUsar) || resolverCreditosCliente(client);
      const taxa = Number(dados.taxa) || 0;
      client.pagamentoPendente = false;
      delete client._renovacaoPendente;
      client.updatedAt = new Date().toISOString();
      client.ultimoPagamentoValor = valorFinal;
      client.ultimoPagamentoEsperado = valorEsperado;
      client.ultimoPagamentoDivergente = Math.abs(valorFinal - valorEsperado) > 0.001;
      converterReservaEmUso(client, { valorVenda: valorFinal, painelId, creditosUsar, taxa, reservaId: dados.reservaId });
      salvarMovimentacoes();
      saveClients();
      renderAll();
      atualizarCreditos(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      const fmtMoney = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
      const divergenciaMsg = client.ultimoPagamentoDivergente
        ? ` • Valor pago: ${fmtMoney(valorFinal)} (esperado ${fmtMoney(valorEsperado)})`
        : '';
      showToast(`Pagamento confirmado de ${client.nome} • -${creditosUsar} crédito${creditosUsar === 1 ? '' : 's'} (${getPainelNome(painelId)})${taxa > 0 ? ` • Taxa: R$ ${taxa.toFixed(2)}` : ''}${divergenciaMsg}`);
    }
    window.confirmarPagamento = confirmarPagamento;

    /* === Modal: confirmar pagamento (valor total ou outro valor) === */
    let pagamentoConfirmAtualId = null;
    function abrirModalConfirmarPagamento(id) {
      const client = clients.find(c => c.id === id);
      if (!client || !client.pagamentoPendente) return;
      pagamentoConfirmAtualId = id;
      const dados = client._renovacaoPendente || {};
      const valorEsperado = Number(dados.valorVenda) || parseValor(client.valor);
      const fmtMoney = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
      const nomeEl = document.getElementById('cpClienteNome');
      const totalLabelEl = document.getElementById('cpValorTotalLabel');
      const outroInput = document.getElementById('cp_valorOutro');
      if (nomeEl) nomeEl.textContent = client.nome || '—';
      if (totalLabelEl) totalLabelEl.textContent = `Pagou o valor total (${fmtMoney(valorEsperado)})`;
      if (outroInput) outroInput.value = '';
      const radioTotal = document.querySelector('input[name="cp_valor_opcao"][value="total"]');
      if (radioTotal) radioTotal.checked = true;
      atualizarRadioCp();
      toggleCpValorOutro();
      const modal = document.getElementById('modalConfirmarPagamento');
      if (modal) modal.classList.add('active');
    }
    function fecharModalConfirmarPagamento() {
      const modal = document.getElementById('modalConfirmarPagamento');
      if (modal) modal.classList.remove('active');
      pagamentoConfirmAtualId = null;
    }
    function atualizarRadioCp() {
      const optTotal = document.getElementById('cp_opt_total');
      const optOutro = document.getElementById('cp_opt_outro');
      if (!optTotal || !optOutro) return;
      const checked = document.querySelector('input[name="cp_valor_opcao"]:checked');
      const v = checked ? checked.value : 'total';
      optTotal.classList.toggle('active', v === 'total');
      optOutro.classList.toggle('active', v === 'outro');
    }
    function toggleCpValorOutro() {
      const checked = document.querySelector('input[name="cp_valor_opcao"]:checked');
      const v = checked ? checked.value : 'total';
      const wrap = document.getElementById('cp_valorOutro_wrap');
      if (wrap) wrap.style.display = v === 'outro' ? '' : 'none';
      atualizarRadioCp();
    }
    function processarConfirmarPagamento() {
      if (!pagamentoConfirmAtualId) return;
      const checked = document.querySelector('input[name="cp_valor_opcao"]:checked');
      const opcao = checked ? checked.value : 'total';
      let valorPago = null;
      if (opcao === 'outro') {
        const raw = String(document.getElementById('cp_valorOutro').value || '').trim().replace(',', '.');
        const v = parseFloat(raw);
        if (!Number.isFinite(v) || v < 0) { showToast('Informe um valor válido para o pagamento.', true); return; }
        valorPago = v;
      }
      confirmarPagamento(pagamentoConfirmAtualId, valorPago);
      fecharModalConfirmarPagamento();
    }
    window.abrirModalConfirmarPagamento = abrirModalConfirmarPagamento;
    window.fecharModalConfirmarPagamento = fecharModalConfirmarPagamento;
    window.toggleCpValorOutro = toggleCpValorOutro;
    window.processarConfirmarPagamento = processarConfirmarPagamento;

    function formatCreditos(qtd) {
      const n = Number(qtd) || 0;
      return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    }

    function criarReservaId() { return 'reserva-' + generateId(); }

    function encontrarReservaPendente(client, reservaId) {
      if (reservaId) {
        const porId = movimentacoes.find(m => m.id === reservaId && m.tipo === 'reserve');
        if (porId) return porId;
      }
      return movimentacoes.find(m => m.tipo === 'reserve' && m.reservaPagamento && m.clientId === client.id) || null;
    }

    function reservarCreditoPagamentoPendente(client, dados) {
      const creditosUsar = Math.max(0, Number(dados.creditosUsar) || 0);
      const painelId = dados.painelId || ((encontrarPlanoPorNome(client.plano) || {}).painelId) || paineis[0].id;
      let reserva = encontrarReservaPendente(client, dados.reservaId);
      if (!reserva) {
        reserva = { id: criarReservaId(), data: new Date().toISOString(), tipo: 'reserve', tipoCliente: 'pendente', reservaPagamento: true };
        movimentacoes.push(reserva);
      }
      Object.assign(reserva, {
        quantidade: creditosUsar, valor: 0, taxa: 0,
        planoNome: client.plano || '', clientId: client.id, clientNome: client.nome,
        painelId, pagamentoValor: Number(dados.valorVenda) || parseValor(client.valor),
        pagamentoTaxa: Number(dados.taxa) || 0
      });
      salvarMovimentacoes();
      return reserva.id;
    }

    function converterReservaEmUso(client, dados) {
      const reserva = encontrarReservaPendente(client, dados.reservaId);
      const payload = {
        data: new Date().toISOString(), tipo: 'use', tipoCliente: 'renovacao',
        valor: Number(dados.valorVenda) || 0, quantidade: Number(dados.creditosUsar) || 0, taxa: Number(dados.taxa) || 0,
        planoNome: client.plano || '', clientId: client.id, clientNome: client.nome,
        painelId: dados.painelId || paineis[0].id
      };
      if (reserva) {
        Object.keys(reserva).forEach(k => { if (!(k in payload) && k !== 'id') delete reserva[k]; });
        Object.assign(reserva, payload);
      } else {
        movimentacoes.push(payload);
      }
    }

    function liberarReservaPagamentoPendente(client) {
      if (!client) return;
      const reservaId = client._renovacaoPendente && client._renovacaoPendente.reservaId;
      const before = movimentacoes.length;
      movimentacoes = movimentacoes.filter(m => !(m.tipo === 'reserve' && (m.id === reservaId || (m.reservaPagamento && m.clientId === client.id))));
      if (movimentacoes.length !== before) salvarMovimentacoes();
    }

    function garantirReservasPagamentosPendentes() {
      if (!Array.isArray(clients) || !Array.isArray(movimentacoes) || !paineis.length) return;
      const pendingIds = new Set(clients.filter(c => c.pagamentoPendente).map(c => c.id));
      let mudouMov = false, mudouCli = false;
      const antes = movimentacoes.length;
      movimentacoes = movimentacoes.filter(m => !(m.tipo === 'reserve' && m.reservaPagamento && (!m.clientId || !pendingIds.has(m.clientId))));
      if (movimentacoes.length !== antes) mudouMov = true;
      clients.forEach(c => {
        if (!c.pagamentoPendente) return;
        const dados = c._renovacaoPendente || {};
        const valorVenda = Number(dados.valorVenda) || parseValor(c.valor);
        const painelId = dados.painelId || ((encontrarPlanoPorNome(c.plano) || {}).painelId) || paineis[0].id;
        const creditosUsar = Number(dados.creditosUsar) || resolverCreditosCliente(c);
        const taxa = Number(dados.taxa) || 0;
        let reserva = encontrarReservaPendente(c, dados.reservaId);
        if (!reserva && creditosUsar > 0) {
          reserva = { id: criarReservaId(), data: c.updatedAt || new Date().toISOString(), tipo: 'reserve', tipoCliente: 'pendente', reservaPagamento: true };
          movimentacoes.push(reserva);
          mudouMov = true;
        }
        if (reserva) {
          Object.assign(reserva, { quantidade: creditosUsar, valor: 0, taxa: 0, planoNome: c.plano || '', clientId: c.id, clientNome: c.nome, painelId, pagamentoValor: valorVenda, pagamentoTaxa: taxa });
          c._renovacaoPendente = { ...dados, valorVenda, painelId, creditosUsar, taxa, reservaId: reserva.id };
          mudouCli = true;
          mudouMov = true;
        }
      });
      if (mudouMov) salvarMovimentacoes();
      if (mudouCli) saveClients();
    }


function buildRenewMessage(client) {
  return renderMessageTemplate('renovacao_confirmada', {
    status_pagamento: client.pagamentoPendente ? 'PAGAMENTO PENDENTE' : 'Pago',
    usuario: client.usuario || '',
    senha: client.senha || '',
    data_renovacao: formatDate(client.dataRenovacao)
  });
}

let renovacaoClienteAtual = null;
    function abrirModalMensagemRenovacao(client) {
      renovacaoClienteAtual = client;
      const box = document.getElementById('renewMsgBox');
      if (box) box.textContent = buildRenewMessage(client);
      document.getElementById('modalMensagemRenovacao').classList.add('active');
    }
    function fecharModalMensagemRenovacao() {
      document.getElementById('modalMensagemRenovacao').classList.remove('active');
      renovacaoClienteAtual = null;
    }
    function copiarMensagemRenovacao() {
      if (!renovacaoClienteAtual) return;
      const msg = buildRenewMessage(renovacaoClienteAtual);
      const name = renovacaoClienteAtual.nome || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(msg, name));
      } else fallbackCopy(msg, name);
    }
    function enviarMensagemRenovacaoWhatsApp() {
      if (!renovacaoClienteAtual) return;
      const c = renovacaoClienteAtual;
      const phone = String(c.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildRenewMessage(c));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    function renewClient(id) {
      // Abre o modal de confirmação ao invés de renovar direto
      abrirModalConfirmarRenovacao(id);
    }
    window.openWhatsApp = openWhatsApp; window.copyMessage = copyMessage; window.renewClient = renewClient;
    window.fecharModalConfirmarRenovacao = fecharModalConfirmarRenovacao;
    window.confirmarRenovacao = confirmarRenovacao;
    window.fecharModalMensagemRenovacao = fecharModalMensagemRenovacao;
    window.copiarMensagemRenovacao = copiarMensagemRenovacao;
    window.enviarMensagemRenovacaoWhatsApp = enviarMensagemRenovacaoWhatsApp;

    function switchTab(tabName) {
      const targetTab = !currentFirebaseUser ? 'login' : (tabName === 'login' ? 'dashboard' : tabName);
      els.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === targetTab));
      els.panels.forEach(panel => panel.classList.toggle('active', panel.id === targetTab));
      closeSidebar();
      if (targetTab === 'dashboard') {
        setTimeout(() => {
          try { atualizarDashboardFinanceiro(); } catch (e) {}
          try { renderDashboard(); } catch (e) {}
        }, 80);
      }
      if (targetTab === 'config') {
        setTimeout(() => {
          try { atualizarSelectMesGestao(); atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao(); } catch (e) {}
          try { popularSelectIndicadores(); popularSelectTestes(); renderIndicacoes(); } catch (e) {}
        }, 80);
      }
      if (targetTab === 'mensagens') {
        setTimeout(() => { try { renderMessageEditor(); } catch (e) {} }, 60);
      }
      if (targetTab === 'roleta') {
        renderRoleta();
      }
    }

    function openSidebar() {
      const sb = document.getElementById('sidebar');
      const ov = document.getElementById('sidebarOverlay');
      if (sb) sb.classList.add('active');
      if (ov) ov.classList.add('active');
    }
    function closeSidebar() {
      const sb = document.getElementById('sidebar');
      const ov = document.getElementById('sidebarOverlay');
      if (sb) sb.classList.remove('active');
      if (ov) ov.classList.remove('active');
    }

    function paginate(list, page, perPage = ITEMS_PER_PAGE) {
      const totalPages = Math.max(1, Math.ceil(list.length / perPage));
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * perPage;
      return { items: list.slice(start, start + perPage), totalPages, safePage };
    }
    function renderPagination(targetEl, currentPage, totalPages, onChangeName) {
      if (!targetEl) return;
      if (totalPages <= 1) { targetEl.innerHTML = ''; return; }
      targetEl.innerHTML = `
        <button class="btn-secondary" onclick="${onChangeName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="page-info">Página ${currentPage} de ${totalPages}</span>
        <button class="btn-secondary" onclick="${onChangeName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Próxima →</button>`;
    }

    function whatsBtnHtml(client) {
      const isToday = getDaysUntil(client) === 0;
      if (!isToday) return `<button class="btn-whatsapp" onclick="openWhatsApp('${client.id}')" data-testid="whats-default-${client.id}"><i class="fab fa-whatsapp"></i> WhatsApp</button>`;
      const sent = !!client.msgSentAt;
      const cls = sent ? 'btn-whatsapp-sent' : 'btn-whatsapp-unsent';
      const icon = sent ? 'fa-check' : 'fa-paper-plane';
      const label = sent ? 'WhatsApp enviado' : 'WhatsApp';
      return `<button class="${cls}" onclick="openWhatsApp('${client.id}')" data-testid="whats-${sent ? 'sent' : 'unsent'}-${client.id}"><i class="fab fa-whatsapp"></i> ${label} <i class="fas ${icon}" style="font-size:11px; margin-left:2px;"></i></button>`;
    }

    function renderVencimentoList(targetEl, list, isExpired = false) {
      if (!list.length) { targetEl.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum cliente nesta faixa.</p></div>`; return; }
      targetEl.innerHTML = list.map(c => {
        const st = getStatus(c);
        const metaLabel = isExpired ? 'Vencimento' : 'Renovação';
        const planoCad = encontrarPlanoPorNome(c.plano);
        const painelId = planoCad && planoCad.painelId ? planoCad.painelId : paineis[0].id;
        const painelCls = getPainelIdxClass(painelId);
        const painelNome = getPainelNome(painelId);
        return `
          <div class="client-row" data-testid="venc-row-${c.id}">
            <div class="client-row-main">
              <div class="client-row-name">
                ${escapeHtml(c.nome || '—')}
                <span class="pill ${st.cls}">${escapeHtml(st.label)}</span>
                <span class="painel-badge ${painelCls}" title="Painel (uso interno)" data-testid="venc-painel-${c.id}"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span>
              </div>
              <div class="client-row-meta">
                <span><b>Tel:</b> ${escapeHtml(c.telefone || '—')}</span>
                <span><b>User:</b> ${escapeHtml(c.usuario || '—')}</span>
                <span><b>Plano:</b> ${escapeHtml(c.plano || '—')}</span>
                <span><b>Valor:</b> ${escapeHtml(c.valor || '—')}</span>
                <span><b>${metaLabel}:</b> ${escapeHtml(formatDate(c.dataRenovacao))}</span>
              </div>
            </div>
            <div class="client-row-actions">
              ${whatsBtnHtml(c)}
              ${c.pagamentoPendente
                ? `<button class="btn-pending" onclick="abrirModalConfirmarPagamento('${c.id}')" data-testid="btn-confirmar-pag-${c.id}"><i class="fas fa-check-circle"></i> Confirmar Pagamento</button>`
                : `<button class="btn-primary" onclick="renewClient('${c.id}')" data-testid="btn-renovar-${c.id}">Renovar</button>`}
              <button class="btn-info" onclick="editClient('${c.id}')">Editar</button>
            </div>
          </div>`;
      }).join('');
    }

    function renderPagamentosPendentesList(targetEl, list) {
      if (!targetEl) return;
      if (!list.length) {
        targetEl.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i><p>Nenhum pagamento pendente.</p></div>`;
        return;
      }
      const fmtMoney = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
      targetEl.innerHTML = list.map(c => {
        const dados = c._renovacaoPendente || {};
        const creditos = Number(dados.creditosUsar) || resolverCreditosCliente(c);
        const valor = Number(dados.valorVenda) || parseValor(c.valor);
        const painelId = dados.painelId || ((encontrarPlanoPorNome(c.plano) || {}).painelId) || paineis[0].id;
        const painelCls = getPainelIdxClass(painelId);
        return `
          <div class="client-row" data-testid="pending-payment-row-${c.id}">
            <div class="client-row-main">
              <div class="client-row-name">
                ${escapeHtml(c.nome || '—')}
                <span class="pill pill-pending">Pagamento pendente</span>
                <span class="painel-badge ${painelCls}" title="Painel (uso interno)"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(getPainelNome(painelId))}</span>
              </div>
              <div class="client-row-meta">
                <span><b>Usuário:</b> ${escapeHtml(c.usuario || '—')}</span>
                <span><b>Tel:</b> ${escapeHtml(c.telefone || '—')}</span>
                <span><b>Plano:</b> ${escapeHtml(c.plano || '—')}</span>
                <span><b>Valor:</b> ${fmtMoney(valor)}</span>
                <span><b>Créditos:</b> ${formatCreditos(creditos)}</span>
                <span><b>Vencimento:</b> ${escapeHtml(formatDate(c.dataRenovacao))}</span>
              </div>
            </div>
            <div class="client-row-actions">
              <button class="btn-pending" onclick="abrirModalConfirmarPagamento('${c.id}')" data-testid="pending-payment-confirm-${c.id}"><i class="fas fa-check-circle"></i> Confirmar que pagou</button>
              <button class="btn-whatsapp" onclick="enviarWhatsAppPagamentoPendente('${c.id}')" data-testid="pending-payment-whats-${c.id}"><i class="fab fa-whatsapp"></i> Cobrar</button>
              <button class="btn-info" onclick="editClient('${c.id}')">Editar</button>
            </div>
          </div>`;
      }).join('');
    }

    function renderDashboardPendingBoxes() {
      const wrap = document.getElementById('pendingDashboardBoxes');
      const boxCred = document.getElementById('boxCreditosReservados');
      const boxPag = document.getElementById('boxPagamentosPendentes');
      if (!wrap || !boxCred || !boxPag) return;
      const pendentes = clients.filter(c => c.pagamentoPendente);
      if (!pendentes.length) {
        wrap.classList.add('hidden'); boxCred.classList.add('hidden'); boxPag.classList.add('hidden');
        return;
      }
      let totalCred = 0, totalValor = 0;
      const porPainel = {};
      pendentes.forEach(c => {
        const dados = c._renovacaoPendente || {};
        const creditos = Number(dados.creditosUsar) || resolverCreditosCliente(c);
        const valor = Number(dados.valorVenda) || parseValor(c.valor);
        const painelId = dados.painelId || ((encontrarPlanoPorNome(c.plano) || {}).painelId) || paineis[0].id;
        totalCred += creditos; totalValor += valor;
        porPainel[painelId] = (porPainel[painelId] || 0) + creditos;
      });
      const fmtMoney = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
      const elCred = document.getElementById('dashCreditosReservadosValor');
      const elDet = document.getElementById('dashCreditosReservadosDetalhe');
      const elCnt = document.getElementById('dashPagamentosPendentesCount');
      const elVal = document.getElementById('dashPagamentosPendentesValor');
      const elList = document.getElementById('dashPagamentosPendentesList');
      if (elCred) elCred.textContent = formatCreditos(totalCred);
      if (elDet) {
        const detalhe = Object.entries(porPainel).map(([pid, qtd]) => `${escapeHtml(getPainelNome(pid))}: ${formatCreditos(qtd)}`).join(' • ');
        elDet.innerHTML = detalhe || 'reservados em pagamentos pendentes';
      }
      if (elCnt) elCnt.textContent = `${pendentes.length} pendente${pendentes.length === 1 ? '' : 's'}`;
      if (elVal) elVal.textContent = fmtMoney(totalValor);
      if (elList) {
        elList.innerHTML = pendentes.slice(0, 6).map(c => {
          const dados = c._renovacaoPendente || {};
          const creditos = Number(dados.creditosUsar) || resolverCreditosCliente(c);
          const valor = Number(dados.valorVenda) || parseValor(c.valor);
          return `
            <div class="pending-mini-row" data-testid="pending-mini-${c.id}">
              <div class="pending-mini-main">
                <div class="pending-mini-name">${escapeHtml(c.nome || '—')}</div>
                <div class="pending-mini-meta">${fmtMoney(valor)} • ${formatCreditos(creditos)} créd. • venc. ${escapeHtml(formatDate(c.dataRenovacao))}</div>
              </div>
              <div class="pending-mini-actions">
                <button class="btn-whatsapp pending-mini-action" onclick="enviarWhatsAppPagamentoPendente('${c.id}')" data-testid="dash-whats-pag-${c.id}"><i class="fab fa-whatsapp"></i> Cobrar</button>
                <button class="btn-pending pending-mini-action" onclick="abrirModalConfirmarPagamento('${c.id}')" data-testid="dash-confirmar-pag-${c.id}"><i class="fas fa-check"></i> Confirmar</button>
              </div>
            </div>`;
        }).join('') + (pendentes.length > 6 ? `<p class="card-hint" style="margin:2px 0 0;">+${pendentes.length - 6} pendente${pendentes.length - 6 === 1 ? '' : 's'} na lista de clientes.</p>` : '');
      }
      wrap.classList.remove('hidden'); boxCred.classList.remove('hidden'); boxPag.classList.remove('hidden');
    }

    function renderDashboard() {
      const today = todayLocalDate();
      const dueToday = [], dueTomorrow = [], dueWeek = [], expired = [];
      clients.forEach(c => {
        const due = parseDate(c.dataRenovacao); if (!due) return;
        const d = diffInDays(due, today);
        if (d < 0) expired.push(c);
        else if (d === 0) dueToday.push(c);
        else if (d === 1) dueTomorrow.push(c);
        else if (d >= 2 && d <= 7) dueWeek.push(c);
      });
      const sortByRenewal = (a, b) => {
        const da = parseDate(a.dataRenovacao); const db = parseDate(b.dataRenovacao);
        if (da && db && da - db !== 0) return da - db;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      };
      dueToday.sort(sortByRenewal); dueTomorrow.sort(sortByRenewal); dueWeek.sort(sortByRenewal);
      expired.sort((a, b) => parseDate(b.dataRenovacao) - parseDate(a.dataRenovacao));
      els.countToday.textContent = dueToday.length; els.countTomorrow.textContent = dueTomorrow.length;
      els.countWeek.textContent = dueWeek.length; els.countExpired.textContent = expired.length;
      const pToday = paginate(dueToday, state.todayPage); state.todayPage = pToday.safePage;
      const pTomorrow = paginate(dueTomorrow, state.tomorrowPage); state.tomorrowPage = pTomorrow.safePage;
      const pWeek = paginate(dueWeek, state.weekPage); state.weekPage = pWeek.safePage;
      const pExpired = paginate(expired, state.expiredPage); state.expiredPage = pExpired.safePage;
      const pendingPayments = clients
        .filter(c => c.pagamentoPendente)
        .sort((a, b) => {
          const da = parseDate(a.dataRenovacao); const db = parseDate(b.dataRenovacao);
          if (da && db && da - db !== 0) return da - db;
          if (da && !db) return -1;
          if (!da && db) return 1;
          return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });
      const pPendingPayments = paginate(pendingPayments, state.pendingPaymentsPage); state.pendingPaymentsPage = pPendingPayments.safePage;
      renderVencimentoList(els.listToday, pToday.items, false);
      renderVencimentoList(els.listTomorrow, pTomorrow.items, false);
      renderVencimentoList(els.listWeek, pWeek.items, false);
      renderVencimentoList(els.listExpired, pExpired.items, true);
      if (els.countPendingPayments) els.countPendingPayments.textContent = pendingPayments.length;
      renderPagamentosPendentesList(els.listPendingPayments, pPendingPayments.items);
      renderPagination(els.paginationToday, pToday.safePage, pToday.totalPages, 'changeTodayPage');
      renderPagination(els.paginationTomorrow, pTomorrow.safePage, pTomorrow.totalPages, 'changeTomorrowPage');
      renderPagination(els.paginationWeek, pWeek.safePage, pWeek.totalPages, 'changeWeekPage');
      renderPagination(els.paginationExpired, pExpired.safePage, pExpired.totalPages, 'changeExpiredPage');
      renderPagination(els.paginationPendingPayments, pPendingPayments.safePage, pPendingPayments.totalPages, 'changePendingPaymentsPage');
      renderDashboardPendingBoxes();
      try { atualizarDashboardFinanceiro(); } catch (e) {}
    }

    function renderClientes() {
      const term = (els.searchClientesInput.value || '').trim().toLowerCase();
      const filtroEl = document.getElementById('filtroClientesStatus');
      const filtro = filtroEl ? (filtroEl.value || 'all') : 'all';
      const today = todayLocalDate();
      const filtered = clients.filter(c => {
        if (term) {
          const matches = [c.nome, c.telefone, c.usuario, c.aplicativo, c.plano]
            .some(v => String(v || '').toLowerCase().includes(term));
          if (!matches) return false;
        }
        if (filtro === 'all') return true;
        if (filtro === 'bloqueados') return !!c.bloqueado;
        if (filtro === 'pendentes') return !!c.pagamentoPendente;
        const due = parseDate(c.dataRenovacao);
        if (!due) return filtro === 'sem-data';
        const d = diffInDays(due, today);
        if (filtro === 'vencidos') return d < 0;
        if (filtro === 'hoje') return d === 0;
        if (filtro === 'amanha') return d === 1;
        if (filtro === 'semana') return d >= 2 && d <= 7;
        if (filtro === 'mais-7') return d > 7;
        if (filtro === 'sem-data') return false;
        return true;
      });
      // Ordena: vencimento mais próximo primeiro (vencidos no topo, sem data por último)
      filtered.sort((a, b) => {
        const da = parseDate(a.dataRenovacao);
        const db = parseDate(b.dataRenovacao);
        if (!da && !db) return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        if (!da) return 1;
        if (!db) return -1;
        if (da - db !== 0) return da - db;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
      });
      els.countClientes.textContent = filtered.length;
      const pag = paginate(filtered, state.clientesPage); state.clientesPage = pag.safePage;
      if (!pag.items.length) {
        const semFiltro = !term && filtro === 'all';
        els.clientesList.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>${clients.length === 0 ? 'Nenhum cliente cadastrado ainda. Use o botão "Cadastrar Cliente" acima.' : (semFiltro ? 'Nenhum cliente cadastrado.' : 'Nenhum resultado para os filtros aplicados.')}</p></div>`;
      } else {
        els.clientesList.innerHTML = pag.items.map(c => {
          const st = getStatus(c);
          const planoCad = encontrarPlanoPorNome(c.plano);
          const painelId = planoCad && planoCad.painelId ? planoCad.painelId : paineis[0].id;
          const painelCls = getPainelIdxClass(painelId);
          const painelNome = getPainelNome(painelId);
          return `
            <div class="client-row client-row-clickable" data-testid="cliente-row-${c.id}" onclick="abrirDetalheCliente('${c.id}')" role="button" tabindex="0">
              <div class="client-row-main">
                <div class="client-row-name">
                  ${escapeHtml(c.nome || '—')}
                  <span class="pill ${st.cls}">${escapeHtml(st.label)}</span>
                  <span class="painel-badge ${painelCls}" title="Painel (uso interno)" data-testid="cliente-painel-${c.id}"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span>
                </div>
                <div class="client-row-meta">
                  <span><b>Tel:</b> ${escapeHtml(c.telefone || '—')}</span>
                  <span><b>App:</b> ${escapeHtml(c.aplicativo || '—')}</span>
                  <span><b>User:</b> ${escapeHtml(c.usuario || '—')}</span>
                  <span><b>Plano:</b> ${escapeHtml(c.plano || '—')}</span>
                  <span><b>Valor:</b> ${escapeHtml(c.valor || '—')}</span>
                  <span><b>Início:</b> ${escapeHtml(formatDate(c.dataInicio || c.dataPagamento))}</span>
                  <span><b>Renovação:</b> ${escapeHtml(formatDate(c.dataRenovacao))}</span>
                </div>
              </div>
              <div class="client-row-chevron"><i class="fas fa-chevron-right"></i></div>
            </div>`;
        }).join('');
      }
      renderPagination(els.paginationClientes, pag.safePage, pag.totalPages, 'changeClientesPage');
    }

    /* === Detalhe do cliente (abre ao clicar na linha da lista) === */
    function abrirDetalheCliente(id) {
      const c = clients.find(x => x.id === id);
      if (!c) return;
      const modal = document.getElementById('modalDetalheCliente');
      const body = document.getElementById('detalheClienteBody');
      const title = document.getElementById('modalDetalheClienteTitle');
      if (!modal || !body) return;
      const st = getStatus(c);
      const planoCad = encontrarPlanoPorNome(c.plano);
      const painelId = planoCad && planoCad.painelId ? planoCad.painelId : (paineis[0] ? paineis[0].id : '');
      const painelNome = getPainelNome(painelId);
      if (title) title.textContent = c.nome || 'Cliente';

      const infoRows = [
        ['Nome', c.nome], ['Telefone', c.telefone], ['Aplicativo', c.aplicativo],
        ['Usuário', c.usuario], ['Senha', c.senha], ['Plano', c.plano],
        ['Valor', c.valor], ['Painel', painelNome],
        ['Início', formatDate(c.dataInicio || c.dataPagamento)],
        ['Renovação', formatDate(c.dataRenovacao)],
        ['Link de renovação', c.linkRenovacao], ['Observações', c.observacoes]
      ];

      const bloqueioHtml = c.bloqueado
        ? `<div class="detalhe-bloqueio-aviso"><i class="fas fa-ban"></i> <b>Cliente bloqueado</b>${c.motivoBloqueio ? `: ${escapeHtml(c.motivoBloqueio)}` : ' (sem motivo informado)'}</div>`
        : '';

      body.innerHTML = `
        <div class="detalhe-cliente-header">
          <span class="pill ${st.cls}">${escapeHtml(st.label)}</span>
          <span class="painel-badge ${getPainelIdxClass(painelId)}"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span>
        </div>
        ${bloqueioHtml}
        <div class="detalhe-cliente-grid">
          ${infoRows.map(([label, value]) => `
            <div class="detalhe-cliente-field">
              <span class="detalhe-cliente-label">${escapeHtml(label)}</span>
              <span class="detalhe-cliente-value">${escapeHtml(value || '—')}</span>
            </div>`).join('')}
        </div>
        <div class="detalhe-cliente-actions">
          ${c.pagamentoPendente
            ? `<button class="btn-pending" onclick="abrirModalConfirmarPagamento('${c.id}')" data-testid="detalhe-confirmar-pag-${c.id}"><i class="fas fa-check-circle"></i> Confirmar Pagamento</button>`
            : `<button class="btn-primary" onclick="renewClient('${c.id}')" data-testid="detalhe-renovar-${c.id}">Renovar</button>`}
          <div class="whats-dropdown">
            <button class="btn-whatsapp" onclick="toggleWhatsDropdown('${c.id}')" data-testid="detalhe-whats-${c.id}"><i class="fab fa-whatsapp"></i> WhatsApp <i class="fas fa-chevron-down" style="font-size:10px; margin-left:2px;"></i></button>
            <div class="whats-dropdown-menu" id="whatsDropdownMenu-${c.id}">
              <button type="button" onclick="enviarWhatsRenovacao('${c.id}')" data-testid="detalhe-whats-renovacao-${c.id}"><i class="fas fa-rotate"></i> Renovação</button>
              <button type="button" onclick="enviarWhatsApp_App('${c.id}')" data-testid="detalhe-whats-app-${c.id}"><i class="fas fa-mobile-alt"></i> APP</button>
            </div>
          </div>
          ${c.bloqueado
            ? `<button class="btn-secondary" onclick="desbloquearCliente('${c.id}')" data-testid="detalhe-desbloquear-${c.id}"><i class="fas fa-lock-open"></i> Desbloquear</button>`
            : `<button class="btn-danger" onclick="abrirModalBloquearCliente('${c.id}')" data-testid="detalhe-bloquear-${c.id}"><i class="fas fa-ban"></i> Bloquear cliente</button>`}
          <button class="btn-info" onclick="editClient('${c.id}')" data-testid="detalhe-editar-${c.id}">Editar</button>
          <button class="btn-danger" onclick="deleteClient('${c.id}')" data-testid="detalhe-apagar-${c.id}">Apagar</button>
        </div>`;
      modal.classList.add('active');
    }
    function fecharModalDetalheCliente() {
      const modal = document.getElementById('modalDetalheCliente');
      if (modal) modal.classList.remove('active');
    }
    function toggleWhatsDropdown(id) {
      const menu = document.getElementById(`whatsDropdownMenu-${id}`);
      if (!menu) return;
      const isOpen = menu.classList.contains('open');
      document.querySelectorAll('.whats-dropdown-menu.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) menu.classList.add('open');
    }
    function fecharWhatsDropdown(id) {
      const menu = document.getElementById(`whatsDropdownMenu-${id}`);
      if (menu) menu.classList.remove('open');
    }
    function enviarWhatsRenovacao(id) {
      fecharWhatsDropdown(id);
      openWhatsApp(id);
    }
    function enviarWhatsApp_App(id) {
      fecharWhatsDropdown(id);
      abrirModalMensagemAplicativo(id, 'cliente');
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.whats-dropdown')) {
        document.querySelectorAll('.whats-dropdown-menu.open').forEach(el => el.classList.remove('open'));
      }
    });
    window.abrirDetalheCliente = abrirDetalheCliente;
    window.fecharModalDetalheCliente = fecharModalDetalheCliente;
    window.toggleWhatsDropdown = toggleWhatsDropdown;
    window.fecharWhatsDropdown = fecharWhatsDropdown;
    window.enviarWhatsRenovacao = enviarWhatsRenovacao;
    window.enviarWhatsApp_App = enviarWhatsApp_App;

    /* === Bloqueio de cliente === */
    let bloqueioClienteAtualId = null;
    function abrirModalBloquearCliente(id) {
      const c = clients.find(x => x.id === id);
      if (!c) return;
      bloqueioClienteAtualId = id;
      const nomeEl = document.getElementById('bcClienteNome');
      const motivoEl = document.getElementById('bc_motivo');
      if (nomeEl) nomeEl.textContent = c.nome || '—';
      if (motivoEl) motivoEl.value = '';
      const modal = document.getElementById('modalBloquearCliente');
      if (modal) modal.classList.add('active');
    }
    function fecharModalBloquearCliente() {
      const modal = document.getElementById('modalBloquearCliente');
      if (modal) modal.classList.remove('active');
      bloqueioClienteAtualId = null;
    }
    function confirmarBloqueioCliente() {
      if (!bloqueioClienteAtualId) return;
      const c = clients.find(x => x.id === bloqueioClienteAtualId);
      if (!c) { fecharModalBloquearCliente(); return; }
      const motivo = (document.getElementById('bc_motivo').value || '').trim();
      c.bloqueado = true;
      c.motivoBloqueio = motivo;
      c.bloqueadoEm = new Date().toISOString();
      c.updatedAt = new Date().toISOString();
      renderAll();
      fecharModalBloquearCliente();
      fecharModalDetalheCliente();
      showToast(`${c.nome} foi bloqueado${motivo ? ` • Motivo: ${motivo}` : ''}.`);
    }
    function desbloquearCliente(id) {
      const c = clients.find(x => x.id === id);
      if (!c) return;
      if (!confirmar(`Desbloquear ${c.nome}?`)) return;
      c.bloqueado = false;
      c.motivoBloqueio = '';
      c.updatedAt = new Date().toISOString();
      renderAll();
      fecharModalDetalheCliente();
      showToast(`${c.nome} foi desbloqueado.`);
    }
    window.abrirModalBloquearCliente = abrirModalBloquearCliente;
    window.fecharModalBloquearCliente = fecharModalBloquearCliente;
    window.confirmarBloqueioCliente = confirmarBloqueioCliente;
    window.desbloquearCliente = desbloquearCliente;

    window.changeTodayPage = p => { state.todayPage = p; renderDashboard(); };
    window.changeTomorrowPage = p => { state.tomorrowPage = p; renderDashboard(); };
    window.changeWeekPage = p => { state.weekPage = p; renderDashboard(); };
    window.changeExpiredPage = p => { state.expiredPage = p; renderDashboard(); };
    window.changePendingPaymentsPage = p => { state.pendingPaymentsPage = p; renderDashboard(); };
    window.changeClientesPage = p => { state.clientesPage = p; renderClientes(); };
    window.changeTestesPage = p => { state.testesPage = p; renderTestes(); };
    window.changeHistoricoPage = p => { state.historicoPage = p; atualizarHistorico(); };

    /* ---------- TESTES IPTV ---------- */

function buildTesteMessage(t) {
  const link = (t.linkRenovacao || '').trim();
  return renderMessageTemplate('teste_criado', {
    nome: t.nome || '',
    usuario: t.usuario || '',
    senha: t.senha || '',
    link_renovacao: link || '[informe o link de ativação no cadastro]',
    duracao_teste: (t.duracaoTeste && t.duracaoTeste.trim()) || '3 Horas de Teste Grátis!'
  });
}

function buildAtivacaoMessage(client) {
  return renderMessageTemplate('ativacao', {
    nome: client.nome || '',
    usuario: client.usuario || '',
    senha: client.senha || '',
    data_renovacao: formatDate(client.dataRenovacao)
  });
}

function buildIndicacaoMesGratisMessage(ind, indicador, amigoNome) {
  return renderMessageTemplate('indicacao_mes_gratis', {
    indicador_nome: (indicador && indicador.nome) || ind.indicadorNome || '',
    amigo_nome: amigoNome || ind.amigoNome || '',
    numero: ind.numero || ''
  });
}

let ativacaoClienteAtual = null;
    let ativacaoIndicacaoContext = null; // { ind, indicador } quando a ativação veio de uma indicação
    function abrirModalMensagemAtivacao(client, indContext) {
      ativacaoClienteAtual = client;
      const box = document.getElementById('ativacaoMsgBox');
      if (box) box.textContent = buildAtivacaoMessage(client);

      const wrap = document.getElementById('ativacaoIndicadorMsgWrap');
      const boxInd = document.getElementById('ativacaoIndicadorMsgBox');
      if (indContext && indContext.indicador) {
        ativacaoIndicacaoContext = indContext;
        if (boxInd) boxInd.textContent = buildIndicacaoMesGratisMessage(indContext.ind, indContext.indicador, client.nome);
        if (wrap) wrap.style.display = '';
      } else {
        ativacaoIndicacaoContext = null;
        if (wrap) wrap.style.display = 'none';
      }
      document.getElementById('modalMensagemAtivacao').classList.add('active');
    }
    function fecharModalMensagemAtivacao() {
      document.getElementById('modalMensagemAtivacao').classList.remove('active');
      ativacaoClienteAtual = null;
      ativacaoIndicacaoContext = null;
    }
    function copiarMensagemAtivacao() {
      if (!ativacaoClienteAtual) return;
      const msg = buildAtivacaoMessage(ativacaoClienteAtual);
      const name = ativacaoClienteAtual.nome || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(msg, name));
      } else fallbackCopy(msg, name);
    }
    function enviarMensagemAtivacaoWhatsApp() {
      if (!ativacaoClienteAtual) return;
      const c = ativacaoClienteAtual;
      const phone = String(c.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildAtivacaoMessage(c));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    function copiarMensagemIndicador() {
      if (!ativacaoIndicacaoContext) return;
      const { ind, indicador } = ativacaoIndicacaoContext;
      const msg = buildIndicacaoMesGratisMessage(ind, indicador, ativacaoClienteAtual ? ativacaoClienteAtual.nome : '');
      const name = indicador.nome || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(msg, name));
      } else fallbackCopy(msg, name);
    }
    function enviarMensagemIndicadorWhatsApp() {
      if (!ativacaoIndicacaoContext) return;
      const { ind, indicador } = ativacaoIndicacaoContext;
      const phone = String(indicador.telefone || ind.indicadorTelefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildIndicacaoMesGratisMessage(ind, indicador, ativacaoClienteAtual ? ativacaoClienteAtual.nome : ''));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    window.fecharModalMensagemAtivacao = fecharModalMensagemAtivacao;
    window.copiarMensagemAtivacao = copiarMensagemAtivacao;
    window.enviarMensagemAtivacaoWhatsApp = enviarMensagemAtivacaoWhatsApp;
    window.copiarMensagemIndicador = copiarMensagemIndicador;
    window.enviarMensagemIndicadorWhatsApp = enviarMensagemIndicadorWhatsApp;

    function extrairHorasDuracaoTeste(duracaoTeste) {
      if (!duracaoTeste) return 3;
      const m = String(duracaoTeste).match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 3;
    }
    function formatarContagemRegressiva(ms) {
      if (ms <= 0) return { texto: 'Teste finalizado', encerrado: true };
      const totalSeg = Math.floor(ms / 1000);
      const h = Math.floor(totalSeg / 3600);
      const m = Math.floor((totalSeg % 3600) / 60);
      const s = totalSeg % 60;
      const pad = n => String(n).padStart(2, '0');
      return { texto: `Encerra em ${pad(h)}:${pad(m)}:${pad(s)}`, encerrado: false };
    }
    function atualizarContadoresTestes() {
      document.querySelectorAll('.teste-countdown[data-end]').forEach(el => {
        const end = parseInt(el.getAttribute('data-end'), 10);
        if (!Number.isFinite(end)) return;
        const { texto, encerrado } = formatarContagemRegressiva(end - Date.now());
        el.textContent = texto;
        el.classList.toggle('teste-countdown-ended', encerrado);
      });
    }
    setInterval(atualizarContadoresTestes, 1000);

    function renderTestes() {
      const cont = document.getElementById('listaTestes');
      const cnt = document.getElementById('countTestes');
      const pagEl = document.getElementById('paginationTestes');
      if (cnt) cnt.textContent = testes.length;
      if (!cont) return;
      if (testes.length === 0) { cont.innerHTML = `<div class="empty-state"><i class="fas fa-flask"></i><p>Nenhum teste cadastrado ainda.</p></div>`; if (pagEl) pagEl.innerHTML = ''; return; }
      const ordenados = testes.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const pag = paginate(ordenados, state.testesPage); state.testesPage = pag.safePage;
      cont.innerHTML = pag.items.map(t => {
        const data = t.createdAt ? formatDateTimeSaoPaulo(t.createdAt) : '—';
        const linhaInfo = [
          t.plano ? `📦 ${escapeHtml(t.plano)}` : '',
          t.valor ? `💰 R$ ${escapeHtml(t.valor)}` : '',
          t.aplicativo ? `📱 ${escapeHtml(t.aplicativo)}` : ''
        ].filter(Boolean).join(' • ');
        const horasTeste = extrairHorasDuracaoTeste(t.duracaoTeste);
        const fimTeste = t.createdAt ? (new Date(t.createdAt).getTime() + horasTeste * 3600000) : null;
        const contagemHtml = fimTeste
          ? `<div class="list-item-sub teste-countdown" data-end="${fimTeste}" data-testid="teste-countdown-${t.id}">calculando…</div>`
          : '';
        return `
          <div class="list-item" style="flex-wrap:wrap; gap:10px;" data-testid="teste-item-${t.id}">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: var(--warning);"><i class="fas fa-flask"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${escapeHtml(t.nome || '—')} ${t.telefone ? `• <span style="font-family:var(--font-mono); color:var(--muted); font-size:12.5px;">${escapeHtml(t.telefone)}</span>` : ''}</div>
                <div class="list-item-sub">${linhaInfo || '—'}</div>
                <div class="list-item-sub" style="opacity:.7;">Cadastrado em ${data} • Duração: ${escapeHtml(t.duracaoTeste || '3 Horas')}</div>
                ${contagemHtml}
              </div>
            </div>
            <div class="client-row-actions" style="width:auto;">
              <button class="btn-whatsapp" onclick="whatsAppTeste('${t.id}')" data-testid="btn-whatsapp-teste-${t.id}"><i class="fab fa-whatsapp"></i> WhatsApp</button>
              <button class="btn-secondary" onclick="abrirModalMensagemAplicativo('${t.id}','teste')" title="Enviar instruções do aplicativo" data-testid="btn-app-teste-${t.id}"><i class="fas fa-mobile-alt"></i> App</button>
              <button class="btn-info" onclick="editClient('${t.id}')" data-testid="btn-editar-teste-${t.id}"><i class="fas fa-pen"></i> Editar</button>
              <button class="btn-primary" onclick="ativarTeste('${t.id}')" data-testid="btn-ativar-teste-${t.id}"><i class="fas fa-bolt"></i> Ativar</button>
              <button class="btn-danger" onclick="excluirTeste('${t.id}')" data-testid="btn-excluir-teste-${t.id}"><i class="fas fa-trash"></i> Excluir</button>
            </div>
          </div>`;
      }).join('');
      renderPagination(pagEl, pag.safePage, pag.totalPages, 'changeTestesPage');
      atualizarContadoresTestes();
    }

    const APLICATIVO_MSG_TESTE_PADRAO = [
      '📲 Olá *{{nome}}*, seguem as instruções para instalar o aplicativo do seu teste!',
      '',
      '📁 *Aplicativo*: {{aplicativo}}',
      '🗂️ *Plataforma*: {{plataforma}}',
      '🗃️ *Sistema*: {{sistema}}',
      '',
      '1️⃣ Baixe e instale o aplicativo.',
      '2️⃣ Abra o app e faça login com os dados abaixo.',
      '3️⃣ Pronto! É só aproveitar sua programação. 🎬',
      '',
      '⬇️ *Link de download*: {{link_download}}',
      '',
      '👤 *Usuário*: {{usuario}}',
      '🔑 *Senha*: {{senha}}',
      '⏰ *Duração do teste*: {{duracao_teste}}',
      '',
      '⏳ Aproveite seu teste grátis e qualquer dúvida, estou à disposição!'
    ].join('\n');
    const APLICATIVO_MSG_CLIENTE_PADRAO = [
      '📲 Olá *{{nome}}*, seguem as instruções para instalar o aplicativo!',
      '',
      '📁 *Aplicativo*: {{aplicativo}}',
      '🗂️ *Plataforma*: {{plataforma}}',
      '🗃️ *Sistema*: {{sistema}}',
      '',
      '1️⃣ Baixe e instale o aplicativo.',
      '2️⃣ Abra o app e faça login com os dados abaixo.',
      '3️⃣ Pronto! É só aproveitar sua programação. 🎬',
      '',
      '⬇️ *Link de download*: {{link_download}}',
      '',
      '👤 *Usuário*: {{usuario}}',
      '🔑 *Senha*: {{senha}}',
      '📦 *Plano*: {{plano}}',
      '',
      '🙏 Qualquer dúvida, estou à disposição!'
    ].join('\n');
    function renderTemplateString(template, data) {
      return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token) => {
        const value = data && Object.prototype.hasOwnProperty.call(data, token) ? data[token] : '';
        return value == null ? '' : String(value);
      });
    }
    const APLICATIVO_MSG_VARIAVEIS = ['nome', 'aplicativo', 'plataforma', 'sistema', 'link_download', 'usuario', 'senha', 'duracao_teste', 'plano', 'link_pagamento'];
    function renderAplicativoMsgVars() {
      [['apMsgTesteVars', 'apMsgTeste', 'teste'], ['apMsgClienteVars', 'apMsgCliente', 'cliente']].forEach(([wrapId, textareaId, origem]) => {
        const el = document.getElementById(wrapId);
        if (!el || el.dataset.loaded) return;
        el.innerHTML = APLICATIVO_MSG_VARIAVEIS.map(v =>
          `<button type="button" class="var-chip" onclick="insertVariavelAplicativo('${v}','${textareaId}','${origem}')" title="Clique para inserir">{{${v}}}</button>`
        ).join('');
        el.dataset.loaded = '1';
      });
    }
    function insertVariavelAplicativo(varName, textareaId, origem) {
      const editor = document.getElementById(textareaId);
      if (!editor) return;
      const token = `{{${varName}}}`;
      const start = editor.selectionStart ?? editor.value.length;
      const end = editor.selectionEnd ?? editor.value.length;
      editor.value = editor.value.slice(0, start) + token + editor.value.slice(end);
      const newPos = start + token.length;
      editor.focus();
      editor.setSelectionRange(newPos, newPos);
      atualizarPreviewMsgAplicativoCadastro(origem);
    }
    window.insertVariavelAplicativo = insertVariavelAplicativo;
    function amostraVariaveisAplicativoCadastro(origem) {
      const row = document.querySelector('#apPlataformasList .ap-plataforma-row');
      const dispositivos = row ? Array.from(row.querySelectorAll('.ap-plat-dispositivo:checked')).map(el => el.value) : [];
      const sistemas = row ? Array.from(row.querySelectorAll('.ap-plat-sistema:checked')).map(el => el.value) : [];
      const linkDownload = row ? row.querySelector('.ap-plat-link').value.trim() : '';
      const nomeApp = (document.getElementById('apNome').value || '').trim();
      return {
        nome: origem === 'teste' ? 'Teste Exemplo' : 'Cliente Exemplo',
        aplicativo: nomeApp || 'Nome do Aplicativo',
        plataforma: labelDispositivos(dispositivos) || 'Celular, Tablet',
        sistema: labelSistemas(sistemas) || 'Android, iOS',
        link_download: linkDownload || 'https://exemplo.com/download',
        usuario: origem === 'teste' ? 'teste_demo' : 'usuario_teste',
        senha: origem === 'teste' ? '654321' : '123456',
        duracao_teste: '3 Horas de Teste Grátis!',
        plano: 'Plano Premium',
        link_pagamento: 'https://pagamento.exemplo/renovar'
      };
    }
    function atualizarPreviewMsgAplicativoCadastro(origem) {
      const textareaId = origem === 'teste' ? 'apMsgTeste' : 'apMsgCliente';
      const previewId = origem === 'teste' ? 'apMsgTestePreview' : 'apMsgClientePreview';
      const editor = document.getElementById(textareaId);
      const preview = document.getElementById(previewId);
      if (!editor || !preview) return;
      preview.textContent = renderTemplateString(editor.value, amostraVariaveisAplicativoCadastro(origem));
    }
    window.atualizarPreviewMsgAplicativoCadastro = atualizarPreviewMsgAplicativoCadastro;
    function buildAplicativoMessage(entity, app, plataforma, origem) {
  const template = origem === 'teste'
    ? ((app && app.msgTeste) || APLICATIVO_MSG_TESTE_PADRAO)
    : ((app && app.msgCliente) || APLICATIVO_MSG_CLIENTE_PADRAO);
  return renderTemplateString(template, {
    nome: entity.nome || '',
    aplicativo: (app && app.nome) || entity.aplicativo || '',
    plataforma: labelDispositivos(plataforma && plataforma.dispositivos) || '',
    sistema: labelSistemas(plataforma && plataforma.sistemas) || '',
    link_download: (plataforma && plataforma.link) || '',
    usuario: entity.usuario || '',
    senha: entity.senha || '',
    plano: entity.plano || '',
    duracao_teste: (entity.duracaoTeste && entity.duracaoTeste.trim()) || '3 Horas de Teste Grátis!',
    link_pagamento: entity.linkRenovacao || ''
  });
}

let aplicativoMsgContext = null;

function encontrarAplicativoDaEntidade(entity) {
  if (!entity) return null;
  if (entity.aplicativoId) {
    const porId = aplicativos.find(a => a.id === entity.aplicativoId);
    if (porId) return porId;
  }
  if (entity.aplicativo) {
    const nome = String(entity.aplicativo).trim().toLowerCase();
    return aplicativos.find(a => String(a.nome).trim().toLowerCase() === nome) || null;
  }
  return null;
}

function abrirModalMensagemAplicativo(id, origem) {
  const entity = origem === 'teste' ? testes.find(x => x.id === id) : clients.find(x => x.id === id);
  if (!entity) return;
  const app = encontrarAplicativoDaEntidade(entity);
  if (!app) { showToast('Nenhum aplicativo cadastrado para este registro. Selecione um aplicativo ou cadastre um na aba Aplicativos.', true); return; }
  if (!app.plataformas || app.plataformas.length === 0) { showToast('Cadastre ao menos uma plataforma de instalação para "' + app.nome + '" na aba Aplicativos.', true); return; }
  aplicativoMsgContext = { entity, origem, app };
  const tituloEl = document.getElementById('modalMensagemAplicativoTitle');
  if (tituloEl) tituloEl.innerHTML = `<i class="fas fa-mobile-alt" style="color: var(--primary); margin-right: 6px;"></i> ${origem === 'teste' ? 'Instalação / Teste' : 'Instalação / Cliente'}`;
  const sel = document.getElementById('amPlataformaSelect');
  sel.innerHTML = app.plataformas.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(labelDispositivos(p.dispositivos))} — ${escapeHtml(labelSistemas(p.sistemas))}</option>`).join('');
  const wrap = document.getElementById('amPlataformaWrap');
  if (wrap) wrap.style.display = app.plataformas.length > 1 ? '' : 'none';
  atualizarPreviewMensagemAplicativo();
  document.getElementById('modalMensagemAplicativo').classList.add('active');
}
function fecharModalMensagemAplicativo() {
  document.getElementById('modalMensagemAplicativo').classList.remove('active');
  aplicativoMsgContext = null;
}
function atualizarPreviewMensagemAplicativo() {
  if (!aplicativoMsgContext) return;
  const { entity, app, origem } = aplicativoMsgContext;
  const sel = document.getElementById('amPlataformaSelect');
  const plataforma = app.plataformas.find(p => p.id === sel.value) || app.plataformas[0];
  const box = document.getElementById('amMsgBox');
  if (box) box.textContent = buildAplicativoMessage(entity, app, plataforma, origem);
}
function enviarAplicativoWhatsApp() {
  if (!aplicativoMsgContext) return;
  const { entity } = aplicativoMsgContext;
  const phone = String(entity.telefone || '').replace(/\D/g, '');
  const text = encodeURIComponent(document.getElementById('amMsgBox').textContent || '');
  const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if (!phone) showToast('Sem telefone cadastrado. Adicione um telefone válido para enviar a mensagem.', true);
}
function copiarMensagemAplicativo() {
  if (!aplicativoMsgContext) return;
  const msg = document.getElementById('amMsgBox').textContent || '';
  const name = aplicativoMsgContext.entity.nome || '';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(msg, name));
  } else fallbackCopy(msg, name);
}
window.abrirModalMensagemAplicativo = abrirModalMensagemAplicativo;
window.fecharModalMensagemAplicativo = fecharModalMensagemAplicativo;
window.atualizarPreviewMensagemAplicativo = atualizarPreviewMensagemAplicativo;
window.enviarAplicativoWhatsApp = enviarAplicativoWhatsApp;
window.copiarMensagemAplicativo = copiarMensagemAplicativo;

function whatsAppTeste(id) {
      const t = testes.find(x => x.id === id); if (!t) return;
      const phone = String(t.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildTesteMessage(t));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    function ativarTeste(id) {
      const idx = testes.findIndex(x => x.id === id); if (idx < 0) return;
      const t = testes[idx];
      const planoCad = encontrarPlanoPorNome(t.plano);
      const dias = planoCad ? planoCad.dias : 30;
      const creditosUsar = resolverCreditosCliente(t);
      const hoje = todayLocalDate();
      const novoCliente = {
        id: generateId(), nome: t.nome, telefone: t.telefone, aplicativoId: t.aplicativoId || '', aplicativo: t.aplicativo,
        usuario: t.usuario, senha: t.senha, plano: t.plano, valor: t.valor,
        creditos: creditosUsar,
        dataInicio: toInputDate(hoje), dataPagamento: toInputDate(hoje),
        dataRenovacao: toInputDate(addPlanPeriod(hoje, dias)),
        linkRenovacao: t.linkRenovacao, observacoes: t.observacoes,
        msgSentAt: null, updatedAt: new Date().toISOString()
      };
      clients.push(novoCliente);
      const valorVenda = parseValor(t.valor);
      const taxa = calcularTaxaPlano(planoCad, valorVenda);
      const painelId = (planoCad && planoCad.painelId) ? planoCad.painelId : paineis[0].id;
      movimentacoes.push({
        data: new Date().toISOString(), tipo: 'use', tipoCliente: 'novo',
        valor: valorVenda, quantidade: creditosUsar, taxa: taxa,
        planoNome: t.plano || '', clientId: novoCliente.id, clientNome: novoCliente.nome,
        painelId
      });
      testes.splice(idx, 1);
      salvarTestes(); salvarMovimentacoes();

      // Se este teste veio de uma indicação (aba Sorteio) ainda ativa na roleta, conclui automaticamente:
      // marca a indicação como assinada, tira o número da roleta, dá +30 dias ao indicador e desconta
      // o crédito do bônus do painel ATUAL do próprio indicador (não do painel do amigo).
      let indContext = null;
      const indLinked = indicacoes.find(i => i.testeId === id && i.status === 'teste');
      let bonusMsg = '';
      if (indLinked) {
        indLinked.status = 'assinou';
        indLinked.assinouEm = new Date().toISOString();
        indLinked.amigoClientId = novoCliente.id;
        indLinked.updatedAt = new Date().toISOString();
        salvarIndicacoes();
        const bonus = concederMesGratisIndicador(indLinked);
        if (bonus) {
          indContext = { ind: indLinked, indicador: bonus.indicador };
          bonusMsg = ` • Indicação: +30 dias para ${bonus.indicador.nome} • -${bonus.creditosBonus} crédito${bonus.creditosBonus === 1 ? '' : 's'} (${getPainelNome(bonus.painelIdBonus)})`;
        } else {
          bonusMsg = ` • Indicação: número ${indLinked.numero} convertido, mas o indicador (${indLinked.indicadorNome}) não foi encontrado como cliente`;
        }
        renderIndicacoes();
      }

      renderAll(); renderTestes();
      atualizarCreditos(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      switchTab('clientes');
      showToast(`${novoCliente.nome} ativado • -${creditosUsar} crédito${creditosUsar === 1 ? '' : 's'} • Vence em ${formatDate(novoCliente.dataRenovacao)}${taxa > 0 ? ` • Taxa: R$ ${taxa.toFixed(2)}` : ''}${bonusMsg}`);
      abrirModalMensagemAtivacao(novoCliente, indContext);
    }

    function excluirTeste(id) {
      const idx = testes.findIndex(x => x.id === id); if (idx < 0) return;
      const t = testes[idx];
      if (!confirmar(`Excluir teste de ${t.nome}?`)) return;
      testes.splice(idx, 1); salvarTestes();
      movimentacoes.push({ data: new Date().toISOString(), tipo: 'teste_excluido', tipoCliente: 'teste_excluido', quantidade: 1, nome: t.nome });
      salvarMovimentacoes();
      renderTestes(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      showToast('Teste excluído.');
    }

    window.whatsAppTeste = whatsAppTeste; window.ativarTeste = ativarTeste; window.excluirTeste = excluirTeste;

    function renderAll() { saveClients(); renderDashboard(); renderClientes(); if (typeof popularSelectClientesDiasExtras === 'function') popularSelectClientesDiasExtras(); }

    function resetForm() {
      els.clientForm.reset();
      els.clientId.value = '';
      els.formTitle.textContent = 'Cadastrar Teste IPTV';
      atualizarInfoAplicativoSelecionado('aplicativo');
      esconderFormTeste();
    }
    function mostrarFormTeste() {
      if (els.clientForm) els.clientForm.classList.remove('hidden');
      if (els.criarTesteBtnWrap) els.criarTesteBtnWrap.classList.add('hidden');
      if (els.nome) els.nome.focus();
    }
    function esconderFormTeste() {
      if (els.clientForm) els.clientForm.classList.add('hidden');
      if (els.criarTesteBtnWrap) els.criarTesteBtnWrap.classList.remove('hidden');
    }
    function getFormData() {
      const sel = els.plano;
      const planoNome = sel && sel.tagName === 'SELECT' ? getPlanoNomeDoSelect(sel) : (sel ? sel.value.trim() : '');
      const planoCad = encontrarPlanoPorNome(planoNome);
      const creditosVal = els.creditos && els.creditos.value !== ''
        ? Math.max(0, parseInt(els.creditos.value) || 0)
        : (planoCad && Number.isFinite(parseInt(planoCad.creditos)) ? parseInt(planoCad.creditos) : 1);
      const aplicativoId = els.aplicativo ? els.aplicativo.value : '';
      const aplicativoCad = encontrarAplicativoPorId(aplicativoId);
      return {
        id: els.clientId.value || generateId(),
        nome: els.nome.value.trim(), telefone: els.telefone.value.trim(),
        aplicativoId: aplicativoId || '', aplicativo: aplicativoCad ? aplicativoCad.nome : '',
        usuario: els.usuario.value.trim(),
        senha: els.senha.value.trim(), plano: planoNome,
        duracaoTeste: els.duracaoTeste ? els.duracaoTeste.value.trim() : '',
        valor: els.valor.value.trim(), creditos: creditosVal,
        linkRenovacao: els.linkRenovacao.value.trim(),
        observacoes: els.observacoes.value.trim(),
        createdAt: new Date().toISOString()
      };
    }

    /* ---------- EDIT CLIENT ---------- */
    let editKind = null;
    function abrirModalEditarCliente() { document.getElementById('modalEditarCliente').classList.add('active'); }
    function fecharModalEditarCliente() { document.getElementById('modalEditarCliente').classList.remove('active'); editKind = null; }
    window.fecharModalEditarCliente = fecharModalEditarCliente;

    function editClient(id) {
      const c = clients.find(x => x.id === id); const t = testes.find(x => x.id === id);
      const target = c || t; if (!target) return;
      if (typeof fecharModalDetalheCliente === 'function') fecharModalDetalheCliente();
      editKind = c ? 'client' : 'teste';
      document.getElementById('ec_kind').value = editKind;
      document.getElementById('ec_id').value = target.id;
      document.getElementById('ec_nome').value = target.nome || '';
      document.getElementById('ec_telefone').value = target.telefone || '';
      selecionarAplicativoPorId(document.getElementById('ec_aplicativo'), target.aplicativoId || '');
      document.getElementById('ec_usuario').value = target.usuario || '';
      document.getElementById('ec_senha').value = target.senha || '';
      const ecPlanoSel = document.getElementById('ec_plano');
      selecionarPlanoPorNome(ecPlanoSel, target.plano);
      document.getElementById('ec_valor').value = target.valor || '';
      const creditosFallback = (encontrarPlanoPorNome(target.plano) || {}).creditos;
      document.getElementById('ec_creditos').value = Number.isFinite(parseInt(target.creditos)) ? target.creditos : (Number.isFinite(parseInt(creditosFallback)) ? creditosFallback : 1);
      document.getElementById('ec_linkRenovacao').value = target.linkRenovacao || '';
      document.getElementById('ec_observacoes').value = target.observacoes || '';
      const inicioWrap = document.getElementById('ec_inicio_wrap');
      const renovWrap = document.getElementById('ec_renovacao_wrap');
      const duracaoTesteWrap = document.getElementById('ec_duracaoTeste_wrap');
      document.getElementById('ec_duracaoTeste').value = target.duracaoTeste || '';
      if (duracaoTesteWrap) duracaoTesteWrap.style.display = editKind === 'teste' ? '' : 'none';
      if (editKind === 'client') {
        inicioWrap.style.display = ''; renovWrap.style.display = '';
        document.getElementById('ec_dataInicio').value = target.dataInicio || target.dataPagamento || '';
        document.getElementById('ec_dataRenovacao').value = target.dataRenovacao || '';
        document.getElementById('modalEditarClienteTitle').textContent = `Editar Cliente • ${target.nome || ''}`;
      } else {
        inicioWrap.style.display = 'none'; renovWrap.style.display = 'none';
        document.getElementById('ec_dataInicio').value = ''; document.getElementById('ec_dataRenovacao').value = '';
        document.getElementById('modalEditarClienteTitle').textContent = `Editar Teste • ${target.nome || ''}`;
      }
      abrirModalEditarCliente();
    }
    window.editClient = editClient;

    (function wireEcDateSync() {
      const inicio = document.getElementById('ec_dataInicio');
      const renov = document.getElementById('ec_dataRenovacao');
      const btn = document.getElementById('ec_btnPlus30');
      const planoSel = document.getElementById('ec_plano');
      if (!inicio || !renov) return;
      const recalc = () => {
        const d = parseDate(inicio.value); if (!d) return;
        const planoCad = planoPorIdSelect(planoSel);
        const dias = planoCad ? planoCad.dias : 30;
        renov.value = toInputDate(addPlanPeriod(d, dias));
      };
      inicio.addEventListener('change', recalc);
      if (btn) btn.addEventListener('click', recalc);
    })();

    document.getElementById('formEditarCliente').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('ec_id').value;
      const kind = document.getElementById('ec_kind').value;
      const ecPlanoSel = document.getElementById('ec_plano');
      const planoNome = ecPlanoSel && ecPlanoSel.tagName === 'SELECT' ? getPlanoNomeDoSelect(ecPlanoSel) : (ecPlanoSel ? ecPlanoSel.value.trim() : '');
      const ecCredVal = document.getElementById('ec_creditos').value;
      const planoCad = encontrarPlanoPorNome(planoNome);
      const creditosFinal = ecCredVal !== '' ? Math.max(0, parseInt(ecCredVal) || 0) : (planoCad && Number.isFinite(parseInt(planoCad.creditos)) ? parseInt(planoCad.creditos) : 1);
      const ecAplicativoId = document.getElementById('ec_aplicativo').value;
      const ecAplicativoCad = encontrarAplicativoPorId(ecAplicativoId);
      const base = {
        nome: document.getElementById('ec_nome').value.trim(),
        telefone: document.getElementById('ec_telefone').value.trim(),
        aplicativoId: ecAplicativoId || '', aplicativo: ecAplicativoCad ? ecAplicativoCad.nome : '',
        usuario: document.getElementById('ec_usuario').value.trim(),
        senha: document.getElementById('ec_senha').value.trim(),
        plano: planoNome, valor: document.getElementById('ec_valor').value.trim(),
        creditos: creditosFinal,
        linkRenovacao: document.getElementById('ec_linkRenovacao').value.trim(),
        observacoes: document.getElementById('ec_observacoes').value.trim()
      };
      if (kind === 'client') {
        const idx = clients.findIndex(x => x.id === id);
        if (idx < 0) { showToast('Cliente não encontrado.', true); return; }
        const prev = clients[idx];
        const dataInicio = document.getElementById('ec_dataInicio').value || prev.dataInicio || prev.dataPagamento || '';
        const dataRenovacao = document.getElementById('ec_dataRenovacao').value || prev.dataRenovacao || '';
        const renovacaoChanged = dataRenovacao !== (prev.dataRenovacao || '');
        clients[idx] = { ...prev, ...base, dataInicio, dataPagamento: dataInicio || prev.dataPagamento || '', dataRenovacao, msgSentAt: renovacaoChanged ? null : prev.msgSentAt, updatedAt: new Date().toISOString() };
        renderAll();
        atualizarSelectMesGestao(); atualizarGraficoClientes();
        atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      } else {
        const idx = testes.findIndex(x => x.id === id);
        if (idx < 0) { showToast('Teste não encontrado.', true); return; }
        const duracaoTeste = document.getElementById('ec_duracaoTeste').value.trim();
        testes[idx] = { ...testes[idx], ...base, duracaoTeste, updatedAt: new Date().toISOString() };
        salvarTestes(); renderTestes();
      }
      fecharModalEditarCliente();
      showToast('Alterações salvas.');
    });

    /* ---------- NOVO CLIENTE ---------- */
    function abrirModalNovoCliente() {
      const form = document.getElementById('formNovoCliente'); form.reset();
      atualizarSelectPlanos();
      atualizarSelectAplicativos();
      const hoje = todayLocalDate();
      document.getElementById('nc_dataInicio').value = toInputDate(hoje);
      document.getElementById('nc_dataRenovacao').value = toInputDate(addPlanPeriod(hoje, 30));
      document.getElementById('nc_creditos').value = 1;
      document.querySelector('input[name="nc_contabilizar"][value="sim"]').checked = true;
      document.getElementById('nc_contab_sim').classList.add('active');
      document.getElementById('nc_contab_nao').classList.remove('active');
      document.getElementById('nc_contab_nao').classList.remove('danger');
      document.getElementById('modalNovoCliente').classList.add('active');
    }
    function fecharModalNovoCliente() { document.getElementById('modalNovoCliente').classList.remove('active'); }
    window.abrirModalNovoCliente = abrirModalNovoCliente; window.fecharModalNovoCliente = fecharModalNovoCliente;

    (function wireNcDateSync() {
      const inicio = document.getElementById('nc_dataInicio');
      const renov = document.getElementById('nc_dataRenovacao');
      const btn = document.getElementById('nc_btnPlus30');
      const planoSel = document.getElementById('nc_plano');
      if (!inicio || !renov) return;
      const recalc = () => {
        const d = parseDate(inicio.value); if (!d) return;
        const planoCad = planoPorIdSelect(planoSel);
        const dias = planoCad ? planoCad.dias : 30;
        renov.value = toInputDate(addPlanPeriod(d, dias));
      };
      inicio.addEventListener('change', recalc);
      if (btn) btn.addEventListener('click', recalc);
    })();

    (function wireNcRadio() {
      const sim = document.getElementById('nc_contab_sim');
      const nao = document.getElementById('nc_contab_nao');
      function update() {
        const v = document.querySelector('input[name="nc_contabilizar"]:checked').value;
        if (v === 'sim') { sim.classList.add('active'); sim.classList.remove('danger'); nao.classList.remove('active'); nao.classList.remove('danger'); }
        else { nao.classList.add('active'); nao.classList.add('danger'); sim.classList.remove('active'); sim.classList.remove('danger'); }
      }
      sim.addEventListener('click', () => { sim.querySelector('input').checked = true; update(); });
      nao.addEventListener('click', () => { nao.querySelector('input').checked = true; update(); });
    })();

    document.getElementById('formNovoCliente').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = document.getElementById('nc_nome').value.trim();
      const usuario = document.getElementById('nc_usuario').value.trim();
      const senha = document.getElementById('nc_senha').value.trim();
      if (!nome || !usuario || !senha) { showToast('Preencha Nome, Usuário e Senha.', true); return; }
      const hoje = todayLocalDate();
      const dataInicio = document.getElementById('nc_dataInicio').value || toInputDate(hoje);
      const ncPlanoSel = document.getElementById('nc_plano');
      const planoCad = planoPorIdSelect(ncPlanoSel);
      const dias = planoCad ? planoCad.dias : 30;
      const dataRenovacao = document.getElementById('nc_dataRenovacao').value || toInputDate(addPlanPeriod(parseDate(dataInicio) || hoje, dias));
      const valor = document.getElementById('nc_valor').value.trim();
      const planoNome = ncPlanoSel && ncPlanoSel.tagName === 'SELECT' ? getPlanoNomeDoSelect(ncPlanoSel) : '';
      const ncCredVal = document.getElementById('nc_creditos').value;
      const creditosFinal = ncCredVal !== '' ? Math.max(0, parseInt(ncCredVal) || 0) : (planoCad && Number.isFinite(parseInt(planoCad.creditos)) ? parseInt(planoCad.creditos) : 1);
      const ncAplicativoId = document.getElementById('nc_aplicativo').value;
      const ncAplicativoCad = encontrarAplicativoPorId(ncAplicativoId);
      const novo = {
        id: generateId(), nome,
        telefone: document.getElementById('nc_telefone').value.trim(),
        aplicativoId: ncAplicativoId || '', aplicativo: ncAplicativoCad ? ncAplicativoCad.nome : '',
        usuario, senha, plano: planoNome, valor, creditos: creditosFinal,
        dataInicio, dataPagamento: dataInicio, dataRenovacao,
        linkRenovacao: document.getElementById('nc_linkRenovacao').value.trim(),
        observacoes: document.getElementById('nc_observacoes').value.trim(),
        msgSentAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      clients.push(novo);
      const contabilizar = document.querySelector('input[name="nc_contabilizar"]:checked').value === 'sim';
      if (contabilizar) {
        const valorVenda = parseValor(valor);
        const taxa = calcularTaxaPlano(planoCad, valorVenda);
        const painelId = (planoCad && planoCad.painelId) ? planoCad.painelId : paineis[0].id;
        movimentacoes.push({
          data: new Date().toISOString(), tipo: 'use', tipoCliente: 'novo',
          valor: valorVenda, quantidade: creditosFinal, taxa: taxa,
          planoNome: planoNome, clientId: novo.id, clientNome: novo.nome,
          painelId
        });
        salvarMovimentacoes();
      }
      state.clientesPage = 1;
      renderAll();
      atualizarCreditos(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      fecharModalNovoCliente();
      showToast(contabilizar
        ? `${novo.nome} cadastrado • -${creditosFinal} crédito${creditosFinal === 1 ? '' : 's'} contabilizado${creditosFinal === 1 ? '' : 's'}`
        : `${novo.nome} cadastrado (sem impacto no gráfico/créditos)`);
    });

    window.deleteClient = id => {
      const c = clients.find(x => x.id === id); if (!c) return;
      if (!confirmar(`Excluir ${c.nome}?`)) return;
      liberarReservaPagamentoPendente(c);
      clients = clients.filter(x => x.id !== id);
      renderAll(); atualizarCreditos(); atualizarHistorico(); atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      if (typeof fecharModalDetalheCliente === 'function') fecharModalDetalheCliente();
      showToast('Cliente excluído.');
    };

    els.clientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = getFormData();
      testes.push(d); salvarTestes();
      movimentacoes.push({ data: new Date().toISOString(), tipo: 'teste', tipoCliente: 'teste', quantidade: 1, nome: d.nome });
      salvarMovimentacoes();
      state.testesPage = 1;
      renderTestes(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      resetForm();
      showToast('Teste cadastrado com sucesso.');
    });
    els.clearFormBtn.addEventListener('click', resetForm);
    if (els.criarTesteBtn) els.criarTesteBtn.addEventListener('click', mostrarFormTeste);
    let searchClientesDebounce = null;
    els.searchClientesInput.addEventListener('input', () => {
      clearTimeout(searchClientesDebounce);
      searchClientesDebounce = setTimeout(() => { state.clientesPage = 1; renderClientes(); }, 180);
    });
    (function wireFiltroClientes() {
      const f = document.getElementById('filtroClientesStatus');
      if (f) f.addEventListener('change', () => { state.clientesPage = 1; renderClientes(); });
    })();
    els.tabs.forEach(tab => tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      const isFree = tab.dataset.authExempt === 'true';
      if (!currentFirebaseUser && !isFree) {
        showToast('Faça login para liberar as demais abas.', true);
        switchTab('login');
        return;
      }
      switchTab(tabName);
    }));
    (function wireSidebar() {
      const tog = document.getElementById('menuToggle');
      const cls = document.getElementById('sidebarClose');
      const ov = document.getElementById('sidebarOverlay');
      if (tog) tog.addEventListener('click', openSidebar);
      if (cls) cls.addEventListener('click', closeSidebar);
      if (ov) ov.addEventListener('click', closeSidebar);
    })();

    (function wireDashboardFilters() {
      const anoEl = document.getElementById('dashFiltroAno');
      const mesEl = document.getElementById('dashFiltroMes');
      if (anoEl) {
        anoEl.addEventListener('change', () => {
          state.dashChartYear = Number(anoEl.value) || getCurrentZonedYear();
          atualizarDashboardFinanceiro();
        });
      }
      if (mesEl) {
        mesEl.addEventListener('change', () => {
          state.dashChartMonth = mesEl.value || 'all';
          atualizarDashboardFinanceiro();
        });
      }
    })();

    /* =========================================================
       PARTE 2 — CALCULADORA / CRÉDITO / GESTÃO / CONFIGURAÇÃO
       ========================================================= */
    let pacotes = [];
    let planos = [];
    let aplicativos = [];
    let assinaturas = [];
    let custos = [];
    let movimentacoes = [];
    let lucrosCustos = [];
    let paineis = [];
    let graficoClientes = null;
    let movimentacaoEditando = null;

    /* ---------- PAINÉIS (2 painéis de crédito) ---------- */
    const PAINEIS_DEFAULT = [
      { id: 'p1', nome: 'Painel 1', cor: '#39ff14', logo: '' },
      { id: 'p2', nome: 'Painel 2', cor: '#5cf0ff', logo: '' }
    ];
    function salvarPaineis() {
      writeJsonCache('iptv_paineis', paineis);
      queueCloudSave('paineis');
    }
    function carregarPaineis() {
      const raw = readJsonCache('iptv_paineis', null);
      if (Array.isArray(raw) && raw.length >= 1) {
        paineis = raw.map((x, i) => ({
          id: x.id || ('p' + (i + 1)),
          nome: (x.nome && String(x.nome).trim()) || ('Painel ' + (i + 1)),
          cor: (x.cor && /^#[0-9a-fA-F]{6}$/.test(String(x.cor))) ? x.cor : PAINEIS_DEFAULT[Math.min(i, PAINEIS_DEFAULT.length - 1)].cor,
          logo: (typeof x.logo === 'string') ? x.logo : ''
        }));
        return;
      }
      paineis = JSON.parse(JSON.stringify(PAINEIS_DEFAULT));
      salvarPaineis();
    }
    function adicionarPainel() {
      const novoIdx = paineis.length + 1;
      const novoId = 'p' + Date.now().toString(36);
      const cores = ['#39ff14','#5cf0ff','#ff5c5c','#ffe45c','#ff9bff','#5cffa1','#ff8c42','#c084fc'];
      const cor = cores[paineis.length % cores.length];
      paineis.push({ id: novoId, nome: 'Painel ' + novoIdx, cor: cor, logo: '' });
      salvarPaineis();
      atualizarCreditos();
      atualizarSelectsPaineis();
      if (typeof atualizarSelectDxPaineis === 'function') atualizarSelectDxPaineis();
      atualizarListaPacotes();
      atualizarListaPlanos();
      atualizarHintPaineis();
      showToast('Painel adicionado.');
    }
    function removerPainel(pid) {
      if (paineis.length <= 1) { showToast('É necessário manter pelo menos 1 painel.', true); return; }
      const alvo = paineis.find(p => p.id === pid);
      const nome = alvo ? alvo.nome : pid;
      if (!confirmar('Excluir o painel "' + nome + '" e todas as suas movimentações?')) return;
      // Move itens do painel excluído para o primeiro painel restante
      const fallbackId = paineis.find(p => p.id !== pid).id;
      pacotes.forEach(pac => { if (pac.painelId === pid) pac.painelId = fallbackId; });
      planos.forEach(pl => { if (pl.painelId === pid) pl.painelId = fallbackId; });
      movimentacoes.forEach(mv => { if (mv.painelId === pid) mv.painelId = fallbackId; });
      salvarPacotes(); salvarPlanos(); salvarMovimentacoes();
      paineis = paineis.filter(p => p.id !== pid);
      salvarPaineis();
      atualizarCreditos();
      atualizarSelectsPaineis();
      if (typeof atualizarSelectDxPaineis === 'function') atualizarSelectDxPaineis();
      atualizarListaPacotes(); atualizarSelectPacotes(); atualizarSelectPacotesAddCredito();
      atualizarListaPlanos(); atualizarSelectPlanos();
      atualizarHistorico();
      atualizarHintPaineis();
      renderDashboard(); renderClientes();
      atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      showToast('Painel "' + nome + '" excluído.');
    }
    function atualizarHintPaineis() {
      const el = document.getElementById('paineisCountHint');
      if (el) el.textContent = paineis.length + ' painel' + (paineis.length !== 1 ? 'éis' : '');
    }
    function getPainelById(pid) {
      return paineis.find(p => p.id === pid) || paineis[0];
    }
    function getPainelNome(pid) {
      const p = getPainelById(pid);
      return p ? p.nome : '';
    }
    function getPainelIdxClass(pid) {
      const idx = paineis.findIndex(p => p.id === pid);
      if (idx <= 0) return '';
      return 'painel-' + ((idx % 2) + 1);
    }
    function resolverPainelDeMovimentacao(m) {
      if (m.painelId && paineis.some(p => p.id === m.painelId)) return m.painelId;
      if (m.pacoteId) {
        const pac = pacotes.find(p => p.id === m.pacoteId);
        if (pac && pac.painelId) return pac.painelId;
      }
      if (m.planoNome) {
        const pl = encontrarPlanoPorNome(m.planoNome);
        if (pl && pl.painelId) return pl.painelId;
      }
      return paineis[0].id;
    }

    function salvarPacotes() { writeJsonCache('iptv_pacotes', pacotes); queueCloudSave('pacotes'); }
    function salvarPlanos()  { writeJsonCache('iptv_planos', planos); queueCloudSave('planos'); }
    function salvarMovimentacoes() { writeJsonCache('iptv_movimentacoes', movimentacoes); queueCloudSave('movimentacoes'); }
    function salvarLucrosCustos() { writeJsonCache('iptv_lucros_custos', lucrosCustos); queueCloudSave('lucrosCustos'); }

    function carregarDadosCalc() {
      carregarPaineis();
      carregarAplicativos();
      const p = readJsonCache('iptv_pacotes', []);
      pacotes = Array.isArray(p) ? p : [];
      if (!p || !Array.isArray(p)) salvarPacotes();
      let mutPac = false;
      pacotes.forEach(pac => {
        if (!pac.painelId || !paineis.some(pp => pp.id === pac.painelId)) {
          pac.painelId = paineis[0].id;
          mutPac = true;
        }
      });
      if (mutPac) salvarPacotes();
      const pl = readJsonCache('iptv_planos', []);
      planos = Array.isArray(pl) ? pl : [];
      let mutated = false;
      planos.forEach(plObj => {
        if (!Number.isFinite(parseInt(plObj.creditos))) { plObj.creditos = 1; mutated = true; }
        if (!plObj.taxaTipo) { plObj.taxaTipo = 'none'; mutated = true; }
        if (plObj.taxaValor === undefined || plObj.taxaValor === null) { plObj.taxaValor = 0; mutated = true; }
        if (!plObj.painelId || !paineis.some(pp => pp.id === plObj.painelId)) { plObj.painelId = paineis[0].id; mutated = true; }
      });
      if (mutated) salvarPlanos();
      const m = readJsonCache('iptv_movimentacoes', []);
      movimentacoes = Array.isArray(m) ? m : [];
      let mutMov = false;
      movimentacoes.forEach(mv => {
        if (!mv.painelId || !paineis.some(pp => pp.id === mv.painelId)) {
          mv.painelId = resolverPainelDeMovimentacao(mv);
          mutMov = true;
        }
      });
      if (mutMov) salvarMovimentacoes();
      const lc = readJsonCache('iptv_lucros_custos', []);
      lucrosCustos = Array.isArray(lc) ? lc : [];
    }

    /* ---------- PLANOS ---------- */
    function encontrarPlanoPorNome(nome) {
      if (!nome) return null;
      const n = String(nome).trim().toLowerCase();
      return planos.find(p => String(p.nome).trim().toLowerCase() === n) || null;
    }
    function planoPorIdSelect(selectEl) {
      if (!selectEl) return null;
      const id = parseInt(selectEl.value); if (!id) return null;
      return planos.find(p => p.id === id) || null;
    }
    function getPlanoNomeDoSelect(selectEl) { const p = planoPorIdSelect(selectEl); return p ? p.nome : ''; }
    function selecionarPlanoPorNome(selectEl, nome) {
      if (!selectEl) return;
      atualizarSelectPlanos();
      const p = encontrarPlanoPorNome(nome);
      selectEl.value = p ? String(p.id) : '';
    }

    let planoEditandoId = null;
    function abrirModalPlano() {
      planoEditandoId = null;
      document.getElementById('modalPlanoTitle').textContent = 'Adicionar Plano';
      document.getElementById('planoNome').value = '';
      document.getElementById('planoValor').value = '';
      document.getElementById('planoLink').value = '';
      document.getElementById('planoDias').value = '30';
      document.getElementById('planoCreditos').value = '1';
      document.getElementById('planoTaxaTipo').value = 'none';
      document.getElementById('planoTaxaValor').value = '';
      atualizarSelectsPaineis();
      const selPainel = document.getElementById('planoPainel');
      if (selPainel) selPainel.value = paineis[0].id;
      document.getElementById('modalPlano').classList.add('active');
    }
    function fecharModalPlano() {
      document.getElementById('modalPlano').classList.remove('active');
      planoEditandoId = null;
    }
    function editarPlano(id) {
      const p = planos.find(x => x.id === id); if (!p) return;
      planoEditandoId = id;
      document.getElementById('modalPlanoTitle').textContent = 'Editar Plano';
      document.getElementById('planoNome').value = p.nome;
      document.getElementById('planoValor').value = p.valor;
      document.getElementById('planoLink').value = p.link || '';
      document.getElementById('planoDias').value = p.dias;
      document.getElementById('planoCreditos').value = Number.isFinite(parseInt(p.creditos)) ? p.creditos : 1;
      document.getElementById('planoTaxaTipo').value = p.taxaTipo || 'none';
      document.getElementById('planoTaxaValor').value = (p.taxaValor !== undefined && p.taxaValor !== null && p.taxaValor !== 0) ? p.taxaValor : '';
      atualizarSelectsPaineis();
      const selPainel = document.getElementById('planoPainel');
      if (selPainel) selPainel.value = p.painelId || paineis[0].id;
      document.getElementById('modalPlano').classList.add('active');
    }
    function salvarPlano() {
      const nome = document.getElementById('planoNome').value.trim();
      const valor = parseFloat(document.getElementById('planoValor').value);
      const link = document.getElementById('planoLink').value.trim();
      const dias = parseInt(document.getElementById('planoDias').value);
      const creditosRaw = document.getElementById('planoCreditos').value;
      const creditos = creditosRaw === '' ? 1 : Math.max(0, parseInt(creditosRaw) || 0);
      const taxaTipo = document.getElementById('planoTaxaTipo').value || 'none';
      const taxaValorRaw = document.getElementById('planoTaxaValor').value;
      const taxaValor = taxaTipo === 'none' ? 0 : Math.max(0, parseFloat(taxaValorRaw) || 0);
      const painelId = (document.getElementById('planoPainel') || {}).value || paineis[0].id;
      if (!nome || isNaN(valor) || !dias || dias < 1) { showToast('Preencha nome, valor e dias (>=1).', true); return; }
      if (taxaTipo !== 'none' && taxaValor <= 0) { showToast('Informe o valor da taxa (maior que zero) ou escolha "Sem taxa".', true); return; }
      if (planoEditandoId) {
        const idx = planos.findIndex(p => p.id === planoEditandoId);
        if (idx >= 0) planos[idx] = { id: planoEditandoId, nome, valor, link, dias, creditos, taxaTipo, taxaValor, painelId };
      } else {
        const novoId = planos.length > 0 ? Math.max(...planos.map(p => p.id)) + 1 : 1;
        planos.push({ id: novoId, nome, valor, link, dias, creditos, taxaTipo, taxaValor, painelId });
      }
      salvarPlanos();
      atualizarListaPlanos(); atualizarSelectPlanos();
      atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      fecharModalPlano();
      showToast(planoEditandoId ? 'Plano atualizado.' : 'Plano adicionado.');
    }
    function removerPlano(id) {
      if (!confirmar('Remover este plano?')) return;
      planos = planos.filter(p => p.id !== id);
      salvarPlanos(); atualizarListaPlanos(); atualizarSelectPlanos();
    }
    function atualizarListaPlanos() {
      const lista = document.getElementById('listaPlanos');
      const cnt = document.getElementById('countPlanos');
      if (cnt) cnt.textContent = planos.length;
      if (!lista) return;
      if (planos.length === 0) { lista.innerHTML = '<div class="empty-state"><i class="fas fa-list-ul"></i><p>Nenhum plano cadastrado</p></div>'; return; }
      lista.innerHTML = planos.map(p => {
        const cred = Number.isFinite(parseInt(p.creditos)) ? p.creditos : 1;
        const taxaInfo = descricaoTaxaPlano(p);
        const taxaColor = (p.taxaTipo && p.taxaTipo !== 'none' && parseFloat(p.taxaValor) > 0) ? 'var(--warning)' : 'var(--muted)';
        const painelCls = getPainelIdxClass(p.painelId);
        const painelNome = getPainelNome(p.painelId);
        return `
        <div class="list-item" data-testid="plano-item-${p.id}">
          <div class="list-item-content">
            <div class="list-item-icon"><i class="fas fa-list-ul"></i></div>
            <div style="flex:1; min-width:0;">
              <div class="list-item-text">${escapeHtml(p.nome)} <span class="painel-badge ${painelCls}" data-testid="plano-painel-badge-${p.id}"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span></div>
              <div class="list-item-sub">${p.dias} dias • <span style="color:var(--primary);"><i class="fas fa-coins"></i> ${cred} créd.</span> • <span style="color:${taxaColor};"><i class="fas fa-percent"></i> Taxa: ${escapeHtml(taxaInfo)}</span>${p.link ? ` • <a href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--info); text-decoration:none;">link</a>` : ''}</div>
            </div>
          </div>
          <div class="list-item-badge">R$ ${Number(p.valor).toFixed(2)}</div>
          <button class="btn-info" onclick="editarPlano(${p.id})" data-testid="btn-editar-plano-${p.id}"><i class="fas fa-edit"></i></button>
          <button class="btn-danger" onclick="removerPlano(${p.id})" data-testid="btn-remover-plano-${p.id}"><i class="fas fa-trash"></i></button>
        </div>`;
      }).join('');
    }
    function atualizarSelectPlanos() {
      const ids = ['plano', 'nc_plano', 'ec_plano'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.tagName !== 'SELECT') return;
        const currentVal = el.value;
        const opcoes = planos.map(p => {
          const cred = Number.isFinite(parseInt(p.creditos)) ? p.creditos : 1;
          return `<option value="${p.id}">${escapeHtml(p.nome)} • R$ ${Number(p.valor).toFixed(2)} • ${p.dias}d • ${cred} créd.</option>`;
        }).join('');
        el.innerHTML = '<option value="">Selecione um plano</option>' + opcoes;
        if (currentVal && planos.some(p => String(p.id) === String(currentVal))) el.value = currentVal;
      });
      // Atualiza também o select de dias extras (filtrado por painel)
      if (typeof atualizarSelectDxPlanos === 'function') atualizarSelectDxPlanos();
    }
    function aplicarPlanoSelecionado(selectEl, valorElId, linkElId, dataInicioElId, dataRenovacaoElId, creditosElId) {
      const p = planoPorIdSelect(selectEl); if (!p) return;
      if (valorElId) { const elV = document.getElementById(valorElId); if (elV) elV.value = Number(p.valor).toFixed(2).replace('.', ','); }
      if (linkElId) { const elL = document.getElementById(linkElId); if (elL) elL.value = p.link || ''; }
      if (dataInicioElId && dataRenovacaoElId) {
        const inicioStr = document.getElementById(dataInicioElId).value;
        const baseDate = parseDate(inicioStr) || todayLocalDate();
        document.getElementById(dataRenovacaoElId).value = toInputDate(addPlanPeriod(baseDate, p.dias));
      }
      if (creditosElId) { const elC = document.getElementById(creditosElId); if (elC) elC.value = Number.isFinite(parseInt(p.creditos)) ? p.creditos : 1; }
    }
    (function wirePlanSelects() {
      const sel1 = document.getElementById('plano');
      if (sel1) sel1.addEventListener('change', () => aplicarPlanoSelecionado(sel1, 'valor', 'linkRenovacao', null, null, 'creditos'));
      const sel2 = document.getElementById('nc_plano');
      if (sel2) sel2.addEventListener('change', () => aplicarPlanoSelecionado(sel2, 'nc_valor', 'nc_linkRenovacao', 'nc_dataInicio', 'nc_dataRenovacao', 'nc_creditos'));
      const sel3 = document.getElementById('ec_plano');
      if (sel3) sel3.addEventListener('change', () => aplicarPlanoSelecionado(sel3, 'ec_valor', 'ec_linkRenovacao', 'ec_dataInicio', 'ec_dataRenovacao', 'ec_creditos'));
    })();

    /* ---------- APLICATIVOS (catálogo + instalação por plataforma) ---------- */
    const DISPOSITIVOS_OPCOES = [
      { id: 'celular', nome: 'Celular' },
      { id: 'tablet', nome: 'Tablet' },
      { id: 'computador', nome: 'Computador' },
      { id: 'smarttv', nome: 'SmartTV' },
      { id: 'dispositivo_smarttv', nome: 'Dispositivo SmartTV' }
    ];
    const SISTEMAS_OPCOES = [
      { id: 'android', nome: 'Android' },
      { id: 'ios', nome: 'iOS' },
      { id: 'windows', nome: 'Windows' },
      { id: 'tizen', nome: 'Tizen' },
      { id: 'webos', nome: 'webOS' },
      { id: 'roku', nome: 'Roku' }
    ];
    function labelDispositivos(ids) {
      return (Array.isArray(ids) ? ids : []).map(id => (DISPOSITIVOS_OPCOES.find(o => o.id === id) || {}).nome || id).join(', ');
    }
    function labelSistemas(ids) {
      return (Array.isArray(ids) ? ids : []).map(id => (SISTEMAS_OPCOES.find(o => o.id === id) || {}).nome || id).join(', ');
    }
    function salvarAplicativos() { writeJsonCache('iptv_aplicativos', aplicativos); queueCloudSave('aplicativos'); }
    function carregarAplicativos() {
      const raw = readJsonCache('iptv_aplicativos', []);
      aplicativos = Array.isArray(raw) ? raw.map(normalizeAplicativo) : [];
    }
    const LEGACY_PLATAFORMA_MAP = {
      'android': { dispositivos: ['celular', 'tablet'], sistemas: ['android'] },
      'ios': { dispositivos: ['celular', 'tablet'], sistemas: ['ios'] },
      'computador': { dispositivos: ['computador'], sistemas: ['windows'] },
      'smart tv': { dispositivos: ['smarttv'], sistemas: [] },
      'smart tv android': { dispositivos: ['smarttv'], sistemas: ['android'] }
    };
    function normalizeAplicativo(a) {
      return {
        id: a.id || generateId(),
        nome: a.nome || '',
        painelId: (a.painelId && paineis.some(p => p.id === a.painelId)) ? a.painelId : ((paineis[0] && paineis[0].id) || ''),
        icone: a.icone || 'fas fa-mobile-alt',
        plataformas: Array.isArray(a.plataformas) ? a.plataformas.map(p => {
          if (Array.isArray(p.dispositivos) || Array.isArray(p.sistemas)) {
            return { id: p.id || generateId(), dispositivos: p.dispositivos || [], sistemas: p.sistemas || [], link: p.link || '' };
          }
          // Migração de cadastros antigos (campo único "Plataforma": Android/iOS/Computador/Smart TV/Smart TV Android)
          const legado = LEGACY_PLATAFORMA_MAP[String(p.nome || '').trim().toLowerCase()];
          return {
            id: p.id || generateId(),
            dispositivos: legado ? legado.dispositivos : [],
            sistemas: legado ? legado.sistemas : [],
            link: p.link || ''
          };
        }) : [],
        msgTeste: typeof a.msgTeste === 'string' ? a.msgTeste : '',
        msgCliente: typeof a.msgCliente === 'string' ? a.msgCliente : ''
      };
    }
    function encontrarAplicativoPorId(id) { return aplicativos.find(a => a.id === id) || null; }

    let aplicativoEditandoId = null;
    function abrirModalAplicativo() {
      aplicativoEditandoId = null;
      document.getElementById('modalAplicativoTitle').textContent = 'Adicionar Aplicativo';
      document.getElementById('apNome').value = '';
      document.getElementById('apIcone').value = 'fas fa-mobile-alt';
      document.getElementById('apPlataformasList').innerHTML = '';
      adicionarLinhaPlataformaAplicativo({ painelId: paineis[0] ? paineis[0].id : '' });
      document.getElementById('apMsgTeste').value = APLICATIVO_MSG_TESTE_PADRAO;
      document.getElementById('apMsgCliente').value = APLICATIVO_MSG_CLIENTE_PADRAO;
      renderAplicativoMsgVars();
      atualizarPreviewMsgAplicativoCadastro('teste');
      atualizarPreviewMsgAplicativoCadastro('cliente');
      document.getElementById('modalAplicativo').classList.add('active');
    }
    function fecharModalAplicativo() {
      document.getElementById('modalAplicativo').classList.remove('active');
      aplicativoEditandoId = null;
    }
    function editarAplicativo(id) {
      const a = encontrarAplicativoPorId(id); if (!a) return;
      aplicativoEditandoId = id;
      document.getElementById('modalAplicativoTitle').textContent = 'Editar Aplicativo';
      document.getElementById('apNome').value = a.nome;
      document.getElementById('apIcone').value = a.icone || 'fas fa-mobile-alt';
      const lista = document.getElementById('apPlataformasList');
      lista.innerHTML = '';
      const dadosRow = Object.assign({}, a.plataformas[0], { painelId: a.painelId });
      adicionarLinhaPlataformaAplicativo(dadosRow);
      document.getElementById('apMsgTeste').value = a.msgTeste || APLICATIVO_MSG_TESTE_PADRAO;
      document.getElementById('apMsgCliente').value = a.msgCliente || APLICATIVO_MSG_CLIENTE_PADRAO;
      renderAplicativoMsgVars();
      atualizarPreviewMsgAplicativoCadastro('teste');
      atualizarPreviewMsgAplicativoCadastro('cliente');
      document.getElementById('modalAplicativo').classList.add('active');
    }
    function adicionarLinhaPlataformaAplicativo(dados) {
      // Cada aplicativo cadastrado representa uma única instalação (pode ter múltiplas plataformas/sistemas).
      const lista = document.getElementById('apPlataformasList');
      const rowId = 'aprow_' + generateId();
      const dispositivosVal = (dados && Array.isArray(dados.dispositivos)) ? dados.dispositivos : [];
      const sistemasVal = (dados && Array.isArray(dados.sistemas)) ? dados.sistemas : [];
      const linkVal = dados && dados.link ? dados.link : '';
      const dispositivosHtml = DISPOSITIVOS_OPCOES.map(o => `
        <label class="ap-check-option"><input type="checkbox" class="ap-plat-dispositivo" value="${o.id}" ${dispositivosVal.includes(o.id) ? 'checked' : ''} onchange="atualizarPreviewMsgAplicativoCadastro('teste'); atualizarPreviewMsgAplicativoCadastro('cliente');"> ${escapeHtml(o.nome)}</label>
      `).join('');
      const sistemasHtml = SISTEMAS_OPCOES.map(o => `
        <label class="ap-check-option"><input type="checkbox" class="ap-plat-sistema" value="${o.id}" ${sistemasVal.includes(o.id) ? 'checked' : ''} onchange="atualizarPreviewMsgAplicativoCadastro('teste'); atualizarPreviewMsgAplicativoCadastro('cliente');"> ${escapeHtml(o.nome)}</label>
      `).join('');
      lista.innerHTML = '';
      const row = document.createElement('div');
      row.className = 'ap-plataforma-row';
      row.id = rowId;
      row.innerHTML = `
        <div class="field">
          <label>🗂️ Plataforma <span class="card-hint" style="font-weight:400;">(marque quantas precisar)</span></label>
          <div class="ap-check-group">${dispositivosHtml}</div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label>🗃️ Sistema</label>
          <div class="ap-sistema-painel-wrap" style="margin-bottom:8px;">
            <label class="card-hint" style="display:block; margin-bottom:4px;">Selecionar painel</label>
            <select id="apPainel" class="form-select" data-testid="ap-painel"></select>
          </div>
          <p class="card-hint" style="margin:0 0 6px;">(marque quantos sistemas precisar)</p>
          <div class="ap-check-group">${sistemasHtml}</div>
        </div>
        <div class="field" style="margin-top:14px;"><label>Link de download (opcional)</label><input type="text" class="ap-plat-link" placeholder="Deixe em branco se este app não precisar de link" value="${escapeHtml(linkVal)}" oninput="atualizarPreviewMsgAplicativoCadastro('teste'); atualizarPreviewMsgAplicativoCadastro('cliente');" /></div>
      `;
      lista.appendChild(row);
      atualizarSelectsPaineis();
      const apPainelSel = document.getElementById('apPainel');
      if (apPainelSel) apPainelSel.value = (dados && dados.painelId) || (paineis[0] ? paineis[0].id : '');
      atualizarPreviewMsgAplicativoCadastro('teste');
      atualizarPreviewMsgAplicativoCadastro('cliente');
    }
    function salvarAplicativo() {
      const nome = document.getElementById('apNome').value.trim();
      const icone = document.getElementById('apIcone').value || 'fas fa-mobile-alt';
      const row = document.querySelector('#apPlataformasList .ap-plataforma-row');
      const apPainelSel = row ? row.querySelector('#apPainel') : null;
      const painelId = (apPainelSel && apPainelSel.value) || (paineis[0] ? paineis[0].id : '');
      if (!nome) { showToast('Informe o nome do aplicativo.', true); return; }
      if (!painelId) { showToast('Cadastre ao menos um painel antes de adicionar um aplicativo.', true); return; }
      const dispositivos = row ? Array.from(row.querySelectorAll('.ap-plat-dispositivo:checked')).map(el => el.value) : [];
      const sistemas = row ? Array.from(row.querySelectorAll('.ap-plat-sistema:checked')).map(el => el.value) : [];
      if (dispositivos.length === 0) { showToast('Marque ao menos uma plataforma (Celular, Tablet, etc.).', true); return; }
      if (sistemas.length === 0) { showToast('Marque ao menos um sistema (Android, iOS, etc.).', true); return; }
      const plataformas = [{
        id: (aplicativoEditandoId && aplicativos.find(a => a.id === aplicativoEditandoId) && aplicativos.find(a => a.id === aplicativoEditandoId).plataformas[0] && aplicativos.find(a => a.id === aplicativoEditandoId).plataformas[0].id) || generateId(),
        dispositivos,
        sistemas,
        link: row ? row.querySelector('.ap-plat-link').value.trim() : ''
      }];
      const msgTeste = (document.getElementById('apMsgTeste').value || '').trim();
      const msgCliente = (document.getElementById('apMsgCliente').value || '').trim();
      if (aplicativoEditandoId) {
        const idx = aplicativos.findIndex(a => a.id === aplicativoEditandoId);
        if (idx >= 0) {
          aplicativos[idx] = { id: aplicativoEditandoId, nome, painelId, icone, plataformas, msgTeste, msgCliente };
        }
      } else {
        aplicativos.push({ id: generateId(), nome, painelId, icone, plataformas, msgTeste, msgCliente });
      }
      salvarAplicativos();
      atualizarListaAplicativos();
      atualizarSelectAplicativos();
      fecharModalAplicativo();
      showToast(aplicativoEditandoId ? 'Aplicativo atualizado.' : 'Aplicativo adicionado.');
    }
    function removerAplicativo(id) {
      const a = encontrarAplicativoPorId(id); if (!a) return;
      if (!confirmar('Remover o aplicativo "' + a.nome + '" e suas instruções de instalação?')) return;
      aplicativos = aplicativos.filter(x => x.id !== id);
      salvarAplicativos();
      atualizarListaAplicativos();
      atualizarSelectAplicativos();
      showToast('Aplicativo removido.');
    }
    function atualizarListaAplicativos() {
      const lista = document.getElementById('listaAplicativos');
      if (!lista) return;
      if (aplicativos.length === 0) { lista.innerHTML = '<div class="empty-state"><i class="fas fa-mobile-alt"></i><p>Nenhum aplicativo cadastrado</p></div>'; return; }
      lista.innerHTML = aplicativos.map(a => {
        const chips = (a.plataformas || []).flatMap(p => [
          ...(p.dispositivos || []).map(d => `<span class="app-platform-chip"><i class="fas fa-check" style="font-size:8px;"></i> ${escapeHtml(labelDispositivos([d]))}</span>`),
          ...(p.sistemas || []).map(s => `<span class="app-platform-chip"><i class="fas fa-microchip" style="font-size:8px;"></i> ${escapeHtml(labelSistemas([s]))}</span>`)
        ]).join('');
        const painelCls = getPainelIdxClass(a.painelId);
        const painelNome = getPainelNome(a.painelId);
        return `
        <div class="list-item" data-testid="aplicativo-item-${a.id}" style="align-items:flex-start;">
          <div class="list-item-content">
            <div class="list-item-icon"><i class="${escapeHtml(a.icone || 'fas fa-mobile-alt')}"></i></div>
            <div style="flex:1; min-width:0;">
              <div class="list-item-text">${escapeHtml(a.nome)} <span class="painel-badge ${painelCls}" title="Painel deste aplicativo"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span></div>
              <div class="list-item-sub">${(a.plataformas || []).length} plataforma${(a.plataformas || []).length === 1 ? '' : 's'} cadastrada${(a.plataformas || []).length === 1 ? '' : 's'}</div>
              <div style="margin-top:6px;">${chips || '<span style="color:var(--muted); font-size:12px;">Nenhuma plataforma</span>'}</div>
            </div>
          </div>
          <button class="btn-info" onclick="editarAplicativo('${a.id}')" data-testid="btn-editar-aplicativo-${a.id}"><i class="fas fa-edit"></i></button>
          <button class="btn-danger" onclick="removerAplicativo('${a.id}')" data-testid="btn-remover-aplicativo-${a.id}"><i class="fas fa-trash"></i></button>
        </div>`;
      }).join('');
    }
    const APLICATIVO_SELECT_INFO_IDS = { aplicativo: 'aplicativoInfo', nc_aplicativo: 'ncAplicativoInfo', ec_aplicativo: 'ecAplicativoInfo' };
    function atualizarSelectAplicativos() {
      const ids = ['aplicativo', 'nc_aplicativo', 'ec_aplicativo'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.tagName !== 'SELECT') return;
        const currentVal = el.value;
        const opcoes = aplicativos.map(a => `<option value="${a.id}">${escapeHtml(a.nome)}</option>`).join('');
        el.innerHTML = '<option value="">Selecione um aplicativo</option>' + opcoes;
        if (currentVal && aplicativos.some(a => String(a.id) === String(currentVal))) el.value = currentVal;
        atualizarInfoAplicativoSelecionado(id);
      });
    }
    function atualizarInfoAplicativoSelecionado(selectId) {
      const infoId = APLICATIVO_SELECT_INFO_IDS[selectId];
      const info = infoId ? document.getElementById(infoId) : null;
      if (!info) return;
      const el = document.getElementById(selectId);
      const app = el ? encontrarAplicativoPorId(el.value) : null;
      if (!app) { info.innerHTML = ''; return; }
      const painelCls = getPainelIdxClass(app.painelId);
      const painelNome = getPainelNome(app.painelId);
      const plataformaNome = (app.plataformas && app.plataformas[0]) ? `${labelDispositivos(app.plataformas[0].dispositivos)} — ${labelSistemas(app.plataformas[0].sistemas)}` : '—';
      info.innerHTML = `<span class="painel-badge ${painelCls}" title="Painel deste aplicativo"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span> <span class="app-platform-chip"><i class="fas fa-mobile-alt" style="font-size:9px;"></i> ${escapeHtml(app.nome)}</span> <span class="app-platform-chip"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(plataformaNome)}</span>`;
    }
    window.atualizarInfoAplicativoSelecionado = atualizarInfoAplicativoSelecionado;
    function getAplicativoNomeDoSelect(selectEl) {
      if (!selectEl) return '';
      const a = encontrarAplicativoPorId(selectEl.value);
      return a ? a.nome : '';
    }
    function selecionarAplicativoPorId(selectEl, id) {
      if (!selectEl) return;
      atualizarSelectAplicativos();
      selectEl.value = id && aplicativos.some(a => a.id === id) ? id : '';
      if (selectEl.id) atualizarInfoAplicativoSelecionado(selectEl.id);
    }
    window.abrirModalAplicativo = abrirModalAplicativo;
    window.fecharModalAplicativo = fecharModalAplicativo;
    window.editarAplicativo = editarAplicativo;
    window.removerAplicativo = removerAplicativo;
    window.salvarAplicativo = salvarAplicativo;
    window.adicionarLinhaPlataformaAplicativo = adicionarLinhaPlataformaAplicativo;

    window.abrirModalPlano = abrirModalPlano; window.fecharModalPlano = fecharModalPlano;
    window.salvarPlano = salvarPlano; window.editarPlano = editarPlano; window.removerPlano = removerPlano;

    /* ---------- CRÉDITOS / PACOTES ---------- */
    function adicionarCreditoPacote() {
      const sel = document.getElementById('pacoteAddCredito');
      const id = parseInt(sel.value);
      if (!id) { showToast('Selecione um pacote cadastrado.', true); return; }
      const pacote = pacotes.find(p => p.id === id);
      if (!pacote) { showToast('Pacote não encontrado.', true); return; }
      const custoTotal = pacote.quantidade * pacote.preco;
      const painelId = pacote.painelId || paineis[0].id;
      movimentacoes.push({ data: new Date().toISOString(), tipo: 'add', quantidade: pacote.quantidade, custo: custoTotal, pacoteId: pacote.id, painelId });
      salvarMovimentacoes();
      atualizarCreditos(); atualizarHistorico();
      atualizarSelectMesGestao();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      sel.value = '';
      showToast(`+${pacote.quantidade} créditos em ${getPainelNome(painelId)} • Custo R$ ${custoTotal.toFixed(2)}`);
    }
    window.adicionarCreditoPacote = adicionarCreditoPacote;

    /* ---------- DIAS EXTRAS (POR PLANO) — novo fluxo ---------- */
    function popularSelectClientesDiasExtras() {
      const sel = document.getElementById('dxCliente');
      if (!sel) return;
      const cur = sel.value;
      const ord = clients.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      sel.innerHTML = '<option value="">Selecione o cliente</option>' +
        ord.map(c => {
          const venc = c.dataRenovacao ? formatDate(c.dataRenovacao) : 'sem data';
          return `<option value="${c.id}">${escapeHtml(c.nome || '—')} • ${escapeHtml(c.usuario || '—')} • Venc.: ${venc}</option>`;
        }).join('');
      if (cur && clients.some(c => c.id === cur)) sel.value = cur;
    }

    function atualizarSelectDxPaineis() {
      const sel = document.getElementById('dxPainel');
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = paineis.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
      if (cur && paineis.some(p => p.id === cur)) sel.value = cur;
      atualizarSelectDxPlanos();
    }

    function atualizarSelectDxPlanos() {
      const selPlano = document.getElementById('dxPlano');
      const selPainel = document.getElementById('dxPainel');
      if (!selPlano || !selPainel) return;
      const painelId = selPainel.value || (paineis[0] && paineis[0].id);
      const cur = selPlano.value;
      const planosFiltrados = planos.filter(p => (p.painelId || paineis[0].id) === painelId);
      selPlano.innerHTML = '<option value="">Selecione um plano cadastrado</option>' +
        planosFiltrados.map(p => {
          const cred = Number.isFinite(parseInt(p.creditos)) ? p.creditos : 1;
          return `<option value="${p.id}">${escapeHtml(p.nome)} • R$ ${Number(p.valor).toFixed(2)} • ${p.dias}d • ${cred} créd.</option>`;
        }).join('');
      if (cur && planosFiltrados.some(p => String(p.id) === String(cur))) selPlano.value = cur;
      calcularDiasExtrasPreview();
    }

    function calcularDiasExtrasPreview() {
      const selPlano = document.getElementById('dxPlano');
      const diasInput = document.getElementById('dxDias');
      const selCliente = document.getElementById('dxCliente');
      const preview = document.getElementById('dxPreview');
      if (!preview) return;
      const planoId = selPlano ? parseInt(selPlano.value) : 0;
      const plano = planos.find(p => p.id === planoId);
      const dias = parseInt(diasInput && diasInput.value) || 0;
      if (!plano || dias <= 0) {
        preview.innerHTML = 'Selecione painel, plano e dias para visualizar o cálculo.';
        return;
      }
      const planoValor = parseFloat(plano.valor) || 0;
      const planoDias = parseInt(plano.dias) || 30;
      const planoCreditos = Number.isFinite(parseInt(plano.creditos)) ? parseInt(plano.creditos) : 1;
      const valorPorDia = planoValor / planoDias;
      const valorCobrar = valorPorDia * dias;
      const credPorDia = planoCreditos / 30;
      const creditosUsar = credPorDia * dias;
      // Nova data: baseada no cliente (se selecionado), somando os dias extras
      const cli = selCliente ? clients.find(c => c.id === selCliente.value) : null;
      let novaDataHtml = '—';
      if (cli) {
        const due = parseDate(cli.dataRenovacao) || todayLocalDate();
        const nd = addDays(due, dias);
        novaDataHtml = formatDate(toInputDate(nd));
      }
      const painelNome = getPainelNome(plano.painelId || paineis[0].id);
      preview.innerHTML =
        `<div><i class="fas fa-layer-group" style="color:var(--primary); margin-right:4px;"></i><b>Painel:</b> ${escapeHtml(painelNome)} &nbsp;•&nbsp; <i class="fas fa-list-ul" style="color:var(--primary); margin-right:4px;"></i><b>Plano:</b> ${escapeHtml(plano.nome)} <span style="opacity:.7;">(R$ ${planoValor.toFixed(2)} / ${planoDias}d / ${planoCreditos} créd.)</span></div>` +
        `<div><i class="fas fa-dollar-sign" style="color:var(--primary); margin-right:4px;"></i><b>Cobrança:</b> <b style="color:var(--primary);">R$ ${valorCobrar.toFixed(2)}</b> <span style="opacity:.7;">(${dias}× R$ ${valorPorDia.toFixed(2)}/dia)</span></div>` +
        `<div><i class="fas fa-coins" style="color:var(--warning); margin-right:4px;"></i><b>Consumo:</b> <b style="color:var(--warning);">${creditosUsar.toFixed(3)}</b> créditos <span style="opacity:.7;">(${dias}× ${credPorDia.toFixed(4)} créd./dia)</span></div>` +
        `<div><i class="fas fa-calendar-check" style="color:var(--info); margin-right:4px;"></i><b>Nova renovação:</b> <b style="color:var(--info);">${novaDataHtml}</b>${!cli ? ' <span style="opacity:.7;">(selecione o cliente)</span>' : ''}</div>`;
    }

    let dxClienteAtual = null;
    let dxMensagemAtual = '';


function buildDxMessage(client, dias, valorCobrar, novaDataStr) {
  return renderMessageTemplate('dias_extras', {
    dias: `${dias} dia${dias === 1 ? '' : 's'}`,
    usuario: client.usuario || '',
    senha: client.senha || '',
    valor_adicional: `R$ ${valorCobrar.toFixed(2).replace('.', ',')}`,
    data_renovacao: formatDate(novaDataStr)
  });
}

function aplicarDiasExtras() {
      const selPainel = document.getElementById('dxPainel');
      const selPlano = document.getElementById('dxPlano');
      const diasInput = document.getElementById('dxDias');
      const selCliente = document.getElementById('dxCliente');

      const painelId = selPainel ? selPainel.value : '';
      const planoId = selPlano ? parseInt(selPlano.value) : 0;
      const plano = planos.find(p => p.id === planoId);
      const dias = parseInt(diasInput && diasInput.value) || 0;
      const cli = selCliente ? clients.find(c => c.id === selCliente.value) : null;

      if (!painelId) { showToast('Selecione o painel.', true); return; }
      if (!plano) { showToast('Selecione um plano cadastrado.', true); return; }
      if (dias <= 0) { showToast('Informe a quantidade de dias (>=1).', true); return; }
      if (!cli) { showToast('Selecione o cliente.', true); return; }

      const planoValor = parseFloat(plano.valor) || 0;
      const planoDias = parseInt(plano.dias) || 30;
      const planoCreditos = Number.isFinite(parseInt(plano.creditos)) ? parseInt(plano.creditos) : 1;
      const valorCobrar = (planoValor / planoDias) * dias;
      const creditosUsar = (planoCreditos / 30) * dias;
      const dueDate = parseDate(cli.dataRenovacao) || todayLocalDate();
      const novaData = addDays(dueDate, dias);
      const novaDataStr = toInputDate(novaData);

      cli.dataRenovacao = novaDataStr;
      cli.updatedAt = new Date().toISOString();
      saveClients();

      const taxa = calcularTaxaPlano(plano, valorCobrar);
      movimentacoes.push({
        data: new Date().toISOString(),
        tipo: 'use',
        tipoCliente: 'dias_extras',
        valor: valorCobrar,
        quantidade: creditosUsar,
        taxa: taxa,
        planoNome: plano.nome || '',
        clientId: cli.id,
        clientNome: cli.nome,
        diasExtras: dias,
        painelId: plano.painelId || painelId || paineis[0].id
      });
      salvarMovimentacoes();
      diasInput.value = '';
      calcularDiasExtrasPreview();
      renderAll();
      atualizarCreditos(); atualizarHistorico();
      atualizarSelectMesGestao();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      showToast(`+${dias} dia${dias === 1 ? '' : 's'} para ${cli.nome} • -${creditosUsar.toFixed(3)} créd. (${getPainelNome(plano.painelId || painelId)}) • +R$ ${valorCobrar.toFixed(2)}`);

      // Abre modal de mensagem
      dxClienteAtual = cli;
      dxMensagemAtual = buildDxMessage(cli, dias, valorCobrar, novaDataStr);
      const box = document.getElementById('dxMsgBox');
      if (box) box.textContent = dxMensagemAtual;
      document.getElementById('modalMensagemDiasExtras').classList.add('active');
    }

    function fecharModalMensagemDiasExtras() {
      document.getElementById('modalMensagemDiasExtras').classList.remove('active');
      dxClienteAtual = null;
      dxMensagemAtual = '';
    }
    function copiarMensagemDiasExtras() {
      if (!dxMensagemAtual) return;
      const name = (dxClienteAtual && dxClienteAtual.nome) || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(dxMensagemAtual).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(dxMensagemAtual, name));
      } else fallbackCopy(dxMensagemAtual, name);
    }
    function enviarMensagemDiasExtrasWhatsApp() {
      if (!dxClienteAtual || !dxMensagemAtual) return;
      const phone = String(dxClienteAtual.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(dxMensagemAtual);
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    window.adicionarCreditoAvulso = adicionarCreditoAvulso;
    window.aplicarDiasExtras = aplicarDiasExtras;
    window.fecharModalMensagemDiasExtras = fecharModalMensagemDiasExtras;
    window.copiarMensagemDiasExtras = copiarMensagemDiasExtras;
    window.enviarMensagemDiasExtrasWhatsApp = enviarMensagemDiasExtrasWhatsApp;

    document.addEventListener('input', (e) => {
      if (e.target && (e.target.id === 'dxDias')) calcularDiasExtrasPreview();
    });
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'dxPainel') atualizarSelectDxPlanos();
      else if (e.target && (e.target.id === 'dxPlano' || e.target.id === 'dxCliente')) calcularDiasExtrasPreview();
    });

    function adicionarCreditoAvulso() {
      const qtdEl = document.getElementById('creditoAvulsoQtd');
      const custoEl = document.getElementById('creditoAvulsoCusto');
      const infoEl = document.getElementById('creditoAvulsoInfo');
      const painelEl = document.getElementById('creditoAvulsoPainel');
      const qtd = parseFloat(qtdEl.value);
      if (!Number.isFinite(qtd) || qtd === 0) { showToast('Informe uma quantidade (positiva ou negativa).', true); return; }
      const custo = parseFloat(custoEl.value) || 0;
      const info = (infoEl.value || '').trim();
      const painelId = (painelEl && painelEl.value) ? painelEl.value : paineis[0].id;
      if (qtd > 0) {
        movimentacoes.push({
          data: new Date().toISOString(),
          tipo: 'add',
          quantidade: qtd,
          custo: custo,
          info: info || 'Crédito personalizado',
          avulso: true,
          painelId
        });
      } else {
        movimentacoes.push({
          data: new Date().toISOString(),
          tipo: 'use',
          tipoCliente: 'avulso',
          valor: 0,
          quantidade: Math.abs(qtd),
          taxa: 0,
          info: info || 'Desconto avulso',
          clientNome: info || '',
          painelId
        });
      }
      salvarMovimentacoes();
      qtdEl.value = ''; custoEl.value = ''; infoEl.value = '';
      atualizarCreditos(); atualizarHistorico();
      atualizarSelectMesGestao();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      showToast(qtd > 0 ? `+${qtd} créditos em ${getPainelNome(painelId)}` : `-${Math.abs(qtd)} créditos em ${getPainelNome(painelId)}`);
    }

    function atualizarSelectPacotesAddCredito() {
      const sel = document.getElementById('pacoteAddCredito'); if (!sel) return;
      sel.innerHTML = '<option value="">Selecione um pacote cadastrado</option>' +
        pacotes.map(p => {
          const painelNome = getPainelNome(p.painelId);
          return `<option value="${p.id}">[${escapeHtml(painelNome)}] ${p.quantidade} créditos • R$ ${p.preco.toFixed(2)}/un • Total R$ ${(p.quantidade * p.preco).toFixed(2)}</option>`;
        }).join('');
    }

    function atualizarCreditos() {
      // Cálculo por painel
      const stats = {};
      paineis.forEach(p => { stats[p.id] = { disponiveis: 0, usados: 0, reservados: 0, custoTotal: 0 }; });
      movimentacoes.forEach(m => {
        const pid = m.painelId && stats[m.painelId] ? m.painelId : paineis[0].id;
        const s = stats[pid];
        if (m.tipo === 'add') { s.disponiveis += Number(m.quantidade) || 0; s.custoTotal += Number(m.custo) || 0; }
        else if (m.tipo === 'use') { s.usados += Number(m.quantidade) || 0; s.disponiveis -= Number(m.quantidade) || 0; }
        else if (m.tipo === 'reserve') { s.reservados += Number(m.quantidade) || 0; s.disponiveis -= Number(m.quantidade) || 0; }
      });
      const grid = document.getElementById('paineisGrid');
      if (grid) {
        grid.innerHTML = paineis.map((p, idx) => {
          const s = stats[p.id];
          const cls = idx === 0 ? '' : 'painel-' + ((idx % 2) + 1);
          const disp = Number.isInteger(s.disponiveis) ? s.disponiveis : s.disponiveis.toFixed(3);
          const usd = Number.isInteger(s.usados) ? s.usados : s.usados.toFixed(3);
          const res = Number.isInteger(s.reservados) ? s.reservados : s.reservados.toFixed(3);
          const cor = p.cor || '#39ff14';
          const logoHtml = p.logo
            ? `<img class="painel-logo" src="${escapeHtml(p.logo)}" alt="Logo ${escapeHtml(p.nome)}" data-testid="painel-logo-${p.id}" />`
            : `<div class="painel-logo-empty" data-testid="painel-logo-empty-${p.id}"><i class="fas fa-image"></i></div>`;
          const logoRemoveBtn = p.logo
            ? `<button type="button" class="painel-brand-btn danger" data-action="remove-logo" data-painel-id="${p.id}" data-testid="painel-logo-remove-${p.id}"><i class="fas fa-trash"></i> Remover</button>`
            : '';
          return `
            <div class="painel-box ${cls}" data-testid="painel-box-${p.id}" style="--painel-color: ${cor};">
              <div class="painel-box-head">
                <span class="painel-box-tag">Painel ${idx + 1}</span>
                <input class="painel-name-input" type="text" value="${escapeHtml(p.nome)}" data-painel-id="${p.id}" data-testid="painel-nome-${p.id}" />
                <button type="button" class="painel-brand-btn danger" onclick="removerPainel('${p.id}')" title="Excluir painel" style="margin-left:auto; flex-shrink:0;"><i class="fas fa-trash-alt"></i> Excluir</button>
              </div>
              <div class="painel-brand-row">
                ${logoHtml}
                <div class="painel-brand-actions">
                  <button type="button" class="painel-brand-btn" data-action="upload-logo" data-painel-id="${p.id}" data-testid="painel-logo-upload-${p.id}"><i class="fas fa-upload"></i> ${p.logo ? 'Trocar logo' : 'Enviar logo'}</button>
                  ${logoRemoveBtn}
                  <label class="painel-color-wrap" title="Cor do painel">
                    <input type="color" class="painel-color-swatch" value="${cor}" data-painel-id="${p.id}" data-testid="painel-cor-${p.id}" />
                    <span class="painel-color-label">${cor.toUpperCase()}</span>
                  </label>
                </div>
                <input type="file" accept="image/*" class="painel-file-hidden" data-painel-file="${p.id}" data-testid="painel-logo-file-${p.id}" />
              </div>
              <div class="painel-stats">
                <div class="painel-stat">
                  <div class="painel-stat-value" data-testid="painel-disp-${p.id}">${disp}</div>
                  <div class="painel-stat-label">Disponíveis</div>
                </div>
                <div class="painel-stat">
                  <div class="painel-stat-value" style="color: var(--warning);" data-testid="painel-res-${p.id}">${res}</div>
                  <div class="painel-stat-label">Reservados</div>
                </div>
                <div class="painel-stat">
                  <div class="painel-stat-value" style="color: var(--info);" data-testid="painel-usd-${p.id}">${usd}</div>
                  <div class="painel-stat-label">Usados</div>
                </div>
                <div class="painel-stat">
                  <div class="painel-stat-value" style="color: #ff9b9b;" data-testid="painel-custo-${p.id}">R$ ${s.custoTotal.toFixed(2)}</div>
                  <div class="painel-stat-label">Custo Total</div>
                </div>
              </div>
            </div>`;
        }).join('');
        // Wire rename inputs
        grid.querySelectorAll('.painel-name-input').forEach(inp => {
          inp.addEventListener('change', (e) => {
            const pid = e.target.getAttribute('data-painel-id');
            const novo = (e.target.value || '').trim();
            if (!novo) { e.target.value = getPainelNome(pid); return; }
            const target = paineis.find(p => p.id === pid);
            if (target) {
              target.nome = novo;
              salvarPaineis();
              atualizarSelectsPaineis();
              if (typeof atualizarSelectDxPaineis === 'function') atualizarSelectDxPaineis();
              atualizarListaPacotes();
              atualizarListaPlanos();
              renderDashboard(); renderClientes();
              showToast(`Painel renomeado para "${novo}"`);
            }
          });
        });
        // Wire color pickers
        grid.querySelectorAll('.painel-color-swatch').forEach(inp => {
          const sync = (e) => {
            const pid = e.target.getAttribute('data-painel-id');
            const novo = String(e.target.value || '').toLowerCase();
            if (!/^#[0-9a-f]{6}$/.test(novo)) return;
            const target = paineis.find(p => p.id === pid);
            if (!target) return;
            target.cor = novo;
            salvarPaineis();
            const box = e.target.closest('.painel-box');
            if (box) box.style.setProperty('--painel-color', novo);
            const lbl = e.target.parentElement && e.target.parentElement.querySelector('.painel-color-label');
            if (lbl) lbl.textContent = novo.toUpperCase();
          };
          inp.addEventListener('input', sync);
          inp.addEventListener('change', (e) => { sync(e); showToast('Cor do painel atualizada.'); });
        });
        // Wire logo upload / remove
        grid.querySelectorAll('[data-action="upload-logo"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const pid = btn.getAttribute('data-painel-id');
            const file = grid.querySelector(`input[data-painel-file="${pid}"]`);
            if (file) file.click();
          });
        });
        grid.querySelectorAll('[data-action="remove-logo"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const pid = btn.getAttribute('data-painel-id');
            const target = paineis.find(p => p.id === pid);
            if (!target) return;
            target.logo = '';
            salvarPaineis();
            atualizarCreditos();
            showToast('Logo removida.');
          });
        });
        grid.querySelectorAll('input[data-painel-file]').forEach(inp => {
          inp.addEventListener('change', (e) => {
            const pid = inp.getAttribute('data-painel-file');
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!/^image\//.test(file.type)) { showToast('Selecione um arquivo de imagem.'); inp.value = ''; return; }
            if (file.size > 1024 * 1024) { showToast('Imagem muito grande (máx. 1 MB).'); inp.value = ''; return; }
            const reader = new FileReader();
            reader.onload = () => {
              const target = paineis.find(p => p.id === pid);
              if (!target) return;
              target.logo = String(reader.result || '');
              salvarPaineis();
              atualizarCreditos();
              showToast('Logo atualizada.');
            };
            reader.readAsDataURL(file);
          });
        });
      }
    }

    function atualizarSelectsPaineis() {
      const ids = ['pacotePainel', 'planoPainel', 'creditoAvulsoPainel', 'apPainel'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const cur = el.value;
        el.innerHTML = paineis.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
        if (cur && paineis.some(p => p.id === cur)) el.value = cur;
      });
    }

    function renderMovimentacaoHtml(m, realIdx) {
      const data = formatDateTimeSaoPaulo(m.data);
      const tipos = { novo: 'Cliente Novo', renovacao: 'Renovação', nao_renovou: 'Não Renovou', avulso: 'Desconto avulso', dias_extras: 'Dias extras' };
      if (m.tipo === 'add') {
        const labelInfo = m.info ? `${escapeHtml(m.info)}: ` : '';
        const avulsoTag = m.avulso ? ' <span class="pill pill-ok" style="font-size:10.5px;">avulso</span>' : '';
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: var(--primary);"><i class="fas fa-plus-circle"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${labelInfo}${m.quantidade} créditos${avulsoTag}</div>
                <div class="list-item-sub">${data} • Custo: R$ ${(m.custo || 0).toFixed(2)}</div>
              </div>
            </div>
            <button class="btn-secondary" onclick="editarMovimentacao(${realIdx})"><i class="fas fa-edit"></i></button>
            <button class="btn-danger" onclick="removerMovimentacao(${realIdx})"><i class="fas fa-trash"></i></button>
          </div>`;
      } else if (m.tipo === 'reserve') {
        const qtd = formatCreditos(m.quantidade || 0);
        const painelNome = getPainelNome(m.painelId);
        const valor = Number(m.pagamentoValor) || 0;
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: var(--warning);"><i class="fas fa-lock"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${m.clientNome ? escapeHtml(m.clientNome) : 'Pagamento pendente'} <span style="opacity:.6; font-weight:500;">• Crédito reservado</span></div>
                <div class="list-item-sub">${data} • ${qtd} créd. reservados${painelNome ? ` • ${escapeHtml(painelNome)}` : ''}${valor ? ` • R$ ${valor.toFixed(2)}` : ''}</div>
              </div>
            </div>
          </div>`;
      } else if (m.tipo === 'churn') {
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: var(--warning);"><i class="fas fa-user-times"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">Não Renovaram (legado): ${m.quantidade} cliente(s)</div>
                <div class="list-item-sub">${data} • Sem impacto nos créditos</div>
              </div>
            </div>
            <button class="btn-danger" onclick="removerMovimentacao(${realIdx})"><i class="fas fa-trash"></i></button>
          </div>`;
      } else if (m.tipo === 'teste') {
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: var(--info);"><i class="fas fa-flask"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${m.nome ? `<i class="fas fa-user" style="font-size:11px; color:var(--primary); margin-right:6px;"></i>${escapeHtml(m.nome)} <span style="opacity:.6; font-weight:500;">• Teste criado</span>` : 'Teste criado'}</div>
                <div class="list-item-sub">${data} • Sem impacto nos créditos</div>
              </div>
            </div>
            <button class="btn-danger" onclick="removerMovimentacao(${realIdx})"><i class="fas fa-trash"></i></button>
          </div>`;
      } else if (m.tipo === 'teste_excluido') {
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: #ff9b9b;"><i class="fas fa-vial-circle-check"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${m.nome ? `<i class="fas fa-user" style="font-size:11px; color:#ff9b9b; margin-right:6px;"></i>${escapeHtml(m.nome)} <span style="opacity:.6; font-weight:500;">• Teste excluído</span>` : 'Teste excluído'}</div>
                <div class="list-item-sub">${data} • Sem impacto nos créditos</div>
              </div>
            </div>
            <button class="btn-danger" onclick="removerMovimentacao(${realIdx})"><i class="fas fa-trash"></i></button>
          </div>`;
      } else {
        const qtdDec = Number(m.quantidade) || 0;
        const qtdInfo = qtdDec > 0
          ? ` • -${qtdDec === Math.floor(qtdDec) ? qtdDec : qtdDec.toFixed(3)} créd.`
          : '';
        const taxaInfo = (m.taxa && m.taxa > 0) ? ` • <span style="color:var(--warning);">Taxa R$ ${m.taxa.toFixed(2)}</span>` : '';
        const planoInfo = m.planoNome ? ` • ${escapeHtml(m.planoNome)}` : '';
        const diasInfo = (m.tipoCliente === 'dias_extras' && m.diasExtras) ? ` • <span style="color:var(--info);">${m.diasExtras} dia${m.diasExtras === 1 ? '' : 's'}</span>` : '';
        const tipoLabel = tipos[m.tipoCliente] || m.tipoCliente;
        const cliente = m.clientNome ? escapeHtml(m.clientNome) : '';
        const corTipo = m.tipoCliente === 'novo' ? 'var(--primary)'
          : (m.tipoCliente === 'renovacao' ? 'var(--info)'
          : (m.tipoCliente === 'dias_extras' ? 'var(--warning)'
          : (m.tipoCliente === 'avulso' ? '#ff9b9b' : '#ff9b9b')));
        const icone = m.tipoCliente === 'novo' ? 'user-plus'
          : (m.tipoCliente === 'renovacao' ? 'rotate-right'
          : (m.tipoCliente === 'dias_extras' ? 'calendar-plus'
          : (m.tipoCliente === 'avulso' ? 'minus-circle' : 'minus-circle')));
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: ${corTipo};"><i class="fas fa-${icone}"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${cliente ? `<i class="fas fa-user" style="font-size:11px; color:${corTipo}; margin-right:6px;"></i>${cliente} <span style="opacity:.6; font-weight:500;">• ${tipoLabel}</span>` : tipoLabel}</div>
                <div class="list-item-sub">${data} • R$ ${(m.valor || 0).toFixed(2)}${qtdInfo}${diasInfo}${planoInfo}${taxaInfo}</div>
              </div>
            </div>
            <button class="btn-secondary" onclick="editarMovimentacao(${realIdx})"><i class="fas fa-edit"></i></button>
            <button class="btn-danger" onclick="removerMovimentacao(${realIdx})"><i class="fas fa-trash"></i></button>
          </div>`;
      }
    }

    function atualizarHistorico() {
      const container = document.getElementById('historicoRecargas');
      const pagEl = document.getElementById('paginationHistorico');
      const cnt = document.getElementById('countHistorico');
      if (cnt) cnt.textContent = movimentacoes.length;
      if (!container) return;
      if (movimentacoes.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>Nenhuma movimentação registrada</p></div>';
        if (pagEl) pagEl.innerHTML = '';
        return;
      }
      const listaComIdx = movimentacoes.map((m, i) => ({ m, i })).sort((a, b) => (new Date(b.m.data)) - (new Date(a.m.data)));
      const pag = paginate(listaComIdx, state.historicoPage); state.historicoPage = pag.safePage;
      container.innerHTML = pag.items.map(({ m, i }) => renderMovimentacaoHtml(m, i)).join('');
      renderPagination(pagEl, pag.safePage, pag.totalPages, 'changeHistoricoPage');
    }

    function editarMovimentacao(idx) {
      movimentacaoEditando = idx;
      const m = movimentacoes[idx];
      let html = '';
      if (m.tipo === 'add') {
        html = `
          <div class="form-group">
            <label class="form-label"><i class="fas fa-hashtag"></i> Quantidade de Créditos</label>
            <input type="number" id="editQtd" class="form-input" value="${m.quantidade}">
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-money-bill-wave"></i> Valor Total (R$)</label>
            <input type="number" id="editValor" class="form-input" value="${m.custo}" step="0.01">
          </div>`;
      } else {
        html = `
          <div class="form-group">
            <label class="form-label"><i class="fas fa-user-tag"></i> Tipo de Cliente</label>
            <select id="editTipo" class="form-select">
              <option value="novo" ${m.tipoCliente === 'novo' ? 'selected' : ''}>Cliente Novo</option>
              <option value="renovacao" ${m.tipoCliente === 'renovacao' ? 'selected' : ''}>Renovação</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-dollar-sign"></i> Valor da Assinatura (R$)</label>
            <input type="number" id="editValor" class="form-input" value="${m.valor || 0}" step="0.01">
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-coins"></i> Créditos descontados</label>
            <input type="number" id="editQtdUse" class="form-input" value="${m.quantidade || 1}" min="0" step="1">
          </div>
          <div class="form-group">
            <label class="form-label"><i class="fas fa-percent"></i> Taxa Bancária (R$)</label>
            <input type="number" id="editTaxa" class="form-input" value="${m.taxa || 0}" min="0" step="0.01">
            <p class="card-hint" style="margin: 4px 0 0;">Valor da taxa cobrada nesta transação. Edite se necessário.</p>
          </div>`;
      }
      document.getElementById('formEditarMov').innerHTML = html;
      document.getElementById('modalEditarMov').classList.add('active');
    }
    function fecharModalEditarMov() { document.getElementById('modalEditarMov').classList.remove('active'); movimentacaoEditando = null; }
    function salvarEdicaoMov() {
      if (movimentacaoEditando === null) return;
      const m = movimentacoes[movimentacaoEditando];
      if (m.tipo === 'add') {
        const qtd = parseInt(document.getElementById('editQtd').value);
        const valor = parseFloat(document.getElementById('editValor').value);
        if (!qtd || !valor) { showToast('Preencha todos os campos.', true); return; }
        m.quantidade = qtd; m.custo = valor;
      } else {
        const tipo = document.getElementById('editTipo').value;
        const valor = parseFloat(document.getElementById('editValor').value);
        const qtdUse = parseInt(document.getElementById('editQtdUse').value);
        const taxa = parseFloat(document.getElementById('editTaxa').value);
        if (!tipo || isNaN(valor)) { showToast('Preencha todos os campos.', true); return; }
        m.tipoCliente = tipo; m.valor = valor;
        if (Number.isFinite(qtdUse) && qtdUse >= 0) m.quantidade = qtdUse;
        if (Number.isFinite(taxa) && taxa >= 0) m.taxa = taxa;
      }
      salvarMovimentacoes();
      atualizarCreditos(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      fecharModalEditarMov();
      showToast('Movimentação atualizada.');
    }
    function removerMovimentacao(idx) {
      if (!confirmar('Remover esta movimentação?')) return;
      movimentacoes.splice(idx, 1);
      salvarMovimentacoes();
      atualizarCreditos(); atualizarHistorico();
      atualizarSelectMesGestao();
      atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
    }
    window.editarMovimentacao = editarMovimentacao; window.removerMovimentacao = removerMovimentacao;
    window.fecharModalEditarMov = fecharModalEditarMov; window.salvarEdicaoMov = salvarEdicaoMov;

    function adicionarLucroCusto() {
      const valor = parseFloat(document.getElementById('valorLucroCusto').value);
      const info = document.getElementById('infoLucroCusto').value;
      if (isNaN(valor) || !info) { showToast('Preencha valor e informação.', true); return; }
      const fixoEl = document.querySelector('input[name="lc_fixo"]:checked');
      const fixo = !!(fixoEl && fixoEl.value === 'sim');
      lucrosCustos.push({ data: new Date().toISOString(), valor, info, fixo });
      salvarLucrosCustos();
      atualizarListaLucrosCustos();
      atualizarSelectMesGestao();
      atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      document.getElementById('valorLucroCusto').value = '';
      document.getElementById('infoLucroCusto').value = '';
      // reset radio para "Não"
      const naoR = document.querySelector('input[name="lc_fixo"][value="nao"]');
      if (naoR) naoR.checked = true;
      const lcNao = document.getElementById('lc_fixo_nao');
      const lcSim = document.getElementById('lc_fixo_sim');
      if (lcNao && lcSim) { lcNao.classList.add('active'); lcSim.classList.remove('active'); }
      showToast(fixo ? 'Lucro/Custo fixo adicionado (recorrente).' : 'Lucro/Custo adicionado.');
    }
    function atualizarListaLucrosCustos() {
      const lista = document.getElementById('listaLucrosCustos');
      const cnt = document.getElementById('countLucrosCustos');
      if (cnt) cnt.textContent = lucrosCustos.length;
      if (!lista) return;
      if (lucrosCustos.length === 0) { lista.innerHTML = '<div class="empty-state" style="padding:24px;"><i class="fas fa-chart-pie"></i><p>Nenhum lucro ou custo personalizado</p></div>'; return; }
      lista.innerHTML = lucrosCustos.map((lc, idx) => {
        const cor = lc.valor >= 0 ? 'var(--primary)' : '#ff9b9b';
        const tipo = lc.valor >= 0 ? 'Lucro' : 'Custo';
        const fixoBadge = lc.fixo
          ? `<span class="pill" style="background:rgba(255,228,92,.10); color:var(--warning); border-color:rgba(255,228,92,.35); font-size:11px;"><i class="fas fa-sync-alt" style="margin-right:4px;"></i>Fixo do mês</span>`
          : '';
        const dataStr = lc.data ? formatDateTimeSaoPaulo(lc.data) : '';
        return `
          <div class="list-item" data-testid="lc-item-${idx}">
            <div class="list-item-content">
              <div class="list-item-icon" style="color:${cor};"><i class="fas fa-${lc.valor >= 0 ? 'arrow-up' : 'arrow-down'}"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  ${escapeHtml(lc.info)} ${fixoBadge}
                </div>
                <div class="list-item-sub">${tipo} • Cadastrado em ${dataStr}${lc.fixo ? ' • Replicado mensalmente' : ''}</div>
              </div>
            </div>
            <div class="list-item-badge" style="color:${cor}; background:${lc.valor >= 0 ? 'rgba(57,255,20,.08)' : 'rgba(255,92,92,.08)'}; border-color:${lc.valor >= 0 ? 'rgba(57,255,20,.25)' : 'rgba(255,92,92,.25)'};">R$ ${Math.abs(lc.valor).toFixed(2)}</div>
            <button class="btn-danger" onclick="removerLucroCusto(${idx})" data-testid="btn-remover-lc-${idx}"><i class="fas fa-trash"></i></button>
          </div>`;
      }).join('');
    }
    function removerLucroCusto(idx) {
      const lc = lucrosCustos[idx];
      if (!lc) return;
      lucrosCustos.splice(idx, 1);
      salvarLucrosCustos();
      atualizarListaLucrosCustos(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      atualizarSelectMesGestao();
      showToast(`"${lc.info}" removido.`);
    }
    window.adicionarLucroCusto = adicionarLucroCusto; window.removerLucroCusto = removerLucroCusto;

    function atualizarListaPacotes() {
      const lista = document.getElementById('listaPacotes');
      const cnt = document.getElementById('countPacotes');
      if (cnt) cnt.textContent = pacotes.length;
      if (pacotes.length === 0) { lista.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Nenhum pacote cadastrado</p></div>'; return; }
      lista.innerHTML = pacotes.map(p => {
        const painelCls = getPainelIdxClass(p.painelId);
        const painelNome = getPainelNome(p.painelId);
        return `
        <div class="list-item" data-testid="pacote-item-${p.id}">
          <div class="list-item-content">
            <div class="list-item-icon"><i class="fas fa-box"></i></div>
            <div>
              <div class="list-item-text">${p.quantidade} créditos <span class="painel-badge ${painelCls}" data-testid="pacote-painel-badge-${p.id}"><i class="fas fa-layer-group" style="font-size:9px;"></i> ${escapeHtml(painelNome)}</span></div>
              <div class="list-item-sub">Total: R$ ${(p.quantidade * p.preco).toFixed(2)}</div>
            </div>
          </div>
          <div class="list-item-badge">R$ ${p.preco.toFixed(2)} /un</div>
          <button class="btn-info" onclick="editarPacote(${p.id})" data-testid="btn-editar-pacote-${p.id}"><i class="fas fa-edit"></i></button>
          <button class="btn-danger" onclick="removerPacote(${p.id})"><i class="fas fa-trash"></i></button>
        </div>`;
      }).join('');
    }
    function atualizarSelectPacotes() {
      const select = document.getElementById('pacoteSelecionado');
      select.innerHTML = '<option value="">Selecione um pacote</option>' +
        pacotes.map(p => `<option value="${p.id}">${p.quantidade} créditos - R$ ${p.preco.toFixed(2)} cada</option>`).join('');
    }
    let pacoteEditandoId = null;
    function abrirModalPacote() {
      pacoteEditandoId = null;
      document.querySelector('#modalPacote .modal-title').textContent = 'Adicionar Pacote';
      atualizarSelectsPaineis();
      const selPainel = document.getElementById('pacotePainel');
      if (selPainel) selPainel.value = paineis[0].id;
      document.getElementById('modalPacote').classList.add('active');
      document.getElementById('qtdCreditos').value = ''; document.getElementById('precoCredito').value = '';
    }
    function editarPacote(id) {
      const p = pacotes.find(x => x.id === id); if (!p) return;
      pacoteEditandoId = id;
      document.querySelector('#modalPacote .modal-title').textContent = 'Editar Pacote';
      document.getElementById('qtdCreditos').value = p.quantidade;
      document.getElementById('precoCredito').value = p.preco;
      atualizarSelectsPaineis();
      const selPainel = document.getElementById('pacotePainel');
      if (selPainel) selPainel.value = p.painelId || paineis[0].id;
      document.getElementById('modalPacote').classList.add('active');
    }
    function fecharModalPacote() { document.getElementById('modalPacote').classList.remove('active'); pacoteEditandoId = null; }
    function salvarPacote() {
      const quantidade = parseInt(document.getElementById('qtdCreditos').value);
      const preco = parseFloat(document.getElementById('precoCredito').value);
      const painelId = (document.getElementById('pacotePainel') || {}).value || paineis[0].id;
      if (!quantidade || !preco) { showToast('Preencha todos os campos.', true); return; }
      if (pacoteEditandoId) {
        const idx = pacotes.findIndex(p => p.id === pacoteEditandoId);
        if (idx >= 0) pacotes[idx] = { id: pacoteEditandoId, quantidade, preco, painelId };
      } else {
        const novoId = pacotes.length > 0 ? Math.max(...pacotes.map(p => p.id)) + 1 : 1;
        pacotes.push({ id: novoId, quantidade, preco, painelId });
      }
      salvarPacotes();
      atualizarListaPacotes(); atualizarSelectPacotes(); atualizarSelectPacotesAddCredito();
      fecharModalPacote();
      showToast(pacoteEditandoId ? 'Pacote atualizado.' : 'Pacote adicionado.');
    }
    function removerPacote(id) {
      if (!confirmar('Remover este pacote?')) return;
      pacotes = pacotes.filter(p => p.id !== id);
      salvarPacotes(); atualizarListaPacotes(); atualizarSelectPacotes(); atualizarSelectPacotesAddCredito();
    }
    window.abrirModalPacote = abrirModalPacote; window.fecharModalPacote = fecharModalPacote;
    window.salvarPacote = salvarPacote; window.removerPacote = removerPacote; window.editarPacote = editarPacote;

    document.getElementById('headerPacotes').addEventListener('click', () => { document.getElementById('cardPacotes').classList.toggle('collapsed'); });
    document.getElementById('headerPlanos').addEventListener('click', () => { document.getElementById('cardPlanos').classList.toggle('collapsed'); });
    document.getElementById('headerGestaoCreditos').addEventListener('click', () => { document.getElementById('cardGestaoCreditos').classList.toggle('collapsed'); });
    document.getElementById('headerHistorico').addEventListener('click', () => { document.getElementById('cardHistorico').classList.toggle('collapsed'); });
    document.getElementById('headerLucrosCustos').addEventListener('click', () => { document.getElementById('cardLucrosCustos').classList.toggle('collapsed'); });
    document.getElementById('headerHistoricoTaxas').addEventListener('click', () => { document.getElementById('cardHistoricoTaxas').classList.toggle('collapsed'); });

    // Dashboard collapsible cards (vencimentos)
    document.querySelectorAll('#dashboard .card-header.collapsible').forEach(header => {
      header.addEventListener('click', () => { header.closest('.card').classList.toggle('collapsed'); });
    });

    (function wireLcRadio() {
      const sim = document.getElementById('lc_fixo_sim');
      const nao = document.getElementById('lc_fixo_nao');
      if (!sim || !nao) return;
      function update() {
        const v = document.querySelector('input[name="lc_fixo"]:checked').value;
        if (v === 'sim') { sim.classList.add('active'); nao.classList.remove('active'); }
        else { nao.classList.add('active'); sim.classList.remove('active'); }
      }
      sim.addEventListener('click', () => { sim.querySelector('input').checked = true; update(); });
      nao.addEventListener('click', () => { nao.querySelector('input').checked = true; update(); });
    })();

    (function wirePagRadio() {
      const realizado = document.getElementById('pag_realizado');
      const pendente = document.getElementById('pag_pendente');
      if (!realizado || !pendente) return;
      function update() {
        const v = document.querySelector('input[name="pag_status"]:checked').value;
        if (v === 'realizado') { realizado.classList.add('active'); pendente.classList.remove('active'); }
        else { pendente.classList.add('active'); realizado.classList.remove('active'); }
      }
      realizado.addEventListener('click', () => { realizado.querySelector('input').checked = true; update(); });
      pendente.addEventListener('click', () => { pendente.querySelector('input').checked = true; update(); });
    })();

    function adicionarAssinatura() {
      const quantidade = parseInt(document.getElementById('qtdAssinatura').value);
      const valor = parseFloat(document.getElementById('valorAssinatura').value);
      if (!quantidade || !valor) { showToast('Preencha quantidade e valor.', true); return; }
      assinaturas.push({ quantidade, valor }); atualizarListaAssinaturas();
      document.getElementById('qtdAssinatura').value = ''; document.getElementById('valorAssinatura').value = '';
    }
    function atualizarListaAssinaturas() {
      const lista = document.getElementById('listaAssinaturas');
      if (assinaturas.length === 0) { lista.innerHTML = '<div class="empty-state" style="padding:24px;"><i class="fas fa-users"></i><p>Nenhuma assinatura adicionada</p></div>'; return; }
      lista.innerHTML = assinaturas.map((a, idx) => `
        <div class="assinatura-item">
          <span class="cost-name"><i class="fas fa-users"></i>${a.quantidade} clientes</span>
          <span class="cost-value">R$ ${a.valor.toFixed(2)} cada</span>
          <button class="btn-danger" onclick="removerAssinatura(${idx})"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    }
    function removerAssinatura(i) { assinaturas.splice(i, 1); atualizarListaAssinaturas(); }
    window.adicionarAssinatura = adicionarAssinatura; window.removerAssinatura = removerAssinatura;

    function adicionarCusto() {
      const valor = parseFloat(document.getElementById('valorCusto').value);
      const descricao = document.getElementById('descricaoCusto').value;
      if (!valor || !descricao) { showToast('Preencha valor e descrição.', true); return; }
      custos.push({ valor, descricao }); atualizarListaCustos();
      document.getElementById('valorCusto').value = ''; document.getElementById('descricaoCusto').value = '';
    }
    function atualizarListaCustos() {
      const lista = document.getElementById('listaCustos');
      if (custos.length === 0) { lista.innerHTML = '<div class="empty-state" style="padding:24px;"><i class="fas fa-wallet"></i><p>Nenhum custo adicionado</p></div>'; return; }
      lista.innerHTML = custos.map((c, idx) => `
        <div class="cost-item">
          <span class="cost-value">R$ ${c.valor.toFixed(2)}</span>
          <span class="cost-name"><i class="fas fa-tag"></i>${escapeHtml(c.descricao)}</span>
          <button class="btn-danger" onclick="removerCusto(${idx})"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    }
    function removerCusto(i) { custos.splice(i, 1); atualizarListaCustos(); }
    window.adicionarCusto = adicionarCusto; window.removerCusto = removerCusto;

    function calcular() {
      const pacoteId = parseInt(document.getElementById('pacoteSelecionado').value);
      if (!pacoteId || assinaturas.length === 0) { showToast('Selecione um pacote e adicione assinaturas.', true); return; }
      const pacote = pacotes.find(p => p.id === pacoteId);
      const totalClientes = assinaturas.reduce((t, a) => t + a.quantidade, 0);
      const faturamento = assinaturas.reduce((t, a) => t + (a.quantidade * a.valor), 0);
      const custoCredito = pacote.preco * totalClientes;
      const custoExtra = custos.reduce((t, c) => t + c.valor, 0);
      const custoTotal = custoCredito + custoExtra;
      const lucro = faturamento - custoTotal;
      document.getElementById('resultado').innerHTML = `
        <div class="result-box">
          <div class="result-section">
            <h3><i class="fas fa-box"></i> Pacote</h3>
            <div class="result-row">
              <div class="result-label">Pacote selecionado</div>
              <div class="result-value">${pacote.quantidade} créditos • R$ ${pacote.preco.toFixed(2)} cada</div>
            </div>
          </div>
          <div class="result-section">
            <h3><i class="fas fa-users"></i> Assinaturas</h3>
            ${assinaturas.map(a => `
              <div class="result-row">
                <div class="result-label">${a.quantidade} × R$ ${a.valor.toFixed(2)}</div>
                <div class="result-value">R$ ${(a.quantidade * a.valor).toFixed(2)}</div>
              </div>`).join('')}
            <div class="result-row large">
              <div class="result-label">Total faturamento</div>
              <div class="result-value">R$ ${faturamento.toFixed(2)}</div>
            </div>
          </div>
          <div class="result-section">
            <h3><i class="fas fa-file-invoice-dollar"></i> Custos</h3>
            <div class="result-row">
              <div class="result-label">Custo créditos (${totalClientes} clientes)</div>
              <div class="result-value">R$ ${custoCredito.toFixed(2)}</div>
            </div>
            ${custos.map(c => `
              <div class="result-row">
                <div class="result-label">${escapeHtml(c.descricao)}</div>
                <div class="result-value">R$ ${c.valor.toFixed(2)}</div>
              </div>`).join('')}
            <div class="result-row large">
              <div class="result-label">Custo total</div>
              <div class="result-value" style="color:#ff9b9b;">R$ ${custoTotal.toFixed(2)}</div>
            </div>
          </div>
          <div class="result-section">
            <h3><i class="fas fa-trophy"></i> Resultado</h3>
            <div class="result-row large" style="font-size:20px;">
              <div class="result-label">Lucro total</div>
              <div class="result-value">R$ ${lucro.toFixed(2)}</div>
            </div>
            <div class="result-row">
              <div class="result-label">Lucro por cliente</div>
              <div class="result-value">R$ ${(lucro / totalClientes).toFixed(2)}</div>
            </div>
          </div>
        </div>`;
    }
    window.calcular = calcular;

    /* ---------- GESTÃO: filtro por mês ---------- */
    function monthKey(dateLike) {
      const parts = getZonedDateParts(dateLike);
      if (!parts) return null;
      return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    }
    function monthLabel(k) {
      const [y, mo] = k.split('-');
      return `${MONTH_NAMES_LONG[Number(mo) - 1]} de ${y}`;
    }
    function coletarMesesDisponiveis() {
      const set = new Set();
      movimentacoes.forEach(m => { const k = monthKey(m.data); if (k) set.add(k); });
      lucrosCustos.forEach(lc => {
        const k = monthKey(lc.data); if (!k) return;
        set.add(k);
        if (lc.fixo) {
          const now = new Date();
          const cy = now.getFullYear(), cm = now.getMonth() + 1;
          const [sy, sm] = k.split('-').map(Number);
          for (let y = sy, mo = sm; (y < cy) || (y === cy && mo <= cm); ) {
            set.add(`${y}-${String(mo).padStart(2, '0')}`);
            mo += 1; if (mo > 12) { mo = 1; y += 1; }
          }
        }
      });
      clients.forEach(c => {
        const due = parseDate(c.dataRenovacao);
        if (due) set.add(`${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`);
      });
      const now = new Date();
      set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      return Array.from(set).sort((a, b) => b.localeCompare(a));
    }
    function atualizarSelectMesGestao() {
      const sel = document.getElementById('filtroMesGestao'); if (!sel) return;
      const meses = coletarMesesDisponiveis();
      const prev = state.filtroMes;
      sel.innerHTML = '<option value="all">Todos os meses</option>' +
        meses.map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('');
      if (prev && (prev === 'all' || meses.includes(prev))) sel.value = prev;
      else { sel.value = 'all'; state.filtroMes = 'all'; }
    }
    document.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'filtroMesGestao') {
        state.filtroMes = e.target.value;
        atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao();
      }
    });

    function passaFiltroMes(dateLike) {
      if (state.filtroMes === 'all') return true;
      return monthKey(dateLike) === state.filtroMes;
    }

    /* Quantas vezes uma entrada de lucro/custo deve ser contabilizada
       no filtro atual. Se for fixo, replica de cada mês desde a criação. */
    function ocorrenciasLucroCusto(lc) {
      if (!lc || !lc.fixo) return passaFiltroMes(lc ? lc.data : null) ? 1 : 0;
      const startKey = monthKey(lc.data);
      if (!startKey) return 0;
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (state.filtroMes === 'all') {
        const [sy, sm] = startKey.split('-').map(Number);
        const [cy, cm] = currentKey.split('-').map(Number);
        const months = (cy - sy) * 12 + (cm - sm) + 1;
        return Math.max(0, months);
      }
      // mês específico: aplica se o mês de cadastro <= mês filtrado
      return startKey <= state.filtroMes ? 1 : 0;
    }

    function computeTotaisFinanceiros() {
      let custo = 0, lucro = 0, taxas = 0;
      movimentacoes.forEach(m => {
        if (!passaFiltroMes(m.data)) return;
        if (m.tipo === 'add') custo += (m.custo || 0);
        else if (m.tipo === 'use') {
          lucro += (m.valor || 0);
          taxas += (m.taxa || 0);
        }
      });
      lucrosCustos.forEach(lc => {
        const ocorr = ocorrenciasLucroCusto(lc);
        if (ocorr === 0) return;
        if (lc.valor >= 0) lucro += lc.valor * ocorr;
        else custo += Math.abs(lc.valor) * ocorr;
      });
      return { custo, lucro, taxas, liquido: lucro - custo - taxas };
    }

    function atualizarStatsFinanceiras() {
      const { custo, lucro, taxas, liquido } = computeTotaisFinanceiros();
      const fmt = v => `R$ ${v.toFixed(2).replace('.', ',')}`;
      const elL = document.getElementById('totalLucro');
      const elC = document.getElementById('totalCusto');
      const elT = document.getElementById('totalTaxas');
      const elN = document.getElementById('totalLiquido');
      if (elL) elL.textContent = fmt(lucro);
      if (elC) elC.textContent = fmt(custo);
      if (elT) elT.textContent = fmt(taxas);
      if (elN) { elN.textContent = fmt(liquido); elN.style.color = liquido >= 0 ? 'var(--info)' : '#ff9b9b'; }
      atualizarDetalheTaxas();
      try { atualizarDashboardFinanceiro(); } catch (e) {}
    }
    window.atualizarStatsFinanceiras = atualizarStatsFinanceiras;

    /* ---------- DASHBOARD: stats financeiras + gráfico ---------- */
    let dashGraficoMes = null;

    function getCurrentMonthKey() {
      const parts = getZonedDateParts(new Date());
      return parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : monthKey(new Date());
    }

    function getDashboardSelectedMonthKey() {
      return `${state.dashChartYear}-${state.dashChartMonth}`;
    }

    function coletarAnosDisponiveisDashboard() {
      const years = new Set([getCurrentZonedYear()]);
      movimentacoes.forEach(m => {
        const parts = getZonedDateParts(m.data);
        if (parts) years.add(parts.year);
      });
      return Array.from(years).sort((a, b) => b - a);
    }

    function atualizarRelogioBrasilia() {
      const el = document.getElementById('brasiliaNow');
      if (!el) return;
      el.textContent = `Brasília • ${zonedClockFormatter.format(new Date())}`;
    }

    function atualizarFiltrosDashboardGrafico() {
      const anoEl = document.getElementById('dashFiltroAno');
      const mesEl = document.getElementById('dashFiltroMes');
      if (!anoEl || !mesEl) return;
      const anos = coletarAnosDisponiveisDashboard();
      if (!anos.includes(state.dashChartYear)) state.dashChartYear = anos[0] || getCurrentZonedYear();
      anoEl.innerHTML = anos.map(year => `<option value="${year}">${year}</option>`).join('');
      anoEl.value = String(state.dashChartYear);

      const prev = state.dashChartMonth;
      mesEl.innerHTML = '<option value="all">Ano todo</option>' +
        MONTH_NAMES_LONG.map((month, idx) => `<option value="${String(idx + 1).padStart(2, '0')}">${month}</option>`).join('');
      mesEl.value = prev || String(getZonedDateParts(new Date())?.month || 1).padStart(2, '0');
      state.dashChartMonth = mesEl.value;
      atualizarRelogioBrasilia();
    }

    function getDashboardChartSeries() {
      const isYearView = state.dashChartMonth === 'all';
      const labels = [];
      const dataNovos = [];
      const dataRenov = [];
      const dataTestes = [];
      const year = Number(state.dashChartYear);

      if (isYearView) {
        const porMes = Array.from({ length: 12 }, () => ({ novos: 0, renovacoes: 0, testes: 0 }));
        movimentacoes.forEach(m => {
          const parts = getZonedDateParts(m.data);
          if (!parts || parts.year !== year) return;
          const idx = parts.month - 1;
          if (m.tipo === 'use' && m.tipoCliente === 'novo') porMes[idx].novos += 1;
          else if (m.tipo === 'use' && (m.tipoCliente === 'renovacao' || m.tipoCliente === 'dias_extras')) porMes[idx].renovacoes += 1;
          else if (m.tipo === 'teste') porMes[idx].testes += (m.quantidade || 1);
        });
        MONTH_NAMES_SHORT.forEach((month, idx) => {
          labels.push(month);
          dataNovos.push(porMes[idx].novos);
          dataRenov.push(porMes[idx].renovacoes);
          dataTestes.push(porMes[idx].testes);
        });
        return {
          isYearView,
          labels,
          dataNovos,
          dataRenov,
          dataTestes,
          tag: `Ano todo • ${year}`,
          tickLabel: 'Meses'
        };
      }

      const month = Number(state.dashChartMonth);
      const daysInMonth = new Date(year, month, 0).getDate();
      const porDia = Array.from({ length: daysInMonth }, () => ({ novos: 0, renovacoes: 0, testes: 0 }));
      movimentacoes.forEach(m => {
        const parts = getZonedDateParts(m.data);
        if (!parts || parts.year !== year || parts.month !== month) return;
        const idx = parts.day - 1;
        if (m.tipo === 'use' && m.tipoCliente === 'novo') porDia[idx].novos += 1;
        else if (m.tipo === 'use' && (m.tipoCliente === 'renovacao' || m.tipoCliente === 'dias_extras')) porDia[idx].renovacoes += 1;
        else if (m.tipo === 'teste') porDia[idx].testes += (m.quantidade || 1);
      });
      for (let day = 1; day <= daysInMonth; day++) {
        labels.push(String(day).padStart(2, '0'));
        dataNovos.push(porDia[day - 1].novos);
        dataRenov.push(porDia[day - 1].renovacoes);
        dataTestes.push(porDia[day - 1].testes);
      }
      return {
        isYearView,
        labels,
        dataNovos,
        dataRenov,
        dataTestes,
        tag: `${MONTH_NAMES_LONG[month - 1]} de ${year}`,
        tickLabel: 'Dias do mês'
      };
    }

    function computeTotaisMesAtual() {
      const mk = getCurrentMonthKey();
      let custo = 0, lucro = 0, taxas = 0;
      movimentacoes.forEach(m => {
        if (monthKey(m.data) !== mk) return;
        if (m.tipo === 'add') custo += (m.custo || 0);
        else if (m.tipo === 'use') {
          lucro += (m.valor || 0);
          taxas += (m.taxa || 0);
        }
      });
      // Lucros/custos fixos do mês atual
      lucrosCustos.forEach(lc => {
        const startKey = monthKey(lc.data);
        if (!startKey) return;
        if (lc.fixo) {
          if (startKey <= mk) {
            if (lc.valor >= 0) lucro += lc.valor;
            else custo += Math.abs(lc.valor);
          }
        } else {
          if (monthKey(lc.data) === mk) {
            if (lc.valor >= 0) lucro += lc.valor;
            else custo += Math.abs(lc.valor);
          }
        }
      });
      return { custo, lucro, taxas, liquido: lucro - custo - taxas };
    }

    function computeLucroEstimadoMes() {
      // Previsão: soma o valor do plano de todos os clientes ativos (não vencidos),
      // representando a receita esperada caso todos paguem normalmente.
      const today = todayLocalDate();
      let total = 0;
      clients.forEach(c => {
        const due = parseDate(c.dataRenovacao);
        const ativo = !due || diffInDays(due, today) >= 0;
        if (ativo) total += parseValor(c.valor);
      });
      return total;
    }

    function atualizarDashboardFinanceiro() {
      const { custo, lucro, taxas, liquido } = computeTotaisMesAtual();
      const fmt = v => `R$ ${v.toFixed(2).replace('.', ',')}`;
      const elL = document.getElementById('dashTotalLucro');
      const elC = document.getElementById('dashTotalCusto');
      const elT = document.getElementById('dashTotalTaxas');
      const elN = document.getElementById('dashTotalLiquido');
      const elE = document.getElementById('dashLucroEstimado');
      if (elL) elL.textContent = fmt(lucro);
      if (elC) elC.textContent = fmt(custo);
      if (elT) elT.textContent = fmt(taxas);
      if (elN) { elN.textContent = fmt(liquido); elN.style.color = liquido >= 0 ? 'var(--info)' : '#ff9b9b'; }
      if (elE) elE.textContent = fmt(computeLucroEstimadoMes());

      atualizarFiltrosDashboardGrafico();
      const tagEl = document.getElementById('dashChartMesTag');
      const chartData = getDashboardChartSeries();
      if (tagEl) tagEl.textContent = chartData.tag;

      atualizarGraficoMesAtual();

      const today = todayLocalDate();
      const mk = getCurrentMonthKey();
      let testesMes = 0;
      movimentacoes.forEach(m => {
        if (m.tipo === 'teste' && monthKey(m.data) === mk) testesMes += (m.quantidade || 1);
      });
      let ativos = 0, vencidos = 0, vence7 = 0;
      clients.forEach(c => {
        const due = parseDate(c.dataRenovacao);
        if (!due) { ativos++; return; }
        const d = diffInDays(due, today);
        if (d < 0) vencidos++;
        else if (d >= 0 && d <= 7) vence7++;
        if (d >= 0) ativos++;
      });
      const elTM = document.getElementById('dashTestesMes');
      const elCA = document.getElementById('dashClientesAtivos');
      const elCV = document.getElementById('dashClientesVencidos');
      const elV7 = document.getElementById('dashVence7Dias');
      if (elTM) elTM.textContent = testesMes;
      if (elCA) elCA.textContent = ativos;
      if (elCV) elCV.textContent = vencidos;
      if (elV7) elV7.textContent = vence7;
      renderDashboardPendingBoxes();
    }

    function atualizarGraficoMesAtual() {
      const parent = document.querySelector('#dashboard .chart-container');
      if (!parent) return;
      const { labels, dataNovos, dataRenov, dataTestes, isYearView, tickLabel } = getDashboardChartSeries();
      if (!document.getElementById('dashGraficoMes')) { parent.innerHTML = '<canvas id="dashGraficoMes"></canvas>'; dashGraficoMes = null; }
      const canvas = document.getElementById('dashGraficoMes');
      // Se o gráfico já existe, só atualiza os dados (sem destruir/recriar) — evita travamentos
      // causados por recalcular e reanimar o gráfico inteiro a cada render (que acontece com muita frequência).
      if (dashGraficoMes) {
        dashGraficoMes.data.labels = labels;
        dashGraficoMes.data.datasets[0].data = dataNovos;
        dashGraficoMes.data.datasets[1].data = dataRenov;
        dashGraficoMes.data.datasets[2].data = dataTestes;
        dashGraficoMes.options.scales.x.ticks.autoSkip = isYearView;
        dashGraficoMes.options.scales.x.title.text = tickLabel;
        dashGraficoMes.update('none');
        return;
      }
      const ctx = canvas.getContext('2d');
      const gradNovos = ctx.createLinearGradient(0, 0, 0, 300);
      gradNovos.addColorStop(0, 'rgba(24,24,26,.16)');
      gradNovos.addColorStop(1, 'rgba(24,24,26,0)');
      const gradRenov = ctx.createLinearGradient(0, 0, 0, 300);
      gradRenov.addColorStop(0, 'rgba(78,90,114,.18)');
      gradRenov.addColorStop(1, 'rgba(78,90,114,0)');
      const gradTestes = ctx.createLinearGradient(0, 0, 0, 300);
      gradTestes.addColorStop(0, 'rgba(165,105,15,.16)');
      gradTestes.addColorStop(1, 'rgba(165,105,15,0)');

      dashGraficoMes = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Novos', data: dataNovos, backgroundColor: gradNovos, borderColor: '#18181a', borderWidth: 2.5, tension: .35, fill: true, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#18181a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, pointHitRadius: 12 },
            { label: 'Renovações', data: dataRenov, backgroundColor: gradRenov, borderColor: '#4e5a72', borderWidth: 2.5, tension: .35, fill: true, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#4e5a72', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, pointHitRadius: 12 },
            { label: 'Testes', data: dataTestes, backgroundColor: gradTestes, borderColor: '#a5690f', borderWidth: 2.5, tension: .35, fill: true, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#a5690f', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, pointHitRadius: 12 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 300, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top', align: 'end',
              labels: { color: '#4a4d53', font: { size: 12, weight: '600', family: "'Inter Tight', system-ui, sans-serif" }, padding: 16, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 }
            },
            tooltip: {
              backgroundColor: '#ffffff', titleColor: '#17181b', bodyColor: '#4a4d53',
              borderColor: 'rgba(15,15,17,.10)', borderWidth: 1, padding: 12, cornerRadius: 10,
              titleFont: { size: 12, weight: '700' }, bodyFont: { size: 12, weight: '500' },
              boxPadding: 6, usePointStyle: true,
              titleMarginBottom: 6
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: 'rgba(15,15,17,.06)', drawTicks: false },
              ticks: { color: '#9a9da3', precision: 0, padding: 8, font: { size: 11 } }
            },
            x: {
              border: { display: false },
              grid: { display: false },
              ticks: { color: '#9a9da3', font: { size: 11 }, maxRotation: 0, autoSkip: isYearView, padding: 6 },
              title: { display: true, text: tickLabel, color: '#74777e', font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }
    window.atualizarDashboardFinanceiro = atualizarDashboardFinanceiro;

    function atualizarDetalheTaxas() {
      const cont = document.getElementById('detalheTaxas');
      const cnt = document.getElementById('countTaxas');
      if (!cont) return;
      const porPlano = {};
      let totalTransacoes = 0;
      movimentacoes.forEach(m => {
        if (!passaFiltroMes(m.data)) return;
        if (m.tipo !== 'use') return;
        if (!m.taxa || m.taxa <= 0) return;
        const nome = m.planoNome || 'Sem plano';
        if (!porPlano[nome]) porPlano[nome] = { total: 0, qtd: 0, valor: 0 };
        porPlano[nome].total += m.taxa;
        porPlano[nome].qtd += 1;
        porPlano[nome].valor += (m.valor || 0);
        totalTransacoes += 1;
      });
      if (cnt) cnt.textContent = totalTransacoes;
      const nomes = Object.keys(porPlano);
      if (nomes.length === 0) {
        cont.innerHTML = '<div class="empty-state"><i class="fas fa-percent"></i><p>Nenhuma taxa registrada no período. Cadastre uma taxa nos planos disponíveis em Configuração → Planos.</p></div>';
        return;
      }
      nomes.sort((a, b) => porPlano[b].total - porPlano[a].total);
      cont.innerHTML = nomes.map(n => {
        const d = porPlano[n];
        const planoCad = encontrarPlanoPorNome(n);
        const taxaInfo = planoCad ? descricaoTaxaPlano(planoCad) : '—';
        const pctSobreFat = d.valor > 0 ? ((d.total / d.valor) * 100).toFixed(2) : '0.00';
        return `
          <div class="list-item" data-testid="detalhe-taxa-${escapeHtml(n).replace(/\s+/g, '-')}">
            <div class="list-item-content">
              <div class="list-item-icon" style="color: var(--warning);"><i class="fas fa-percent"></i></div>
              <div style="flex:1; min-width:0;">
                <div class="list-item-text">${escapeHtml(n)}</div>
                <div class="list-item-sub">${d.qtd} transação${d.qtd === 1 ? '' : 'ões'} • Faturamento: R$ ${d.valor.toFixed(2)} • Taxa configurada: ${escapeHtml(taxaInfo)} • ${pctSobreFat}% do faturamento</div>
              </div>
            </div>
            <div class="list-item-badge" style="background: rgba(255,228,92,.08); color: var(--warning); border-color: rgba(255,228,92,.25);">R$ ${d.total.toFixed(2)}</div>
          </div>`;
      }).join('');
    }

    function atualizarGraficoClientes() {
      const parent = document.querySelector('#gestao .chart-container');
      if (!parent) return;
      const porMes = {};
      const ensure = k => { if (!porMes[k]) porMes[k] = { novos: 0, renovacoes: 0, naoRenovou: 0, vencidos: 0, testes: 0 }; };
      movimentacoes.forEach(m => {
        if (!passaFiltroMes(m.data)) return;
        const k = monthKey(m.data); if (!k) return;
        ensure(k);
        if (m.tipo === 'use' && m.tipoCliente === 'novo') porMes[k].novos += 1;
        else if (m.tipo === 'use' && m.tipoCliente === 'renovacao') porMes[k].renovacoes += 1;
        else if (m.tipo === 'churn') porMes[k].naoRenovou += (m.quantidade || 1);
        else if (m.tipo === 'teste') porMes[k].testes += (m.quantidade || 1);
      });
      const today = todayLocalDate();
      clients.forEach(c => {
        const due = parseDate(c.dataRenovacao); if (!due) return;
        const overdue = diffInDays(today, due);
        if (overdue <= 0) return;
        if (overdue >= 20) {
          const churnDate = addDays(due, 20);
          const k = `${churnDate.getFullYear()}-${String(churnDate.getMonth() + 1).padStart(2, '0')}`;
          if (state.filtroMes !== 'all' && k !== state.filtroMes) return;
          ensure(k); porMes[k].naoRenovou += 1;
        } else {
          const k = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
          if (state.filtroMes !== 'all' && k !== state.filtroMes) return;
          ensure(k); porMes[k].vencidos += 1;
        }
      });
      if (Object.keys(porMes).length === 0) {
        if (graficoClientes) { graficoClientes.destroy(); graficoClientes = null; }
        parent.innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i><p>Sem dados para o filtro selecionado</p></div>';
        return;
      }
      if (!document.getElementById('graficoClientes')) { parent.innerHTML = '<canvas id="graficoClientes"></canvas>'; graficoClientes = null; }
      const canvas = document.getElementById('graficoClientes');
      const meses = Object.keys(porMes).sort();
      const labels = meses.map(m => {
        const [y, mo] = m.split('-');
        return new Date(y, mo - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      });
      const tituloTexto = state.filtroMes === 'all' ? 'Movimentação mensal de clientes' : `Movimentação em ${monthLabel(state.filtroMes)}`;
      // Se o gráfico já existe, só atualiza os dados (sem destruir/recriar) — evita travamentos
      // causados por recalcular e reanimar o gráfico inteiro a cada ação (renovação, crédito, etc).
      if (graficoClientes) {
        graficoClientes.data.labels = labels;
        graficoClientes.data.datasets[0].data = meses.map(m => porMes[m].testes);
        graficoClientes.data.datasets[1].data = meses.map(m => porMes[m].novos);
        graficoClientes.data.datasets[2].data = meses.map(m => porMes[m].renovacoes);
        graficoClientes.data.datasets[3].data = meses.map(m => porMes[m].naoRenovou);
        graficoClientes.data.datasets[4].data = meses.map(m => porMes[m].vencidos);
        graficoClientes.options.plugins.title.text = tituloTexto;
        graficoClientes.update('none');
        return;
      }
      graficoClientes = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Testes', data: meses.map(m => porMes[m].testes), borderColor: '#ffe45c', backgroundColor: 'rgba(255,228,92,.15)', borderWidth: 3, tension: .4, fill: false, pointRadius: 4, pointHoverRadius: 6 },
            { label: 'Novos Clientes', data: meses.map(m => porMes[m].novos), borderColor: '#39ff14', backgroundColor: 'rgba(57,255,20,.18)', borderWidth: 3, tension: .4, fill: false, pointRadius: 4, pointHoverRadius: 6 },
            { label: 'Renovações', data: meses.map(m => porMes[m].renovacoes), borderColor: '#5cf0ff', backgroundColor: 'rgba(92,240,255,.18)', borderWidth: 3, tension: .4, fill: false, pointRadius: 4, pointHoverRadius: 6 },
            { label: 'Não Renovaram (20+ dias)', data: meses.map(m => porMes[m].naoRenovou), borderColor: '#ff9b5c', backgroundColor: 'rgba(255,155,92,.18)', borderWidth: 3, tension: .4, fill: false, pointRadius: 4, pointHoverRadius: 6, borderDash: [6,4] },
            { label: 'Vencidos (1-19 dias)', data: meses.map(m => porMes[m].vencidos), borderColor: '#ff5c5c', backgroundColor: 'rgba(255,92,92,.18)', borderWidth: 3, tension: .4, fill: false, pointRadius: 4, pointHoverRadius: 6 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 250 },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { color: '#f5f5f5', font: { size: 12, weight: '600' }, padding: 12, usePointStyle: true } },
            title: { display: true, text: tituloTexto, color: '#f5f5f5', font: { size: 14, weight: '700' }, padding: 12 },
            tooltip: { backgroundColor: '#0a0a0a', titleColor: '#fff', bodyColor: '#f5f5f5', borderColor: 'rgba(57,255,20,.3)', borderWidth: 1 }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.08)' }, ticks: { color: '#a1a1aa', precision: 0 } },
            x: { grid: { color: 'rgba(255,255,255,.08)' }, ticks: { color: '#a1a1aa' } }
          }
        }
      });
    }

    function gerarTextoWhatsAppGestao() {
      let novos = 0, renov = 0, testes_criados = 0;
      movimentacoes.forEach(m => {
        if (!passaFiltroMes(m.data)) return;
        if (m.tipo === 'use' && m.tipoCliente === 'novo') novos += 1;
        else if (m.tipo === 'use' && m.tipoCliente === 'renovacao') renov += 1;
        else if (m.tipo === 'teste') testes_criados += (m.quantidade || 1);
      });
      const today = todayLocalDate();
      let nren = 0, vencidosAtuais = 0;
      clients.forEach(c => {
        const due = parseDate(c.dataRenovacao); if (!due) return;
        const overdue = diffInDays(today, due);
        if (overdue <= 0) return;
        if (overdue >= 20) {
          if (state.filtroMes !== 'all') {
            const churnDate = addDays(due, 20);
            const k = `${churnDate.getFullYear()}-${String(churnDate.getMonth() + 1).padStart(2, '0')}`;
            if (k !== state.filtroMes) return;
          }
          nren += 1;
        } else {
          if (state.filtroMes !== 'all') {
            const k = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
            if (k !== state.filtroMes) return;
          }
          vencidosAtuais += 1;
        }
      });
      const { custo, lucro, taxas, liquido } = computeTotaisFinanceiros();
      const rotuloMes = state.filtroMes === 'all' ? 'GERAL' : monthLabel(state.filtroMes).toUpperCase();
      let t = `📊 *RESUMO COMPLETO - GESTÃO IPTV (${rotuloMes})*\n\n`;
      t += `👥 *CLIENTES*\n`;
      t += `• Novos: ${novos}\n• Renovações: ${renov}\n• Não Renovaram (20+ dias): ${nren}\n• Vencidos (1-19 dias): ${vencidosAtuais}\n• Testes criados: ${testes_criados}\n• Total Ativos: ${clients.length}\n\n`;
      t += `💰 *FINANCEIRO*\n`;
      t += `• Lucro Total: R$ ${lucro.toFixed(2)}\n• Custo Total: R$ ${custo.toFixed(2)}\n• Taxas Bancárias: R$ ${taxas.toFixed(2)}\n• Lucro Líquido: R$ ${liquido.toFixed(2)}\n\n`;

      // Detalhamento de taxas por plano
      const porPlano = {};
      movimentacoes.forEach(m => {
        if (!passaFiltroMes(m.data)) return;
        if (m.tipo !== 'use' || !m.taxa || m.taxa <= 0) return;
        const nome = m.planoNome || 'Sem plano';
        if (!porPlano[nome]) porPlano[nome] = { total: 0, qtd: 0 };
        porPlano[nome].total += m.taxa;
        porPlano[nome].qtd += 1;
      });
      const planosTaxa = Object.keys(porPlano);
      if (planosTaxa.length > 0) {
        t += `🏦 *TAXAS POR PLANO*\n`;
        planosTaxa.sort((a, b) => porPlano[b].total - porPlano[a].total);
        planosTaxa.forEach(n => {
          const d = porPlano[n];
          t += `• ${n}: R$ ${d.total.toFixed(2)} (${d.qtd} trans.)\n`;
        });
        t += '\n';
      }

      const lcFiltrados = lucrosCustos.filter(lc => ocorrenciasLucroCusto(lc) > 0);
      if (lcFiltrados.length > 0) {
        t += `📝 *LUCROS/CUSTOS PERSONALIZADOS*\n`;
        lcFiltrados.forEach(lc => {
          const sig = lc.valor >= 0 ? '➕' : '➖';
          const ocorr = ocorrenciasLucroCusto(lc);
          const total = Math.abs(lc.valor) * ocorr;
          const fixoTag = lc.fixo ? ` 🔁` : '';
          const detalhe = (lc.fixo && ocorr > 1) ? ` (${ocorr}× R$ ${Math.abs(lc.valor).toFixed(2)})` : '';
          t += `${sig} ${lc.info}${fixoTag}: R$ ${total.toFixed(2)}${detalhe}\n`;
        });
        t += '\n';
      }
      t += `📈 *RESUMO*\n`;
      const base = renov + nren + vencidosAtuais;
      t += `• Taxa Renovação: ${base > 0 ? ((renov / base) * 100).toFixed(1) : 0}%\n`;
      t += `• Margem Lucro: ${lucro > 0 ? ((liquido / lucro) * 100).toFixed(1) : 0}%\n`;
      t += `• Impacto Taxas: ${lucro > 0 ? ((taxas / lucro) * 100).toFixed(1) : 0}% do lucro`;

      const ta = document.getElementById('textoWhatsAppGestao');
      if (ta) ta.value = t;
    }
    function copiarTextoGestao() {
      const ta = document.getElementById('textoWhatsAppGestao'); ta.select();
      try { document.execCommand('copy'); showToast('Resumo copiado.'); }
      catch (e) { showToast('Não foi possível copiar.', true); }
    }
    window.copiarTextoGestao = copiarTextoGestao;

    /* =========================================================
       PARTE 4 — INDICAÇÕES + ROLETA DA SORTE
       ========================================================= */
    function salvarIndicacoes() {
      try {
        writeJsonCache(STORAGE_KEY_INDICACOES, indicacoes);
        queueCloudSave('indicacoes');
      } catch (e) { showToast('Falha ao salvar indicações.', true); }
    }
    function carregarIndicacoes() {
      const raw = readJsonCache(STORAGE_KEY_INDICACOES, []);
      indicacoes = Array.isArray(raw) ? raw : [];
    }
    function gerarNumeroSorte() {
      const usados = new Set(indicacoes.map(i => i.numero));
      let n;
      let tries = 0;
      do {
        n = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        tries++;
      } while (usados.has(n) && tries < 9999);
      return n;
    }
    function popularSelectTestes() {
      const sel = document.getElementById('indTesteId');
      if (!sel) return;
      const prev = sel.value;
      const testesAtivos = [...testes].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      sel.innerHTML = '<option value="">Selecione um teste ativo…</option>' +
        testesAtivos.map(t => `<option value="${t.id}">${escapeHtml(t.nome || '(sem nome)')}${t.telefone ? ' • ' + escapeHtml(t.telefone) : ''}${t.plano ? ' — ' + escapeHtml(t.plano) : ''}</option>`).join('');
      if (prev) sel.value = prev;
    }

    document.addEventListener('change', function(ev) {
      if (ev.target && ev.target.id === 'indTesteId') {
        const testeId = ev.target.value;
        const t = testes.find(x => x.id === testeId);
        document.getElementById('indAmigoNome').value = t ? (t.nome || '') : '';
        document.getElementById('indAmigoTelefone').value = t ? (t.telefone || '') : '';
      }
    });

    function popularSelectIndicadores() {
      const sel = document.getElementById('indIndicadorId');
      if (!sel) return;
      const prev = sel.value;
      const todos = [...clients].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      sel.innerHTML = '<option value="">Selecione um cliente cadastrado…</option>' +
        todos.map(c => `<option value="${c.id}">${escapeHtml(c.nome || '(sem nome)')}${c.telefone ? ' • ' + escapeHtml(c.telefone) : ''}</option>`).join('');
      if (prev) sel.value = prev;
    }
    function fmtDataBR(iso) {
      return formatDateTimeSaoPaulo(iso);
    }
    function getClienteById(id) { return clients.find(c => c.id === id); }

    function salvarIndicacao(ev) {
      ev && ev.preventDefault();
      const id = document.getElementById('indicacaoId').value;
      const indicadorId = document.getElementById('indIndicadorId').value;
      const testeIdSel = document.getElementById('indTesteId') ? document.getElementById('indTesteId').value : '';
      // Preenche os hidden inputs a partir do teste selecionado (caso ainda não tenham sido preenchidos)
      if (testeIdSel) {
        const tSel = testes.find(x => x.id === testeIdSel);
        if (tSel) {
          document.getElementById('indAmigoNome').value = tSel.nome || '';
          document.getElementById('indAmigoTelefone').value = tSel.telefone || '';
        }
      }
      const amigoNome = document.getElementById('indAmigoNome').value.trim();
      const amigoTelefone = document.getElementById('indAmigoTelefone').value.trim();
      const obs = document.getElementById('indObs').value.trim();
      if (!indicadorId) { showToast('Selecione o cliente que indicou.', true); return; }
      if (!amigoNome) { showToast('Selecione um teste ativo do amigo indicado.', true); return; }
      const indicador = getClienteById(indicadorId);
      if (!indicador) { showToast('Cliente indicador não encontrado.', true); return; }

      if (id) {
        const ind = indicacoes.find(i => i.id === id);
        if (!ind) { showToast('Indicação não encontrada.', true); return; }
        ind.indicadorId = indicadorId;
        ind.indicadorNome = indicador.nome;
        ind.indicadorTelefone = indicador.telefone || '';
        ind.amigoNome = amigoNome;
        ind.amigoTelefone = amigoTelefone;
        ind.observacoes = obs;
        ind.testeId = testeIdSel || ind.testeId || '';
        ind.updatedAt = new Date().toISOString();
        salvarIndicacoes();
        limparFormIndicacao();
        renderIndicacoes();
        showToast(`Indicação atualizada • número ${ind.numero}`);
      } else {
        const numero = gerarNumeroSorte();
        const novo = {
          id: 'ind_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
          numero,
          indicadorId,
          indicadorNome: indicador.nome,
          indicadorTelefone: indicador.telefone || '',
          amigoNome,
          amigoTelefone,
          observacoes: obs,
          testeId: testeIdSel || '',   // vincula ao teste do amigo indicado, para automatizar o bônus ao ativar
          amigoClientId: null,          // preenchido quando o teste vinculado vira cliente (assinatura)
          status: 'teste',       // 'teste' = na roleta | 'assinou' = mês grátis concedido | 'ganhou' = sorteado
          fezTesteEm: new Date().toISOString(),
          assinouEm: null,
          ganhouEm: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        indicacoes.push(novo);
        salvarIndicacoes();
        limparFormIndicacao();
        renderIndicacoes();
        showToast(`Número da sorte ${numero} gerado e adicionado à roleta!`);
      }
    }

    function limparFormIndicacao() {
      document.getElementById('indicacaoId').value = '';
      document.getElementById('indIndicadorId').value = '';
      const selTeste = document.getElementById('indTesteId'); if (selTeste) selTeste.value = '';
      document.getElementById('indAmigoNome').value = '';
      document.getElementById('indAmigoTelefone').value = '';
      document.getElementById('indObs').value = '';
    }

    function editarIndicacao(id) {
      const ind = indicacoes.find(i => i.id === id);
      if (!ind) return;
      popularSelectIndicadores();
      popularSelectTestes();
      document.getElementById('indicacaoId').value = ind.id;
      document.getElementById('indIndicadorId').value = ind.indicadorId;
      document.getElementById('indAmigoNome').value = ind.amigoNome || '';
      document.getElementById('indAmigoTelefone').value = ind.amigoTelefone || '';
      // Tenta pré-selecionar o teste ativo pelo nome do amigo
      const selTeste = document.getElementById('indTesteId');
      if (selTeste) {
        const testeMatch = testes.find(t => t.nome === ind.amigoNome && t.telefone === ind.amigoTelefone);
        selTeste.value = testeMatch ? testeMatch.id : '';
      }
      document.getElementById('indObs').value = ind.observacoes || '';
      switchTab('config');
      // Expandir card de Indicações
      const card = document.getElementById('cardIndicacoes');
      if (card) card.classList.remove('collapsed');
      setTimeout(() => { const focusEl = document.getElementById('indTesteId') || document.getElementById('indAmigoNome'); if (focusEl) { focusEl.focus(); focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 150);
    }

    function removerIndicacao(id) {
      const ind = indicacoes.find(i => i.id === id);
      if (!ind) return;
      if (!confirmar(`Remover a indicação ${ind.numero} (${ind.amigoNome})?`)) return;
      indicacoes = indicacoes.filter(i => i.id !== id);
      salvarIndicacoes();
      renderIndicacoes();
      showToast('Indicação removida.');
    }

    // Concede o bônus de indicação ao indicador: +30 dias no vencimento e desconta o crédito do mês grátis
    // do painel ATUAL do próprio indicador (não do painel do amigo). A quantidade de créditos debitada
    // segue o cadastro do indicador (campo créditos do cliente/plano), igual a qualquer outro consumo.
    // Retorna o cliente indicador atualizado, ou null se ele não for encontrado.
    function concederMesGratisIndicador(ind) {
      const indicador = clients.find(c => c.id === ind.indicadorId);
      if (!indicador) return null;
      const baseDate = parseDate(indicador.dataRenovacao) || todayLocalDate();
      const novaData = addPlanPeriod(baseDate, 30);
      indicador.dataRenovacao = toInputDate(novaData);
      indicador.updatedAt = new Date().toISOString();
      const planoIndicador = encontrarPlanoPorNome(indicador.plano);
      const painelIdBonus = (planoIndicador && planoIndicador.painelId) ? planoIndicador.painelId : paineis[0].id;
      const creditosBonus = resolverCreditosCliente(indicador);
      movimentacoes.push({
        data: new Date().toISOString(), tipo: 'use', tipoCliente: 'indicacao_bonus',
        valor: 0, quantidade: creditosBonus, taxa: 0,
        planoNome: 'Mês grátis (indicação)', clientId: indicador.id, clientNome: indicador.nome,
        painelId: painelIdBonus
      });
      saveClients();
      salvarMovimentacoes();
      return { indicador, creditosBonus, painelIdBonus };
    }

    // Tenta achar automaticamente o cliente cadastrado que corresponde ao amigo indicado
    // (por vínculo já salvo, ou por telefone/nome), para pré-selecionar no modal de confirmação.
    function encontrarClienteAmigoIndicacao(ind) {
      if (ind.amigoClientId) {
        const porId = clients.find(c => c.id === ind.amigoClientId);
        if (porId) return porId;
      }
      const telAmigo = String(ind.amigoTelefone || '').replace(/\D/g, '');
      if (telAmigo) {
        const porTel = clients.find(c => String(c.telefone || '').replace(/\D/g, '') === telAmigo);
        if (porTel) return porTel;
      }
      const nomeAmigo = String(ind.amigoNome || '').trim().toLowerCase();
      if (nomeAmigo) {
        const porNome = clients.find(c => String(c.nome || '').trim().toLowerCase() === nomeAmigo);
        if (porNome) return porNome;
      }
      return null;
    }

    // Ajusta o vencimento do amigo indicado em +30 dias e desconta 1 crédito (real, pago) do painel
    // dele — o mesmo painel/plano em que ele está sendo ativado. O valor pago por ele nessa renovação
    // é o que compensa o crédito de "mês grátis" concedido ao indicador.
    function renovarAmigoIndicacao(client) {
      const baseDate = parseDate(client.dataRenovacao) || todayLocalDate();
      const novaData = addPlanPeriod(baseDate, 30);
      client.dataRenovacao = toInputDate(novaData);
      client.updatedAt = new Date().toISOString();
      const planoAmigo = encontrarPlanoPorNome(client.plano);
      const painelIdAmigo = (planoAmigo && planoAmigo.painelId) ? planoAmigo.painelId : paineis[0].id;
      const creditosAmigo = resolverCreditosCliente(client);
      const valorVenda = parseValor(client.valor);
      const taxa = calcularTaxaPlano(planoAmigo, valorVenda);
      movimentacoes.push({
        data: new Date().toISOString(), tipo: 'use', tipoCliente: 'renovacao',
        valor: valorVenda, quantidade: creditosAmigo, taxa: taxa,
        planoNome: client.plano || '', clientId: client.id, clientNome: client.nome,
        painelId: painelIdAmigo
      });
      saveClients();
      salvarMovimentacoes();
      return { client, creditosAmigo, painelIdAmigo, valorVenda, taxa };
    }

    let assinaturaIndPendente = null; // { ind }
    function marcarAssinou(id) {
      const ind = indicacoes.find(i => i.id === id);
      if (!ind) return;
      if (ind.status === 'ganhou') { showToast('Esta indicação já foi sorteada.', true); return; }
      if (ind.status === 'assinou') { showToast('Esta indicação já foi convertida.', true); return; }
      assinaturaIndPendente = { ind };

      const sel = document.getElementById('assinIndAmigoClienteSel');
      const amigoAtual = encontrarClienteAmigoIndicacao(ind);
      const todos = [...clients].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      sel.innerHTML = '<option value="">Selecione o cliente cadastrado…</option>' +
        todos.map(c => `<option value="${c.id}">${escapeHtml(c.nome || '(sem nome)')}${c.telefone ? ' • ' + escapeHtml(c.telefone) : ''}</option>`).join('');
      sel.value = amigoAtual ? amigoAtual.id : '';

      atualizarGridConfirmarAssinaturaIndicacao();
      sel.onchange = atualizarGridConfirmarAssinaturaIndicacao;

      document.getElementById('modalConfirmarAssinaturaIndicacao').classList.add('active');
    }

    function atualizarGridConfirmarAssinaturaIndicacao() {
      if (!assinaturaIndPendente) return;
      const { ind } = assinaturaIndPendente;
      const indicador = clients.find(c => c.id === ind.indicadorId);
      const selId = document.getElementById('assinIndAmigoClienteSel').value;
      const amigo = selId ? clients.find(c => c.id === selId) : null;
      const grid = document.getElementById('assinIndConfirmGrid');

      const linhaIndicador = indicador
        ? `<div class="renew-confirm-item"><div class="lbl">Vencimento atual do indicador</div><div class="val">${escapeHtml(formatDate(indicador.dataRenovacao))}</div></div>
           <div class="renew-confirm-item highlight"><div class="lbl">Novo vencimento do indicador</div><div class="val">${escapeHtml(formatDate(toInputDate(addPlanPeriod(parseDate(indicador.dataRenovacao) || todayLocalDate(), 30))))}</div></div>
           <div class="renew-confirm-item full"><div class="lbl">Cálculo (indicador)</div><div class="val" style="font-size:13px;">Mês grátis — sem cobrança<br><span style="color:var(--muted); font-size:12px;">−${resolverCreditosCliente(indicador)} crédito${resolverCreditosCliente(indicador) === 1 ? '' : 's'} do <b>${escapeHtml(getPainelNome(((encontrarPlanoPorNome(indicador.plano) || {}).painelId) || paineis[0].id))}</b></span></div></div>`
        : `<div class="renew-confirm-item full"><div class="lbl">Indicador</div><div class="val" style="color:var(--danger);">${escapeHtml(ind.indicadorNome)} não encontrado como cliente cadastrado — ajuste o vencimento dele manualmente.</div></div>`;

      const linhaAmigo = amigo
        ? `<div class="renew-confirm-item"><div class="lbl">Vencimento atual do amigo</div><div class="val">${escapeHtml(formatDate(amigo.dataRenovacao))}</div></div>
           <div class="renew-confirm-item highlight"><div class="lbl">Novo vencimento do amigo</div><div class="val">${escapeHtml(formatDate(toInputDate(addPlanPeriod(parseDate(amigo.dataRenovacao) || todayLocalDate(), 30))))}</div></div>
           <div class="renew-confirm-item full"><div class="lbl">Cálculo (amigo)</div><div class="val" style="font-size:13px;">R$ ${parseValor(amigo.valor).toFixed(2)} pago<br><span style="color:var(--muted); font-size:12px;">−${resolverCreditosCliente(amigo)} crédito${resolverCreditosCliente(amigo) === 1 ? '' : 's'} do <b>${escapeHtml(getPainelNome(((encontrarPlanoPorNome(amigo.plano) || {}).painelId) || paineis[0].id))}</b></span></div></div>`
        : `<div class="renew-confirm-item full"><div class="lbl">Amigo indicado</div><div class="val" style="color:var(--danger);">Selecione acima o cadastro correspondente para ajustar o vencimento e descontar o crédito dele.</div></div>`;

      grid.innerHTML = `
        <div class="renew-confirm-item full"><div class="lbl">Indicador</div><div class="val">${escapeHtml(ind.indicadorNome)}</div></div>
        ${linhaIndicador}
        <div class="renew-confirm-item full"><div class="lbl">Amigo indicado</div><div class="val">${escapeHtml(ind.amigoNome)}</div></div>
        ${linhaAmigo}
      `;
    }

    function fecharModalConfirmarAssinaturaIndicacao() {
      document.getElementById('modalConfirmarAssinaturaIndicacao').classList.remove('active');
      assinaturaIndPendente = null;
    }

    function confirmarAssinaturaIndicacao() {
      if (!assinaturaIndPendente) return;
      const { ind } = assinaturaIndPendente;
      const selId = document.getElementById('assinIndAmigoClienteSel').value;
      const amigo = selId ? clients.find(c => c.id === selId) : null;

      ind.status = 'assinou';
      ind.assinouEm = new Date().toISOString();
      if (amigo) ind.amigoClientId = amigo.id;
      ind.updatedAt = new Date().toISOString();
      salvarIndicacoes();

      const bonus = concederMesGratisIndicador(ind);
      const amigoResult = amigo ? renovarAmigoIndicacao(amigo) : null;

      renderIndicacoes();
      renderAll();
      atualizarCreditos(); atualizarHistorico();
      atualizarGraficoClientes(); atualizarStatsFinanceiras();

      fecharModalConfirmarAssinaturaIndicacao();

      const partes = [];
      if (bonus) {
        const { indicador, creditosBonus, painelIdBonus } = bonus;
        partes.push(`${ind.indicadorNome}: +30 dias (${formatDate(indicador.dataRenovacao)}) • -${creditosBonus} crédito${creditosBonus === 1 ? '' : 's'} (${getPainelNome(painelIdBonus)})`);
      } else {
        partes.push(`${ind.indicadorNome} não encontrado como cliente — ajuste o vencimento manualmente`);
      }
      if (amigoResult) {
        const { creditosAmigo, painelIdAmigo, valorVenda } = amigoResult;
        partes.push(`${amigo.nome}: +30 dias (${formatDate(amigo.dataRenovacao)}) • -${creditosAmigo} crédito${creditosAmigo === 1 ? '' : 's'} (${getPainelNome(painelIdAmigo)}) • R$ ${valorVenda.toFixed(2)} pago`);
      } else {
        partes.push('Amigo indicado sem cadastro vinculado — crédito e vencimento não ajustados');
      }
      showToast(`Assinatura confirmada • ${partes.join(' | ')}`, !bonus || !amigoResult);

      abrirModalMensagensAssinaturaIndicacao(amigo, ind, bonus ? bonus.indicador : clients.find(c => c.id === ind.indicadorId));
    }

    let assinIndAmigoAtual = null;
    let assinIndIndicadorCtx = null; // { ind, indicador }
    function abrirModalMensagensAssinaturaIndicacao(amigo, ind, indicador) {
      assinIndAmigoAtual = amigo || null;
      assinIndIndicadorCtx = { ind, indicador: indicador || null };

      const boxAmigo = document.getElementById('assinIndAmigoMsgBox');
      if (boxAmigo) boxAmigo.textContent = amigo ? buildRenewMessage(amigo) : 'Nenhum cliente vinculado ao amigo indicado — não foi possível montar a mensagem automaticamente.';

      const boxInd = document.getElementById('assinIndIndicadorMsgBox');
      if (boxInd) boxInd.textContent = buildIndicacaoMesGratisMessage(ind, indicador, amigo ? amigo.nome : ind.amigoNome);

      document.getElementById('modalMensagensAssinaturaIndicacao').classList.add('active');
    }
    function fecharModalMensagensAssinaturaIndicacao() {
      document.getElementById('modalMensagensAssinaturaIndicacao').classList.remove('active');
      assinIndAmigoAtual = null;
      assinIndIndicadorCtx = null;
    }
    function copiarMsgAmigoConversao() {
      if (!assinIndAmigoAtual) return;
      const msg = buildRenewMessage(assinIndAmigoAtual);
      const name = assinIndAmigoAtual.nome || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(msg, name));
      } else fallbackCopy(msg, name);
    }
    function enviarMsgAmigoConversaoWhatsApp() {
      if (!assinIndAmigoAtual) return;
      const c = assinIndAmigoAtual;
      const phone = String(c.telefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(buildRenewMessage(c));
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    function copiarMsgIndicadorConversao() {
      if (!assinIndIndicadorCtx) return;
      const { ind, indicador } = assinIndIndicadorCtx;
      const msg = buildIndicacaoMesGratisMessage(ind, indicador, assinIndAmigoAtual ? assinIndAmigoAtual.nome : ind.amigoNome);
      const name = (indicador && indicador.nome) || ind.indicadorNome || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => showToast(`Mensagem copiada para ${name}`)).catch(() => fallbackCopy(msg, name));
      } else fallbackCopy(msg, name);
    }
    function enviarMsgIndicadorConversaoWhatsApp() {
      if (!assinIndIndicadorCtx) return;
      const { ind, indicador } = assinIndIndicadorCtx;
      const msg = buildIndicacaoMesGratisMessage(ind, indicador, assinIndAmigoAtual ? assinIndAmigoAtual.nome : ind.amigoNome);
      const phone = String((indicador && indicador.telefone) || ind.indicadorTelefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(msg);
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    window.fecharModalConfirmarAssinaturaIndicacao = fecharModalConfirmarAssinaturaIndicacao;
    window.confirmarAssinaturaIndicacao = confirmarAssinaturaIndicacao;
    window.fecharModalMensagensAssinaturaIndicacao = fecharModalMensagensAssinaturaIndicacao;
    window.copiarMsgAmigoConversao = copiarMsgAmigoConversao;
    window.enviarMsgAmigoConversaoWhatsApp = enviarMsgAmigoConversaoWhatsApp;
    window.copiarMsgIndicadorConversao = copiarMsgIndicadorConversao;
    window.enviarMsgIndicadorConversaoWhatsApp = enviarMsgIndicadorConversaoWhatsApp;

    function reverterAssinou(id) {
      const ind = indicacoes.find(i => i.id === id);
      if (!ind || ind.status !== 'assinou') return;
      if (!confirmar('Reverter? O número volta para a roleta. Isso NÃO desfaz automaticamente os +30 dias e o crédito já concedidos ao indicador — ajuste manualmente se necessário.')) return;
      ind.status = 'teste';
      ind.assinouEm = null;
      ind.updatedAt = new Date().toISOString();
      salvarIndicacoes();
      renderIndicacoes();
      showToast('Status revertido para teste. Vencimento/crédito do indicador não foram alterados automaticamente.');
    }

    function whatsappIndicador(id, msg) {
      const ind = indicacoes.find(i => i.id === id);
      if (!ind) return;
      const phone = String(ind.indicadorTelefone || '').replace(/\D/g, '');
      const text = encodeURIComponent(msg);
      const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${text}` : `https://api.whatsapp.com/send?text=${text}`;
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

function whatsappAvisarTeste(id) {
  const ind = indicacoes.find(i => i.id === id); if (!ind) return;
  const msg = renderMessageTemplate('indicacao_teste', {
    indicador_nome: ind.indicadorNome || '',
    amigo_nome: ind.amigoNome || '',
    numero: ind.numero || ''
  });
  whatsappIndicador(id, msg);
}
function whatsappAvisarMesGratis(id) {
  const ind = indicacoes.find(i => i.id === id); if (!ind) return;
  const msg = renderMessageTemplate('indicacao_mes_gratis', {
    indicador_nome: ind.indicadorNome || '',
    amigo_nome: ind.amigoNome || '',
    numero: ind.numero || ''
  });
  whatsappIndicador(id, msg);
}
function whatsappAvisarGanhador(id) {
  const ind = indicacoes.find(i => i.id === id); if (!ind) return;
  const msg = renderMessageTemplate('indicacao_ganhador', {
    indicador_nome: ind.indicadorNome || '',
    amigo_nome: ind.amigoNome || '',
    numero: ind.numero || ''
  });
  whatsappIndicador(id, msg);
}

function renderIndicacoes() {
      // Stats
      const ativas = indicacoes.filter(i => i.status === 'teste');
      const assinou = indicacoes.filter(i => i.status === 'assinou');
      const ganhou = indicacoes.filter(i => i.status === 'ganhou');
      const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setText('statRoletaCount', ativas.length);
      setText('statTestesCount', indicacoes.length);
      setText('statMesesGratis', assinou.length);
      setText('statTotalInd', indicacoes.length);
      setText('countIndAtivas', ativas.length);
      setText('countIndAssinou', assinou.length);
      setText('countIndGanhou', ganhou.length);
      setText('countRoletaTopo', ativas.length);
      setText('countRoletaLista', ativas.length);

      renderListaIndicacoes('listaIndAtivas', 'paginationIndAtivas', ativas, 'indAtivasPage', 'changeIndAtivasPage', 'ativa');
      renderListaIndicacoes('listaIndAssinou', 'paginationIndAssinou', assinou, 'indAssinouPage', 'changeIndAssinouPage', 'assinou');
      renderListaIndicacoes('listaIndGanhou', 'paginationIndGanhou', ganhou, 'indGanhouPage', 'changeIndGanhouPage', 'ganhou');
      renderRoleta();
    }

    function renderListaIndicacoes(listId, pagId, arr, pageKey, pageRefName, tipo) {
      const cont = document.getElementById(listId);
      if (!cont) return;
      const sorted = [...arr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const { items, totalPages, safePage } = paginate(sorted, state[pageKey]);
      state[pageKey] = safePage;
      if (items.length === 0) {
        cont.innerHTML = `<div class="empty-state">Nenhuma indicação ${tipo === 'ativa' ? 'ativa na roleta' : tipo === 'assinou' ? 'convertida em mês grátis' : 'sorteada'} até o momento.</div>`;
        renderPagination(document.getElementById(pagId), 1, 1, null);
        return;
      }
      cont.innerHTML = items.map(ind => {
        let actions = '';
        if (tipo === 'ativa') {
          actions = `
            <button class="btn-success" onclick="marcarAssinou('${ind.id}')" title="Marcar que o amigo fechou assinatura"><i class="fas fa-check-circle"></i> Fechou assinatura</button>
            <button class="btn-whatsapp" onclick="whatsappAvisarTeste('${ind.id}')" title="Avisar indicador no WhatsApp"><i class="fab fa-whatsapp"></i></button>
            <button class="btn-secondary" onclick="editarIndicacao('${ind.id}')" title="Editar"><i class="fas fa-pen"></i></button>
            <button class="btn-danger" onclick="removerIndicacao('${ind.id}')" title="Remover"><i class="fas fa-trash"></i></button>
          `;
        } else if (tipo === 'assinou') {
          actions = `
            <button class="btn-whatsapp" onclick="whatsappAvisarMesGratis('${ind.id}')" title="Avisar mês grátis no WhatsApp"><i class="fab fa-whatsapp"></i> Avisar mês grátis</button>
            <button class="btn-secondary" onclick="reverterAssinou('${ind.id}')" title="Reverter para roleta"><i class="fas fa-undo"></i></button>
            <button class="btn-danger" onclick="removerIndicacao('${ind.id}')" title="Remover"><i class="fas fa-trash"></i></button>
          `;
        } else {
          actions = `
            <button class="btn-whatsapp" onclick="whatsappAvisarGanhador('${ind.id}')" title="Reenviar aviso ao ganhador"><i class="fab fa-whatsapp"></i> Avisar ganhador</button>
            <button class="btn-danger" onclick="removerIndicacao('${ind.id}')" title="Remover"><i class="fas fa-trash"></i></button>
          `;
        }
        const pill = tipo === 'ativa'
          ? `<span class="pill-tested"><i class="fas fa-vial"></i> Teste realizado</span>`
          : tipo === 'assinou'
            ? `<span class="pill-subscribed"><i class="fas fa-star"></i> Assinou — Mês grátis concedido</span>`
            : `<span class="pill-won"><i class="fas fa-trophy"></i> Ganhador sorteio</span>`;
        const dataInfo = tipo === 'assinou' ? `Assinou em ${fmtDataBR(ind.assinouEm)}` :
                         tipo === 'ganhou' ? `Sorteado em ${fmtDataBR(ind.ganhouEm)}` :
                         `Indicado em ${fmtDataBR(ind.fezTesteEm || ind.createdAt)}`;
        return `
          <div class="list-item">
            <div class="list-item-content">
              <div class="list-item-icon" style="background: rgba(57,255,20,.08); color: var(--primary);"><i class="fas fa-ticket-alt"></i></div>
              <div style="min-width:0; flex:1;">
                <div class="list-item-text" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                  <span class="lucky-code">${ind.numero}</span>
                  ${pill}
                </div>
                <div class="list-item-sub" style="margin-top:6px;">
                  <i class="fas fa-user-tag"></i> Indicador: <b style="color:var(--text);">${escapeHtml(ind.indicadorNome)}</b>${ind.indicadorTelefone ? ' • ' + escapeHtml(ind.indicadorTelefone) : ''}
                </div>
                <div class="list-item-sub" style="margin-top:3px;">
                  <i class="fas fa-user-friends"></i> Amigo: <b style="color:var(--text);">${escapeHtml(ind.amigoNome)}</b>${ind.amigoTelefone ? ' • ' + escapeHtml(ind.amigoTelefone) : ''}
                </div>
                <div class="list-item-sub" style="margin-top:3px; color: var(--muted);">
                  <i class="far fa-clock"></i> ${dataInfo}${ind.observacoes ? ' • ' + escapeHtml(ind.observacoes) : ''}
                </div>
              </div>
            </div>
            <div class="client-row-actions" style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">${actions}</div>
          </div>
        `;
      }).join('');
      renderPagination(document.getElementById(pagId), safePage, totalPages, pageRefName);
    }

    /* ============ ROLETA / WHEEL ============ */
    let currentSpinDeg = 0;
    let lastWinnerId = null;
    let spinning = false;

    function getNumerosNaRoleta() {
      return indicacoes
        .filter(i => i.status === 'teste')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    function renderRoleta() {
      const wheel = document.getElementById('roletaWheel');
      const lista = document.getElementById('listaRoleta');
      if (!wheel) return;
      const numeros = getNumerosNaRoleta();

      // Build wheel slices
      wheel.innerHTML = '';
      if (numeros.length === 0) {
        wheel.innerHTML = `<div class="roleta-empty"><div><i class="fas fa-inbox" style="font-size:28px; opacity:.4; display:block; margin-bottom:10px;"></i>Nenhum número na roleta.<br><span style="font-size:12px;">Cadastre indicações na aba <b>Indicações</b>.</span></div></div>`;
      } else {
        // Limit visible slices on the wheel to 24 for readability, but keep all in raffle pool
        const visible = numeros.slice(0, Math.min(numeros.length, 24));
        const sliceAngle = 360 / visible.length;
        const palette = ['#0d2a06', '#143d09', '#0a1f04', '#102e07'];
        const fragments = visible.map((ind, idx) => {
          const rot = idx * sliceAngle;
          const skew = 90 - sliceAngle;
          const bg = palette[idx % palette.length];
          // Each slice is a triangle-like wedge using transform skew
          return `
            <div class="roleta-slice" style="transform: rotate(${rot}deg) skewY(-${skew}deg); background: linear-gradient(135deg, ${bg}, #050505); border-right: 1px solid rgba(57,255,20,.18);">
              <span style="transform: skewY(${skew}deg) rotate(${sliceAngle/2}deg) translateY(2px);">${ind.numero}</span>
            </div>
          `;
        }).join('');
        wheel.innerHTML = fragments;
      }

      // Build list
      if (lista) {
        if (numeros.length === 0) {
          lista.innerHTML = `<div class="empty-state">Nenhum número concorrendo.</div>`;
          renderPagination(document.getElementById('paginationRoleta'), 1, 1, null);
        } else {
          const { items, totalPages, safePage } = paginate(numeros, state.roletaPage);
          state.roletaPage = safePage;
          lista.innerHTML = items.map(ind => `
            <div class="list-item">
              <div class="list-item-content">
                <div class="list-item-icon" style="background: rgba(57,255,20,.08); color: var(--primary);"><i class="fas fa-ticket-alt"></i></div>
                <div style="min-width:0; flex:1;">
                  <div class="list-item-text" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <span class="lucky-code lg">${ind.numero}</span>
                  </div>
                  <div class="list-item-sub" style="margin-top:6px;">
                    <i class="fas fa-user-tag"></i> Indicador: <b style="color:var(--text);">${escapeHtml(ind.indicadorNome)}</b>
                  </div>
                  <div class="list-item-sub" style="margin-top:3px;">
                    <i class="fas fa-user-friends"></i> Amigo: <b style="color:var(--text);">${escapeHtml(ind.amigoNome)}</b>
                  </div>
                </div>
              </div>
            </div>
          `).join('');
          renderPagination(document.getElementById('paginationRoleta'), safePage, totalPages, 'changeRoletaPage');
        }
      }
    }

    function sortearGanhador() {
      if (spinning) return;
      const numeros = getNumerosNaRoleta();
      if (numeros.length === 0) {
        showToast('Não há números concorrendo. Cadastre indicações primeiro.', true);
        return;
      }
      spinning = true;
      const btn = document.getElementById('btnSortear');
      if (btn) btn.disabled = true;

      const visible = numeros.slice(0, Math.min(numeros.length, 24));
      const winnerIdx = Math.floor(Math.random() * numeros.length);
      const winner = numeros[winnerIdx];
      // For visual: find the visible index for the winner (or just spin to a random visible slice)
      const visibleIdx = visible.findIndex(v => v.id === winner.id);
      const targetIdx = visibleIdx >= 0 ? visibleIdx : Math.floor(Math.random() * visible.length);
      const sliceAngle = 360 / visible.length;
      // Pointer is at top (0deg). To land slice center at top, we rotate negative.
      const baseRotations = 6 * 360;
      const targetDeg = baseRotations + (360 - (targetIdx * sliceAngle + sliceAngle / 2));
      currentSpinDeg = (Math.floor(currentSpinDeg / 360) * 360) + targetDeg;
      const wheel = document.getElementById('roletaWheel');
      if (wheel) {
        wheel.classList.add('spinning');
        wheel.style.transform = `rotate(${currentSpinDeg}deg)`;
      }

      setTimeout(() => {
        spinning = false;
        if (btn) btn.disabled = false;
        mostrarResultadoSorteio(winner);
      }, 5700);
    }

    function mostrarResultadoSorteio(winner) {
      lastWinnerId = winner.id;
      const box = document.getElementById('roletaResultBox');
      if (!box) return;
      box.style.display = '';
      document.getElementById('resultNumero').textContent = winner.numero;
      document.getElementById('resultIndicadorNome').textContent = winner.indicadorNome || '—';
      document.getElementById('resultIndicadorTel').textContent = winner.indicadorTelefone || '—';
      document.getElementById('resultAmigoNome').textContent = winner.amigoNome || '—';
      document.getElementById('resultAmigoTel').textContent = winner.amigoTelefone || '—';
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`🎉 Número ${winner.numero} sorteado!`);
    }

    function confirmarPremiacaoGanhador() {
      if (!lastWinnerId) return;
      const ind = indicacoes.find(i => i.id === lastWinnerId);
      if (!ind) return;
      if (!confirmar(`Confirmar premiação? O número ${ind.numero} sai da roleta e ${ind.indicadorNome} é registrado como ganhador.`)) return;
      ind.status = 'ganhou';
      ind.ganhouEm = new Date().toISOString();
      ind.updatedAt = new Date().toISOString();
      salvarIndicacoes();
      renderIndicacoes();
      const box = document.getElementById('roletaResultBox');
      if (box) box.style.display = 'none';
      lastWinnerId = null;
      showToast(`Premiação registrada para ${ind.indicadorNome}.`);
    }

    function wireRoletaEvents() {
      const btnSort = document.getElementById('btnSortear');
      if (btnSort) btnSort.addEventListener('click', sortearGanhador);
      const btnWhats = document.getElementById('btnWhatsGanhador');
      if (btnWhats) btnWhats.addEventListener('click', () => { if (lastWinnerId) whatsappAvisarGanhador(lastWinnerId); });
      const btnConf = document.getElementById('btnConfirmarGanhador');
      if (btnConf) btnConf.addEventListener('click', confirmarPremiacaoGanhador);
      const btnFech = document.getElementById('btnFecharResult');
      if (btnFech) btnFech.addEventListener('click', () => {
        const box = document.getElementById('roletaResultBox');
        if (box) box.style.display = 'none';
        lastWinnerId = null;
      });
      const form = document.getElementById('indicacaoForm');
      if (form) form.addEventListener('submit', salvarIndicacao);
      const clearBtn = document.getElementById('clearIndicacaoBtn');
      if (clearBtn) clearBtn.addEventListener('click', limparFormIndicacao);
    }

    // Expor funções para os onclick inline
    window.editarIndicacao = editarIndicacao;
    window.removerIndicacao = removerIndicacao;
    window.marcarAssinou = marcarAssinou;
    window.reverterAssinou = reverterAssinou;
    window.whatsappAvisarTeste = whatsappAvisarTeste;
    window.whatsappAvisarMesGratis = whatsappAvisarMesGratis;
    window.whatsappAvisarGanhador = whatsappAvisarGanhador;
    window.changeIndAtivasPage = function (p) { state.indAtivasPage = p; renderIndicacoes(); };
    window.changeIndAssinouPage = function (p) { state.indAssinouPage = p; renderIndicacoes(); };
    window.changeIndGanhouPage = function (p) { state.indGanhouPage = p; renderIndicacoes(); };
    window.changeRoletaPage = function (p) { state.roletaPage = p; renderRoleta(); };

    /* ===== Migração: Calculadora / Gestão / Indicações vão para dentro de Configuração como cards expansíveis ===== */
    function migrarParaConfig() {
      const cfg = document.getElementById('config');
      if (!cfg) return;
      const moveAsCard = (sectionId, cardId, titulo, iconClass, badgeHtml) => {
        const sec = document.getElementById(sectionId);
        if (!sec || document.getElementById(cardId)) return;
        const card = document.createElement('div');
        card.className = 'card collapsed';
        card.id = cardId;
        const headerId = 'header' + cardId.slice(4);
        const header = document.createElement('div');
        header.className = 'card-header collapsible';
        header.id = headerId;
        header.innerHTML = `
          <div class="card-title"><i class="${iconClass}"></i><h2>${titulo}</h2></div>
          <div style="display:flex; align-items:center; gap:10px;">
            ${badgeHtml || ''}
            <span class="chev"><i class="fas fa-chevron-down"></i></span>
          </div>`;
        const body = document.createElement('div');
        body.className = 'card-body';
        body.id = 'body' + cardId.slice(4);
        while (sec.firstChild) body.appendChild(sec.firstChild);
        card.appendChild(header);
        card.appendChild(body);
        sec.parentNode.removeChild(sec);
        cfg.appendChild(card);
        header.addEventListener('click', () => {
          card.classList.toggle('collapsed');
          if (!card.classList.contains('collapsed')) {
            // Ao expandir, atualizar dados da seção
            if (cardId === 'cardGestao') {
              try { atualizarSelectMesGestao(); atualizarGraficoClientes(); atualizarStatsFinanceiras(); gerarTextoWhatsAppGestao(); } catch (e) {}
            }
            if (cardId === 'cardIndicacoes') {
              try { popularSelectIndicadores(); renderIndicacoes(); } catch (e) {}
            }
          }
        });
      };
      moveAsCard('calculadora', 'cardCalculadora', 'Calculadora de Lucros', 'fas fa-calculator', '');
      moveAsCard('gestao', 'cardGestao', 'Gestão Financeira', 'fas fa-chart-line', '');
      moveAsCard('indicacoes', 'cardIndicacoes', 'Indicações & Sorteios', 'fas fa-user-friends',
        `<span class="count-badge" id="badgeIndCard">0</span>`);

      /* Ordem dos cards na aba Configuração:
         1-Gestão de Crédito, 2-Gestão Financeira, 3-Pacote de Crédito,
         4-Planos Disponíveis, 5-Lucro e Custo personalizado, 6-Indicação,
         7-Histórico de movimentação, 8-Histórico de taxa bancária, 9-Calculadora */
      const ordemCards = [
        'cardGestaoCreditos',
        'cardGestao',
        'cardPacotes',
        'cardPlanos',
        'cardLucrosCustos',
        'cardIndicacoes',
        'cardHistorico',
        'cardHistoricoTaxas',
        'cardCalculadora'
      ];
      ordemCards.forEach(id => {
        const el = document.getElementById(id);
        if (el) cfg.appendChild(el);
      });
      // Atualizar badge de indicações ativas
      const updateIndBadge = () => {
        const b = document.getElementById('badgeIndCard');
        if (b) b.textContent = indicacoes.filter(i => i.status === 'teste').length;
      };
      updateIndBadge();
      // Hook pra atualizar badge quando indicações mudarem
      const origRender = renderIndicacoes;
      window.renderIndicacoes = function () { origRender.apply(this, arguments); updateIndBadge(); };
    }

    /* ===== INIT ===== */
    loadClients(); carregarTestes(); loadMessageTemplates();
    localStorage.setItem(INIT_FLAG_KEY, '1');
    carregarDadosCalc();
    garantirReservasPagamentosPendentes();

    /* Limpeza única dos dados de exemplo (clientes e pacotes seed) */
    (function limparExemplosUmaVez() {
      const FLAG = 'iptv_seed_examples_cleared_v1';
      if (localStorage.getItem(FLAG) === '1') return;
      try {
        const nomesExemplo = ['Cliente Exemplo Hoje', 'Cliente Exemplo Amanhã', 'Cliente Exemplo 7 Dias'];
        const antesC = clients.length;
        clients = clients.filter(c => !nomesExemplo.includes((c.nome || '').trim()));
        if (clients.length !== antesC) saveClients();

        const seedPacotes = [
          { quantidade: 10,   preco: 11  },
          { quantidade: 30,   preco: 10  },
          { quantidade: 50,   preco: 8   },
          { quantidade: 100,  preco: 7   },
          { quantidade: 500,  preco: 6.5 },
          { quantidade: 1000, preco: 6   }
        ];
        const antesP = pacotes.length;
        pacotes = pacotes.filter(p =>
          !seedPacotes.some(s => Number(s.quantidade) === Number(p.quantidade) && Number(s.preco) === Number(p.preco))
        );
        if (pacotes.length !== antesP) salvarPacotes();
      } catch (e) {}
      localStorage.setItem(FLAG, '1');
    })();

    applyAuthScreenState();
    atualizarRelogioBrasilia();
    setInterval(atualizarRelogioBrasilia, 30000);
    atualizarSelectsPaineis();
    renderAll(); renderTestes();
    atualizarListaPacotes(); atualizarSelectPacotes(); atualizarSelectPacotesAddCredito();
    atualizarListaPlanos(); atualizarSelectPlanos();
    atualizarListaAplicativos(); atualizarSelectAplicativos();
    atualizarCreditos(); atualizarHistorico(); atualizarListaLucrosCustos();
    atualizarListaAssinaturas(); atualizarListaCustos();
    atualizarSelectMesGestao(); atualizarStatsFinanceiras();
    atualizarSelectDxPaineis();
    popularSelectClientesDiasExtras();
    carregarIndicacoes();
    popularSelectIndicadores();
    popularSelectTestes();
    renderIndicacoes();
    setupMessageEditor();
    renderMessageEditor();
    wireRoletaEvents();
    migrarParaConfig();
    setupFirebaseAuth();
