/**
 * Task Tracker - HTML Template JavaScript
 * This is a static template with basic interactivity
 * For full functionality, use the React/Node.js version
 */

// Navigation between views
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active from all links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Hide all sections
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        const viewId = link.getAttribute('href');
        document.querySelector(viewId).classList.add('active');
    });
});

// View toggle buttons (Week/Month/Year)
document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

// Task checkbox toggle
document.querySelectorAll('.task-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', () => {
        checkbox.classList.toggle('checked');
        const title = checkbox.closest('.task-item')?.querySelector('.task-title');
        if (title) {
            title.classList.toggle('completed');
        }
    });
});

// Mini task checkbox toggle
document.querySelectorAll('.mini-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', () => {
        checkbox.classList.toggle('checked');
    });
});

// Add task form submission
const addTaskForm = document.querySelector('.add-task-form');
if (addTaskForm) {
    addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.querySelector('.task-input');
        const taskTitle = input.value.trim();
        
        if (taskTitle) {
            // Create new task element
            const newTask = document.createElement('div');
            newTask.className = 'task-item';
            newTask.innerHTML = `
                <div class="task-checkbox"></div>
                <div class="priority-dot priority-medium"></div>
                <span class="task-title">${taskTitle}</span>
                <div class="task-actions">
                    <button class="action-btn cancel-btn" title="Cancel">✕</button>
                    <button class="action-btn delete-btn" title="Delete">🗑</button>
                </div>
            `;
            
            // Add event listeners to new task
            const checkbox = newTask.querySelector('.task-checkbox');
            checkbox.addEventListener('click', () => {
                checkbox.classList.toggle('checked');
                const title = newTask.querySelector('.task-title');
                title.classList.toggle('completed');
            });
            
            const cancelBtn = newTask.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', () => {
                newTask.remove();
            });
            
            const deleteBtn = newTask.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => {
                newTask.remove();
            });
            
            // Add to task list
            document.querySelector('.task-list').appendChild(newTask);
            input.value = '';
        }
    });
}

// Delete and cancel task buttons
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-btn')) {
        e.target.closest('.task-item')?.remove();
    }
    
    if (e.target.classList.contains('cancel-btn')) {
        e.target.closest('.task-item')?.remove();
    }
});

// Modal functionality
const taskModal = document.getElementById('taskModal');
const replanModal = document.getElementById('replanModal');

// Close modal when clicking X button
document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
    });
});

// Close modal when clicking outside
[taskModal, replanModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
});

// Open task modal when clicking task item
document.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('dblclick', () => {
        if (taskModal) {
            taskModal.classList.add('active');
        }
    });
});

// Modal button actions
const modalSaveBtn = document.querySelector('.modal-footer .btn-primary');
if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
        if (taskModal) {
            taskModal.classList.remove('active');
        }
    });
}

const modalCancelBtn = document.querySelector('.modal-footer .btn-secondary');
if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', () => {
        if (taskModal) {
            taskModal.classList.remove('active');
        }
    });
}

// Replan modal actions
document.querySelectorAll('.action-buttons .btn-outline').forEach((btn, index) => {
    btn.addEventListener('click', () => {
        if (replanModal) {
            replanModal.classList.remove('active');
        }
        console.log(`Action ${index + 1} selected`);
    });
});

// Initialize - show replan modal on page load (commented out by default)
// Uncomment to show replan modal on load
// window.addEventListener('load', () => {
//     if (replanModal) {
//         replanModal.classList.add('active');
//     }
// });

console.log('Task Tracker Template initialized');
console.log('This is a static HTML template. For full functionality with database, use the React/Node.js version.');
