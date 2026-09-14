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
});