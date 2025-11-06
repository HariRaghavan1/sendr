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
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [cladoCredits, setCladoCredits] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>("");
  
  const [settings, setSettings] = useState({
    clado_api_key: "",
    composio_api_key: "",
    composio_connected_account_id: "",
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
        composio_connected_account_id: data.composio_connected_account_id || "",
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

  const checkCladoCredits = async () => {
    if (!settings.clado_api_key) {
      toast.error("Please save your Clado API key first");
      return;
    }

    setCheckingCredits(true);
    try {
      const response = await fetch('https://search.clado.ai/api/credits', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.clado_api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid Clado API key. Please check your key.");
        }
        throw new Error(`Failed to check credits: ${response.status}`);
      }

      const data = await response.json();
      setCladoCredits(data.credits || 0);
      
      if (data.credits === 0) {
        toast.error(`No credits remaining. Please purchase credits at https://www.clado.ai/dashboard`);
      } else if (data.credits < 10) {
        toast.warning(`Low credits: ${data.credits} remaining. Consider purchasing more.`);
      } else {
        toast.success(`✅ ${data.credits} credits remaining`);
      }
    } catch (error: any) {
      console.error("Credits check failed:", error);
      toast.error("Failed to check credits: " + (error.message || error));
      setCladoCredits(null);
    } finally {
      setCheckingCredits(false);
    }
  };

  const testComposioConnection = async () => {
    if (!settings.composio_api_key) {
      toast.error("Please save your Composio API key first");
      return;
    }

    setTestingConnection(true);
    try {
      // Use edge function to avoid CORS issues
      const { data, error } = await supabase.functions.invoke('test-composio-connection', {
        body: {},
      });
      
      if (error) {
        // Check if it's a deployment error
        if (error.message?.includes('404') || 
            error.message?.includes('not found') ||
            error.message?.includes('FunctionsRelayError') ||
            error.message?.includes('Failed to send')) {
          throw new Error("Edge function not deployed. Please deploy it in Supabase dashboard or run: supabase functions deploy test-composio-connection");
        }
        
        // Check if it's a non-2xx status code error
        if (error.message?.includes('non-2xx') || error.message?.includes('status code')) {
          const errorDetails = error.context?.body || error.message;
          throw new Error(`Connection test failed: ${errorDetails || 'Please check your Composio API key and ensure Gmail is connected.'}`);
        }
        
        throw error;
      }
      
      if (data.error) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error;
        throw new Error(errorMsg);
      }

      if (data.isGmail) {
        if (data.status === 'ACTIVE') {
          toast.success("✅ Gmail is connected and ready to send emails!");
          // Reload settings to get updated connected account ID if it was auto-saved
          loadSettings();
        } else {
          toast.warning(`Gmail account found but status is: ${data.status || 'unknown'}. Please check your Composio dashboard.`);
        }
      } else {
        toast.error("❌ Gmail not connected. If you connected via Composio dashboard, make sure you're using the same Composio account as your API key.");
      }
    } catch (error: any) {
      console.error("Connection test failed:", error);
      toast.error("Failed to test connection: " + (error.message || error));
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={checkCladoCredits}
                  disabled={checkingCredits || !isKeyConfigured("clado_api_key")}
                  title={!isKeyConfigured("clado_api_key") ? "Save your Clado API key first" : ""}
                >
                  {checkingCredits ? "Checking..." : "Check Credits"}
                </Button>
                {cladoCredits !== null && (
                  <span className="text-sm text-muted-foreground">
                    {cladoCredits === 0 ? (
                      <span className="text-destructive">No credits remaining</span>
                    ) : cladoCredits < 10 ? (
                      <span className="text-yellow-600">⚠️ {cladoCredits} credits remaining</span>
                    ) : (
                      <span className="text-green-600">✅ {cladoCredits} credits remaining</span>
                    )}
                  </span>
                )}
              </div>
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
                Used for email sending via Gmail/Outlook. Get your key at <a href="https://platform.composio.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.composio.dev</a>
              </p>
              
              {/* Connected Account ID */}
              {isKeyConfigured("composio_api_key") && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="composio_account_id">Composio Connected Account ID</Label>
                  <Input
                    id="composio_account_id"
                    type="text"
                    placeholder="ca_CLlDVYpMJpNK"
                    value={settings.composio_connected_account_id}
                    onChange={(e) => setSettings({ ...settings, composio_connected_account_id: e.target.value })}
                    className="text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    If you connected Gmail via the Composio dashboard, enter your Account ID here (starts with <code className="px-1 py-0.5 bg-muted rounded text-xs">ca_</code>). 
                    You should have received this when you connected: <code className="px-1 py-0.5 bg-muted rounded text-xs">ca_CLlDVYpMJpNK</code>
                  </p>
                </div>
              )}
              
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
                    <span>Go to <a href="https://platform.composio.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">platform.composio.dev</a> and log in</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">2.</span>
                    <span>Navigate to the <a href="https://platform.composio.dev?next_page=/marketplace/Gmail" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Gmail Marketplace page</a></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">3.</span>
                    <span>Create a <strong>Gmail Auth Config</strong> if you haven't already (click "Create Gmail Auth Config")</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">4.</span>
                    <span>Look for options to connect your account. You may see:</span>
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      <li>"Connect Account" or "Add Connection" button</li>
                      <li>A "Connected Accounts" section in the dashboard</li>
                      <li>An "Integrations" or "Apps" section</li>
                    </ul>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">5.</span>
                    <div className="flex-1">
                      <span>If prompted for <strong>Entity ID</strong>, use:</span>
                      <code className="block mt-1 px-2 py-1 bg-muted rounded text-xs font-mono break-all">
                        {userId || "Loading..."}
                      </code>
                    </div>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">6.</span>
                    <span>Authorize and log in with your Gmail account</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-medium text-foreground">7.</span>
                    <span>Return here and click <strong>Test Gmail Connection</strong> to verify</span>
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Note: The Composio dashboard interface may have changed. If you can't find connection options in the UI, the connection may need to be done programmatically via the Composio API using your Entity ID above.
                </p>
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
