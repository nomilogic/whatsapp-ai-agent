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
  onClose: () => void;
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

  // Fetch settings when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/admin-bot/contact/${contactId}/settings`)
      .then((res) => res.json())
      .then((data) => {
        setIsBlocked(data.isBlocked || false);
        setIsTrainer(data.isTrainer || false);
        setSpecialInstructions(data.specialInstructions || "");
      })
      .catch((e) => console.error("Failed to fetch settings:", e))
      .finally(() => setLoading(false));
  }, [contactId, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save block status
      await fetch(`/api/admin-bot/contact/${contactId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: isBlocked }),
      });

      // Save trainer status
      await fetch(`/api/admin-bot/contact/${contactId}/toggle-trainer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTrainer }),
      });

      // Save special instructions
      await fetch(`/api/admin-bot/contact/${contactId}/special-instructions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: specialInstructions }),
      });

      onClose();
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
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
