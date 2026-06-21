# Approval Process Manager (APM)

## Overview

Approval Process Manager (APM) is a role-based workflow management mobile application developed using React Native. The application streamlines organizational approval processes by enabling users to create, review, approve, reject, and fulfill requests through a structured multi-level workflow.

The system ensures transparency, accountability, and efficient request handling by assigning responsibilities to different user roles within the organization.

---

## Problem Statement

Organizations often rely on manual approval processes involving emails, spreadsheets, and paperwork. These approaches can lead to:

* Delayed approvals
* Lack of visibility into request status
* Miscommunication between stakeholders
* Difficulty tracking request history
* Inefficient workflow management

APM addresses these challenges by providing a centralized platform for managing approval workflows.

---

## Key Features

### Request Management

* Create new requests with title, category, amount, and comments
* Edit requests before processing
* View all submitted requests
* Track request status in real time

### Multi-Level Approval Workflow

* Authorization Stage
* Approval Stage
* Fulfillment Stage

### Status Tracking

* Ongoing Requests
* Approved Requests
* Rejected Requests
* Fulfilled Requests

### Comment Support

* Add comments during authorization
* Add comments during approval
* View remarks throughout the workflow

### Role-Based Access Control

Different users have access to different functionalities based on their assigned role.

---

## User Roles

### Requester

Responsibilities:

* Create requests
* Edit requests
* Track request status
* View request history

### Authorizer

Responsibilities:

* Review incoming requests
* Authorize requests
* Reject requests
* Add authorization comments

### Approver

Responsibilities:

* Review authorized requests
* Approve requests
* Reject requests
* Add approval comments

### Coordinator

Responsibilities:

* Receive approved requests
* Fulfill requests
* Update fulfillment status
* Complete workflow lifecycle

---

## Workflow Architecture

```text
┌─────────────┐
│  Requester  │
└──────┬──────┘
       │ Create Request
       ▼
┌─────────────┐
│ Authorizer  │
└───┬─────┬───┘
    │     │
Reject  Authorize
    │     │
    ▼     ▼
 End  ┌─────────────┐
      │  Approver   │
      └──┬─────┬────┘
         │     │
      Reject Approve
         │     │
         ▼     ▼
       End ┌─────────────┐
           │ Proprietor  │
           └──┬─────┬────┘
              │     │
           Reject Accept
              │     │
              ▼     ▼
            End ┌─────────────┐
                │ Coordinator │
                └──┬─────┬────┘
                   │     │
                Reject Fulfill
                   │     │
                   ▼     ▼
                 End Completed
```

---

## Request Lifecycle

### Step 1: Request Creation

The Requester creates a request by providing:

* Title
* Category
* Amount
* Comments

The request is then forwarded to the Authorizer.

### Step 2: Authorization Stage

The Authorizer reviews the request.

Possible actions:

* Authorize → Forward to Approver
* Reject → Workflow Ends

### Step 3: Approval Stage

The Approver reviews the authorized request.

Possible actions:

* Approve → Forward to Proprietor
* Reject → Workflow Ends

### Step 4: Final Sanction Stage

The Proprietor performs the final organizational review.

Possible actions:

* Accept → Forward to Coordinator
* Reject → Workflow Ends

### Step 5: Fulfillment Stage

The Coordinator receives accepted requests.

Possible actions:

* Fulfill → Request Completed
* Reject → Workflow Ends

### Step 6: Completion

Once fulfilled, the request status is updated to Completed and can be viewed by the Requester.

---

## Workflow Summary

Every request follows the hierarchy:

Requester → Authorizer → Approver → Proprietor → Coordinator

At each stage, the assigned stakeholder can:

* Accept/Approve and forward the request to the next stage.
* Reject the request and terminate the workflow.

Only requests that successfully pass all review stages reach the Coordinator for fulfillment.


---

## Status Indicators

| Status    | Color  |
| --------- | ------ |
| Ongoing   | Orange |
| Rejected  | Red    |
| Fulfilled | Green  |

---

## Technology Stack

### Frontend

* React Native
* JavaScript
* React Navigation

### Backend

* Supabase

### Database

* PostgreSQL (via Supabase)

### Authentication

* Supabase Authentication

### State Management

* React Hooks

### Styling

* React Native StyleSheet
* Custom Theme Configuration

---

## Installation

### Navigate to Project

```bash
cd Approval-Process-Manager
```

### Install Dependencies

```bash
npm install
```

### Run Application

```bash
npx react-native run-android
```

or

```bash
npx react-native run-ios
```

---

## Future Enhancements

* Push Notifications
* Email Notifications
* Approval Analytics Dashboard
* File Attachments
* Dark Mode Support
* Advanced Search and Filters
---

## License

This project is developed for educational and demonstration purposes.

---


