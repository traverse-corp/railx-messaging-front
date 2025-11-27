import React from 'react';
import { Box, Button, HStack, Heading, SimpleGrid, Card, CardBody, Stat, StatLabel, StatNumber, StatHelpText, Badge, Text } from '@chakra-ui/react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { MockERC20Abi } from '../../shared/abi/MockERC20';

const COLORS = ['#0088FE', '#FFBB28'];

export function VaultPanel() {
  // V2에서는 Vault가 없지만, 시각적 효과를 위해 Mock 토큰의 총 발행량 등을 보여줍니다.
  const TOKEN_ADDRESS = import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`; // Mock USDC

  const { data: totalSupply } = useReadContract({
    address: TOKEN_ADDRESS, abi: MockERC20Abi, functionName: 'totalSupply',
  });

  const totalVal = totalSupply ? Number(formatUnits(BigInt(String(totalSupply)), 18)) : 0;  
  const chartData = [
    { name: 'Protocol TVL', value: totalVal * 0.4 },
    { name: 'Available Liquidity', value: totalVal * 0.6 }, 
  ];

  return (
    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
      <Card h="full">
        <CardBody>
          <Heading size="md" mb={6} color="gray.300">Market Overview</Heading>
          <SimpleGrid columns={2} spacing={8} mb={8}>
             <Stat>
               <StatLabel color="gray.500">Total Volume</StatLabel>
               <StatNumber fontSize="2xl" color="white">${totalVal.toLocaleString()}</StatNumber>
               <StatHelpText color="green.400">▲ 5.4%</StatHelpText>
             </Stat>
             <Stat>
               <StatLabel color="gray.500">Active Users</StatLabel>
               <StatNumber fontSize="2xl" color="railx.accent">1,204</StatNumber>
             </Stat>
          </SimpleGrid>
          <Box h="200px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#121417', borderColor: '#333', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </CardBody>
      </Card>
      <Card h="full" bgGradient="linear(to-br, railx.800, black)">
        <CardBody display="flex" flexDirection="column" justifyContent="center" gap={6}>
          <Heading size="sm" color="gray.400">Analytics</Heading>
          <Text fontSize="sm" color="gray.500">Real-time compliance monitoring dashboard coming soon.</Text>
          <Button variant="primary" size="lg" w="full" isDisabled>View Analytics</Button>
        </CardBody>
      </Card>
    </SimpleGrid>
  );
}