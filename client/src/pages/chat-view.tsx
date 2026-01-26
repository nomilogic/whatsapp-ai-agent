import { useMessages, useSendMessage, useContact } from "@/hooks/use-whatsapp";
import { useRoute } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, Bot, User, Loader2, MoreVertical } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatView() {
  const [, params] = useRoute("/contacts/:id");
  const contactId = Number(params?.id);
  
  const { data: contact } = useContact(contactId);
  const { data: messages, isLoading } = useMessages(contactId);
  const { mutate: sendMessage, isPending: isSending } = useSendMessage();

  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isSending) return;
    
    sendMessage(
      { contactId, content: inputText },
      {
        onSuccess: () => setInputText(""),
      }
    );
  };

  if (!contact) return <div className="p-8 text-center">Loading chat...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-3rem)] -m-4 sm:-m-6 lg:-m-8 bg-background">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <Link href="/contacts">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
        </Link>
        
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
          {contact.name?.charAt(0) || <User className="w-5 h-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground truncate">
            {contact.name || contact.pushName || contact.remoteJid}
          </h2>
          <p className="text-xs text-muted-foreground truncate">
            {contact.type === 'group' ? 'Group Chat' : 'Personal Chat'}
          </p>
        </div>

        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2 opacity-50">
            <Bot className="w-12 h-12" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages?.map((msg) => {
              const isMe = msg.role === 'assistant'; // AI sends as 'assistant'
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex w-full",
                    isMe ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] lg:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed relative group",
                      isMe 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-white dark:bg-card text-foreground rounded-tl-none border border-border"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={cn(
                      "text-[10px] mt-1 flex items-center justify-end gap-1 opacity-70",
                      isMe ? "text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {format(new Date(msg.timestamp || Date.now()), 'h:mm a')}
                      {isMe && msg.status === 'sent' && <span>✓</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-card border-t border-border">
        <form 
          onSubmit={handleSend}
          className="flex items-end gap-2 max-w-4xl mx-auto"
        >
          <div className="flex-1 relative">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="min-h-[3rem] py-3 px-4 rounded-xl border-border bg-background shadow-inner focus:ring-primary/20 pr-12"
              disabled={isSending}
            />
          </div>
          <Button 
            type="submit" 
            size="icon" 
            className="h-12 w-12 rounded-xl shrink-0 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all active:scale-95"
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
