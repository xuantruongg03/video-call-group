import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea } from "../ui/scroll-area";
import { X } from "lucide-react";
import { toast } from "sonner";
import CONSTANT from "src/lib/constant";

interface User {
  peerId: string;
  username?: string;
  isCreator?: boolean;
}

interface WhiteboardPermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  allowedUsers: string[];
  onUpdatePermissions: (allowedUsers: string[]) => void;
}

export const WhiteboardPermissionsDialog = ({
  isOpen,
  onClose,
  users,
  allowedUsers,
  onUpdatePermissions,
}: WhiteboardPermissionsDialogProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([...allowedUsers]);
  
  useEffect(() => {
    setSelectedUsers([...allowedUsers]);
  }, [allowedUsers]);

  const handleCheckboxChange = (peerId: string, checked: boolean) => {
    if (checked) {
      if (selectedUsers.length >= CONSTANT.MAX_PERMISSION_WHITEBOARD) {
        toast.error('Số người dùng được phép vẽ bảng trắng đã đạt giới hạn');
        return;
      }
      setSelectedUsers((prev) => [...prev, peerId]);
    } else {
      setSelectedUsers((prev) => prev.filter((id) => id !== peerId));
    }
  };

  const handleRemoveAll = () => {
    setSelectedUsers([]);
    onUpdatePermissions([]);
  };

  const handleSave = () => {
    onUpdatePermissions(selectedUsers);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Quản lý quyền vẽ</DialogTitle>
          <DialogDescription>
            Chọn người dùng được phép vẽ trên bảng trắng. Người dùng không được chọn sẽ chỉ có thể xem.
          </DialogDescription>
        </DialogHeader>
        
        {allowedUsers.length > 0 && (
          <div className="flex justify-between mb-2">
            <span>Người dùng</span>
            <Button variant="outline" size="sm" onClick={handleRemoveAll}>
              Xóa tất cả quyền
            </Button>
          </div>
        )}
        <ScrollArea className="mt-2 max-h-[300px]">
          {users.map((user) => {
            if (user.isCreator) return null;
            
            const isChecked = selectedUsers.includes(user.peerId);
            
            return (
              <div key={user.peerId} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={user.peerId}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleCheckboxChange(user.peerId, checked === true)}
                  />
                  <label
                    htmlFor={user.peerId}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {user.username || user.peerId}
                  </label>
                </div>
                
                {isChecked && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-red-500"
                    // onClick={() => handleRemoveUser(user.peerId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave}>Lưu thay đổi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};