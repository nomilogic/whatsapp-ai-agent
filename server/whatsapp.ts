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
import { GoogleGenAI } from "@google/genai";
import QRCode from 'qrcode';
import { AdminBotHandler } from './features/adminBotHandler';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Initialize Gemini (conditionally)
let gemini: GoogleGenAI | null = null;
if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
  gemini = new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  });
}

// Initialize Admin Bot Handler
let adminBotHandler: AdminBotHandler | null = null;

let sock: WASocket | null = null;
let qrCode: string | null = null;
let qrCodeDataUrl: string | null = null;
let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
let lastError: string | undefined = undefined;

export async function setupWhatsApp(storage: IStorage) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

  // Initialize Admin Bot Handler
  adminBotHandler = new AdminBotHandler(
    storage,
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY
  );

  async function startSock() {
    connectionStatus = 'connecting';
    
    sock = makeWASocket({
      version,
      logger: pino({ level: 'error' }) as any,
      auth: state,
      browser: ['WhatsApp AI Agent', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCode = qr;
        // Convert QR code to data URL for display
        QRCode.toDataURL(qr)
          .then((url: string) => {
            qrCodeDataUrl = url;
            console.log('✓ QR Code generated - scan to authenticate');
          })
          .catch((err: any) => console.error('Failed to generate QR data URL:', err));
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        connectionStatus = 'disconnected';
        lastError = (lastDisconnect?.error as Error)?.message;
        qrCode = null;
        qrCodeDataUrl = null;
        
        if (shouldReconnect) {
          const delayMs = statusCode === 440 ? 5000 : 3000; // Longer delay for conflict errors
          console.log(`Reconnecting in ${delayMs}ms...`);
          setTimeout(() => startSock(), delayMs);
        }
      } else if (connection === 'open') {
        console.log('✓ WhatsApp connection established');
        connectionStatus = 'connected';
        qrCode = null;
        qrCodeDataUrl = null;
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

          // If this contact is a registered trainer, record the instruction and acknowledge
          if (adminBotHandler) {
            try {
              const trainerProfile = await adminBotHandler.getTrainerProfile(contact.id);
              if (trainerProfile) {
                // Try to detect an explicit numeric target via @<digits>
                const mentionMatch = textContent.match(/@(\d{3,})/);
                const targetContactId = mentionMatch ? Number(mentionMatch[1]) : undefined;

                await adminBotHandler.recordTrainerInstruction(contact.id, textContent, targetContactId);

                const ack = `Instruction recorded${targetContactId ? ` for contact ${targetContactId}` : ' (global)'}.`;
                await sock?.sendMessage(remoteJid, { text: ack });

                await storage.createMessage({
                  contactId: contact.id,
                  role: 'assistant',
                  content: ack,
                  status: 'sent'
                });

                // For trainer messages we stop further auto-reply processing (they're training messages)
                continue;
              }
            } catch (trainerErr) {
              console.error('Error processing trainer message:', trainerErr);
            }
          }

          // 3. Check Auto-Reply
          const autoReplySetting = await storage.getSetting('auto_reply');
          if (autoReplySetting?.value === 'true') {
            
            // Get History
            const history = await storage.getMessages(contact.id);
            
            // Get Identity and Context for Personalized Response
            const identity = await storage.getIdentity();
            
            let replyContent = "";

            if (adminBotHandler) {
              // Use Admin Bot Handler for personalized response
              
              // 1. Adapt personality based on new message
              await adminBotHandler.analyzeAndAdaptPersonality(
                contact.id,
                history,
                textContent
              );

              // 2. Extract tasks and follow-ups from conversation
              const { tasks, followUps } = await adminBotHandler.extractTasksAndFollowUps(
                contact.id,
                history
              );

              if (tasks.length > 0) {
                console.log(`Extracted ${tasks.length} tasks for contact ${contact.name}`);
              }

              if (followUps.length > 0) {
                console.log(`Extracted ${followUps.length} follow-ups for contact ${contact.name}`);
              }

              // 3. Generate personalized response based on contact personality
              replyContent = await adminBotHandler.generatePersonalizedResponse(
                contact.id,
                textContent,
                history,
                identity
              );

              // 4. Update conversation summary
              await adminBotHandler.generateConversationSummary(
                contact.id,
                history
              );
            } else {
              // Fallback to standard response generation
              const systemPromptSetting = await storage.getSetting('system_prompt');
              let systemContent = systemPromptSetting?.value || "You are a helpful assistant.";
              
              systemContent += `\n\nIMPORTANT: Never tell the user that you are an AI, a digital assistant, a bot, or any kind of artificial intelligence. Never acknowledge limitations due to being AI. Respond as a natural person would. If asked what you are, deflect or respond as a real person.`;
              
              if (identity) {
                systemContent += `\nYour name is ${identity.name}.`;
                systemContent += `\nPersonality: ${JSON.stringify(identity.personalityTraits)}`;
                if (identity.values?.length) systemContent += `\nValues: ${identity.values.join(', ')}`;
                if (identity.interests?.length) systemContent += `\nInterests: ${identity.interests.join(', ')}`;
              }

              if (contact.relationshipType) {
                systemContent += `\nRelationship with this contact: ${contact.relationshipType} (Level: ${contact.relationshipLevel})`;
              }

              const providerSetting = await storage.getSetting('ai_provider');
              const provider = providerSetting?.value || 'gemini';
              
              if (provider === 'gemini' && gemini) {
                const geminiModelSetting = await storage.getSetting('gemini_model');
                const model = geminiModelSetting?.value || 'gemini-2.5-flash';
                
                try {
                  const chatMessages = history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                  }));
                  
                  chatMessages.unshift({
                    role: 'user',
                    parts: [{ text: `SYSTEM INSTRUCTION: ${systemContent}` }]
                  });

                  const result = await gemini.models.generateContent({
                    model: model,
                    contents: chatMessages as any,
                  });
                  
                  replyContent = result.text || "I'm sorry, I couldn't process that.";
                } catch (geminiError) {
                  console.error('Gemini API error:', geminiError);
                  replyContent = `Error from Gemini API: ${(geminiError as Error)?.message || 'Unknown error'}`;
                }
              } else if (provider === 'gemini' && !gemini) {
                replyContent = "Gemini is not configured. Please set up the Gemini API key.";
              } else {
                const messages = history.map(h => ({
                  role: h.role as 'user' | 'assistant' | 'system',
                  content: h.content
                }));
                messages.unshift({ role: 'system', content: systemContent });

                const modelSetting = await storage.getSetting('openai_model');
                const model = modelSetting?.value || 'gpt-4o';

                const completion = await openai.chat.completions.create({
                  messages: messages as any,
                  model: model,
                });
                replyContent = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";
              }
            }

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
      qrCode: qrCodeDataUrl || undefined,
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

