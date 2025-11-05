// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDaAjvHoTMe18sy1YOomGjz7_cck9xX6xU",
  authDomain: "daily-dost.firebaseapp.com",
  projectId: "daily-dost",
  storageBucket: "daily-dost.firebasestorage.app",
  messagingSenderId: "354533623697",
  measurementId: "G-4F772YDC6Z"
};

const appId = firebaseConfig.projectId; 
const initialAuthToken = null;

// --- Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, 
  onAuthStateChanged, linkWithPopup, signInWithCredential
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { 
  getFirestore, doc, setDoc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, collection, query, writeBatch, getDocs, where, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- App State ---
let app, db, auth, userId;
let habits = [], habitLogs = {}, achievements = [], assignments = [], grades = [], sleepLogs = {};
let userProfile = { level: 1, xp: 0, targetGpa: 3.5 };
let currentView = 'dashboard-view';
let pomodoro = { timerId: null, mode: 'work', timeLeft: 1500, isRunning: false };
let correlationChartInstance, trendsChartInstance;

// --- DOM Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const modalContainer = document.getElementById('modal-container');

// --- Constants ---
const XP_PER_LEVEL = 100;
const XP_PER_DIFFICULTY = { easy: 10, medium: 20, hard: 30 };
const POMODORO_TIMES = { work: 1500, shortBreak: 300, longBreak: 900 };
const HABIT_CATEGORIES = {
  'study': { name: 'Study', color: '#3b82f6' },
  'reading': { name: 'Reading', color: '#8b5cf6' },
  'lab': { name: 'Lab Work', color: '#10b981' },
  'health': { name: 'Health', color: '#ef4444' },
  'mindfulness': { name: 'Mindfulness', color: '#f59e0b' },
  'other': { name: 'Other', color: '#64748b' },
};
const ACHIEVEMENTS_LIST = {
  'first_habit': { name: 'Getting Started', description: 'Complete your first habit.', icon: '🎯' },
  '7_day_streak': { name: 'Week Warrior', description: '7-day streak on a habit.', icon: '📅' },
  'first_pomodoro': { name: 'Focused', description: 'Complete a Pomodoro session.', icon: '🍅' },
  'perfect_day': { name: 'Perfect Day', description: 'Complete all daily habits.', icon: '✅' },
};

// --- Utility Functions ---
const getTodayString = () => new Date().toISOString().split('T')[0];
const getDateString = (date) => date.toISOString().split('T')[0];
// Force a fixed size for a Chart.js canvas that shows the full graph
const setFixedChartSize = (canvas, heightPx) => {
  if (!canvas) return;
  const parent = canvas.parentElement;

  // Tailwind's w-full can fight explicit sizing; keep CSS width on canvas instead
  canvas.classList.remove('w-full');

  // Let the parent grow to fit the canvas instead of clipping or locking height
  if (parent) {
    parent.style.position = 'relative';
    parent.style.height = 'auto';        // CHANGED: allow full height
    parent.style.overflow = 'visible';   // CHANGED: do not clip axes/legend
  }

  // Compute a concrete width and lock both the CSS and attribute sizes
  const widthPx =
    (parent && parent.clientWidth) ||
    Math.round(canvas.getBoundingClientRect().width) ||
    800;

  canvas.style.display = 'block';
  canvas.style.width = '100%';           // CHANGED: allow full parent width
  canvas.style.height = `${heightPx}px`; // visible height
  canvas.width = widthPx;                // drawing buffer width
  canvas.height = heightPx;              // drawing buffer height
};

// sample data for chart
const SAMPLE_GRADES = [
  { date: "2025-09-01", grade: 75 },
  { date: "2025-09-14", grade: 85 },
  { date: "2025-09-28", grade: 92 }
];
const SAMPLE_MOODS = { "2025-09-01": "neutral", "2025-09-14": "happy", "2025-09-28": "sad" };
const SAMPLE_SLEEP = { "2025-09-01": 7, "2025-09-14": 8, "2025-09-28": 6 };

// --- Status Normalization Helpers ---
const normalizeStatus = (s) => {
  if (s === 'complete') return 'completed';
  if (s === 'skip') return 'skipped';
  if (s === 'fail') return 'failed';
  return s;
};
const isCompleted = (s) => normalizeStatus(s) === 'completed';
const isSkipped = (s) => normalizeStatus(s) === 'skipped';
const isFailed = (s) => normalizeStatus(s) === 'failed';

const showToast = (message) => {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-5 right-5 text-white p-3 rounded-lg shadow-lg animate-fade-in-up';
  toast.style.backgroundColor = 'var(--primary)';
  toast.innerText = message;
  document.body.appendChild(toast);
  animateToast(toast);
  setTimeout(() => {
    toast.style.animation = 'fade-out 0.5s forwards';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
};

const switchViewWithAnimation = (viewId) => {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  
  // Show target view with null check
  const targetView = document.getElementById(viewId);
  if (!targetView) {
    console.error(`View not found: ${viewId}`);
    return;
  }
  targetView.classList.remove('hidden');
  
  // Update tab styling
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.style.color = 'var(--secondary)';
    btn.style.borderColor = 'transparent';
  });
  
  const activeTab = document.getElementById(`tab-${viewId.split('-')[0]}`);
  if (activeTab) {
    activeTab.style.color = 'var(--primary)';
    activeTab.style.borderColor = 'var(--primary)';
  }
  
  currentView = viewId;
  
  // Trigger specific view renders
  if (viewId === 'analytics-view') renderAnalytics();
  if (viewId === 'rewards-view') renderRewards();
  
  // Add animation after view is visible
  setTimeout(() => {
    const cards = targetView.querySelectorAll('.card');
    if (cards.length > 0 && typeof anime !== 'undefined') {
      anime({
        targets: cards,
        opacity: [0, 1],
        translateY: [30, 0],
        delay: anime.stagger(80),
        duration: 600,
        easing: 'easeOutCubic'
      });
    }
  }, 50);
};

// Use the new function name
const switchView = switchViewWithAnimation;

// --- Firebase Initialization & Auth ---
const initializeFirebase = async () => {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        console.log(`Authenticated: ${userId}, anonymous: ${user.isAnonymous}`);
        
        if (!user.isAnonymous) {
          await updateUserProfile(user);
        } else {
          // Set generic avatar for anonymous users
          document.getElementById('user-avatar').src = 
            'https://ui-avatars.com/api/?name=Guest&background=667eea&color=fff&size=128';
          document.getElementById('user-name').innerText = 'Guest User';
        }
        
        setupListeners();
        loadingOverlay.classList.add('hidden');
      } else {
        // Sign in anonymously on first load
        console.log('No user, signing in anonymously...');
        await signInAnonymously(auth);
      }
    });
  } catch (error) {
    console.error("Firebase Init Error:", error);
    showToast("Failed to initialize. Please refresh.");
    loadingOverlay.classList.add('hidden');
  }
};

// Add this function to handle profile avatar clicks
// Add this after initializeFirebase or in window.onload:
document.addEventListener('DOMContentLoaded', () => {
  const userAvatar = document.getElementById('user-avatar');
  if (userAvatar) {
    userAvatar.addEventListener('click', handleProfileClick);
  }
});

const handleProfileClick = () => {
  if (!auth || !auth.currentUser) {
    showToast('Please wait, app is loading...');
    return;
  }
  
  if (auth.currentUser.isAnonymous) {
    // Show sign-in modal for anonymous users
    const modal = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
           onclick="this.remove()">
        <div class="bg-surface p-6 rounded-lg shadow-xl max-w-sm w-full mx-4" 
             onclick="event.stopPropagation()">
          <h3 class="text-xl font-bold mb-4">Sign In</h3>
          <p class="text-secondary mb-4">
            Sign in with Google to sync your data across devices and never lose your progress!
          </p>
          <button onclick="handleGoogleSignIn(); this.closest('.fixed').remove()" 
                  class="w-full bg-primary text-white py-3 rounded-lg hover:bg-opacity-90 
                         flex items-center justify-center space-x-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
          <button onclick="this.closest('.fixed').remove()" 
                  class="w-full mt-3 py-2 text-secondary hover:text-text">
            Cancel
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
  } else {
    // Show profile menu for signed-in users
    const modal = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
           onclick="this.remove()">
        <div class="bg-surface p-6 rounded-lg shadow-xl max-w-sm w-full mx-4" 
             onclick="event.stopPropagation()">
          <div class="text-center mb-4">
            <img src="${auth.currentUser.photoURL || 'https://ui-avatars.com/api/?name=User'}" 
                 class="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-primary">
            <h3 class="text-xl font-bold">${auth.currentUser.displayName || 'User'}</h3>
            <p class="text-sm text-secondary">${auth.currentUser.email || 'Anonymous User'}</p>
          </div>
          <button onclick="auth.signOut(); this.closest('.fixed').remove(); showToast('Signed out successfully');" 
                  class="w-full bg-red-500 text-white py-3 rounded-lg hover:bg-red-600">
            Sign Out
          </button>
          <button onclick="this.closest('.fixed').remove()" 
                  class="w-full mt-3 py-2 text-secondary hover:text-text">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modal);
  }
};

const handleGoogleSignIn = async () => {
  try {
    loadingOverlay.classList.remove('hidden');
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      showToast('Please wait...');
      return;
    }
    
    const isAnonymous = currentUser.isAnonymous;
    const anonymousUid = isAnonymous ? currentUser.uid : null;
    const hasData = isAnonymous ? await userHasData(anonymousUid) : false;
    
    const provider = new GoogleAuthProvider();
    
    if (isAnonymous && hasData) {
      // Link anonymous account to Google
      try {
        const result = await linkWithPopup(currentUser, provider);
        showToast('Account linked! Your data is preserved.');
        await updateUserProfile(result.user);
      } catch (linkError) {
        // Google account already exists
        if (linkError.code === 'auth/credential-already-in-use') {
          const credential = GoogleAuthProvider.credentialFromError(linkError);
          const result = await signInWithCredential(auth, credential);
          const googleUid = result.user.uid;
          
          const googleHasData = await userHasData(googleUid);
          
          if (googleHasData) {
            const keepOldData = confirm(
              'Your Google account has existing data. Keep it? (Cancel to merge current data)'
            );
            
            if (!keepOldData) {
              await migrateUserData(anonymousUid, googleUid);
              showToast('Data merged successfully!');
            }
          } else {
            await migrateUserData(anonymousUid, googleUid);
            showToast('Account upgraded! Data preserved.');
          }
          
          await updateUserProfile(result.user);
        } else {
          throw linkError;
        }
      }
    } else {
      // Direct sign-in (no data to preserve)
      const result = await signInWithPopup(auth, provider);
      await updateUserProfile(result.user);
      showToast('Welcome back!');
    }
  } catch (error) {
    console.error('Sign-in error:', error);
    showToast(`Sign-in failed: ${error.message}`);
  } finally {
    loadingOverlay.classList.add('hidden');
  }
};


const setupListeners = () => {
  const collections = {
    profile: `artifacts/${appId}/users/${userId}/profile/userProfile`,
    habits: `artifacts/${appId}/users/${userId}/habits`,
    habitLogs: `artifacts/${appId}/users/${userId}/habitLogs`,
    achievements: `artifacts/${appId}/users/${userId}/achievements`,
    assignments: `artifacts/${appId}/users/${userId}/assignments`,
    grades: `artifacts/${appId}/users/${userId}/grades`,
    sleepLogs: `artifacts/${appId}/users/${userId}/sleepLogs`,
  };

  onSnapshot(doc(db, collections.profile), (docSnap) => {
    if (docSnap.exists()) userProfile = { ...userProfile, ...docSnap.data() };
    else setDoc(docSnap.ref, userProfile);
    renderDashboard();
    if(currentView === 'analytics-view') renderAnalytics();
  });
  onSnapshot(query(collection(db, collections.habits)), (snap) => {
    habits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDashboard();
  });
  onSnapshot(query(collection(db, collections.habitLogs)), (snap) => {
    habitLogs = {};
    snap.docs.forEach(d => {
      const log = { id: d.id, ...d.data() };
      if (!habitLogs[log.date]) habitLogs[log.date] = {};
      habitLogs[log.date][log.habitId] = log;
    });
    renderDashboard();
  });
  onSnapshot(query(collection(db, collections.achievements)), (snap) => {
    achievements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
  onSnapshot(query(collection(db, collections.assignments)), (snap) => {
    assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAssignments();
  });
  onSnapshot(query(collection(db, collections.grades)), (snap) => {
    grades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
  onSnapshot(query(collection(db, collections.sleepLogs)), (snap) => {
    sleepLogs = {};
    snap.docs.forEach(d => sleepLogs[d.id] = d.data().hours);
    renderSleepTracker();
  });
  loadingOverlay.classList.add('hidden');
};

const renderDashboard = () => {
  if (!userId) return;
  renderUserProfile();
  renderHabitsForToday();
  renderDailyProgress();
  renderMentalHealthTrackers();
  renderSleepTracker();
  animateDashboardItems();
};

const renderAnalytics = () => {
  document.getElementById('gpa-target-input').value = userProfile.targetGpa || 3.5;
  populateHabitSelector();
  renderCorrelationChart();
};

const renderUserProfile = () => {
  const { level = 1, xp = 0 } = userProfile;
  const xpForNextLevel = (XP_PER_LEVEL * (level - 1)) + 20;
  const xpPercentage = Math.min(100, (xp / xpForNextLevel) * 100);

  document.getElementById('user-level').innerText = `Level ${level}`;
  document.getElementById('xp-text').innerText = `${xp}/${xpForNextLevel} XP`;
  document.getElementById('xp-bar').style.width = `${xpPercentage}%`;

  // Update avatar if user is signed in
  if (auth.currentUser) {
    updateUserProfile(auth.currentUser);
  }
};


const renderHabitsForToday = () => {
  const listEl = document.getElementById('habits-list');
  const emptyMsg = document.getElementById('empty-habits-message');
  
  const today = new Date();
  const dayOfWeek = today.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
  const todayStr = getTodayString();
  
  // Show ALL habits, not just today's
  if (habits.length === 0) {
    listEl.innerHTML = '';
    emptyMsg.classList.remove('hidden');
  } else {
    emptyMsg.classList.add('hidden');
    listEl.innerHTML = habits.map(habit => {
      const log = habitLogs[todayStr]?.[habit.id];
      const status = log ? normalizeStatus(log.status) : 'pending';
      const category = HABIT_CATEGORIES[habit.category] || HABIT_CATEGORIES.other;
      
      // Check if habit is scheduled for today
      const isScheduledToday = habit.frequency?.days?.includes('everyday') || 
                                habit.frequency?.days?.includes(dayOfWeek);
      
      let countdownHTML = '';
      if (habit.isExamPrep && habit.examDate) {
        const examDate = new Date(habit.examDate + 'T00:00:00');
        const daysLeft = Math.ceil((examDate - new Date()) / (1000 * 60 * 60 * 24));
        countdownHTML = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background-color: var(--warning); color: white">${daysLeft <= 0 ? `${daysLeft}d left` : 'Today!'}</span>`;
      }
      
      // Display scheduled days if not today
      let scheduleInfo = '';
      if (!isScheduledToday) {
        const daysList = habit.frequency?.days?.join(', ') || 'Not set';
        scheduleInfo = `<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--secondary); color: white; opacity: 0.7">📅 ${daysList}</span>`;
      }
      
      return `
        <div class="habit-item flex items-center justify-between p-3 rounded-lg card ${!isScheduledToday ? 'opacity-60' : ''}" data-id="${habit.id}" style="border-left: 5px solid ${category.color}">
          <div class="flex items-center gap-3 overflow-hidden">
            <span class="text-2xl">${habit.icon}</span>
            <div>
              <p class="font-semibold truncate">${habit.name}</p>
              <div class="flex items-center gap-2 text-xs" style="color: var(--secondary)">
                <span>${habit.streak || 0}🔥</span>
                <span class="capitalize px-2 py-0.5 rounded-full" style="background-color: ${category.color}20; color: ${category.color}">${category.name}</span>
                ${countdownHTML}
                ${scheduleInfo}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            ${status === 'pending' && isScheduledToday ? `
              <button data-action="complete" class="action-btn p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-800" title="Complete">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
              <button data-action="skip" class="action-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700" title="Skip">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
              </button>
            ` : status === 'pending' && !isScheduledToday ? `
              <span class="text-xs font-semibold px-3 py-1" style="color: var(--secondary)">Not scheduled</span>
            ` : `
              <span class="capitalize font-semibold text-sm px-3" style="color: ${
                status === 'completed' ? 'var(--accent)' : 
                status === 'skipped' ? 'var(--secondary)' : 
                'var(--danger)'
              }">${status}</span>
            `}
            <button data-action="edit" class="action-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700" title="Edit Habit">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" stroke-width="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  
  document.querySelectorAll('.habit-item .action-btn').forEach(btn => {
    btn.addEventListener('click', handleHabitAction);
  });
};


const handleHabitAction = (e) => {
  e.stopPropagation();
  const habitItem = e.currentTarget.closest('.habit-item');
  if (!habitItem) return;
  const habitId = habitItem.dataset.id;
  const action = e.currentTarget.dataset.action;
  if (action === 'complete' || action === 'skip') {
    updateHabitStatus(habitId, action);
  } else if (action === 'edit') {
    showAddHabitModal(habits.find(h => h.id === habitId));
  }
};

const renderDailyProgress = () => {
  const circle = document.getElementById('daily-progress-circle');
  const text = document.getElementById('daily-progress-text');
  const today = new Date();
  const dayOfWeek = today.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
  const todayStr = getTodayString();
  const habitsForToday = habits.filter(h => h.frequency?.days?.includes('everyday') || h.frequency?.days?.includes(dayOfWeek));
  
  if (habitsForToday.length === 0) {
    updateProgressCircle(0, circle, text);
    return;
  }
  const completedCount = habitsForToday.filter(h => {
    const s = habitLogs[todayStr]?.[h.id]?.status;
    return isCompleted(s);
  }).length;
  const percentage = Math.round((completedCount / habitsForToday.length) * 100);
  updateProgressCircle(percentage, circle, text);
};

const updateProgressCircle = (percentage, circle, text) => {
  if (!circle || !text) return;
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = offset;
  text.textContent = `${percentage}%`;
};

const renderMentalHealthTrackers = () => {
  const todayStr = getTodayString();
  const todaysMood = userProfile.moods?.[todayStr];
  const todaysStress = userProfile.stress?.[todayStr];

  document.querySelectorAll('.mood-btn').forEach(btn => {
    const isSelected = btn.dataset.mood === todaysMood;
    btn.style.transform = isSelected ? 'scale(1.25)' : 'scale(1)';
    btn.style.opacity = isSelected ? '1' : '0.6';
  });

  document.querySelectorAll('.stress-btn').forEach(btn => {
    const isSelected = btn.dataset.stress === todaysStress;
    btn.style.backgroundColor = isSelected ? 'var(--primary)' : 'transparent';
    btn.style.color = isSelected ? 'var(--primary-foreground)' : 'var(--foreground)';
  });
};

const renderSleepTracker = () => {
  const todayStr = getTodayString();
  const sleepInput = document.getElementById('sleep-hours');
  if (sleepInput) {
    sleepInput.value = sleepLogs[todayStr] || '';
  }
};

const renderAssignments = () => {
  const listEl = document.getElementById('assignment-list');
  const emptyMsg = document.getElementById('empty-assignments-message');
  if (!listEl || !emptyMsg) return;

  const sorted = assignments.filter(a => !a.completed).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (sorted.length === 0) {
    listEl.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');
  listEl.innerHTML = sorted.map(a => {
    const dueDate = new Date(a.dueDate + 'T00:00:00');
    const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
    const countdownColor = daysLeft <= 3 ? 'var(--danger)' : (daysLeft <= 7 ? 'var(--warning)' : 'var(--secondary)');
    return `
      <div class="flex items-center justify-between p-2 rounded-lg card text-sm">
        <div>
          <p class="font-semibold">${a.title}</p>
          <p style="color:var(--secondary)">${a.subject}</p>
        </div>
        <div class="text-right">
          <p style="color:${countdownColor}">${daysLeft > 0 ? `${daysLeft}d left` : (daysLeft === 0 ? 'Today!' : 'Overdue')}</p>
          <button data-id="${a.id}" class="toggle-assignment-btn text-xs" style="color:var(--accent)">Mark Done</button>
        </div>
      </div>
    `;
  }).join('');
};

const renderRewards = () => {
  const grid = document.getElementById('achievements-grid');
  const earnedIds = achievements.map(a => a.achievementId);
  grid.innerHTML = Object.entries(ACHIEVEMENTS_LIST).map(([id, ach]) => {
    const isEarned = earnedIds.includes(id);
    return `
      <div class="card rounded-lg p-4 text-center flex flex-col items-center justify-center ${isEarned ? 'opacity-100' : 'opacity-40'}">
        <div class="text-4xl mb-2">${ach.icon}</div>
        <h3 class="font-bold text-sm">${ach.name}</h3>
        <p class="text-xs mt-1" style="color: var(--secondary);">${ach.description}</p>
        ${isEarned ? `<p class="text-xs mt-2 font-bold" style="color: var(--accent);">Unlocked!</p>` : ''}
      </div>
    `;
  }).join('');
};

const updatePomodoroUI = () => {
  document.getElementById('pomodoro-timer').textContent = `${String(Math.floor(pomodoro.timeLeft / 60)).padStart(2, '0')}:${String(pomodoro.timeLeft % 60).padStart(2, '0')}`;
  document.querySelectorAll('.pomodoro-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.pomodoro-btn[data-mode="${pomodoro.mode}"]`).classList.add('active');
  document.getElementById('pomodoro-start-btn').textContent = pomodoro.isRunning ? 'Pause' : 'Start';
  const cyclesElem = document.getElementById('pomodoro-cycles');
  if (cyclesElem) {
    // Prevent showing 'undefined'
    const currentCycles = typeof pomodoro.completedCycles === "number" ? pomodoro.completedCycles : 0;
    cyclesElem.textContent = `Cycles: ${currentCycles}/4`;
  }
};

const switchPomodoroMode = (mode) => {
  stopPomodoro();
  pomodoro.mode = mode;
  pomodoro.timeLeft = POMODORO_TIMES[mode];
  updatePomodoroUI();
};

const startPausePomodoro = () => {
  pomodoro.isRunning = !pomodoro.isRunning;
  if (pomodoro.isRunning) {
    pomodoro.timerId = setInterval(() => {
      pomodoro.timeLeft--;
      if (pomodoro.timeLeft < 0) {
        stopPomodoro();
        showToast(`${pomodoro.mode === 'work' ? 'Work' : 'Break'} session complete!`);
        if(pomodoro.mode === 'work') grantAchievement('first_pomodoro');
        // Auto-switch logic could go here
        // --- Pomodoro Auto-switch Extension ---
        const POMODORO_CYCLE_LIMIT = 4; // Number of work sessions before long break
        let pomodoro = {
          timerId: null,
          mode: 'work',
          timeLeft: 1500,
          isRunning: false,
          completedCycles: 0 // <-- Add this property
        };

        function startPausePomodoro() {
          pomodoro.isRunning = !pomodoro.isRunning;
          if (pomodoro.isRunning) {
            pomodoro.timerId = setInterval(() => {
              pomodoro.timeLeft--;
              if (pomodoro.timeLeft <= 0) {
                stopPomodoro();
                handlePomodoroAutoSwitch(); // <-- Auto-switch logic
              }
              updatePomodoroUI();
            }, 1000);
          } else {
            clearInterval(pomodoro.timerId);
            updatePomodoroUI();
          }
        }

        function handlePomodoroAutoSwitch() {
          if (pomodoro.mode === 'work') {
            grantAchievement('firstpomodoro'); // Keep original achievement logic
            pomodoro.completedCycles++;
            if (pomodoro.completedCycles >= POMODORO_CYCLE_LIMIT) {
              pomodoro.completedCycles = 0; // Reset cycles
              showToast("Work session complete! Time for a long break ✨");
              switchPomodoroMode('longBreak');
            } else {
              showToast("Work session complete! Time for a short break 🧸");
              switchPomodoroMode('shortBreak');
            }
          } else {
            showToast((pomodoro.mode === 'longBreak')
              ? "Long break finished. Ready to focus again!"
              : "Break finished. Back to work!");
            switchPomodoroMode('work');
          }
          startPausePomodoro(); // Automatically start next timer
        }

        // Optionally: Reset cycles when Pomodoro is reset manually
        function resetPomodoro() {
          stopPomodoro();
          pomodoro.completedCycles = 0;
          pomodoro.timeLeft = POMODOROTIMES[pomodoro.mode];
          updatePomodoroUI();
        }
      }
      updatePomodoroUI();
    }, 1000);
  } else {
    clearInterval(pomodoro.timerId);
  }
  updatePomodoroUI();
};

const stopPomodoro = () => {
  clearInterval(pomodoro.timerId);
  pomodoro.isRunning = false;
};

const resetPomodoro = () => {
  stopPomodoro();
  pomodoro.timeLeft = POMODORO_TIMES[pomodoro.mode];
  updatePomodoroUI();
};

const setMentalHealthValue = async (type, value) => {
  const todayStr = getTodayString();
  const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
  await setDoc(profileRef, { [type]: { [todayStr]: value } }, { merge: true });
};

const saveSleepHours = async () => {
  const hours = document.getElementById('sleep-hours').value;
  if (hours === '' || isNaN(hours)) return;
  const sleepRef = doc(db, `artifacts/${appId}/users/${userId}/sleepLogs`, getTodayString());
  await setDoc(sleepRef, { hours: parseFloat(hours) });
  showToast('Sleep logged!');
};

const updateHabitStatus = async (habitId, status) => {
  const todayStr = getTodayString();
  const logForToday = habitLogs[todayStr]?.[habitId];
  const logRef = logForToday
    ? doc(db, `artifacts/${appId}/users/${userId}/habitLogs`, logForToday.id)
    : doc(collection(db, `artifacts/${appId}/users/${userId}/habitLogs`));

  const normalized = normalizeStatus(status);

  await setDoc(
    logRef,
    { userId, habitId, date: todayStr, status: normalized },
    { merge: true }
  );

  const prevNorm = normalizeStatus(logForToday?.status);

  if (normalized === 'completed' && prevNorm !== 'completed') {
    await addXP(habitId);
    await updateStreak(habitId, 'increment');
    await grantAchievement('first_habit');
  } else if (normalized === 'failed') {
    await updateStreak(habitId, 'reset');
  }

  await checkPerfectDayAchievement();
};

const addXP = async (habitId) => {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  const xpGained = XP_PER_DIFFICULTY[habit.difficulty] || 10;
  const currentXP = userProfile.xp || 0;
  const currentLevel = userProfile.level || 1;
  let newXP = currentXP + xpGained;
  let newLevel = currentLevel;
  const xpForNextLevel = XP_PER_LEVEL + (currentLevel - 1) * 20;
  if (newXP >= xpForNextLevel) {
    newLevel++;
    newXP -= xpForNextLevel;
    showToast(`Level Up! You've reached Level ${newLevel}!`);
  }
  await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`), { xp: newXP, level: newLevel });
};

const updateStreak = async (habitId, action) => {
  const habitRef = doc(db, `artifacts/${appId}/users/${userId}/habits`, habitId);
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  let newStreak = habit.streak || 0;

  if (action === 'increment') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLog = habitLogs[getDateString(yesterday)]?.[habitId];
    newStreak = isCompleted(yesterdayLog?.status) ? newStreak + 1 : 1;
  } else if (action === 'reset') {
    newStreak = 0;
  }

  const newBestStreak = Math.max(habit.bestStreak || 0, newStreak);
  await updateDoc(habitRef, { streak: newStreak, bestStreak: newBestStreak });
  if(newStreak >= 7) await grantAchievement('7_day_streak');
};

const checkPerfectDayAchievement = async () => {
  const today = new Date();
  const dayOfWeek = today.toLocaleString('en-US', { weekday: 'short' }).toLowerCase();
  const todayStr = getTodayString();

  const habitsForToday = habits.filter(h =>
    h.frequency?.days?.includes('everyday') || h.frequency?.days?.includes(dayOfWeek)
  );

  if (habitsForToday.length === 0) return;

  const allDone = habitsForToday.every(h => {
    const s = habitLogs[todayStr]?.[h.id]?.status;
    return isCompleted(s);
  });

  if (allDone) await grantAchievement('perfect_day');
};

const grantAchievement = async (achievementId) => {
  if (achievements.some(a => a.achievementId === achievementId)) return;
  await addDoc(collection(db, `artifacts/${appId}/users/${userId}/achievements`), {
    achievementId,
    dateEarned: new Date().toISOString()
  });
  showToast(`Achievement Unlocked: ${ACHIEVEMENTS_LIST[achievementId].name}!`);
};

const showAddHabitModal = (habitToEdit = null) => {
  const isEditing = !!habitToEdit;
  const modalHTML = `
    <div class="card rounded-lg w-full max-w-md mx-auto">
      <form id="habit-form" class="flex flex-col">
        <div class="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-bold">${isEditing ? 'Edit Habit' : 'Add New Habit'}</h3>
          <div class="flex gap-2">
            <input type="text" name="icon" placeholder="🎯" value="${habitToEdit?.icon || ''}" class="w-16 text-2xl text-center p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
            <input type="text" name="name" placeholder="Habit Name" value="${habitToEdit?.name || ''}" class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);" required>
          </div>
          <div>
            <label class="text-sm font-medium">Category</label>
            <select name="category" class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
              ${Object.entries(HABIT_CATEGORIES).map(([key, cat]) => `<option value="${key}" ${habitToEdit?.category === key ? 'selected' : ''}>${cat.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="text-sm font-medium">Difficulty</label>
            <select name="difficulty" class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
              <option value="easy" ${habitToEdit?.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
              <option value="medium" ${habitToEdit?.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="hard" ${habitToEdit?.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-medium mb-2 block">Frequency</label>
            <div class="flex flex-wrap gap-2 frequency-days">
              <button type="button" data-day="everyday" class="freq-btn p-2 rounded-md border text-sm">Everyday</button>
              ${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => `<button type="button" data-day="${d}" class="freq-btn p-2 rounded-md border w-10 text-sm capitalize">${d}</button>`).join('')}
            </div>
          </div>
          <div class="flex items-center">
            <input type="checkbox" id="exam-prep-toggle" name="isExamPrep" ${habitToEdit?.isExamPrep ? 'checked' : ''}>
            <label for="exam-prep-toggle" class="ml-2">Exam Preparation Habit</label>
          </div>
          <div id="exam-date-container" class="${habitToEdit?.isExamPrep ? '' : 'hidden'}">
            <label for="exam-date" class="text-sm font-medium">Exam Date</label>
            <input type="date" name="examDate" value="${habitToEdit?.examDate || ''}" class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
          </div>
        </div>
        <div class="p-4 flex justify-end gap-3" style="background-color: var(--background); border-top: 1px solid var(--card-border);">
          ${isEditing ? `<button type="button" id="delete-habit-btn" class="font-bold py-2 px-4 rounded-lg" style="color: var(--danger);">Delete</button>` : ''}
          <button type="button" class="cancel-btn font-bold py-2 px-4">Cancel</button>
          <button type="submit" class="text-white font-bold py-2 px-4 rounded-lg" style="background-color: var(--primary);">${isEditing ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </div>`;
  modalContainer.innerHTML = modalHTML;
  modalContainer.classList.remove('hidden');
  modalContainer.classList.add('flex');
  
  // Frequency button logic
  const freqContainer = modalContainer.querySelector('.frequency-days');
  const selectedDays = new Set(habitToEdit?.frequency?.days || ['everyday']);
  const updateFreqButtons = () => {
    freqContainer.querySelectorAll('.freq-btn').forEach(btn => {
      if (selectedDays.has(btn.dataset.day)) {
        btn.style.backgroundColor = 'var(--primary)';
        btn.style.color = 'var(--primary-foreground)';
      } else {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--foreground)';
      }
    });
  };
  freqContainer.addEventListener('click', e => {
    if (!e.target.classList.contains('freq-btn')) return;
    const day = e.target.dataset.day;
    if (day === 'everyday') {
      selectedDays.clear();
      selectedDays.add('everyday');
    } else {
      selectedDays.delete('everyday');
      if (selectedDays.has(day)) selectedDays.delete(day);
      else selectedDays.add(day);
    }
    updateFreqButtons();
  });
  updateFreqButtons();
  
  document.getElementById('exam-prep-toggle').addEventListener('change', (e) => {
    document.getElementById('exam-date-container').classList.toggle('hidden', !e.target.checked);
  });
  modalContainer.querySelector('.cancel-btn').addEventListener('click', closeModal);
  modalContainer.querySelector('#habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      icon: formData.get('icon'),
      category: formData.get('category'),
      difficulty: formData.get('difficulty'),
      frequency: { type: 'weekly', days: Array.from(selectedDays) },
      isExamPrep: formData.get('isExamPrep') === 'on',
      examDate: formData.get('examDate') || null,
      streak: habitToEdit?.streak || 0,
      bestStreak: habitToEdit?.bestStreak || 0,
      createdAt: habitToEdit?.createdAt || new Date().toISOString(),
    };

    const ref = isEditing 
      ? doc(db, `artifacts/${appId}/users/${userId}/habits`, habitToEdit.id)
      : collection(db, `artifacts/${appId}/users/${userId}/habits`);
    isEditing ? await updateDoc(ref, data) : await addDoc(ref, data);
    
    closeModal();
  });
  if (isEditing) {
    document.getElementById('delete-habit-btn').addEventListener('click', async () => {
      // Using a custom modal for confirmation instead of window.confirm
      if (await showConfirmModal('Are you sure you want to delete this habit and all its history? This action cannot be undone.')) {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/habits`, habitToEdit.id));
        // Also delete logs
        const logsQuery = query(collection(db, `artifacts/${appId}/users/${userId}/habitLogs`), where("habitId", "==", habitToEdit.id));
        const logsSnapshot = await getDocs(logsQuery);
        const batch = writeBatch(db);
        logsSnapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        showToast('Habit deleted.');
        closeModal();
      }
    });
  }
};

const showConfirmModal = (message) => {
  return new Promise((resolve) => {
    const modalHTML = `
      <div class="card rounded-lg w-full max-w-sm mx-auto p-6 text-center">
        <p class="mb-6">${message}</p>
        <div class="flex justify-center gap-4">
          <button id="confirm-cancel" class="font-bold py-2 px-6 rounded-lg">Cancel</button>
          <button id="confirm-ok" class="text-white font-bold py-2 px-6 rounded-lg" style="background-color: var(--danger);">Confirm</button>
        </div>
      </div>`;
    const confirmContainer = document.createElement('div');
    confirmContainer.className = 'fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4';
    confirmContainer.innerHTML = modalHTML;
    document.body.appendChild(confirmContainer);

    confirmContainer.querySelector('#confirm-ok').addEventListener('click', () => {
      confirmContainer.remove();
      resolve(true);
    });
    confirmContainer.querySelector('#confirm-cancel').addEventListener('click', () => {
      confirmContainer.remove();
      resolve(false);
    });
  });
};

const showAssignmentModal = (assignmentToEdit = null) => {
  const isEditing = !!assignmentToEdit;
  const modalHTML = `
    <div class="card rounded-lg w-full max-w-sm mx-auto">
      <form id="assignment-form" class="flex flex-col">
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-bold">${isEditing ? 'Edit Assignment' : 'Add Assignment'}</h3>
          <input name="title" placeholder="Assignment Title" value="${assignmentToEdit?.title || ''}" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
          <input name="subject" placeholder="Subject" value="${assignmentToEdit?.subject || ''}" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
          <input name="dueDate" type="date" value="${assignmentToEdit?.dueDate || ''}" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
        </div>
        <div class="p-4 flex justify-end gap-3" style="background-color: var(--background); border-top: 1px solid var(--card-border);">
          <button type="button" class="cancel-btn font-bold py-2 px-4">Cancel</button>
          <button type="submit" class="text-white font-bold py-2 px-4 rounded-lg" style="background-color: var(--primary);">${isEditing ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>`;
  modalContainer.innerHTML = modalHTML;
  modalContainer.classList.remove('hidden');
  modalContainer.classList.add('flex');
  modalContainer.querySelector('.cancel-btn').addEventListener('click', closeModal);
  modalContainer.querySelector('#assignment-form').addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      title: formData.get('title'),
      subject: formData.get('subject'),
      dueDate: formData.get('dueDate'),
      completed: assignmentToEdit?.completed || false,
    };
    const ref = isEditing 
      ? doc(db, `artifacts/${appId}/users/${userId}/assignments`, assignmentToEdit.id)
      : collection(db, `artifacts/${appId}/users/${userId}/assignments`);
    isEditing ? await updateDoc(ref, data) : await addDoc(ref, data);
    closeModal();
  });
};

const showGradeModal = () => {
  const modalHTML = `
    <div class="card rounded-lg w-full max-w-sm mx-auto">
      <form id="grade-form" class="flex flex-col">
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-bold">Log a Grade</h3>
          <input name="assessment" placeholder="e.g., Midterm Exam" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
          <input name="subject" placeholder="Subject" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
          <input name="grade" type="number" step="0.1" min="0" placeholder="Grade/Score (%)" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
          <input name="date" type="date" value="${getTodayString()}" required class="w-full p-2 rounded-md border" style="background-color: var(--background); border-color: var(--card-border);">
        </div>
        <div class="p-4 flex justify-end gap-3" style="background-color: var(--background); border-top: 1px solid var(--card-border);">
          <button type="button" class="cancel-btn font-bold py-2 px-4">Cancel</button>
          <button type="submit" class="text-white font-bold py-2 px-4 rounded-lg" style="background-color: var(--primary);">Log Grade</button>
        </div>
      </form>
    </div>`;
  modalContainer.innerHTML = modalHTML;
  modalContainer.classList.remove('hidden');
  modalContainer.classList.add('flex');
  modalContainer.querySelector('.cancel-btn').addEventListener('click', closeModal);
  modalContainer.querySelector('#grade-form').addEventListener('submit', async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      assessment: formData.get('assessment'),
      subject: formData.get('subject'),
      grade: parseFloat(formData.get('grade')),
      date: formData.get('date'),
    };
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/grades`), data);
    closeModal();
  });
};

const closeModal = () => {
  modalContainer.innerHTML = '';
  modalContainer.classList.add('hidden');
  modalContainer.classList.remove('flex');
};

const populateHabitSelector = () => {
  const selector = document.getElementById('habit-analytics-selector');
  const currentVal = selector.value;
  selector.innerHTML = '<option value="">-- Select a Habit for Deep Dive --</option>';
  habits.forEach(h => {
    selector.innerHTML += `<option value="${h.id}" ${h.id === currentVal ? 'selected': ''}>${h.name}</option>`;
  });
};

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function renderCorrelationChart() {
  const canvas = document.getElementById('correlation-chart');
  if (!canvas) return;

  setFixedChartSize(canvas, 320);
  const ctx = canvas.getContext('2d');
  if (correlationChartInstance) correlationChartInstance.destroy();
  correlationChartInstance = null;

  // Use real grades if any, else sample data
  const hasGrades = grades && grades.length > 0;
  const displayGrades = hasGrades ? grades : SAMPLE_GRADES;
  const displayMoods = hasGrades ? userProfile.moods : SAMPLE_MOODS;
  const displaySleep = hasGrades ? sleepLogs : SAMPLE_SLEEP;

  const sortedGrades = [...displayGrades].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedGrades.length === 0) return;

  const labels = sortedGrades.map(g => g.date);
  const colPrimary = cssVar('--primary');
  const colWarning = cssVar('--warning');
  const colAccent = cssVar('--accent');
  const moodMap = { sad: 1, neutral: 2, happy: 3 };

  // Build chart data as before
  const moodData = labels.map(d => displayMoods[d] ? moodMap[displayMoods[d]] : null);
  const sleepData = labels.map(d => displaySleep[d] || null);

  // If using sample data, show an info message
  const infoMsg = document.getElementById('analytics-info-message');
  if (infoMsg) {
    if (!hasGrades) {
      infoMsg.textContent = 'No grades logged yet. Displaying sample chart!';
      infoMsg.style.display = 'block';
    } else {
      infoMsg.style.display = 'none';
    }
  }

  correlationChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Grade', data: sortedGrades.map(g => g.grade), borderColor: colPrimary, yAxisID: 'y', tension: 0.1, fill: false },
        { label: 'Mood', data: moodData, borderColor: colWarning, yAxisID: 'y1', tension: 0.1, fill: false, spanGaps: true },
        { label: 'Sleep hours', data: sleepData, borderColor: colAccent, yAxisID: 'y1', tension: 0.1, fill: false, spanGaps: true }
      ]
    },
    options: {
      responsive: false, maintainAspectRatio: false,
      devicePixelRatio: 1, animation: false,
      scales: {
        x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM d' } },
        y: { position: 'left', title: { display: true, text: 'Grade' }, min: 0, max: 100 },
        y1: { position: 'right', title: { display: true, text: 'Mood / Sleep' }, grid: { drawOnChartArea: false }, min: 0 }
      },
      plugins: { legend: { display: true } }
    }
  });
}



const renderTrendChart = (habitId) => {
  const canvas = document.getElementById('trends-chart');
  if (!canvas) return;

  // 1) Hard-lock canvas size to avoid responsive loops
  setFixedChartSize(canvas, 220);
  const ctx = canvas.getContext('2d');

  // 2) Destroy any existing instance (double safety)
  const existing = Chart.getChart ? Chart.getChart(canvas) : trendsChartInstance;
  if (existing) {
    existing.destroy();
  }
  trendsChartInstance = null;

  // 3) Build 30-day points
  const today = new Date();
  const points = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const log = habitLogs[ds]?.[habitId];
    const y = isCompleted(log?.status) ? 1 : (log ? 0 : null);
    points.push({ x: ds, y });
  }

  const colAccent = cssVar('--accent');
  const colDanger = cssVar('--danger');
  const bgColors = points.map(p => (p.y === 1 ? colAccent : colDanger));

  // 4) Render with responsive disabled and fixed devicePixelRatio
  trendsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      datasets: [{
        label: 'Completion Status',
        data: points,
        backgroundColor: bgColors,
        borderColor: cssVar('--card-border'),
        borderWidth: 1,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' }
      }]
    },
    options: {
      responsive: false,              // critical
      maintainAspectRatio: false,     // rely on our fixed height
      devicePixelRatio: 1,            // avoid DPI multiplying height
      animation: false,
      resizeDelay: 0,
      scales: {
        x: { type: 'time', time: { unit: 'day', tooltipFormat: 'MMM d' } },
        y: { display: false, suggestedMin: 0, suggestedMax: 1 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.parsed.y === 1 ? 'Completed' : 'Not Completed'
          }
        }
      }
    }
  });
};



const renderHeatmap = (habitId) => {
  const container = document.getElementById('heatmap-container');
  if (!container) return; // Guard check FIRST
  
  // Clear previous heatmap
  container.innerHTML = '';
  
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  // Create grid layout
  const gridHTML = [];
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), i);
    const dateStr = getDateString(date);
    const log = habitLogs[dateStr]?.[habitId];
    
    let bgColor;
    let status;
    
    if (isCompleted(log?.status)) { bgColor = cssVar('--accent'); status = 'Completed'; } 
    else if (isSkipped(log?.status)) { bgColor = cssVar('--secondary'); status = 'Skipped'; } 
    else if (isFailed(log?.status)) { bgColor = cssVar('--danger'); status = 'Failed'; } 
    else { bgColor = cssVar('--card-border'); status = 'No data'; }
    
    gridHTML.push(`
      <div 
        class="heatmap-cell w-full aspect-square rounded cursor-pointer transition-transform hover:scale-110" 
        style="background-color: ${bgColor};" 
        title="${dateStr}: ${status}"
        data-date="${dateStr}">
      </div>
    `);
  }
  
  container.innerHTML = gridHTML.join('');
};

window.onload = () => {
  initializeFirebase();
  
  document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-icon-sun').classList.toggle('hidden', !isDark);
    document.getElementById('theme-icon-moon').classList.toggle('hidden', isDark);
  });
  // Tab Listeners
  document.getElementById('tab-dashboard').addEventListener('click', () => switchView('dashboard-view'));
  document.getElementById('tab-study').addEventListener('click', () => switchView('study-view'));
  document.getElementById('tab-analytics').addEventListener('click', () => switchView('analytics-view'));
  document.getElementById('tab-rewards').addEventListener('click', () => switchView('rewards-view'));
  // Main Action Listeners
  document.getElementById('add-habit-btn').addEventListener('click', () => showAddHabitModal());
  document.getElementById('add-assignment-btn').addEventListener('click', () => showAssignmentModal());
  document.getElementById('add-grade-btn').addEventListener('click', showGradeModal);
  // Pomodoro Listeners
  document.getElementById('pomodoro-start-btn').addEventListener('click', startPausePomodoro);
  document.getElementById('pomodoro-reset-btn').addEventListener('click', resetPomodoro);
  document.getElementById('pomodoro-work-btn').addEventListener('click', () => switchPomodoroMode('work'));
  document.getElementById('pomodoro-short-break-btn').addEventListener('click', () => switchPomodoroMode('shortBreak'));
  document.getElementById('pomodoro-long-break-btn').addEventListener('click', () => switchPomodoroMode('longBreak'));
  // Daily Check-in
  document.getElementById('mood-tracker').addEventListener('click', (e) => { if(e.target.dataset.mood) setMentalHealthValue('moods', e.target.dataset.mood) });
  document.getElementById('stress-tracker').addEventListener('click', (e) => { if(e.target.dataset.stress) setMentalHealthValue('stress', e.target.dataset.stress) });
  document.getElementById('save-sleep-btn').addEventListener('click', saveSleepHours);
  // Analytics
  document.getElementById('habit-analytics-selector').addEventListener('change', (e) => {
    const habitId = e.target.value;
    const container = document.getElementById('deep-dive-content');
    if (habitId) {
      container.classList.remove('hidden');
      renderTrendChart(habitId);
      renderHeatmap(habitId);
    } else {
      container.classList.add('hidden');
    }
  });
  document.getElementById('assignment-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-assignment-btn')) {
      updateDoc(doc(db, `artifacts/${appId}/users/${userId}/assignments`, e.target.dataset.id), { completed: true });
    }
  });
  document.getElementById('gpa-target-input').addEventListener('change', (e) => {
    updateDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`), { targetGpa: parseFloat(e.target.value) });
  });
  // Profile avatar click to sign in with Google
  document.getElementById('user-avatar').addEventListener('click', async () => {
    if (!auth.currentUser) {
      // User not signed in, show Google login
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error("Sign in failed:", error);
      }
    } else {
      // User already signed in, could show profile options or sign out
      const signOut = await showConfirmModal(
        `Signed in as ${auth.currentUser.displayName || auth.currentUser.email}. Do you want to sign out?`
      );
      if (signOut) {
        await auth.signOut();
        showToast("Signed out successfully");
        // Reset avatar to default
        document.getElementById('user-avatar').src = 
          'https://placehold.co/40x40/cbd5e1/7c3aed?text=?';
        document.getElementById('user-level').innerText = 'Level 1';
      }
    }
  });

  // Add cursor pointer to avatar to show it's clickable
  document.getElementById('user-avatar').style.cursor = 'pointer';

};

// Sticky Notes Feature
const stickyNotesList = document.getElementById('sticky-notes-list');
const stickyNoteInput = document.getElementById('sticky-note-input');
const addStickyNoteBtn = document.getElementById('add-sticky-note-btn');
// Local storage KEY
const STICKY_NOTES_KEY = 'daily-dost-study-sticky-notes';

function loadStickyNotes() {
  stickyNotesList.innerHTML = '';
  const notes = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) || '[]');
  notes.forEach((note, idx) => {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'flex items-center gap-2 card p-2 bg-yellow-100 dark:bg-gray-900 rounded-md';
    noteDiv.innerHTML = `
      <span class="flex-1 text-sm">${note}</span>
      <button class="text-xs px-2 py-1 rounded hover:bg-red-400 text-red-600 dark:text-red-300" data-idx="${idx}">Delete</button>
    `;
    noteDiv.querySelector('button').onclick = function() {
      deleteStickyNote(this.getAttribute('data-idx'));
    };
    stickyNotesList.appendChild(noteDiv);
  });
}

function addStickyNote() {
  const note = stickyNoteInput.value.trim();
  if (!note) return;
  const notes = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) || '[]');
  notes.push(note);
  localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(notes));
  stickyNoteInput.value = '';
  loadStickyNotes();
}

function deleteStickyNote(idx) {
  const notes = JSON.parse(localStorage.getItem(STICKY_NOTES_KEY) || '[]');
  notes.splice(idx, 1);
  localStorage.setItem(STICKY_NOTES_KEY, JSON.stringify(notes));
  loadStickyNotes();
}

if (addStickyNoteBtn && stickyNoteInput && stickyNotesList) {
  addStickyNoteBtn.addEventListener('click', addStickyNote);
  stickyNoteInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addStickyNote();
  });
  loadStickyNotes();
}

// Calculator Feature
const calcDisplay = document.getElementById('calc-display');
const calcBtns = document.querySelectorAll('.calc-btn');
let calcInput = '';

function updateCalcDisplay() {
  calcDisplay.value = calcInput || '0';
}

function handleCalcBtn(e) {
  const val = e.target.getAttribute('data-val');
  if (val !== null) {
    calcInput += val;
    updateCalcDisplay();
  }
}

function clearCalc() {
  calcInput = '';
  updateCalcDisplay();
}

function evalCalc() {
  try {
    let result = eval(calcInput.replace(/÷/g, '/').replace(/×/g, '*'));
    calcInput = String(result);
    updateCalcDisplay();
  } catch {
    calcInput = '';
    calcDisplay.value = 'Error';
  }
}

calcBtns.forEach(btn => {
  if (btn.id === 'calc-clear') {
    btn.onclick = clearCalc;
  } else if (btn.id === 'calc-equals') {
    btn.onclick = evalCalc;
  } else {
    btn.onclick = handleCalcBtn;
  }
});

updateCalcDisplay();

const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Show success message
    showToast(`Welcome, ${user.displayName}!`);
    
    // Update UI with user info
    updateUserProfile(user);
    
    return user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    showToast("Failed to sign in with Google");
    throw error;
  }
};
const updateUserProfile = async (user) => {
  if (!user || user.isAnonymous) {
    // For anonymous users, set generic avatar
    const avatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userLevel = document.getElementById('user-level');
    
    if (avatar) avatar.src = 'https://ui-avatars.com/api/?name=Guest&background=667eea&color=fff&size=128';
    if (userName) userName.innerText = 'Guest User';
    if (userLevel) userLevel.innerText = `Level ${userProfile.level || 1}`;
    return;
  }
  
  // Update UI with Google account info
  const displayName = user.displayName || 'User';
  const photoURL = user.photoURL || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128`;
  
  const avatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userLevel = document.getElementById('user-level');
  
  // Null checks to prevent errors
  if (avatar) avatar.src = photoURL;
  if (userName) userName.innerText = displayName;
  if (userLevel) userLevel.innerText = `Level ${userProfile.level || 1}`;
  
  // Sync to Firestore for cross-device persistence
  try {
    const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/userProfile`);
    await setDoc(profileRef, {
      displayName: displayName,
      photoURL: photoURL,
      email: user.email,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    
    console.log('Profile synced to Firestore');
  } catch (error) {
    console.error('Error syncing profile:', error);
  }
};

// ============================================
// ANIMATION ENHANCEMENTS (Add to end of app.js)
// ============================================

// Initialize Anime.js Animations
const initAnimeAnimations = () => {
  // Animate cards on page load
  anime({
    targets: '.card',
    opacity: [0, 1],
    translateY: [40, 0],
    delay: anime.stagger(100),
    duration: 800,
    easing: 'easeOutCubic'
  });

  // Animate habit items
  anime({
    targets: '.habit-item',
    opacity: [0, 1],
    translateX: [-30, 0],
    delay: anime.stagger(80),
    duration: 600,
    easing: 'easeOutExpo'
  });

  // Animate progress items
  anime({
    targets: '.progress-item',
    opacity: [0, 1],
    translateY: [30, 0],
    delay: anime.stagger(100, {start: 200}),
    duration: 700,
    easing: 'easeOutCubic'
  });
};

// Initialize GSAP Animations
const initGSAPAnimations = () => {
  // Register ScrollTrigger
  gsap.registerPlugin(ScrollTrigger);

  // XP Bar fill animation
  const xpBar = document.getElementById('xp-bar');
  if (xpBar) {
    gsap.from(xpBar, {
      width: 0,
      duration: 1.5,
      ease: 'power2.out',
      delay: 0.5
    });
  }

  // Magnetic effect for buttons
  document.querySelectorAll('.btn-animate').forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
      gsap.to(btn, {
        scale: 1.05,
        duration: 0.3,
        ease: 'power2.out'
      });
    });

    btn.addEventListener('mouseleave', (e) => {
      gsap.to(btn, {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out'
      });
    });
  });
};

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initAnimeAnimations();
    initGSAPAnimations();
  }, 100);
});

// Separate function for animations
const animateDashboardItems = () => {
  setTimeout(() => {
    anime({
      targets: '.habit-item',
      opacity: [0, 1],
      translateX: [-20, 0],
      delay: anime.stagger(60),
      duration: 500,
      easing: 'easeOutExpo'
    });
  }, 50);
};

// Add success animation when habit is completed
const animateHabitCompletion = (element) => {
  anime({
    targets: element,
    scale: [1, 1.1, 1],
    duration: 600,
    easing: 'easeInOutQuad',
    complete: () => {
      gsap.to(element, {
        x: window.innerWidth,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.in'
      });
    }
  });
};

// Enhanced toast animation
const animateToast = (toast) => {
  setTimeout(() => {
    anime({
      targets: toast,
      translateY: [50, 0],
      opacity: [0, 1],
      duration: 500,
      easing: 'easeOutCubic'
    });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      anime({
        targets: toast,
        translateY: [0, -50],
        opacity: [1, 0],
        duration: 400,
        easing: 'easeInCubic',
        complete: () => toast.remove()
      });
    }, 3000);
  }, 50);
};
// Skip GSAP/anime entrance animations inside analytics view to avoid layout thrash
const analyticsView = document.getElementById('analytics-view');
if (analyticsView) {
  analyticsView.querySelectorAll('.card').forEach(el => {
    el.classList.remove('card-hover');
  });
}

console.log('🎨 Animation enhancements loaded!');
