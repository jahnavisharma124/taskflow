# TaskFlow - Project & Task Management Tool

TaskFlow is a full-stack web application designed to help users manage projects, organize tasks, track progress, and generate project reports.

## Features

- User registration and login
- JWT-based authentication
- Role-based access control for administrators, project owners, and members
- Project creation and management
- Sprint management
- Task creation, assignment, priorities, and status updates
- Time logging
- Project reports and progress tracking
- Input validation and error handling
- Login rate limiting for improved security

## Technology Stack

- Frontend: React
- Backend: Node.js and Express.js
- Database: MySQL
- Reporting: Python
- Version Control: Git

## Project Structure

```text
taskflow/
├── backend/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── database/
│   └── schema.sql
├── frontend/
├── README.md
└── .gitignore
```

## Prerequisites

Install the following software before running TaskFlow:

- Node.js and npm
- MySQL Server
- Visual Studio Code
- Python (for report-generation scripts)

## Database Setup

1. Start MySQL Server.
2. Open MySQL Workbench.
3. Open the file `database/schema.sql`.
4. Execute the SQL script.
5. Confirm that the `taskflow` database and its tables have been created.

## Backend Setup

Open a terminal in VS Code and run:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder using `.env.example` as a reference.

Configure the required database settings and a strong `JWT_SECRET`. Keep passwords and secrets private.

Start the backend:

```bash
npm run dev
```

The backend runs on port 5000.

Check the backend health endpoint:

http://localhost:5000/api/health

## Frontend Setup

Open a second terminal in VS Code and run:

```bash
cd frontend
npm install
npm run dev
```

Open the local frontend URL displayed in the terminal. Make sure the frontend is configured to communicate with the backend running on port 5000.

## Testing

The following features have been manually tested:

- User registration and login
- Protected API endpoints
- Role-based access permissions
- Project creation and management
- Sprint creation and management
- Task creation and status updates
- Input validation
- Invalid login handling
- Login rate limiting
- Frontend and backend connectivity
- Dashboard access and data persistence

## Security

- JWT-based authentication
- Role-based authorization
- Backend input validation
- Login rate limiting
- Environment-based secret configuration

Never upload your actual `.env` file, database passwords, or authentication secrets to a public repository.

## Future Improvements

- Automated testing
- Notifications and activity tracking
- Enhanced analytics
- Cloud deployment
- Continuous integration and deployment

## Author

Name: [Jahnavi Sharma]

Course: B.Tech - Information Technology

Project: TaskFlow - Project & Task Management Tool