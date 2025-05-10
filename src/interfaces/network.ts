export interface NetworkStats {
  upBps: number;
  downBps: number;
  rtt: number | null;
  jitter: number | null;
  isGoodNetwork: boolean;
  isPoorNetwork: boolean;
}

export interface UseNetworkMonitorProps {
  transport: any;
  onPoorNetworkDetected?: () => void;
  onGoodNetworkDetected?: () => void;
  onMediumNetworkDetected?: () => void;
  interval?: number;
}
