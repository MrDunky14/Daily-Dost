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

// --- Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, 
  onAuthStateChanged, linkWithPopup, signInWithCredential, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { 
  getFirestore, doc, setDoc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, collection, query, writeBatch, getDocs, where, getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- App State ---
let app, db, auth, userId;
let habits = [], habitLogs = {}, achievements = [], assignments = [], grades = [], sleepLogs = {}, stickyNotes = [], expenses = [];
let userProfile = { level: 1, xp: 0, targetGpa: 3.5, dailyLimit: 200 };
let currentView = 'dashboard-view';
let pomodoro = { timerId: null, mode: 'work', timeLeft: 1500, isRunning: false, completedCycles: 0 };
let correlationChartInstance, trendsChartInstance;
let wakeLock = null;
let audioCtx = null;
let currentSource = null;
let gainNode = null;
let shouldAutoLogin = true;

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
  'night_owl': { name: 'Night Owl', description: 'Complete a habit after 10 PM.', icon: '🦉' },
  'early_bird': { name: 'Early Bird', description: 'Complete a habit before 7 AM.', icon: '🌅' },
  'weekend_warrior': { name: 'Weekend Warrior', description: 'Complete a habit on a weekend.', icon: '🎉' },
  'math_whiz': { name: 'Math Whiz', description: 'Use the calculator.', icon: '🧮' },
  'grade_guru': { name: 'Grade Guru', description: 'Log your first grade.', icon: '📝' },
  'bunk_master': { name: 'Strategist', description: 'Use the Bunk-o-Meter.', icon: '📉' },
};

// --- Utility Functions ---
const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// Force a fixed size for a Chart.js canvas that shows the full graph
const setFixedChartSize = (canvas, heightPx) => {
  if (!canvas) return;
  const parent = canvas.parentElement;

  // Ensure parent is relative for Chart.js responsiveness
  if (parent) {
    parent.style.position = 'relative';
    // We don't force height on parent, let Chart.js handle aspect ratio or fixed height
  }
  
  // We rely on Chart.js 'maintainAspectRatio: false' and CSS height on canvas container
  // This function might be redundant if we use CSS properly, but let's keep it for legacy support
  // or specific resizing needs.
  
  // If we want to force a height:
  if (heightPx) {
      canvas.style.height = `${heightPx}px`;
  }
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

const showToast = (message, type = 'info') => {
  // Ensure container exists
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-3 pointer-events-none';
    document.body.appendChild(container);
  }

  // Define styles based on type
  const styles = {
    success: { icon: 'check_circle', color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/10' },
    error: { icon: 'error', color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10' },
    warning: { icon: 'warning', color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
    info: { icon: 'info', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' }
  };

  // Auto-detect type from message keywords if type is default 'info'
  if (type === 'info') {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('success') || lowerMsg.includes('complete') || lowerMsg.includes('level up') || lowerMsg.includes('unlocked')) type = 'success';
    else if (lowerMsg.includes('fail') || lowerMsg.includes('error') || lowerMsg.includes('wrong')) type = 'error';
    else if (lowerMsg.includes('warn') || lowerMsg.includes('broken')) type = 'warning';
  }

  const style = styles[type] || styles.info;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-md border shadow-lg min-w-[300px] max-w-sm transform translate-y-10 opacity-0 ${style.bg} ${style.border} border`;
  toast.innerHTML = `
    <span class="material-symbols-outlined ${style.color} text-xl">${style.icon}</span>
    <p class="text-sm font-medium text-white/90 flex-1">${message}</p>
    <button class="text-white/50 hover:text-white transition-colors">
      <span class="material-symbols-outlined text-lg">close</span>
    </button>
  `;

  container.appendChild(toast);

  // Animate In
  if (typeof anime !== 'undefined') {
    anime({
      targets: toast,
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOutElastic(1, .8)'
    });
  } else {
    // Fallback if anime is not loaded yet
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }

  // Close handler
  const close = () => {
    if (typeof anime !== 'undefined') {
      anime({
        targets: toast,
        translateX: [0, 50],
        opacity: [1, 0],
        duration: 300,
        easing: 'easeInCubic',
        complete: () => toast.remove()
      });
    } else {
      toast.remove();
    }
  };

  toast.querySelector('button').onclick = close;

  // Auto dismiss
  setTimeout(close, 4000);
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
  
  // Bottom navigation: ensure active state visually follows the selected view
  const activeClasses = ['bg-primary/20', 'text-primary', 'shadow-[0_0_15px_rgba(139,92,246,0.3)]', 'border-primary/30'];
  const inactiveClasses = ['text-text-muted', 'hover:text-white', 'hover:bg-white/5', 'border-transparent'];

  document.querySelectorAll('.tab-btn').forEach(btn => {
    // Reset to inactive state
    btn.classList.remove(...activeClasses);
    btn.classList.add(...inactiveClasses);
  });
  
  const activeTab = document.getElementById(`tab-${viewId.split('-')[0]}`);
  if (activeTab) {
    activeTab.classList.remove(...inactiveClasses);
    activeTab.classList.add(...activeClasses);
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
        const syncText = document.getElementById('sync-status-text');

        if (!user.isAnonymous) {
          const { isNew } = await updateUserProfile(user);
          if (isNew) {
             showAvatarPickerModal();
          }
          if(syncText) syncText.innerText = "Cloud Sync Active • All Data Secured";
          document.getElementById('cloud-sync-btn')?.classList.add('hidden');
        } else {
          // Set generic avatar for anonymous users
          document.getElementById('user-avatar').src = 'https://ui-avatars.com/api/?name=Guest&background=667eea&color=fff&size=128';
          
          // Show cloud sync button in header
          const cloudBtn = document.getElementById('cloud-sync-btn');
          if (cloudBtn) {
              cloudBtn.classList.remove('hidden');
              cloudBtn.onclick = () => showLoginModal(false);
          }
          
          if(syncText) syncText.innerText = "Guest Mode • Data on this device only";
        }
        setupListeners();
        loadingOverlay.classList.add('hidden');
      } else {
        // No user is signed in.
        if (shouldAutoLogin) {
            console.log("No user found. Signing in anonymously...");
            try {
              await signInAnonymously(auth);
            } catch (error) {
              console.error("Anonymous sign-in failed:", error);
              showToast("Authentication failed. Please refresh.");
              loadingOverlay.classList.add('hidden');
            }
        } else {
            console.log("Manual logout detected. Waiting for user action.");
            loadingOverlay.classList.add('hidden');
            showLoginModal(true); // Show modal with Guest option
        }
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
// Close modal when clicking outside content
document.addEventListener('DOMContentLoaded', () => {
  const userAvatar = document.getElementById('user-avatar');
  if (userAvatar) {
    userAvatar.addEventListener('click', handleProfileClick);
  }

  // Event delegation for all modals (single listener, no conflicts)
  document.addEventListener('click', (e) => {
    // Only handle modal overlay clicks, not content clicks
    if (e.target.classList.contains('modal-overlay')) {
      e.target.remove(); // Close modal
    }
  }, { 
    capture: false,  // Use bubbling phase
    once: false      // Listen for all clicks
  });
});

const handleSignOut = async () => {
  try {
    shouldAutoLogin = false; // Prevent auto-login as anonymous
    userId = null;
    habits = [];
    habitLogs = {};
    // Reset user profile to defaults to prevent pollution
    userProfile = { level: 1, xp: 0, targetGpa: 3.5, dailyLimit: 200 };
    
    await auth.signOut();
    console.log('Signed out successfully');
    showToast('Signed out');
    
    // Show login modal immediately
    showLoginModal(true); // true = force mode (no close button or guest option initially)
    
  } catch (error) {
    console.error('Sign-out error:', error);
    showToast('Failed to sign out');
    shouldAutoLogin = true; // Reset flag on error
  }
};

function handleProfileClick() {
  if (!auth.currentUser) {
    showToast('App loading...');
    return;
  }

  if (auth.currentUser.isAnonymous) {
    showLoginModal(false);
  }
}

// Placeholder for migration if needed in future
const migrateAnonymousData = async (uid) => {
  // For account linking, UID remains same, so no migration needed.
  // If switching accounts, we would copy collections here.
  console.log('Data migration check complete for:', uid);
};

const handleGoogleSignIn = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    // CASE 1: User is NOT logged in (Clean Sign In)
    if (!auth.currentUser) {
        const result = await signInWithPopup(auth, provider);
        const googleUser = result.user;
        
        // Update profile
        await updateUserProfile(googleUser);
        
        // Close modal
        document.getElementById('signin-modal')?.remove();
        showToast('Welcome back!');
        shouldAutoLogin = true; // Re-enable auto-login
        return;
    }
    
    // CASE 2: User is Anonymous (Link Account)
    // Attempt to link Google to anonymous account
    const result = await linkWithPopup(auth.currentUser, provider);
    const googleUser = result.user;

    console.log('Account linked successfully');

    // 1. Migrate anonymous data to Google account
    await migrateAnonymousData(googleUser.uid);

    // 2. Update profile with Google data
    const success = await updateUserProfile(googleUser);

    if (success) {
      // 3. Close modal and refresh UI
      const modal = document.getElementById('signin-modal');
      modal?.remove();
      
      // Reload data listeners to ensure Firestore data syncs
      setupListeners();
      
      showToast('Google account connected!');
    }
  } catch (error) {
    if (error.code === 'auth/credential-already-in-use') {
      try {
        // Account exists, so sign in to it instead of linking
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (credential) {
          await signInWithCredential(auth, credential);
        } else {
          // Fallback: Force a fresh sign-in
          await signInWithPopup(auth, new GoogleAuthProvider());
        }
        
        // Close modal on success
        document.getElementById('signin-modal')?.remove();
        showToast('Welcome back!');
        shouldAutoLogin = true;
        
        // Note: onAuthStateChanged will handle the rest
      } catch (signInError) {
        console.error('Re-sign in failed:', signInError);
        showToast('Login failed. Please try again.');
      }
    } else {
      handleLinkingError(error);
    }
  }
};

const handleLinkingError = (error) => {
  console.error('Linking error:', error.code, error.message);

  // Handle specific Firebase errors
  if (error.code === 'auth/credential-already-in-use') {
    showToast('This Google account is already linked to another account');
  } else if (error.code === 'auth/invalid-credential') {
    showToast('Sign-in was cancelled');
  } else if (error.code === 'auth/operation-not-supported-in-this-environment') {
    // Fallback for popups in certain environments
    handleGoogleSignInWithRedirect();
  } else {
    showToast(`Error: ${error.message}`);
  }
};

// Create modal without inline handlers
function createSignInModal(isForced = false) {
  const div = document.createElement('div');
  div.className = 'modal-content p-6 max-w-sm w-full mx-4 text-center';
  div.id = 'signin-modal';
  
  const closeBtn = isForced ? '' : '<button id="modal-close" class="btn-close">&times;</button>';
  const guestBtn = isForced ? '<button id="guest-signin-btn" class="mt-4 text-sm text-gray-500 hover:text-gray-700 underline">Continue as Guest</button>' : '';
  const title = isForced ? 'Welcome to Daily Dost' : 'Sign In with Google';
  const desc = isForced ? 'Sign in to save your progress or continue as a guest.' : 'Sync data across devices and never lose progress!';

  div.innerHTML = `
      ${closeBtn}
      <h2 class="text-xl font-bold mb-2">${title}</h2>
      <p class="text-sm text-gray-500 mb-6">${desc}</p>
      <button id="google-signin-btn" class="btn-animate w-full py-3 rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 font-semibold shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-3">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Sign In with Google
      </button>
      ${guestBtn}
  `;
  return div;
}

function showLoginModal(isForced = false) {
    // Remove existing modal if any
    document.getElementById('signin-modal')?.remove();
    
    const modalElement = createSignInModal(isForced);
    modalContainer.appendChild(modalElement);
    
    // Attach listeners
    const googleBtn = modalElement.querySelector('#google-signin-btn');
    googleBtn?.addEventListener('click', handleGoogleSignIn);
    
    if (isForced) {
        const guestBtn = modalElement.querySelector('#guest-signin-btn');
        guestBtn?.addEventListener('click', async () => {
            loadingOverlay.classList.remove('hidden');
            modalElement.remove();
            shouldAutoLogin = true; // Re-enable auto-login
            try {
                await signInAnonymously(auth);
            } catch (e) {
                console.error(e);
                loadingOverlay.classList.add('hidden');
                showToast("Guest login failed");
                showLoginModal(true); // Show again
            }
        });
    } else {
        const closeBtn = modalElement.querySelector('#modal-close');
        closeBtn?.addEventListener('click', () => {
            modalElement.remove();
        });
    }
}

// Create user doc in Firestore with profile data
const createUserDocument = async (user) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      // New user
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || null,
        isAnonymous: user.isAnonymous,
        createdAt: new Date().toISOString(),
        lastSignIn: new Date().toISOString(),
        settings: {
          theme: 'dark',
          notifications: true
        }
      });
    } else {
      // Update sign-in timestamp
      await updateDoc(userRef, {
        lastSignIn: new Date().toISOString(),
        displayName: user.displayName,
        photoURL: user.photoURL
      });
    }
  } catch (error) {
    console.error('Firestore user doc error:', error);
  }
};

const checkWeeklyAchievementReset = async () => {
  if (!userProfile || !achievements) return;
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 1 is Monday
  const todayStr = getTodayString();
  
  // Only run on Monday
  if (dayOfWeek === 1) {
      // Check if we already reset today
      if (userProfile.lastAchievementResetDate === todayStr) return;
      
      console.log("Monday detected. Checking for weekly achievement reset...");
      
      // Filter achievements to delete (keep 7_day_streak)
      // Also keeping 'first_habit' or other one-time milestones might be desired, 
      // but user said "achievements to reset every monday", implying weekly goals.
      // Week Warrior (7_day_streak) is explicitly excluded by user request.
      const toDelete = achievements.filter(a => a.achievementId !== '7_day_streak');
      
      if (toDelete.length > 0) {
          const batch = writeBatch(db);
          toDelete.forEach(a => {
              batch.delete(doc(db, `artifacts/${appId}/users/${userId}/achievements`, a.id));
          });
          
          // Update profile to prevent re-run
          const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
          batch.set(profileRef, { lastAchievementResetDate: todayStr }, { merge: true });
          
          await batch.commit();
          showToast("New Week! Achievements have been reset. 🚀");
      } else {
           // Just update the date if nothing to delete to avoid checking again
           const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
           await setDoc(profileRef, { lastAchievementResetDate: todayStr }, { merge: true });
      }
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
    stickyNotes: `artifacts/${appId}/users/${userId}/stickyNotes`,
    expenses: `artifacts/${appId}/users/${userId}/expenses`,
  };

  onSnapshot(doc(db, collections.profile), (docSnap) => {
    if (docSnap.exists()) {
      userProfile = { ...userProfile, ...docSnap.data() };
      checkWeeklyAchievementReset();
      // Apply theme from Firestore
      if (userProfile.settings?.theme) {
        const theme = userProfile.settings.theme;
        document.documentElement.setAttribute('data-theme', theme);
        const isDark = theme === 'dark';
        const sunIcon = document.getElementById('theme-icon-sun');
        const moonIcon = document.getElementById('theme-icon-moon');
        const themeText = document.getElementById('theme-text');
        if (sunIcon && moonIcon) {
            sunIcon.classList.toggle('hidden', isDark);
            moonIcon.classList.toggle('hidden', !isDark);
        }
        if (themeText) {
            themeText.textContent = theme === 'dark' ? 'NIGHT' : 'DAY';
        }
      }
    }
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
    checkWeeklyAchievementReset();
  });
  onSnapshot(query(collection(db, collections.assignments)), (snap) => {
    assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAssignments();
  });
  onSnapshot(query(collection(db, collections.grades)), (snap) => {
    grades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if(currentView === 'analytics-view') renderAnalytics();
  });
  onSnapshot(query(collection(db, collections.sleepLogs)), (snap) => {
    sleepLogs = {};
    snap.docs.forEach(d => sleepLogs[d.id] = d.data().hours);
    renderSleepTracker();
    if(currentView === 'analytics-view') renderAnalytics();
  });
  onSnapshot(query(collection(db, collections.stickyNotes)), (snap) => {
    stickyNotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStickyNotes();
  });
  onSnapshot(query(collection(db, collections.expenses)), (snap) => {
    expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderFinance();
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
  renderFinance();
  animateDashboardItems();
};

const renderAnalytics = () => {
  document.getElementById('gpa-target-input').value = userProfile.targetGpa || 3.5;
  populateHabitSelector();
  renderCorrelationChart();
};

const updateGreeting = () => {
    const hour = new Date().getHours();
    let greeting = 'Hello';
    if (hour < 5) greeting = 'Good Night';
    else if (hour < 12) greeting = 'Good Morning';
    else if (hour < 18) greeting = 'Good Afternoon';
    else greeting = 'Good Evening';
    
    const greetingText = document.getElementById('greeting-text');
    const greetingUser = document.getElementById('greeting-user');
    
    if (greetingText) greetingText.innerText = greeting;
    if (greetingUser) greetingUser.innerText = userProfile.displayName ? userProfile.displayName.split(' ')[0] : 'Friend';
};

const renderUserProfile = () => {
  const { level = 1, xp = 0, displayName, photoURL } = userProfile;
  const xpForNextLevel = XP_PER_LEVEL + (level - 1) * 20;
  const xpPercentage = Math.min(100, (xp / xpForNextLevel) * 100);

  updateGreeting();

  document.getElementById('user-level').innerText = `Level ${level}`;
  document.getElementById('xp-text').innerText = `${xp}/${xpForNextLevel} XP`;
  
  // Update Circular XP Ring
  const xpRing = document.getElementById('xp-ring-circle');
  if (xpRing) {
      const offset = 100 - xpPercentage;
      xpRing.setAttribute('stroke-dashoffset', offset);
  } else {
      const xpBar = document.getElementById('xp-bar');
      if(xpBar) xpBar.style.width = `${xpPercentage}%`;
  }

  // Update UI with profile data
  if (displayName) {
      const nameEl = document.getElementById('user-name');
      if(nameEl) nameEl.innerText = displayName;
  }
  
  if (photoURL) {
      const avatarEl = document.getElementById('user-avatar');
      if(avatarEl) avatarEl.src = photoURL;
  }
  if (photoURL) document.getElementById('user-avatar').src = photoURL;
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
  // SVG path uses r="15.9155" so circumference = 2 * π * 15.9155 ≈ 100
  const circumference = 100;
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
    // Remove all mood-specific active classes first
    btn.classList.remove('bg-danger/20', 'border-danger', 'bg-accent/20', 'border-accent', 'bg-tertiary/15', 'border-tertiary/60', 'shadow-neon-tertiary');
    btn.classList.add('bg-white/10', 'border-glass-border');
    
    if (isSelected) {
      btn.classList.remove('bg-white/10', 'border-glass-border');
      if (btn.dataset.mood === 'sad') {
        btn.classList.add('bg-danger/20', 'border-danger');
      } else if (btn.dataset.mood === 'neutral') {
        btn.classList.add('bg-accent/20', 'border-accent');
      } else if (btn.dataset.mood === 'happy') {
        btn.classList.add('bg-tertiary/15', 'border-tertiary/60', 'shadow-neon-tertiary');
      }
    }
  });

  document.querySelectorAll('.stress-btn').forEach(btn => {
    const isSelected = btn.dataset.stress === todaysStress;
    // Remove active class
    btn.classList.remove('bg-primary', 'text-white', 'shadow-neon');
    btn.classList.add('text-text-muted');
    
    if (isSelected) {
      btn.classList.remove('text-text-muted');
      btn.classList.add('bg-primary', 'text-white', 'shadow-neon');
    }
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
    const currentCycles = typeof pomodoro.completedCycles === "number" ? pomodoro.completedCycles : 0;
    cyclesElem.textContent = `Cycles: ${currentCycles}/4`;
  }
  
  // Update Focus Garden
  if (pomodoro.mode === 'work') {
    const totalTime = POMODORO_TIMES['work'];
    const progress = 1 - (pomodoro.timeLeft / totalTime);
    drawPlant(progress);
  } else {
    drawPlant(0); // Reset for breaks or show something else
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
      if (pomodoro.timeLeft <= 0) {
        stopPomodoro();
        handlePomodoroAutoSwitch();
      }
      updatePomodoroUI();
    }, 1000);
  } else {
    clearInterval(pomodoro.timerId);
  }
  updatePomodoroUI();
};

const handlePomodoroAutoSwitch = () => {
  const POMODORO_CYCLE_LIMIT = 4;
  
  if (pomodoro.mode === 'work') {
    grantAchievement('first_pomodoro');
    pomodoro.completedCycles = (pomodoro.completedCycles || 0) + 1;
    
    if (pomodoro.completedCycles >= POMODORO_CYCLE_LIMIT) {
      pomodoro.completedCycles = 0;
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
  // Auto-start the next session
  startPausePomodoro();
};

const stopPomodoro = () => {
  clearInterval(pomodoro.timerId);
  pomodoro.isRunning = false;
};

const resetPomodoro = () => {
  stopPomodoro();
  pomodoro.completedCycles = 0;
  pomodoro.timeLeft = POMODORO_TIMES[pomodoro.mode];
  updatePomodoroUI();
};

const setMentalHealthValue = async (type, value) => {
  const todayStr = getTodayString();
  const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
  await setDoc(profileRef, { [type]: { [todayStr]: value } }, { merge: true });
  
  // Update local state and re-render immediately for visual feedback
  if (!userProfile[type]) userProfile[type] = {};
  userProfile[type][todayStr] = value;
  renderMentalHealthTrackers();

  // Reactive Dost Logic
  if ((type === 'moods' && value === 'sad') || (type === 'stress' && value === 'high')) {
    const messages = [
      "Tough day? Take a 5-minute breather. You got this! 💙",
      "It's okay not to be okay. Treat yourself to something nice today. 🍫",
      "Remember: This stress is temporary, but your potential is permanent. ✨",
      "Sending you a virtual hug! 🤗 Take it easy for a bit.",
      "Deep breath in... Deep breath out... You are doing your best. 🌿"
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    
    // Show a special modal or extended toast
    const modalHTML = `
      <div class="modal-content w-full max-w-sm mx-auto p-6 text-center">
        <div class="text-4xl mb-4">🫂</div>
        <h3 class="text-xl font-bold mb-2">Hey Dost!</h3>
        <p class="mb-6 text-lg">${randomMsg}</p>
        <button id="dost-close" class="w-full py-2 rounded-lg font-bold text-white" style="background-color: var(--primary);">Thanks, I needed that</button>
      </div>`;
    
    const dostContainer = document.createElement('div');
    dostContainer.className = 'modal-overlay';
    dostContainer.innerHTML = modalHTML;
    document.body.appendChild(dostContainer);
    
    dostContainer.querySelector('#dost-close').addEventListener('click', () => {
      dostContainer.remove();
    });
  }
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
    
    // Time-based achievements
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sun, 6 = Sat

    if (hour >= 22 || hour < 4) await grantAchievement('night_owl');
    if (hour >= 4 && hour < 7) await grantAchievement('early_bird');
    if (day === 0 || day === 6) await grantAchievement('weekend_warrior');

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
  let streakBroken = false;

  if (action === 'increment') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLog = habitLogs[getDateString(yesterday)]?.[habitId];
    if (isCompleted(yesterdayLog?.status)) {
      newStreak += 1;
    } else {
      if (newStreak > 0) streakBroken = true;
      newStreak = 1;
    }
  } else if (action === 'reset') {
    if (newStreak > 0) streakBroken = true;
    newStreak = 0;
  }

  const newBestStreak = Math.max(habit.bestStreak || 0, newStreak);
  await updateDoc(habitRef, { streak: newStreak, bestStreak: newBestStreak });
  
  if(newStreak >= 7) await grantAchievement('7_day_streak');
  
  if (streakBroken) {
    // Check if any OTHER habit still has a streak >= 7
    const hasOtherWeekWarrior = habits.some(h => h.id !== habitId && (h.streak || 0) >= 7);
    if (!hasOtherWeekWarrior) {
      const weekWarrior = achievements.find(a => a.achievementId === '7_day_streak');
      if (weekWarrior) {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/achievements`, weekWarrior.id));
        showToast("Streak broken! Week Warrior status lost. 😢");
      }
    }
  }
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
    <div class="modal-content w-full max-w-md mx-auto">
      <form id="habit-form" class="flex flex-col">
        <div class="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
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
      <div class="modal-content w-full max-w-sm mx-auto p-6 text-center">
        <p class="mb-6">${message}</p>
        <div class="flex justify-center gap-4">
          <button id="confirm-cancel" class="font-bold py-2 px-6 rounded-lg">Cancel</button>
          <button id="confirm-ok" class="text-white font-bold py-2 px-6 rounded-lg" style="background-color: var(--danger);">Confirm</button>
        </div>
      </div>`;
    const confirmContainer = document.createElement('div');
    confirmContainer.className = 'modal-overlay';
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
    <div class="modal-content w-full max-w-sm mx-auto">
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
    <div class="modal-content w-full max-w-sm mx-auto">
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
    grantAchievement('grade_guru');
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
  
  // Auto-select first habit if no selection and habits exist
  if (!currentVal && habits.length > 0) {
    selector.value = habits[0].id;
    const container = document.getElementById('deep-dive-content');
    if (container) {
      container.classList.remove('hidden');
      renderTrendChart(habits[0].id);
      renderHeatmap(habits[0].id);
    }
  }
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
      responsive: true, 
      maintainAspectRatio: false,
      devicePixelRatio: 2, 
      animation: false,
      scales: {
        x: { 
            type: 'time', 
            time: { unit: 'day', tooltipFormat: 'MMM d' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { 
                maxRotation: 0, 
                autoSkip: true, 
                color: '#94a3b8',
                font: { size: 11, weight: 'bold' } 
            }
        },
        y: { 
            position: 'left', 
            title: { display: false }, // Removed 'Grade' text
            min: 0, 
            max: 100,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { 
                color: '#94a3b8',
                font: { size: 11, weight: 'bold' } 
            }
        },
        y1: { position: 'right', display: false, min: 0 } 
      },
      plugins: { 
          legend: { 
              position: 'top', 
              labels: { 
                  boxWidth: 10, 
                  color: '#94a3b8',
                  font: { size: 12, weight: 'bold' },
                  padding: 20
              } 
          } 
      }
    }
  });

  // Render new analytics
  renderAcademicRadar();
  renderBurnoutMeter();
  renderCGPASimulator();
}

// --- CGPA Simulator Logic ---
let cgpaSubjects = [];

const renderCGPASimulator = async () => {
  const container = document.getElementById('cgpa-subjects-list');
  const addBtn = document.getElementById('add-cgpa-subject-btn');
  const prevCgpaInput = document.getElementById('prev-cgpa-input');
  const prevCreditsInput = document.getElementById('prev-credits-input');

  if (!container || !addBtn) return;

  // Initialize if empty (fetch from sub-collection)
  if (cgpaSubjects.length === 0 && userId) {
      try {
          const simRef = doc(db, `users/${userId}/simulations/cgpa_data`);
          const simSnap = await getDoc(simRef);
          
          if (simSnap.exists()) {
              const data = simSnap.data();
              cgpaSubjects = data.subjects || [];
              if (prevCgpaInput) prevCgpaInput.value = data.prevCGPA || '';
              if (prevCreditsInput) prevCreditsInput.value = data.prevCredits || '';
          } else {
              // Fallback to profile or generate defaults
              if (userProfile.cgpaSubjects && userProfile.cgpaSubjects.length > 0) {
                  cgpaSubjects = [...userProfile.cgpaSubjects];
              } else {
                  const uniqueSubjects = [...new Set(grades.map(g => g.subject))];
                  if (uniqueSubjects.length > 0) {
                      cgpaSubjects = uniqueSubjects.map(s => {
                          const subGrades = grades.filter(g => g.subject === s).map(g => g.grade);
                          const avg = Math.round(subGrades.reduce((a,b)=>a+b,0) / subGrades.length);
                          return { name: s, credits: 3, marks: avg, maxMarks: 100 };
                      });
                  } else {
                      cgpaSubjects = [{ name: 'Math', credits: 4, marks: 85, maxMarks: 100 }, { name: 'Physics', credits: 3, marks: 78, maxMarks: 100 }];
                  }
              }
          }
      } catch (e) {
          console.error("Error loading CGPA data:", e);
      }
  }

  // Clear and Render
  container.innerHTML = '';
  cgpaSubjects.forEach((sub, index) => {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white dark:bg-slate-700 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-slate-600';
    row.innerHTML = `
      <div class="w-full sm:w-1/3 flex justify-between items-center sm:block mb-2 sm:mb-0">
        <input type="text" value="${sub.name}" class="bg-transparent border-none text-sm font-medium focus:ring-0 p-0 w-full" onchange="window.updateCGPASubject(${index}, 'name', this.value)">
        <div class="flex items-center gap-1 sm:mt-1">
            <label class="text-[10px] text-gray-400">Max:</label>
            <input type="number" value="${sub.maxMarks || 100}" min="10" class="w-10 bg-gray-100 dark:bg-slate-600 rounded p-0.5 text-[10px] text-center" onchange="window.updateCGPASubject(${index}, 'maxMarks', this.value)">
        </div>
      </div>
      <div class="flex items-center gap-2 w-full sm:w-auto">
          <div class="flex flex-col items-center w-10 shrink-0">
            <label class="text-[10px] text-gray-400">Cr</label>
            <input type="number" value="${sub.credits}" min="1" max="10" class="w-full text-center bg-gray-100 dark:bg-slate-600 rounded p-1 text-xs" onchange="window.updateCGPASubject(${index}, 'credits', this.value)">
          </div>
          <div class="flex-1 flex items-center gap-2 min-w-0">
            <input type="range" min="0" max="${sub.maxMarks || 100}" value="${sub.marks}" class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-primary" oninput="window.updateCGPASubject(${index}, 'marks', this.value)">
            <span class="text-xs w-8 text-right font-mono shrink-0">${sub.marks}</span>
          </div>
          <button class="text-gray-400 hover:text-red-500 px-1 shrink-0" onclick="window.removeCGPASubject(${index})">&times;</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Bind Add Button
  addBtn.onclick = () => {
    cgpaSubjects.push({ name: `Subject ${cgpaSubjects.length + 1}`, credits: 3, marks: 80, maxMarks: 100 });
    renderCGPASimulator();
    saveCGPASubjects();
  };

  calculateCGPA();
};

const saveCGPASubjects = async () => {
  if (userId) {
    const prevCGPA = parseFloat(document.getElementById('prev-cgpa-input')?.value) || 0;
    const prevCredits = parseFloat(document.getElementById('prev-credits-input')?.value) || 0;
    
    const simRef = doc(db, `users/${userId}/simulations/cgpa_data`);
    await setDoc(simRef, { 
        subjects: cgpaSubjects,
        prevCGPA,
        prevCredits,
        lastUpdated: new Date()
    }, { merge: true });
  }
};

// Expose helpers to window for inline events
window.updateCGPASubject = (index, field, value) => {
  if (field === 'credits' || field === 'marks' || field === 'maxMarks') value = parseFloat(value) || 0;
  
  // If maxMarks changes, we might need to clamp marks or re-render slider
  if (field === 'maxMarks') {
      cgpaSubjects[index].maxMarks = value;
      if (cgpaSubjects[index].marks > value) cgpaSubjects[index].marks = value;
      renderCGPASimulator(); // Re-render to update slider max
      saveCGPASubjects();
      return;
  }

  cgpaSubjects[index][field] = value;
  
  if (field === 'marks') {
    const row = document.getElementById('cgpa-subjects-list').children[index];
    row.querySelector('span').innerText = value;
  }
  calculateCGPA();
  saveCGPASubjects();
};

window.removeCGPASubject = (index) => {
  cgpaSubjects.splice(index, 1);
  renderCGPASimulator();
  saveCGPASubjects();
};

const calculateCGPA = () => {
  let totalPoints = 0;
  let totalCredits = 0;

  cgpaSubjects.forEach(sub => {
    // Calculate Percentage
    const max = sub.maxMarks || 100;
    const percentage = (sub.marks / max) * 100;

    // Convert Percentage to Grade Point (MU 10pt scale)
    let gp = 0;
    if (percentage >= 80) gp = 10;       // O
    else if (percentage >= 75) gp = 9;   // A
    else if (percentage >= 70) gp = 8;   // B
    else if (percentage >= 60) gp = 7;   // C
    else if (percentage >= 50) gp = 6;   // D
    else if (percentage >= 45) gp = 5;   // E
    else if (percentage >= 40) gp = 4;   // P
    else gp = 0;                         // F

    totalPoints += gp * sub.credits;
    totalCredits += sub.credits;
  });

  // Get Previous Semester Data
  const prevCGPA = parseFloat(document.getElementById('prev-cgpa-input')?.value) || 0;
  const prevCredits = parseFloat(document.getElementById('prev-credits-input')?.value) || 0;

  const grandTotalPoints = (prevCGPA * prevCredits) + totalPoints;
  const grandTotalCredits = prevCredits + totalCredits;

  const cgpa = grandTotalCredits > 0 ? (grandTotalPoints / grandTotalCredits).toFixed(2) : '0.00';
  
  const el = document.getElementById('projected-cgpa');
  if (el) {
      el.innerText = cgpa;
      // Color coding
      if (cgpa >= 9) el.className = 'text-5xl font-bold text-green-500 transition-all duration-300';
      else if (cgpa >= 7.5) el.className = 'text-5xl font-bold text-blue-500 transition-all duration-300';
      else if (cgpa >= 6) el.className = 'text-5xl font-bold text-yellow-500 transition-all duration-300';
      else el.className = 'text-5xl font-bold text-red-500 transition-all duration-300';
  }
};

window.calculateCGPA = calculateCGPA;

let academicRadarInstance = null;

const renderAcademicRadar = () => {
  const canvas = document.getElementById('academic-radar-chart');
  const emptyState = document.getElementById('radar-empty-state');
  if (!canvas) return;

  // 1. Process Data
  const subjectGrades = {};
  grades.forEach(g => {
    const subject = g.subject || 'Unknown';
    if (!subjectGrades[subject]) subjectGrades[subject] = [];
    subjectGrades[subject].push(parseFloat(g.grade));
  });

  const labels = Object.keys(subjectGrades);
  
  if (labels.length === 0) {
      canvas.style.opacity = '0.1';
      emptyState.classList.remove('hidden');
      return; 
  }
  
  canvas.style.opacity = '1';
  emptyState.classList.add('hidden');

  const dataPoints = labels.map(subject => {
    const sum = subjectGrades[subject].reduce((a, b) => a + b, 0);
    return (sum / subjectGrades[subject].length).toFixed(1);
  });

  // 2. Destroy existing
  if (academicRadarInstance) {
    academicRadarInstance.destroy();
  }

  // 3. Create Chart
  const ctx = canvas.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  // Fallback to Bar Chart if < 3 subjects
  const chartType = labels.length < 3 ? 'bar' : 'radar';

  academicRadarInstance = new Chart(ctx, {
    type: chartType,
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Grade (%)',
        data: dataPoints,
        fill: true,
        backgroundColor: 'rgba(99, 102, 241, 0.2)', 
        borderColor: 'rgb(99, 102, 241)',
        pointBackgroundColor: 'rgb(99, 102, 241)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(99, 102, 241)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: chartType === 'radar' ? {
        r: {
          angleLines: { color: gridColor },
          grid: { color: gridColor },
          pointLabels: { color: textColor, font: { size: 12 } },
          min: 0,
          max: 100,
          ticks: { backdropColor: 'transparent', color: textColor, stepSize: 20 }
        }
      } : {
        y: {
            beginAtZero: true,
            max: 100,
            grid: { color: gridColor },
            ticks: { color: textColor }
        },
        x: {
            grid: { display: false },
            ticks: { color: textColor }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
};

const renderBurnoutMeter = () => {
  const liquid = document.getElementById('burnout-liquid');
  const percentageText = document.getElementById('burnout-percentage');
  const statusText = document.getElementById('burnout-status');
  const adviceText = document.getElementById('burnout-advice');
  
  if (!liquid) return;

  // 1. Calculate Sleep Score (Last 7 days)
  const today = new Date();
  let totalSleep = 0;
  let sleepDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = getDateString(d);
    if (sleepLogs[dateStr]) {
      totalSleep += parseFloat(sleepLogs[dateStr]);
      sleepDays++;
    }
  }
  const avgSleep = sleepDays > 0 ? totalSleep / sleepDays : 0;
  // 8 hours is 100%, 4 hours is 0% (linear scale for simplicity)
  // Formula: (Sleep - 4) / 4 * 100. Clamped 0-100.
  // Actually, let's be more generous: 7+ is 100%, <4 is 0%.
  let sleepScore = 0;
  if (avgSleep >= 7) sleepScore = 100;
  else if (avgSleep <= 4) sleepScore = 0;
  else sleepScore = ((avgSleep - 4) / 3) * 100;

  // 2. Calculate Stress Score (Last 7 days)
  // Low = 100 (Good), Medium = 50, High = 0 (Bad)
  let totalStress = 0;
  let stressDays = 0;
  const stressMap = { 'low': 100, 'medium': 50, 'high': 0 };
  
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = getDateString(d);
    const stress = userProfile.stress?.[dateStr]; // Assuming stress is stored here
    if (stress && stressMap[stress] !== undefined) {
      totalStress += stressMap[stress];
      stressDays++;
    }
  }
  const stressScore = stressDays > 0 ? totalStress / stressDays : 50; // Default to medium if no data

  // 3. Calculate Daily Habit Completion Score
  const todayStr = getDateString(new Date());
  const completedToday = habitLogs[todayStr] || {};
  const completedCount = Object.keys(completedToday).length;
  const totalHabits = habits.length;
  const dailyHabitCompletionScore = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

  // 4. Combined Battery Health
  // Formula: (SleepScore * 0.4) + (StressScore * 0.3) + (DailyHabitCompletionScore * 0.3)
  let batteryHealth = 0;
  let isNoData = (sleepDays === 0 && stressDays === 0 && totalHabits === 0);

  // Reset classes first to avoid conflicts
  liquid.className = 'w-full rounded-lg absolute bottom-1 left-1 right-1 z-0';

  if (isNoData) {
    statusText.innerText = "No Data";
    adviceText.innerText = "Start logging sleep, mood, and habits to see your energy levels.";
    gsap.to(liquid, { height: '15%', duration: 1, ease: "power2.out" });
    liquid.classList.add('bg-gray-300', 'dark:bg-gray-600');
    percentageText.innerText = "--";
    return;
  } else {
    batteryHealth = (sleepScore * 0.4) + (stressScore * 0.3) + (dailyHabitCompletionScore * 0.3);
  }
  
  if (isNaN(batteryHealth)) batteryHealth = 0;
  batteryHealth = Math.max(0, Math.min(100, Math.round(batteryHealth)));

  // 5. Update UI with GSAP
  gsap.to(liquid, { height: `${batteryHealth}%`, duration: 1.5, ease: "elastic.out(1, 0.5)" });
  
  // Animate number safely
  const counter = { val: parseFloat(percentageText.innerText) || 0 };
  gsap.to(counter, { 
      val: batteryHealth, 
      duration: 1.5, 
      ease: "power2.out",
      onUpdate: () => { 
          percentageText.innerText = Math.round(counter.val) + "%"; 
      } 
  });
  
  let colorClass = 'bg-green-500';
  let status = 'Fully Charged ⚡';
  let advice = 'You are doing great! Keep maintaining this balance.';

  if (batteryHealth < 30) {
    colorClass = 'bg-red-500';
    status = 'Critical Burnout ⚠️';
    advice = 'Stop studying. Take a nap and do a breathing exercise immediately.';
  } else if (batteryHealth < 60) {
    colorClass = 'bg-yellow-500';
    status = 'Draining Fast 🔋';
    advice = 'You are pushing too hard. Prioritize sleep tonight.';
  }

  liquid.classList.add(colorClass);
  statusText.innerText = status;
  adviceText.innerText = advice;
};

const renderTrendChart = (habitId) => {
  const canvas = document.getElementById('trends-chart');
  if (!canvas) return;

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

  // 4) Render with responsive enabled
  trendsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      datasets: [{
        label: 'Completion Status',
        data: points,
        backgroundColor: bgColors,
        borderColor: 'transparent',
        borderRadius: 4,
        barPercentage: 0.6,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      scales: {
        x: { 
            type: 'time', 
            time: { unit: 'day', tooltipFormat: 'MMM d' },
            grid: { display: false },
            ticks: { 
                color: '#94a3b8',
                font: { size: 10, weight: 'bold' },
                maxRotation: 0,
                autoSkip: true
            }
        },
        y: { display: false, min: 0, max: 1.2 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          padding: 10,
          cornerRadius: 8,
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

// Finance Tracker
const renderFinance = () => {
  const monthlySpendEl = document.getElementById('monthly-spend');
  const monthlyLimitEl = document.getElementById('monthly-limit');
  const spendBar = document.getElementById('spend-bar');
  
  if (!monthlySpendEl) return;

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlyExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));
  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const limit = userProfile.dailyLimit || 2000; // Reusing dailyLimit field as monthly limit for now, or migrate

  monthlySpendEl.innerText = `₹${totalSpent}`;
  monthlyLimitEl.innerText = limit;
  
  const percentage = Math.min(100, (totalSpent / limit) * 100);
  spendBar.style.width = `${percentage}%`;
  
  if (percentage >= 100) {
    spendBar.className = 'h-2.5 rounded-full bg-red-500';
    monthlySpendEl.classList.add('text-red-500');
  } else if (percentage >= 80) {
    spendBar.className = 'h-2.5 rounded-full bg-yellow-500';
    monthlySpendEl.classList.remove('text-red-500');
  } else {
    spendBar.className = 'h-2.5 rounded-full bg-green-500';
    monthlySpendEl.classList.remove('text-red-500');
  }
};

const addExpense = async (amount, category, description = '') => {
  if (!userId) return;
  await addDoc(collection(db, `artifacts/${appId}/users/${userId}/expenses`), {
    amount: parseFloat(amount),
    category,
    description,
    date: new Date().toISOString()
  });
  showToast(`Added ₹${amount} for ${category}`);
};

const deleteExpense = async (expenseId) => {
  if (!userId || !expenseId) return;
  try {
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/expenses`, expenseId));
    showToast('Expense deleted');
  } catch (err) {
    console.error('Delete expense error:', err);
    showToast('Failed to delete expense');
  }
};

const showAddExpenseModal = (preSelectedCategory = '') => {
    const modalHTML = `
    <div class="modal-content w-full max-w-sm mx-auto p-6 animate-fade-in-up">
      <h3 class="text-lg font-bold mb-4">Add Expense</h3>
      <form id="expense-form" class="space-y-3">
        <div>
            <label class="text-xs font-medium text-gray-500">Amount (₹)</label>
            <input name="amount" type="number" min="1" required class="w-full p-2 rounded-md border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-primary">
        </div>
        <div>
            <label class="text-xs font-medium text-gray-500">Category</label>
            <select name="category" class="w-full p-2 rounded-md border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600">
                <option value="Food" ${preSelectedCategory === 'Food' ? 'selected' : ''}>🍔 Food</option>
                <option value="Travel" ${preSelectedCategory === 'Travel' ? 'selected' : ''}>🚌 Travel</option>
                <option value="Stationery" ${preSelectedCategory === 'Stationery' ? 'selected' : ''}>✏️ Stationery</option>
                <option value="Entertainment" ${preSelectedCategory === 'Entertainment' ? 'selected' : ''}>🎬 Entertainment</option>
                <option value="Other" ${preSelectedCategory === 'Other' ? 'selected' : ''}>📝 Other</option>
            </select>
        </div>
        <div>
            <label class="text-xs font-medium text-gray-500">Note (Optional)</label>
            <input name="description" type="text" placeholder="e.g., Burger King" class="w-full p-2 rounded-md border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600">
        </div>
        <div class="flex justify-end gap-2 mt-4">
            <button type="button" class="cancel-btn px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
            <button type="submit" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90">Add Expense</button>
        </div>
      </form>
    </div>`;
    
    modalContainer.innerHTML = modalHTML;
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
    
    modalContainer.querySelector('.cancel-btn').addEventListener('click', closeModal);
    modalContainer.querySelector('#expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const amount = formData.get('amount');
        const category = formData.get('category');
        const description = formData.get('description');
        
        if (amount && !isNaN(amount)) {
            await addExpense(amount, category, description);
            closeModal();
        }
    });
    
    // Focus amount input
    setTimeout(() => modalContainer.querySelector('input[name="amount"]').focus(), 100);
};

const showFinanceHistoryModal = () => {
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyExpenses = expenses
        .filter(e => e.date.startsWith(currentMonthStr))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalSpent = monthlyExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const listHTML = monthlyExpenses.length > 0 ? monthlyExpenses.map(e => {
        const date = new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        const time = new Date(e.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `
        <div class="expense-row flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg mb-2" data-id="${e.id}">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-lg shadow-sm">
                        ${e.category === 'Food' ? '🍔' : e.category === 'Travel' ? '🚌' : e.category === 'Stationery' ? '✏️' : e.category === 'Entertainment' ? '🎬' : '📝'}
                    </div>
                    <div>
                        <div class="font-medium text-sm">${e.category}</div>
                        <div class="text-xs text-gray-500">${e.description || 'No note'} • ${date}</div>
                    </div>
                </div>
          <div class="flex items-center gap-3">
            <div class="font-bold text-red-500">-₹${e.amount}</div>
            <button class="delete-expense text-xs text-red-500 hover:text-red-700 font-semibold" data-id="${e.id}" type="button">Delete</button>
          </div>
            </div>
        `;
    }).join('') : '<div class="text-center text-gray-500 py-8">No expenses this month yet!</div>';

    const modalHTML = `
    <div class="modal-content w-full max-w-md mx-auto p-0 overflow-hidden h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
        <h3 class="text-lg font-bold">Monthly Statement 📜</h3>
        <button class="cancel-btn text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
      </div>
      
      <div class="p-4 bg-blue-50 dark:bg-slate-900">
        <div class="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Total Spent (This Month)</div>
        <div class="text-3xl font-bold text-gray-800 dark:text-white">₹${totalSpent}</div>
      </div>

      <div class="finance-history-list flex-1 overflow-y-auto p-4 custom-scrollbar">
        ${listHTML}
      </div>
    </div>`;
    
    modalContainer.innerHTML = modalHTML;
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
    
    modalContainer.querySelector('.cancel-btn').addEventListener('click', closeModal);
    const listEl = modalContainer.querySelector('.finance-history-list');
    listEl?.addEventListener('click', async (e) => {
      const target = e.target;
      if (target.classList.contains('delete-expense')) {
        const id = target.dataset.id;
        await deleteExpense(id);
        target.closest('.expense-row')?.remove();
        renderFinance();
      }
    });
};

const showAvatarPickerModal = () => {
    const avatarCount = 40;
    let avatarsHTML = '';
    let selectedAvatar = userProfile.photoURL || '';
    
    for (let i = 1; i <= avatarCount; i++) {
        const num = String(i).padStart(2, '0');
        const fileName = `Girl=On, Avatar=${num}.png`;
        const filePath = `avatars/${fileName}`; 
        const isSelected = selectedAvatar === filePath;
        
        avatarsHTML += `
            <div class="avatar-option cursor-pointer p-2 rounded-lg transition-colors flex justify-center items-center ${isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}" data-src="${filePath}">
                <img src="${filePath}" alt="Avatar ${num}" class="w-16 h-16 rounded-full border-2 ${isSelected ? 'border-primary' : 'border-transparent'} transition-all">
            </div>
        `;
    }

    const modalHTML = `
    <div class="modal-content w-full max-w-2xl mx-auto p-6 animate-fade-in-up h-[80vh] flex flex-col">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold">Edit Profile</h3>
        <button class="cancel-btn text-gray-500 hover:text-gray-700">
            <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="mb-4">
        <label class="text-xs font-semibold text-gray-500 mb-1 block">Display Name</label>
        <input type="text" id="new-display-name" value="${userProfile.displayName || ''}" placeholder="Enter your name" class="w-full p-2 rounded-md border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-primary outline-none">
      </div>
      
      <div class="text-xs font-semibold text-gray-500 mb-2">Choose an Avatar</div>
      <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 overflow-y-auto p-2 custom-scrollbar flex-grow">
        ${avatarsHTML}
      </div>
      
      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button class="cancel-btn px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium">Cancel</button>
        <button id="save-profile-btn" class="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/30">Save Changes</button>
      </div>
    </div>`;
    
    modalContainer.innerHTML = modalHTML;
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
    
    modalContainer.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', closeModal));
    
    // Avatar Selection Logic
    modalContainer.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selection from others
            modalContainer.querySelectorAll('.avatar-option').forEach(opt => {
                opt.classList.remove('bg-primary/10', 'ring-2', 'ring-primary');
                opt.querySelector('img').classList.remove('border-primary');
                opt.querySelector('img').classList.add('border-transparent');
            });
            
            // Add selection to clicked
            option.classList.add('bg-primary/10', 'ring-2', 'ring-primary');
            option.querySelector('img').classList.remove('border-transparent');
            option.querySelector('img').classList.add('border-primary');
            
            selectedAvatar = option.dataset.src;
        });
    });

    // Save Changes Listener
    modalContainer.querySelector('#save-profile-btn').addEventListener('click', async () => {
        const newName = modalContainer.querySelector('#new-display-name').value.trim();
        const updates = {};
        let hasChanges = false;

        // Check Name Change
        if (newName && newName !== userProfile.displayName) {
            userProfile.displayName = newName;
            updates.displayName = newName;
            hasChanges = true;
            
            // Update UI immediately
            const nameEl = document.getElementById('user-name');
            if(nameEl) nameEl.innerText = newName;
            const greetingUser = document.getElementById('greeting-user');
            if (greetingUser) greetingUser.innerText = newName.split(' ')[0];
        }

        // Check Avatar Change
        if (selectedAvatar && selectedAvatar !== userProfile.photoURL) {
            userProfile.photoURL = selectedAvatar;
            updates.photoURL = selectedAvatar;
            hasChanges = true;
            
            // Update UI immediately
            const avatarEl = document.getElementById('user-avatar');
            if (avatarEl) avatarEl.src = selectedAvatar;
        }

        if (hasChanges && userId) {
            const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
            await setDoc(profileRef, updates, { merge: true });
            showToast("Profile updated successfully! ✨");
        } else if (!hasChanges) {
            showToast("No changes to save.");
        }
        
        closeModal();
    });
};

const showQRCodeModal = () => {
    const modalHTML = `
    <div class="modal-content p-6 animate-fade-in-up flex flex-col items-center max-w-md w-full mx-4 relative overflow-hidden border border-glass-border shadow-neon">
      <!-- Decorative Background Blur -->
      <div class="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
      
      <div class="flex justify-between items-center w-full mb-6 z-10">
        <h3 class="text-xl font-bold text-text-default flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">qr_code_scanner</span>
            Scan to Donate
        </h3>
        <button class="cancel-btn p-2 rounded-full hover:bg-white/10 text-text-muted hover:text-danger transition-colors">
            <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      
      <div class="bg-white p-4 rounded-2xl shadow-inner border-4 border-white/20 relative z-10">
        <img src="qrcode.png" alt="Donation QR Code" class="w-64 h-64 object-contain rounded-lg">
      </div>
      
      <div class="mt-6 text-center z-10">
        <p class="text-sm font-medium text-text-default">Thank you for your support! 💖</p>
        <p class="text-xs text-text-muted mt-1">Every contribution helps improve Daily Dost.</p>
      </div>
    </div>`;
    
    modalContainer.innerHTML = modalHTML;
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
    
    modalContainer.querySelector('.cancel-btn').addEventListener('click', closeModal);
};

const showEditLimitModal = () => {
  const currentLimit = userProfile.dailyLimit || 2000;
  const modalHTML = `
    <div class="modal-content w-full max-w-sm mx-auto p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold">Set Monthly Limit</h3>
        <button class="cancel-btn text-gray-400 hover:text-gray-600 text-2xl" type="button">&times;</button>
      </div>
      <label class="text-xs font-semibold text-gray-500">Monthly Limit (₹)</label>
      <input id="limit-input" type="number" min="0" class="w-full p-3 rounded-lg border border-glass-border bg-white/70 dark:bg-slate-800" value="${currentLimit}">
      <div class="flex justify-end gap-2">
        <button class="cancel-btn px-4 py-2 rounded-lg border border-glass-border text-sm" type="button">Cancel</button>
        <button id="save-limit" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold" type="button">Save</button>
      </div>
    </div>`;

  modalContainer.innerHTML = modalHTML;
  modalContainer.classList.remove('hidden');
  modalContainer.classList.add('flex');

  modalContainer.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', closeModal));
  modalContainer.querySelector('#save-limit').addEventListener('click', async () => {
    const val = parseFloat(modalContainer.querySelector('#limit-input').value);
    if (isNaN(val) || val < 0) return;
    userProfile.dailyLimit = val;
    renderFinance();
    if (userId) {
      const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
      await setDoc(profileRef, { dailyLimit: val }, { merge: true });
      showToast(`Monthly limit updated to ₹${val}`);
    }
    closeModal();
  });
};

// Sleep Cycle Calculator
const calculateSleepCycles = () => {
  const now = new Date();
  // Add 15 mins for falling asleep
  now.setMinutes(now.getMinutes() + 15);
  
  let cyclesHTML = '<div class="grid grid-cols-2 gap-2 mt-4">';
  for (let i = 4; i <= 6; i++) {
    const wakeTime = new Date(now.getTime() + i * 90 * 60000);
    const timeStr = wakeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    cyclesHTML += `
      <div class="p-2 rounded bg-blue-50 dark:bg-slate-800 text-center">
        <div class="font-bold text-lg">${timeStr}</div>
        <div class="text-xs text-gray-500">${i} Cycles (${i * 1.5}h)</div>
      </div>
    `;
  }
  cyclesHTML += '</div>';
  
  const modalHTML = `
    <div class="modal-content w-full max-w-sm mx-auto p-6">
      <h3 class="text-lg font-bold mb-2">💤 Best Wake-up Times</h3>
      <p class="text-sm text-gray-500">If you go to bed right now (allowing 15m to fall asleep), you should wake up at:</p>
      ${cyclesHTML}
      <button id="close-sleep-modal" class="mt-4 w-full py-2 rounded-lg font-bold text-white" style="background-color: var(--primary);">Got it</button>
    </div>`;
    
  const container = document.createElement('div');
  container.className = 'modal-overlay';
  container.innerHTML = modalHTML;
  document.body.appendChild(container);
  
  container.querySelector('#close-sleep-modal').addEventListener('click', () => container.remove());
};

// Focus Garden (Visual Pomodoro)
const drawPlant = (progress) => {
  const canvas = document.getElementById('plant-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  // Ground
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.ellipse(w/2, h - 20, w/3, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (progress <= 0) return; // Seed stage or reset
  
  // Stem
  const stemHeight = (h - 60) * progress;
  ctx.strokeStyle = '#228B22';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w/2, h - 40);
  // Quadratic curve for organic look
  ctx.quadraticCurveTo(w/2 + (Math.sin(progress * 10) * 20), h - 40 - stemHeight/2, w/2, h - 40 - stemHeight);
  ctx.stroke();
  
  // Leaves
  if (progress > 0.3) {
    ctx.fillStyle = '#32CD32';
    ctx.beginPath();
    ctx.ellipse(w/2 - 10, h - 40 - stemHeight * 0.4, 20, 10, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (progress > 0.6) {
    ctx.beginPath();
    ctx.ellipse(w/2 + 10, h - 40 - stemHeight * 0.7, 15, 8, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Flower
  if (progress >= 0.95) {
    const flowerX = w/2;
    const flowerY = h - 40 - stemHeight;
    
    ctx.fillStyle = '#FF69B4'; // Pink petals
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(flowerX, flowerY, 15, 30, (i * Math.PI * 2) / 5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.fillStyle = '#FFD700'; // Center
    ctx.beginPath();
    ctx.arc(flowerX, flowerY, 10, 0, Math.PI * 2);
    ctx.fill();
  }
};

window.onload = () => {
  initializeFirebase();
  
  // Settings Button - Change Avatar
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        showAvatarPickerModal();
    });
  }

  // QR Code Enlarge (Event Delegation)
  document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'donation-qr-code') {
          showQRCodeModal();
      }
  });

  document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const themeText = document.getElementById('theme-text');
    if (sunIcon && moonIcon) {
      sunIcon.classList.toggle('hidden', !isDark);
      moonIcon.classList.toggle('hidden', isDark);
    }
    if (themeText) {
      themeText.textContent = newTheme === 'dark' ? 'NIGHT' : 'DAY';
    }
    
    // Save preference to Firestore
    if (userId && db) {
      const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
      setDoc(profileRef, { settings: { theme: newTheme } }, { merge: true });
    }
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

  // Finance Listeners
  document.querySelectorAll('.expense-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      showAddExpenseModal(cat);
    });
  });

  // Finance History Listener
  const historyBtn = document.getElementById('finance-history-btn');
  if (historyBtn) {
      historyBtn.addEventListener('click', showFinanceHistoryModal);
  }

  // Edit Monthly Limit Listener
  const editLimitBtn = document.getElementById('edit-limit-btn');
  if (editLimitBtn) {
    editLimitBtn.addEventListener('click', showEditLimitModal);
  }

  // Donation Listener
  const copyUpiBtn = document.getElementById('copy-upi-btn');
  if (copyUpiBtn) {
    copyUpiBtn.addEventListener('click', () => {
      const upiId = document.getElementById('upi-id').innerText;
      navigator.clipboard.writeText(upiId).then(() => {
        showToast('UPI ID copied to clipboard! 📋');
        
        // Visual feedback
        const icon = copyUpiBtn.querySelector('.material-symbols-outlined');
        if (icon) {
            const originalText = icon.innerText;
            icon.innerText = 'check';
            copyUpiBtn.classList.add('text-green-500');
            copyUpiBtn.classList.remove('text-text-muted');
            
            setTimeout(() => {
                icon.innerText = originalText;
                copyUpiBtn.classList.remove('text-green-500');
                copyUpiBtn.classList.add('text-text-muted');
            }, 2000);
        }
      }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy UPI ID');
      });
    });
  }
  
  // Sleep Cycle Listener
  document.getElementById('calc-sleep-cycle-btn').addEventListener('click', calculateSleepCycles);

  // Insomnia Mode (WakeLock)
  document.getElementById('insomnia-toggle').addEventListener('click', toggleWakeLock);
  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      await requestWakeLock();
    }
  });

  // Focus Ambiance
  document.querySelectorAll('.ambiance-btn').forEach(btn => {
    btn.addEventListener('click', () => playAmbiance(btn.dataset.sound));
  });
  document.getElementById('stop-ambiance-btn').addEventListener('click', stopAmbiance);

};

// Sticky Notes Feature (Cloud Backpack)
const stickyNotesList = document.getElementById('sticky-notes-list');
const stickyNoteInput = document.getElementById('sticky-note-input');
const addStickyNoteBtn = document.getElementById('add-sticky-note-btn');

function renderStickyNotes() {
  if (!stickyNotesList) return;
  stickyNotesList.innerHTML = '';
  
  if (stickyNotes.length === 0) {
    stickyNotesList.innerHTML = '<p class="text-xs text-center text-text-muted">No notes yet. Add one!</p>';
    return;
  }

  stickyNotes.forEach((note) => {
    const noteDiv = document.createElement('div');
    noteDiv.className = 'flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded-xl backdrop-blur-sm';
    noteDiv.innerHTML = `
      <span class="flex-1 text-sm text-text-default">${note.text}</span>
      <button class="text-xs px-3 py-1 rounded-lg hover:bg-danger/20 text-danger border border-danger/30 transition-all" data-id="${note.id}" type="button">Delete</button>
    `;
    noteDiv.querySelector('button').onclick = function() {
      deleteStickyNote(this.getAttribute('data-id'));
    };
    stickyNotesList.appendChild(noteDiv);
  });
}

async function addStickyNote() {
  const text = stickyNoteInput.value.trim();
  if (!text || !userId) return;
  
  try {
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/stickyNotes`), {
      text,
      createdAt: new Date().toISOString()
    });
    stickyNoteInput.value = '';
  } catch (error) {
    console.error("Error adding note:", error);
    showToast("Failed to add note");
  }
}

async function deleteStickyNote(noteId) {
  if (!userId) return;
  try {
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/stickyNotes`, noteId));
  } catch (error) {
    console.error("Error deleting note:", error);
    showToast("Failed to delete note");
  }
}

if (addStickyNoteBtn && stickyNoteInput && stickyNotesList) {
  addStickyNoteBtn.addEventListener('click', addStickyNote);
  stickyNoteInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addStickyNote();
  });
}

// Calculator Feature
const calcDisplay = document.getElementById('calc-display');
const calcBtns = document.querySelectorAll('.calc-btn');
let calcInput = '';

function updateCalcDisplay() {
  if (calcDisplay) calcDisplay.value = calcInput || '0';
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
    const expression = (calcInput && calcInput.trim() !== '') ? calcInput : '0';
    const result = eval(expression.replace(/÷/g, '/').replace(/×/g, '*'));
    const safeResult = (result === undefined || result === null || Number.isNaN(result)) ? 0 : result;
    calcInput = String(safeResult);
    updateCalcDisplay();
    grantAchievement('math_whiz');
  } catch {
    calcInput = '';
    if (calcDisplay) calcDisplay.value = 'Error';
  }
}

if (calcBtns.length > 0) {
  calcBtns.forEach(btn => {
    if (btn.id === 'calc-clear') {
      btn.onclick = clearCalc;
    } else if (btn.id === 'calc-del') {
      btn.onclick = () => {
        calcInput = calcInput.slice(0, -1);
        updateCalcDisplay();
      };
    } else if (btn.id === 'calc-equals') {
      btn.onclick = evalCalc;
    } else {
      btn.onclick = handleCalcBtn;
    }
  });
}

// Attendance Calculator (Bunk-o-Meter)
const totalClassesInput = document.getElementById('total-classes');
const attendedClassesInput = document.getElementById('attended-classes');
const calcAttendanceBtn = document.getElementById('calc-attendance-btn');
const attendanceResult = document.getElementById('attendance-result');

if (calcAttendanceBtn) {
  calcAttendanceBtn.addEventListener('click', () => {
    const total = parseInt(totalClassesInput.value);
    const attended = parseInt(attendedClassesInput.value);

    if (isNaN(total) || isNaN(attended) || total <= 0) {
      attendanceResult.textContent = "Please enter valid numbers.";
      attendanceResult.className = "p-3 rounded-lg bg-red-100 text-red-800 text-sm font-medium text-center";
      attendanceResult.classList.remove('hidden');
      return;
    }

    const percentage = (attended / total) * 100;
    const target = 75; // Minimum attendance requirement
    let message = `Current Attendance: ${percentage.toFixed(1)}%<br>`;
    let bgColor = "";
    let textColor = "";

    if (percentage >= target) {
      // Calculate how many classes can be bunked
      // (attended) / (total + x) >= 0.75
      // attended >= 0.75 * total + 0.75 * x
      // attended - 0.75 * total >= 0.75 * x
      // (attended - 0.75 * total) / 0.75 >= x
      const bunkable = Math.floor((attended - (target/100) * total) / (target/100));
      
      if (bunkable > 0) {
        message += `✅ Safe Zone! You can bunk <strong>${bunkable}</strong> more classes and stay above ${target}%.`;
        bgColor = "bg-green-100 dark:bg-green-900";
        textColor = "text-green-800 dark:text-green-100";
      } else {
        message += `⚠️ On the edge! Don't miss any classes right now.`;
        bgColor = "bg-yellow-100 dark:bg-yellow-900";
        textColor = "text-yellow-800 dark:text-yellow-100";
      }
    } else {
      // Calculate how many classes need to be attended
      // (attended + x) / (total + x) >= 0.75
      // attended + x >= 0.75 * total + 0.75 * x
      // 0.25 * x >= 0.75 * total - attended
      // x >= (0.75 * total - attended) / 0.25
      const needed = Math.ceil(((target/100) * total - attended) / (1 - (target/100)));
      
      message += `🚨 Danger Zone! You must attend the next <strong>${needed}</strong> classes to reach ${target}%.`;
      bgColor = "bg-red-100 dark:bg-red-900";
      textColor = "text-red-800 dark:text-red-100";
    }

    attendanceResult.innerHTML = message;
    attendanceResult.className = `p-3 rounded-lg ${bgColor} ${textColor} text-sm font-medium text-center mt-3`;
    attendanceResult.classList.remove('hidden');
    
    grantAchievement('bunk_master');
  });
}

// ============================================
// INSOMNIA MODE (WakeLock)
// ============================================
const toggleWakeLock = async () => {
  const btn = document.getElementById('insomnia-toggle');
  if (!wakeLock) {
    const success = await requestWakeLock();
    if (success) {
      // Use !important classes or specific utility classes to override hover states on mobile
      btn.classList.add('!text-accent', '!border-accent', 'shadow-neon-accent');
      btn.classList.remove('text-text-muted');
      showToast('Insomnia Mode ON: Screen will stay awake 👁️');
    }
  } else {
    await releaseWakeLock();
    btn.classList.remove('!text-accent', '!border-accent', 'shadow-neon-accent');
    btn.classList.add('text-text-muted');
    showToast('Insomnia Mode OFF');
  }
};

const requestWakeLock = async () => {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released');
        // Sync UI when lock is released (e.g. by system or tab switch)
        const btn = document.getElementById('insomnia-toggle');
        if (btn) {
            btn.classList.remove('!text-accent', '!border-accent', 'shadow-neon-accent');
            btn.classList.add('text-text-muted');
        }
        wakeLock = null;
      });
      return true;
    } else {
      showToast('Wake Lock not supported on this browser.');
      return false;
    }
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
    return false;
  }
};

const releaseWakeLock = async () => {
  if (wakeLock !== null) {
    await wakeLock.release();
    wakeLock = null;
  }
};

// ============================================
// FOCUS AMBIANCE (Web Audio API)
// ============================================
const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const createBrownNoise = () => {
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5; 
  }
  return buffer;
};

const createRainNoise = () => {
  // Simple Pink Noise approximation for rain
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0, b1, b2, b3, b4, b5, b6;
  b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] *= 0.11; 
    b6 = white * 0.115926;
  }
  return buffer;
};

const playAmbiance = (type) => {
  initAudio();
  stopAmbiance(); // Stop current if any

  const buffer = type === 'brown' ? createBrownNoise() : createRainNoise();
  
  currentSource = audioCtx.createBufferSource();
  currentSource.buffer = buffer;
  currentSource.loop = true;
  
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0.5; // Default volume
  
  currentSource.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  currentSource.start();
  
  // Update UI
  document.querySelectorAll('.ambiance-btn').forEach(btn => {
    if (btn.dataset.sound === type) {
      btn.classList.add('bg-primary', 'text-white', 'border-primary');
      btn.classList.remove('hover:bg-gray-100', 'dark:hover:bg-slate-700');
    } else {
      btn.classList.remove('bg-primary', 'text-white', 'border-primary');
      btn.classList.add('hover:bg-gray-100', 'dark:hover:bg-slate-700');
    }
  });
  document.getElementById('stop-ambiance-btn').classList.remove('hidden');
};

const stopAmbiance = () => {
  if (currentSource) {
    currentSource.stop();
    currentSource = null;
  }
  document.querySelectorAll('.ambiance-btn').forEach(btn => {
    btn.classList.remove('bg-primary', 'text-white', 'border-primary');
    btn.classList.add('hover:bg-gray-100', 'dark:hover:bg-slate-700');
  });
  document.getElementById('stop-ambiance-btn').classList.add('hidden');
};

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
const updateUserProfile = async (googleUser) => {
  try {
    // Ensure auth and userId are available
    if (!auth.currentUser || !userId) return false;
    
    const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`);
    const docSnap = await getDoc(profileRef);
    const currentData = docSnap.exists() ? docSnap.data() : {};

    // Prioritize existing Firestore data (custom edits), fallback to Google data
    const displayName = currentData.displayName || googleUser.displayName || googleUser.email?.split('@')[0] || 'User';
    const photoURL = currentData.photoURL || googleUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=128`;

    // 1. Update Firebase Auth profile (keep it in sync with our app profile)
    await updateProfile(auth.currentUser, {
      displayName: displayName,
      photoURL: photoURL
    });
    
    // 2. Update Firestore profile document
    await setDoc(profileRef, {
        displayName: displayName,
        photoURL: photoURL,
        email: googleUser.email,
        lastSignIn: new Date().toISOString()
    }, { merge: true });

    // 3. Update the UI
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    
    if (userAvatar) userAvatar.src = photoURL;
    if (userName) userName.innerText = displayName;
    
    console.log('Profile updated successfully');
    return { success: true, isNew: !docSnap.exists() };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, isNew: false };
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
setTimeout(() => {
  if (!loadingOverlay.classList.contains('hidden')) {
    loadingOverlay.classList.add('hidden');
    showToast('Taking longer than expected. You can still use the app.'); 
  }
}, 8000);

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

// Enhanced toast animation removed - integrated into showToast

// Skip GSAP/anime entrance animations inside analytics view to avoid layout thrash
const analyticsView = document.getElementById('analytics-view');
if (analyticsView) {
  analyticsView.querySelectorAll('.card').forEach(el => {
    el.classList.remove('card-hover');
  });
}

console.log('🎨 Animation enhancements loaded!');
