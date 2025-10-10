## 🚀 DailyDost: Student Habit & Study Tracker

DailyDost is a web application designed to help students master their daily habits, track academic progress, and manage their study sessions with an integrated Pomodoro Timer. It uses gamification (XP and Levels) to make productivity engaging and offers analytics to connect wellness to academic performance.

### ✨ Features

  * **Habit Tracker:** Log daily habits, set difficulty levels, track streaks, and mark habits as "Exam Prep" with a countdown.
  * **Gamified Progress:** Earn **XP** (Experience Points) for completing habits and **Level Up** your profile.
  * **Study Zone:** Integrated **Pomodoro Timer** for focused study sessions (Work, Short Break, Long Break modes).
  * **Assignment Tracker:** Easily manage and visualize upcoming assignments and due dates.
  * **Academic & Wellness Analytics:**
      * **Correlation Chart:** See how your **Grades**, **Mood**, and **Sleep** hours trend together.
      * **Habit Deep Dive:** View a habit's **completion trend** and a monthly **Activity Heatmap**.
  * **Mental Health Check-in:** Log your daily **Mood** and **Stress Level**.
  * **Rewards & Achievements:** Unlock achievements like "Week Warrior" and "Perfect Day" to stay motivated.
  * **Dark Mode:** Built-in toggle for a comfortable viewing experience.

-----

### 🛠️ Technology Stack

DailyDost is a single-page application built with modern web technologies:

  * **Frontend:**
      * **HTML5 / CSS3:** Structure and styling.
      * **Tailwind CSS:** Utility-first CSS framework for rapid UI development.
      * **Vanilla JavaScript (ESM):** Application logic and DOM manipulation.
  * **Backend / Database:**
      * **Google Firebase:** Used for authentication (`firebase-auth`) and real-time database (`firestore`).
      * **Firebase Authentication:** Handles user authentication (currently via anonymous sign-in).
  * **Charting:**
      * **Chart.js:** For rendering the correlation and trend graphs.
      * **chartjs-adapter-date-fns:** To handle time series data on the charts.

-----

### 📂 File Structure

The project is minimalist, focusing on core functionality with three main files:

| File Name | Description |
| :--- | :--- |
| `index.html` | The main HTML file. It includes the full layout, imports CSS/JS/Libraries, and defines all UI components. |
| `styles.css` | Defines the CSS custom properties for **Light/Dark Mode** themes and base styling, including component transitions and animations. |
| `app.js` | Contains all the core application logic: Firebase initialization, state management, CRUD operations for habits/assignments, rendering functions, and event listeners. |

-----

### 💡 Key Code Highlights

#### 1\. Theme Variables (`styles.css`)

The application uses CSS variables for easy theming and supports dark mode via a `[data-theme='dark']` attribute selector on the `<html>` element.

```css
:root { /* Light Theme */
    --background: #f7f9fb;
    --foreground: #0f172a;
    /* ... other variables ... */
}

[data-theme='dark'] {
    --background: #0f172a;
    --foreground: #f8fafc;
    /* ... dark variables ... */
}
```

#### 2\. Habit Progress Calculation (`app.js`)

The daily progress is calculated based on the habits scheduled for today versus the completed habits logged for the current date.

```javascript
const renderDailyProgress = () => {
    // ... logic to get habitsForToday and todayStr ...
    
    // Filter habits scheduled for today
    const habitsForToday = habits.filter(h => 
        h.frequency?.days?.includes('everyday') || h.frequency?.days?.includes(dayOfWeek)
    );
    
    if (habitsForToday.length === 0) { /* ... handle no habits ... */ return; }
    
    const completedCount = habitsForToday.filter(h => 
        habitLogs[todayStr]?.[h.id]?.status === 'completed'
    ).length;
    
    const percentage = Math.round((completedCount / habitsForToday.length) * 100);
    updateProgressCircle(percentage, circle, text);
};
```

#### 3\. Gamification Logic (`app.js`)

XP is granted upon habit completion, and the system automatically handles Level Up logic and updating the user profile in Firestore.

```javascript
const addXP = async (habitId) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const xpGained = XP_PER_DIFFICULTY[habit.difficulty] || 10;
    
    // ... calculate newXP, newLevel, and xpForNextLevel ...
    
    if (newXP >= xpForNextLevel) {
        newLevel++;
        newXP -= xpForNextLevel;
        showToast(`Level Up! You've reached Level ${newLevel}!`);
    }
    await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/userProfile`), 
        { xp: newXP, level: newLevel });
};
```

-----

### 🚀 Getting Started

To run this project locally:

1.  **Clone the repository:**

    ```bash
    git clone [your-repo-link]
    cd DailyDost
    ```

2.  **Open in Browser:** Open `index.html` directly in your web browser, or use a simple local web server (like VS Code's Live Server extension) due to the use of ES modules and Firebase SDKs.

3.  **Firebase Configuration:** The `app.js` file contains a placeholder `firebaseConfig`. To connect it to your own Firebase project, update these keys:

    ```javascript
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID", // Daily-Dost placeholder
        // ... rest of the config
    };
    ```
    
### 🚀 Deployed Project

To access this web-app anywhere on any device:

**Click on the given link or paste it in your browser:**

    https://mrdunky14.github.io/Daily-Dost/
