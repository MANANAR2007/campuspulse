# CampusPulse 🏛️

**A better way to report, track, and resolve campus issues.**

CampusPulse is a campus issue-reporting and management platform that connects students, administrators, and department staff in one place. Instead of campus problems getting lost in messages or being reported repeatedly without updates, CampusPulse makes it easier to report an issue, route it to the right department, and track it until it is resolved.

🔗 **Live Website:** [campuspulse-pv2m.onrender.com](https://campuspulse-pv2m.onrender.com/)

🎬 **Demo Video:** [Watch CampusPulse in action](https://drive.google.com/file/d/1Ogk_e6xWHXmWM6Jr173aQbEQetq6w8xq/view?usp=sharing)

## What can you do with CampusPulse?

### Report and track campus issues
Students can report problems with a description, category, location, and supporting images. They can follow progress, participate in discussions, confirm that an issue has been fixed, or request that it be reopened if the problem remains.

### Keep repeated complaints organized
When multiple students report the same problem, CampusPulse can suggest related reports and help organize them around a shared incident. This makes recurring issues easier to identify without losing the information from individual reports.

### Route issues to the right department
Administrators can assign reports to departments such as IT, Electrical, Plumbing, Housekeeping, or Campus Safety. They can also assign individual staff members, redirect incorrectly routed issues, and review the history of assignment changes.

### Give staff a dedicated workspace
Department staff have their own work queue for assigned issues. They can track pending work, update statuses, add internal notes, and record how a problem was resolved.

### Handle sensitive reports carefully
Reports can have different visibility levels:

- **Public:** Visible in the campus feed.
- **Department-only:** Restricted to the reporter, administrators, and authorized staff in the responsible department.
- **Confidential:** Restricted to the reporter, administrators, and explicitly authorized staff.

Internal staff notes are kept separate from public discussions so that operational details are not automatically exposed to students.

### Track priorities and deadlines
Issues can be marked as low, normal, high, or critical priority. CampusPulse tracks response and resolution deadlines, highlights overdue work, and maintains a history of important status changes.

### Stay updated
Notifications and Socket.IO support real-time updates for relevant activity, helping users stay informed without constantly refreshing the application.

### Understand campus-wide issues
The administrative dashboard provides an overview of issue activity, departmental workloads, recurring problem areas, and items requiring attention.

## Built with

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, JavaScript, React Router, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, HttpOnly cookies, bcryptjs |
| Real-time communication | Socket.IO |
| Image storage | Cloudinary, Multer |
| Security | Express rate limiting, CORS, input validation and role-based access control |
| Deployment | Render |

## How the project is structured

```text
campuspulse/
├── client/                  # React frontend
│   └── src/
│       ├── components/      # Shared UI components
│       ├── context/         # Authentication and socket state
│       ├── services/        # API integration
│       └── pages/           # Student, staff and admin pages
├── server/                  # Express backend
│   └── src/
│       ├── config/          # Database and environment configuration
│       ├── controllers/     # Application logic
│       ├── middleware/      # Authentication and request handling
│       ├── models/          # Mongoose models
│       ├── routes/          # API routes
│       └── utils/           # Shared utilities
├── render.yaml              # Render deployment configuration
├── package.json             # Root scripts
└── README.md
```

## Running locally

### Prerequisites

- Node.js 18 or later
- npm
- A MongoDB Atlas connection string or another compatible MongoDB deployment
- Cloudinary credentials if you want to use image uploads

### 1. Clone the repository

```bash
git clone https://github.com/MANANAR2007/campuspulse.git
cd campuspulse
```

### 2. Install dependencies

```bash
npm install
npm install --prefix server
npm install --prefix client
```

### 3. Configure environment variables

Create a `server/.env` file using `server/.env.example` as a reference.

At minimum, configure the database connection, JWT secret, and the settings required by the backend. For local development, the configuration will generally include:

```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Use your own credentials and check `server/src/config/index.js` and `server/.env.example` for the complete list of required environment variables. Cloudinary variables are needed when using Cloudinary uploads.

**Keep your `.env` files out of Git. Never commit database credentials, API keys, or JWT secrets.**

### 4. Start the application

From the project root, run:

```bash
npm run dev
```

By default, the frontend runs at [http://localhost:5173](http://localhost:5173) and the backend runs at [http://localhost:5000](http://localhost:5000).

### 5. Run the tests

```bash
npm test
```

The project's test suite covers core functionality such as authentication, role-based access, issue handling, department routing, staff workflows, confidentiality, notifications, and audit logging.

## Deployment

CampusPulse is deployed on Render.

- **Live application:** [https://campuspulse-pv2m.onrender.com/](https://campuspulse-pv2m.onrender.com/)
- **Demo video:** [Watch the demo on Google Drive](https://drive.google.com/file/d/1Ogk_e6xWHXmWM6Jr173aQbEQetq6w8xq/view?usp=sharing)

The production deployment requires the appropriate environment variables, a reachable MongoDB database, and valid Cloudinary credentials for image uploads.

## Why CampusPulse?

CampusPulse is built around a simple idea: reporting a campus problem should be the beginning of its resolution, not the end of the conversation.

By bringing reporting, department assignment, communication, deadlines, and progress tracking together, the platform aims to make campus issue management clearer for students and more organized for the people responsible for fixing things.

---

**CampusPulse — Report it. Route it. Resolve it.**
