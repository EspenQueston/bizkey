import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  loading?: boolean
  onConfirm: () => void
}

export function DeleteConfirmDialog({
  open, onOpenChange, title, description, loading, onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <div className="mx-auto sm:mx-0 h-11 w-11 rounded-2xl bg-destructive/10 grid place-items-center mb-1">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20"
            disabled={loading}
            onClick={(e) => { e.preventDefault(); onConfirm() }}
          >
            {loading ? (
              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent animate-spin rounded-full" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
