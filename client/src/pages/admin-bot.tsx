import TrainerList from "@/components/adminBot/TrainerList";
import TrainerForm from "@/components/adminBot/TrainerForm";

export default function AdminBotPage() {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Bot — Trainers</h1>
        <p className="text-sm text-muted-foreground">Manage trainer contacts and their instructions.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <TrainerForm />
        </div>
        <div className="md:col-span-1">
          <TrainerList />
        </div>
      </div>
    </div>
  );
}
