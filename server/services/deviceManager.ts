import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import { IStorage } from "../storage";
import { AdminBotHandler } from "../features/adminBotHandler";
import { eq } from "drizzle-orm";
import { devices as devicesTable, type Device } from "../../shared/schema";

export interface DeviceInstance {
  id: number;
  deviceName: string;
  sock: WASocket | null;
  qrCode: string | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  lastError?: string;
  adminBotHandler: AdminBotHandler | null;
}

/**
 * Manages multiple WhatsApp device connections
 */
export class DeviceManager {
  private devices: Map<number, DeviceInstance> = new Map();
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Initialize a device connection
   */
  async initializeDevice(
    deviceId: number,
    deviceName: string,
    authPath: string = "auth_info_baileys"
  ): Promise<DeviceInstance> {
    // Check if device already exists
    if (this.devices.has(deviceId)) {
      return this.devices.get(deviceId)!;
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(
      `[${deviceName}] using WA v${version.join(".")}, isLatest: ${isLatest}`
    );

    const instance: DeviceInstance = {
      id: deviceId,
      deviceName,
      sock: null,
      qrCode: null,
      connectionStatus: "disconnected",
      adminBotHandler: new AdminBotHandler(this.storage),
    };

    // Start socket connection
    await this.startSocket(instance, version, state, saveCreds, authPath);

    this.devices.set(deviceId, instance);
    return instance;
  }

  /**
   * Start WebSocket for a device
   */
  private async startSocket(
    instance: DeviceInstance,
    version: any,
    state: any,
    saveCreds: any,
    authPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      instance.connectionStatus = "connecting";

      instance.sock = makeWASocket({
        version,
        logger: pino({ level: "error" }) as any,
        auth: state,
        browser: ["WhatsApp AI Agent", "Chrome", "1.0.0"],
        generateHighQualityLinkPreview: true,
      });

      instance.sock.ev.on("creds.update", saveCreds);

      instance.sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          instance.qrCode = qr; // Store the QR string, not the data URL
          console.log(`[${instance.deviceName}] QR Code generated`);
        }

        if (connection === "close") {
          const shouldReconnect = (
            lastDisconnect?.error as Boom
          )?.output?.statusCode;

          if (
            shouldReconnect === DisconnectReason.badSession ||
            shouldReconnect === DisconnectReason.connectionClosed ||
            shouldReconnect === DisconnectReason.connectionLost ||
            shouldReconnect === DisconnectReason.connectionReplaced ||
            shouldReconnect === DisconnectReason.restartRequired
          ) {
            console.log(
              `[${instance.deviceName}] Connection closed. Attempting to reconnect...`
            );
            instance.connectionStatus = "disconnected";
            // Retry connection
            setTimeout(() => {
              this.reconnectDevice(instance.id).catch(console.error);
            }, 3000);
          } else if (shouldReconnect === DisconnectReason.loggedOut) {
            console.log(
              `[${instance.deviceName}] Logged out. Please scan QR again.`
            );
            instance.connectionStatus = "disconnected";
            instance.qrCode = null;
          }
        }

        if (connection === "open") {
          console.log(`✓ [${instance.deviceName}] WhatsApp connection established`);
          instance.connectionStatus = "connected";
          resolve();
        }
      });

      // Setup message listener
      if (instance.sock) {
        instance.sock.ev.on(
          "messages.upsert",
          async (m: { messages: any[]; type: string }) => {
            if (instance.adminBotHandler) {
              for (const msg of m.messages) {
                if (msg.key.fromMe) continue;

                try {
                  // Process message through admin bot
                  await instance.adminBotHandler.handleMessage(
                    msg,
                    instance.sock!
                  );
                } catch (error) {
                  console.error(
                    `[${instance.deviceName}] Error handling message:`,
                    error
                  );
                }
              }
            }
          }
        );
      }
    });
  }

  /**
   * Reconnect a device
   */
  async reconnectDevice(deviceId: number): Promise<void> {
    const instance = this.devices.get(deviceId);
    if (!instance) {
      throw new Error(`Device ${deviceId} not found`);
    }

    try {
      if (instance.sock) {
        try {
          (instance.sock as any).end?.();
        } catch (e) {
          console.error(`Failed to properly close socket for ${instance.deviceName}`, e);
        }
      }
      instance.sock = null;
      instance.connectionStatus = "disconnected";

      // Re-initialize the device
      const authPath = instance.authPath || "auth_info_baileys";
      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      const { version } = await fetchLatestBaileysVersion();

      await this.startSocket(
        instance,
        version,
        state,
        saveCreds,
        authPath
      );
    } catch (error) {
      instance.lastError = (error as Error).message;
      console.error(`[${instance.deviceName}] Reconnection failed:`, error);
    }
  }

  /**
   * Disable/Enable a device
   */
  async toggleDevice(deviceId: number, isActive: boolean): Promise<void> {
    const instance = this.devices.get(deviceId);
    if (!instance) {
      throw new Error(`Device ${deviceId} not found`);
    }

    if (!isActive && instance.sock) {
      // Disconnect the socket
      try {
        (instance.sock as any).end?.();
      } catch (e) {
        console.error(`Failed to properly close socket for ${instance.deviceName}`, e);
      }
      instance.sock = null;
      instance.connectionStatus = "disconnected";
    } else if (isActive && !instance.sock) {
      // Reconnect
      await this.reconnectDevice(deviceId);
    }

    // Update in-memory status (database persistence would require adding device update methods to IStorage)
    // TODO: Implement device persistence in storage interface
  }

  /**
   * Get device instance
   */
  getDevice(deviceId: number): DeviceInstance | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Get all devices
   */
  getAllDevices(): DeviceInstance[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device status
   */
  async getDeviceStatus(deviceId: number): Promise<{
    deviceName: string;
    connectionStatus: string;
    qrCode?: string;
    lastError?: string;
    isActive: boolean;
  }> {
    const instance = this.devices.get(deviceId);

    if (!instance) {
      throw new Error(`Device ${deviceId} not found`);
    }

    return {
      deviceName: instance.deviceName,
      connectionStatus: instance.connectionStatus,
      qrCode: instance.qrCode,
      lastError: instance.lastError,
      isActive: instance.isActive,
    };
  }

  /**
   * Disconnect a device cleanly
   */
  async disconnectDevice(deviceId: number): Promise<void> {
    const instance = this.devices.get(deviceId);
    if (instance && instance.sock) {
      try {
        (instance.sock as any).end?.();
      } catch (e) {
        console.error(`Failed to properly close socket for ${instance.deviceName}`, e);
      }
      instance.sock = null;
      instance.connectionStatus = "disconnected";
    }
    this.devices.delete(deviceId);

    // Update database
    await this.storage.db
      .update(devicesTable)
      .set({ connectionStatus: "disconnected" as const })
      .where(eq(devicesTable.id, deviceId));
  }
}

// Singleton instance
let deviceManager: DeviceManager | null = null;

export function initializeDeviceManager(storage: IStorage): DeviceManager {
  if (!deviceManager) {
    deviceManager = new DeviceManager(storage);
  }
  return deviceManager;
}

export function getDeviceManager(): DeviceManager {
  if (!deviceManager) {
    throw new Error("DeviceManager not initialized");
  }
  return deviceManager;
}
