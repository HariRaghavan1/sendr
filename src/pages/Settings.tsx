import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [userId, setUserId] = useState<string>("");
  
  const [settings, setSettings] = useState({
    clado_api_key: "",
    composio_api_key: "",
  });

  const [visibility, setVisibility] = useState({
    clado_api_key: false,
    composio_api_key: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } else if (data) {
      setSettings({
        clado_api_key: data.clado_api_key || "",
        composio_api_key: data.composio_api_key || "",
      });
    } else {
      // No settings row exists yet - create one
      const { error: insertError } = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          clado_api_key: "",
          composio_api_key: "",
        });

      if (insertError) {
        console.error("Error creating settings:", insertError);
        toast.error("Failed to initialize settings");
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to save settings");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        ...settings,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved successfully");
    }
    setSaving(false);
  };

  const toggleVisibility = (key: keyof typeof visibility) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isKeyConfigured = (key: string) => {
    return settings[key as keyof typeof settings]?.length > 0;
  };

  const testComposioConnection = async () => {
    if (!settings.composio_api_key) {
      toast.error("Please save your Composio API key first");
      return;
    }

    setTestingConnection(true);
    try {
      const response = await fetch(
        `https://backend.composio.dev/api/v2/connections?entityId=${userId}`,
        {
          headers: {
            'X-API-Key': settings.composio_api_key,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const connections = await response.json();
      const gmailConnected = connections.some((c: any) => 
        c.appName?.toLowerCase() === 'gmail' || c.integrationId?.toLowerCase().includes('gmail')
      );

      if (gmailConnected) {
        toast.success("✅ Gmail is connected and ready to send emails!");
      } else {
        toast.error("❌ Gmail not connected. Follow the setup guide below.");
      }
    } catch (error: any) {
      console.error("Connection test failed:", error);
      toast.error("Failed to test connection: " + error.message);
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Configure your API keys to enable Bork's features</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Add your API keys to enable lead discovery, email generation, and sending
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Clado API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="clado">Clado API Key</Label>
                {isKeyConfigured("clado_api_key") ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="clado"
                  type={visibility.clado_api_key ? "text" : "password"}
                  placeholder="Enter your Clado API key"
                  value={settings.clado_api_key}
                  onChange={(e) => setSettings({ ...settings, clado_api_key: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleVisibility("clado_api_key")}
                  aria-label={visibility.clado_api_key ? "Hide Clado API key" : "Show Clado API key"}
                >
                  {visibility.clado_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Used for B2B lead discovery. Get your key at <a href="https://clado.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">clado.ai</a>
              </p>
            </div>

            <Separator />

            {/* Composio API Key */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="composio">Composio API Key</Label>
                {isKeyConfigured("composio_api_key") ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="composio"
                  type={visibility.composio_api_key ? "text" : "password"}
                  placeholder="Enter your Composio API key"
                  value={settings.composio_api_key}
                  onChange={(e) => setSettings({ ...settings, composio_api_key: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleVisibility("composio_api_key")}
                  aria-label={visibility.composio_api_key ? "Hide Composio API key" : "Show Composio API key"}
                >
                  {visibility.composio_api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Used for email sending via Gmail/Outlook. Get your key at <a href="https://app.composio.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">app.composio.dev</a>
              </p>
              
              {isKeyConfigured("composio_api_key") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testComposioConnection}
                  disabled={testingConnection}
                  className="mt-2 w-full"
                >
                  {testingConnection ? "Testing..." : "Test Gmail Connection"}
                </Button>
              )}

              <div className="mt-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm font-semibold mb-2 text-foreground">📧 How to Connect Gmail:</p>
                <ol className="text-xs space-y-2 text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">1.</span>
                    <span>Go to <a href="https://app.composio.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">app.composio.dev</a></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">2.</span>
                    <span>Navigate to <strong>Connections</strong> → <strong>Add Connection</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">3.</span>
                    <span>Select <strong>Gmail</strong> integration</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">4.</span>
                    <div className="flex-1">
                      <span>Set <strong>Entity ID</strong> to:</span>
                      <code className="block mt-1 px-2 py-1 bg-muted rounded text-xs font-mono break-all">
                        {userId || "Loading..."}
                      </code>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">5.</span>
                    <span>Click <strong>Authorize</strong> and log in with your Gmail account</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">6.</span>
                    <span>Return here and click <strong>Test Gmail Connection</strong></span>
                  </li>
                </ol>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
