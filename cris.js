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
  const lumeLink = document.getElementById('lume-site-link');

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

    // Salva apenas o identificador do agente.
    // A senha nunca é armazenada.
    localStorage.setItem(STORAGE_KEY, key);

    showSystem(agent);
  }

  /*
   * RESTAURA SESSÃO
   *
   * Se o agente já tiver sido autenticado anteriormente
   * neste navegador, entra diretamente no CRIS.
   */
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

    togglePassword.setAttribute(
      'aria-label',
      visible ? 'Mostrar senha' : 'Ocultar senha'
    );

    togglePassword.setAttribute(
      'aria-pressed',
      String(!visible)
    );

    togglePassword.classList.toggle(
      'is-visible',
      !visible
    );
  });


  /* =========================================================
     MENU
     ========================================================= */

  menuToggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');

    menuToggle.setAttribute(
      'aria-expanded',
      String(open)
    );
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

    // Remove a sessão salva no navegador.
    localStorage.removeItem(STORAGE_KEY);

    system.classList.add('hidden');

    sidebar.classList.remove('open');

    menuToggle.setAttribute(
      'aria-expanded',
      'false'
    );

    login.classList.remove(
      'hidden',
      'authenticated'
    );

    input.value = '';
    input.type = 'password';

    togglePassword.innerHTML =
      '<svg class="password-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-5.5 9.5-5.5S21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>';

    togglePassword.setAttribute(
      'aria-label',
      'Mostrar senha'
    );

    togglePassword.setAttribute(
      'aria-pressed',
      'false'
    );

    togglePassword.classList.remove(
      'is-visible'
    );

    error.textContent = '';

    input.focus();
  });


  /* =========================================================
     LINK DA LUME
     ========================================================= */

  // O link principal da LUME fica propositalmente indisponível nesta versão.
  // Isso permite tratar a manutenção do material como parte da experiência do mestre.

  lumeLink.addEventListener('click', e => {
    e.preventDefault();

    lumeLink.textContent =
      'FONTE EM REVISÃO // SPOILERS EM MANUTENÇÃO';

    setTimeout(() => {
      lumeLink.innerHTML =
        'ACESSAR SITE DA LUME <span>↗</span>';
    }, 2600);
  });


  /* =========================================================
     NAVEGAÇÃO / SEÇÕES
     ========================================================= */

  const links = [
    ...document.querySelectorAll('.nav a')
  ];

  const sections = links
    .map(link =>
      document.querySelector(
        link.getAttribute('href')
      )
    )
    .filter(Boolean);

  const observer = new IntersectionObserver(
    entries =>
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(link => {
            link.classList.toggle(
              'active',
              link.getAttribute('href') ===
                '#' + entry.target.id
            );
          });
        }
      }),
    {
      rootMargin: '-25% 0px -65% 0px',
      threshold: 0
    }
  );

  sections.forEach(section =>
    observer.observe(section)
  );


  /* =========================================================
     ÁUDIO DO SAMUEL
     ========================================================= */

  const samuelPlayer =
    document.getElementById('samuel-player');

  const samuelAudio =
    document.getElementById('samuel-audio');

  if (samuelPlayer && samuelAudio) {

    const timeDisplay =
      samuelPlayer.parentElement
        .querySelector('.audio-time');

    const formatAudioTime = seconds => {

      if (
        !Number.isFinite(seconds) ||
        seconds < 0
      ) {
        return '00:00';
      }

      const totalSeconds =
        Math.floor(seconds);

      const minutes =
        Math.floor(totalSeconds / 60);

      const secs =
        totalSeconds % 60;

      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const updateAudioTime = () => {

      if (!timeDisplay) return;

      const current =
        formatAudioTime(
          samuelAudio.currentTime
        );

      const duration =
        formatAudioTime(
          samuelAudio.duration
        );

      timeDisplay.textContent =
        `${current} / ${duration}`;
    };


    // Atualiza o tempo assim que o navegador conhece
    // a duração do MP3 e durante a reprodução.

    samuelAudio.addEventListener(
      'loadedmetadata',
      updateAudioTime
    );

    samuelAudio.addEventListener(
      'durationchange',
      updateAudioTime
    );

    samuelAudio.addEventListener(
      'timeupdate',
      updateAudioTime
    );

    samuelAudio.addEventListener(
      'loadeddata',
      updateAudioTime
    );

    updateAudioTime();


    samuelPlayer.addEventListener(
      'click',
      () => {

        if (!samuelAudio.src) return;

        if (samuelAudio.paused) {
          samuelAudio
            .play()
            .catch(() => {});
        } else {
          samuelAudio.pause();
        }
      }
    );


    samuelAudio.addEventListener(
      'play',
      () => {

        const label =
          samuelPlayer.querySelector(
            '.play-label'
          );

        const icon =
          samuelPlayer.querySelector(
            '.play'
          );

        if (label) {
          label.textContent =
            'REPRODUZINDO REGISTRO';
        }

        if (icon) {
          icon.textContent = '❚❚';
        }
      }
    );


    samuelAudio.addEventListener(
      'pause',
      () => {

        const label =
          samuelPlayer.querySelector(
            '.play-label'
          );

        const icon =
          samuelPlayer.querySelector(
            '.play'
          );

        if (label) {
          label.textContent =
            'REPRODUZIR REGISTRO';
        }

        if (icon) {
          icon.textContent = '▶';
        }
      }
    );


    samuelAudio.addEventListener(
      'ended',
      () => {

        const label =
          samuelPlayer.querySelector(
            '.play-label'
          );

        const icon =
          samuelPlayer.querySelector(
            '.play'
          );

        if (label) {
          label.textContent =
            'REPRODUZIR REGISTRO';
        }

        if (icon) {
          icon.textContent = '▶';
        }

        updateAudioTime();
      }
    );
  }

  /* =========================================================
     EQUIPE — RECOLHER NO MOBILE / FICHAS
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
    iris:{number:'REGISTRO // AGENTE 01',name:'Íris Tenebra Vasconcellos',access:'NÍVEL DE ACESSO: 05',status:'EX-AGENTE // STATUS: DESAPARECIDA',image:'assets/iris.jpg',profile:'Consultora e investigadora de ocorrências paranormais. Atua por análise de padrões, investigação independente e avaliação de fenômenos incomuns.',history:'Ex-médica socorrista recrutada após demonstrar conhecimento incomum sobre ocorrências paranormais. Desenvolveu experiência em investigação e reconhecimento de anomalias.',operations:'Participação em operações de alto risco. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.'},
    andre:{number:'REGISTRO // AGENTE 02',name:'André Torres',access:'NÍVEL DE ACESSO: 04',status:'AGENTE // STATUS: ATIVO',image:'assets/andre.jpg',profile:'Combatente de campo. Demonstra adaptação rápida, iniciativa e resistência sob pressão. Prefere soluções práticas e ação direta quando necessário.',history:'Ex-militar do Exército Brasileiro, recrutado após sobreviver a uma ocorrência paranormal durante uma operação de patrulha.',operations:'Atuação em operações de contenção e confronto. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.'},
    matias:{number:'REGISTRO // AGENTE 03',name:'Matias Valen Azevedo',access:'NÍVEL DE ACESSO: 04',status:'AGENTE // STATUS: ATIVO',image:'assets/matias.jpg',profile:'Combatente especializado em confronto direto e proteção de aliados. Demonstra disciplina, determinação e forte comprometimento com a segurança de civis.',history:'Filho do lutador Leônidas Azevedo. Após acontecimentos familiares relacionados ao paranormal, encontrou registros da Ordem e iniciou sua busca por respostas até ser recrutado.',operations:'Participação em operações de campo e contenção. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.'},
    celine:{number:'REGISTRO // AGENTE 04',name:'Celine Lins Noir',access:'NÍVEL DE ACESSO: 04',status:'AGENTE // STATUS: ATIVO',image:'assets/celine.png',profile:'Bióloga e agente da Divisão Europeia, especializada em identificação, comportamento e estudo de criaturas. Possui treinamento avançado com lâminas e bom desempenho em operações de campo.',history:'Filha do pesquisador Calisto Noir. Cresceu em um ambiente ligado à ciência e ao estudo da vida antes de ingressar na Ordem e combinar sua formação científica ao treinamento operacional.',operations:'Atuação em investigações biológicas e ocorrências envolvendo criaturas. Registros operacionais mantidos em nível restrito.'},
    leia:{number:'REGISTRO // AGENTE 05',name:'Léia Vancini',access:'NÍVEL DE ACESSO: 05',status:'AGENTE // STATUS: ATIVO',image:'assets/leia.jpg',profile:'Especialista em operações de campo da Ordo Realitas. Possui treinamento avançado em combate, investigação e sobrevivência, com desempenho consistente em situações de alto risco.',history:'Agente com extensa experiência operacional e histórico marcado por ocorrências de elevado risco. Atualmente permanece em atividade junto a equipes de campo.',operations:'Participação em operações de campo de alta complexidade. Entre os registros de maior destaque, consta a resolução do caso dos Semeadores.'},
    samuel:{number:'REGISTRO // AGENTE 06',name:'Samuel Norte',access:'NÍVEL DE ACESSO: 04',status:'AGENTE // STATUS: ATIVO',image:'assets/samuel.jpg',profile:'Especialista em inteligência, sistemas e análise digital. Atua principalmente nos bastidores das operações, identificando padrões, anomalias e informações difíceis de detectar por equipes convencionais.',history:'Nascido no Rio de Janeiro, Samuel demonstrou desde cedo capacidade excepcional para tecnologia e lógica. Seu talento o levou à Ordem, onde passou a atuar junto às equipes de inteligência e campo.',operations:'Responsável por parte relevante do desenvolvimento e aprimoramento do C.R.I.S.'},
    unknown:{number:'REGISTRO // AGENTE 07',name:'?',access:'NÍVEL DE ACESSO: ?',status:'DIVISÃO EUROPEIA // AGENTE DE RECONHECIDO PRESTÍGIO',image:'',profile:'Registro parcial. Vinculado à Divisão Europeia da Ordo Realitas. Considerado um agente de reconhecido prestígio dentro da organização.',history:'Informações biográficas indisponíveis para este nível de consulta.',operations:'Registros operacionais classificados.'}
  };
  const agentModal=document.getElementById('agent-modal'), agentModalClose=document.getElementById('agent-modal-close'), agentModalNumber=document.getElementById('agent-modal-number'), agentModalName=document.getElementById('agent-modal-name'), agentModalAccess=document.getElementById('agent-modal-access'), agentModalStatus=document.getElementById('agent-modal-status'), agentModalProfile=document.getElementById('agent-modal-profile'), agentModalHistory=document.getElementById('agent-modal-history'), agentModalOperations=document.getElementById('agent-modal-operations'), agentModalPhoto=document.getElementById('agent-modal-photo');
  function closeAgentModal(){if(!agentModal)return;agentModal.classList.remove('open');agentModal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}
  function openAgentModal(id){const a=agentProfiles[id];if(!a||!agentModal)return;agentModalNumber.textContent=a.number;agentModalName.textContent=a.name;agentModalAccess.textContent=a.access;agentModalStatus.textContent=a.status;agentModalProfile.textContent=a.profile;agentModalHistory.textContent=a.history;agentModalOperations.textContent=a.operations;agentModalPhoto.style.backgroundImage=a.image?`url("${a.image}")`:'none';agentModalPhoto.textContent=a.image?'':'?';agentModal.classList.add('open');agentModal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')}
  document.querySelectorAll('.agent-profile-card').forEach(card=>{card.addEventListener('click',()=>openAgentModal(card.dataset.agent));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openAgentModal(card.dataset.agent)}})});
  if(agentModalClose)agentModalClose.addEventListener('click',closeAgentModal);
  if(agentModal)agentModal.querySelector('[data-close-agent]').addEventListener('click',closeAgentModal);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAgentModal()});

  /* =========================================================
     ARQUIVOS / LOCALIZAÇÕES — VIEWS SOB DEMANDA
     ========================================================= */
  const content = document.querySelector('.content');
  document.querySelectorAll('.nav a').forEach(link=>{
    link.addEventListener('click',event=>{
      const target=document.querySelector(link.getAttribute('href'));
      if(!target)return;
      if(target.classList.contains('restricted-section')){
        event.preventDefault();
        document.querySelectorAll('.restricted-section').forEach(section=>section.classList.remove('is-open'));
        target.classList.add('is-open');
        content.classList.add('view-restricted');
        document.querySelectorAll('.nav a').forEach(item=>item.classList.remove('active'));
        link.classList.add('active');
        window.scrollTo({top:0,behavior:'smooth'});
      }else{
        content.classList.remove('view-restricted');
        document.querySelectorAll('.restricted-section').forEach(section=>section.classList.remove('is-open'));
      }
    });
  });

});