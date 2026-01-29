# Multi-Device Management - Quick Reference

## Create Device
```bash
curl -X POST http://localhost:5000/api/devices \
  -H "Content-Type: application/json" \
  -d '{"deviceName": "my-device"}'
```

## List All Devices
```bash
curl http://localhost:5000/api/devices
```

## Get Device Status
```bash
curl http://localhost:5000/api/devices/1
```

## Get QR Code (for scanning)
```bash
curl http://localhost:5000/api/devices/1/qr
```

## Activate Device
```bash
curl -X PATCH http://localhost:5000/api/devices/1/status \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

## Deactivate Device
```bash
curl -X PATCH http://localhost:5000/api/devices/1/status \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

## Reconnect Device
```bash
curl -X POST http://localhost:5000/api/devices/1/reconnect
```

## Delete Device
```bash
curl -X DELETE http://localhost:5000/api/devices/1
```

---

## Connection Status Meanings

| Status | What it means | Next step |
|--------|---------------|-----------|
| **disconnected** | Device is offline | Activate or reconnect |
| **connecting** | Waiting to authenticate | Scan the QR code |
| **connected** | Ready and online | Device is active |

---

## Device Properties

Each device has:
- **deviceName** - Unique identifier (e.g., "main", "secondary")
- **phoneNumber** - WhatsApp phone number (once connected)
- **isActive** - Enable/disable toggle
- **connectionStatus** - Current connection state
- **qrCode** - Base64 encoded PNG (for authentication)
- **lastConnected** - Timestamp of last successful connection
- **lastError** - Last error message if any
- **authPath** - Directory storing auth credentials
- **metadata** - Custom JSON data (team, description, etc.)

---

## Workflow Example

### 1️⃣ Create New Device
```json
POST /api/devices
{
  "deviceName": "support-team",
  "metadata": {"team": "customer-support"}
}

Response: { "id": 2, "qrCode": null, "message": "Device created..." }
```

### 2️⃣ Get QR Code
```bash
GET /api/devices/2/qr

Response: {
  "qrCode": "data:image/png;base64,iVBORw...",
  "deviceName": "support-team"
}
```

### 3️⃣ Scan QR Code
- Open WhatsApp on another phone
- Go to Settings > Linked Devices > Link a device
- Scan the QR code

### 4️⃣ Monitor Connection
```bash
GET /api/devices/2

Response: {
  "deviceName": "support-team",
  "connectionStatus": "connected",
  "isActive": true
}
```

### 5️⃣ Ready to Use!
Device is now receiving messages and processing them through the AI.

---

## Managing Multiple Devices

```bash
# Get all devices
curl http://localhost:5000/api/devices

# Disable a device temporarily
curl -X PATCH http://localhost:5000/api/devices/2/status \
  -d '{"isActive": false}'

# Enable it again later
curl -X PATCH http://localhost:5000/api/devices/2/status \
  -d '{"isActive": true}'

# Reconnect if lost
curl -X POST http://localhost:5000/api/devices/2/reconnect
```

---

## Example Response Payloads

### Device Object
```json
{
  "id": 1,
  "deviceName": "main",
  "phoneNumber": "923009285423",
  "isActive": true,
  "connectionStatus": "connected",
  "qrCode": null,
  "lastConnected": "2026-01-29T11:38:00Z",
  "lastError": null,
  "authPath": "auth_info_main",
  "metadata": {"description": "Main support line"},
  "createdAt": "2026-01-29T11:35:00Z",
  "updatedAt": "2026-01-29T11:38:00Z"
}
```

### QR Code Response
```json
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARQAAAEUCAYAA...",
  "deviceName": "secondary"
}
```

### Status Response
```json
{
  "deviceName": "secondary",
  "connectionStatus": "connecting",
  "qrCode": "data:image/png;base64,...",
  "lastError": null,
  "isActive": true
}
```

---

## Error Responses

### Device Not Found
```json
{
  "error": "Device 999 not found"
}
```

### Device Name Already Exists
```json
{
  "error": "Device with this name already exists"
}
```

### Missing Required Field
```json
{
  "error": "deviceName is required"
}
```

### Invalid isActive Value
```json
{
  "error": "isActive must be boolean"
}
```

---

## Tips & Tricks

1. **Device Names** - Use descriptive names: `support-team`, `sales`, `ceo-line`

2. **Metadata** - Store custom info:
   ```json
   {
     "deviceName": "support",
     "metadata": {
       "team": "support",
       "language": "en",
       "autoReply": "true"
     }
   }
   ```

3. **Bulk Management** - Get all devices first, then manage:
   ```bash
   # Disable all except main
   curl http://localhost:5000/api/devices | jq '.[] | select(.deviceName != "main") | .id'
   ```

4. **Monitor Connection** - Poll status endpoint:
   ```bash
   watch -n 5 'curl -s http://localhost:5000/api/devices | jq'
   ```

5. **Automate Reconnection** - Call reconnect endpoint if status is disconnected

---

## See Also

- [Complete Multi-Device Guide](./MULTI_DEVICE_GUIDE.md)
- [Architecture Overview](./README.md)

