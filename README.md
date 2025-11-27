# Showtime Employee Portal

A comprehensive full-stack employee management system built with FastAPI backend and React frontend, featuring real-time communication, attendance tracking, and employee management capabilities.

## 🚀 Features

### Core Functionality
- **Employee Management**: Complete CRUD operations for employee data
- **User Authentication**: Secure login/signup with password hashing
- **Real-time Communication**: WebSocket-based chat system with channels and direct messages
- **Attendance Tracking**: Daily attendance recording and reporting
- **File Management**: Upload and download functionality
- **Notifications**: Real-time notifications for messages and updates
- **User Profiles**: Comprehensive employee profile management

### Communication Features
- **Channel-based Chat**: Department and team-specific channels
- **Direct Messaging**: One-on-one and group conversations
- **Message Reactions**: Interactive message reactions
- **File Sharing**: Share files within chats
- **Message Management**: Delete messages for yourself or everyone
- **Online Status**: Real-time user presence indicators

### Attendance & Reporting
- **Daily Attendance**: Record check-in/check-out times
- **Manager Reports**: Team attendance summaries
- **Multiple Views**: Day, week, and month attendance reports
- **Late Tracking**: Monitor employee punctuality

### Administrative Features
- **Department Management**: Organize employees by departments and teams
- **Role-based Access**: Different permissions for managers and employees
- **Profile Pictures**: Employee photo management
- **Data Export**: Attendance data export capabilities

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB (Multiple databases for different concerns)
- **Authentication**: bcrypt password hashing
- **Real-time**: WebSocket support
- **File Handling**: Static file serving
- **CORS**: Cross-origin resource sharing enabled

### Frontend
- **Framework**: React 18 with Create React App
- **UI Libraries**: Material-UI, Radix UI components
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Charts**: MUI X Charts
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React, React Icons

### Development Tools
- **Build Tool**: CRACO (Create React App Configuration Override)
- **Package Manager**: npm/yarn
- **Version Control**: Git

## 📁 Project Structure

```
showtime_employee_portal/
├── backend/
│   ├── server.py                 # Main FastAPI application
│   ├── populate_employees.py     # Employee data seeding
│   ├── populate_chat_employees.py # Chat data seeding
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── public/                   # Static assets
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── Header.js         # Navigation header
│   │   │   ├── Login.js          # Authentication component
│   │   │   ├── UserProfile.js    # User profile management
│   │   │   ├── InternalCommunication.js # Chat interface
│   │   │   ├── Attence1.js       # Attendance tracking
│   │   │   ├── AttedenceReport.js # Attendance reports
│   │   │   ├── NotificationSystem.js # Notification management
│   │   │   └── ...
│   │   ├── Services/
│   │   │   └── api.js            # API service layer
│   │   ├── data/
│   │   │   └── mock.js           # Mock data for development
│   │   └── ...
│   ├── package.json              # Frontend dependencies
│   └── tailwind.config.js        # Tailwind configuration
├── tests/                        # Test files
├── TODO.md                       # Development tasks
└── README.md                     # This file
```

## 🗄️ Database Architecture

The application uses multiple MongoDB databases:

- **Main Database**: General application data
- **STC_Employees**: Employee information organized by teams
- **employee_attendance**: Attendance records and reports
- **Internal_communication**: Chat messages and notifications

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Python (v3.8 or higher)
- MongoDB (local or Atlas)
- Git

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   Create a `.env` file in the backend directory with:
   ```
   MONGO_URL=mongodb://localhost:27017/your_database
   DB_NAME=your_main_db
   ```

4. **Run the backend server**:
   ```bash
   python server.py
   ```
   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```
   The application will open at `http://localhost:3000`

### Database Population

To populate the database with sample data:

```bash
python populate_employees.py
python populate_chat_employees.py
```

## 🔧 Configuration

### Environment Variables

**Backend (.env)**:
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Main database name

**Frontend (.env.development)**:
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:8000)

## 📊 API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/signup` - User registration

### Employees
- `GET /api/employees` - Get all employees
- `GET /api/employees/email/{email}` - Get employee by email
- `PUT /api/employees/{id}/profile-picture` - Update profile picture

### Communication
- `GET /api/messages` - Get messages
- `POST /api/messages/{id}/delete` - Delete message
- `WebSocket /api/ws/{client_id}` - Real-time messaging

### Attendance
- `POST /api/attendance-report` - Save attendance data
- `GET /api/attendance-report` - Get attendance reports
- `GET /api/attendance-report/user/{code}` - Get user attendance

## 🧪 Testing

Run frontend tests:
```bash
cd frontend
npm test
```

## 🚢 Deployment

### Backend Deployment
1. Set production environment variables
2. Use a production ASGI server like Uvicorn
3. Configure MongoDB Atlas for production database

### Frontend Deployment
1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Serve the `build` folder with a static server
3. Configure API URLs for production

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 Current Development Status

See [TODO.md](TODO.md) for current development tasks and planned features.

## 📄 License

This project is proprietary software for Showtime Communications.

## 👥 Support

For support or questions, please contact the development team.

## Google Sheets and MongoDB Integration Guide

This guide provides instructions on how to integrate Google Sheets with `server.py` and connect to a MongoDB database.

### Google Sheets Integration

To allow the application to read data from a Google Sheet, you need to use a Google Service Account.

#### Steps:

1.  **Create a Google Service Account:**
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project or select an existing one.
    *   Navigate to **IAM & Admin > Service Accounts**.
    *   Click **+ CREATE SERVICE ACCOUNT**.
    *   Give it a name and description, then click **CREATE AND CONTINUE**.
    *   Grant the service account the **Viewer** role.
    *   Click **CONTINUE**, then **DONE**.

2.  **Create and Download JSON Credentials:**
    *   Find the service account you just created in the list.
    *   Click the three-dot menu under **Actions** and select **Manage keys**.
    *   Click **ADD KEY > Create new key**.
    *   Select **JSON** as the key type and click **CREATE**. A JSON file containing your credentials will be downloaded.

3.  **Share Your Google Sheet:**
    *   Open the JSON file you downloaded. Find the `client_email` value (e.g., `your-service-account@your-project.iam.gserviceaccount.com`).
    *   Open your Google Sheet.
    *   Click the **Share** button in the top-right corner.
    *   Paste the `client_email` into the sharing dialog and grant it at least **Viewer** access.

4.  **Set Environment Variable:**
    *   The application reads the Google Sheets credentials from an environment variable named `GOOGLE_SHEETS_CREDENTIALS`.
    *   You must set this variable to the **entire content** of the JSON credentials file.

    **Example (`.env` file):**
    ```
    GOOGLE_SHEETS_CREDENTIALS='{"type": "service_account", "project_id": "...", ...}'
    ```

5.  **Usage in `server.py`:**
    *   The `/api/sheets/data` endpoint in `server.py` calls the `get_data_from_sheet` function from `sheets.py` to fetch and parse the data.

### MongoDB Connection

The application uses MongoDB as its database.

#### Steps:

1.  **Get MongoDB Connection String:**
    *   You need a valid MongoDB connection string (URI) from your MongoDB provider (e.g., MongoDB Atlas).
    *   The URI typically looks like this: `mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority`

2.  **Set Environment Variable:**
    *   The application reads the MongoDB URI from environment variables. The main database connection is defined in `database.py`.
    *   Set the following variables in your environment (e.g., in a `.env` file):

    ```
    # Main application database
    MAIN_DB_URI=mongodb+srv://...

    # Attendance database
    ATTENDANCE_DB_URI=mongodb+srv://...
    ```

3.  **Connection Logic:**
    *   The file `backend/database.py` contains the logic for establishing the connection to the MongoDB server and selecting the appropriate databases.
    *   The database objects are then imported and used throughout `server.py` to interact with the collections.
