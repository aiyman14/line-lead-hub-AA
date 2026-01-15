import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen, LogOut, AlertTriangle } from "lucide-react";
import { isRunningFromDMG, openApplicationsFolder, exitApp } from "@/lib/dmg-detection";
import { isTauri } from "@/lib/capacitor";

interface DMGWarningModalProps {
  /** If true, always show modal when running from DMG (for startup check) */
  forceCheck?: boolean;
  /** If true, component was triggered by update button */
  triggeredByUpdate?: boolean;
  /** Callback when modal closes (only for update-triggered modals) */
  onClose?: () => void;
}

export function DMGWarningModal({ 
  forceCheck = false, 
  triggeredByUpdate = false,
  onClose 
}: DMGWarningModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkDMG = async () => {
      // Only check in Tauri environment
      if (!isTauri()) {
        setIsChecking(false);
        return;
      }

      try {
        const isDMG = await isRunningFromDMG();
        if (mounted) {
          setIsOpen(isDMG);
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Error checking DMG status:", error);
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    // For startup check, always run
    // For update-triggered, only run if triggeredByUpdate is true
    if (forceCheck || triggeredByUpdate) {
      checkDMG();
    } else {
      setIsChecking(false);
    }

    return () => {
      mounted = false;
    };
  }, [forceCheck, triggeredByUpdate]);

  const handleOpenApplications = async () => {
    await openApplicationsFolder();
  };

  const handleQuit = async () => {
    await exitApp();
  };

  const handleOpenChange = (open: boolean) => {
    // For update-triggered modals, allow closing
    if (!open && triggeredByUpdate && onClose) {
      setIsOpen(false);
      onClose();
    }
    // For startup modals, don't allow closing - user must move app or quit
  };

  // Don't render anything if not checking and not open
  if (!isOpen && !isChecking) {
    return null;
  }

  // Don't show during initial check
  if (isChecking) {
    return null;
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={handleOpenChange}
    >
      <DialogContent 
        className="max-w-md"
        // Prevent closing by clicking outside for startup modals
        onPointerDownOutside={(e) => {
          if (!triggeredByUpdate) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!triggeredByUpdate) {
            e.preventDefault();
          }
        }}
        // Hide the close button for startup modals
        hideCloseButton={!triggeredByUpdate}
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            </div>
            <DialogTitle className="text-xl">
              Install Required
            </DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed">
            Production Portal must be moved to Applications to enable updates. 
            Please drag the app into your Applications folder and reopen it.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>How to install:</strong>
          </p>
          <ol className="mt-2 space-y-1 text-sm text-muted-foreground list-decimal list-inside">
            <li>Click "Open Applications" below</li>
            <li>Drag Production Portal into the Applications folder</li>
            <li><strong>Eject the disk image</strong> (right-click → Eject, or drag to Trash)</li>
            <li>Open the app from Applications</li>
          </ol>
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-medium">
            ⚠️ Important: You must eject the disk image for automatic updates to work!
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleQuit}
            className="w-full sm:w-auto"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Quit
          </Button>
          <Button
            onClick={handleOpenApplications}
            className="w-full sm:w-auto"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Open Applications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to check if running from DMG before performing an action
 */
export function useDMGCheck() {
  const [showModal, setShowModal] = useState(false);

  const checkBeforeAction = async (action: () => Promise<void>) => {
    if (!isTauri()) {
      await action();
      return;
    }

    const isDMG = await isRunningFromDMG();
    if (isDMG) {
      setShowModal(true);
      return;
    }

    await action();
  };

  const closeModal = () => {
    setShowModal(false);
  };

  return {
    showModal,
    checkBeforeAction,
    closeModal,
    DMGModal: showModal ? (
      <DMGWarningModal 
        triggeredByUpdate={true} 
        onClose={closeModal}
      />
    ) : null,
  };
}
