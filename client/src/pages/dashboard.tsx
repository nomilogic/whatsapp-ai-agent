import { useAgentStatus, useContacts } from "@/hooks/use-whatsapp";
import { QRCodeSVG } from "qrcode.react";
import { MessageSquare, Users, Activity, ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: status, isLoading: loadingStatus, refetch } = useAgentStatus();
  const { data: contacts } = useContacts();

  const connectionState = status?.connected 
    ? 'connected' 
    : status?.connecting 
      ? 'connecting' 
      : 'disconnected';

  // Stats
  const totalContacts = contacts?.length || 0;
  const groupContacts = contacts?.filter(c => c.type === 'group').length || 0;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your WhatsApp Agent status and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <StatusBadge status={connectionState} lastError={status?.lastError} />
        </div>
      </div>

      {/* Connection Status Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-l-4 border-l-primary overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Scan the QR code with WhatsApp on your phone to link the agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* QR Code Area */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border-2 border-dashed border-border min-w-[200px] min-h-[200px]">
                {loadingStatus ? (
                  <div className="animate-pulse flex flex-col items-center gap-2">
                    <div className="w-32 h-32 bg-gray-200 rounded-md" />
                    <span className="text-sm text-gray-400">Loading status...</span>
                  </div>
                ) : status?.connected ? (
                  <div className="text-center text-green-600 space-y-2">
                    <div className="w-32 h-32 mx-auto bg-green-50 rounded-full flex items-center justify-center border border-green-200">
                      <MessageSquare className="w-12 h-12" />
                    </div>
                    <p className="font-medium">Device Linked</p>
                    <p className="text-xs text-muted-foreground">Ready to process messages</p>
                  </div>
                ) : status?.qrCode ? (
                  <div className="space-y-3 text-center">
                    {typeof status.qrCode === 'string' && status.qrCode.startsWith('data:') ? (
                      <img
                        src={status.qrCode}
                        alt="QR Code"
                        width={180}
                        height={180}
                        className="rounded-lg shadow-sm"
                      />
                    ) : (
                      <QRCodeSVG
                        value={status.qrCode || ''}
                        size={180}
                        level="L"
                        includeMargin={true}
                        className="rounded-lg shadow-sm"
                      />
                    )}
                    <p className="text-xs text-muted-foreground font-medium animate-pulse">
                      Scan to login
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p>No QR Code available.</p>
                    <p className="text-xs mt-1">Check logs if stuck.</p>
                  </div>
                )}
              </div>

              {/* Status Details */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Session Status</div>
                    <div className="text-lg font-semibold capitalize flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                      {status?.connected ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Last Error</div>
                    <div className="text-sm font-medium text-destructive truncate" title={status?.lastError}>
                      {status?.lastError || "None"}
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm leading-relaxed">
                  <strong>Tip:</strong> Keep this dashboard open to ensure the connection stays alive during initial setup. Once connected, the agent will run in the background.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{totalContacts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {groupContacts} groups
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Messages Processed</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">--</div>
              <p className="text-xs text-muted-foreground mt-1">
                In current session
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="bg-primary/5 border-primary/20 hover:shadow-lg transition-all duration-200 group cursor-pointer relative overflow-hidden">
            <Link href="/contacts">
              <div className="absolute inset-0" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-primary">Quick Actions</CardTitle>
                <ExternalLink className="h-4 w-4 text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-primary">View Chats</div>
                <p className="text-xs text-primary/70 mt-1">
                  Manage conversations manually
                </p>
              </CardContent>
            </Link>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
