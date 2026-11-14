# PHARMATRIX COOKIE AND TRACKING POLICY

**Document Version:** 1.0.0  
**Effective Date:** November 14, 2026  
**Status:** Approved for Implementation  

---

## 1. Introduction
This Cookie and Tracking Policy explains how **Pharmatrix Technologies Private Limited** ("**Pharmatrix**") uses cookies, local browser storage, and related mobile tracking technologies across our web portals and mobile applications.

Pharmatrix maintains a **privacy-first architecture**:
- We do **not** use third-party advertising tracking pixels, behavioural retargeting scripts, or cross-site commercial data brokers (such as Facebook Pixel, Google AdSense, or Criteo).
- We do **not** sell user telemetry or browsing behaviour.
- We utilize only **strictly necessary technical storage** and **platform-appropriate functional permissions** required for secure authentication, session persistence, and real-time logistics navigation.

---

## 2. Technologies Used Across the Platform

### 2.1 Web Applications (Admin Dashboard & Facility Portal)
Our React web dashboards utilize minimal, essential web storage technologies:

| Technology | Name / Key | Purpose | Category | Lifespan |
|---|---|---|---|---|
| **Local Storage / Session Storage** | `pharmatrix_admin_token` / `auth_token` | Securely maintains authenticated JWT session token for API authorization. | Strictly Essential | Until user logs out or browser session ends |
| **Local Storage** | `pharmatrix_user` | Caches basic user display name and assigned role (`ADMIN`, `FACILITY`) to prevent UI flicker during navigation. | Functional / UI | Persistent (cleared upon logout) |
| **Local Storage** | `api_base_url` | Configures target API environment endpoint for enterprise development and staging switches. | Technical Configuration | Persistent |
| **OpenStreetMap / Leaflet Tile Cache** | In-memory image cache | Caches map tiles for dispatch fleet visualization. No personal identifier is transmitted to map tile providers. | Functional | Browser session |

### 2.2 Native Mobile Applications (Customer & Driver Apps)
In accordance with Apple App Store and Google Play privacy guidelines, native mobile applications do **not** use HTTP web cookies. Instead, mobile applications utilize:
1. **Expo SecureStore:**
   - Hardware-backed, encrypted keychain storage on iOS (Keychain Services) and Android (Android Keystore System & EncryptedSharedPreferences).
   - Used exclusively to store JWT access tokens and refresh tokens.
2. **Device Hardware Telemetry:**
   - **Expo Push Token:** An opaque alphanumeric push token issued by Apple Push Notification service (APNs) or Firebase Cloud Messaging (FCM) through Expo servers. Used solely to deliver transactional pickup alerts.
   - **Device Platform & Model:** Used for device compatibility routing (e.g. Android vs iOS notification sound channels).

---

## 3. Location Tracking Disclosures

### 3.1 Customer App
- **Foreground Location:** Triggered on-demand when using the map picker to pinpoint a pharmacy address. No continuous or background tracking occurs.

### 3.2 Driver App
- **Foreground and Background Location:** Continuously active throughout the driver's duty shift to compute dynamic ETAs, route optimization, and geofenced arrival. Clearly disclosed in the Driver Agreement and requested via standard OS permission dialogs (`ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`).

---

## 4. Managing Your Preferences

- **Web Browser Cookies/Storage:** You can clear local storage and cookies at any time via your browser settings (Chrome, Edge, Safari, Firefox). Please note that clearing local storage will terminate your active dashboard login session.
- **Mobile Push Notifications:** You may toggle push notifications on or off in your device system settings (`Settings > Apps > Pharmatrix Customer/Driver > Notifications`) or in-app via the Profile screen.
- **Mobile Location Services:** Location permissions can be set to "While Using the App" or "Never" in device OS settings. (For drivers, active background location is an operational condition of route dispatch).

