import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";

interface LockRoomDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSetPassword: (password: string) => void;
}

const passwordSchema = z.object({
    password: z.string()
        .min(4, "Mật khẩu phải có ít nhất 4 ký tự")
        .max(20, "Mật khẩu không được vượt quá 20 ký tự"),
});

export const LockRoomDialog = ({
    isOpen,
    onClose,
    onSetPassword,
}: LockRoomDialogProps) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof passwordSchema>>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            password: "",
        },
    });

    const handleSubmit = (values: z.infer<typeof passwordSchema>) => {
        setIsSubmitting(true);
        setTimeout(() => {
            onSetPassword(values.password);
            setIsSubmitting(false);
        }, 500);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center flex items-center justify-center gap-2">
                        <Lock className="h-5 w-5" /> Khóa Phòng Họp
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Thiết lập mật khẩu để giới hạn quyền truy cập vào phòng họp
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            placeholder="Nhập mật khẩu phòng họp"
                                            className="w-full focus-visible:outline-blue-400 focus-visible:ring-0"
                                            {...field}
                                            autoFocus
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="sm:justify-center gap-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-blue-400 focus-visible:ring-0"
                            >
                                {isSubmitting ? "Đang xử lý..." : "Xác nhận"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};