import React, { useState, useEffect } from 'react';
import { 
  Box, Button, HStack, Heading, SimpleGrid, Card, CardBody, Text,
  Tabs, TabList, TabPanels, Tab, TabPanel, Divider, Input, FormControl, FormLabel, VStack, Icon, Switch, useToast, Select, Badge, IconButton
} from '@chakra-ui/react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useAccount, useWriteContract, useReadContracts } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { FaCoins, FaExchangeAlt, FaWallet, FaChartLine, FaPlus } from 'react-icons/fa';
import { DeleteIcon } from '@chakra-ui/icons';

import { MockERC20Abi } from '../../shared/abi/MockERC20';
import { RailXVaultAbi } from '../../shared/abi/RailXVault';
import { YieldPreview } from '../liquidity/YieldPreview';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const TOKEN_MAP: Record<string, `0x${string}`> = {
  USDC: import.meta.env.VITE_USDC_ADDRESS as `0x${string}`,
  USDT: import.meta.env.VITE_USDT_ADDRESS as `0x${string}`,
  RLUSD: import.meta.env.VITE_RLUSD_ADDRESS as `0x${string}`,
  KRWK: import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`,
  JPYC: import.meta.env.VITE_JPYC_ADDRESS as `0x${string}`,
  XSGD: import.meta.env.VITE_XSGD_ADDRESS as `0x${string}`,
};
const TOKEN_KEYS = Object.keys(TOKEN_MAP);

export function VaultPanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();

  // --- State ---
  // 1. 입출금 관련
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // 2. 전략 생성 관련
  const [strategySellToken, setStrategySellToken] = useState('USDC'); 
  const [strategyBuyToken, setStrategyBuyToken] = useState('KRWK');   
  const [minRate, setMinRate] = useState('1350');
  const [maxRate, setMaxRate] = useState('1450');
  
  // 3. 전략 리스트
  const [myStrategies, setMyStrategies] = useState<any[]>([]);

  const vaultAddress = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;

  // 잔고 조회 Hooks
  const { data: vaultBalances, refetch: refetchVault } = useReadContracts({
    contracts: TOKEN_KEYS.map(key => ({
      address: vaultAddress, abi: RailXVaultAbi, functionName: 'lpBalances', args: [address!, TOKEN_MAP[key]],
    })),
    query: { enabled: !!address }
  });

  const { data: walletBalances, refetch: refetchWallet } = useReadContracts({
    contracts: TOKEN_KEYS.map(key => ({
      address: TOKEN_MAP[key], abi: MockERC20Abi, functionName: 'balanceOf', args: [address!],
    })),
    query: { enabled: !!address }
  });

  const getVaultBalance = (symbol: string) => {
    const idx = TOKEN_KEYS.indexOf(symbol);
    const val = vaultBalances?.[idx]?.result;
    return val ? Number(formatUnits(val as bigint, 18)) : 0;
  };
  
  const getWalletBalance = (symbol: string) => {
    const idx = TOKEN_KEYS.indexOf(symbol);
    const val = walletBalances?.[idx]?.result;
    return val ? Number(formatUnits(val as bigint, 18)) : 0;
  };

  const chartData = TOKEN_KEYS.map(key => ({ name: key, value: getVaultBalance(key) })).filter(d => d.value > 0);

  // 전략 목록 조회
  const fetchStrategies = async () => {
    if (!address) return;
    const { data } = await supabase
      .from('liquidity_orders')
      .select('*')
      .eq('lp_wallet_address', address.toLowerCase())
      .order('created_at', { ascending: false });
    if (data) setMyStrategies(data);
  };

  useEffect(() => {
    fetchStrategies();
  }, [address]);

  // 🔥 [추가] 잔고 변경 시 DB의 '공급 가능 물량' 업데이트
  const updateLiquidityInDB = async (tokenSymbol: string, newBalance: number) => {
    if (!address) return;
    // 해당 토큰을 Selling Token으로 쓰는 모든 전략 업데이트
    const { error } = await supabase
      .from('liquidity_orders')
      .update({ available_amount: newBalance })
      .eq('lp_wallet_address', address.toLowerCase())
      .eq('to_token', tokenSymbol); // 내가 줄 돈(Source)이 기준

    if (error) console.error("DB Sync Error:", error);
    else fetchStrategies(); // UI 갱신
  };

  // 입금
  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    try {
      const tokenAddr = TOKEN_MAP[selectedToken];
      const amount = parseUnits(depositAmount, 18);
      
      toast({ title: `1/2. ${selectedToken} 승인 중...`, status: "info" });
      await writeContractAsync({
        address: tokenAddr, abi: MockERC20Abi, functionName: 'approve',
        args: [vaultAddress, amount]
      });

      toast({ title: "2/2. Vault 입금 중...", status: "info" });
      await writeContractAsync({
        address: vaultAddress, abi: RailXVaultAbi, functionName: 'depositLiquidity',
        args: [tokenAddr, amount]
      });

      toast({ status: "success", title: "입금 완료!" });
      setDepositAmount('');
      refetchVault();
      refetchWallet();
      
      // DB 잔고 동기화
      updateLiquidityInDB(selectedToken, getVaultBalance(selectedToken) + Number(depositAmount));

    } catch (e: any) {
      toast({ status: "error", title: "실패", description: e.message });
    }
  };

  // 출금
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

      // DB 잔고 동기화
      updateLiquidityInDB(selectedToken, Math.max(0, getVaultBalance(selectedToken) - Number(withdrawAmount)));

    } catch (e: any) {
      toast({ status: "error", title: "실패", description: e.message });
    }
  };

  // 전략 저장
  const handleSaveStrategy = async () => {
    if (!address) return;
    const currentBal = getVaultBalance(strategySellToken);

    const { error } = await supabase.from('liquidity_orders').upsert({
      lp_wallet_address: address.toLowerCase(),
      from_token: strategyBuyToken,
      to_token: strategySellToken,
      min_rate: minRate, 
      max_rate: maxRate,
      available_amount: currentBal,
      is_active: true
    }, { onConflict: 'lp_wallet_address, from_token, to_token' } as any);

    if (!error) {
      toast({ status: "success", title: "Strategy Saved" });
      fetchStrategies();
    } else {
      toast({ status: "error", title: "Save Failed", description: "이미 존재하는 페어이거나 오류가 발생했습니다." });
    }
  };

  // 전략 삭제
  const handleDeleteStrategy = async (id: string) => {
    const { error } = await supabase.from('liquidity_orders').delete().eq('id', id);
    if (!error) {
      toast({ status: "info", title: "Strategy Deleted" });
      setMyStrategies(prev => prev.filter(s => s.id !== id));
    }
  };

  // 전략 토글
  const handleToggleStrategy = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('liquidity_orders').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setMyStrategies(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
    }
  };

  return (
    <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
      
      {/* [Left] Portfolio Chart */}
      <Card h="full" bg="railx.800" borderColor="railx.700" borderWidth="1px" gridColumn={{ xl: "span 1" }}>
        <CardBody>
          <Heading size="md" mb={6} color="gray.300">Vault Portfolio</Heading>
          <Box h="250px" w="100%">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#121417', borderColor: '#333', color: '#fff' }} />
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
                 <Text fontWeight="bold" color="white">{d.value.toLocaleString()}</Text>
               </HStack>
            ))}
          </VStack>
        </CardBody>
      </Card>

      {/* [Right] Management Tabs */}
      <Card h="full" bg="railx.800" borderColor="railx.700" borderWidth="1px" gridColumn={{ xl: "span 2" }}>
        <CardBody>
          <Tabs variant="railx-segment" colorScheme="yellow">
            <TabList mb={6} bg="blackAlpha.400" p={1} borderRadius="lg">
              <Tab><Icon as={FaExchangeAlt} mr={2}/> Multi-FX Strategies</Tab>
              <Tab><Icon as={FaWallet} mr={2}/> Manage Liquidity</Tab>
              <Tab><Icon as={FaChartLine} mr={2}/> Yield Simulator</Tab>
            </TabList>

            <TabPanels>
              
              {/* Tab 1: Strategies (List & Create) */}
              <TabPanel p={0}>
                <VStack spacing={6} align="stretch">
                   {/* 생성 폼 */}
                   <Box p={5} bg="blackAlpha.300" borderRadius="xl" border="1px solid" borderColor="railx.700">
                     <HStack mb={4}><Icon as={FaPlus} color="railx.accent"/><Text fontWeight="bold">Create New Strategy</Text></HStack>
                     <SimpleGrid columns={2} spacing={4} mb={4}>
                       <FormControl>
                         <FormLabel fontSize="xs" color="gray.500">I PROVIDE (Sell)</FormLabel>
                         <Select value={strategySellToken} onChange={(e) => setStrategySellToken(e.target.value)} bg="railx.900" size="sm">
                           {TOKEN_KEYS.map(t => <option key={t} value={t}>{t} (Bal: {getVaultBalance(t).toLocaleString()})</option>)}
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
                     <Button size="sm" colorScheme="yellow" w="full" onClick={handleSaveStrategy}>Add Strategy</Button>
                   </Box>

                   <Divider borderColor="railx.700" />

                   {/* 전략 리스트 */}
                   <Text fontSize="sm" color="gray.400" fontWeight="bold">ACTIVE STRATEGIES ({myStrategies.length})</Text>
                   <VStack align="stretch" spacing={3} maxH="300px" overflowY="auto">
                     {myStrategies.length === 0 && <Text fontSize="sm" color="gray.600" textAlign="center">No active strategies.</Text>}
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

              {/* Tab 2: Deposit/Withdraw (복구됨!) */}
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
                      <HStack justify="space-between">
                        <Text fontWeight="bold" color="green.300">DEPOSIT</Text>
                        <Text fontSize="xs" color="gray.400">Wallet: {getWalletBalance(selectedToken).toLocaleString()}</Text>
                      </HStack>
                      <Input value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} placeholder="0.00" />
                      <Button colorScheme="green" onClick={handleDeposit}>Deposit</Button>
                    </VStack>

                    <VStack align="stretch" spacing={4} p={4} bg="blackAlpha.300" borderRadius="xl" border="1px solid" borderColor="red.900">
                      <HStack justify="space-between">
                        <Text fontWeight="bold" color="red.300">WITHDRAW</Text>
                        <Text fontSize="xs" color="gray.400">Vault: {getVaultBalance(selectedToken).toLocaleString()}</Text>
                      </HStack>
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