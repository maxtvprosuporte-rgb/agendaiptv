/* =========================================================
   PAINEL ADMINISTRATIVO — AGENDA IPTV
   Usa o MESMO projeto Firebase do painel do cliente, então
   os dados ficam centralizados e sincronizados em tempo real.
   ========================================================= */

// IMPORTANTE: informe aqui o(s) e-mail(s) que podem acessar este painel.
// Esses e-mails também precisam existir como documentos na coleção
// "admins" no Firestore (veja README/firestore.rules) para que as
// regras de segurança liberem leitura/escrita de todos os clientes.
const ADMIN_EMAILS = [
  'ssantosmattheuss@gmail.com'
];

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBBkv5fxVQp9q1i9JqMB57T-AlULUUaCDs",
  authDomain: "agenda-iptv-dcf4e.firebaseapp.com",
  projectId: "agenda-iptv-dcf4e",
  storageBucket: "agenda-iptv-dcf4e.firebasestorage.app",
  messagingSenderId: "497773832104",
  appId: "1:497773832104:web:8b4bcc1934b4efb5b55f9d"
};

let app, auth, db;
let currentUser = null;
let clientesUnsub = null;
let clientesCache = [];

function showToast(msg, isError) {
  let el = document.getElementById('adminToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminToast';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.padding = '10px 18px';
    el.style.borderRadius = '10px';
    el.style.fontSize = '13px';
    el.style.fontWeight = '600';
    el.style.zIndex = '9999';
    el.style.boxShadow = 'var(--shadow)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = isError ? 'var(--danger)' : '#1f8a4c';
  el.style.color = '#fff';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}

function switchTab(tabName) {
  const target = !currentUser ? 'login' : (tabName === 'login' ? 'dashboard' : tabName);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === target));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === target));
  closeSidebar();
}
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('active');
  document.getElementById('sidebarOverlay')?.classList.add('active');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('active');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
}

function formatarData(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function diasRestantes(ms) {
  if (!ms) return null;
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
}
function calcularStatus(dados) {
  const agora = Date.now();
  const assinaturaFimMs = dados.assinaturaFim && dados.assinaturaFim.toMillis ? dados.assinaturaFim.toMillis() : null;
  const testeFimMs = dados.testeFim && dados.testeFim.toMillis ? dados.testeFim.toMillis() : null;
  if (assinaturaFimMs) return { status: assinaturaFimMs > agora ? 'ativa' : 'expirada', fimMs: assinaturaFimMs, origem: 'assinatura' };
  if (testeFimMs) return { status: testeFimMs > agora ? 'teste' : 'expirada', fimMs: testeFimMs, origem: 'teste' };
  return { status: 'ativa', fimMs: null, origem: 'assinatura' };
}
function statusLabel(status) {
  return status === 'teste' ? 'Teste' : status === 'ativa' ? 'Ativa' : 'Expirada';
}

/* ---------- AUTENTICAÇÃO ---------- */
function updateAuthUi() {
  const authenticated = !!currentUser;
  document.body.classList.toggle('auth-screen', !authenticated);
  document.body.classList.toggle('is-authenticated', authenticated);
  document.querySelectorAll('.tab').forEach(tab => {
    const isLogin = tab.dataset.tab === 'login';
    tab.classList.toggle('hidden', authenticated ? isLogin : !isLogin);
  });
  const emailEl = document.getElementById('authUserEmail');
  const badge = document.getElementById('authStatusBadge');
  const logoutBtn = document.getElementById('headerLogoutBtn');
  if (emailEl) emailEl.textContent = currentUser ? currentUser.email : 'Nenhuma';
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !authenticated);
  if (badge) badge.textContent = authenticated ? 'Administrador conectado' : 'Aguardando login';
  if (authenticated) switchTab('dashboard'); else switchTab('login');
}

async function handleLogin(event) {
  event.preventDefault();
  const email = String(document.getElementById('adminEmail')?.value || '').trim();
  const password = String(document.getElementById('adminPassword')?.value || '').trim();
  if (!email || !password) { showToast('Informe email e senha.', true); return; }
  if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
    showToast('Este e-mail não tem permissão de administrador.', true);
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, password);
    document.getElementById('adminPassword').value = '';
  } catch (error) {
    console.error(error);
    showToast('Não foi possível entrar. Verifique email e senha.', true);
  }
}
async function handleLogout() {
  try { await auth.signOut(); showToast('Sessão encerrada.'); }
  catch (error) { console.error(error); showToast('Não foi possível sair.', true); }
}

/* ---------- SINCRONIZAÇÃO EM TEMPO REAL ---------- */
function iniciarSincronizacao() {
  if (clientesUnsub) return;
  clientesUnsub = db.collection('clientesAdmin').onSnapshot(snap => {
    clientesCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderDashboard();
    renderClientes();
  }, error => {
    console.error(error);
    showToast('Falha ao sincronizar clientes. Verifique as regras do Firestore.', true);
  });
}
function pararSincronizacao() {
  if (clientesUnsub) { clientesUnsub(); clientesUnsub = null; }
  clientesCache = [];
}

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const total = clientesCache.length;
  let teste = 0, ativa = 0, expirada = 0, vencendo = 0;
  const vencendoLista = [];
  clientesCache.forEach(c => {
    const { status, fimMs } = calcularStatus(c);
    if (status === 'teste') teste++;
    if (status === 'ativa') ativa++;
    if (status === 'expirada') expirada++;
    if ((status === 'teste' || status === 'ativa') && fimMs) {
      const dias = diasRestantes(fimMs);
      if (dias !== null && dias <= 3) { vencendo++; vencendoLista.push({ ...c, _status: status, _fimMs: fimMs, _dias: dias }); }
    }
  });
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statTeste').textContent = teste;
  document.getElementById('statAtiva').textContent = ativa;
  document.getElementById('statExpirada').textContent = expirada;
  document.getElementById('statVencendo').textContent = vencendo;
  document.getElementById('statAssinaturasAtivas').textContent = ativa;

  const cont = document.getElementById('dashVencendoLista');
  if (!cont) return;
  if (!vencendoLista.length) {
    cont.innerHTML = '<div class="empty-state"><i class="fas fa-circle-check"></i><p>Nenhum vencimento nos próximos 3 dias.</p></div>';
    return;
  }
  vencendoLista.sort((a, b) => a._fimMs - b._fimMs);
  cont.innerHTML = vencendoLista.map(c => `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-icon"><i class="fas fa-user-clock"></i></div>
        <div>
          <div class="list-item-text">${escapeHtml(c.nome || c.email || 'Sem nome')}</div>
          <div class="list-item-sub">${escapeHtml(c.email || '')} • ${escapeHtml(c.whatsapp || 'sem WhatsApp')}</div>
        </div>
      </div>
      <span class="list-item-badge">${c._dias <= 0 ? 'vence hoje' : c._dias + ' dia(s)'}</span>
    </div>
  `).join('');
}

/* ---------- CLIENTES ---------- */
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
function renderClientes() {
  const cont = document.getElementById('clientesLista');
  if (!cont) return;
  const busca = String(document.getElementById('buscaClientes')?.value || '').trim().toLowerCase();
  const ordenar = document.getElementById('ordenarClientes')?.value || 'dataDesc';
  const filtroStatus = document.getElementById('filtroStatus')?.value || 'todos';

  let lista = clientesCache.map(c => {
    const { status, fimMs } = calcularStatus(c);
    const criadoMs = c.criadoEm && c.criadoEm.toMillis ? c.criadoEm.toMillis() : 0;
    return { ...c, _status: status, _fimMs: fimMs, _criadoMs: criadoMs };
  });

  if (busca) {
    lista = lista.filter(c =>
      String(c.nome || '').toLowerCase().includes(busca) ||
      String(c.email || '').toLowerCase().includes(busca) ||
      String(c.whatsapp || '').toLowerCase().includes(busca)
    );
  }
  if (filtroStatus !== 'todos') lista = lista.filter(c => c._status === filtroStatus);

  if (ordenar === 'dataDesc') lista.sort((a, b) => b._criadoMs - a._criadoMs);
  else if (ordenar === 'dataAsc') lista.sort((a, b) => a._criadoMs - b._criadoMs);
  else if (ordenar === 'vencimentoAsc') lista.sort((a, b) => (a._fimMs || Infinity) - (b._fimMs || Infinity));
  else if (ordenar === 'status') lista.sort((a, b) => a._status.localeCompare(b._status));

  if (!lista.length) {
    cont.innerHTML = '<div class="empty-state"><i class="fas fa-users-slash"></i><p>Nenhum cliente encontrado.</p></div>';
    return;
  }

  cont.innerHTML = lista.map(c => {
    const dias = c._fimMs ? diasRestantes(c._fimMs) : null;
    const tempoTxt = c._fimMs
      ? (dias > 0 ? `${dias} dia(s) restante(s)` : 'vencido')
      : 'sem vencimento definido';
    return `
    <div class="list-item">
      <div class="list-item-content">
        <div class="list-item-icon"><i class="fas fa-user"></i></div>
        <div>
          <div class="list-item-text">${escapeHtml(c.nome || 'Sem nome')} <span class="status-pill status-pill-${c._status}">${statusLabel(c._status)}</span></div>
          <div class="list-item-sub">${escapeHtml(c.email || '')} • <i class="fab fa-whatsapp"></i> ${escapeHtml(c.whatsapp || '—')}</div>
          <div class="list-item-sub">Cadastro: ${formatarData(c._criadoMs)} • ${tempoTxt}</div>
        </div>
      </div>
      <div class="client-row-actions">
        <button class="btn-whatsapp" onclick="window.open('https://api.whatsapp.com/send?phone=${encodeURIComponent(String(c.whatsapp||'').replace(/\\D/g,''))}','_blank')" title="Abrir WhatsApp"><i class="fab fa-whatsapp"></i></button>
        <button class="btn-whatsapp" onclick="enviarLembreteRenovacao('${c.id}')" title="Cobrar renovação com link de pagamento"><i class="fab fa-whatsapp"></i> Cobrar</button>
        <button class="btn-primary" onclick="liberarAssinatura('${c.id}')" title="Liberar 30 dias de acesso"><i class="fas fa-unlock"></i> 30 dias</button>
        <button class="btn-info" onclick="abrirEdicao('${c.id}')" title="Editar"><i class="fas fa-pen"></i></button>
        <button class="btn-danger" onclick="excluirCliente('${c.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

async function liberarAssinatura(id) {
  try {
    const ref = db.collection('clientesAdmin').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return;
    const dados = snap.data();
    const agora = Date.now();
    const assinaturaFimAtualMs = dados.assinaturaFim && dados.assinaturaFim.toMillis ? dados.assinaturaFim.toMillis() : 0;
    const baseMs = assinaturaFimAtualMs > agora ? assinaturaFimAtualMs : agora;
    const novoFim = firebase.firestore.Timestamp.fromMillis(baseMs + 30 * 24 * 60 * 60 * 1000);
    await ref.update({
      statusConta: 'ativa',
      assinaturaFim: novoFim,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('30 dias liberados com sucesso.');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível liberar a assinatura.', true);
  }
}
window.liberarAssinatura = liberarAssinatura;

function abrirEdicao(id) {
  const c = clientesCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('editClientId').value = id;
  document.getElementById('editNome').value = c.nome || '';
  document.getElementById('editEmail').value = c.email || '';
  document.getElementById('editWhatsapp').value = c.whatsapp || '';
  document.getElementById('editModal').classList.remove('hidden');
}
window.abrirEdicao = abrirEdicao;
function fecharEdicao() { document.getElementById('editModal').classList.add('hidden'); }

async function salvarEdicao(event) {
  event.preventDefault();
  const id = document.getElementById('editClientId').value;
  const nome = String(document.getElementById('editNome').value || '').trim();
  const email = String(document.getElementById('editEmail').value || '').trim();
  const whatsapp = String(document.getElementById('editWhatsapp').value || '').trim();
  if (!nome || !email || !whatsapp) { showToast('Preencha todos os campos.', true); return; }
  try {
    await db.collection('clientesAdmin').doc(id).update({
      nome, email, whatsapp,
      ultimaAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Cliente atualizado.');
    fecharEdicao();
  } catch (error) {
    console.error(error);
    showToast('Não foi possível salvar as alterações.', true);
  }
}

const _pendingConfirms = new Map();
function confirmar(message) {
  const now = Date.now();
  const last = _pendingConfirms.get(message) || 0;
  if (now - last < 2500) { _pendingConfirms.delete(message); return true; }
  _pendingConfirms.set(message, now);
  showToast(`${message} Clique novamente para confirmar.`);
  return false;
}
async function excluirCliente(id) {
  if (!confirmar('Excluir este cadastro?')) return;
  try {
    await db.collection('clientesAdmin').doc(id).delete();
    showToast('Cadastro excluído do painel administrativo.');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível excluir.', true);
  }
}
window.excluirCliente = excluirCliente;

/* ---------- COBRANÇA / RENOVAÇÃO VIA WHATSAPP ---------- */
let configGeral = { linkPagamento: '', diasTeste: 7 };

function enviarLembreteRenovacao(id) {
  const c = clientesCache.find(x => x.id === id);
  if (!c) return;
  const numero = String(c.whatsapp || '').replace(/\D/g, '');
  if (!numero) { showToast('Este cliente não tem WhatsApp cadastrado.', true); return; }
  const { status, fimMs } = calcularStatus(c);
  const dias = fimMs ? diasRestantes(fimMs) : null;
  const link = configGeral.linkPagamento || '';

  let situacao;
  if (status === 'expirada') situacao = 'seu acesso está *vencido*';
  else if (status === 'teste' && dias !== null) situacao = `seu *teste grátis* termina em *${dias <= 0 ? 'menos de 1 dia' : dias + ' dia(s)'}*`;
  else if (status === 'ativa' && dias !== null) situacao = `sua *assinatura* vence em *${dias <= 0 ? 'menos de 1 dia' : dias + ' dia(s)'}*`;
  else situacao = 'sua assinatura precisa ser renovada';

  let texto = `Olá *${c.nome || ''}*! Passando para lembrar que ${situacao} na Agenda IPTV.`;
  if (link) texto += `\n\nPara renovar/ativar, é só acessar o link abaixo:\n${link}`;
  texto += `\n\nQualquer dúvida, estou à disposição!`;

  const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(numero)}&text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}
window.enviarLembreteRenovacao = enviarLembreteRenovacao;

/* ---------- CONFIGURAÇÕES ---------- */
async function carregarConfig() {
  try {
    const snap = await db.collection('configAdmin').doc('geral').get();
    const data = snap.exists ? snap.data() : {};
    configGeral.linkPagamento = data.linkPagamento || '';
    configGeral.diasTeste = data.diasTeste || 7;
    document.getElementById('cfgLinkPagamento').value = configGeral.linkPagamento;
    document.getElementById('cfgDiasTeste').value = configGeral.diasTeste;
  } catch (error) { console.error(error); }
}
async function salvarConfig(event) {
  event.preventDefault();
  const linkPagamento = String(document.getElementById('cfgLinkPagamento').value || '').trim();
  const diasTeste = Number(document.getElementById('cfgDiasTeste').value) || 7;
  try {
    await db.collection('configAdmin').doc('geral').set({ linkPagamento, diasTeste }, { merge: true });
    configGeral.linkPagamento = linkPagamento;
    configGeral.diasTeste = diasTeste;
    showToast('Configurações salvas.');
  } catch (error) {
    console.error(error);
    showToast('Não foi possível salvar as configurações.', true);
  }
}

/* ---------- INICIALIZAÇÃO ---------- */
function wireUi() {
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('headerLogoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('editClientForm')?.addEventListener('submit', salvarEdicao);
  document.getElementById('cancelEditBtn')?.addEventListener('click', fecharEdicao);
  document.getElementById('configForm')?.addEventListener('submit', salvarConfig);
  document.getElementById('buscaClientes')?.addEventListener('input', renderClientes);
  document.getElementById('ordenarClientes')?.addEventListener('change', renderClientes);
  document.getElementById('filtroStatus')?.addEventListener('change', renderClientes);

  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    const isFree = tab.dataset.authExempt === 'true';
    if (!currentUser && !isFree) { switchTab('login'); return; }
    switchTab(tab.dataset.tab);
    if (tab.dataset.tab === 'config') carregarConfig();
  }));
  document.getElementById('menuToggle')?.addEventListener('click', openSidebar);
  document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
}

function init() {
  app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  db = firebase.firestore();
  wireUi();
  auth.onAuthStateChanged(user => {
    if (user && !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(String(user.email || '').toLowerCase())) {
      showToast('Esta conta não tem permissão de administrador.', true);
      auth.signOut();
      return;
    }
    currentUser = user || null;
    updateAuthUi();
    if (currentUser) { iniciarSincronizacao(); carregarConfig(); }
    else pararSincronizacao();
  });
}

document.addEventListener('DOMContentLoaded', init);
