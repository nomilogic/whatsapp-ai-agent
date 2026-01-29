import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  type WASocket,
  type AnyMessageContent,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { type IStorage } from './storage';
import QRCode from 'qrcode';
import { AdminBotHandler } from './features/adminBotHandler';
import { getAIService } from './services/aiService';

// Initialize Admin Bot Handler
let adminBotHandler: AdminBotHandler | null = null;

// In-memory pending trainer instruction blocks: key = `${trainerContactId}:${targetKey}`
const pendingTrainerBlocks: Map<string, { targetKey: string; lines: string[] }> = new Map();

let sock: WASocket | null = null;
let qrCode: string | null = null;
let qrCodeDataUrl: string | null = null;
let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
let lastError: string | undefined = undefined;
// Per-contact message counters (in-memory)
const messageCounters: Map<number, number> = new Map();

export async function setupWhatsApp(storage: IStorage) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

  // Initialize Admin Bot Handler - AI Service is already initialized in server/index.ts
  adminBotHandler = new AdminBotHandler(storage);

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
          // Increment per-contact message counter and maybe trigger notes summarization
          try {
            const setting = await storage.getSetting('notes_every_n_messages');
            const everyN = setting?.value ? Number(setting.value) : 10;
            const current = messageCounters.get(contact.id) || 0;
            const next = current + 1;
            messageCounters.set(contact.id, next);

            if (next >= everyN) {
              // reset counter
              messageCounters.set(contact.id, 0);

              // Launch background summarization of last N messages
              (async () => {
                try {
                  const aiService = getAIService();
                  const recent = await storage.getMessages(contact.id, everyN);
                  const history = recent.reverse(); // chronological

                  const convoText = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n');

                  const summarizePrompt = `You are an assistant that creates concise persistent notes from a short recent conversation.\n\nReturn ONLY a JSON object with this shape:\n{\n  "notes": [{ "summary": "short 1-2 sentence note", "details": "optional longer details" }],\n  "summary": "a one-paragraph summary of the conversation"\n}\
\nConversation:\n${convoText}`;

                  const resp = await aiService.generateContent([{ role: 'user', content: summarizePrompt }]);
                  const text = resp.content || '';
                  const jsonMatch = text.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    const notes = parsed.notes || [];
                    for (const n of notes) {
                      await adminBotHandler?.appendContactNotes(contact.id, { summary: n.summary, details: n.details });
                    }

                    // Also persist high-level summary as conversation summary (optionally)
                    if (parsed.summary) {
                      await adminBotHandler?.generateConversationSummary(contact.id, history).catch(() => {});
                    }

                    const ack = `Saved ${notes.length} note(s) for contact ${contact.name || contact.id}.`;
                    await sock?.sendMessage(remoteJid, { text: ack });
                    await storage.createMessage({ contactId: contact.id, role: 'assistant', content: ack, status: 'sent' });
                  } else {
                    const errAck = `Could not parse notes JSON from AI for contact ${contact.name || contact.id}.`;
                    await sock?.sendMessage(remoteJid, { text: errAck });
                    await storage.createMessage({ contactId: contact.id, role: 'assistant', content: errAck, status: 'sent' });
                  }
                } catch (e) {
                  console.error('Error generating contact notes:', e);
                }
              })();
            }
          } catch (e) {
            console.warn('Error handling notes counter:', e);
          }
          // If this contact is a registered trainer, support two patterns:
          // 1) Single-line legacy @INSTRUCT <instruction>
          // 2) Multi-message block for a specific target: @<targetKey>:start instructions - ... @<targetKey>:end instructions -
          let isTrainerInstruction = false;
          if (adminBotHandler) {
            try {
              const trainerProfile = await adminBotHandler.getTrainerProfile(contact.id);
              if (trainerProfile) {
                const trimmed = textContent.trim();

                // Trainer help request: send training doc if trainer asks for help/training/guide
                const helpMatch = trimmed.match(/^(@|\/|!|#)(help|training|guide)\b/i);
                if (helpMatch) {
                  try {
                    const docPath = path.join(process.cwd(), 'ADMIN_BOT_TRAINING.md');
                    let doc = '';
                    try {
                      doc = await fs.promises.readFile(docPath, 'utf8');
                    } catch (e) {
                      doc = 'Training document not available on the server.';
                    }

                    const maxLen = 6000; // WhatsApp text limit safety
                    if (doc.length <= maxLen) {
                      await sock?.sendMessage(remoteJid, { text: doc });
                    } else {
                      await sock?.sendMessage(remoteJid, { text: doc.slice(0, maxLen) + '\n\n[Truncated] Please check the admin docs on the server.' });
                    }

                    await storage.createMessage({ contactId: contact.id, role: 'assistant', content: 'Sent training guide to trainer.', status: 'sent' });
                    isTrainerInstruction = true;
                  } catch (e) {
                    console.error('Error sending training doc to trainer:', e);
                  }
                }

                // Trainer identity/raw commands: support @, /, !, # prefixes (e.g. @IDENTITY, /identity, !RAW)
                if (trimmed.match(/^(@|\/|!|#)IDENTITY\b/i) || trimmed.match(/^(@|\/|!|#)RAW\b/i)) {
                  try {
                    const result = await adminBotHandler.applyTrainerIdentityCommand(contact.id, trimmed);
                    const ack = result.success ? `Command applied: ${result.message}` : `Command failed: ${result.message}`;
                    await sock?.sendMessage(remoteJid, { text: ack });
                    await storage.createMessage({ contactId: contact.id, role: 'assistant', content: ack, status: 'sent' });
                    isTrainerInstruction = true;
                  } catch (e) {
                    console.error('Error handling trainer command:', e);
                    const errAck = `Failed to apply trainer command: ${(e as Error).message}`;
                    await sock?.sendMessage(remoteJid, { text: errAck });
                    await storage.createMessage({ contactId: contact.id, role: 'assistant', content: errAck, status: 'sent' });
                    isTrainerInstruction = true;
                  }
                }

                // Legacy single-line @INSTRUCT
                if (trimmed.startsWith('@INSTRUCT')) {
                  const instruction = trimmed.replace(/^@INSTRUCT\s*/, '').trim();
                  const mentionMatch = instruction.match(/@(\d{3,})/);
                  const targetContactId = mentionMatch ? Number(mentionMatch[1]) : undefined;

                  await adminBotHandler.recordTrainerInstruction(contact.id, instruction, targetContactId);

                  const ack = `Instruction recorded${targetContactId ? ` for contact ${targetContactId}` : ' (global)' }.`;
                  await sock?.sendMessage(remoteJid, { text: ack });

                  await storage.createMessage({
                    contactId: contact.id,
                    role: 'assistant',
                    content: ack,
                    status: 'sent'
                  });

                  isTrainerInstruction = true;
                }

                // Multi-message block start: @<targetKey>:start instructions -
                const startMatch = trimmed.match(/^@([^\s:]+)\s*:\s*start instructions\s*-\s*$/i);
                if (startMatch) {
                  const targetKey = startMatch[1];
                  const mapKey = `${contact.id}:${targetKey}`;
                  pendingTrainerBlocks.set(mapKey, { targetKey, lines: [] });

                  const ack = `Started instruction capture for ${targetKey}. Send messages and finish with @${targetKey}:end instructions -`;
                  await sock?.sendMessage(remoteJid, { text: ack });
                  await storage.createMessage({ contactId: contact.id, role: 'assistant', content: ack, status: 'sent' });
                  isTrainerInstruction = true;
                }

                // If trainer has any pending blocks, append message to them (unless this message was the start marker)
                // We look up any pending keys for this trainer
                for (const [key, pending] of pendingTrainerBlocks) {
                  if (!key.startsWith(`${contact.id}:`)) continue;
                  // If this exact message contains the end marker for this pending target
                  const endRegex = new RegExp(`^@${pending.targetKey.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*:\\s*end instructions\\s*-\\s*$`, 'i');
                  if (endRegex.test(trimmed)) {
                    // finalize
                    const collected = pending.lines.join('\n').trim();
                    pendingTrainerBlocks.delete(key);

                    // Summarize collected instructions via AI and save
                    (async () => {
                      try {
                        const aiService = getAIService();
                        const summarizePrompt = `Summarize the following trainer-provided instruction conversation into a concise core instruction the bot should follow for the target contact (${pending.targetKey}). Return a short paragraph that will be used as that contact's core instruction.\n\nConversation:\n${collected}`;

                        const resp = await aiService.generateContent([{ role: 'user', content: summarizePrompt }]);
                        const summary = resp.content?.trim() || collected.slice(0, 1000);

                        // Try to resolve the target contact id from the targetKey (phone number, username, or numeric id)
                        let resolvedTargetId: number | undefined = undefined;
                        try {
                          // If pure digits, search contacts by remoteJid containing digits
                          if (/^\+?\d+$/.test(pending.targetKey)) {
                            const all = await storage.getContacts();
                            const found = all.find(c => c.remoteJid && c.remoteJid.includes(pending.targetKey));
                            if (found) resolvedTargetId = found.id;
                          } else if (/^\d+$/.test(pending.targetKey)) {
                            resolvedTargetId = Number(pending.targetKey);
                          } else if (/^id[:_]?\d+$/i.test(pending.targetKey)) {
                            const n = pending.targetKey.replace(/[^0-9]/g, '');
                            resolvedTargetId = Number(n);
                          } else {
                            // Try name match
                            const all = await storage.getContacts();
                            const found = all.find(c => c.name && c.name.toLowerCase() === pending.targetKey.toLowerCase());
                            if (found) resolvedTargetId = found.id;
                          }
                        } catch (e) {
                          console.warn('Error resolving target contact from key:', pending.targetKey, e);
                        }

                        // Persist as trainer instruction and also set as special instructions for target if resolved
                        await adminBotHandler.recordTrainerInstruction(contact.id, summary, resolvedTargetId);
                        if (typeof resolvedTargetId === 'number') {
                          await adminBotHandler.setContactSpecialInstructions(resolvedTargetId, summary);
                        }

                        const finalAck = `Instruction block summarized and saved${resolvedTargetId ? ` for contact ${resolvedTargetId}` : ' (global)'}.`;
                        await sock?.sendMessage(remoteJid, { text: finalAck });
                        await storage.createMessage({ contactId: contact.id, role: 'assistant', content: finalAck + '\n\n' + summary, status: 'sent' });
                      } catch (e) {
                        console.error('Error summarizing trainer instruction block:', e);
                        const errAck = `Failed to summarize instruction block for ${pending.targetKey}: ${(e as Error).message}`;
                        await sock?.sendMessage(remoteJid, { text: errAck });
                        await storage.createMessage({ contactId: contact.id, role: 'assistant', content: errAck, status: 'sent' });
                      }
                    })();

                    isTrainerInstruction = true;
                    break; // handled this pending block
                  } else {
                    // Append to pending lines
                    pending.lines.push(trimmed);
                    // mark as trainer instruction handled for this message
                    isTrainerInstruction = true;
                    // update map
                    pendingTrainerBlocks.set(key, pending);
                  }
                }
              }
            } catch (trainerErr) {
              console.error('Error processing trainer instruction:', trainerErr);
            }
          }

          // Skip auto-reply only if this was an explicit trainer instruction
          if (isTrainerInstruction) {
            continue;
          }

          // 3. Check Auto-Reply
          const autoReplySetting = await storage.getSetting('auto_reply');
          if (autoReplySetting?.value === 'true') {
            
            // Get History (last 50 messages, then reverse to chronological order)
            const recentMessages = await storage.getMessages(contact.id, 50);
            const history = recentMessages.reverse();
            
            // Get Identity and Context for Personalized Response
            const identity = await storage.getIdentity();
            
            let replyContent = "";

            if (adminBotHandler) {
              // Use Admin Bot Handler for personalized response
              
              // Only run AI-based features if API keys are available
              const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();
              const hasGemini = process.env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim();
              
              if (hasOpenAI || hasGemini) {
                // Run personality analysis and task extraction in PARALLEL (don't block each other)
                Promise.all([
                  adminBotHandler.analyzeAndAdaptPersonality(
                    contact.id,
                    history,
                    textContent
                  ).catch(err => {
                    console.error('Personality analysis error:', err.message);
                  }),
                  
                  adminBotHandler.extractTasksAndFollowUps(
                    contact.id,
                    history
                  ).then(({ tasks, followUps }) => {
                    if (tasks.length > 0) {
                      console.log(`Extracted ${tasks.length} tasks for contact ${contact.name}`);
                    }
                    if (followUps.length > 0) {
                      console.log(`Extracted ${followUps.length} follow-ups for contact ${contact.name}`);
                    }
                    return { tasks, followUps };
                  }).catch(err => {
                    console.error('Task extraction error:', err.message);
                  }),
                  
                  // Also run summary generation in background (don't await it)
                  adminBotHandler.generateConversationSummary(
                    contact.id,
                    history
                  ).catch(err => {
                    console.error('Summary generation error:', err.message);
                  })
                ]).catch(err => {
                  console.error('Parallel operations error:', err.message);
                });
                // Don't await these - let them run in background
              }

              // 3. Generate personalized response based on contact personality (ONLY ONE THAT MATTERS FOR SPEED)
              // Note: history already includes the latest user message
              replyContent = await adminBotHandler.generatePersonalizedResponse(
                contact.id,
                history,
                identity
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
              
              try {
                const aiService = getAIService();
                const result = await aiService.generateContent({
                  messages: history,
                  systemPrompt: systemContent,
                  stream: false
                });
                
                replyContent = result.content || "I'm sorry, I couldn't process that.";
              } catch (error) {
                console.error('Error generating AI reply:', error);
                replyContent = `Error generating response: ${(error as Error)?.message || 'Unknown error'}`;
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

