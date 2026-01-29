# Multi-Device Management System

## Overview

The WhatsApp AI Agent now supports **multiple WhatsApp devices** with independent QR codes, activation/deactivation control, and separate authentication. Each device can be managed independently while sharing the same AI Service backend.

## Features

### ✅ Multi-Device Support
- Add unlimited WhatsApp devices to a single instance
- Each device has its own authentication credentials
- Separate QR code generation for each device
- Independent connection management

### ✅ Activate/Deactivate
- Enable or disable devices without deletion
- Seamless switching between active devices
- Maintains device state in database

### ✅ Device Management API
- Create new devices
- List all devices with status
- Get device status (connected, disconnected, connecting)
- Get QR code for authentication
- Reconnect devices
- Delete devices

## API Endpoints

### 1. Get All Devices
```bash
GET /api/devices
```

**Response:**
```json
[
  {
    "id": 1,
    "deviceName": "main",
    "phoneNumber": "923009285423",
    "isActive": true,
    "connectionStatus": "connected",
    "qrCode": null,
    "lastConnected": "2026-01-29T11:38:00Z",
    "authPath": "auth_info_main",
    "metadata": null,
    "createdAt": "2026-01-29T11:35:00Z",
    "updatedAt": "2026-01-29T11:38:00Z"
  },
  {
    "id": 2,
    "deviceName": "secondary",
    "phoneNumber": null,
    "isActive": true,
    "connectionStatus": "connecting",
    "qrCode": "data:image/png;base64,...",
    "lastConnected": null,
    "authPath": "auth_info_secondary",
    "metadata": null,
    "createdAt": "2026-01-29T11:40:00Z",
    "updatedAt": "2026-01-29T11:40:00Z"
  }
]
```

### 2. Get Single Device Status
```bash
GET /api/devices/:deviceId
```

**Response:**
```json
{
  "deviceName": "secondary",
  "connectionStatus": "connecting",
  "qrCode": "data:image/png;base64,...",
  "lastError": null,
  "isActive": true
}
```

### 3. Get Device QR Code
```bash
GET /api/devices/:deviceId/qr
```

**Response:**
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "deviceName": "secondary"
}
```

### 4. Create New Device
```bash
POST /api/devices

{
  "deviceName": "business",
  "metadata": {
    "description": "Business account",
    "assignedTo": "sales-team"
  }
}
```

**Response:**
```json
{
  "id": 3,
  "deviceName": "business",
  "isActive": true,
  "connectionStatus": "disconnected",
  "authPath": "auth_info_business",
  "metadata": {
    "description": "Business account",
    "assignedTo": "sales-team"
  },
  "message": "Device created. Scan QR code to authenticate."
}
```

### 5. Activate/Deactivate Device
```bash
PATCH /api/devices/:deviceId/status

{
  "isActive": false
}
```

**Response:**
```json
{
  "message": "Device deactivated",
  "deviceId": 2,
  "isActive": false
}
```

### 6. Reconnect Device
```bash
POST /api/devices/:deviceId/reconnect
```

**Response:**
```json
{
  "message": "Device reconnection initiated",
  "deviceId": 2
}
```

### 7. Delete Device
```bash
DELETE /api/devices/:deviceId
```

**Response:**
```json
{
  "message": "Device deleted successfully",
  "deviceId": 2
}
```

## Database Schema

### devices Table
```sql
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true,
  connection_status TEXT DEFAULT 'disconnected',
  qr_code TEXT,
  last_connected TIMESTAMP,
  last_error TEXT,
  auth_path TEXT DEFAULT 'auth_info_baileys',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Example

### Step 1: Create a New Device
```bash
curl -X POST http://localhost:5000/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceName": "customer-support",
    "metadata": {"team": "support"}
  }'
```

### Step 2: Get QR Code
```bash
curl http://localhost:5000/api/devices/2/qr
```

The response will contain a base64-encoded QR code image. Scan it with WhatsApp to authenticate.

### Step 3: Monitor Connection Status
```bash
curl http://localhost:5000/api/devices/2
```

Wait until `connectionStatus` is `connected`.

### Step 4: Activate/Deactivate When Needed
```bash
# Disable device
curl -X PATCH http://localhost:5000/api/devices/2/status \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# Enable device
curl -X PATCH http://localhost:5000/api/devices/2/status \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

### Step 5: Reconnect if Needed
```bash
curl -X POST http://localhost:5000/api/devices/2/reconnect
```

## Device Manager Implementation

### Key Components

#### `DeviceManager` Class
Located in `server/services/deviceManager.ts`

**Methods:**
- `initializeDevice(deviceId, deviceName, authPath)` - Initialize a new device
- `reconnectDevice(deviceId)` - Reconnect a disconnected device
- `toggleDevice(deviceId, isActive)` - Activate or deactivate
- `getDevice(deviceId)` - Get device instance
- `getAllDevices()` - Get all device instances
- `getDeviceStatus(deviceId)` - Get device status
- `disconnectDevice(deviceId)` - Cleanly disconnect

#### `DeviceInstance` Interface
```typescript
interface DeviceInstance {
  id: number;
  deviceName: string;
  sock: WASocket | null;              // Baileys socket
  qrCode: string | null;              // Current QR code
  connectionStatus: string;           // 'connecting' | 'connected' | 'disconnected'
  lastError?: string;                 // Last error message
  adminBotHandler: AdminBotHandler;   // Shared AI handler
}
```

## Features Details

### Multiple Authentication Paths
Each device stores credentials in a separate directory:
- Main device: `auth_info_main/`
- Secondary: `auth_info_secondary/`
- Custom: `auth_info_<deviceName>/`

### Automatic Reconnection
Devices automatically reconnect on:
- Connection loss
- Network issues
- Session expiration

### Shared AI Service
All devices use the same centralized AI Service for:
- Gemini API calls
- OpenAI API calls
- Automatic fallback mechanism

### Independent Message Processing
Each device processes messages independently through AdminBotHandler:
- Personality analysis
- Task extraction
- Response generation
- Message history

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer                            │
│  GET/POST/PATCH /api/devices & /api/devices/:id/*       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Device Manager (Singleton)                  │
│  - Device lifecycle management                           │
│  - QR code generation                                    │
│  - Connection state tracking                             │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Device 1      Device 2      Device N
   (Main)        (Secondary)    (Custom)
        │              │              │
   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
   │Baileys  │    │Baileys  │   │Baileys  │
   │Socket   │    │Socket   │   │Socket   │
   └────┬────┘    └────┬────┘   └────┬────┘
        │              │              │
   ┌────▼──────────────▼──────────────▼────┐
   │         Shared AI Service               │
   │  - Gemini API (primary)                 │
   │  - OpenAI API (fallback)                │
   │  - Message processing                   │
   └─────────────────────────────────────────┘
```

## Connection States

| State | Meaning | Action |
|-------|---------|--------|
| `disconnected` | Device not connected | Scan QR code or reconnect |
| `connecting` | Establishing connection | Waiting for authentication |
| `connected` | Ready to receive messages | Processing messages |

## Troubleshooting

### Device Won't Connect
1. Check if device is active: `GET /api/devices/:id`
2. Get fresh QR code: `GET /api/devices/:id/qr`
3. Reconnect manually: `POST /api/devices/:id/reconnect`

### QR Code Not Showing
- Device may already be authenticated
- Try `GET /api/devices/:id/qr` - should return an error if authenticated
- Delete and recreate the device if needed

### Multiple Devices Same Number
- Each device must use a different WhatsApp account
- Cannot register same number on multiple devices simultaneously

## Future Enhancements

- [ ] Device grouping (team, department, location)
- [ ] Message routing rules per device
- [ ] Device activity monitoring dashboard
- [ ] Scheduled connection windows
- [ ] Device health metrics
- [ ] Load balancing across devices

