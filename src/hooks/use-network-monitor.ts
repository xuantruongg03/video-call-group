import { useCallback, useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import CONSTANT from '@/lib/constant';

interface NetworkStats {
  upBps: number;
  downBps: number;
  rtt: number | null;
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
  interval = 5000
}: UseNetworkMonitorProps) {
  const POOR_NETWORK_RTT = CONSTANT.POOR_NETWORK_RTT;
  const POOR_NETWORK_DOWNBPS = CONSTANT.POOR_NETWORK_DOWNBPS; 
  const GOOD_NETWORK_RTT = CONSTANT.GOOD_NETWORK_RTT;
  const GOOD_NETWORK_DOWNBPS = CONSTANT.GOOD_NETWORK_DOWNBPS;

  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  
  const poorNetworkCounterRef = useRef(0);
  const goodNetworkCounterRef = useRef(0);
  const autoDisabledVideoRef = useRef(false);

  const startMonitoring = useCallback(() => {
    if (!transport) return () => {};
    
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    
    intervalIdRef.current = setInterval(async () => {
      try {
        if (!transport || transport.connectionState !== "connected") {
          if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
          }
          return;
        }

        const stats = await transport.getStats();
        let poorNetworkDetected = false;
        let goodNetworkDetected = false;
        let upBps = 0;
        let downBps = 0;
        let rtt = null;
        
        stats.forEach((report: any) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            upBps = (report.bytesSent * 8) / (report.timestamp / 1000);
            downBps = (report.bytesReceived * 8) / (report.timestamp / 1000);
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : null;
            
            console.log(`Up: ${upBps}bps, Down: ${downBps}bps, RTT: ${rtt}ms`);
            
            if (
              (rtt && rtt > POOR_NETWORK_RTT) || 
              (downBps && downBps < POOR_NETWORK_DOWNBPS)
            ) {
              poorNetworkDetected = true;
            }
            
            if (
              (rtt && rtt < GOOD_NETWORK_RTT) && 
              (downBps && downBps > GOOD_NETWORK_DOWNBPS)
            ) {
              goodNetworkDetected = true;
            }
          }
        });
        
        setNetworkStats({
          upBps,
          downBps,
          rtt,
          isPoorNetwork: poorNetworkDetected,
          isGoodNetwork: goodNetworkDetected
        });
        
        //Mạng yếu
        if (poorNetworkDetected) {
          poorNetworkCounterRef.current++;
          goodNetworkCounterRef.current = 0;
          
          if (poorNetworkCounterRef.current >= 3 && !autoDisabledVideoRef.current) {
            if (onPoorNetworkDetected) {
              onPoorNetworkDetected();
              autoDisabledVideoRef.current = true;
            }
          }
        } 
        //mạng mạnh
        else if (goodNetworkDetected) {
          goodNetworkCounterRef.current++;
          poorNetworkCounterRef.current = 0;
          
          if (goodNetworkCounterRef.current >= 5 && autoDisabledVideoRef.current) {
            if (onGoodNetworkDetected) {
              onGoodNetworkDetected();
            }
            
            autoDisabledVideoRef.current = false;
          }
        }
        //Mạng vừa vừa 
        else {
          if (onMediumNetworkDetected) {
            onMediumNetworkDetected();
          }
        }
        
      } catch (error) {
        console.error("Error monitoring network stats:", error);
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = null;
        }
      }
    }, interval);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [transport, interval, onPoorNetworkDetected, onGoodNetworkDetected]);

  const stopMonitoring = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  const resetNetworkCounters = useCallback(() => {
    poorNetworkCounterRef.current = 0;
    goodNetworkCounterRef.current = 0;
    autoDisabledVideoRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, []);

  return {
    networkStats,
    startMonitoring,
    stopMonitoring,
    resetNetworkCounters
  };
}