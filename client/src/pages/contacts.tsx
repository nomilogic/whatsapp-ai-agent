import { useContacts } from "@/hooks/use-whatsapp";
import { Search, MessageSquare, User, Users, Settings, Ban } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ContactSettingsModal from "@/components/ContactSettingsModal";

interface ContactWithSettings {
  id: number;
  name?: string;
  pushName?: string;
  remoteJid: string;
  type: string;
  lastMessageAt?: string;
  isBlocked?: boolean;
  isTrainer?: boolean;
}

export default function Contacts() {
  const { data: contacts, isLoading } = useContacts();
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactName, setSelectedContactName] = useState("");
  const [contactBlockStatus, setContactBlockStatus] = useState<Record<number, boolean>>({});
  const [contactTrainerStatus, setContactTrainerStatus] = useState<Record<number, boolean>>({});
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Load trainer and block status for all contacts when contacts load
  useEffect(() => {
    if (!contacts || contacts.length === 0) return;

    const loadContactSettings = async () => {
      const blockStatuses: Record<number, boolean> = {};
      const trainerStatuses: Record<number, boolean> = {};

      for (const contact of contacts) {
        try {
          const res = await fetch(`/api/admin-bot/contact/${contact.id}/settings?_t=${Date.now()}`);
          const data = await res.json();
          blockStatuses[contact.id] = data.isBlocked || false;
          trainerStatuses[contact.id] = data.isTrainer || false;
          console.log(`Loaded settings for contact ${contact.id}:`, { isBlocked: blockStatuses[contact.id], isTrainer: trainerStatuses[contact.id] });
        } catch (e) {
          console.error(`Failed to load settings for contact ${contact.id}:`, e);
        }
      }

      setContactBlockStatus(blockStatuses);
      setContactTrainerStatus(trainerStatuses);
    };

    loadContactSettings();
  }, [contacts]);

  // Fetch block status for all contacts on load
  const contactsWithStatus = (contacts || []).map((contact) => ({
    ...contact,
    isBlocked: contactBlockStatus[contact.id] || false,
    isTrainer: contactTrainerStatus[contact.id] || false,
  }));

  const filteredContacts = contactsWithStatus
    ?.filter(
      (contact) =>
        contact.name?.toLowerCase().includes(search.toLowerCase()) ||
        contact.pushName?.toLowerCase().includes(search.toLowerCase()) ||
        contact.remoteJid.includes(search)
    )
    .sort((a, b) => {
      // Sort by last message time (descending)
      const timeA = new Date(a.lastMessageAt || 0).getTime();
      const timeB = new Date(b.lastMessageAt || 0).getTime();
      return timeB - timeA;
    });

  const handleSettingsClick = (e: React.MouseEvent, contact: any) => {
    e.preventDefault();
    // Update state synchronously in order
    setSelectedContactId(contact.id);
    setSelectedContactName(contact.name || contact.pushName || contact.remoteJid);
    // Open modal in next tick to ensure state is updated
    setTimeout(() => {
      setIsSettingsModalOpen(true);
    }, 0);
  };

  const handleSettingsModalClose = async (saved: boolean) => {
    setIsSettingsModalOpen(false);
    // Refetch settings for this contact to sync the UI
    if (saved && selectedContactId !== null) {
      try {
        // Small delay to ensure server has persisted all changes
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Add cache-buster to ensure fresh data
        const url = `/api/admin-bot/contact/${selectedContactId}/settings?_t=${Date.now()}`;
        console.log("Refetching settings after modal close:", url);
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        });
        const data = await res.json();
        console.log("Refetched settings for contact", selectedContactId, ":", data);
        setContactBlockStatus((prev) => ({
          ...prev,
          [selectedContactId]: data.isBlocked || false,
        }));
        setContactTrainerStatus((prev) => ({
          ...prev,
          [selectedContactId]: data.isTrainer || false,
        }));
      } catch (e) {
        console.error("Failed to refetch settings:", e);
      }
    }
  };

  const handleToggleBlock = async (e: React.MouseEvent, contactId: number) => {
    e.preventDefault();
    const isCurrentlyBlocked = contactBlockStatus[contactId];
    console.log(`Toggling block for contact ${contactId}, currently: ${isCurrentlyBlocked}`);
    try {
      const res = await fetch(`/api/admin-bot/contact/${contactId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: !isCurrentlyBlocked }),
      });
      const data = await res.json();
      console.log(`Block response for ${contactId}:`, data);
      setContactBlockStatus((prev) => ({
        ...prev,
        [contactId]: !isCurrentlyBlocked,
      }));
    } catch (e) {
      console.error(`Failed to toggle block for contact ${contactId}:`, e);
    }
  };

  const handleToggleTrainer = async (e: React.MouseEvent, contactId: number) => {
    e.preventDefault();
    const isCurrentlyTrainer = contactTrainerStatus[contactId];
    console.log(`Toggling trainer for contact ${contactId}, currently: ${isCurrentlyTrainer}`);
    try {
      const res = await fetch(`/api/admin-bot/contact/${contactId}/toggle-trainer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTrainer: !isCurrentlyTrainer }),
      });
      const data = await res.json();
      console.log(`Trainer toggle response for ${contactId}:`, data);
      setContactTrainerStatus((prev) => ({
        ...prev,
        [contactId]: !isCurrentlyTrainer,
      }));
    } catch (e) {
      console.error(`Failed to toggle trainer for contact ${contactId}:`, e);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Contacts & Chats
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your conversations and start new chats.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          className="pl-10 h-12 text-base rounded-xl border-border bg-card shadow-sm focus:ring-primary/20" 
          placeholder="Search by name or number..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4 sm:mx-0 sm:px-0">
        {isLoading ? (
          <div className="space-y-4 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredContacts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No contacts found</h3>
            <p className="text-muted-foreground">
              Try a different search or wait for incoming messages.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredContacts?.map((contact) => (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <Card className={`group hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer border border-border/60 ${contact.isBlocked ? "opacity-60 bg-muted/20" : ""}`}>
                  <div className="p-4 flex items-center gap-4 relative">
                    {/* Avatar Placeholder */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold shadow-inner">
                      {contact.type === 'group' ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {contact.name || contact.pushName || contact.remoteJid.split('@')[0]}
                          </h3>
                          {contact.isBlocked && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                              Blocked
                            </span>
                          )}
                        </div>
                        {contact.lastMessageAt && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {format(new Date(contact.lastMessageAt), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground truncate w-full">
                          {contact.remoteJid}
                        </p>
                        <MessageSquare className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors ml-2" />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-muted"
                        onClick={(e) => handleToggleBlock(e, contact.id)}
                        title={contact.isBlocked ? "Unblock contact" : "Block contact"}
                      >
                        <Ban className={`w-4 h-4 ${contact.isBlocked ? "text-destructive" : "text-muted-foreground"}`} />
                      </Button>
                      <div 
                        className="flex items-center h-8 px-2 hover:bg-muted rounded cursor-pointer"
                        onClick={(e) => handleToggleTrainer(e, contact.id)}
                        title={contact.isTrainer ? "Remove as trainer" : "Mark as trainer"}
                      >
                        <Checkbox 
                          checked={contact.isTrainer || false}
                          onCheckedChange={() => {}}
                          className="cursor-pointer"
                        />
                        <span className="text-xs ml-1 text-muted-foreground font-medium">Trainer</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-muted"
                        onClick={(e) => handleSettingsClick(e, contact)}
                        title="Contact settings"
                      >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Contact Settings Modal */}
      {selectedContactId !== null && (
        <ContactSettingsModal
          contactId={selectedContactId}
          contactName={selectedContactName}
          isOpen={isSettingsModalOpen}
          onClose={(saved) => handleSettingsModalClose(saved)}
        />
      )}
    </div>
  );
}
