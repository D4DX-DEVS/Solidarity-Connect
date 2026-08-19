import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const LogoutConfirmDialog = ({ open, onOpenChange, onConfirm }: LogoutConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[20rem] rounded-2xl p-6 gap-5 [&>button]:hidden sm:max-w-sm">
      <DialogHeader className="items-center gap-1.5 space-y-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <LogOut className="h-5 w-5 text-destructive" />
        </div>
        <DialogTitle className="text-center pt-1">Confirm Logout</DialogTitle>
        <DialogDescription className="text-center">Are you sure you want to log out?</DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex flex-row gap-3">
        <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1 h-11 rounded-xl" onClick={onConfirm}>
          Logout
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default LogoutConfirmDialog;
