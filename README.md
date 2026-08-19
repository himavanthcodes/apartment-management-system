# Apartment Management System

A web-based apartment management system designed to simplify residential community operations such as water reading management, expenses, monthly billing, and payment tracking.

The system provides separate workflows for administrators and residents, with Firebase used for persistent data storage.

## Features

### Admin Dashboard

* Manage apartment water readings
* Track monthly water consumption
* Manage apartment expenses
* Generate and manage monthly bills
* Track resident payments
* View and manage billing information
* Maintain apartment-related records

### Resident Portal

* View monthly charges
* View billing information
* Track payment records
* Access personal apartment-related information

### Water Management

* Record current water readings
* Maintain previous reading information
* Calculate water consumption
* Track water usage across billing periods

### Expense Management

* Record apartment expenses
* Track expense categories
* Calculate monthly expense contributions
* Include expenses in monthly billing calculations

### Billing

* Generate monthly bills
* Calculate charges based on apartment expenses and water usage
* View individual resident charges
* View overall monthly billing information

### Payment Management

* Record resident payments
* Track payment status
* Maintain payment history

## Technology Stack

### Frontend

* HTML5
* JavaScript
* Tailwind CSS
* Responsive UI

### Backend & Database

* Firebase
* Firebase Firestore

### Development

* Trickle AI
* Visual Studio Code
* Git
* GitHub

## Project Structure

```text
apartment-management-system/
│
├── components/
│   ├── SharedUI.js
│   └── admin/
│       ├── ExpensesManager.js
│       ├── MonthlyBillsManager.js
│       ├── PaymentsManager.js
│       └── WaterReadingsManager.js
│
├── utils/
│   ├── api.js
│   └── seedData.js
│
├── trickle/
│   ├── database/
│   ├── notes/
│   └── rules/
│
├── admin.html
├── admin-app.js
├── index.html
├── app.js
├── user.html
└── user-app.js
```

## System Architecture

```text
                    Apartment Management System
                              │
              ┌───────────────┴───────────────┐
              │                               │
        Admin Dashboard                 Resident Portal
              │                               │
      ┌───────┼────────┐               ┌──────┼──────┐
      │       │        │               │      │      │
    Water  Expenses  Billing        Bills  Payments  Records
      │       │        │               │      │
      └───────┴────────┴───────────────┴──────┘
                              │
                         Firebase
                         Firestore
```

## Key Modules

| Module          | Purpose                                          |
| --------------- | ------------------------------------------------ |
| Water Readings  | Record and calculate apartment water consumption |
| Expenses        | Track community expenses                         |
| Monthly Bills   | Generate and manage monthly charges              |
| Payments        | Record and track resident payments               |
| Admin Dashboard | Centralized management interface                 |
| Resident Portal | Resident-facing billing and payment information  |

## Data Management

The application uses Firebase Firestore for persistent application data.

The system is designed around monthly billing cycles, where water usage, apartment expenses, and payment information contribute to the overall billing workflow.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/himavanthcodes/apartment-management-system.git
```

### 2. Open the project

Open the project folder in Visual Studio Code.

### 3. Configure Firebase

The application requires a Firebase project configured for the application.

Firebase configuration should be reviewed and secured according to Firebase Authentication, Firestore, and Storage security requirements before production deployment.

### 4. Run the application

Open the appropriate HTML entry point using a local development server.

For example, the project can be opened using the VS Code Live Server extension.

## Project Goals

This project was developed to solve practical apartment-management problems by replacing manual record keeping with a centralized digital system.

The main goals are:

* Reduce manual billing calculations
* Centralize apartment expenses
* Simplify water-reading management
* Improve payment tracking
* Provide residents with easy access to billing information
* Create a foundation for future apartment-management features

## Future Improvements

Planned improvements include:

* Authentication and role-based access control
* Automated notifications
* Online payment integration
* Maintenance and complaint management
* Visitor management
* Advanced analytics and reports
* PDF bill generation
* Multi-apartment support
* Production deployment

## Author

**Himavanth**

B.Tech Computer Science Engineering Student

GitHub: [@himavanthcodes](https://github.com/himavanthcodes)
