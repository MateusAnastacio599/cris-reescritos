const CREDENTIALS = {
  'iris-7x91': { name: 'Íris Tenebra Vasconcellos', clearance: 'NÍVEL DE ACESSO: 05' },
  'andre-4k27': { name: 'André Torres', clearance: 'NÍVEL DE ACESSO: 04' },
  'matias-9q63': { name: 'Matias Valen Azevedo', clearance: 'NÍVEL DE ACESSO: 04' },
  'celine-2m84': { name: 'Celine Lins Noir', clearance: 'NÍVEL DE ACESSO: 04' },
  'convidado-26': { name: 'AGENTE CONVIDADO', clearance: 'NÍVEL DE ACESSO: 03' }
};

const STORAGE_KEY = 'cris_agente';

document.addEventListener('DOMContentLoaded', () => {
  const login = document.getElementById('login-screen');
  const system = document.getElementById('system');
  const input = document.getElementById('password');
  const button = document.getElementById('login-button');
  const togglePassword = document.getElementById('password-toggle');
  const error = document.getElementById('login-error');
  const agentName = document.getElementById('agent-name');
  const clearance = document.getElementById('agent-clearance');
  const topAgentName = document.getElementById('top-agent-name');
  const topAgentClearance = document.getElementById('top-agent-clearance');
  const sidebar = document.getElementById('case-sidebar');
  const menuToggle = document.getElementById('menu-toggle');
  const logout = document.getElementById('logout-button');

  function showSystem(agent) {
    agentName.textContent = agent.name;
    clearance.textContent = agent.clearance;
    topAgentName.textContent = agent.name;
    topAgentClearance.textContent = agent.clearance.replace('NÍVEL DE ACESSO:', 'NÍVEL');

    login.classList.add('authenticated');

    setTimeout(() => {
      login.classList.add('hidden');
      system.classList.remove('hidden');
      window.scrollTo(0, 0);
    }, 650);
  }

  function authenticate() {
    const key = input.value.trim().toLowerCase();
    const agent = CREDENTIALS[key];

    if (!agent) {
      error.textContent = '[ERRO] CREDENCIAL INVÁLIDA // ACESSO NEGADO';
      input.classList.add('invalid');
      setTimeout(() => input.classList.remove('invalid'), 500);
      return;
    }

    localStorage.setItem(STORAGE_KEY, key);
    showSystem(agent);
  }

  const savedAgent = localStorage.getItem(STORAGE_KEY);
  if (savedAgent && CREDENTIALS[savedAgent]) {
    showSystem(CREDENTIALS[savedAgent]);
  }

  /* =========================================================
     LOGIN
     ========================================================= */
  button.addEventListener('click', authenticate);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') authenticate();
  });

  /* =========================================================
     MOSTRAR / OCULTAR SENHA
     ========================================================= */
  togglePassword.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';

    togglePassword.innerHTML = visible
      ? '<svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>'
      : '<svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18"></path><path d="M10.6 6.7A10.9 10.9 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a18.8 18.8 0 0 1-3.1 3.6"></path><path d="M6.1 6.9C3.8 8.3 2.5 12 2.5 12S6 17.5 12 17.5c1.2 0 2.3-.2 3.3-.6"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';

    togglePassword.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
    togglePassword.setAttribute('aria-pressed', String(!visible));
    togglePassword.classList.toggle('is-visible', !visible);
  });

  /* =========================================================
     MENU MOBILE
     ========================================================= */
  menuToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });

  document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', () => {
      sidebar.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  /* =========================================================
     ENCERRAR SESSÃO
     ========================================================= */
  logout.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    system.classList.add('hidden');
    sidebar.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    login.classList.remove('hidden', 'authenticated');

    input.value = '';
    input.type = 'password';
    togglePassword.innerHTML =
      '<svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>';
    togglePassword.setAttribute('aria-label', 'Mostrar senha');
    togglePassword.setAttribute('aria-pressed', 'false');
    togglePassword.classList.remove('is-visible');
    error.textContent = '';
    input.focus();
  });

  /* =========================================================
     OBSERVER DE NAVEGAÇÃO
     ========================================================= */
  const links = [...document.querySelectorAll('.nav a')];
  const sections = links
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(link => {
            link.classList.toggle(
              'active',
              link.getAttribute('href') === '#' + entry.target.id
            );
          });
        }
      });
    },
    { rootMargin: '-25% 0px -65% 0px', threshold: 0 }
  );

  sections.forEach(section => observer.observe(section));

  /* =========================================================
     ÁUDIO DO SAMUEL
     ========================================================= */
  const samuelPlayer = document.getElementById('samuel-player');
  const samuelAudio = document.getElementById('samuel-audio');

  if (samuelPlayer && samuelAudio) {
    const timeDisplay = samuelPlayer.parentElement.querySelector('.audio-time');

    const formatAudioTime = seconds => {
      if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
      const totalSeconds = Math.floor(seconds);
      const minutes = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const updateAudioTime = () => {
      if (!timeDisplay) return;
      const current = formatAudioTime(samuelAudio.currentTime);
      const duration = formatAudioTime(samuelAudio.duration);
      timeDisplay.textContent = `${current} / ${duration}`;
    };

    samuelAudio.addEventListener('loadedmetadata', updateAudioTime);
    samuelAudio.addEventListener('durationchange', updateAudioTime);
    samuelAudio.addEventListener('timeupdate', updateAudioTime);
    samuelAudio.addEventListener('loadeddata', updateAudioTime);
    updateAudioTime();

    samuelPlayer.addEventListener('click', () => {
      if (!samuelAudio.src) return;
      if (samuelAudio.paused) samuelAudio.play().catch(() => {});
      else samuelAudio.pause();
    });

    samuelAudio.addEventListener('play', () => {
      const label = samuelPlayer.querySelector('.play-label');
      const icon = samuelPlayer.querySelector('.play');
      if (label) label.textContent = 'REPRODUZINDO REGISTRO';
      if (icon) icon.textContent = '❚❚';
    });

    samuelAudio.addEventListener('pause', () => {
      const label = samuelPlayer.querySelector('.play-label');
      const icon = samuelPlayer.querySelector('.play');
      if (label) label.textContent = 'REPRODUZIR REGISTRO';
      if (icon) icon.textContent = '▶';
    });

    samuelAudio.addEventListener('ended', () => {
      const label = samuelPlayer.querySelector('.play-label');
      const icon = samuelPlayer.querySelector('.play');
      if (label) label.textContent = 'REPRODUZIR REGISTRO';
      if (icon) icon.textContent = '▶';
      updateAudioTime();
    });
  }

  /* =========================================================
     EQUIPE — MODAL
     ========================================================= */
  const teamPanel = document.querySelector('.team-panel');
  const teamToggle = document.getElementById('team-toggle');
  if (teamPanel && teamToggle) {
    teamToggle.addEventListener('click', () => {
      const collapsed = teamPanel.classList.toggle('collapsed');
      teamToggle.setAttribute('aria-expanded', String(!collapsed));
      teamToggle.querySelector('span').textContent = collapsed ? 'MOSTRAR' : 'EQUIPE';
    });
  }

  const agentProfiles = {
    iris: { number: 'REGISTRO // AGENTE 01', name: 'Íris Tenebra Vasconcellos', access: 'NÍVEL DE ACESSO: 05', status: 'EX-AGENTE // STATUS: DESAPARECIDA', image: 'assets/iris.jpg', profile: 'Consultora e investigadora de ocorrências paranormais. Atua por análise de padrões, investigação independente e avaliação de fenômenos incomuns.', history: 'Ex-médica socorrista recrutada após demonstrar conhecimento incomum sobre ocorrências paranormais. Desenvolveu experiência em investigação e reconhecimento de anomalias.', operations: 'Participação em operações de alto risco. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.' },
    andre: { number: 'REGISTRO // AGENTE 02', name: 'André Torres', access: 'NÍVEL DE ACESSO: 04', status: 'AGENTE // STATUS: ATIVO', image: 'assets/andre.jpg', profile: 'Combatente de campo. Demonstra adaptação rápida, iniciativa e resistência sob pressão. Prefere soluções práticas e ação direta quando necessário.', history: 'Ex-militar do Exército Brasileiro, recrutado após sobreviver a uma ocorrência paranormal durante uma operação de patrulha.', operations: 'Atuação em operações de contenção e confronto. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.' },
    matias: { number: 'REGISTRO // AGENTE 03', name: 'Matias Valen Azevedo', access: 'NÍVEL DE ACESSO: 04', status: 'AGENTE // STATUS: ATIVO', image: 'assets/matias.jpg', profile: 'Combatente especializado em confronto direto e proteção de aliados. Demonstra disciplina, determinação e forte comprometimento com a segurança de civis.', history: 'Filho do lutador Leônidas Azevedo. Após acontecimentos familiares relacionados ao paranormal, encontrou registros da Ordem e iniciou sua busca por respostas até ser recrutado.', operations: 'Participação em operações de campo e contenção. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.' },
    celine: { number: 'REGISTRO // AGENTE 04', name: 'Celine Lins Noir', access: 'NÍVEL DE ACESSO: 04', status: 'AGENTE // STATUS: ATIVO', image: 'assets/celine.png', profile: 'Bióloga e agente da Divisão Europeia, especializada em identificação, comportamento e estudo de criaturas. Possui treinamento avançado com lâminas e bom desempenho em operações de campo.', history: 'Filha do pesquisador Calisto Noir. Cresceu em um ambiente ligado à ciência e ao estudo da vida antes de ingressar na Ordem e combinar sua formação científica ao treinamento operacional.', operations: 'Atuação em investigações biológicas e ocorrências envolvendo criaturas. Registros operacionais mantidos em nível restrito.' },
    leia: { number: 'REGISTRO // AGENTE 05', name: 'Léia Vancini', access: 'NÍVEL DE ACESSO: 05', status: 'AGENTE // STATUS: ATIVO', image: 'assets/leia.jpg', profile: 'Especialista em operações de campo da Ordo Realitas. Possui treinamento avançado em combate, investigação e sobrevivência, com desempenho consistente em situações de alto risco.', history: 'Agente com extensa experiência operacional e histórico marcado por ocorrências de elevado risco. Atualmente permanece em atividade junto a equipes de campo.', operations: 'Participação em operações de campo de alta complexidade. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.' },
    samuel: { number: 'REGISTRO // AGENTE 06', name: 'Samuel Norte', access: 'NÍVEL DE ACESSO: 04', status: 'AGENTE // STATUS: ATIVO', image: 'assets/samuel.jpg', profile: 'Especialista em inteligência, sistemas e análise digital. Atua principalmente nos bastidores das operações, identificando padrões, anomalias e informações difíceis de detectar por equipes convencionais.', history: 'Nascido no Rio de Janeiro, Samuel demonstrou desde cedo capacidade excepcional para tecnologia e lógica. Seu talento o levou à Ordem, onde passou a atuar junto às equipes de inteligência e campo.', operations: 'Responsável por parte relevante do desenvolvimento e aprimoramento do C.R.I.S.' },
    unknown: { number: 'REGISTRO // AGENTE 07', name: '?', access: 'NÍVEL DE ACESSO: ?', status: 'DIVISÃO EUROPEIA // AGENTE DE RECONHECIDO PRESTÍGIO', image: '', profile: 'Registro parcial. Vinculado à Divisão Europeia da Ordo Realitas. Considerado um agente de reconhecido prestígio dentro da organização.', history: 'Informações biográficas indisponíveis para este nível de consulta.', operations: 'Registros operacionais classificados.' }
  };

  const agentModal = document.getElementById('agent-modal');
  const agentModalClose = document.getElementById('agent-modal-close');
  const agentModalNumber = document.getElementById('agent-modal-number');
  const agentModalName = document.getElementById('agent-modal-name');
  const agentModalAccess = document.getElementById('agent-modal-access');
  const agentModalStatus = document.getElementById('agent-modal-status');
  const agentModalProfile = document.getElementById('agent-modal-profile');
  const agentModalHistory = document.getElementById('agent-modal-history');
  const agentModalOperations = document.getElementById('agent-modal-operations');
  const agentModalPhoto = document.getElementById('agent-modal-photo');

  function closeAgentModal() {
    if (!agentModal) return;
    agentModal.classList.remove('open');
    agentModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function openAgentModal(id) {
    const a = agentProfiles[id];
    if (!a || !agentModal) return;
    agentModalNumber.textContent = a.number;
    agentModalName.textContent = a.name;
    agentModalAccess.textContent = a.access;
    agentModalStatus.textContent = a.status;
    agentModalProfile.textContent = a.profile;
    agentModalHistory.textContent = a.history;
    agentModalOperations.textContent = a.operations;
    agentModalPhoto.style.backgroundImage = a.image ? `url("${a.image}")` : 'none';
    agentModalPhoto.textContent = a.image ? '' : '?';
    agentModal.classList.add('open');
    agentModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  document.querySelectorAll('.agent-profile-card').forEach(card => {
    card.addEventListener('click', () => openAgentModal(card.dataset.agent));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openAgentModal(card.dataset.agent);
      }
    });
  });

  if (agentModalClose) agentModalClose.addEventListener('click', closeAgentModal);
  if (agentModal) agentModal.querySelector('[data-close-agent]').addEventListener('click', closeAgentModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAgentModal();
  });

  /* =========================================================
     VIEWS SOB DEMANDA
     ========================================================= */
  const content = document.querySelector('.content');
  document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      if (target.classList.contains('restricted-section')) {
        event.preventDefault();
        document.querySelectorAll('.restricted-section').forEach(section => section.classList.remove('is-open'));
        target.classList.add('is-open');
        content.classList.add('view-restricted');
        document.querySelectorAll('.nav a').forEach(item => item.classList.remove('active'));
        link.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        content.classList.remove('view-restricted');
        document.querySelectorAll('.restricted-section').forEach(section => section.classList.remove('is-open'));
      }
    });
  });

  /* =========================================================
     FICHAS DE PERSONAGEM // DICIONÁRIO DE ATRIBUTOS E PERÍCIAS
     ========================================================= */
  const fichaSaveButton = document.getElementById('ficha-save');
  const fichaNewButton = document.getElementById('ficha-new');
  const fichaImportButton = document.getElementById('ficha-import');
  const fichaExportButton = document.getElementById('ficha-export');
  const fichaDeleteButton = document.getElementById('ficha-delete');
  const fichaImportFile = document.getElementById('ficha-import-file');
  const fichaFeedback = document.getElementById('ficha-feedback');
  const fichaStatus = document.getElementById('ficha-status');

  const FICHA_STORAGE_KEY = 'cris_ficha_v2';
  const FICHA_LEGACY_KEY = 'cris_ficha_atual';
  const FICHA_DRAFT_KEY = 'cris_ficha_draft_v1';
  const FICHA_DIE_ORDER = ['d4', 'd6', 'd8', 'd10', 'd12'];
  const FICHA_DIE_FACES = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12 };
  const FICHA_SKILL_START_DIE = 'd4';

  const FICHA_ATTR_LABELS = {
    fisico: 'FÍSICO',
    mente: 'MENTE',
    emocao: 'EMOÇÃO'
  };

  const FICHA_SKILLS = [
    ['acrobacia', 'Acrobacia', 'fisico', 'Movimentos de ginástica e parkour, andar de skate ou patins.'],
    ['atletismo', 'Atletismo', 'fisico', 'Correr, saltar, escalar, nadar, remar.'],
    ['crime', 'Crime', 'fisico', 'Furtar objetos, abrir fechaduras, falsificar documentos.'],
    ['disciplina', 'Disciplina', 'emocao', 'Estudar, meditar, resistir a traumas e sustos.'],
    ['enganacao', 'Enganação', 'emocao', 'Mentir, disfarçar-se, seduzir.'],
    ['furtividade', 'Furtividade', 'fisico', 'Esconder-se, andar sem ser visto ou ouvido.'],
    ['intimidar', 'Intimidar', 'emocao', 'Assustar pessoas, coagi-las a fazerem o que você quer.'],
    ['intuicao', 'Intuição', 'emocao', '“Sexto sentido” para analisar pessoas e ambientes.'],
    ['luta', 'Luta', 'fisico', 'Atacar desarmado ou com armas corpo a corpo.'],
    ['maquinas', 'Máquinas', 'mente', 'Operar e consertar máquinas, dirigir veículos motorizados.'],
    ['medicina', 'Medicina', 'mente', 'Primeiros socorros, tratamentos, necropsias.'],
    ['ocultismo', 'Ocultismo', 'mente', 'Conhecimento sobre o paranormal.'],
    ['percepcao', 'Percepção', 'mente', 'Notar coisas através de visão, audição e olfato, revistar lugares.'],
    ['persuasao', 'Persuasão', 'emocao', 'Convencer pessoas com argumentos e lábia.'],
    ['pesquisar', 'Pesquisar', 'mente', 'Pesquisar documentos e bancos de dados, analisar evidências.'],
    ['pontaria', 'Pontaria', 'fisico', 'Atacar com armas de arremesso ou de disparo.'],
    ['sobrevivencia', 'Sobrevivência', 'mente', 'Montar acampamento, rastrear, acalmar animais ferozes.'],
    ['tecnologia', 'Tecnologia', 'mente', 'Operar dispositivos tecnológicos, hackear redes.'],
    ['vigor', 'Vigor', 'fisico', 'Manter o fôlego, resistir a venenos, suportar ferimentos.']
  ];

  const FICHA_APTIDOES = [
    ['artes', 'Artes', 'Formas de arte, como música, dança, escrita, pintura, atuação e outras.'],
    ['atualidades', 'Atualidades', 'Assuntos gerais, como esporte, entretenimento e cultura popular.'],
    ['burocracia', 'Burocracia', 'Direito, política, economia, contabilidade e estruturas governamentais e corporativas.'],
    ['exatas', 'Exatas', 'Ciências exatas, como matemática, física, química, biologia, astronomia e geologia.'],
    ['humanas', 'Humanas', 'Ciências humanas, como história, geografia, filosofia, sociologia, teologia e linguística.'],
    ['tatica', 'Tática', 'Educação militar e estratégica.']
  ];

  const FICHA_ITEM_TYPES = [
    ['equipamento', 'EQUIPAMENTO'],
    ['ferramenta', 'FERRAMENTA'],
    ['consumivel', 'CONSUMÍVEL'],
    ['tecnologia', 'TECNOLOGIA'],
    ['documento', 'DOCUMENTO'],
    ['especial', 'ESPECIAL'],
    ['outro', 'OUTRO']
  ];

  function fichaDefault() {
    return {
      name: '', player: '', type: 'agente', profile: 'executor', occupation: '', level: 1, nex: 0, portrait: '',
      concept: '', appearance: '', history: '',
      attributes: { fisico: 'd6', mente: 'd6', emocao: 'd6' },
      resources: { pvCurrent: 0, pvMax: 0, pdCurrent: 0, pdMax: 0 },
      skills: Object.fromEntries(FICHA_SKILLS.map(([key, , attr]) => [key, { die: FICHA_SKILL_START_DIE, atributo: attr }])),
      aptidoes: Object.fromEntries(FICHA_APTIDOES.map(([key, label]) => [key, { label, die: FICHA_SKILL_START_DIE }])),
      abilities: [],
      inventory: [
        { name: 'Lanterna tática', type: 'ferramenta', quantity: 1, equipped: true, details: 'Fonte de luz portátil para operações noturnas ou recintos sem energia.' },
        { name: 'Celular criptografado', type: 'tecnologia', quantity: 1, equipped: true, details: 'Dispositivo pessoal para comunicação operacional e consulta ao C.R.I.S.' },
        { name: 'Kit de primeiros socorros', type: 'consumivel', quantity: 1, equipped: false, details: 'Itens de sutura, ataduras e analgésicos para estabilização de ferimentos.' }
      ],
      notes: ''
    };
  }

  function fichaNormalize(source) {
    const out = fichaDefault();
    if (!source || typeof source !== 'object') return out;
    out.name = String(source.name ?? '');
    out.player = String(source.player ?? '');
    out.type = source.type === 'sobrevivente' ? 'sobrevivente' : 'agente';
    out.profile = ['executor', 'analista', 'vigilante'].includes(source.profile) ? source.profile : 'executor';
    out.occupation = String(source.occupation ?? '');
    out.concept = String(source.concept ?? '');
    out.appearance = String(source.appearance ?? '');
    out.history = String(source.history ?? '');
    out.level = Math.min(10, Math.max(1, Number(source.level ?? 1) || 1));
    out.nex = Math.min(100, Math.max(0, Number(source.nex ?? 0) || 0));
    out.portrait = typeof source.portrait === 'string' ? source.portrait : '';
    out.notes = String(source.notes ?? '');

    for (const key of ['fisico', 'mente', 'emocao']) {
      if (FICHA_DIE_ORDER.includes(source.attributes?.[key])) out.attributes[key] = source.attributes[key];
    }
    for (const key of ['pvCurrent', 'pvMax', 'pdCurrent', 'pdMax']) {
      out.resources[key] = Math.max(0, Number(source.resources?.[key] ?? 0) || 0);
    }

    for (const [key, , baseAttr] of FICHA_SKILLS) {
      out.skills[key] = { die: FICHA_SKILL_START_DIE, atributo: baseAttr };
    }

    out.aptidoes = Object.fromEntries(FICHA_APTIDOES.map(([key, label]) => [key, { label, die: FICHA_SKILL_START_DIE }]));

    if (Array.isArray(source.abilities)) {
      out.abilities = source.abilities.map(v => ({
        name: String(v?.name ?? ''), origin: String(v?.origin ?? ''), cost: String(v?.cost ?? ''), description: String(v?.description ?? '')
      })).filter(v => v.name || v.description || v.origin || v.cost);
    }

    if (Array.isArray(source.inventory)) {
      out.inventory = source.inventory.map(v => ({
        name: String(v?.name ?? ''),
        type: FICHA_ITEM_TYPES.some(([key]) => key === v?.type) ? v.type : 'equipamento',
        quantity: Math.max(1, Number(v?.quantity ?? 1) || 1),
        equipped: Boolean(v?.equipped),
        details: String(v?.details ?? '')
      })).filter(v => v.name || v.details);
    }

    return out;
  }

  let fichaState = fichaDefault();
  let fichaSaveTimer = null;
  let fichaCreationStep = 1;
  let fichaHasStoredData = false;

  const fichaWizard = document.getElementById('ficha-wizard');
  const fichaCharacterSheet = document.querySelector('.character-sheet');
  const wizardTitles = { 1: 'ETAPA 01 // IDENTIDADE', 2: 'ETAPA 02 // PERFIL', 3: 'ETAPA 03 // OCUPAÇÃO', 4: 'ETAPA 04 // ATRIBUTOS', 5: 'ETAPA 05 // PERÍCIAS', 6: 'ETAPA 06 // RECURSOS', 7: 'ETAPA 07 // HABILIDADES' };
  const wizardIntros = {
    1: 'Comece pelo básico. Você poderá revisar tudo antes de finalizar a ficha.',
    2: 'Seu Perfil define sua maneira mais natural de resolver problemas, mas não limita suas ações.',
    3: 'A Ocupação representa o que seu personagem faz da vida. A lista completa será adicionada nas próximas versões.',
    4: 'FÍSICO (corpo e velocidade), MENTE (raciocínio e técnica) e EMOÇÃO (força de vontade e instinto).',
    5: 'Perícias representam conhecimentos e técnicas aplicadas. O dado da perícia é somado ao dado do atributo no teste.',
    6: 'PV mede sua resistência física. PD mede sua resistência mental e determinação.',
    7: 'Habilidades são capacidades especiais fornecidas pelo Perfil, Ocupação e treino.'
  };

  function fichaSetVisible(showWizard) {
    if (fichaWizard) fichaWizard.classList.toggle('hidden', !showWizard);
    if (fichaCharacterSheet) fichaCharacterSheet.classList.toggle('hidden', showWizard);
  }

  function fichaWizardRenderAttributes() {
    document.querySelectorAll('[data-wizard-die]').forEach(button => {
      const field = button.dataset.wizardDie;
      button.innerHTML = fichaDieMarkup(fichaState.attributes[field] || 'd6');
    });
  }

  function fichaWizardRenderSkills() {
    const list = document.getElementById('wizard-skill-list');
    const aptList = document.getElementById('wizard-aptidao-list');
    if (!list || !aptList) return;
    list.innerHTML = '';

    const groups = { fisico: [], mente: [], emocao: [] };
    for (const [key, label, baseAttr, desc] of FICHA_SKILLS) groups[baseAttr].push([key, label, baseAttr, desc]);

    for (const attr of ['fisico', 'mente', 'emocao']) {
      const group = document.createElement('div');
      group.className = 'wizard-skill-group';
      group.innerHTML = `<div class="wizard-skill-group-head"><strong>${FICHA_ATTR_LABELS[attr]}</strong><span>PERÍCIAS</span></div>`;
      for (const [, label, baseAttr, desc] of groups[attr]) {
        const row = document.createElement('div');
        row.className = 'wizard-skill-row';
        row.title = `${label.toUpperCase()}: ${desc} (${FICHA_ATTR_LABELS[baseAttr]})`;
        row.innerHTML = `
          <span>${label}</span>
          <span class="skill-die-readonly" title="Valor inicial: d4">${fichaDieMarkup(FICHA_SKILL_START_DIE)}</span>
          <span class="skill-plus">+</span>
          <span class="skill-die-display">${fichaDieMarkup(fichaState.attributes[baseAttr] || 'd6')}</span>
          <span class="wizard-pair-label">${FICHA_ATTR_LABELS[baseAttr] || baseAttr}</span>`;
        group.appendChild(row);
      }
      list.appendChild(group);
    }

    aptList.innerHTML = '';
    for (const [, label, desc] of FICHA_APTIDOES) {
      const row = document.createElement('div');
      row.className = 'wizard-aptidao-row';
      row.title = `APTIDÃO (${label.toUpperCase()}): ${desc} (Mente)`;
      row.innerHTML = `
        <span class="wizard-aptidao-name">${fichaEscape(label)}</span>
        <span class="skill-die-readonly" title="Valor inicial: d4">${fichaDieMarkup(FICHA_SKILL_START_DIE)}</span>
        <span class="wizard-pair-label">+ MENTE</span>`;
      aptList.appendChild(row);
    }
  }

  function fichaWizardRenderAbilities() {
    const list = document.getElementById('wizard-ability-list');
    if (!list) return;
    list.innerHTML = '';
    if (!fichaState.abilities.length) {
      const empty = document.createElement('div');
      empty.className = 'wizard-empty';
      empty.textContent = 'Nenhuma habilidade adicionada ainda.';
      list.appendChild(empty);
      return;
    }
    fichaState.abilities.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'wizard-ability-row';
      row.innerHTML = `
        <input type="text" value="${fichaEscape(item.name)}" data-wizard-ability-field="name" data-index="${index}" placeholder="NOME DA HABILIDADE">
        <input type="text" value="${fichaEscape(item.origin)}" data-wizard-ability-field="origin" data-index="${index}" placeholder="ORIGEM">
        <button type="button" class="sheet-delete" data-wizard-delete-ability="${index}">EXCLUIR</button>
        <textarea data-wizard-ability-field="description" data-index="${index}" placeholder="Descrição da habilidade">${fichaEscape(item.description)}</textarea>`;
      list.appendChild(row);
    });
  }

  function fichaWizardRender() {
    if (!fichaWizard) return;
    fichaWizard.querySelectorAll('.wizard-step').forEach(step => {
      step.classList.toggle('active', Number(step.dataset.wizardStep) === fichaCreationStep);
    });
    const title = document.getElementById('wizard-title');
    const intro = document.getElementById('wizard-intro');
    const counter = document.getElementById('wizard-counter');
    const bar = document.getElementById('wizard-progress-bar');
    if (title) title.textContent = wizardTitles[fichaCreationStep];
    if (intro) intro.textContent = wizardIntros[fichaCreationStep];
    if (counter) counter.textContent = `${String(fichaCreationStep).padStart(2, '0')} / 07`;
    if (bar) bar.style.width = `${(fichaCreationStep / 7) * 100}%`;

    const next = document.getElementById('wizard-next');
    const back = document.getElementById('wizard-back');
    if (next) next.textContent = fichaCreationStep === 7 ? 'FINALIZAR FICHA' : 'CONTINUAR';
    if (back) back.disabled = fichaCreationStep === 1;

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
    set('wizard-name', fichaState.name);
    set('wizard-player', fichaState.player);
    set('wizard-type', fichaState.type);
    set('wizard-concept', fichaState.concept);
    set('wizard-occupation', fichaState.occupation);
    set('wizard-level', fichaState.level);
    set('wizard-nex', fichaState.nex);
    set('wizard-pv-current', fichaState.resources.pvCurrent);
    set('wizard-pv-max', fichaState.resources.pvMax);
    set('wizard-pd-current', fichaState.resources.pdCurrent);
    set('wizard-pd-max', fichaState.resources.pdMax);

    document.querySelectorAll('[data-wizard-profile]').forEach(button => {
      button.classList.toggle('selected', button.dataset.wizardProfile === fichaState.profile);
    });

    fichaWizardRenderAttributes();
    fichaWizardRenderSkills();
    fichaWizardRenderAbilities();
  }

  function fichaWizardCollectFields() {
    const get = id => document.getElementById(id);
    fichaState.name = get('wizard-name')?.value.trim() || fichaState.name;
    fichaState.player = get('wizard-player')?.value.trim() || fichaState.player;
    fichaState.type = get('wizard-type')?.value || fichaState.type;
    fichaState.concept = get('wizard-concept')?.value.trim() || fichaState.concept;
    fichaState.occupation = get('wizard-occupation')?.value.trim() || fichaState.occupation;
    fichaState.level = Math.min(10, Math.max(1, Number(get('wizard-level')?.value) || 1));
    fichaState.nex = Math.min(100, Math.max(0, Number(get('wizard-nex')?.value) || 0));
    fichaState.resources.pvCurrent = Math.max(0, Number(get('wizard-pv-current')?.value) || 0);
    fichaState.resources.pvMax = Math.max(0, Number(get('wizard-pv-max')?.value) || 0);
    fichaState.resources.pdCurrent = Math.max(0, Number(get('wizard-pd-current')?.value) || 0);
    fichaState.resources.pdMax = Math.max(0, Number(get('wizard-pd-max')?.value) || 0);
  }

  function fichaStartWizard(startStep = null) {
    clearTimeout(fichaSaveTimer);
    if (Number.isInteger(startStep)) fichaCreationStep = Math.min(7, Math.max(1, startStep));
    fichaSetVisible(true);
    fichaWizardRender();
  }

  function fichaFinishWizard() {
    fichaWizardCollectFields();
    if (!fichaState.name) {
      fichaFeedbackMessage('INFORME O NOME DA PERSONAGEM ANTES DE FINALIZAR');
      fichaCreationStep = 1;
      fichaWizardRender();
      return;
    }
    fichaSafeSave();
    fichaHasStoredData = true;
    fichaRender();
    fichaSetVisible(false);
    fichaFeedbackMessage('FICHA CRIADA // DADOS LOCAIS');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fichaResetAndDelete(showWizard = true) {
    clearTimeout(fichaSaveTimer);
    fichaState = fichaDefault();
    localStorage.removeItem(FICHA_STORAGE_KEY);
    localStorage.removeItem(FICHA_LEGACY_KEY);
    localStorage.removeItem(FICHA_DRAFT_KEY);
    fichaHasStoredData = false;
    fichaCreationStep = 1;
    fichaRender();
    if (showWizard) fichaStartWizard(1);
  }

  function fichaFeedbackMessage(message) {
    if (!fichaFeedback) return;
    fichaFeedback.textContent = message;
    clearTimeout(fichaFeedbackMessage.timer);
    fichaFeedbackMessage.timer = setTimeout(() => { fichaFeedback.textContent = ''; }, 2600);
  }

  function fichaSafeSave() {
    try {
      localStorage.setItem(FICHA_STORAGE_KEY, JSON.stringify(fichaState));
      if (fichaStatus) fichaStatus.textContent = 'SALVO // LOCAL';
      return true;
    } catch (err) {
      console.error('CRIS ficha: falha ao salvar', err);
      fichaFeedbackMessage('NÃO FOI POSSÍVEL SALVAR // ARMAZENAMENTO LOCAL CHEIO');
      return false;
    }
  }

  function fichaAutoSave() {
    clearTimeout(fichaSaveTimer);
    if (fichaWizard && !fichaWizard.classList.contains('hidden')) {
      try {
        localStorage.setItem(FICHA_DRAFT_KEY, JSON.stringify({ state: fichaState, step: fichaCreationStep }));
      } catch (err) {
        console.warn('CRIS ficha: falha ao salvar rascunho', err);
      }
      return;
    }
    if (fichaStatus) fichaStatus.textContent = 'ALTERADO // SALVAMENTO AUTOMÁTICO';
    fichaSaveTimer = setTimeout(fichaSafeSave, 450);
  }

  function fichaCycleDie(current) {
    const index = FICHA_DIE_ORDER.indexOf(current);
    return FICHA_DIE_ORDER[(index + 1) % FICHA_DIE_ORDER.length];
  }

  function fichaDieMarkup(die) {
    return `<span class="die-icon" data-die="${die}"><b>${FICHA_DIE_FACES[die] || 4}</b></span>`;
  }

  function fichaSet(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function fichaRenderAttributes() {
    document.querySelectorAll('[data-die-field]').forEach(button => {
      const field = button.dataset.dieField;
      const die = fichaState.attributes[field] || 'd6';
      button.innerHTML = fichaDieMarkup(die);
      button.dataset.dieValue = die;
    });
  }

  function fichaRenderResourcePips(pipsId, currentId, maxId) {
    const current = Math.max(0, Number(document.getElementById(currentId)?.value) || 0);
    const max = Math.max(0, Number(document.getElementById(maxId)?.value) || 0);
    const pips = document.getElementById(pipsId);
    if (!pips) return;
    pips.innerHTML = '';
    const count = Math.min(30, max);
    for (let n = 1; n <= count; n++) {
      const pip = document.createElement('button');
      pip.type = 'button';
      pip.className = `resource-pip${n <= current ? ' filled' : ''}`;
      pip.title = String(n);
      pip.setAttribute('aria-label', `Definir valor em ${n}`);
      pip.addEventListener('click', () => {
        const field = document.getElementById(currentId);
        if (field) field.value = n;
        if (pipsId === 'pv-pips') fichaState.resources.pvCurrent = n;
        else fichaState.resources.pdCurrent = n;
        fichaRenderResourcePips(pipsId, currentId, maxId);
        fichaAutoSave();
      });
      pips.appendChild(pip);
    }
    if (max > 30) {
      const note = document.createElement('span');
      note.className = 'resource-pips-note';
      note.textContent = `TRILHA 30 // TOTAL ${max}`;
      pips.appendChild(note);
    }
  }

  function fichaRenderResources() {
    fichaSet('pv-current', fichaState.resources.pvCurrent);
    fichaSet('pv-max', fichaState.resources.pvMax);
    fichaSet('pd-current', fichaState.resources.pdCurrent);
    fichaSet('pd-max', fichaState.resources.pdMax);
    fichaRenderResourcePips('pv-pips', 'pv-current', 'pv-max');
    fichaRenderResourcePips('pd-pips', 'pd-current', 'pd-max');
  }

  function fichaRenderAptidoes() {
    const list = document.getElementById('aptidao-list');
    if (!list) return;
    list.innerHTML = '';
    for (const [, label, desc] of FICHA_APTIDOES) {
      const row = document.createElement('div');
      row.className = 'aptidao-row';
      row.title = `APTIDÃO (${label.toUpperCase()}): ${desc} (Mente)`;
      row.dataset.search = `${label} aptidão mente ${desc}`.toLowerCase();
      row.innerHTML = `
        <span class="aptidao-name">${fichaEscape(label)}</span>
        <span class="skill-die-readonly" title="Valor inicial provisório: d4">${fichaDieMarkup(FICHA_SKILL_START_DIE)}</span>
        <span class="skill-plus">+</span>
        <span class="skill-die-display" aria-hidden="true">${fichaDieMarkup(fichaState.attributes.mente)}</span>
        <span class="skill-attribute-label">MENTE</span>`;
      list.appendChild(row);
    }
  }

  function fichaRenderSkills(filter = '') {
    const list = document.getElementById('skill-list');
    if (!list) return;
    const query = filter.trim().toLowerCase();
    list.innerHTML = '';
    for (const [key, label, baseAttr, desc] of FICHA_SKILLS) {
      const skill = fichaState.skills[key] || { die: 'd4', atributo: baseAttr };
      const attribute = skill.atributo || baseAttr;
      const row = document.createElement('div');
      row.className = 'skill-row';
      row.title = `${label.toUpperCase()}: ${desc} (Atributo base: ${FICHA_ATTR_LABELS[attribute]})`;
      row.dataset.search = `${label} ${FICHA_ATTR_LABELS[attribute] || attribute} ${desc}`.toLowerCase();
      row.hidden = Boolean(query && !row.dataset.search.includes(query));
      row.innerHTML = `
        <span class="skill-name">${label}</span>
        <span class="skill-die-readonly" title="Valor inicial provisório: d4">${fichaDieMarkup(FICHA_SKILL_START_DIE)}</span>
        <span class="skill-plus">+</span>
        <span class="skill-die-display" aria-hidden="true">${fichaDieMarkup(fichaState.attributes[baseAttr])}</span>
        <span class="skill-pair-label">${FICHA_ATTR_LABELS[baseAttr]}</span>`;
      list.appendChild(row);
    }
  }

  function fichaRenderAbilities() {
    const list = document.getElementById('ability-list');
    const empty = document.getElementById('ability-empty');
    if (!list || !empty) return;
    list.innerHTML = '';
    fichaState.abilities.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'sheet-item-card';
      card.innerHTML = `
        <div class="sheet-item-card-top">
          <input type="text" data-ability-field="name" data-index="${index}" value="${fichaEscape(item.name)}" placeholder="NOME DA HABILIDADE">
          <button type="button" class="sheet-delete" data-delete-ability="${index}">EXCLUIR</button>
        </div>
        <div class="item-meta ability-meta">
          <input type="text" data-ability-field="origin" data-index="${index}" value="${fichaEscape(item.origin)}" placeholder="ORIGEM">
          <input type="text" data-ability-field="cost" data-index="${index}" value="${fichaEscape(item.cost)}" placeholder="CUSTO">
        </div>
        <textarea data-ability-field="description" data-index="${index}" placeholder="Descrição da habilidade">${fichaEscape(item.description)}</textarea>`;
      list.appendChild(card);
    });
    empty.hidden = fichaState.abilities.length > 0;

    list.querySelectorAll('[data-ability-field]').forEach(el => {
      el.addEventListener('input', () => {
        const item = fichaState.abilities[Number(el.dataset.index)];
        if (!item) return;
        item[el.dataset.abilityField] = el.value;
        fichaAutoSave();
      });
    });

    list.querySelectorAll('[data-delete-ability]').forEach(btn => {
      btn.addEventListener('click', () => {
        fichaState.abilities.splice(Number(btn.dataset.deleteAbility), 1);
        fichaRenderAbilities();
        fichaAutoSave();
      });
    });
  }

  function fichaItemIconMarkup(type) {
    const icons = {
      equipamento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h6l1 3h-8l1-3Zm-4 3h14v11H5V8Zm4 4h6"/></svg>',
      ferramenta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5.5 4 4M5 19l6.8-6.8m1.4-1.4L19 5l-2-2-5.8 5.8M4 20l4-1 1-4-3-3-4 4 2 4Z"/></svg>',
      consumivel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v14H7zM9 5V3h6v2M10 9h4M10 13h4"/></svg>',
      tecnologia: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 9h8M8 12h5M8 15h8"/></svg>',
      documento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5"/></svg>',
      especial: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.2 5.4L20 10l-5.8 1.7L12 17l-2.2-5.3L4 10l5.8-1.6L12 3Zm5 12 .9 2.2L20 18l-2.1.8L17 21l-.9-2.2L14 18l2.1-.8L17 15Z"/></svg>',
      outro: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>'
    };
    return icons[type] || icons.outro;
  }

  function fichaItemTypeLabel(type) {
    return FICHA_ITEM_TYPES.find(([key]) => key === type)?.[1] || 'OUTRO';
  }

  function fichaRenderInventory() {
    const list = document.getElementById('inventory-list');
    const empty = document.getElementById('inventory-empty');
    if (!list || !empty) return;
    const openIndices = new Set([...list.querySelectorAll('.inventory-card[open]')].map(card => Number(card.dataset.index)));
    list.innerHTML = '';
    fichaState.inventory.forEach((item, index) => {
      const card = document.createElement('details');
      card.className = 'sheet-item-card inventory-card';
      card.dataset.index = String(index);
      card.open = openIndices.has(index) || !item.name;
      const type = item.type || 'equipamento';
      card.innerHTML = `
        <summary class="inventory-summary">
          <span class="inventory-summary-main">
            <span class="inventory-icon">${fichaItemIconMarkup(type)}</span>
            <span class="inventory-summary-copy">
              <strong class="inventory-summary-name">${fichaEscape(item.name || 'ITEM SEM NOME')}</strong>
              <small>${fichaEscape(fichaItemTypeLabel(type))}${item.equipped ? ' // EQUIPADO' : ''}</small>
            </span>
          </span>
          <span class="inventory-summary-side"><b>${item.quantity}</b><span class="inventory-chevron">›</span></span>
        </summary>
        <div class="inventory-editor">
          <div class="sheet-item-card-top">
            <input type="text" data-inv-field="name" data-index="${index}" value="${fichaEscape(item.name)}" placeholder="NOME DO ITEM">
            <button type="button" class="sheet-delete" data-delete-inv="${index}">EXCLUIR</button>
          </div>
          <div class="item-meta inventory-meta">
            <label><span>TIPO</span><select data-inv-field="type" data-index="${index}">
              ${FICHA_ITEM_TYPES.map(([k, lbl]) => `<option value="${k}" ${type === k ? 'selected' : ''}>${lbl}</option>`).join('')}
            </select></label>
            <label><span>QUANTIDADE</span><input type="number" min="1" data-inv-field="quantity" data-index="${index}" value="${item.quantity}"></label>
            <label class="sheet-checkbox"><span>EQUIPADO</span><input type="checkbox" data-inv-field="equipped" data-index="${index}" ${item.equipped ? 'checked' : ''}></label>
          </div>
          <label class="inventory-details-field"><span>DESCRIÇÃO / OBSERVAÇÕES</span><textarea data-inv-field="details" data-index="${index}" placeholder="Detalhes, cargas ou observações">${fichaEscape(item.details)}</textarea></label>
        </div>`;
      list.appendChild(card);
    });
    empty.hidden = fichaState.inventory.length > 0;

    list.querySelectorAll('[data-inv-field]').forEach(el => {
      const eventName = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventName, () => {
        const item = fichaState.inventory[Number(el.dataset.index)];
        if (!item) return;
        const field = el.dataset.invField;
        if (el.type === 'checkbox') item[field] = el.checked;
        else if (field === 'quantity') item[field] = Math.max(1, Number(el.value) || 1);
        else item[field] = el.value;

        if (field === 'name') {
          const summaryName = el.closest('.inventory-card')?.querySelector('.inventory-summary-name');
          if (summaryName) summaryName.textContent = item.name || 'ITEM SEM NOME';
        } else if (field === 'type' || field === 'quantity' || field === 'equipped') {
          fichaRenderInventory();
        }
        fichaAutoSave();
      });
    });

    list.querySelectorAll('[data-delete-inv]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        fichaState.inventory.splice(Number(btn.dataset.deleteInv), 1);
        fichaRenderInventory();
        fichaAutoSave();
      });
    });
  }

  function fichaEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  function fichaRender() {
    fichaSet('sheet-name', fichaState.name);
    fichaSet('sheet-player', fichaState.player);
    fichaSet('sheet-type', fichaState.type);
    fichaSet('sheet-profile', fichaState.profile);
    fichaSet('sheet-occupation', fichaState.occupation);
    fichaSet('sheet-level', fichaState.level);
    fichaSet('sheet-nex', fichaState.nex);
    fichaSet('sheet-concept', fichaState.concept);
    fichaSet('sheet-appearance', fichaState.appearance);
    fichaSet('sheet-history', fichaState.history);
    fichaSet('sheet-notes', fichaState.notes);
    fichaRenderAttributes();
    fichaRenderResources();
    fichaRenderAptidoes();
    fichaRenderSkills(document.getElementById('skill-search')?.value || '');
    fichaRenderAbilities();
    fichaRenderInventory();

    const image = document.getElementById('sheet-portrait-image');
    const placeholder = document.getElementById('sheet-portrait-placeholder');
    if (image && placeholder) {
      if (fichaState.portrait) {
        image.src = fichaState.portrait;
        image.hidden = false;
        placeholder.hidden = true;
      } else {
        image.removeAttribute('src');
        image.hidden = true;
        placeholder.hidden = false;
      }
    }
  }

  function fichaCollectFields() {
    fichaState.name = document.getElementById('sheet-name')?.value.trim() || '';
    fichaState.player = document.getElementById('sheet-player')?.value.trim() || '';
    fichaState.type = document.getElementById('sheet-type')?.value || 'agente';
    fichaState.profile = document.getElementById('sheet-profile')?.value || 'executor';
    fichaState.occupation = document.getElementById('sheet-occupation')?.value.trim() || '';
    fichaState.concept = document.getElementById('sheet-concept')?.value || '';
    fichaState.appearance = document.getElementById('sheet-appearance')?.value || '';
    fichaState.history = document.getElementById('sheet-history')?.value || '';
    fichaState.level = Math.min(10, Math.max(1, Number(document.getElementById('sheet-level')?.value) || 1));
    fichaState.nex = Math.min(100, Math.max(0, Number(document.getElementById('sheet-nex')?.value) || 0));
    fichaState.resources.pvCurrent = Math.max(0, Number(document.getElementById('pv-current')?.value) || 0);
    fichaState.resources.pvMax = Math.max(0, Number(document.getElementById('pv-max')?.value) || 0);
    fichaState.resources.pdCurrent = Math.max(0, Number(document.getElementById('pd-current')?.value) || 0);
    fichaState.resources.pdMax = Math.max(0, Number(document.getElementById('pd-max')?.value) || 0);
    fichaState.notes = document.getElementById('sheet-notes')?.value || '';
  }

  ['sheet-name', 'sheet-player', 'sheet-type', 'sheet-profile', 'sheet-occupation', 'sheet-level', 'sheet-nex', 'sheet-concept', 'sheet-appearance', 'sheet-history', 'sheet-notes']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => { fichaCollectFields(); fichaAutoSave(); });
      el.addEventListener('change', () => { fichaCollectFields(); fichaAutoSave(); });
    });

  ['pv-current', 'pv-max', 'pd-current', 'pd-max'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      fichaCollectFields();
      const isPv = id.startsWith('pv-');
      fichaRenderResourcePips(isPv ? 'pv-pips' : 'pd-pips', isPv ? 'pv-current' : 'pd-current', isPv ? 'pv-max' : 'pd-max');
      fichaAutoSave();
    });
    el.addEventListener('change', () => {
      fichaCollectFields();
      fichaRenderResources();
      fichaAutoSave();
    });
  });

  document.querySelectorAll('[data-die-field]').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.dieField;
      fichaState.attributes[field] = fichaCycleDie(fichaState.attributes[field] || 'd6');
      fichaRenderAttributes();
      fichaRenderSkills(document.getElementById('skill-search')?.value || '');
      fichaRenderAptidoes();
      fichaAutoSave();
    });
  });

  document.querySelectorAll('[data-sheet-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.sheetTab;
      document.querySelectorAll('[data-sheet-tab]').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('[data-sheet-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.sheetPanel === target));
    });
  });

  const fichaSkillSearch = document.getElementById('skill-search');
  if (fichaSkillSearch) {
    fichaSkillSearch.addEventListener('input', () => {
      const query = fichaSkillSearch.value;
      fichaRenderSkills(query);
      const q = query.trim().toLowerCase();
      document.querySelectorAll('.aptidao-row').forEach(row => {
        row.hidden = Boolean(q && !row.dataset.search.includes(q));
      });
    });
  }

  const addAbility = document.getElementById('add-ability');
  if (addAbility) {
    addAbility.addEventListener('click', () => {
      fichaState.abilities.push({ name: '', origin: '', cost: '', description: '' });
      fichaRenderAbilities();
      fichaAutoSave();
      fichaFeedbackMessage('HABILIDADE ADICIONADA');
    });
  }

  const addItem = document.getElementById('add-item');
  if (addItem) {
    addItem.addEventListener('click', () => {
      fichaState.inventory.push({ name: '', type: 'equipamento', quantity: 1, equipped: false, details: '' });
      fichaRenderInventory();
      fichaAutoSave();
      fichaFeedbackMessage('ITEM ADICIONADO');
    });
  }

  document.querySelectorAll('[data-wizard-profile]').forEach(btn => {
    btn.addEventListener('click', () => {
      fichaState.profile = btn.dataset.wizardProfile;
      document.querySelectorAll('[data-wizard-profile]').forEach(item => item.classList.toggle('selected', item === btn));
      fichaAutoSave();
    });
  });

  document.querySelectorAll('[data-wizard-die]').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.wizardDie;
      fichaState.attributes[field] = fichaCycleDie(fichaState.attributes[field] || 'd6');
      fichaWizardRenderAttributes();
      fichaAutoSave();
    });
  });

  const wizardNext = document.getElementById('wizard-next');
  const wizardBack = document.getElementById('wizard-back');
  if (wizardNext) {
    wizardNext.addEventListener('click', () => {
      fichaWizardCollectFields();
      if (fichaCreationStep === 7) {
        fichaFinishWizard();
        return;
      }
      fichaCreationStep = Math.min(7, fichaCreationStep + 1);
      fichaWizardRender();
    });
  }

  if (wizardBack) {
    wizardBack.addEventListener('click', () => {
      if (fichaCreationStep <= 1) return;
      fichaWizardCollectFields();
      fichaCreationStep = Math.max(1, fichaCreationStep - 1);
      fichaWizardRender();
    });
  }

  ['wizard-name', 'wizard-player', 'wizard-type', 'wizard-concept', 'wizard-occupation', 'wizard-level', 'wizard-nex', 'wizard-pv-current', 'wizard-pv-max', 'wizard-pd-current', 'wizard-pd-max'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', fichaWizardCollectFields);
  });

  document.addEventListener('click', e => {
    const delAbility = e.target.closest?.('[data-wizard-delete-ability]');
    if (delAbility) {
      fichaState.abilities.splice(Number(delAbility.dataset.wizardDeleteAbility), 1);
      fichaWizardRenderAbilities();
      fichaAutoSave();
    }
  });

  document.addEventListener('input', e => {
    const ability = e.target.closest?.('[data-wizard-ability-field]');
    if (ability) {
      const item = fichaState.abilities[Number(ability.dataset.index)];
      if (item) item[ability.dataset.wizardAbilityField] = ability.value;
      fichaAutoSave();
    }
  });

  const wizardAddAbility = document.getElementById('wizard-add-ability');
  if (wizardAddAbility) {
    wizardAddAbility.addEventListener('click', () => {
      fichaState.abilities.push({ name: '', origin: '', cost: '', description: '' });
      fichaWizardRenderAbilities();
      fichaAutoSave();
    });
  }

  if (fichaDeleteButton) {
    fichaDeleteButton.addEventListener('click', () => {
      if (!fichaHasStoredData && !fichaState.name) {
        fichaFeedbackMessage('NENHUMA FICHA SALVA PARA APAGAR');
        return;
      }
      if (confirm('Apagar a ficha salva neste navegador? Esta ação remove os dados locais da personagem.')) {
        fichaResetAndDelete(true);
        fichaFeedbackMessage('FICHA APAGADA // DADOS LOCAIS REMOVIDOS');
      }
    });
  }

  if (fichaSaveButton) {
    fichaSaveButton.addEventListener('click', () => {
      if (fichaWizard && !fichaWizard.classList.contains('hidden')) {
        fichaWizardCollectFields();
        fichaAutoSave();
        fichaFeedbackMessage('RASCUNHO SALVO // DADOS LOCAIS');
        return;
      }
      fichaCollectFields();
      if (fichaSafeSave()) fichaFeedbackMessage('FICHA SALVA // DADOS LOCAIS');
    });
  }

  if (fichaNewButton) {
    fichaNewButton.addEventListener('click', () => {
      if (!confirm('Iniciar uma nova ficha? Os dados atuais salvos serão substituídos.')) return;
      fichaResetAndDelete(false);
      fichaStartWizard(1);
      fichaFeedbackMessage('NOVA FICHA INICIADA');
    });
  }

  const portraitButton = document.getElementById('sheet-portrait-button');
  const portraitFile = document.getElementById('sheet-portrait-file');
  if (portraitButton && portraitFile) {
    portraitButton.addEventListener('click', () => portraitFile.click());
    portraitFile.addEventListener('change', () => {
      const file = portraitFile.files?.[0];
      portraitFile.value = '';
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        fichaFeedbackMessage('IMAGEM MUITO GRANDE // LIMITE DE 4 MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 720;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          fichaState.portrait = canvas.toDataURL('image/jpeg', .82);
          fichaRender();
          fichaAutoSave();
          fichaFeedbackMessage('RETRATO ADICIONADO // DADOS LOCAIS');
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
  }

  if (fichaImportButton && fichaImportFile) {
    fichaImportButton.addEventListener('click', () => fichaImportFile.click());
    fichaImportFile.addEventListener('change', () => {
      const file = fichaImportFile.files?.[0];
      fichaImportFile.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          fichaState = fichaNormalize(JSON.parse(String(reader.result || '{}')));
          fichaSafeSave();
          localStorage.removeItem(FICHA_DRAFT_KEY);
          fichaHasStoredData = true;
          fichaRender();
          fichaSetVisible(false);
          fichaFeedbackMessage('FICHA IMPORTADA // DADOS LOCAIS');
        } catch (err) {
          console.error('CRIS ficha: importação inválida', err);
          fichaFeedbackMessage('ERRO AO IMPORTAR // JSON INVÁLIDO');
        }
      };
      reader.readAsText(file);
    });
  }

  if (fichaExportButton) {
    fichaExportButton.addEventListener('click', () => {
      if (fichaWizard && !fichaWizard.classList.contains('hidden')) fichaWizardCollectFields();
      else fichaCollectFields();
      const payload = JSON.stringify(fichaState, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const filename = (fichaState.name || 'personagem').toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-+|-+$/g, '') || 'personagem';
      anchor.download = `ficha-${filename}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      fichaFeedbackMessage('FICHA EXPORTADA // JSON');
    });
  }

  try {
    const stored = localStorage.getItem(FICHA_STORAGE_KEY) || localStorage.getItem(FICHA_LEGACY_KEY);
    if (stored) {
      fichaState = fichaNormalize(JSON.parse(stored));
      fichaHasStoredData = true;
    } else {
      const draftRaw = localStorage.getItem(FICHA_DRAFT_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (draft?.state && typeof draft.state === 'object') fichaState = fichaNormalize(draft.state);
        if (Number.isInteger(draft?.step) && draft.step >= 1 && draft.step <= 7) fichaCreationStep = draft.step;
      }
    }
  } catch (err) {
    console.warn('CRIS ficha: dados locais inválidos', err);
    fichaState = fichaDefault();
    fichaHasStoredData = false;
    fichaCreationStep = 1;
  }

  fichaRender();
  if (fichaHasStoredData) fichaSetVisible(false);
  else fichaStartWizard();
});