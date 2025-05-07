import { useCallback, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import CONSTANT from "@/lib/constant";

interface NetworkStats {
  upBps: number;
  downBps: number;
  rtt: number | null;
  jitter: number | null;
  isGoodNetwork: boolean;
  isPoorNetwork: boolean;
}

interface UseNetworkMonitorProps {
  transport: any;
  onPoorNetworkDetected?: () => void;
  onGoodNetworkDetected?: () => void;
  onMediumNetworkDetected?: () => void;
  interval?: number;
}

export function useNetworkMonitor({
  transport,
  onPoorNetworkDetected,
  onGoodNetworkDetected,
  onMediumNetworkDetected,
}: UseNetworkMonitorProps) {
  const POOR_NETWORK_RTT = CONSTANT.POOR_NETWORK_RTT;
  const POOR_NETWORK_DOWNBPS = CONSTANT.POOR_NETWORK_DOWNBPS;
  const GOOD_NETWORK_RTT = CONSTANT.GOOD_NETWORK_RTT;
  const GOOD_NETWORK_DOWNBPS = CONSTANT.GOOD_NETWORK_DOWNBPS;
  const POOR_NETWORK_JITTER = 150;

  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);

  const poorNetworkCounterRef = useRef(0);
  const goodNetworkCounterRef = useRef(0);
  const autoDisabledVideoRef = useRef(false);
  
  // Store last stats between calls
  const lastStatsRef = useRef({
    timestamp: 0,
    bytesReceived: 0,
    bytesSent: 0,
  });

  const poorCbRef = useRef(onPoorNetworkDetected);
  const goodCbRef = useRef(onGoodNetworkDetected);
  const mediumCbRef = useRef(onMediumNetworkDetected);

  useEffect(() => {
    poorCbRef.current = onPoorNetworkDetected;
    goodCbRef.current = onGoodNetworkDetected;
    mediumCbRef.current = onMediumNetworkDetected;
  }, [onPoorNetworkDetected, onGoodNetworkDetected, onMediumNetworkDetected]);

  const startMonitoring = useCallback(async () => {
    if (!transport) return;

    try {
      if (!transport || transport.connectionState !== "connected") {
        toast.error("Giám sát chỉ hoạt động khi có kết nối nhận");
        return;
      }
      
      const stats = await transport.getStats();
      let poorNetworkDetected = false;
      let goodNetworkDetected = false;
      let upBps = 0;
      let downBps = 0;
      let rtt = null;
      let jitter = 0;
      let validStatsFound = false;
      
      // Check for RTT in remote-candidate or other reports
      stats.forEach((report: any) => {
        // Check for RTT in remote-candidate reports
        if (report.type === "remote-candidate" && report.roundTripTime !== undefined) {
          rtt = report.roundTripTime * 1000; // Convert to ms
        }
        
        // Check for RTT in remote-inbound-rtp reports
        if (report.type === "remote-inbound-rtp" && report.roundTripTime !== undefined) {
          rtt = report.roundTripTime * 1000; // Convert to ms
        }
      });
      
      stats.forEach((report: any) => {
        // Process video statistics
        if ((report.type === "inbound-rtp" || report.type === "outbound-rtp") && report.kind === "video") {
          validStatsFound = true;
          const nowTimestamp = report.timestamp;
          const nowBytesReceived = report.bytesReceived || 0;
          const nowBytesSent = report.bytesSent || 0;
          
          // Check for RTT in outbound-rtp as well
          if (report.type === "outbound-rtp" && report.roundTripTime !== undefined) {
            rtt = report.roundTripTime * 1000; // Convert to ms
          }
          
          // Check for standard WebRTC currentRoundTripTime
          if (report.currentRoundTripTime !== undefined && !isNaN(report.currentRoundTripTime)) {
            rtt = report.currentRoundTripTime * 1000; // Convert to ms
          }
      
          // Tính bitrate từ delta
          if (lastStatsRef.current.timestamp && nowTimestamp > lastStatsRef.current.timestamp) {
            const timeDiffSec = (nowTimestamp - lastStatsRef.current.timestamp) / 1000;
            
            // Handle differently based on report type
            if (report.type === "inbound-rtp" && report.bytesReceived !== undefined) {
              const receivedDiff = nowBytesReceived - lastStatsRef.current.bytesReceived;
              if (receivedDiff >= 0 && timeDiffSec > 0) {
                downBps = (receivedDiff * 8) / timeDiffSec;
              }
            }
            
            if (report.type === "outbound-rtp" && report.bytesSent !== undefined) {
              const sentDiff = nowBytesSent - lastStatsRef.current.bytesSent;
              if (sentDiff >= 0 && timeDiffSec > 0) {
                upBps = (sentDiff * 8) / timeDiffSec;
              }
            }
          }
      
          // Jitter (Biến động độ trễ)
          if (report.jitter && !isNaN(report.jitter)) {
            jitter = report.jitter * 1000; // Convert to ms
          }
      
          // Cập nhật lại lastStats (store separate values for inbound/outbound)
          if (report.type === "inbound-rtp") {
            lastStatsRef.current.timestamp = nowTimestamp;
            lastStatsRef.current.bytesReceived = nowBytesReceived;
          } else if (report.type === "outbound-rtp") {
            lastStatsRef.current.timestamp = nowTimestamp;
            lastStatsRef.current.bytesSent = nowBytesSent;
          }
        }
      });
      
      // Debug log to see all available stats types
      if (!rtt) {
        console.debug("Available report types:");
        const reportTypes = new Set();
        stats.forEach((report: any) => {
          reportTypes.add(report.type);
          // For RTT specifically, log any properties that might contain RTT
          if (report.roundTripTime !== undefined || 
              report.currentRoundTripTime !== undefined || 
              (report.type && report.type.includes("rtt"))) {
            console.debug("Potential RTT report:", report.type, report);
          }
        });
        console.debug(Array.from(reportTypes));
      }
      
      // Log chỉ khi có thông số hợp lệ
      console.log(
        `Up: ${Math.round(upBps)}bps, Down: ${Math.round(downBps)}bps, RTT: ${rtt ? rtt.toFixed(2) : 'N/A'}ms, Jitter: ${jitter ? jitter.toFixed(2) : 'N/A'}ms`
      );
      
      // Skip network state updates if no valid stats were found
      if (!validStatsFound) {
        return;
      }
      
      // Xác định tình trạng mạng yếu
      if (
        (rtt && rtt > POOR_NETWORK_RTT) ||
        (downBps && downBps < POOR_NETWORK_DOWNBPS) ||
        jitter > POOR_NETWORK_JITTER
      ) {
        poorNetworkDetected = true;
      }
  
      // Xác định tình trạng mạng mạnh
      if (
        rtt &&
        rtt < GOOD_NETWORK_RTT &&
        downBps &&
        downBps > GOOD_NETWORK_DOWNBPS &&
        jitter < 50
      ) {
        goodNetworkDetected = true;
      }
      
      // Thiết lập trạng thái mạng
      setNetworkStats({
        upBps,
        downBps,
        rtt,
        jitter,
        isPoorNetwork: poorNetworkDetected,
        isGoodNetwork: goodNetworkDetected,
      });
      
      // Mạng yếu
      if (poorNetworkDetected) {
        poorNetworkCounterRef.current++;
        goodNetworkCounterRef.current = 0;
      
        if (
          poorNetworkCounterRef.current >= 3 &&
          !autoDisabledVideoRef.current
        ) {
          if (poorCbRef.current) {
            poorCbRef.current();
            autoDisabledVideoRef.current = true;
          }
        }
      }
      // Mạng mạnh
      else if (goodNetworkDetected) {
        goodNetworkCounterRef.current++;
        poorNetworkCounterRef.current = 0;
      
        if (
          goodNetworkCounterRef.current >= 5 &&
          autoDisabledVideoRef.current
        ) {
          if (goodCbRef.current) {
            goodCbRef.current();
          }
      
          autoDisabledVideoRef.current = false;
        }
      }
      // Mạng trung bình
      else {
        if (mediumCbRef.current) {
          mediumCbRef.current();
        }
      }
    } catch (error) {
      console.error("Error monitoring network stats:", error);
    }
  }, [transport]);

  const resetNetworkCounters = useCallback(() => {
    poorNetworkCounterRef.current = 0;
    goodNetworkCounterRef.current = 0;
    autoDisabledVideoRef.current = false;
    lastStatsRef.current = {
      timestamp: 0,
      bytesReceived: 0,
      bytesSent: 0,
    };
  }, []);

  return {
    networkStats,
    startMonitoring,
    resetNetworkCounters,
  };
}
