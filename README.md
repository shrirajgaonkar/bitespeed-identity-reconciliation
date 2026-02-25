# Bitespeed Identity Reconciliation API

Backend implementation of the Bitespeed Identity Reconciliation Task.

This service identifies and links customer contacts across multiple purchases using email and phone number matching logic.

---

## 🚀 Live API

Base URL:
https://bitespeed-identity-reconciliation-lzko.onrender.com

Identify Endpoint:
POST https://bitespeed-identity-reconciliation-lzko.onrender.com/identify

---

## 🛠 Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM
- Render (Hosting)

---

## 📌 Problem Summary

Customers may place multiple orders using different email addresses or phone numbers.

The system must:
- Link contacts if email OR phoneNumber matches
- Maintain one **primary contact**
- Convert newer primaries to secondary if required
- Return consolidated contact information

---

## 📬 API Endpoint

### POST /identify

### Request Body (JSON)

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}