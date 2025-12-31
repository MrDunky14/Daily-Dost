# Daily-Dost 🎓✨

**Daily-Dost** is a comprehensive Student Habit & Study Tracker designed to help students manage their daily lives, studies, and well-being in a gamified and engaging way.

![Daily-Dost Banner](https://via.placeholder.com/1200x400?text=Daily-Dost+Student+Tracker) 
*(Replace with actual screenshot)*

## 🚀 Features

Daily-Dost combines productivity tools with gamification to keep you motivated:

### 📊 Productivity & Tracking
- **Habit Tracker**: Create and track habits across categories like Study, Reading, Health, and Mindfulness.
- **Pomodoro Timer**: Built-in focus timer with customizable work/break intervals.
- **Assignment & Grade Tracker**: Keep track of your academic deadlines and performance.
- **Bunk-o-Meter**: Strategically manage your attendance.
- **Expense Tracker**: Monitor your daily spending with budget limits.
- **Sleep Logger**: Track your sleep patterns for better health.
- **Sticky Notes**: Quick digital notes for reminders and ideas.

### 🎮 Gamification
- **Level Up**: Earn XP for completing habits and tasks.
- **Achievements**: Unlock badges like "Week Warrior", "Night Owl", and "Perfect Day".
- **Streaks**: Maintain streaks to boost your progress.

### 📈 Analytics
- **Visual Charts**: View trends and correlations between your habits, sleep, and grades using interactive charts.

## 🛠️ Technologies Used

- **Frontend**: HTML5, JavaScript (ES6+), Tailwind CSS
- **Backend / Database**: Firebase (Authentication, Firestore)
- **Visualization**: Chart.js
- **Animations**: Anime.js, GSAP
- **Icons & Fonts**: Google Fonts, Material Symbols

## 📦 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/daily-dost.git
   cd daily-dost
   ```

2. **Run the Application**
   Since this is a static web application, you can simply open `index.html` in your browser.
   
   For a better experience, use a local development server:
   
   *Using Python:*
   ```bash
   python -m http.server 8000
   ```
   Then open `http://localhost:8000` in your browser.

   *Using VS Code Live Server:*
   - Install the "Live Server" extension.
   - Right-click `index.html` and select "Open with Live Server".

## 🎨 Customization

- **Themes**: The app supports a dark mode with a "glassmorphism" aesthetic.
- **Firebase Config**: The current configuration is set up for the demo. To use your own backend:
  1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
  2. Enable **Authentication** (Google & Anonymous) and **Firestore Database**.
  3. Replace the `firebaseConfig` object in `app.js` with your own credentials.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ for students everywhere.
