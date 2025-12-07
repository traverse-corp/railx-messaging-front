// 기준 환율 (Base Rates)
const BASE_RATES: Record<string, number> = {
  // 외화 -> 원화
  'USDC/KRWK': 1350.50,
  'USDT/KRWK': 1352.00,
  'RLUSD/KRWK': 1348.80,
  'JPYC/KRWK': 9.12,
  'XSGD/KRWK': 1015.40,
  
  // 원화 -> 외화 (역방향)
  'KRWK/USDC': 1 / 1350.50,
  'KRWK/USDT': 1 / 1352.00,
  'KRWK/RLUSD': 1 / 1348.80,
  'KRWK/JPYC': 1 / 9.12,
  'KRWK/XSGD': 1 / 1015.40,
};

// 🔥 [핵심] 실시간 오라클 환율 생성기
// pair: "USDC/KRWK" 형태
export function getLiveOracleRate(pair: string): number {
  let base = BASE_RATES[pair];

  // 직접 정의된 쌍이 없으면 역방향 계산 시도
  if (!base) {
    const [baseToken, quoteToken] = pair.split('/');
    const reverseKey = `${quoteToken}/${baseToken}`;
    if (BASE_RATES[reverseKey]) {
      base = 1 / BASE_RATES[reverseKey];
    }
  }

  if (!base) return 0;

  // 3초(3000ms)마다 값이 바뀜 (너무 정신없지 않게)
  const timeStep = Math.floor(Date.now() / 10000);
  
  // Pseudo-random noise: -0.2% ~ +0.2%
  // Math.sin을 써서 자연스럽게 오르내리도록 연출
  const noise = Math.sin(timeStep) * 0.002; 
  
  return base * (1 + noise);
}