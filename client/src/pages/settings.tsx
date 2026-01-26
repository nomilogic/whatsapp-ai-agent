import { useSettings, useUpdateSetting } from "@/hooks/use-whatsapp";
import { Save, Settings2, Sparkles, MessageSquare, Power, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const GEMINI_MODELS = [
  "gemini-3.0-pro-preview",
  "gemini-3.0-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-3.0-generate-002",
  "imagen-3.0-fast-generate-001"
];

const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo"
];

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
                  <Label htmlFor="ai_provider">AI Provider</Label>
                  <Select 
                    value={getSettingValue('ai_provider') || 'gemini'}
                    onValueChange={(value) => handleUpdate('ai_provider', value)}
                  >
                    <SelectTrigger id="ai_provider" className="font-mono text-sm" data-testid="select-ai-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>
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
                    data-testid="input-temperature"
                  />
                </div>
              </div>

              {getSettingValue('ai_provider') === 'openai' && (
                <div className="space-y-3">
                  <Label htmlFor="openai_model">OpenAI Model</Label>
                  <Select 
                    value={getSettingValue('openai_model') || 'gpt-4o'}
                    onValueChange={(value) => handleUpdate('openai_model', value)}
                  >
                    <SelectTrigger id="openai_model" className="font-mono text-sm" data-testid="select-openai-model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(getSettingValue('ai_provider') === 'gemini' || !getSettingValue('ai_provider')) && (
                <div className="space-y-3">
                  <Label htmlFor="gemini_model">Gemini Model</Label>
                  <Select 
                    value={getSettingValue('gemini_model') || 'gemini-2.5-pro'}
                    onValueChange={(value) => handleUpdate('gemini_model', value)}
                  >
                    <SelectTrigger id="gemini_model" className="font-mono text-sm" data-testid="select-gemini-model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {GEMINI_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose from Gemini chat models or Imagen image generation models.
                  </p>
                </div>
              )}
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
                  data-testid="input-openai-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Required when using OpenAI as your AI provider.
                </p>
              </div>
              <div className="space-y-3">
                <Label htmlFor="gemini_key">Gemini API Key</Label>
                <Input 
                  id="gemini_key"
                  type="password"
                  placeholder="AIza..."
                  defaultValue={getSettingValue('gemini_api_key')}
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== getSettingValue('gemini_api_key')) {
                      handleUpdate('gemini_api_key', e.target.value);
                    }
                  }}
                  className="font-mono text-sm"
                  data-testid="input-gemini-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Required when using Gemini as your AI provider. Get your key from Google AI Studio.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
