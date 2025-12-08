# Quran Classes Management System

نظام إدارة حلقات القرآن الكريم

## Project Structure

```
QuranClasses-webProject/
│
├── index.html              # Main HTML file (entry point)
├── styles.css              # All CSS styles
├── firebase-config.js      # Firebase configuration and exports
│
├── js/
│   ├── main.js            # Main navigation and role selection
│   ├── admin.js           # Admin section functionality
│   ├── teacher.js         # Teacher section functionality
│   └── quran-data.js      # Quran Surahs data (114 surahs)
│
└── index-backup.html      # Backup of original single-file version
```

## File Descriptions

### index.html
- Main HTML structure
- Role selection page
- Admin, Teacher, and Student sections
- Minimal inline JavaScript (only references to external modules)

### styles.css
- All styling for the application
- Role selection styles
- Admin/Teacher dashboard styles
- Tables, forms, and button styles
- Responsive design elements

### firebase-config.js
- Firebase initialization
- Firestore configuration
- Export of all Firebase functions used throughout the app
- Centralized database connection

### js/main.js
- Role selection logic
- Navigation between sections
- Tab switching
- Logout functionality

### js/admin.js
- Student management (add, delete, view)
- Class management
- Reports viewing
- Student progress tracking
- All admin-specific functions

### js/teacher.js
- Student selection
- **New elegant assessment form with:**
  - ✨ Beautiful gradient design (purple theme)
  - ➕➖ Plus/minus buttons for scores
  - 📖 Quran Surah dropdowns (all 114 surahs)
  - 🔢 Dynamic verse number selection
  - ⚠️ Real-time struggle indicator
  - 💾 Smooth save animation
- Past reports viewing
- Track student struggles (incomplete scores)
- All teacher-specific functions

### js/quran-data.js
- Complete list of 114 Quran Surahs
- Surah names in Arabic
- Number of verses for each surah
- Used for lesson and revision inputs

## Features

### Admin Section
- ✅ Add new students
- ✅ Delete students with confirmation
- ✅ View students by class
- ✅ View all progress reports
- ✅ Three-tab interface (Students, Reports, Classes)

### Teacher Section
- ✅ Select student from dropdown
- ✅ **Enhanced Assessment Form:**
  - Beautiful gradient purple design
  - Interactive +/- buttons for scoring
  - Dropdown lists for all 114 Quran Surahs
  - Auto-populated verse numbers based on selected surah
  - Real-time struggle detection indicator
  - Color-coded alerts (green = good, red = struggling)
- ✅ View past reports
- ✅ Track student struggles (incomplete scores)
- ✅ Automatic date tracking

### Student Section
- 🔄 Coming soon

## How to Use

1. Open `index.html` in a web browser
2. Select your role (Admin, Teacher, or Student)
3. Navigate through the interface based on your role

## Firebase Collections Structure

### users
```
{
  userId: "string",
  name: "string",
  role: "student|teacher|admin",
  classId: "string",
  createdAt: timestamp
}
```

### classes
```
{
  classId: "string",
  className: "string",
  teacherId: "string",
  studentIds: ["array of student IDs"],
  createdAt: timestamp
}
```

### studentProgress/{studentId}/dailyReports/{dateId}
```
{
  studentId: "string",
  studentName: "string",
  date: timestamp,
  asrPrayerScore: number (0-5),
  lessonScore: number (0-5),
  lessonFrom: "string",
  lessonTo: "string",
  lessonSideScore: number (0-5),
  lessonSideText: "string",
  revisionScore: number (0-5),
  revisionFrom: "string",
  revisionTo: "string",
  readingScore: number (0-5),
  behaviorScore: number (0-5),
  totalScore: number (0-30),
  missingFields: ["array"],
  isComplete: boolean
}
```

## Development Notes

- All JavaScript modules use ES6 imports/exports
- Firebase v9 modular SDK
- RTL (Right-to-Left) support for Arabic
- Responsive design
- Clean separation of concerns

## Backup

The original single-file version is backed up as `index-backup.html`

## Future Enhancements

- Student login and personal dashboard
- Teacher assignment to specific classes
- Advanced reporting and analytics
- Export reports to PDF
- Email notifications
- Mobile app version
