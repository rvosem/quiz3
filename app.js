const CORRECT_PIN = "1234";
const TOPICS = ["1234"];
const RANGE_SIZE = 100;
const STORAGE_KEY = 'exam_progress_v3';
let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let questionStates = [];
let currentPackInfo = { topic: '', start: 0, end: 0 };

// Элементы UI
const pinInput = document.getElementById('pin-input');
const keypad = document.querySelector('.pin-keypad');
const liveStatsEl = document.getElementById('live-stats');
const circlesWrapper = document.getElementById('circles-wrapper');
const progressCirclesEl = document.getElementById('progress-circles');

// --- PIN ЛОГИКА ---
keypad.addEventListener('click', (e) => {
  if (e.target.classList.contains('key-btn')) {
    const num = e.target.dataset.num;
    if (num === 'back') {
      pinInput.value = pinInput.value.slice(0, -1);
      document.getElementById('pin-error').textContent = '';
    } else {
      if (pinInput.value.length < 4) {
        pinInput.value += num;
        document.getElementById('pin-error').textContent = '';
        if (pinInput.value.length === 4) checkPin();
      }
    }
  }
});

function checkPin() {
  if (pinInput.value === CORRECT_PIN) {
    document.getElementById('pin-overlay').style.display = 'none';
    loadQuestions();
  } else {
    document.getElementById('pin-error').textContent = 'Неверный PIN';
    pinInput.value = '';
    if (navigator.vibrate) navigator.vibrate(200);
  }
}

// --- ХРАНЕНИЕ ---
function getStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { console.warn('Не удалось сохранить прогресс'); }
}

function saveCurrentProgress() {
  const storage = getStorage();
  const key = `${currentPackInfo.topic}_${currentPackInfo.start}_${currentPackInfo.end}`;
  storage[key] = {
    index: currentIndex,
    correct: correctCount,
    wrong: wrongCount,
    states: questionStates,
    shuffledQuestions: currentQuestions // 💾 Запоминаем порядок ответов
  };
  saveStorage(storage);
}

// --- ЗАГРУЗКА И МЕНЮ ---
async function loadQuestions() {
  try {
    const res = await fetch('questions.json');
    if (!res.ok) throw new Error('Файл не найден');
    allQuestions = await res.json();
    showTopicSelector();
  } catch (err) {
    document.getElementById('pin-error').textContent = '❌ Ошибка загрузки questions.json';
  }
}

function hideAllScreens() {
  ['topic-select', 'range-select', 'quiz-header', 'quiz-main', 'quiz-footer', 'results-screen']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
}

function showTopicSelector() {
  const container = document.getElementById('topics-container');
  container.innerHTML = '';
  TOPICS.forEach(topic => {
    const btn = document.createElement('button');
    btn.className = 'topic-btn';
    const total = allQuestions.filter(q => q.topic === topic).length;
    const storage = getStorage();
    let totalAnswered = 0;
    for (let key in storage) {
      if (key.startsWith(topic + '_') && storage[key].states) {
        totalAnswered += storage[key].states.filter(s => s && s.answered).length;
      }
    }
    const progressText = totalAnswered > 0 ? ` | Решено: ${totalAnswered}/${total}` : '';
    btn.textContent = `${topic} (${total} вопр.${progressText})`;
    btn.onclick = () => showRangeSelector(topic);
    container.appendChild(btn);
  });
  const resetBtn = document.createElement('button');
  resetBtn.className = 'topic-btn';
  resetBtn.style.marginTop = '20px';
  resetBtn.style.background = 'var(--wrong)';
  resetBtn.style.borderColor = 'var(--wrong)';
  resetBtn.style.color = '#fff';
  resetBtn.textContent = '🗑 Сбросить весь прогресс';
  resetBtn.onclick = () => {
    if (confirm('⚠️ Сбросить ВЕСЬ прогресс? Это действие нельзя отменить.')) {
      localStorage.removeItem(STORAGE_KEY);
      showTopicSelector();
    }
  };
  container.appendChild(resetBtn);
  hideAllScreens();
  document.getElementById('topic-select').classList.remove('hidden');
}

function showRangeSelector(topic) {
  const filtered = allQuestions.filter(q => q.topic === topic);
  const container = document.getElementById('ranges-container');
  document.getElementById('range-title').textContent = topic;
  container.innerHTML = '';
  const storage = getStorage();
  for (let i = 0; i < filtered.length; i += RANGE_SIZE) {
    const start = i + 1;
    const end = Math.min(i + RANGE_SIZE, filtered.length);
    const btn = document.createElement('button');
    btn.className = 'range-btn';
    const key = `${topic}_${start}_${end}`;
    const saved = storage[key];
    const answeredCount = saved?.states ? saved.states.filter(s => s?.answered).length : 0;
    const suffix = answeredCount > 0 ? ` (Решено: ${answeredCount}/${end - start+1})` : '';
    btn.textContent = `Вопросы ${start}-${end}${suffix}`;
    btn.onclick = () => startQuiz(topic, start, end, filtered.slice(i, end), saved || {});
    container.appendChild(btn);
  }
  hideAllScreens();
  document.getElementById('range-select').classList.remove('hidden');
}

document.getElementById('back-to-topics-from-range').onclick = showTopicSelector;

// --- ТЕСТ ---
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startQuiz(topic, start, end, questionsChunk, savedData) {
  currentPackInfo = { topic, start, end };

  // Если есть сохранённый порядок ответов — восстанавливаем его
  if (savedData && savedData.shuffledQuestions) {
    currentQuestions = savedData.shuffledQuestions;
  } else {
    // Первый запуск или сброс: перемешиваем варианты
    currentQuestions = questionsChunk.map(q => {
      let opts = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correct }));
      opts = shuffleArray(opts);
      return {
        question: q.question,
        options: opts.map(o => o.text),
        correct: opts.findIndex(o => o.isCorrect)
      };
    });
  }

  // Восстанавливаем состояния или создаём новые
  if (savedData && savedData.states) {
    questionStates = savedData.states;
  } else {
    questionStates = new Array(currentQuestions.length).fill(null).map(() => ({ answered: false, selected: -1 }));
  }

  currentIndex = savedData?.index ?? 0;
  correctCount = savedData?.correct ?? 0;
  wrongCount = savedData?.wrong ?? 0;

  hideAllScreens();
  document.getElementById('quiz-header').classList.remove('hidden');
  document.getElementById('quiz-main').classList.remove('hidden');
  document.getElementById('quiz-footer').classList.remove('hidden');

  renderCircles();
  showQuestion();
}

// --- ОТРИСОВКА КРУГОВ (ОБНОВЛЕНО) ---
function renderCircles() {
  progressCirclesEl.innerHTML = '';
  const total = currentQuestions.length;
  const startNum = currentPackInfo.start; // Начальный номер пачки (например, 201)

  for (let i = 0; i < total; i++) {
    const circle = document.createElement('div');
    circle.className = 'circle';
    
    // Пишем глобальный номер (startNum + индекс)
    circle.textContent = startNum + i; 

    const state = questionStates[i];
    if (state && state.answered) {
      if (state.selected === currentQuestions[i].correct) {
        circle.classList.add('correct');
      } else {
        circle.classList.add('wrong');
      }
    } else {
      circle.classList.add('future');
    }

    if (i === currentIndex) {
      circle.classList.add('active');
      circle.classList.remove('future');
    }

    circle.onclick = () => {
      currentIndex = i;
      showQuestion();
    };

    progressCirclesEl.appendChild(circle);
  }

  // Скролл к активному кругу
  setTimeout(() => {
    const activeCircle = document.querySelector('.circle.active');
    if (activeCircle && circlesWrapper) {
      activeCircle.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, 50);
}

function showQuestion() {
  const q = currentQuestions[currentIndex];
  document.getElementById('question').textContent = q.question;
  document.getElementById('feedback').textContent = '';
  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.textContent = opt;
    btn.onclick = () => checkAnswer(i, q.correct, btn);
    optionsEl.appendChild(btn);
  });
  const state = questionStates[currentIndex];
  if (state && state.answered) {
    const btns = optionsEl.querySelectorAll('.opt-btn');
    btns.forEach(b => b.classList.add('disabled'));
    btns[q.correct].classList.add('correct');
    if (state.selected !== q.correct) {
      btns[state.selected].classList.add('wrong');
      document.getElementById('feedback').textContent = '❌ Было неверно';
      document.getElementById('feedback').style.color = 'var(--wrong)';
    } else {
      document.getElementById('feedback').textContent = '✅ Верно';
      document.getElementById('feedback').style.color = 'var(--correct)';
    }
  }
  document.getElementById('prev-btn').disabled = currentIndex === 0;
  const nextBtn = document.getElementById('next-btn');
  nextBtn.textContent = currentIndex === currentQuestions.length - 1 ? 'Завершить' : 'Далее →';
  nextBtn.disabled = false;
  renderCircles();
  updateLiveStats();
}

function checkAnswer(selected, correct, clickedBtn) {
  const state = questionStates[currentIndex];
  if (state && state.answered) return;
  questionStates[currentIndex] = { answered: true, selected: selected };
  const btns = document.querySelectorAll('.opt-btn');
  btns.forEach(b => b.classList.add('disabled'));
  if (selected === correct) {
    clickedBtn.classList.add('correct');
    correctCount++;
    document.getElementById('feedback').textContent = '✅ Верно';
    document.getElementById('feedback').style.color = 'var(--correct)';
  } else {
    clickedBtn.classList.add('wrong');
    btns[correct].classList.add('correct');
    wrongCount++;
    document.getElementById('feedback').textContent = '❌ Неверно';
    document.getElementById('feedback').style.color = 'var(--wrong)';
  }
  saveCurrentProgress();
  renderCircles();
  updateLiveStats();
}

function updateLiveStats() {
  liveStatsEl.textContent = `✅ ${correctCount} | ❌ ${wrongCount}`;
}

document.getElementById('next-btn').onclick = () => {
  saveCurrentProgress();
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    showQuestion();
  } else {
    showResults();
  }
};

document.getElementById('prev-btn').onclick = () => {
  saveCurrentProgress();
  if (currentIndex > 0) { currentIndex--; showQuestion(); }
};

document.getElementById('back-to-topics-header-btn').onclick = () => {
  if (confirm('Вернуться к выбору тем? Прогресс сохранён.')) {
    showTopicSelector();
  }
};

document.getElementById('reset-pack-btn').onclick = () => {
  if (confirm(`Сбросить прогресс в пачке ${currentPackInfo.start}-${currentPackInfo.end}?`)) {
    const storage = getStorage();
    const key = `${currentPackInfo.topic}_${currentPackInfo.start}_${currentPackInfo.end}`;
    delete storage[key];
    saveStorage(storage);
    const filtered = allQuestions.filter(q => q.topic === currentPackInfo.topic);
    const chunk = filtered.slice(currentPackInfo.start - 1, currentPackInfo.end);
    startQuiz(currentPackInfo.topic, currentPackInfo.start, currentPackInfo.end, chunk, {});
  }
};

function showResults() {
  hideAllScreens();
  document.getElementById('results-screen').classList.remove('hidden');
  document.getElementById('res-correct').textContent = correctCount;
  document.getElementById('res-wrong').textContent = wrongCount;
  document.getElementById('res-total').textContent = currentQuestions.length;
}

document.getElementById('back-to-topics-btn').onclick = showTopicSelector;
window.addEventListener('DOMContentLoaded', () => pinInput.focus());