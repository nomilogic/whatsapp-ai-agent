import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface ContactSettingsModalProps {
  contactId: number;
  contactName: string;
  isOpen: boolean;
  onClose: (saved: boolean) => void;
}

export default function ContactSettingsModal({
  contactId,
  contactName,
  isOpen,
  onClose,
}: ContactSettingsModalProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isTrainer, setIsTrainer] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch settings when modal opens or contactId changes - force fresh fetch each time
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    
    console.log("Modal opening for contactId:", contactId, "isOpen:", isOpen);
    
    const fetchSettings = async () => {
      setLoading(true);
      // Reset state while loading
      setIsBlocked(false);
      setIsTrainer(false);
      setSpecialInstructions("");
      
      try {
        // Add cache-buster with timestamp to ensure fresh data
        const cacheBreaker = `_t=${Date.now()}`;
        const url = `/api/admin-bot/contact/${contactId}/settings?${cacheBreaker}`;
        console.log("Fetching from:", url);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        });
        const data = await res.json();
        console.log("Fetched contact settings for contactId", contactId, ":", data);
        setIsBlocked(data.isBlocked || false);
        setIsTrainer(data.isTrainer || false);
        setSpecialInstructions(data.specialInstructions || "");
      } catch (e) {
        console.error("Failed to fetch settings:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [contactId, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      console.log(`[MODAL] Saving settings for contact ${contactId}:`, { isBlocked, isTrainer, specialInstructions });
      
      // Save block status
      console.log(`[MODAL] PATCH /api/admin-bot/contact/${contactId}/block with blocked=${isBlocked}`);
      const blockRes = await fetch(`/api/admin-bot/contact/${contactId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: isBlocked }),
      });
      const blockData = await blockRes.json();
      console.log(`[MODAL] Block response:`, blockData);
      if (!blockRes.ok) throw new Error(`Block save failed: ${blockRes.status}`);

      // Save trainer status
      console.log(`[MODAL] PATCH /api/admin-bot/contact/${contactId}/toggle-trainer with isTrainer=${isTrainer}`);
      const trainerRes = await fetch(`/api/admin-bot/contact/${contactId}/toggle-trainer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTrainer }),
      });
      const trainerData = await trainerRes.json();
      console.log(`[MODAL] Trainer response:`, trainerData);
      if (!trainerRes.ok) throw new Error(`Trainer save failed: ${trainerRes.status}`);

      // Save special instructions
      console.log(`[MODAL] PATCH /api/admin-bot/contact/${contactId}/special-instructions`);
      const instructionsRes = await fetch(`/api/admin-bot/contact/${contactId}/special-instructions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: specialInstructions }),
      });
      const instructionsData = await instructionsRes.json();
      console.log(`[MODAL] Instructions response:`, instructionsData);
      if (!instructionsRes.ok) throw new Error(`Instructions save failed: ${instructionsRes.status}`);

      console.log(`[MODAL] ✓ All settings saved successfully for contact ${contactId}`);
      onClose(true);
    } catch (e) {
      console.error(`[MODAL] ✗ Failed to save settings for contact ${contactId}:`, e);
      onClose(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    // If dialog is being closed (open=false), close without saving
    if (!open) {
      onClose(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings for {contactName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Block Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <Label className="text-base font-semibold">Block Contact</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Bot will not respond to messages from this contact
                </p>
              </div>
              <Switch
                checked={isBlocked}
                onCheckedChange={setIsBlocked}
              />
            </div>

            {/* Trainer Toggle */}
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <Label className="text-base font-semibold">Mark as Trainer</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  This contact can provide training instructions for the bot
                </p>
              </div>
              <Switch
                checked={isTrainer}
                onCheckedChange={setIsTrainer}
              />
            </div>

            {/* Special Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions" className="text-base font-semibold">
                Special Instructions
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Custom behavior instructions for this contact only
              </p>
              <Textarea
                id="instructions"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g., Always be formal with this contact. Reply in French when possible."
                className="min-h-[120px] text-sm rounded-lg border-border"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
