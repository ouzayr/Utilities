# Task Tracker - HTML Template

This folder contains a **static HTML-only version** of the Task Tracker application. It's useful for:
- Offline reference and mockups
- Static site deployment
- Template for other frameworks
- Understanding the UI structure

## Files

- **index.html** - Main application structure
- **styles.css** - Complete styling with no dependencies
- **script.js** - Basic JavaScript interactivity
- **README.md** - This file

## Features Included

✅ Daily journal view  
✅ Weekly planner with day cards  
✅ Monthly/Yearly view buttons  
✅ Dashboard with statistics  
✅ Task management (add, complete, delete)  
✅ Priority color coding (Low/Medium/High/Urgent)  
✅ Modal for task details  
✅ Morning replan modal  
✅ Responsive design  
✅ Dark mode ready (can be extended)  

## Features NOT Included

❌ Database persistence (static data only)  
❌ Real API integration  
❌ User authentication  
❌ Drawing canvas for notes  
❌ File attachments  

## Usage

### Local Development
1. Open `index.html` in a web browser
2. Interact with the UI elements
3. Add/complete/delete tasks (stored in memory only)

### Deploying as Static Site
```bash
# Copy all files to your static hosting
cp -r templates/* /path/to/hosting/
```

### Extending with Backend
1. Replace the placeholder data with real data from an API
2. Update `script.js` to fetch from your backend
3. Implement POST/PUT/DELETE API calls

### Example: Fetching Real Data
```javascript
// Replace this in script.js
async function fetchTasks() {
    const response = await fetch('http://your-backend.com/api/tasks');
    const tasks = await response.json();
    // Render tasks to UI
}
```

## Customization

### Change Priority Colors
Edit `styles.css`:
```css
--priority-low: #3b82f6;      /* Blue */
--priority-medium: #f97316;   /* Orange */
--priority-high: #ef4444;     /* Red */
--priority-urgent: #a855f7;   /* Purple */
```

### Change Fonts
Edit `styles.css`:
```css
--font-serif: 'Your Font', serif;
--font-sans: 'Your Font', sans-serif;
```

### Adjust Layout
- Sidebar width: Change `width: 200px;` in `.sidebar`
- Main content padding: Change `--spacing-*` variables
- Grid columns: Change `grid-template-columns` in `.week-grid`

## Browser Support

✅ Chrome/Edge (Latest)  
✅ Firefox (Latest)  
✅ Safari (Latest)  
✅ Mobile browsers  

## Notes

- This is a **template only** with static data
- For full functionality, use the React + Node.js + PostgreSQL version
- All task data resets on page refresh
- No internet connection required
- No build process needed

## Full Application

For the complete Task Tracker with:
- PostgreSQL database
- React frontend
- Express API
- User authentication
- Real persistence

Refer to the parent directory and follow the main setup instructions.
