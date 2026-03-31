import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export function TerminateAccountDialog() {
  const { t } = useTranslation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmPhrase = "DELETE MY ACCOUNT";

  const handleTerminate = async () => {
    if (confirmText !== confirmPhrase) {
      toast.error(t('modals.terminateConfirmError'));
      return;
    }

    setIsDeleting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error(t('modals.terminateMustBeLoggedIn'));
        return;
      }

      const { data, error } = await supabase.functions.invoke("terminate-account", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to terminate account");
      }

      toast.success(t('modals.terminateSuccess'));
      
      // Sign out and redirect to auth page
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Failed to terminate account:", error);
      toast.error(t('modals.terminateFailed'));
    } finally {
      setIsDeleting(false);
      setIsOpen(false);
      setConfirmText("");
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="h-4 w-4" />
          {t('modals.terminateAccount')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <AlertDialogTitle>{t('modals.terminateAccount')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 pt-2">
            <p className="font-semibold text-destructive">
              {t('modals.terminateActionPermanent')}
            </p>
            <p>
              {t('modals.terminateWillDelete')}
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>{t('modals.terminateProfile')}</li>
              <li>{t('modals.terminateRoles')}</li>
              <li>{t('modals.terminatePrefs')}</li>
              <li>{t('modals.terminateData')}</li>
            </ul>
            <p className="text-sm">
              <span className="font-medium">{profile?.email}</span> {t('modals.terminateEmailAvailable')}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-delete">
            {t('modals.terminateTypeConfirm')} <span className="font-mono font-bold text-destructive">{confirmPhrase}</span> {t('modals.terminateToConfirm')}
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('modals.terminateConfirmPlaceholder')}
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t('modals.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleTerminate}
            disabled={confirmText !== confirmPhrase || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('modals.terminating')}
              </>
            ) : (
              t('modals.permanentlyDeleteAccount')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
