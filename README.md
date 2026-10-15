# TaskFlow – Project & Task Management Tool

TaskFlow is a full-stack web application designed to help users manage projects, organize tasks, track progress, log work hours, and generate project reports. It includes JWT-based authentication and role-based access control to help protect project data.

## Features

- User registration and login
- JWT-based authentication
- Role-based access control for administrators, project owners, and members
- Project creation and management
- Sprint creation and management
- Task assignment, priorities, and status updates
- Work-hour logging and tracking
- Project reports and progress tracking
- Input validation and centralized error handling
- Login rate limiting
- Automated API smoke tests

## Technology Stack

- **Frontend:** React
- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Authentication:** JSON Web Tokens (JWT)
- **Testing:** Node.js automated smoke tests
- **Version Control:** Git and GitHub

## Project Structure

    taskflow/
    ├── backend/
    │   ├── src/
    │   ├── package.json
    │   └── .env.example
    ├── database/
    │   └── schema.sql
    ├── frontend/
    ├── tests/
    │   └── smoke-test.js
    ├── README.md
    └── .gitignore

## Prerequisites

- Node.js and npm
- MySQL Server
- MySQL Workbench (optional)
- Visual Studio Code

## Local Setup

### 1. Clone the Repository

    git clone https://github.com/jahnavisharma124/taskflow.git
    cd taskflow

If the latest code is on the `phase-6-polish` branch, switch to it:

    git checkout phase-6-polish

### 2. Set Up the Database

1. Start MySQL Server.
2. Open `database/schema.sql` in MySQL Workbench.
3. Execute the SQL script.
4. Verify that the `taskflow` database and its tables have been created.

### 3. Configure and Start the Backend

    cd backend
    npm install

Create a `.env` file inside the `backend` folder using `.env.example` as a reference. Set the database credentials and a strong, unique `JWT_SECRET`.

Start the API:

    npm run dev

The backend runs on port 5000 by default.

**Health Check:** http://localhost:5000/api/health

### 4. Start the Frontend

Open a second terminal from the project root:

    cd frontend
    npm install
    npm run dev

Open the local URL displayed in the terminal. Ensure the frontend API configuration points to the running backend.

## Testing

The automated API smoke-test suite completed **70 checks with 0 failures and 0 warnings** in the tested local environment.

Coverage includes authentication, role-based permissions, projects, sprints, tasks, comments, time logging, reports, input validation, and error handling.

## Security

- JWT-based authentication
- Role-based authorization
- Backend input validation
- Login rate limiting
- Environment-based configuration for secrets

Never commit your actual `.env` file, database passwords, JWT secrets, or other credentials.

## Future Improvements

- Expanded automated test coverage
- Notifications and activity tracking
- Enhanced analytics and dashboards
- Cloud deployment
- Continuous integration and continuous deployment (CI/CD)

## Author

**Jahnavi Sharma**

B.Tech – Information Technology

**Project:** TaskFlow – Project & Task Management Tool

**GitHub:** https://github.com/jahnavisharma124/taskflow
