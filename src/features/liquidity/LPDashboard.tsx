import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Heading, Text, VStack, HStack, Card, CardBody, 
  SimpleGrid, Input, FormControl, FormLabel, useToast, Divider, 
  Stat, StatLabel, StatNumber, Badge, Switch
} from '@chakra-ui/react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { RailXVaultAbi } from '../../shared/abi/RailXVault';
import { MockERC20Abi } from '../../shared/abi/MockERC20';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function LPDashboard() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();
  
  // State
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [minRate, setMinRate] = useState('1350');
  const [maxRate, setMaxRate] = useState('1360');
  const [isActive, setIsActive] = useState(true); // 영업 중 여부
  
  // Addresses
  const vaultAddress = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;
  const usdcAddress = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`;

  // Vault 내 나의 USDC 잔고 조회
  const { data: myVaultBalance, refetch: refetchBalance } = useReadContract({
    address: vaultAddress,
    abi: RailXVaultAbi,
    functionName: 'lpBalances',
    args: [address!, usdcAddress],
    query: { enabled: !!address }
  });

  const balanceVal = myVaultBalance ? Number(formatUnits(myVaultBalance, 18)) : 0;

  // 1. 유동성 예치 (Deposit)
  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    try {
      const amount = parseUnits(depositAmount, 18);
      
      toast({ title: "Approving USDC...", status: "info" });
      await writeContractAsync({
        address: usdcAddress, abi: MockERC20Abi, functionName: 'approve',
        args: [vaultAddress, amount]
      });

      toast({ title: "Depositing...", status: "info" });
      await writeContractAsync({
        address: vaultAddress, abi: RailXVaultAbi, functionName: 'depositLiquidity',
        // 🔥 [수정] token, amount 인자 순서 확인
        args: [usdcAddress, amount]
      });

      toast({ status: "success", title: "Deposit Successful!" });
      refetchBalance();
      updateStandingOrder(true); // 잔고 바뀌었으니 오더 업데이트

    } catch (e: any) {
      toast({ status: "error", title: "Deposit Failed", description: e.message });
    }
  };

  // 2. 유동성 출금 (Withdraw) - 🔥 [추가됨]
  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return;
    try {
      const amount = parseUnits(withdrawAmount, 18);

      toast({ title: "Withdrawing from Vault...", status: "info" });
      await writeContractAsync({
        address: vaultAddress,
        abi: RailXVaultAbi,
        functionName: 'withdrawLiquidity',
        args: [usdcAddress, amount]
      });

      toast({ status: "success", title: "Withdrawal Successful!" });
      refetchBalance();
      updateStandingOrder(true);

    } catch (e: any) {
      console.error(e);
      toast({ status: "error", title: "Withdrawal Failed", description: e.message });
    }
  };

  // 3. 전략 수정 / 중지 (DB Update)
  const updateStandingOrder = async (activeStatus: boolean) => {
    if (!address) return;
    
    // 현재 Vault 잔고를 '공급 가능 물량'으로 동기화
    // (실제론 Contract Read 값을 써야 정확하지만 여기선 balanceVal 사용)
    const currentBalance = balanceVal; 

    const { error } = await supabase.from('liquidity_orders').upsert({
      lp_wallet_address: address.toLowerCase(),
      from_token: 'KRWK', 
      to_token: 'USDC',
      min_rate: minRate, 
      max_rate: maxRate,
      available_amount: currentBalance, // Vault 잔고만큼만 판다
      is_active: activeStatus
    }, { onConflict: 'lp_wallet_address' } as any);

    if (!error) {
      toast({ status: "success", title: activeStatus ? "Market Making Active" : "Market Making Paused" });
      setIsActive(activeStatus);
    } else {
      toast({ status: "error", title: "Update Failed" });
    }
  };

  return (
    <Box color="white" maxW="container.lg" mx="auto" py={10}>
      <Heading mb={6}>Liquidity Provider Desk</Heading>
      
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
        
        {/* 1. 자금 관리 (Deposit & Withdraw) */}
        <Card bg="railx.800" border="1px solid" borderColor="railx.700">
          <CardBody>
            <Heading size="md" mb={4}>Vault Funds (USDC)</Heading>
            <Stat mb={6} p={4} bg="blackAlpha.400" borderRadius="md">
              <StatLabel color="gray.400">Available in Vault</StatLabel>
              <StatNumber color="railx.accent">{balanceVal.toLocaleString()}</StatNumber>
            </Stat>
            
            <VStack align="stretch" spacing={4}>
              <Text fontWeight="bold" fontSize="sm">Deposit</Text>
              <HStack>
                <Input placeholder="Amount" value={depositAmount} onChange={e=>setDepositAmount(e.target.value)} />
                <Button colorScheme="green" onClick={handleDeposit}>Deposit</Button>
              </HStack>
              
              <Divider borderColor="gray.600" />
              
              <Text fontWeight="bold" fontSize="sm">Withdraw</Text>
              <HStack>
                <Input placeholder="Amount" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} />
                <Button colorScheme="red" variant="outline" onClick={handleWithdraw}>Withdraw</Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* 2. 환율 전략 (Market Making) */}
        <Card bg="railx.800" border="1px solid" borderColor="railx.700">
          <CardBody>
            <HStack justify="space-between" mb={4}>
               <Heading size="md">Strategy (KRW/USD)</Heading>
               <HStack>
                 <Text fontSize="sm" color={isActive ? "green.300" : "gray.500"}>
                   {isActive ? "LIVE" : "PAUSED"}
                 </Text>
                 <Switch colorScheme="green" isChecked={isActive} onChange={(e) => updateStandingOrder(e.target.checked)} />
               </HStack>
            </HStack>

            <VStack spacing={6} align="stretch">
              <FormControl>
                <FormLabel color="gray.400">Rate Range</FormLabel>
                <HStack>
                   <Input value={minRate} onChange={e=>setMinRate(e.target.value)} placeholder="Min" />
                   <Text>~</Text>
                   <Input value={maxRate} onChange={e=>setMaxRate(e.target.value)} placeholder="Max" />
                </HStack>
              </FormControl>
              
              <Button colorScheme="yellow" w="full" onClick={() => updateStandingOrder(isActive)}>
                Update Rates
              </Button>
              
              <Text fontSize="xs" color="gray.500">
                * Your standing order will automatically match incoming requests based on these rates and your Vault balance.
              </Text>
            </VStack>
          </CardBody>
        </Card>

      </SimpleGrid>
    </Box>
  );
}