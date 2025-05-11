import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { BrowserQRCodeReader } from '@zxing/browser';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { useEffect, useState } from "react";

interface QRCodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const QRCodeDialog = ({ isOpen, onClose, roomId }: QRCodeDialogProps) => {
  const [scanResult, setScanResult] = useState('');

  const roomUrl = `${window.location.origin}/room?idroom=${roomId}`;

  useEffect(() => {
    if (isOpen) {
      const codeReader = new BrowserQRCodeReader();
      codeReader.decodeFromVideoDevice(undefined, 'video', (result, error) => {
        if (result) {
          const text = result.getText();
          setScanResult(text);
          window.location.href = text;
        }
        if (error) {
          console.error(error);
        }
      });
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mã QR phòng họp</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6">
          <QRCode value={roomUrl} size={256} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Quét mã QR để tham gia phòng họp
          </p>
          <p className="mt-2 px-4 text-center text-xs font-medium break-all">
            {roomUrl}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};