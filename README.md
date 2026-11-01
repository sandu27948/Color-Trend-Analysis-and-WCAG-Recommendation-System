# Color Trend System

Follow these steps to download and run the complete application on your computer.

## Before you start

Install [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org/) (which includes npm).

## 1. Clone the project

Open PowerShell or a terminal. Replace `<repository-url>` with the Git URL for this project, then run:

```powershell
git clone <repository-url> color_trend_system
cd color_trend_system
```

Keep this terminal open in the `color_trend_system` project folder for the next step.

## 2. Install project dependencies

In the same terminal, install the backend dependencies:

```powershell
cd backend
npm install
```

Return to the project folder and install the frontend dependencies:

```powershell
cd ..
cd frontend
npm install
```

## 3. Start the application

The backend and frontend must run at the same time. Open **two terminals** in the project folder.

In **Terminal 1**, start the backend:

```powershell
cd backend
node server.js
```

Leave Terminal 1 running. The backend is available at `http://localhost:5000`.

In **Terminal 2**, start the frontend:

```powershell
cd frontend
npm start
```

The frontend opens at `http://localhost:3000`. If it does not open automatically, enter that address in your browser. Keep both terminals running while you use the application.
