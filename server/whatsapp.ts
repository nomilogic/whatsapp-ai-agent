import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  type WASocket,
  type AnyMessageContent,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { type IStorage } from './storage';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

let sock: WASocket | null = null;
let qrCode: string | null = null;
let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
let lastError: string | undefined = undefined;

export async function setupWhatsApp(storage: IStorage) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

  async function startSock() {
    connectionStatus = 'connecting';
    
    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }) as any,
      printQRInTerminal: true,
      auth: state,
      browser: ['Replit Agent', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCode = qr;
        console.log('New QR Code generated');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
        connectionStatus = 'disconnected';
        lastError = (lastDisconnect?.error as Error)?.message;
        qrCode = null;
        
        if (shouldReconnect) {
          startSock();
        }
      } else if (connection === 'open') {
        console.log('Opened connection');
        connectionStatus = 'connected';
        qrCode = null;
        lastError = undefined;
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type !== 'notify') return;
        
        for (const msg of m.messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid) continue;

          // Extract text content
          const textContent = msg.message.conversation || 
                            msg.message.extendedTextMessage?.text || 
                            msg.message.imageMessage?.caption ||
                            '';

          if (!textContent) continue;

          // 1. Get or Create Contact
          let contact = await storage.getContactByRemoteJid(remoteJid);
          if (!contact) {
            contact = await storage.createContact({
              remoteJid,
              name: msg.pushName || 'Unknown',
              platform: 'whatsapp'
            });
          }

          // 2. Save User Message
          await storage.createMessage({
            contactId: contact.id,
            role: 'user',
            content: textContent,
            whatsappId: msg.key.id || undefined,
            status: 'read'
          });

          // 3. Check Auto-Reply
          const autoReplySetting = await storage.getSetting('auto_reply');
          if (autoReplySetting?.value === 'true') {
            
            // Get History
            const history = await storage.getMessages(contact.id);
            const messages = history.map(h => ({
              role: h.role as 'user' | 'assistant' | 'system',
              content: h.content
            }));

            // Get System Prompt
            const systemPrompt = await storage.getSetting('system_prompt');
            if (systemPrompt) {
              messages.unshift({ role: 'system', content: systemPrompt.value });
            }

            // Get AI Response
            const modelSetting = await storage.getSetting('openai_model');
            const model = modelSetting?.value || 'gpt-4o';

            const completion = await openai.chat.completions.create({
              messages: messages as any,
              model: model,
            });

            const replyContent = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";

            // 4. Send Reply
            await sock?.sendMessage(remoteJid, { text: replyContent });

            // 5. Save Assistant Message
            await storage.createMessage({
              contactId: contact.id,
              role: 'assistant',
              content: replyContent,
              status: 'sent'
            });
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });
  }

  startSock();

  return {
    getStatus: () => ({
      connected: connectionStatus === 'connected',
      qrCode: qrCode || undefined,
      connecting: connectionStatus === 'connecting',
      lastError
    }),
    sendMessage: async (to: string, content: string) => {
      if (!sock || connectionStatus !== 'connected') {
        throw new Error('WhatsApp not connected');
      }
      await sock.sendMessage(to, { text: content });
    }
  };
}
