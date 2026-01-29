import { Router, type Request, Response } from "express";
import { getDeviceManager } from "../services/deviceManager";
import { IStorage } from "../storage";
import { devices as devicesTable } from "../../shared/schema";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

export function registerDeviceRoutes(router: Router, storage: IStorage) {
  /**
   * Get all devices
   * GET /api/devices
   */
  router.get("/api/devices", async (req: Request, res: Response) => {
    try {
      const allDevices = await storage.db.select().from(devicesTable);

      const deviceManager = getDeviceManager();
      const devicesWithStatus = await Promise.all(
        allDevices.map(async (device) => {
          const instance = deviceManager.getDevice(device.id);
          return {
            ...device,
            connectionStatus:
              instance?.connectionStatus || device.connectionStatus,
            qrCode: instance?.qrCode || null,
          };
        })
      );

      res.json(devicesWithStatus);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });

  /**
   * Get single device status
   * GET /api/devices/:deviceId
   */
  router.get("/api/devices/:deviceId", async (req: Request, res: Response) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const deviceManager = getDeviceManager();

      const status = await deviceManager.getDeviceStatus(deviceId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching device status:", error);
      res.status(404).json({ error: (error as Error).message });
    }
  });

  /**
   * Get device QR code
   * GET /api/devices/:deviceId/qr
   */
  router.get(
    "/api/devices/:deviceId/qr",
    async (req: Request, res: Response) => {
      try {
        const deviceId = parseInt(req.params.deviceId);
        const deviceManager = getDeviceManager();

        const instance = deviceManager.getDevice(deviceId);
        if (!instance) {
          return res.status(404).json({ error: "Device not found" });
        }

        if (!instance.qrCode) {
          return res.status(400).json({
            error: "QR code not available. Device may already be authenticated.",
          });
        }

        // Convert QR string to data URL on demand
        const dataUrl = await QRCode.toDataURL(instance.qrCode, {
          errorCorrectionLevel: "H",
          type: "image/png",
          width: 300,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });

        res.json({
          qrCode: dataUrl,
          deviceName: instance.deviceName,
        });
      } catch (error) {
        console.error("Error fetching QR code:", error);
        res.status(500).json({ error: "Failed to fetch QR code" });
      }
    }
  );

  /**
   * Create a new device
   * POST /api/devices
   */
  router.post("/api/devices", async (req: Request, res: Response) => {
    try {
      const { deviceName, metadata } = req.body;

      if (!deviceName) {
        return res.status(400).json({ error: "deviceName is required" });
      }

      // Check if device already exists
      const existing = await storage.db
        .select()
        .from(devicesTable)
        .where(eq(devicesTable.deviceName, deviceName))
        .limit(1);

      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: "Device with this name already exists" });
      }

      // Create device in database
      const result = await storage.db
        .insert(devicesTable)
        .values({
          deviceName,
          isActive: true,
          connectionStatus: "disconnected",
          authPath: `auth_info_${deviceName}`,
          metadata,
        })
        .returning();

      const newDevice = result[0];

      // Initialize the device
      const deviceManager = getDeviceManager();
      await deviceManager.initializeDevice(
        newDevice.id,
        newDevice.deviceName,
        newDevice.authPath
      );

      res.status(201).json({
        ...newDevice,
        message: "Device created. Scan QR code to authenticate.",
      });
    } catch (error) {
      console.error("Error creating device:", error);
      res.status(500).json({ error: "Failed to create device" });
    }
  });

  /**
   * Activate/Deactivate a device
   * PATCH /api/devices/:deviceId/status
   */
  router.patch(
    "/api/devices/:deviceId/status",
    async (req: Request, res: Response) => {
      try {
        const deviceId = parseInt(req.params.deviceId);
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
          return res.status(400).json({ error: "isActive must be boolean" });
        }

        const deviceManager = getDeviceManager();
        await deviceManager.toggleDevice(deviceId, isActive);

        res.json({
          message: isActive
            ? "Device activated"
            : "Device deactivated",
          deviceId,
          isActive,
        });
      } catch (error) {
        console.error("Error toggling device:", error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  /**
   * Reconnect a device
   * POST /api/devices/:deviceId/reconnect
   */
  router.post(
    "/api/devices/:deviceId/reconnect",
    async (req: Request, res: Response) => {
      try {
        const deviceId = parseInt(req.params.deviceId);
        const deviceManager = getDeviceManager();

        await deviceManager.reconnectDevice(deviceId);

        res.json({
          message: "Device reconnection initiated",
          deviceId,
        });
      } catch (error) {
        console.error("Error reconnecting device:", error);
        res.status(500).json({ error: (error as Error).message });
      }
    }
  );

  /**
   * Delete a device
   * DELETE /api/devices/:deviceId
   */
  router.delete("/api/devices/:deviceId", async (req: Request, res: Response) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const deviceManager = getDeviceManager();

      // Disconnect the device
      await deviceManager.disconnectDevice(deviceId);

      // Delete from database
      await storage.db
        .delete(devicesTable)
        .where(eq(devicesTable.id, deviceId));

      res.json({
        message: "Device deleted successfully",
        deviceId,
      });
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({ error: (error as Error).message });
    }
  });
}
