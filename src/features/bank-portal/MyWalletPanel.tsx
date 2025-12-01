import React from 'react';
import { 
  Box, Button, HStack, Text, Heading, Card, CardBody, VStack, Divider, Badge, SimpleGrid, Flex,
  IconButton, useClipboard, Tooltip as ChakraTooltip, useToast
} from '@chakra-ui/react';
import { CopyIcon, CheckIcon } from '@chakra-ui/icons';
import { 
  useAccount, 
  useReadContracts, 
  useWriteContract, 
  useChainId,       // 현재 체인 ID 확인
  useSwitchChain    // 체인 전환 함수
} from 'wagmi';
import { polygonAmoy } from 'wagmi/chains'; // 목표 체인
import { formatUnits } from 'viem';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MockERC20Abi } from '../../shared/abi/MockERC20';

// 차트 색상
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#ff788aff', '#8284eeff', '#a4f897ff'];

export function MyWalletPanel() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  
  // 🔥 현재 연결된 네트워크 ID와 전환 함수 가져오기
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  
  const toast = useToast();
  const { onCopy, hasCopied } = useClipboard(address || "");

  // 토큰 설정
  const tokens = [
    { symbol: 'USDC', name: 'USD Coin', address: import.meta.env.VITE_USDC_ADDRESS as `0x${string}`, color: COLORS[0] },
    { symbol: 'USDT', name: 'Tether USD', address: import.meta.env.VITE_USDT_ADDRESS as `0x${string}`, color: COLORS[1] },
    { symbol: 'RLUSD', name: 'Ripple USD', address: import.meta.env.VITE_RLUSD_ADDRESS as `0x${string}`, color: COLORS[2] },
    { symbol: 'KRWK', name: 'KRW Coin', address: import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`, color: COLORS[3] },
    { symbol: 'JPYC', name: 'JPY Coin', address: import.meta.env.VITE_JPYC_ADDRESS as `0x${string}`, color: COLORS[4] },
    { symbol: 'XSGD', name: 'XSGD Coin', address: import.meta.env.VITE_XSGD_ADDRESS as `0x${string}`, color: COLORS[5] },
  ];

  // 1. 잔액 조회
  const { data: balances } = useReadContracts({
    contracts: tokens.map(t => ({
      address: t.address,
      abi: MockERC20Abi,
      functionName: 'balanceOf',
      args: [address],
    }))
  });

  // 2. 데이터 가공
  const portfolioData = tokens.map((token, index) => {
    const rawBalance = balances?.[index]?.result;
    const balance = rawBalance ? Number(formatUnits(BigInt(String(rawBalance)), 18)) : 0;
    return {
      name: token.symbol,
      value: balance,
      color: token.color
    };
  });

  const totalValue = portfolioData.reduce((acc, cur) => acc + cur.value, 0);

  // 4. Faucet (네트워크 강제 전환 로직 포함)
  const handleMint = async (tokenAddress: `0x${string}`, symbol: string) => {
    if (!address) {
      toast({ status: 'warning', title: '지갑을 먼저 연결해주세요.' });
      return;
    }

    try {
      // 🔥 [핵심] 현재 네트워크가 Amoy가 아니면 강제로 전환 요청
      if (chainId !== polygonAmoy.id) {
        try {
          await switchChainAsync({ chainId: polygonAmoy.id });
          // 전환 후 잠시 대기 (안정성 확보)
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          // 유저가 전환을 거부하면 함수 종료
          toast({ status: 'warning', title: '네트워크 전환 필요', description: 'Polygon Amoy 네트워크로 전환해야 실행할 수 있습니다.' });
          return;
        }
      }

      toast({ title: `${symbol} 발행 요청 중...`, status: "info" });

      // 이제 안전하게 트랜잭션 실행
      await writeContractAsync({
        address: tokenAddress,
        abi: MockERC20Abi,
        functionName: 'mint',
        args: [address!, 100000n * 10n**18n] // 10만 개 발행
      });

      toast({ status: 'success', title: '발행 완료!', description: `100,000 ${symbol}가 지급되었습니다.` });
      
    } catch (e: any) {
      console.error(e);
      toast({ status: 'error', title: '실패', description: e.message });
    }
  };

  return (
    <Card h="full" bg="railx.800" borderColor="railx.700" borderWidth="1px">
      <CardBody>
        {/* 상단 헤더 영역 */}
        <HStack justify="space-between" mb={6} wrap="wrap" spacing={4}>
           <Heading size="md" color="white">My Portfolio</Heading>
           
           <HStack bg="blackAlpha.400" p={2} borderRadius="lg" border="1px solid" borderColor="railx.700">
             <Badge colorScheme={address ? "green" : "gray"} variant="subtle" fontSize="xs">
               {address ? "ACTIVE" : "DISCONNECTED"}
             </Badge>
             <Text fontFamily="monospace" color="gray.300" fontSize="sm" fontWeight="bold">
               {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "No Wallet"}
             </Text>
             <ChakraTooltip label={hasCopied ? "Copied!" : "Copy Address"} closeOnClick={false}>
               <IconButton
                 aria-label="Copy Address"
                 icon={hasCopied ? <CheckIcon color="green.400" /> : <CopyIcon />}
                 size="xs"
                 variant="ghost"
                 colorScheme="gray"
                 onClick={onCopy}
                 isDisabled={!address}
               />
             </ChakraTooltip>
           </HStack>
        </HStack>

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8} alignItems="center">
          
          {/* 좌측: 파이 차트 */}
          <Box h="250px" position="relative">
            {totalValue > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={portfolioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {portfolioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748', borderRadius: '8px' }}
                    itemStyle={{ color: '#E2E8F0' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Flex h="100%" align="center" justify="center" flexDirection="column" gap={2}>
                <Text color="gray.500" fontSize="sm">No Assets Found</Text>
                <Button size="xs" colorScheme="yellow" variant="outline" onClick={() => handleMint(tokens[0].address, 'USDC')}>
                  Get Test Tokens
                </Button>
              </Flex>
            )}
            
            {/* 중앙 텍스트 효과 */}
            {totalValue > 0 && (
              <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -65%)" textAlign="center">
                <Text fontSize="xs" color="gray.400">Total Est.</Text>
                <Text fontWeight="bold" color="white" fontSize="lg">${(totalValue).toLocaleString()}</Text>
              </Box>
            )}
          </Box>

          {/* 우측: 자산 목록 & Faucet 버튼 */}
          <VStack spacing={4} align="stretch">
            {portfolioData.map((asset, idx) => (
              <HStack key={asset.name} justify="space-between" p={3} bg="railx.900" borderRadius="lg" borderLeft={`4px solid ${asset.color}`}>
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold" color="white">{asset.name}</Text>
                  <Text fontSize="xs" color="gray.500">Stablecoin</Text>
                </VStack>
                <HStack>
                  <Text fontWeight="bold" fontFamily="monospace" color="gray.200">
                    {asset.value.toLocaleString()}
                  </Text>
                  {/* 🔥 Mint 버튼 클릭 시 handleMint 호출 */}
                  <Button size="xs" variant="ghost" color="gray.500" _hover={{ color: 'railx.accent' }} onClick={() => handleMint(tokens[idx].address, asset.name)}>
                    + Mint
                  </Button>
                </HStack>
              </HStack>
            ))}
          </VStack>

        </SimpleGrid>

        <Divider my={6} borderColor="railx.700" />

        <Heading size="sm" mb={4} color="gray.400">Actions</Heading>
        <HStack spacing={4}>
          <Button flex={1} variant="outline">Bridge Assets</Button>
          <Button flex={1} variant="outline">Export History</Button>
        </HStack>
      </CardBody>
    </Card>
  );
}