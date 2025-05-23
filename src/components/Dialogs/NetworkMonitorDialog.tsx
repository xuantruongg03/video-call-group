import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Activity } from "lucide-react";
import { useNetworkMonitor } from "@/hooks/use-network-monitor";
import { toast } from "sonner";

interface NetworkMonitorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    transport: any;
}

export const NetworkMonitorDialog = ({
    isOpen,
    onClose,
    transport,
}: NetworkMonitorDialogProps) => {
    const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(false);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(5);
    const monitoringIntervalMs = 5000;

    const {
        networkStats,
        startMonitoring,
    } = useNetworkMonitor({
        transport,
        onPoorNetworkDetected: () => {
            toast.warning("Mạng yếu đã được phát hiện", {
                description: "Chất lượng mạng kém có thể ảnh hưởng đến cuộc gọi"
            });
        },
        onGoodNetworkDetected: () => {
            toast.success("Kết nối mạng ổn định", {
                description: "Chất lượng mạng đã trở lại mức tốt"
            });
        }
    });

    useEffect(() => {
        const tick = () => {
            setTimeLeft((prev) => {
                if (prev === 1) {
                    startMonitoring();
                    return monitoringIntervalMs / 1000;
                }
                return prev - 1;
            });
        };

        if (isMonitoringEnabled) {
            setTimeLeft(monitoringIntervalMs / 1000);
            countdownRef.current = setInterval(tick, 1000);
        } else {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        }

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
            }
        };
    }, [isMonitoringEnabled, startMonitoring, monitoringIntervalMs]);

    const formatCountdown = (ms: number | null): string => {
        return `${ms}`;
    };

    const formatValue = (value: number, unit: string, decimals: number = 0): string => {
        if (value === 0) return `0 ${unit}`;

        if (unit === 'bps') {
            if (value > 1000000) {
                return `${(value / 1000000).toFixed(decimals)} Mbps`;
            } else if (value > 1000) {
                return `${(value / 1000).toFixed(decimals)} Kbps`;
            }
        }

        return `${value.toFixed(decimals)} ${unit}`;
    };

    const getNetworkQualityLabel = () => {
        if (!networkStats) return "Chưa có dữ liệu";

        if (networkStats.isPoorNetwork) {
            return "Kém";
        } else if (networkStats.isGoodNetwork) {
            return "Tốt";
        } else {
            return "Trung bình";
        }
    };

    const getNetworkQualityColor = () => {
        if (!networkStats) return "text-gray-500";

        if (networkStats.isPoorNetwork) {
            return "text-red-500";
        } else if (networkStats.isGoodNetwork) {
            return "text-green-500";
        } else {
            return "text-yellow-500";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center flex items-center justify-center gap-2">
                        <Activity className="h-5 w-5" /> Giám sát mạng
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Theo dõi các thông số mạng của bạn trong cuộc gọi
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center space-x-2 my-4">
                    <Switch
                        id="network-monitoring"
                        checked={isMonitoringEnabled}
                        onCheckedChange={setIsMonitoringEnabled}
                    />
                    <Label htmlFor="network-monitoring">
                        {isMonitoringEnabled ? "Đang giám sát" : "Tắt giám sát"}
                    </Label>
                </div>

                <div className="space-y-4 bg-gray-50 p-4 rounded-md">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Chất lượng mạng:</span>
                        <span className={`font-semibold ${getNetworkQualityColor()}`}>
                            {getNetworkQualityLabel()}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Tốc độ tải lên:</span>
                        <span className="font-mono">
                            {networkStats ? formatValue(networkStats.upBps, 'bps', 1) : "N/A"}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Tốc độ tải xuống:</span>
                        <span className="font-mono">
                            {networkStats ? formatValue(networkStats.downBps, 'bps', 1) : "N/A"}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Độ trễ (RTT):</span>
                        <span className="font-mono">
                            {networkStats && networkStats.rtt !== null ? `${networkStats.rtt.toFixed(0)} ms` : "N/A"}
                        </span>
                    </div>
                </div>

                <div className="mt-2 text-xs text-gray-500">
                    <p>
                        {isMonitoringEnabled
                            ? `Cập nhật tiếp theo sau ${formatCountdown(timeLeft)} giây`
                            : "Giám sát mạng đang tắt"}
                    </p>

                </div>

                <DialogFooter className="mt-4 sm:justify-center">
                    <Button onClick={onClose}>
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 