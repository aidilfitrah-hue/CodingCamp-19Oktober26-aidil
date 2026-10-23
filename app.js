/* ========================================
   TO DO LIST LIFE DASHBOARD - APP LOGIC
   ======================================== */

'use strict';

/* ----------------------------------------
   UTILITY HELPERS
   ---------------------------------------- */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/** Read from localStorage with a fallback default */
function storageGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Write to localStorage */
function storageSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Generate a simple unique id */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Escape HTML to prevent XSS */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ----------------------------------------
   THEME — LIGHT / DARK MODE
   ---------------------------------------- */
const STORAGE_THEME  = 'dashboard_theme';
const themeToggleBtn = $('#theme-toggle');
const themeIconEl    = $('#theme-icon');
const themeLabelEl   = $('#theme-label');

/** Apply a theme ('light' or 'dark') to <html> and update the button. */
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
    themeIconEl.textContent  = '🌙';
    themeLabelEl.textContent = 'Dark Mode';
    themeToggleBtn.setAttribute('aria-label', 'Switch to dark mode');
  } else {
    document.documentElement.classList.remove('light');
    themeIconEl.textContent  = '☀️';
    themeLabelEl.textContent = 'Light Mode';
    themeToggleBtn.setAttribute('aria-label', 'Switch to light mode');
  }
}

/** Toggle between themes and persist the choice. */
function toggleTheme() {
  const current  = document.documentElement.classList.contains('light') ? 'light' : 'dark';
  const next     = current === 'light' ? 'dark' : 'light';
  storageSet(STORAGE_THEME, next);
  applyTheme(next);
}

// Restore saved preference on load (default: dark)
applyTheme(storageGet(STORAGE_THEME, 'dark'));

themeToggleBtn.addEventListener('click', toggleTheme);

/* ----------------------------------------
   TOAST NOTIFICATIONS
   ---------------------------------------- */
const toastContainer = $('#toast-container');

function showToast(message, type = 'info', duration = 2800) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ----------------------------------------
   GREETING — CLOCK & DATE
   ---------------------------------------- */
const clockEl   = $('#clock');
const dateEl    = $('#date-display');
const greetEl   = $('#greeting-text');
const greetSub  = $('#greeting-sub');

const DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

/* ----------------------------------------
   GREETING — CUSTOM NAME
   ---------------------------------------- */
const STORAGE_NAME     = 'dashboard_name';
const greetEditBtn     = $('#greeting-edit-btn');
const greetNameEditor  = $('#greeting-name-editor');
const greetNameInput   = $('#greeting-name-input');
const greetNameSave    = $('#greeting-name-save');
const greetNameCancel  = $('#greeting-name-cancel');

/** Return the stored display name, or 'there' as the default. */
function getUserName() {
  return storageGet(STORAGE_NAME, 'there') || 'there';
}

/** Show the inline editor pre-filled with the current name. */
function openNameEditor() {
  const current = storageGet(STORAGE_NAME, '');
  greetNameInput.value = current === 'there' ? '' : current;
  greetNameEditor.hidden = false;
  greetEditBtn.hidden    = true;
  greetNameInput.focus();
}

/** Hide the inline editor without saving. */
function closeNameEditor() {
  greetNameEditor.hidden = true;
  greetEditBtn.hidden    = false;
}

/** Validate, save, and close the editor. */
function saveName() {
  const raw  = greetNameInput.value.trim();

  // Blank input → revert to default 'there', don't block the save
  const name = raw || 'there';

  storageSet(STORAGE_NAME, name);
  closeNameEditor();

  // Re-render the greeting immediately so the name appears without waiting for the next tick
  updateClock();

  const feedback = raw ? `👋 Got it, ${name}!` : 'Name cleared — back to default.';
  showToast(feedback, 'success');
}

greetEditBtn.addEventListener('click',    openNameEditor);
greetNameCancel.addEventListener('click', closeNameEditor);
greetNameSave.addEventListener('click',   saveName);

greetNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  saveName();
  if (e.key === 'Escape') closeNameEditor();
});

function getGreeting(hour) {
  if (hour >= 5  && hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  if (hour >= 17 && hour < 21) return { text: 'Good evening', emoji: '🌆' };
  return { text: 'Good night', emoji: '🌙' };
}

function updateClock() {
  const now    = new Date();
  const h      = now.getHours();
  const m      = String(now.getMinutes()).padStart(2, '0');
  const s      = String(now.getSeconds()).padStart(2, '0');
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 || 12;

  clockEl.textContent = `${String(h12).padStart(2, '0')}:${m}:${s} ${ampm}`;

  const day  = DAYS[now.getDay()];
  const date = now.getDate();
  const mon  = MONTHS[now.getMonth()];
  const year = now.getFullYear();
  dateEl.textContent = `${day}, ${date} ${mon} ${year}`;

  const { text, emoji } = getGreeting(h);
  greetEl.innerHTML = `${emoji} <span>${text}</span>, ${escapeHtml(getUserName())}!`;
  greetSub.textContent = 'What are you focusing on today?';
}

updateClock();
setInterval(updateClock, 1000);

/* ----------------------------------------
   FOCUS TIMER (Pomodoro — configurable duration)
   ---------------------------------------- */
const STORAGE_DURATION = 'dashboard_timer_duration';
const CIRCUMFERENCE    = 502; // 2π × 80 (SVG circle r=80)
const DURATION_OPTIONS = [15, 25, 30, 45, 60]; // minutes

// Load saved duration (default 25). Clamp to a valid option for safety.
const savedMinutes  = storageGet(STORAGE_DURATION, 25);
let   timerMinutes  = DURATION_OPTIONS.includes(savedMinutes) ? savedMinutes : 25;
let   timerTotal    = timerMinutes * 60; // seconds — updated when duration changes
let   timerSeconds  = timerTotal;
let   timerRunning  = false;
let   timerInterval = null;

const timerTimeEl    = $('#timer-time');
const progressCircle = $('#timer-progress');
const modeBadgeEl    = $('#timer-mode-badge');
const startBtn       = $('#timer-start');
const stopBtn        = $('#timer-stop');
const resetBtn       = $('#timer-reset');
const durationOptEls = $$('.duration-btn');

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerUI() {
  timerTimeEl.textContent = formatTime(timerSeconds);

  const progress = timerSeconds / timerTotal;
  const offset   = CIRCUMFERENCE * (1 - progress);
  progressCircle.style.strokeDashoffset = offset;

  // Color feedback — thresholds are absolute (not relative) so they
  // stay meaningful regardless of chosen duration
  progressCircle.classList.remove('warning', 'danger');
  if (timerSeconds <= 60) {
    progressCircle.classList.add('danger');
  } else if (timerSeconds <= 5 * 60) {
    progressCircle.classList.add('warning');
  }

  // Start button label
  startBtn.textContent = timerRunning
    ? '⏸ Pause'
    : (timerSeconds < timerTotal && timerSeconds > 0 ? '▶ Resume' : '▶ Start');
  stopBtn.disabled = !timerRunning;

  // Lock duration buttons while timer is active; unlock when stopped/reset
  durationOptEls.forEach(btn => { btn.disabled = timerRunning; });
}

/** Switch to a new duration in minutes. Only allowed when timer is not running. */
function setDuration(minutes) {
  if (timerRunning) return; // guard — UI already disables buttons, but be safe

  timerMinutes = minutes;
  timerTotal   = minutes * 60;
  timerSeconds = timerTotal;

  storageSet(STORAGE_DURATION, minutes);

  // Update active pill highlight
  durationOptEls.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.minutes) === minutes);
  });

  modeBadgeEl.textContent = 'Focus Mode';
  updateTimerUI();
}

function tickTimer() {
  if (timerSeconds <= 0) {
    clearInterval(timerInterval);
    timerRunning = false;
    timerSeconds = 0;
    updateTimerUI();
    modeBadgeEl.textContent = '🎉 Session complete!';
    showToast('Focus session complete! Take a break. 🎉', 'success', 4000);
    return;
  }
  timerSeconds--;
  updateTimerUI();
}

startBtn.addEventListener('click', () => {
  if (timerRunning) {
    // Pause
    clearInterval(timerInterval);
    timerRunning = false;
    modeBadgeEl.textContent = 'Paused';
  } else {
    // Resume from 0 means start fresh from the current total
    if (timerSeconds === 0) timerSeconds = timerTotal;
    timerRunning  = true;
    modeBadgeEl.textContent = 'Focus Session';
    timerInterval = setInterval(tickTimer, 1000);
  }
  updateTimerUI();
});

stopBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  modeBadgeEl.textContent = 'Stopped';
  updateTimerUI();
});

resetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerTotal; // reset to current duration, not hard-coded 25m
  modeBadgeEl.textContent = 'Focus Mode';
  updateTimerUI();
});

// Duration pill click handler
durationOptEls.forEach(btn => {
  btn.addEventListener('click', () => setDuration(Number(btn.dataset.minutes)));
});

// Restore saved duration on load — highlights the right pill and sets timerTotal
setDuration(timerMinutes);

/* ----------------------------------------
   TO-DO LIST
   ---------------------------------------- */
const STORAGE_TODOS = 'dashboard_todos';
const STORAGE_SORT  = 'dashboard_todo_sort';

let todos      = storageGet(STORAGE_TODOS, []);
let todoFilter = 'all';   // 'all' | 'active' | 'done'
const SORT_OPTIONS    = ['newest', 'oldest', 'az', 'za', 'incomplete', 'complete'];
const savedSort       = storageGet(STORAGE_SORT, 'newest');
let todoSort          = SORT_OPTIONS.includes(savedSort) ? savedSort : 'newest';

const todoListEl   = $('#todo-list');
const todoInputEl  = $('#todo-input');
const addTodoBtn   = $('#todo-add-btn');
const todoStatsEl  = $('#todo-stats');
const todoSortEl   = $('#todo-sort');

// Reflect saved sort in the dropdown immediately
todoSortEl.value = todoSort;

function saveTodos() {
  storageSet(STORAGE_TODOS, todos);
}

/**
 * Sort a copy of an array of tasks according to the current todoSort value.
 * Never mutates the source array — preserves the original insertion order in
 * `todos`, which is what createdAt tracks.
 */
function getSortedTodos(arr) {
  const copy = [...arr];
  switch (todoSort) {
    case 'oldest':
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'az':
      return copy.sort((a, b) => a.text.trim().toLowerCase().localeCompare(b.text.trim().toLowerCase()));
    case 'za':
      return copy.sort((a, b) => b.text.trim().toLowerCase().localeCompare(a.text.trim().toLowerCase()));
    case 'incomplete':
      // incomplete (done=false) before complete; ties keep sort-stable relative order
      return copy.sort((a, b) => Number(a.done) - Number(b.done));
    case 'complete':
      return copy.sort((a, b) => Number(b.done) - Number(a.done));
    case 'newest':
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

function getFilteredTodos() {
  let result;
  if (todoFilter === 'active') result = todos.filter(t => !t.done);
  else if (todoFilter === 'done') result = todos.filter(t => t.done);
  else result = todos;
  return getSortedTodos(result);
}

function renderTodos() {
  const filtered = getFilteredTodos();
  todoListEl.innerHTML = '';

  if (filtered.length === 0) {
    todoListEl.innerHTML = `<li class="todo-empty">${
      todoFilter === 'done' ? '✨ No completed tasks yet.' :
      todoFilter === 'active' ? '🎉 All done! Nothing pending.' :
      '📝 Add a task to get started.'
    }</li>`;
  } else {
    filtered.forEach(todo => {
      const li = document.createElement('li');
      li.className = `todo-item${todo.done ? ' done' : ''}`;
      li.dataset.id = todo.id;

      li.innerHTML = `
        <button class="todo-check" aria-label="Toggle done" data-action="toggle">✓</button>
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <div class="todo-actions">
          <button class="btn-icon" aria-label="Edit task" data-action="edit" title="Edit">✏️</button>
          <button class="btn-icon" aria-label="Delete task" data-action="delete" title="Delete">🗑️</button>
        </div>
      `;
      todoListEl.appendChild(li);
    });
  }

  // Stats
  const total  = todos.length;
  const done   = todos.filter(t => t.done).length;
  todoStatsEl.textContent = total > 0 ? `${done}/${total} done` : '';
}

function addTodo() {
  const text = todoInputEl.value.trim();
  if (!text) {
    showToast('Please enter a task.', 'error');
    todoInputEl.focus();
    return;
  }

  // Duplicate check — case-insensitive, ignores surrounding whitespace
  const normalized = text.toLowerCase();
  const isDuplicate = todos.some(t => t.text.trim().toLowerCase() === normalized);
  if (isDuplicate) {
    showToast('This task already exists!', 'error');
    todoInputEl.select();
    return;
  }

  todos.unshift({ id: uid(), text, done: false, createdAt: Date.now() });
  saveTodos();
  renderTodos();
  todoInputEl.value = '';
  showToast('Task added!', 'success');
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    saveTodos();
    renderTodos();
  }
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  renderTodos();
  showToast('Task deleted.', 'info');
}

function startEditTodo(id, li) {
  const todo    = todos.find(t => t.id === id);
  if (!todo) return;

  const textEl  = li.querySelector('.todo-text');
  const actions = li.querySelector('.todo-actions');

  const input   = document.createElement('input');
  input.type    = 'text';
  input.value   = todo.text;
  input.className = 'todo-edit-input';

  textEl.replaceWith(input);
  actions.innerHTML = `
    <button class="btn-icon" data-action="save-edit" title="Save" aria-label="Save">✅</button>
    <button class="btn-icon" data-action="cancel-edit" title="Cancel" aria-label="Cancel">❌</button>
  `;
  input.focus();
  input.select();

  function saveEdit() {
    const newText = input.value.trim();
    if (!newText) { showToast('Task cannot be empty.', 'error'); return; }

    // Duplicate check — exclude the task being edited from the comparison
    const normalized = newText.toLowerCase();
    const isDuplicate = todos.some(t => t.id !== todo.id && t.text.trim().toLowerCase() === normalized);
    if (isDuplicate) {
      showToast('Another task with that name already exists!', 'error');
      input.select();
      return;
    }

    todo.text = newText;
    saveTodos();
    renderTodos();
    showToast('Task updated!', 'success');
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  saveEdit();
    if (e.key === 'Escape') renderTodos();
  });

  li.querySelector('[data-action="save-edit"]').addEventListener('click', saveEdit);
  li.querySelector('[data-action="cancel-edit"]').addEventListener('click', renderTodos);
}

// Event delegation for todo list
todoListEl.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const li     = actionEl.closest('.todo-item');
  if (!li) return;
  const id     = li.dataset.id;
  const action = actionEl.dataset.action;

  if (action === 'toggle')  toggleTodo(id);
  if (action === 'delete')  deleteTodo(id);
  if (action === 'edit')    startEditTodo(id, li);
});

addTodoBtn.addEventListener('click', addTodo);
todoInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTodo();
});

// Filter buttons
$$('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.filter-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    todoFilter = btn.dataset.filter;
    renderTodos();
  });
});

// Sort dropdown
todoSortEl.addEventListener('change', () => {
  todoSort = todoSortEl.value;
  storageSet(STORAGE_SORT, todoSort);
  renderTodos();
});

renderTodos();

/* ----------------------------------------
   QUICK LINKS
   ---------------------------------------- */
const STORAGE_LINKS = 'dashboard_links';

let links = storageGet(STORAGE_LINKS, [
  { id: uid(), label: 'Google',   url: 'https://google.com'   },
  { id: uid(), label: 'YouTube',  url: 'https://youtube.com'  },
  { id: uid(), label: 'GitHub',   url: 'https://github.com'   },
]);

const linksGridEl   = $('#links-grid');
const addLinkBtn    = $('#add-link-btn');

// Modal elements
const modalOverlay  = $('#modal-overlay');
const modalLabelIn  = $('#modal-link-label');
const modalUrlIn    = $('#modal-link-url');
const modalSaveBtn  = $('#modal-save-btn');
const modalCancelBtn= $('#modal-cancel-btn');

function saveLinks() {
  storageSet(STORAGE_LINKS, links);
}

function getFaviconUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

function renderLinks() {
  linksGridEl.innerHTML = '';

  if (links.length === 0) {
    linksGridEl.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">No links yet. Add one below!</span>';
    return;
  }

  links.forEach(link => {
    const a = document.createElement('a');
    a.className   = 'link-pill';
    a.href        = link.url;
    a.target      = '_blank';
    a.rel         = 'noopener noreferrer';

    const faviconUrl = getFaviconUrl(link.url);
    const faviconHtml = faviconUrl
      ? `<img src="${faviconUrl}" class="link-favicon" alt="" onerror="this.style.display='none'">`
      : '';

    a.innerHTML = `
      ${faviconHtml}
      <span>${escapeHtml(link.label)}</span>
      <button class="link-remove" data-id="${link.id}" aria-label="Remove link" title="Remove">✕</button>
    `;

    // Remove button should not navigate
    a.querySelector('.link-remove').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeLink(link.id);
    });

    linksGridEl.appendChild(a);
  });
}

function removeLink(id) {
  links = links.filter(l => l.id !== id);
  saveLinks();
  renderLinks();
  showToast('Link removed.', 'info');
}

function openModal() {
  modalLabelIn.value = '';
  modalUrlIn.value   = '';
  modalOverlay.classList.add('open');
  modalLabelIn.focus();
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

function saveLink() {
  const label = modalLabelIn.value.trim();
  let   url   = modalUrlIn.value.trim();

  if (!label || !url) {
    showToast('Please fill in both fields.', 'error');
    return;
  }

  // Auto-prepend https:// if missing
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try {
    new URL(url); // validate
  } catch {
    showToast('Please enter a valid URL.', 'error');
    return;
  }

  links.push({ id: uid(), label, url });
  saveLinks();
  renderLinks();
  closeModal();
  showToast(`"${label}" added!`, 'success');
}

addLinkBtn.addEventListener('click', openModal);
modalSaveBtn.addEventListener('click', saveLink);
modalCancelBtn.addEventListener('click', closeModal);

// Close modal on backdrop click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Submit on Enter in modal fields
[modalLabelIn, modalUrlIn].forEach(el => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveLink();
    if (e.key === 'Escape') closeModal();
  });
});

renderLinks();
