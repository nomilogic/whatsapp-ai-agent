import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function TrainerForm() {
  const [trainerId, setTrainerId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [targets, setTargets] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);

  const addTrainer = async (e: any) => {
    e?.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/admin-bot/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerContactId: Number(trainerId), displayName, targets: targets ? targets.split(",").map(s=>s.trim()) : undefined }),
      });
      setTrainerId(""); setDisplayName(""); setTargets("");
      alert("Trainer added");
    } catch (err) {
      console.error(err); alert("Failed to add trainer");
    } finally { setBusy(false); }
  };

  const sendInstruction = async (e: any) => {
    e?.preventDefault();
    if (!trainerId) return alert('Trainer ID required');
    setBusy(true);
    try {
      await fetch(`/api/admin-bot/trainers/${trainerId}/instruct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, targetContactId: undefined }),
      });
      setInstruction("");
      alert("Instruction recorded");
    } catch (err) {
      console.error(err); alert("Failed to record instruction");
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Trainer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Trainer Contact ID</label>
          <Input value={trainerId} onChange={(e) => setTrainerId(e.target.value)} placeholder="e.g. 923001234567" />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Display Name (optional)</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Targets (comma-separated contact IDs) — leave empty for global</label>
          <Input value={targets} onChange={(e) => setTargets(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <Button onClick={addTrainer} disabled={busy}>Add Trainer</Button>
        </div>

        <hr />

        <div>
          <label className="text-sm">Record Instruction (for selected trainer)</label>
          <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Always be formal when addressing clients." />
          <div className="mt-2 flex gap-2">
            <Button onClick={sendInstruction} disabled={busy || !instruction}>Record Instruction</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
