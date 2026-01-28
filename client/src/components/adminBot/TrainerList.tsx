import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TrainerList() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin-bot/trainers");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const list = data?.trainers ?? data ?? [];
      setTrainers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrainers(); }, []);

  const remove = async (id: number) => {
    if (!confirm("Remove trainer?")) return;
    await fetch(`/api/admin-bot/trainers/${id}`, { method: "DELETE" });
    fetchTrainers();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div>Loading...</div>}
        {!loading && trainers.length === 0 && <div className="text-sm text-muted-foreground">No trainers yet.</div>}
        <div className="space-y-2">
          {trainers.map((t) => (
            <div key={t.trainerContactId} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">{t.displayName || t.trainerContactId}</div>
                <div className="text-xs text-muted-foreground">Targets: {t.targets?.join(", ") || "(global)"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(String(t.trainerContactId))}>Copy ID</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(t.trainerContactId)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
