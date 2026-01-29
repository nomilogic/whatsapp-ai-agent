import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type AgentStatus, type SendMessageRequest, type UpdateSettingRequest } from "@shared/schema";

// --- Status & Connection ---

export function useAgentStatus() {
  return useQuery({
    queryKey: [api.status.get.path],
    queryFn: async () => {
      const res = await fetch(api.status.get.path);
      if (!res.ok) throw new Error("Failed to fetch status");
      return api.status.get.responses[200].parse(await res.json());
    },
    refetchInterval: 3000, // Poll every 3s for QR code updates
  });
}

// --- Contacts ---

export function useContacts() {
  return useQuery({
    queryKey: [api.contacts.list.path],
    queryFn: async () => {
      const res = await fetch(api.contacts.list.path);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return api.contacts.list.responses[200].parse(await res.json());
    },
  });
}

export function useContact(id: number) {
  return useQuery({
    queryKey: [api.contacts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.contacts.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch contact");
      return api.contacts.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// --- Messages ---

export function useMessages(contactId: number) {
  return useQuery({
    queryKey: [api.messages.list.path, contactId],
    queryFn: async () => {
      const url = buildUrl(api.messages.list.path, { id: contactId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return api.messages.list.responses[200].parse(await res.json());
    },
    enabled: !!contactId,
    refetchInterval: 5000, // Poll for new messages
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, content }: { contactId: number; content: string }) => {
      const url = buildUrl(api.messages.send.path, { id: contactId });
      const data: SendMessageRequest = { content };
      
      const res = await fetch(url, {
        method: api.messages.send.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to send message");
      return api.messages.send.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      // Invalidate messages for the specific contact
      queryClient.invalidateQueries({ 
        queryKey: [api.messages.list.path, variables.contactId] 
      });
      // Also invalidate contact list to update "lastMessageAt"
      queryClient.invalidateQueries({ queryKey: [api.contacts.list.path] });
    },
  });
}

// --- Settings ---

export function useSettings() {
  return useQuery({
    queryKey: [api.settings.list.path],
    queryFn: async () => {
      const res = await fetch(api.settings.list.path);
      if (!res.ok) throw new Error("Failed to fetch settings");
      return api.settings.list.responses[200].parse(await res.json());
    },
  });
}

// --- Devices ---
export function useDevices() {
  return useQuery({
    queryKey: ["/api/devices"],
    queryFn: async () => {
      const res = await fetch("/api/devices");
      if (!res.ok) throw new Error("Failed to fetch devices");
      return await res.json();
    },
    refetchInterval: 5000,
  });
}

export function useUpdateDeviceAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceId, agentConfig }: { deviceId: number; agentConfig: any }) => {
      const res = await fetch(`/api/devices/${deviceId}/agent`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentConfig }),
      });
      if (!res.ok) throw new Error("Failed to update agent config");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/devices"] });
    },
  });
}

export function useToggleDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceId, isActive }: { deviceId: number; isActive: boolean }) => {
      const res = await fetch(`/api/devices/${deviceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to toggle device");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/devices"] }),
  });
}

export function useReconnectDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceId }: { deviceId: number }) => {
      const res = await fetch(`/api/devices/${deviceId}/reconnect`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reconnect device");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/devices"] }),
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceName, metadata }: { deviceName: string; metadata?: any }) => {
      const res = await fetch(`/api/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName, metadata }),
      });
      if (!res.ok) throw new Error("Failed to create device");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/devices"] }),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deviceId }: { deviceId: number }) => {
      const res = await fetch(`/api/devices/${deviceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete device");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/devices"] }),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const url = buildUrl(api.settings.update.path, { key });
      const data: UpdateSettingRequest = { value };
      
      const res = await fetch(url, {
        method: api.settings.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to update setting");
      return api.settings.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.settings.list.path] });
    },
  });
}
