// ===== PASSWORD TOGGLE =====
function togglePassword(fieldId, btn) {
  const field = document.getElementById(fieldId);
  const icon = btn.querySelector('i');
  if (field.type === 'password') {
    field.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    field.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

const globalLoader = document.getElementById('globalLoader');
function showGlobalLoader(label) {
  if (!globalLoader) return;
  const textNode = globalLoader.querySelector('.global-loader-card span:last-child');
  if (textNode && label) textNode.textContent = label;
  globalLoader.classList.add('active');
}
function hideGlobalLoader() {
  if (!globalLoader) return;
  globalLoader.classList.remove('active');
}

// ===== QUICK BACK BUTTON =====
(function() {
  document.querySelectorAll('.js-back-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const fallback = link.dataset.fallback || link.getAttribute('href') || '/';
      if (window.history.length > 1) {
        window.history.back();
      } else {
        showGlobalLoader('Going back...');
        window.location.assign(fallback);
      }
    });
  });
})();

// ===== PASSWORD MATCH CHECK =====
const regPass = document.getElementById('regPassword');
const regConfirm = document.getElementById('regConfirm');
const matchMsg = document.getElementById('matchMsg');
if (regConfirm) {
  regConfirm.addEventListener('input', () => {
    if (regConfirm.value === regPass.value) {
      matchMsg.textContent = '\u2713 Passwords match';
      matchMsg.style.color = '#2E7D32';
    } else {
      matchMsg.textContent = '\u2717 Passwords do not match';
      matchMsg.style.color = '#C62828';
    }
  });
}

// ===== CHAR COUNT =====
const desc = document.querySelector('textarea[name="description"]');
const charCount = document.getElementById('charCount');
if (desc && charCount) {
  const update = () => {
    const len = desc.value.length;
    charCount.textContent = `${len} / 500 characters`;
    charCount.style.color = len > 450 ? '#C62828' : '#637089';
  };
  desc.addEventListener('input', update);
  update();
}

// ===== AI COMPLAINT DESCRIPTION SUGGESTION =====
(function() {
  const suggestBtn = document.getElementById('aiSuggestBtn');
  const suggestStatus = document.getElementById('aiSuggestStatus');
  const descriptionField = document.querySelector('textarea[name="description"]');
  const categoryField = document.querySelector('select[name="category"]');
  const csrfField = document.querySelector('input[name="csrf_token"]');
  if (!suggestBtn || !descriptionField || !csrfField) return;

  const defaultBtnHtml = suggestBtn.innerHTML;
  const suggestionState = {
    original: '',
    suggested: '',
  };

  const previewWrap = document.createElement('div');
  previewWrap.className = 'ai-suggest-preview';
  previewWrap.hidden = true;
  previewWrap.innerHTML = `
    <div class="ai-suggest-preview-header">AI suggestion is ready. Review before applying.</div>
    <div class="ai-suggest-preview-grid">
      <div class="ai-suggest-preview-card">
        <strong>Your Draft</strong>
        <p class="ai-suggest-preview-text" data-preview="original"></p>
      </div>
      <div class="ai-suggest-preview-card suggested">
        <strong>AI Suggested</strong>
        <p class="ai-suggest-preview-text" data-preview="suggested"></p>
      </div>
    </div>
    <div class="ai-suggest-preview-actions">
      <button type="button" class="btn-primary" data-ai-action="apply">
        <i class="fas fa-check"></i> Use Suggestion
      </button>
      <button type="button" class="btn-secondary" data-ai-action="keep">
        <i class="fas fa-rotate-left"></i> Keep Original
      </button>
    </div>
  `;

  const toolsRow = suggestStatus ? suggestStatus.parentElement : suggestBtn.parentElement;
  if (toolsRow && toolsRow.parentElement) {
    toolsRow.parentElement.insertBefore(previewWrap, toolsRow.nextSibling);
  }

  const originalPreview = previewWrap.querySelector('[data-preview="original"]');
  const suggestedPreview = previewWrap.querySelector('[data-preview="suggested"]');

  function hidePreview() {
    previewWrap.hidden = true;
    suggestionState.original = '';
    suggestionState.suggested = '';
  }

  function showPreview(original, suggested) {
    suggestionState.original = original;
    suggestionState.suggested = suggested;
    if (originalPreview) originalPreview.textContent = original;
    if (suggestedPreview) suggestedPreview.textContent = suggested;
    previewWrap.hidden = false;
  }

  function setStatus(text, color) {
    if (!suggestStatus) return;
    suggestStatus.textContent = text;
    suggestStatus.style.color = color || '#637089';
  }

  previewWrap.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-ai-action]');
    if (!button) return;
    const action = button.getAttribute('data-ai-action');

    if (action === 'apply' && suggestionState.suggested) {
      descriptionField.value = suggestionState.suggested;
      descriptionField.dispatchEvent(new Event('input'));
      setStatus('AI suggestion applied. You can still edit it before submitting.', '#2E7D32');
      hidePreview();
      return;
    }

    if (action === 'keep') {
      setStatus('Kept your original draft. You can generate another suggestion anytime.', '#637089');
      hidePreview();
    }
  });

  suggestBtn.addEventListener('click', async () => {
    const description = descriptionField.value.trim();
    const category = categoryField ? categoryField.value : '';

    if (description.length < 8) {
      setStatus('Please write a little more detail before using AI suggestion.', '#C62828');
      descriptionField.focus();
      return;
    }

    suggestBtn.disabled = true;
    suggestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    hidePreview();
    setStatus('AI is drafting a polished complaint description...', '#0f766e');

    try {
      const response = await fetch('/api/complaint-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfField.value,
        },
        body: JSON.stringify({
          category,
          description,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setStatus(data.error || 'Unable to generate suggestion right now.', '#C62828');
        return;
      }

      if (data.suggestion) {
        const suggestedText = String(data.suggestion).trim();
        if (!suggestedText || suggestedText === description) {
          setStatus('Suggestion is similar to your draft. You can submit or edit manually.', '#637089');
          return;
        }
        showPreview(description, suggestedText);
        setStatus('Review the AI suggestion below and choose which version to keep.', '#0f766e');
      } else {
        setStatus('No suggestion generated. Please try again.', '#C62828');
      }
    } catch (error) {
      setStatus('Network issue while generating suggestion. Please try again.', '#C62828');
    } finally {
      suggestBtn.disabled = false;
      suggestBtn.innerHTML = defaultBtnHtml;
    }
  });
})();

// ===== ADMIN MODAL =====
function openModal(id, status, assigned, response) {
  document.getElementById('modalComplaintId').textContent = '#' + id;
  document.getElementById('modalStatus').value = status;
  document.getElementById('modalAssigned').value = assigned;
  document.getElementById('modalResponse').value = response;
  document.getElementById('updateModal').classList.add('active');
}
function openModalFromButton(btn) {
  const id = Number(btn.dataset.complaintId || 0);
  const status = btn.dataset.status || 'Pending';
  const assigned = btn.dataset.assigned || '';
  const response = btn.dataset.response || '';
  const description = btn.dataset.description || '';
  const category = btn.dataset.category || '';
  const priority = btn.dataset.priority || '';
  const studentName = btn.dataset.studentName || '';
  const studentEmail = btn.dataset.studentEmail || '';
  const anonymous = btn.dataset.anonymous || '';
  const createdAt = btn.dataset.createdAt || '';
  const updateAction = btn.dataset.updateAction || '';
  const rejectAction = btn.dataset.rejectAction || '';
  const deleteAction = btn.dataset.deleteAction || '';
  if (!id) return;
  openModal(id, status, assigned, response);
  const updateForm = document.getElementById('updateForm');
  const rejectForm = document.getElementById('rejectForm');
  const deleteForm = document.getElementById('deleteForm');
  if (updateForm && updateAction) updateForm.action = updateAction;
  if (rejectForm && rejectAction) rejectForm.action = rejectAction;
  if (deleteForm && deleteAction) deleteForm.action = deleteAction;
  const statusText = document.getElementById('modalStatusText');
  const categoryText = document.getElementById('modalCategory');
  const priorityText = document.getElementById('modalPriority');
  const studentNameText = document.getElementById('modalStudentName');
  const studentEmailText = document.getElementById('modalStudentEmail');
  const anonymousText = document.getElementById('modalAnonymous');
  const createdAtText = document.getElementById('modalCreatedAt');
  const descriptionText = document.getElementById('modalDescription');
  if (statusText) statusText.textContent = status;
  if (categoryText) categoryText.textContent = category;
  if (priorityText) priorityText.textContent = priority;
  if (studentNameText) studentNameText.textContent = studentName;
  if (studentEmailText) studentEmailText.textContent = studentEmail;
  if (anonymousText) anonymousText.textContent = anonymous;
  if (createdAtText) createdAtText.textContent = createdAt;
  if (descriptionText) descriptionText.textContent = description;
}
function closeModal() {
  document.getElementById('updateModal').classList.remove('active');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
document.getElementById('updateModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== AUTO-DISMISS ALERTS =====
setTimeout(() => {
  document.querySelectorAll('.alert').forEach(a => {
    a.style.opacity = '0';
    a.style.transition = 'opacity 0.5s';
    setTimeout(() => a.remove(), 500);
  });
}, 4000);

// ===== COPY TRACKING CODE =====
function copyTrackingCode() {
  const code = document.getElementById('trackCode');
  if (code) {
    navigator.clipboard.writeText(code.textContent).then(() => {
      const btn = document.querySelector('.btn-copy');
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    });
  }
}

// ===== SCROLL REVEAL (IntersectionObserver) =====
(function() {
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (!revealEls.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));
})();

// ===== NAVBAR SHRINK ON SCROLL =====
(function() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        ticking = false;
      });
      ticking = true;
    }
  });
})();

// ===== ANIMATED COUNTERS =====
(function() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = el.getAttribute('data-count');
        const isNum = !isNaN(target);
        if (isNum) {
          animateCounter(el, 0, parseInt(target), 1200);
        } else {
          el.textContent = target;
          el.style.animation = 'counter-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });
  counters.forEach(el => observer.observe(el));

  function animateCounter(el, start, end, duration) {
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();

// ===== TILT EFFECT ON CARDS =====
(function() {
  if (!window.matchMedia('(pointer:fine)').matches) return;
  const cards = document.querySelectorAll('.quick-link-card, .vm-card');
  cards.forEach(card => {
    let rafId = null;
    card.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / centerY * -2.5;
        const rotateY = (x - centerX) / centerX * 2.5;
        card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
        rafId = null;
      });
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
})();

// ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== SCROLL PROGRESS BAR =====
(function() {
  const bar = document.createElement('div');
  bar.id = 'scrollProgress';
  bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--gold));z-index:9999;transition:width 0.1s linear;width:0;pointer-events:none;';
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0%';
  });
})();

// ===== ACTIVE NAV HIGHLIGHT BASED ON SCROLL =====
(function() {
  const sections = document.querySelectorAll('.landing-section[id]');
  if (!sections.length) return;
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  if (!navLinks.length) return;
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  });
})();

// ===== MOBILE NAV TOGGLE =====
(function() {
  const toggleBtn = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (!toggleBtn || !navLinks) return;

  const icon = toggleBtn.querySelector('i');
  toggleBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    if (icon) {
      icon.classList.toggle('fa-bars', !isOpen);
      icon.classList.toggle('fa-xmark', isOpen);
    }
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      if (icon) {
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-xmark');
      }
    });
  });
})();

// ===== SUBMIT BUTTON LOADING STATE =====
(function() {
  document.querySelectorAll('form[method="POST"]').forEach((form) => {
    form.addEventListener('submit', () => {
      showGlobalLoader('Processing...');
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      setTimeout(() => {
        hideGlobalLoader();
        submitBtn.disabled = false;
        if (submitBtn.dataset.originalText) {
          submitBtn.innerHTML = submitBtn.dataset.originalText;
        }
      }, 8000);
    });
  });
})();

// ===== SHOW LOADER ON FULL PAGE NAVIGATION =====
(function() {
  document.querySelectorAll('a[href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      if (a.classList.contains('js-back-link')) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      showGlobalLoader('Loading...');
    });
  });
  window.addEventListener('pageshow', hideGlobalLoader);
})();

// ===== LOGIN FOCUS FALLBACK =====
(function() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('focus') !== 'login') return;
  const loginSection = document.getElementById('login-section');
  if (!loginSection) return;
  if (window.location.hash !== '#login-section') {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#login-section`);
  }
  window.requestAnimationFrame(() => {
    loginSection.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
})();

// ===== CHATBOT WIDGET =====
(function() {
  const config = window.SMART_CMS_CHATBOT || {};
  const launcher = document.getElementById('chatbotLauncher');
  const panel = document.getElementById('chatbotPanel');
  const closeBtn = document.getElementById('chatbotClose');
  const resetBtn = document.getElementById('chatbotReset');
  const footerClearBtn = document.getElementById('chatbotFooterClear');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotInput');
  const sendBtn = form ? form.querySelector('button[type="submit"]') : null;
  const messages = document.getElementById('chatbotMessages');
  const quickActions = document.getElementById('chatbotQuickActions');
  const suggestions = document.getElementById('chatbotSuggestions');
  if (!launcher || !panel || !closeBtn || !form || !input || !messages) return;

  const state = {
    history: [],
    busy: false,
  };

  const REQUEST_TIMEOUT_MS = 18000;
  const DRAFT_PREFILL_KEY = 'smartCmsComplaintDraft';

  const welcomeMessage = 'Hello! I am QQGPT Live Assistant, powered by Gemini. I can guide you through registration, login, complaint filing, anonymous submission, tracking, and website navigation in real time. How can I help you now?';

  function parseDraftFromText(text) {
    const raw = String(text || '');
    if (!raw) return null;
    if (!/complaint draft|ready to paste/i.test(raw)) return null;

    const lineValue = (label) => {
      const rx = new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im');
      const m = raw.match(rx);
      return m ? m[1].trim() : '';
    };

    let description = lineValue('Description');
    if (!description) {
      const descBlock = raw.match(/Description\s*:\s*([\s\S]*?)(?:\nExpected Action\s*:|\n\n|$)/i);
      description = descBlock ? descBlock[1].trim() : '';
    }

    const draft = {
      complainantType: lineValue('Complainant Type'),
      category: lineValue('Category'),
      description,
      priority: lineValue('Priority') || 'Medium',
      createdAt: Date.now(),
      source: 'chatbot',
    };

    if (!draft.category && !draft.description) return null;
    return draft;
  }

  function latestDraftFromHistory() {
    for (let i = state.history.length - 1; i >= 0; i -= 1) {
      const item = state.history[i];
      if (!item || item.role !== 'assistant') continue;
      const parsed = parseDraftFromText(item.content);
      if (parsed) return parsed;
    }
    return null;
  }

  function saveDraftPrefill(draft) {
    if (!draft) return;
    try {
      sessionStorage.setItem(DRAFT_PREFILL_KEY, JSON.stringify(draft));
    } catch (_) {
      // Ignore storage errors; redirect still works.
    }
  }

  function redirectWithDraft(path, draft) {
    if (draft) saveDraftPrefill(draft);
    window.location.href = path;
  }

  function handleSuggestionAction(label) {
    const normalized = String(label || '').trim().toLowerCase();
    if (!normalized) return false;

    if (normalized === 'start over') {
      resetConversation();
      return true;
    }

    if (normalized === 'change something') {
      sendQuickMessage('I want to change something in this complaint draft.');
      return true;
    }

    if (normalized === 'submit anonymously') {
      const draft = latestDraftFromHistory();
      redirectWithDraft('/anonymous', draft);
      return true;
    }

    if (normalized === 'submit complaint' || normalized === 'submit at /submit') {
      const draft = latestDraftFromHistory();
      const isAnonymous = (draft?.complainantType || '').toLowerCase() === 'anonymous';
      redirectWithDraft(isAnonymous ? '/anonymous' : '/submit', draft);
      return true;
    }

    return false;
  }

  function setOpen(isOpen) {
    panel.classList.toggle('open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) {
      input.focus();
      if (!messages.childElementCount) {
        addBotMessage(welcomeMessage);
      }
    }
  }

  function resetConversation() {
    state.history = [];
    state.busy = false;
    launcher.classList.remove('loading');
    messages.innerHTML = '';
    if (suggestions) suggestions.innerHTML = '';
    addBotMessage(welcomeMessage);
    input.value = '';
    input.focus();
  }

  function renderSuggestions(items) {
    if (!suggestions) return;
    suggestions.innerHTML = '';
    if (!Array.isArray(items) || !items.length) return;

    items.slice(0, 5).forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chatbot-suggestion';
      button.textContent = item;
      button.addEventListener('click', () => {
        if (handleSuggestionAction(item)) return;
        sendQuickMessage(item);
      });
      suggestions.appendChild(button);
    });
  }

  function addMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `chatbot-message ${role}`;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function addUserMessage(text) {
    addMessage('user', text);
    state.history.push({ role: 'user', content: text });
  }

  function addBotMessage(text) {
    addMessage('bot', text);
    state.history.push({ role: 'assistant', content: text });
  }

  function sendQuickMessage(text) {
    if (!text) return;
    if (!panel.classList.contains('open')) {
      setOpen(true);
    }
    if (state.busy) {
      input.value = text;
      input.focus();
      return;
    }
    input.value = '';
    sendMessage(text);
  }

  function localFallbackReply(text) {
    const msg = (text || '').toLowerCase();
    if (msg.includes('forgot password') || msg.includes('reset password') || msg.includes('password')) {
      return {
        reply: 'Use Forgot Password on this website. Enter your registered email, confirm the warning, set a new password, and then login again immediately with the new password.',
        suggestions: ['Login Help', 'Register Complaint', 'Track Complaint'],
      };
    }
    if (msg.includes('login') || msg.includes('sign in') || msg.includes('signin')) {
      return {
        reply: 'Login steps: open Login page, enter your registered email and password, and submit. If login fails, check email spelling, turn off Caps Lock, and retry after one minute.',
        suggestions: ['Forgot Password Help', 'Register Account', 'Track Complaint'],
      };
    }
    if (msg.includes('register') || msg.includes('sign up') || msg.includes('signup')) {
      return {
        reply: 'To register, open Register page, enter name, email, password, and confirm password, then submit. After registration, log in from the Login page.',
        suggestions: ['Login Help', 'Register Complaint', 'Anonymous Complaint'],
      };
    }
    if (msg.includes('track')) {
      return {
        reply: 'Open Track page, enter your exact tracking code, and submit to view complaint status. Ensure there are no extra spaces in the code.',
        suggestions: ['Register Complaint', 'Login Help', 'Anonymous Complaint'],
      };
    }
    return {
        reply: 'I could not reach live Gemini just now. Please try again in a moment, or ask about login, registration, complaint submission, anonymous complaint, or tracking.',
      suggestions: ['Login Help', 'Register Complaint', 'Track Complaint'],
    };
  }

  async function fetchWithRetry(url, options, retries = 1) {
    let attempt = 0;
    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeout);
        return response;
      } catch (error) {
        clearTimeout(timeout);
        if (attempt === retries) {
          throw error;
        }
        attempt += 1;
      }
    }
    throw new Error('Request failed after retries');
  }

  async function sendMessage(text) {
    if (state.busy) return;
    state.busy = true;
    launcher.classList.add('loading');
    input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    addUserMessage(text);
    if (suggestions) suggestions.innerHTML = '';
    const statusBubble = document.createElement('div');
    statusBubble.className = 'chatbot-message bot typing';
    statusBubble.textContent = 'Thinking...';
    messages.appendChild(statusBubble);
    messages.scrollTop = messages.scrollHeight;

    const respondingTimer = setTimeout(() => {
      if (statusBubble.parentElement) {
        statusBubble.textContent = 'Responding...';
      }
    }, 900);

    try {
      const response = await fetchWithRetry(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': config.csrfToken || '',
        },
        body: JSON.stringify({
          message: text,
          history: state.history.slice(-20),
        }),
      });
      clearTimeout(respondingTimer);
      const data = await response.json();
      statusBubble.remove();
      if (!response.ok) {
        addBotMessage(data.error || 'The assistant is temporarily unavailable.');
        renderSuggestions(data.suggestions || []);
        return;
      }
      addBotMessage(data.reply || 'I could not generate a reply just now.');
      renderSuggestions(data.suggestions || []);
    } catch (error) {
      clearTimeout(respondingTimer);
      statusBubble.remove();
      const fallback = localFallbackReply(text);
      addBotMessage(fallback.reply);
      renderSuggestions(fallback.suggestions);
    } finally {
      state.busy = false;
      launcher.classList.remove('loading');
      input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  closeBtn.addEventListener('click', () => setOpen(false));
  resetBtn?.addEventListener('click', () => resetConversation());
  footerClearBtn?.addEventListener('click', () => resetConversation());

  quickActions?.querySelectorAll('.chatbot-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      sendQuickMessage(chip.dataset.message || chip.textContent.trim());
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (state.busy) {
      return;
    }
    input.value = '';
    sendMessage(text);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });

  if (!config.enabled) {
    launcher.title = 'Chatbot not configured';
    launcher.classList.add('disabled');
  }

  if (panel.classList.contains('open') && !messages.childElementCount) {
    addBotMessage(welcomeMessage);
    renderSuggestions(['Register Account', 'File Complaint', 'Anonymous Complaint', 'Track Status', 'Login and Dashboard']);
  }
})();

// ===== CHATBOT DRAFT PREFILL =====
(function() {
  const DRAFT_PREFILL_KEY = 'smartCmsComplaintDraft';
  const form = document.getElementById('complaintForm');
  if (!form) return;

  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem(DRAFT_PREFILL_KEY) || 'null');
  } catch (_) {
    draft = null;
  }
  if (!draft || draft.source !== 'chatbot') return;

  const path = window.location.pathname.toLowerCase();
  const isAnonymousPage = path.includes('/anonymous');
  const isSubmitPage = path.includes('/submit');
  if (!isAnonymousPage && !isSubmitPage) return;

  // Keep stale drafts from auto-filling unrelated future sessions.
  if (Date.now() - Number(draft.createdAt || 0) > 30 * 60 * 1000) {
    sessionStorage.removeItem(DRAFT_PREFILL_KEY);
    return;
  }

  const complainant = String(draft.complainantType || '').toLowerCase();
  if (isSubmitPage && complainant === 'anonymous') {
    window.location.replace('/anonymous');
    return;
  }
  if (isAnonymousPage && complainant && complainant !== 'anonymous') {
    window.location.replace('/submit');
    return;
  }

  const categoryField = form.querySelector('select[name="category"]');
  const descriptionField = form.querySelector('textarea[name="description"]');
  const priorityField = form.querySelector(`input[name="priority"][value="${draft.priority || 'Medium'}"]`);

  if (categoryField && draft.category) {
    const optionExists = Array.from(categoryField.options).some((opt) => opt.value === draft.category);
    if (optionExists) categoryField.value = draft.category;
  }

  if (descriptionField && draft.description) {
    descriptionField.value = draft.description;
    descriptionField.dispatchEvent(new Event('input'));
  }

  if (priorityField) {
    priorityField.checked = true;
  }

  form.addEventListener('submit', () => {
    sessionStorage.removeItem(DRAFT_PREFILL_KEY);
  }, { once: true });
})();
