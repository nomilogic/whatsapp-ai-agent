import { useSettings, useUpdateSetting } from "@/hooks/use-whatsapp";
import { Save, Settings2, Sparkles, MessageSquare, Power, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSetting } = useUpdateSetting();
  const { toast } = useToast();
  
  // Local state for immediate UI updates before server confirmation
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  const handleUpdate = (key: string, value: string) => {
    // Optimistic update logic could go here, for now just call mutation
    updateSetting(
      { key, value },
      {
        onSuccess: () => {
          toast({
            title: "Setting Saved",
            description: "Your changes have been applied successfully.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to save setting.",
          });
        }
      }
    );
  };

  const getSettingValue = (key: string) => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value || "";
  };

  if (isLoading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
          Agent Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure how your AI agent behaves and interacts with users.
        </p>
      </div>

      <div className="grid gap-6">
        {/* General Controls */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                General Configuration
              </CardTitle>
              <CardDescription>Basic controls for the agent's operation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-medium">
                    <Power className="w-4 h-4 text-primary" />
                    Auto-Reply Enabled
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When enabled, the AI will automatically respond to incoming messages.
                  </p>
                </div>
                <Switch 
                  checked={getSettingValue('auto_reply') === 'true'}
                  onCheckedChange={(checked) => handleUpdate('auto_reply', String(checked))}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Personality */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Personality & Logic
              </CardTitle>
              <CardDescription>Define who your agent is and how it speaks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="system_prompt">System Prompt</Label>
                <Textarea 
                  id="system_prompt"
                  placeholder="You are a helpful assistant..."
                  className="min-h-[150px] font-mono text-sm leading-relaxed rounded-xl resize-y"
                  defaultValue={getSettingValue('system_prompt')}
                  onBlur={(e) => {
                    if (e.target.value !== getSettingValue('system_prompt')) {
                      handleUpdate('system_prompt', e.target.value);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The core instruction set for the AI. Defines tone, constraints, and capabilities.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="model">AI Model</Label>
                  <Input 
                    id="model"
                    defaultValue={getSettingValue('openai_model') || 'gpt-4o'}
                    onBlur={(e) => handleUpdate('openai_model', e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="temp">Temperature (Creativity)</Label>
                  <Input 
                    id="temp"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    defaultValue={getSettingValue('temperature') || '0.7'}
                    onBlur={(e) => handleUpdate('temperature', e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* API Keys */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Integration Settings
              </CardTitle>
              <CardDescription>Manage external service connections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="openai_key">OpenAI API Key</Label>
                <Input 
                  id="openai_key"
                  type="password"
                  placeholder="sk-..."
                  defaultValue={getSettingValue('openai_api_key')}
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== getSettingValue('openai_api_key')) {
                      handleUpdate('openai_api_key', e.target.value);
                    }
                  }}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Required for generating AI responses. Stored securely.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
