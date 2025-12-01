import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Button, HStack, Heading, SimpleGrid, Card, CardBody, Text,
  Tabs, TabList, TabPanels, Tab, TabPanel, Divider, Input, FormControl, FormLabel, VStack, Icon, Switch, useToast, Select, Badge, IconButton
} from '@chakra-ui/react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, XAxis, YAxis, Area, CartesianGrid } from 'recharts';
import { useAccount, useWriteContract, useReadContracts } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { FaCoins, FaExchangeAlt, FaWallet, FaChartLine, FaPlus, FaSyncAlt, FaLayerGroup } from 'react-icons/fa';
import { DeleteIcon } from '@chakra-ui/icons';

import { MockERC20Abi } from '../../shared/abi/MockERC20';
import { RailXVaultAbi } from '../../shared/abi/RailXVault';
import { YieldPreview } from '../liquidity/YieldPreview';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const CHART_FILL = "#8884d8";
const MY_POS_FILL = "#FFBB28";

// .env가 없으면 빈 문자열로 처리하여 에러 방지 (디버깅용)
const TOKEN_MAP: Record<string, `0x${string}`> = {
  USDC: (import.meta.env.VITE_USDC_ADDRESS || "") as `0x${string}`,
  USDT: (import.meta.env.VITE_USDT_ADDRESS || "") as `0x${string}`,
  RLUSD: (import.meta.env.VITE_RLUSD_ADDRESS || "") as `0x${string}`,
  KRWK: (import.meta.env.VITE_KRWK_ADDRESS || "") as `0x${string}`,
  JPYC: (import.meta.env.VITE_JPYC_ADDRESS || "") as `0x${string}`,
  XSGD: (import.meta.env.VITE_XSGD_ADDRESS || "") as `0x${string}`,
};
const TOKEN_KEYS = Object.keys(TOKEN_MAP);
const APPROX_USD_RATES: Record<string, number> = { USDC: 1, USDT: 1, RLUSD: 1, KRWK: 1/1400, JPYC: 1/150, XSGD: 0.75 };

export function VaultPanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast(); // 🔥 최상단 선언 필수

  // --- State ---
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const [strategySellToken, setStrategySellToken] = useState('USDC'); 
  const [strategyBuyToken, setStrategyBuyToken] = useState('KRWK');   
  const [minRate, setMinRate] = useState('1350');
  const [maxRate, setMaxRate] = useState('1450');
  
  const [myStrategies, setMyStrategies] = useState<any[]>([]);
  const [marketDepthData, setMarketDepthData] = useState<any[]>([]);

  const vaultAddress = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;

  // 1. 잔고 조회
  const { data: vaultBalances, refetch: refetchVault } = useReadContracts({
    contracts: TOKEN_KEYS.map(key => ({ address: vaultAddress, abi: RailXVaultAbi, functionName: 'lpBalances', args: [address!, TOKEN_MAP[key]] })),
    query: { enabled: !!address && !!vaultAddress }
  });
  const { data: walletBalances, refetch: refetchWallet } = useReadContracts({
    contracts: TOKEN_KEYS.map(key => ({ address: TOKEN_MAP[key], abi: MockERC20Abi, functionName: 'balanceOf', args: [address!] })),
    query: { enabled: !!address }
  });

  const getVaultBalance = (symbol: string) => {
    const val = vaultBalances?.[TOKEN_KEYS.indexOf(symbol)]?.result;
    return val ? Number(formatUnits(val as bigint, 18)) : 0;
  };
  const getWalletBalance = (symbol: string) => {
    const val = walletBalances?.[TOKEN_KEYS.indexOf(symbol)]?.result;
    return val ? Number(formatUnits(val as bigint, 18)) : 0;
  };

  const chartData = TOKEN_KEYS.map(key => ({ 
    name: key, 
    value: getVaultBalance(key) * (APPROX_USD_RATES[key] || 0), 
    realBalance: getVaultBalance(key) 
  })).filter(d => d.value > 0);

  // 2. 전략 & 마켓 데이터 조회
  const fetchStrategies = useCallback(async () => {
    if (!address) return;
    const { data } = await supabase.from('liquidity_orders').select('*').eq('lp_wallet_address', address.toLowerCase()).order('updated_at', { ascending: false });
    if (data) setMyStrategies(data);
  }, [address]);

  const fetchMarketDepth = useCallback(async () => {
    const { data: allOrders } = await supabase.from('liquidity_orders').select('*')
      .eq('from_token', strategyBuyToken).eq('to_token', strategySellToken).eq('is_active', true);

    if (!allOrders || allOrders.length === 0) { setMarketDepthData([]); return; }

    let globalMin = Math.min(...allOrders.map(o => Number(o.min_rate)));
    let globalMax = Math.max(...allOrders.map(o => Number(o.max_rate)));
    const span = globalMax - globalMin;
    globalMin = Math.floor(globalMin - span * 0.1); globalMax = Math.ceil(globalMax + span * 0.1);
    if (globalMin === globalMax) { globalMin -= 10; globalMax += 10; }

    const step = (globalMax - globalMin) / 20;
    const buckets = [];
    for (let i = 0; i <= 20; i++) {
      const rate = globalMin + (step * i);
      let totalVol = 0; let myVol = 0;
      allOrders.forEach(order => {
        if (rate >= Number(order.min_rate) && rate <= Number(order.max_rate)) {
          totalVol += Number(order.available_amount);
          if (order.lp_wallet_address === address?.toLowerCase()) myVol += Number(order.available_amount);
        }
      });
      buckets.push({ rate: Math.round(rate), totalLiquidity: totalVol, myLiquidity: myVol, otherLiquidity: totalVol - myVol });
    }
    setMarketDepthData(buckets);
  }, [strategyBuyToken, strategySellToken, address]);

  useEffect(() => { fetchStrategies(); fetchMarketDepth(); }, [fetchStrategies, fetchMarketDepth]);

  // DB 업데이트 (전략 잔고 동기화)
  const updateLiquidityInDB = async (tokenSymbol: string, newBalance: number) => {
    if (!address) return;
    await supabase.from('liquidity_orders').update({ available_amount: newBalance })
      .eq('lp_wallet_address', address.toLowerCase()).eq('to_token', tokenSymbol);
    fetchStrategies(); fetchMarketDepth();
  };

  // 🔥 [핵심] 입금 핸들러 (디버깅 로그 추가)
  const handleDeposit = async () => {
    if (!address) return toast({ status: "error", title: "지갑 연결 필요" });
    if (!depositAmount) return toast({ status: "warning", title: "금액을 입력하세요" });
    
    const tokenAddr = TOKEN_MAP[selectedToken];
    if (!tokenAddr || !tokenAddr.startsWith("0x")) {
      console.error("Invalid Token Address:", selectedToken, tokenAddr);
      return toast({ status: "error", title: "토큰 주소 오류", description: ".env 파일을 확인하세요" });
    }
    if (!vaultAddress || !vaultAddress.startsWith("0x")) {
      console.error("Invalid Vault Address:", vaultAddress);
      return toast({ status: "error", title: "Vault 주소 오류", description: ".env 파일을 확인하세요" });
    }

    try {
      const amount = parseUnits(depositAmount, 18);
      
      // 1. Approve
      console.log("1. Approving...");
      toast({ title: `1/2. ${selectedToken} 승인 요청 중...`, status: "info" });
      
      await writeContractAsync({
        address: tokenAddr, 
        abi: MockERC20Abi, 
        functionName: 'approve',
        args: [vaultAddress, amount]
      });

      // 2. Deposit
      toast({ title: "2/2. Vault 입금 요청 중...", status: "info" });
      
      await writeContractAsync({
        address: vaultAddress, 
        abi: RailXVaultAbi, // 🔥 여기서 ABI에 depositLiquidity가 있어야 함!
        functionName: 'depositLiquidity',
        args: [tokenAddr, amount]
      });

      toast({ status: "success", title: "입금 완료!" });
      
      setDepositAmount('');
      refetchVault();
      refetchWallet();
      updateLiquidityInDB(selectedToken, getVaultBalance(selectedToken) + Number(depositAmount));

    } catch (e: any) {
      console.error("❌ Deposit Error:", e);
      toast({ status: "error", title: "실패", description: e.message || "알 수 없는 오류" });
    }
  };

  // 출금 핸들러
  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return;
    try {
      const tokenAddr = TOKEN_MAP[selectedToken];
      const amount = parseUnits(withdrawAmount, 18);

      toast({ title: "Vault 출금 중...", status: "info" });
      await writeContractAsync({
        address: vaultAddress, abi: RailXVaultAbi, functionName: 'withdrawLiquidity',
        args: [tokenAddr, amount]
      });

      toast({ status: "success", title: "출금 완료!" });
      setWithdrawAmount('');
      refetchVault();
      refetchWallet();
      updateLiquidityInDB(selectedToken, Math.max(0, getVaultBalance(selectedToken) - Number(withdrawAmount)));
    } catch (e: any) { toast({ status: "error", title: "실패", description: e.message }); }
  };

  const handleSaveStrategy = async () => {
    if (!address) return;
    const currentBal = getVaultBalance(strategySellToken);
    const { error } = await supabase.from('liquidity_orders').upsert({
      lp_wallet_address: address.toLowerCase(),
      from_token: strategyBuyToken, to_token: strategySellToken,
      min_rate: minRate, max_rate: maxRate, available_amount: currentBal, is_active: true
    }, { onConflict: 'lp_wallet_address, from_token, to_token' } as any);

    if (!error) { toast({ status: "success", title: "Saved!" }); fetchStrategies(); fetchMarketDepth(); }
    else { toast({ status: "error", description: error.message }); }
  };

  const handleDeleteStrategy = async (id: string) => {
    const { error } = await supabase.from('liquidity_orders').delete().eq('id', id);
    if (!error) { toast({ status: "info", title: "Deleted" }); fetchStrategies(); fetchMarketDepth(); }
  };
  const handleToggleStrategy = async (id: string, status: boolean) => {
    const { error } = await supabase.from('liquidity_orders').update({ is_active: !status }).eq('id', id);
    if (!error) { fetchStrategies(); fetchMarketDepth(); }
  };

  return (
    <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
      {/* [Left] Portfolio */}
      <Card h="full" bg="railx.800" borderColor="railx.700" borderWidth="1px" gridColumn={{ xl: "span 1" }}>
        <CardBody>
          <Heading size="md" mb={6} color="gray.300">Vault Portfolio (USD Value)</Heading>
          <Box h="250px" w="100%">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#121417', borderColor: '#333' }} formatter={(val:number, name:any, props:any) => [`$${val.toLocaleString()}`, `${props.payload.realBalance.toLocaleString()} ${name}`]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <VStack justify="center" h="full"><Text color="gray.500">No Assets in Vault</Text></VStack>
            )}
          </Box>
          <VStack mt={4} align="stretch" spacing={3}>
            {chartData.map((d, idx) => (
               <HStack key={d.name} justify="space-between">
                 <HStack><Box w={3} h={3} bg={COLORS[idx % COLORS.length]} borderRadius="full"/><Text fontSize="sm" color="gray.400">{d.name}</Text></HStack>
                 <Text fontWeight="bold" color="white">{d.realBalance.toLocaleString()}</Text>
               </HStack>
            ))}
          </VStack>
        </CardBody>
      </Card>

      {/* [Right] Tabs */}
      <Card h="full" bg="railx.800" borderColor="railx.700" borderWidth="1px" gridColumn={{ xl: "span 2" }}>
        <CardBody>
          <Tabs variant="railx-segment" colorScheme="yellow">
            <TabList mb={6} bg="blackAlpha.400" p={1} borderRadius="lg">
              <Tab><Icon as={FaExchangeAlt} mr={2}/> Multi-FX Strategies</Tab>
              <Tab><Icon as={FaWallet} mr={2}/> Manage Liquidity</Tab>
              <Tab><Icon as={FaChartLine} mr={2}/> Yield Simulator</Tab>
            </TabList>

            <TabPanels>
              {/* Tab 1: Strategies */}
              <TabPanel p={0}>
                <VStack spacing={6} align="stretch">
                   {/* Market Depth Chart */}
                   <Box p={4} bg="blackAlpha.500" borderRadius="xl" border="1px solid" borderColor="railx.700">
                     <HStack justify="space-between" mb={4}>
                       <HStack><Icon as={FaLayerGroup} color="railx.accent" /><Text fontWeight="bold" fontSize="sm">MARKET LIQUIDITY: {strategyBuyToken} → {strategySellToken}</Text></HStack>
                       <Badge colorScheme="purple" fontSize="xs">LIVE DEPTH</Badge>
                     </HStack>
                     <Box h="200px" w="100%">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={marketDepthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                           <defs>
                             <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_FILL} stopOpacity={0.3}/><stop offset="95%" stopColor={CHART_FILL} stopOpacity={0}/></linearGradient>
                             <linearGradient id="colorMy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={MY_POS_FILL} stopOpacity={0.8}/><stop offset="95%" stopColor={MY_POS_FILL} stopOpacity={0}/></linearGradient>
                           </defs>
                           <XAxis dataKey="rate" stroke="#555" tick={{fontSize: 10}} />
                           <YAxis stroke="#555" tick={{fontSize: 10}} />
                           <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                           <Tooltip contentStyle={{ backgroundColor: '#121417', borderColor: '#555' }} />
                           <Area type="monotone" dataKey="totalLiquidity" stroke={CHART_FILL} fillOpacity={1} fill="url(#colorTotal)" />
                           <Area type="monotone" dataKey="myLiquidity" stroke={MY_POS_FILL} fillOpacity={1} fill="url(#colorMy)" />
                         </AreaChart>
                       </ResponsiveContainer>
                     </Box>
                   </Box>

                   {/* Create Strategy */}
                   <Box p={5} bg="blackAlpha.300" borderRadius="xl" border="1px solid" borderColor="railx.700">
                     <HStack mb={4}><Icon as={FaPlus} color="railx.accent"/><Text fontWeight="bold">Create / Update Strategy</Text></HStack>
                     <SimpleGrid columns={2} spacing={4} mb={4}>
                       <FormControl>
                         <FormLabel fontSize="xs" color="gray.500">I PROVIDE (Sell)</FormLabel>
                         <Select value={strategySellToken} onChange={(e) => setStrategySellToken(e.target.value)} bg="railx.900" size="sm">
                           {TOKEN_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
                         </Select>
                       </FormControl>
                       <FormControl>
                         <FormLabel fontSize="xs" color="gray.500">I RECEIVE (Buy)</FormLabel>
                         <Select value={strategyBuyToken} onChange={(e) => setStrategyBuyToken(e.target.value)} bg="railx.900" size="sm">
                           {TOKEN_KEYS.map(t => <option key={t} value={t} disabled={t === strategySellToken}>{t}</option>)}
                         </Select>
                       </FormControl>
                     </SimpleGrid>
                     <FormControl mb={4}>
                        <FormLabel fontSize="xs" color="gray.500">Rate Range ({strategyBuyToken} per 1 {strategySellToken})</FormLabel>
                        <HStack>
                          <Input value={minRate} onChange={e=>setMinRate(e.target.value)} placeholder="Min" size="sm" />
                          <Text>-</Text>
                          <Input value={maxRate} onChange={e=>setMaxRate(e.target.value)} placeholder="Max" size="sm" />
                        </HStack>
                     </FormControl>
                     <Button size="sm" colorScheme="yellow" w="full" onClick={handleSaveStrategy}>Save Strategy</Button>
                   </Box>

                   <Divider borderColor="railx.700" />

                   {/* Strategy List */}
                   <HStack justify="space-between">
                     <Text fontSize="sm" color="gray.400" fontWeight="bold">MY ACTIVE STRATEGIES ({myStrategies.length})</Text>
                     <IconButton aria-label="Refresh" icon={<FaSyncAlt />} size="xs" onClick={fetchStrategies} variant="ghost" />
                   </HStack>
                   <VStack align="stretch" spacing={3} maxH="300px" overflowY="auto">
                     {myStrategies.map((strat) => (
                       <HStack key={strat.id} justify="space-between" p={3} bg="railx.900" borderRadius="lg" borderLeft={strat.is_active ? "4px solid #4ADE80" : "4px solid gray"}>
                         <VStack align="start" spacing={0}>
                           <HStack>
                             <Badge colorScheme="blue">{strat.to_token}</Badge>
                             <Icon as={FaExchangeAlt} size="xs" color="gray.500" />
                             <Badge colorScheme="purple">{strat.from_token}</Badge>
                           </HStack>
                           <Text fontSize="xs" color="gray.400" mt={1}>Rate: {strat.min_rate} ~ {strat.max_rate}</Text>
                         </VStack>
                         <HStack>
                           <Switch colorScheme="green" isChecked={strat.is_active} onChange={() => handleToggleStrategy(strat.id, strat.is_active)} />
                           <IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" variant="ghost" colorScheme="red" onClick={() => handleDeleteStrategy(strat.id)} />
                         </HStack>
                       </HStack>
                     ))}
                   </VStack>
                </VStack>
              </TabPanel>

              {/* Tab 2: Deposit/Withdraw */}
              <TabPanel p={0}>
                <VStack spacing={6} align="stretch">
                  <FormControl>
                    <FormLabel color="gray.400">Select Asset</FormLabel>
                    <Select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} bg="railx.900">
                      {TOKEN_KEYS.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </FormControl>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
                    <VStack align="stretch" spacing={4} p={4} bg="blackAlpha.300" borderRadius="xl" border="1px solid" borderColor="green.900">
                      <HStack justify="space-between"><Text fontWeight="bold" color="green.300">DEPOSIT</Text><Text fontSize="xs" color="gray.400">Wallet: {getWalletBalance(selectedToken).toLocaleString()}</Text></HStack>
                      <Input value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder="0.00" />
                      <Button colorScheme="green" onClick={handleDeposit}>Deposit</Button>
                    </VStack>
                    <VStack align="stretch" spacing={4} p={4} bg="blackAlpha.300" borderRadius="xl" border="1px solid" borderColor="red.900">
                      <HStack justify="space-between"><Text fontWeight="bold" color="red.300">WITHDRAW</Text><Text fontSize="xs" color="gray.400">Vault: {getVaultBalance(selectedToken).toLocaleString()}</Text></HStack>
                      <Input value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} placeholder="0.00" />
                      <Button colorScheme="red" variant="outline" onClick={handleWithdraw}>Withdraw</Button>
                    </VStack>
                  </SimpleGrid>
                </VStack>
              </TabPanel>
              
              {/* Tab 3: Yield */}
              <TabPanel p={0}><YieldPreview /></TabPanel>

            </TabPanels>
          </Tabs>
        </CardBody>
      </Card>
    </SimpleGrid>
  );
}