# Library Management System

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

A polished, full-stack Library Management System designed as a showcase of modern web development practices. It features a responsive UI, token-based authentication, book inventory management, and borrow history tracking. The frontend is cleanly decoupled from the lightweight Python/Flask backend.

## 🚀 Features

- **Responsive Dashboard:** At-a-glance metrics for Total, Available, and Issued books.
- **Secure Authentication:** Token-based admin login with bcrypt password hashing.
- **Book Management:** Add, delete, and search for books by title, author, or availability status.
- **Borrow History:** Issue books to specific borrowers, track return dates, and view a comprehensive history log.
- **Optimized UX:** Skeleton loading states, smooth toast notifications, and non-blocking background API connections.

## 📸 Screenshots
*(Add your screenshots here before publishing)*

| Dashboard Overview | Login Modal |
| ------------------ | ----------- |
| `![Dashboard](screenshots/dashboard.png)` | `![Login](screenshots/login.png)` |

| Book Management | Borrow History |
| --------------- | -------------- |
| `![Management](screenshots/management.png)` | `![History](screenshots/history.png)` |

## 🏗️ Architecture

The project follows a decoupled client-server architecture:
- **Frontend (`/frontend`)**: Pure HTML, CSS, and Vanilla JavaScript. Deployed globally via Netlify.
- **Backend (`/backend`)**: Flask API utilizing Blueprints for modular routing (`auth`, `books`, `history`, `dashboard`). Hosted on Render.
- **Database**: SQLite3, keeping the deployment lightweight and easily portable.

## ⚙️ Installation & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/library-management-system.git
cd library-management-system
```

### 2. Set up the Backend
```bash
cd backend
python -m venv .venv
# On Windows use: .venv\Scripts\activate
# On Mac/Linux use: source .venv/bin/activate
pip install -r requirements.txt
```

Set up your environment variables by copying the example file:
```bash
cp ../.env.example .env
```

Start the Flask server:
```bash
python app.py
```
*The API will run at `http://127.0.0.1:5000/api`*

### 3. Set up the Frontend
Open a new terminal in the `frontend` folder and start a static server:
```bash
cd frontend
python -m http.server 5500
```
Open `http://127.0.0.1:5500` in your browser. 

*Note: The frontend connects to `http://127.0.0.1:5000/api` by default.*

## 🌍 Deployment

- **Frontend:** Connect your GitHub repository to [Netlify](https://www.netlify.com/), set the publish directory to `frontend/`.
- **Backend:** Connect your repository to [Render](https://render.com/), set the root directory to `backend/`, build command to `pip install -r requirements.txt`, and start command to `gunicorn app:app`.
- **Environment Variables:** Ensure you set `CORS_ORIGINS` in your Render environment to match your Netlify URL, and set your `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

## 📂 Folder Structure
```text
Library Management System/
├── backend/
│   ├── routes/          # API route blueprints
│   ├── app.py           # Flask application entry point
│   ├── db.py            # SQLite connection and schema logic
│   ├── utils.py         # Authentication and utility functions
│   └── requirements.txt # Python dependencies
├── frontend/
│   ├── index.html       # Main UI markup
│   ├── styles.css       # Modern styling & animations
│   ├── app.js           # Core frontend logic and API integration
│   └── config.js        # Environment-aware URL configuration
├── screenshots/         # UI showcase images
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # Project documentation
```

## 👨‍💻 Author
**Your Name**  
*Aspiring Full Stack Developer*  
[LinkedIn](#) | [GitHub](#)