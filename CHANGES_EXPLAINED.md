# Novax Arena - Feature Updates

This document outlines the recent changes implemented in the Novax Arena platform, covering profile management, interface improvements, and leaderboard logic.

## 1. Profile Photo Upload Feature

### Overview
Users can now personalize their profiles by uploading a profile picture.

### Implementation Details
**Backend (`Prototype-to-MVP-backend`):**
- **Model Update:** Added `avatar_url` field to `UserProfile` schema.
- **API Endpoint:** Created `POST /api/profiles/:user_id/avatar` to handle image uploads.
  - Accepts Base64 encoded images.
  - Decodes and saves images to `public/uploads`.
  - Updates the user's profile with the new image URL.
- **Static Serving:** configured `server.js` to serve files from `public/uploads` via the `/uploads` path.

**Frontend (`Prototype-to-MVP-frontend`):**
- **UI Update:** `Profile.jsx` now features a clickable avatar area.
  - Displays the current avatar or a default icon.
  - Clicking triggers a file selection dialog.
- **Integration:** Added `uploadAvatar` method to `apiClient` to handle the API communication.
- **Validation:** Implemented client-side file size validation (max 5MB).

## 2. Solo Arena Mobile Interface Improvements

### Overview
The Solo Arena interface has been optimized for mobile devices, ensuring a seamless experience on smaller screens without altering the original design aesthetic.

### Implementation Details
**Components Updated:**
- **`SituationScreen.jsx`:**
  - Adjusted padding for mobile (`p-4`) vs desktop (`md:p-6`).
  - Ensured text sizes are readable on mobile.
  - Made the "Analyst Situation" button responsive.
- **`ActionScreen.jsx`:**
  - Optimized container padding and spacing.
  - Made interaction buttons (Options, Confirmation) full-width on mobile for easier tapping.
  - Adjusted font sizes for questions and prompts.
  - Refined layout for different interaction types (Quick Choice, Spectrum, etc.) to flow better on vertical screens.

## 3. Leaderboard Algorithm Improvement

### Overview
The leaderboard now ranks users based on a comprehensive "Total XP" score rather than just the number of arenas completed or a single archetype's XP.

### Implementation Details
**Backend (`Prototype-to-MVP-backend`):**
- **Logic Update:** Modified `GET /api/profiles` endpoint.
- **Aggregation:** Used MongoDB aggregation pipeline to calculate `total_xp` on the fly:
  ```javascript
  total_xp = xp_risk_taker + xp_analyst + xp_builder + xp_strategist
  ```
- **Sorting:** Profiles are now sorted by `total_xp` (descending) and then `total_arenas_completed` (descending).

## Summary
These changes enhance user personalization, accessibility on mobile devices, and fairness in the competitive ranking system.
