const STORAGE_KEY = 'halo-vocab-state-v1';

const demoWords = [
  ['adapt','适应；改编','to change something to make it suitable for a new situation'],
  ['clarify','澄清；阐明','to make something clear or easier to understand'],
  ['concentrate','集中注意力','to give all your attention to one thing'],
  ['consistent','一致的；持续的','always behaving or happening in a similar way'],
  ['curious','好奇的','wanting to know or learn about something'],
  ['deliberate','故意的；深思熟虑的','done intentionally or after careful thought'],
  ['efficient','高效的','working or operating quickly and effectively'],
  ['emerge','出现；浮现','to appear or become known'],
  ['essential','必要的；本质的','completely necessary or very important'],
  ['flexible','灵活的','able to change or be changed easily'],
  ['flourish','茁壮成长；繁荣','to grow or develop successfully'],
  ['grasp','理解；抓住','to understand something completely'],
  ['habit','习惯','something that you do regularly'],
  ['insight','洞察力；深刻理解','a clear understanding of something complicated'],
  ['maintain','维持；保持','to make something continue at the same level'],
  ['persist','坚持','to continue doing something despite difficulty'],
  ['precise','准确的；精确的','exact and accurate'],
  ['recall','回忆；召回','to remember something or bring it back to mind'],
  ['retain','保留；记住','to keep something or continue to remember it'],
  ['sustain','维持；支撑','to keep something going over a period of time']
].map(([word, zh, en], index) => ({ id: `${word}-${index}`, word, zh, en, status:'new', dueAt:null, attempts:0, correct:0, wrong:0, lastReviewed:null }));

const PDF_WORD_BANK_VERSION = 'pdf-2026-v1';
const importedPdfWords = Array.isArray(window.HALO_PDF_WORDS) ? window.HALO_PDF_WORDS : [];
const sourceWordBank = importedPdfWords.length ? importedPdfWords : demoWords;
function buildSeedWords(source = sourceWordBank) {
  return source.map((word, index) => ({
    ...word,
    id: word.id || `word-${index + 1}`,
    en: word.en || word.definition || '',
    status: importedPdfWords.length && index < 50 ? 'mastered' : (word.status || 'new'),
    dueAt: null,
    attempts: importedPdfWords.length && index < 50 ? 1 : 0,
    correct: importedPdfWords.length && index < 50 ? 1 : 0,
    wrong: 0,
    lastReviewed: importedPdfWords.length && index < 50 ? new Date().toISOString() : null,
    group: word.group || Math.floor(index / 20) + 1
  }));
}
const seededWords = buildSeedWords();
const defaultState = { words: seededWords, wordBankVersion: importedPdfWords.length ? PDF_WORD_BANK_VERSION : 'demo-v1', builtInPackVersion:'builtin-v1', toeflPassEnabled:true, selectedWordIds:seededWords.map(word => word.id), colorMode:'light', dailyCount:20, aiEnabled:false, examplesEnabled:true, clozeEnabled:true, apiEndpoint:'https://openrouter.ai/api/v1', apiModel:'openrouter/free', apiKey:'', autoplay:true, showHint:true, theme:'burgundy', streak:0, lastStudyDate:null, session:{correct:0,wrong:0,total:0}, daily:{date:null, completed:[]}, currentView:'dashboard', musicProvider:'audius' };
let state = loadState();
let learningQueue = [];
let learningIndex = 0;
let answered = false;
let learningType = 'new';
let trainingMode = 'spelling';
let aiRequestId = 0;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(defaultState);
    const merged = {...defaultState, ...saved, session:{...defaultState.session,...saved.session}, daily:{...defaultState.daily,...saved.daily}};
    if (saved.builtInPackVersion !== 'builtin-v1') { merged.builtInPackVersion = 'builtin-v1'; merged.examplesEnabled = true; merged.clozeEnabled = true; }
    if (typeof saved.toeflPassEnabled !== 'boolean') merged.toeflPassEnabled = true;
    if (!Array.isArray(saved.selectedWordIds)) merged.selectedWordIds = seededWords.map(word => word.id);
    if (!saved.colorMode) merged.colorMode = 'light';
    if (importedPdfWords.length && saved.wordBankVersion !== PDF_WORD_BANK_VERSION) {
      return {...merged, wordBankVersion:PDF_WORD_BANK_VERSION, words:buildSeedWords(), daily:{date:null,completed:[]}, session:{correct:0,wrong:0,total:0}};
    }
    return merged;
  } catch { return structuredClone(defaultState); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function todayKey() { return new Date().toISOString().slice(0,10); }
function getWords() { return state.words || []; }
function getDueWords() { const now = Date.now(); return getWords().filter(w => w.status === 'review' || (w.dueAt && w.dueAt <= now)); }
function getNewWords() { return getWords().filter(w => w.status === 'new'); }
function getCompletedToday() { return state.daily.date === todayKey() ? state.daily.completed.length : 0; }
function ensureDaily() { if (state.daily.date !== todayKey()) { state.daily = {date:todayKey(), completed:[]}; state.session = {correct:0,wrong:0,total:0}; saveState(); } }
function formatCount(n) { return Number(n || 0).toLocaleString('zh-CN'); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function init() {
  ensureDaily();
  bindNavigation();
  bindActions();
  bindSettings();
  syncSettingsUI();
  renderAll();
  applyTheme();
  applyColorMode();
  showView(state.currentView || 'dashboard');
}

function bindNavigation() {
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
}
function bindActions() {
  document.querySelector('#hero-start').addEventListener('click', () => startLearning());
  document.querySelector('#routine-start').addEventListener('click', () => startLearning());
  document.querySelector('#answer-form').addEventListener('submit', submitAnswer);
  document.querySelector('#next-word').addEventListener('click', nextWord);
  document.querySelectorAll('.mode-tab').forEach(button => button.addEventListener('click', () => setTrainingMode(button.dataset.mode)));
  document.querySelector('#ai-answer-form').addEventListener('submit', submitAIAnswer);
  document.querySelector('#word-sound').addEventListener('click', speakCurrentWord);
  document.querySelector('#sound-test').addEventListener('click', () => showView('music'));
  document.querySelector('#appearance-toggle').addEventListener('click', toggleColorMode);
  document.querySelector('#profile-settings').addEventListener('click', () => showView('settings'));
  document.querySelector('#brand-settings').addEventListener('click', () => showView('settings'));
  document.querySelector('#import-trigger').addEventListener('click', () => showView('library'));
  document.querySelector('#import-file-button').addEventListener('click', () => document.querySelector('#file-input').click());
  document.querySelector('#file-input').addEventListener('change', handleFileImport);
  document.querySelector('#word-selector-open').addEventListener('click', () => showView('selector'));
  document.querySelector('#selector-all').addEventListener('click', () => setSelectorSelection(true));
  document.querySelector('#selector-none').addEventListener('click', () => setSelectorSelection(false));
  document.querySelector('#selector-invert').addEventListener('click', invertSelectorSelection);
  document.querySelector('#selector-export').addEventListener('click', exportSelectedWordsPdf);
  document.querySelector('#load-demo').addEventListener('click', loadDemo);
  document.querySelector('#test-api').addEventListener('click', testApi);
  document.querySelector('#music-search-form').addEventListener('submit', event => { event.preventDefault(); searchMusic(document.querySelector('#music-search-input').value.trim()); });
  document.querySelector('#stop-music').addEventListener('click', stopMusic);
  document.querySelector('#export-data').addEventListener('click', exportData);
  document.querySelector('#clear-data').addEventListener('click', clearData);
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
    const input = document.querySelector('#daily-count'); input.value = Math.min(200, Math.max(1, Number(input.value || 20) + Number(button.dataset.step))); input.dispatchEvent(new Event('change'));
  }));
}
function bindSettings() {
  const bind = (id, key, transform = v => v) => document.querySelector(`#${id}`).addEventListener('change', e => { state[key] = transform(e.target.type === 'checkbox' ? e.target.checked : e.target.value); saveState(); renderAll(); showToast('设置已保存'); });
  bind('daily-count','dailyCount',v => Math.min(200, Math.max(1, Number(v) || 20)));
  bind('toefl-pass-enabled','toeflPassEnabled'); bind('ai-enabled','aiEnabled'); bind('examples-enabled','examplesEnabled'); bind('cloze-enabled','clozeEnabled'); bind('api-endpoint','apiEndpoint'); bind('api-model','apiModel'); bind('api-key','apiKey'); bind('autoplay','autoplay'); bind('show-hint','showHint');
  document.querySelectorAll('.theme-choice').forEach(button => button.addEventListener('click', () => { state.theme = button.dataset.theme; applyTheme(); saveState(); showToast('主题已切换'); }));
}
function applyTheme() { document.body.dataset.theme = state.theme || 'burgundy'; document.querySelectorAll('.theme-choice').forEach(button => button.classList.toggle('active', button.dataset.theme === (state.theme || 'burgundy'))); }
function applyColorMode() { const mode = state.colorMode === 'dark' ? 'dark' : 'light'; document.body.dataset.colorMode = mode; const toggle = document.querySelector('#appearance-toggle'); if (toggle) { toggle.textContent = mode === 'dark' ? '☼' : '◐'; toggle.title = mode === 'dark' ? '切换到浅色模式' : '切换到深色模式'; toggle.setAttribute('aria-label', toggle.title); } }
function toggleColorMode() { state.colorMode = state.colorMode === 'dark' ? 'light' : 'dark'; applyColorMode(); saveState(); showToast(state.colorMode === 'dark' ? '已切换深色模式' : '已切换浅色模式'); }

function showView(view) {
  state.currentView = view; saveState();
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  document.querySelectorAll('.nav-item[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const titles = {dashboard:['GOOD MORNING','今天也向前一点'],learn:['LEARNING SESSION','沉浸式学习'],review:['REVIEW TIME','把记忆变牢'],library:['YOUR WORD BANK','管理你的词库'],selector:['TOEFL PASS · WORD BUILDER','选择要导出的词'],music:['STUDY SOUNDTRACK','给专注配一首歌'],settings:['PREFERENCES','设置你的节奏']};
  document.querySelector('#page-eyebrow').textContent = titles[view]?.[0] || 'HALO VOCAB'; document.querySelector('#page-title').textContent = titles[view]?.[1] || 'Halo Vocab';
  if (view === 'learn') renderLearning(); if (view === 'review') renderReview(); if (view === 'library') renderLibrary(); if (view === 'selector') renderSelector();
  if (view === 'music' && !document.querySelector('#music-results').dataset.loaded) searchMusic('');
}

function renderAll() { renderDashboard(); renderGroups(); renderReview(); renderLibrary(); renderSelector(); syncSettingsUI(); }
function renderDashboard() {
  ensureDaily(); const words = getWords(), completed = getCompletedToday(), total = state.dailyCount;
  document.querySelector('#streak-stat').textContent = `${state.streak || 0} 天`;
  document.querySelector('#mastered-stat').textContent = formatCount(words.filter(w => w.status === 'mastered').length);
  const sessionTotal = state.session.total; document.querySelector('#accuracy-stat').textContent = sessionTotal ? `${Math.round(state.session.correct / sessionTotal * 100)}%` : '—';
  document.querySelector('#routine-count').textContent = `${Math.min(completed,total)} / ${total}`; document.querySelector('#routine-label').textContent = completed >= total ? '今日已完成' : completed ? '进行中' : '准备开始';
  const percent = Math.min(100, Math.round(completed / total * 100)); document.querySelector('#routine-bar').style.width = `${percent}%`; document.querySelector('#routine-ring').style.background = `conic-gradient(var(--green) ${percent * 3.6}deg, #e9f0ec ${percent * 3.6}deg)`;
  document.querySelector('#due-stat').textContent = formatCount(getDueWords().length); document.querySelector('#total-stat').textContent = formatCount(words.length); const aiReady = state.aiEnabled && state.apiKey; const builtInReady = state.examplesEnabled && state.clozeEnabled; document.querySelector('#api-stat').textContent = aiReady ? 'AI 已连接' : builtInReady ? '内置可用' : '未连接'; document.querySelector('#api-stat').style.color = aiReady || builtInReady ? '#7c414a' : '#9a6b25';
  document.querySelector('#api-stat-detail').textContent = aiReady ? 'AI 和内置例句都已准备好' : builtInReady ? '500 个词的例句和完形填空已准备好' : '可在设置中开启内置内容包';
}
function renderGroups() {
  const container = document.querySelector('#group-progress-grid');
  if (!container) return;
  const words = getWords();
  const groups = Array.from({length:25}, (_, index) => {
    const number = index + 1;
    const groupWords = words.filter(word => Number(word.group) === number);
    const learned = groupWords.filter(word => word.status === 'mastered' || word.attempts > 0).length;
    const total = groupWords.length || 20;
    const percent = Math.min(100, Math.round(learned / total * 100));
    const status = learned >= total ? '已完成' : learned ? '进行中' : '未开始';
    return `<article class="group-card ${status === '已完成' ? 'complete' : status === '进行中' ? 'active' : ''}"><div class="group-card-top"><span>第 ${String(number).padStart(2,'0')} 组</span><strong>${learned}/${total}</strong></div><div class="group-card-title">${number <= 25 ? `词汇组 ${number}` : '词汇组'}</div><div class="group-bar"><i style="width:${percent}%"></i></div><small>${status}</small></article>`;
  });
  container.innerHTML = groups.join('');
}
function syncSettingsUI() { const values = { 'daily-count':state.dailyCount, 'toefl-pass-enabled':state.toeflPassEnabled, 'ai-enabled':state.aiEnabled, 'examples-enabled':state.examplesEnabled, 'cloze-enabled':state.clozeEnabled, 'api-endpoint':state.apiEndpoint, 'api-model':state.apiModel, 'api-key':state.apiKey, 'autoplay':state.autoplay, 'show-hint':state.showHint }; Object.entries(values).forEach(([id,value]) => { const el = document.querySelector(`#${id}`); if (!el) return; if (el.type === 'checkbox') el.checked = Boolean(value); else el.value = value; }); const aiReady = state.aiEnabled && state.apiKey; const passReady = state.toeflPassEnabled; document.querySelector('#examples-enabled').disabled = !passReady; document.querySelector('#cloze-enabled').disabled = !passReady; document.querySelectorAll('.mode-tab[data-mode="example"],.mode-tab[data-mode="cloze"]').forEach(button => { const builtInReady = button.dataset.mode === 'example' ? state.examplesEnabled : state.clozeEnabled; button.disabled = !passReady || (!builtInReady && !aiReady); button.title = button.disabled ? '请在设置中开启 TOEFL PASS 或配置内容' : ''; }); document.querySelector('#examples-enabled').parentElement.style.opacity = passReady ? '1' : '.48'; document.querySelector('#cloze-enabled').parentElement.style.opacity = passReady ? '1' : '.48'; }

function startLearning() {
  ensureDaily(); const completedIds = new Set(state.daily.completed); const available = getNewWords().filter(w => !completedIds.has(w.id)); learningQueue = available.slice(0, state.dailyCount); learningIndex = 0; answered = false; learningType = 'new'; showView('learn'); renderLearning(); document.querySelector('#answer-input')?.focus();
}
function startReview() { const due = getDueWords(); if (!due.length) { showToast('目前没有待复习词汇'); return; } learningQueue = due.slice(0,50); learningIndex = 0; answered = false; learningType = 'review'; showView('learn'); renderLearning(); document.querySelector('#answer-input')?.focus(); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function renderSourceExample(word, reveal = false) {
  const label = document.querySelector('#source-example > span');
  const text = document.querySelector('#source-example-text');
  const translation = document.querySelector('#source-example-translation');
  if (!word.example) { label.textContent = 'PDF 例句'; text.textContent = '暂无 PDF 例句'; translation.textContent = ''; return; }
  if (reveal) {
    label.textContent = 'PDF 例句';
    text.textContent = word.example;
  } else {
    const pattern = new RegExp(escapeRegExp(word.word), 'gi');
    const masked = word.example.replace(pattern, '_____');
    label.textContent = 'PDF 例句（目标词已挖空）';
    text.textContent = masked === word.example ? '提交答案后查看完整例句' : masked;
  }
  translation.textContent = word.translation ? `译文：${word.translation}` : '';
}
function renderLearning() {
  const empty = document.querySelector('#learning-empty'), active = document.querySelector('#learning-active');
  if (!learningQueue.length || learningIndex >= learningQueue.length) { empty.classList.remove('hidden'); active.classList.add('hidden'); updateLearningHeader(); return; }
  if (!state.toeflPassEnabled && trainingMode !== 'spelling') trainingMode = 'spelling';
  empty.classList.add('hidden'); active.classList.remove('hidden'); const word = learningQueue[learningIndex]; document.querySelector('#training-label').textContent = learningType === 'review' ? '复习训练' : '拼写训练';
  document.querySelectorAll('.mode-tab').forEach(button => button.classList.toggle('active', button.dataset.mode === trainingMode));
  document.querySelector('#question-zh').textContent = word.zh || '暂无中文释义'; document.querySelector('#question-en').textContent = word.en || '正在加载英文词典解释…'; renderSourceExample(word, false); document.querySelector('#answer-input').value = ''; document.querySelector('#answer-input').disabled = false; document.querySelector('#answer-feedback').textContent = ''; document.querySelector('#answer-feedback').className = 'answer-feedback'; document.querySelector('#answer-reveal').classList.add('hidden'); document.querySelector('#correct-answer').textContent = word.word; answered = false;
  if (!word.en) loadEnglishDefinition(word);
  const hint = state.showHint ? `${word.word[0].toUpperCase()}${'•'.repeat(Math.max(2, word.word.length - 2))}${word.word.slice(-1)}` : '关闭了拼写提示'; document.querySelector('#word-hint').textContent = `${hint} · ${word.word.length} 个字母`; document.querySelector('#spelling-exercise').classList.toggle('hidden', trainingMode !== 'spelling'); document.querySelector('#ai-exercise').classList.toggle('hidden', trainingMode === 'spelling'); updateLearningHeader(); if (trainingMode !== 'spelling') loadAIExercise(word); if (state.autoplay) setTimeout(() => speak(word.word), 220);
}
async function loadEnglishDefinition(word) {
  if (word.en || word.definitionLoading) return;
  word.definitionLoading = true;
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.word.toLowerCase())}`);
    if (!response.ok) throw new Error(`Dictionary API ${response.status}`);
    const payload = await response.json();
    const definitions = (payload[0]?.meanings || []).flatMap(meaning => meaning.definitions || []).map(item => item.definition).filter(Boolean).slice(0, 2);
    word.en = definitions.join(' · ') || '暂无英文词典解释，请参考下方例句。';
    word.definition = word.en;
    delete word.definitionLoading;
    saveState();
    if (learningQueue[learningIndex]?.id === word.id) document.querySelector('#question-en').textContent = word.en;
  } catch {
    word.en = '暂无英文词典解释，请参考下方例句。';
    if (learningQueue[learningIndex]?.id === word.id) document.querySelector('#question-en').textContent = word.en;
  } finally { delete word.definitionLoading; }
}
function setTrainingMode(mode) { if (mode === 'spelling') { trainingMode = mode; renderLearning(); return; } const builtInReady = mode === 'example' ? state.examplesEnabled : state.clozeEnabled; const aiReady = state.aiEnabled && state.apiKey; if (!state.toeflPassEnabled || (!builtInReady && !aiReady)) { showToast('请先在设置中开启 TOEFL PASS 或配置 AI'); showView('settings'); return; } trainingMode = mode; renderLearning(); }
function renderAIExercise(exercise, type) { document.querySelector('#ai-kind').textContent = type; document.querySelector('#ai-prompt').textContent = exercise.prompt || '根据语境输入目标单词'; document.querySelector('#ai-sentence').textContent = exercise.sentence || '练习内容生成失败'; document.querySelector('#ai-translation').textContent = exercise.translation || ''; document.querySelector('#ai-answer-input').value = ''; document.querySelector('#ai-answer-input').disabled = false; document.querySelector('#ai-answer-feedback').textContent = ''; document.querySelector('#ai-answer-feedback').className = 'answer-feedback'; document.querySelector('#ai-content').classList.remove('hidden'); document.querySelector('#ai-loading').classList.add('hidden'); }
function getBuiltInExercise(word, type) { const example = word.builtinExample || word.example || `The word "${word.word}" appears in a practical study context.`; const sentence = type === '完形填空' ? (word.builtinCloze || example.replace(new RegExp(escapeRegExp(word.word), 'gi'), '_____')) : example.replace(new RegExp(escapeRegExp(word.word), 'gi'), '_____'); return {prompt:type === '完形填空' ? '根据上下文填入最合适的单词。' : '根据这个语境输入目标单词。', sentence, translation:word.builtinExampleTranslation || word.translation || '请结合中文释义理解语境。', answer:word.word}; }
async function loadAIExercise(word) { const requestId = ++aiRequestId; const loading = document.querySelector('#ai-loading'), content = document.querySelector('#ai-content'); loading.classList.remove('hidden'); content.classList.add('hidden'); const type = trainingMode === 'cloze' ? '完形填空' : '情景例句'; if (!state.toeflPassEnabled) { loading.textContent = 'TOEFL PASS 当前已关闭。'; return; } const builtInReady = type === '情景例句' ? state.examplesEnabled : state.clozeEnabled; if (builtInReady) { renderAIExercise(getBuiltInExercise(word, type), type); return; } if (!state.aiEnabled || !state.apiKey) { loading.textContent = '此练习已关闭。可以在设置中重新开启 TOEFL PASS 或配置 AI。'; return; } const instruction = type === '完形填空' ? `Create a short English cloze paragraph using the target word "${word.word}" exactly once. Replace the target word with ____. Return only valid JSON with keys prompt, sentence, translation, answer. The answer must be exactly the target word.` : `Create a practical English context exercise for the target word "${word.word}". Write one Chinese situation prompt and one English sentence containing the target word replaced by ____. Return only valid JSON with keys prompt, sentence, translation, answer. The answer must be exactly the target word.`; try { const response = await fetch(`${state.apiEndpoint.replace(/\/$/,'')}/chat/completions`, {method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.apiKey}`},body:JSON.stringify({model:state.apiModel || 'gpt-4o-mini',temperature:.4,response_format:{type:'json_object'},messages:[{role:'system',content:'You are a careful English vocabulary teacher.'},{role:'user',content:instruction}]})}); if (!response.ok) throw new Error(`API ${response.status}`); const payload = await response.json(); const raw = payload.choices?.[0]?.message?.content || '{}'; const exercise = JSON.parse(raw); if (requestId !== aiRequestId) return; renderAIExercise(exercise, type); } catch (error) { if (requestId !== aiRequestId) return; loading.textContent = `生成失败：${error.message}。请检查 API 设置。`; showToast('AI 练习生成失败'); } }
function submitAIAnswer(event) { event.preventDefault(); if (answered || !learningQueue[learningIndex]) return; const input = document.querySelector('#ai-answer-input'), answer = input.value.trim().toLowerCase(), word = learningQueue[learningIndex]; if (!answer) { showToast('先输入你的答案'); return; } answered = true; renderSourceExample(word, true); const correct = answer === word.word.toLowerCase(); word.attempts++; word.lastReviewed = new Date().toISOString(); state.session.total++; if (correct) { word.correct++; state.session.correct++; word.status = 'mastered'; word.dueAt = Date.now() + (learningType === 'review' ? 3 : 1) * 24 * 60 * 60 * 1000; if (learningType === 'new' && !state.daily.completed.includes(word.id)) state.daily.completed.push(word.id); } else { word.wrong++; state.session.wrong++; word.status = 'review'; word.dueAt = Date.now() + 10 * 60 * 1000; } input.disabled = true; document.querySelector('#ai-answer-feedback').textContent = correct ? '正确！' : '再看一眼拼写，稍后会进入复习。'; document.querySelector('#ai-answer-feedback').className = `answer-feedback ${correct ? 'success' : 'error'}`; document.querySelector('#answer-reveal').classList.remove('hidden'); document.querySelector('#correct-answer').textContent = word.word; saveState(); renderDashboard(); updateLearningHeader(); }
function updateLearningHeader() { const done = learningIndex >= learningQueue.length ? learningQueue.length : learningIndex; const total = learningQueue.length || state.dailyCount; document.querySelector('#learn-progress').textContent = `${done} / ${total}`; document.querySelector('#learn-accuracy').textContent = state.session.total ? `正确率 ${Math.round(state.session.correct / state.session.total * 100)}%` : '正确率 —'; document.querySelector('#session-correct').textContent = state.session.correct; document.querySelector('#session-wrong').textContent = state.session.wrong; }
function submitAnswer(event) { event.preventDefault(); if (answered || !learningQueue[learningIndex]) return; const input = document.querySelector('#answer-input'), answer = input.value.trim().toLowerCase(), word = learningQueue[learningIndex]; if (!answer) { showToast('先输入你的答案'); return; } answered = true; renderSourceExample(word, true); const correct = answer === word.word.toLowerCase(); word.attempts++; word.lastReviewed = new Date().toISOString(); state.session.total++; if (correct) { word.correct++; state.session.correct++; word.status = 'mastered'; word.dueAt = Date.now() + (learningType === 'review' ? 3 : 1) * 24 * 60 * 60 * 1000; if (learningType === 'new' && !state.daily.completed.includes(word.id)) state.daily.completed.push(word.id); document.querySelector('#answer-feedback').textContent = learningType === 'review' ? '复习正确！下次会拉开一点间隔。' : '正确！这个词正在变得更牢。'; document.querySelector('#answer-feedback').className = 'answer-feedback success'; } else { word.wrong++; state.session.wrong++; word.status = 'review'; word.dueAt = Date.now() + 10 * 60 * 1000; document.querySelector('#answer-feedback').textContent = '再看一眼拼写，稍后会进入复习。'; document.querySelector('#answer-feedback').className = 'answer-feedback error'; } input.disabled = true; document.querySelector('#answer-reveal').classList.remove('hidden'); saveState(); renderDashboard(); updateLearningHeader(); }
function nextWord() { learningIndex++; if (learningIndex >= learningQueue.length) { finishDaily(); } renderLearning(); document.querySelector('#answer-input')?.focus(); }
function finishDaily() { if (learningType === 'new' && learningQueue.length && getCompletedToday() >= Math.min(state.dailyCount, getNewWords().length + getCompletedToday())) { if (state.lastStudyDate !== todayKey()) { state.streak = state.lastStudyDate === new Date(Date.now() - 86400000).toISOString().slice(0,10) ? (state.streak || 0) + 1 : 1; state.lastStudyDate = todayKey(); } saveState(); } showToast(learningType === 'review' ? '复习完成，记忆又稳了一点' : '今日学习完成，做得很好'); }

function renderReview() { const due = getDueWords(); document.querySelector('#review-count').textContent = `${due.length} 个待复习`; document.querySelector('#review-number').textContent = due.length; const list = document.querySelector('#review-list'); if (!due.length) { list.innerHTML = '<div class="empty-list">目前没有待复习词汇。完成今天的新词后，错词会自动出现在这里。</div>'; return; } list.innerHTML = `<div class="review-action-row"><button class="primary-button" id="start-review">开始复习 ${due.length} 个词 <span>→</span></button></div>` + due.slice(0,50).map(word => `<div class="review-item"><strong class="review-word">${escapeHtml(word.word)}</strong><span>${escapeHtml(word.zh || '暂无释义')}</span><small>${escapeHtml(word.en || 'No definition')}</small><span class="review-status">${word.wrong ? `错过 ${word.wrong} 次` : '到期复习'}</span></div>`).join(''); document.querySelector('#start-review').addEventListener('click', startReview); }

function renderLibrary() { const words = getWords(); document.querySelector('#library-count').textContent = `${formatCount(words.length)} 个单词`; document.querySelector('#word-table').innerHTML = words.length ? words.slice(0,100).map(w => `<tr><td>${escapeHtml(w.word)}</td><td>${escapeHtml(w.zh || '—')}</td><td>${escapeHtml(w.en || '—')}</td><td><span class="table-status ${w.status === 'new' ? 'learning' : ''}">${w.status === 'mastered' ? '已掌握' : w.status === 'review' ? '待复习' : '未学习'}</span></td></tr>`).join('') : '<tr><td colspan="4" class="empty-list">还没有词表，导入一个 CSV 或加载示例词表开始吧。</td></tr>'; }
function getSelectorWords() { return importedPdfWords.length ? importedPdfWords : getWords().slice(0,500); }
function renderSelector() {
  const container = document.querySelector('#selector-groups');
  if (!container) return;
  const words = getSelectorWords();
  if (!Array.isArray(state.selectedWordIds)) state.selectedWordIds = words.map(word => word.id);
  const selected = new Set(state.selectedWordIds);
  document.querySelector('#selector-selected-count').textContent = words.filter(word => selected.has(word.id)).length;
  document.querySelector('#selector-unselected-count').textContent = words.filter(word => !selected.has(word.id)).length;
  container.innerHTML = Array.from({length:25}, (_, index) => index + 1).map(group => {
    const items = words.filter(word => Number(word.group) === group);
    if (!items.length) return '';
    return `<section class="selector-group"><div class="selector-group-title"><div><span class="eyebrow">TOEFL PASS</span><h3>第 ${String(group).padStart(2,'0')} 组</h3></div><small>${items.length} 个词</small></div><div class="selector-word-grid">${items.map(word => `<label class="selector-word-card ${selected.has(word.id) ? 'is-selected' : ''}" data-id="${escapeHtml(word.id)}"><input type="checkbox" ${selected.has(word.id) ? 'checked' : ''} /><div><strong>${escapeHtml(word.word)}</strong><span class="selector-pos">${escapeHtml(word.pos || '')}</span><p>${escapeHtml(word.zh || '暂无中文释义')}</p><small>英 /${escapeHtml(word.ipaUk || '—')}/　美 /${escapeHtml(word.ipaUs || '—')}/</small></div></label>`).join('')}</div></section>`;
  }).join('');
  container.querySelectorAll('.selector-word-card').forEach(card => card.querySelector('input').addEventListener('change', event => { const id = card.dataset.id; event.target.checked ? selected.add(id) : selected.delete(id); state.selectedWordIds = [...selected]; card.classList.toggle('is-selected', event.target.checked); saveState(); renderSelector(); }));
}
function setSelectorSelection(value) { const words = getSelectorWords(); state.selectedWordIds = value ? words.map(word => word.id) : []; saveState(); renderSelector(); }
function invertSelectorSelection() { const current = new Set(state.selectedWordIds || []); state.selectedWordIds = getSelectorWords().filter(word => !current.has(word.id)).map(word => word.id); saveState(); renderSelector(); }
function buildSelectorPrintSheet(selectedWords) {
  const sections = Array.from({length:25}, (_, index) => index + 1).map(group => { const items = selectedWords.filter(word => Number(word.group) === group); if (!items.length) return ''; return `<section class="selector-pdf-group"><h2>第 ${String(group).padStart(2,'0')} 组</h2><table><thead><tr><th>单词</th><th>中文释义</th><th>例句 / 完形内容</th></tr></thead><tbody>${items.map(word => `<tr><td><strong>${escapeHtml(word.word)}</strong><br /><small>英 /${escapeHtml(word.ipaUk || '—')}/</small></td><td>${escapeHtml(word.zh || '—')}</td><td>${escapeHtml(word.builtinExample || word.example || '—')}<br /><br />完形：${escapeHtml(word.builtinCloze || '—')}</td></tr>`).join('')}</tbody></table></section>`; }).join('');
  document.querySelector('#selector-print-sheet').innerHTML = `<div class="selector-pdf-title"><h1>Halo Vocab · TOEFL PASS</h1><p>已选词表 · 共 ${selectedWords.length} 个词</p></div>${sections || '<p>没有已选中的词。</p>'}<div class="selector-pdf-footer">由 Halo Vocab 生成 · ${new Date().toLocaleDateString('zh-CN')}</div>`;
}
function exportSelectedWordsPdf() { const words = getSelectorWords(); const selected = new Set(state.selectedWordIds || []); const selectedWords = words.filter(word => selected.has(word.id)); if (!selectedWords.length) { showToast('请先选中要导出的词'); return; } buildSelectorPrintSheet(selectedWords); document.title = 'Halo Vocab-TOEFL PASS-已选词表'; document.body.classList.add('selector-print-mode'); window.setTimeout(() => window.print(), 100); }
function parseVocabulary(text, filename='') { const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean); if (!lines.length) return []; const isCsv = filename.toLowerCase().endsWith('.csv') || lines[0].includes(','); const start = /^(word|英文|单词)/i.test(lines[0]) ? 1 : 0; return lines.slice(start).map((line,index) => { const parts = isCsv ? line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.replace(/^\"|\"$/g,'').trim()) : line.split(/[\t|]/).map(v => v.trim()); const word = parts[0]; if (!word) return null; return { id:`${word.toLowerCase()}-${Date.now()}-${index}`, word, zh:parts[1] || '请补充中文释义', en:parts[2] || 'Add an English definition for this word', status:'new', dueAt:null, attempts:0, correct:0, wrong:0, lastReviewed:null }; }).filter(Boolean); }
function handleFileImport(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const words = parseVocabulary(reader.result, file.name); if (!words.length) { showToast('没有识别到有效单词'); return; } state.words = [...state.words, ...words]; saveState(); renderAll(); showToast(`已导入 ${words.length} 个单词`); }; reader.readAsText(file); event.target.value = ''; }
function loadDemo() { if (state.words.length && !confirm('加载示例词表会保留当前词表，并追加 20 个示例词。继续吗？')) return; state.words = [...state.words, ...demoWords.filter(d => !state.words.some(w => w.word.toLowerCase() === d.word.toLowerCase()))].map(w => ({...w})); saveState(); renderAll(); showToast('已加载示例词表'); }
function speak(text) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = .86; window.speechSynthesis.speak(utterance); } }
function speakCurrentWord() { if (learningQueue[learningIndex]) speak(learningQueue[learningIndex].word); }
async function testApi() {
  const note = document.querySelector('#api-note');
  if (!state.apiKey) { note.textContent = '请先填写 API Key。'; return; }
  note.textContent = '正在测试连接…';
  try {
    const response = await fetch(`${state.apiEndpoint.replace(/\/$/,'')}/chat/completions`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${state.apiKey}`}, body:JSON.stringify({model:state.apiModel || 'openrouter/free', messages:[{role:'user',content:'Reply with OK.'}], max_tokens:2, temperature:0})});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    note.textContent = '连接成功。例句和完形填空可以开始调用。';
    showToast('API 连接成功');
  } catch (error) {
    note.textContent = `连接失败：${error.message}。请检查地址、模型和 API Key。`;
    showToast('API 连接失败');
  }
}
function exportData() { const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=`halo-vocab-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url); showToast('备份已导出'); }
function clearData() { if (!confirm('确定要清除全部本地数据吗？这个操作不可撤销。')) return; localStorage.removeItem(STORAGE_KEY); state = {...structuredClone(defaultState), words:[]}; learningQueue=[]; learningIndex=0; renderAll(); syncSettingsUI(); showView('dashboard'); showToast('本地数据已清除'); }
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.remove('show'),2200); }

const AUDIUS_BASE = 'https://discoveryprovider.audius.co/v1';
let currentTrack = null;
async function searchMusic(query) { const results = document.querySelector('#music-results'); results.innerHTML = '<div class="empty-list">正在搜索音乐…</div>'; try { const path = query ? `/tracks/search?query=${encodeURIComponent(query)}&limit=12` : '/tracks/trending?limit=12'; const response = await fetch(`${AUDIUS_BASE}${path}`); if (!response.ok) throw new Error(`HTTP ${response.status}`); const payload = await response.json(); const tracks = payload.data || []; results.dataset.loaded = 'true'; if (!tracks.length) { results.innerHTML = '<div class="empty-list">没有找到结果，换个关键词试试。</div>'; return; } results.innerHTML = tracks.map(track => { const art = track.artwork?.['_150x150'] || track.artwork?.['_480x480'] || ''; const artist = track.user?.name || 'Audius artist'; return `<article class="music-track"><img src="${escapeHtml(art)}" alt="" onerror="this.style.visibility='hidden'" /><div class="track-main"><strong>${escapeHtml(track.title || 'Untitled')}</strong><span>${escapeHtml(artist)}${track.genre ? ` · ${escapeHtml(track.genre)}` : ''}</span></div><span class="track-duration">${formatDuration(track.duration)}</span><button class="secondary-button music-play" data-track-id="${escapeHtml(track.id)}">播放</button></article>`; }).join(''); results.querySelectorAll('.music-play').forEach(button => button.addEventListener('click', () => playMusicTrack(tracks.find(track => String(track.id) === button.dataset.trackId)))); } catch (error) { results.innerHTML = `<div class="empty-list">音乐服务暂时不可用。请检查网络连接后重试。<br /><small>${escapeHtml(error.message)}</small></div>`; } }
function formatDuration(seconds) { if (!seconds) return '—'; const minutes = Math.floor(seconds / 60), remaining = String(Math.floor(seconds % 60)).padStart(2,'0'); return `${minutes}:${remaining}`; }
function playMusicTrack(track) { if (!track) return; currentTrack = track; const audio = document.querySelector('#music-audio'); audio.src = `${AUDIUS_BASE}/tracks/${encodeURIComponent(track.id)}/stream`; document.querySelector('#player-art').src = track.artwork?.['_150x150'] || ''; document.querySelector('#player-title').textContent = track.title || 'Untitled'; document.querySelector('#player-artist').textContent = track.user?.name || 'Audius artist'; document.querySelector('#music-player').classList.remove('hidden'); audio.play().catch(() => showToast('点击播放器的播放按钮开始播放')); }
function stopMusic() { const audio = document.querySelector('#music-audio'); audio.pause(); audio.removeAttribute('src'); audio.load(); document.querySelector('#music-player').classList.add('hidden'); currentTrack = null; }

window.addEventListener('afterprint', () => { document.body.classList.remove('selector-print-mode'); document.title = 'Halo Vocab'; });

init();
