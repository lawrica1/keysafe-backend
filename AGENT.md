# AGENT.md – KeySafe Tracker Backend (Node.js + Express + PostgreSQL)

## Project Overview

You are building the **backend API** for KeySafe Tracker – a phone‑only BLE key tracking system. The backend receives location reports from users’ phones (PWA), stores them, and serves data to the frontend dashboard. The stack is:

- **Node.js** (LTS) with **Express**
- **PostgreSQL** (primary database)
- **JWT** (JSON Web Tokens) for authentication
- **bcrypt** for password hashing
- **dotenv** for configuration
- **CORS** enabled (for PWA on different origins)

The backend must be **RESTful**, stateless (except DB), and support the frontend features defined in `Features.md`. No WebSocket is required initially – frontend will poll for updates every few seconds.

---

## System Architecture (Backend Perspective)
Phone (PWA) ──(HTTP POST)──► Express API ──► PostgreSQL
▲ │
│ │
└──(HTTP GET)───────────────┘
