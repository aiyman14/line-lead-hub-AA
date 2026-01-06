import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { TerminateAccountDialog } from "@/components/TerminateAccountDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Settings2, Bell, Palette, Globe, Sun, Moon, Monitor, AlertTriangle, Package } from "lucide-react";

type Language = 'en' | 'bn';

const LANGUAGES = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'bn', label: 'বাংলা', nativeLabel: 'Bangla' },
] as const;

export default function Preferences() {
  const { t, i18n } = useTranslation();
  const { profile, loading, factory, isAdminOrHigher } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('app-language') as Language) || 'en';
  });
  const [mounted, setMounted] = useState(false);
  
  // Storage settings
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [savingStorageSettings, setSavingStorageSettings] = useState(false);
  
  useEffect(() => {
    if (factory?.low_stock_threshold) {
      setLowStockThreshold(factory.low_stock_threshold);
    }
  }, [factory?.low_stock_threshold]);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
    localStorage.setItem('app-language', value);
    i18n.changeLanguage(value);
  };

  async function handleSaveStorageSettings() {
    if (!profile?.factory_id) return;
    setSavingStorageSettings(true);
    try {
      const { error } = await supabase
        .from('factory_accounts')
        .update({ low_stock_threshold: lowStockThreshold })
        .eq('id', profile.factory_id);
      
      if (error) throw error;
      toast({ title: "Settings saved" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setSavingStorageSettings(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t('preferences.needFactory')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('preferences.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('preferences.description')}
          </p>
        </div>
      </div>

      {/* Display Preferences Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('preferences.displaySettings')}</CardTitle>
          </div>
          <CardDescription>
            {t('preferences.displayDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('preferences.theme')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('preferences.themeDescription')}
            </p>
            {mounted && (
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="grid grid-cols-3 gap-4"
              >
                <Label
                  htmlFor="theme-light"
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    theme === 'light' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                  <Sun className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t('preferences.light')}</span>
                </Label>
                
                <Label
                  htmlFor="theme-dark"
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    theme === 'dark' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                  <Moon className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t('preferences.dark')}</span>
                </Label>
                
                <Label
                  htmlFor="theme-system"
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    theme === 'system' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                  <Monitor className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{t('preferences.system')}</span>
                </Label>
              </RadioGroup>
            )}
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">{t('preferences.language')}</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('preferences.languageDescription')}
            </p>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder={t('preferences.language')} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.label}</span>
                      {lang.value === 'bn' && (
                        <span className="text-muted-foreground">({lang.nativeLabel})</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t('preferences.notifications')}</CardTitle>
          </div>
          <CardDescription>
            {t('preferences.notificationsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferences />
        </CardContent>
      </Card>

      {/* Storage Settings - Admin Only */}
      {isAdminOrHigher() && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Storage Settings</CardTitle>
            </div>
            <CardDescription>
              Configure storage and inventory thresholds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="lowStockThreshold" className="text-base font-medium">
                Low Stock Threshold
              </Label>
              <p className="text-sm text-muted-foreground">
                Items with balance at or below this value will be marked as low stock on the Storage Dashboard.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min={1}
                  max={1000}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  className="w-32"
                />
                <Button 
                  onClick={handleSaveStorageSettings} 
                  disabled={savingStorageSettings}
                >
                  {savingStorageSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone - Terminate Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that will permanently affect your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
              <div className="space-y-1">
                <p className="font-medium">Terminate Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <TerminateAccountDialog />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
