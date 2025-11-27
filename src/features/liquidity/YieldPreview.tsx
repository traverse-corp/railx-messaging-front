import React, { useState, useEffect } from 'react';
import { 
  Box, Card, CardBody, Heading, Text, VStack, HStack, 
  Stat, StatLabel, StatNumber, StatHelpText, StatArrow,
  Progress, Slider, SliderTrack, SliderFilledTrack, SliderThumb,
  Divider, Badge, SimpleGrid
} from '@chakra-ui/react';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { RailXVaultAbi } from '../../shared/abi/RailXVault'; // ABI 필요 (아래 참고)

export function YieldPreview() {
  const VAULT_ADDRESS = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;
  const KRWK_ADDRESS = import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`; // 수수료가 쌓이는 토큰(KRW 가정)

  // 1. 컨트랙트에서 누적 수수료 조회 (Total Protocol Revenue)
  // (ABI 파일은 Deploy 후 생성해야 함, 여기서는 가상 로직)
  // const { data: totalFees } = useReadContract({ ... });
  
  // 🔥 [Mock Data] 아직 거래가 없으니 시뮬레이션용 데이터
  const mockTotalFees = 45000000; // 4,500만원 누적됨 (가정)
  const mockTotalLiquidity = 1000000000; // 10억원 전체 유동성 (가정)

  // 사용자 입력 시뮬레이션
  const [myDeposit, setMyDeposit] = useState(50000000); // 내가 넣을 금액 (5천만원)

  // APR 계산 로직
  // (일간 평균 수수료 * 365) / 전체 유동성
  const dailyFeeAvg = mockTotalFees / 30; // 최근 30일 기준이라 가정
  const annualRevenue = dailyFeeAvg * 365;
  const protocolAPR = (annualRevenue / mockTotalLiquidity) * 100;

  // 내 예상 수익
  const myShare = myDeposit / (mockTotalLiquidity + myDeposit);
  const myEstYearlyReturn = annualRevenue * myShare;

  return (
    <Card bg="gray.900" border="1px solid" borderColor="railx.accent" position="relative" overflow="hidden">
      {/* 배경 장식 */}
      <Box position="absolute" top="-50px" right="-50px" w="150px" h="150px" bg="railx.accent" opacity="0.1" filter="blur(60px)" />

      <CardBody>
        <HStack justify="space-between" mb={6}>
          <Heading size="md" color="white">💎 Yield Estimator</Heading>
          <Badge colorScheme="green" variant="solid" fontSize="0.9em">LIVE APR: {protocolAPR.toFixed(2)}%</Badge>
        </HStack>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
          <Stat>
            <StatLabel color="gray.400">Total Fees Collected (30d)</StatLabel>
            <StatNumber color="white">₩{mockTotalFees.toLocaleString()}</StatNumber>
            <StatHelpText color="green.400"><StatArrow type="increase" /> 12.5% vs last month</StatHelpText>
          </Stat>
          <Stat>
            <StatLabel color="gray.400">Protocol Liquidity</StatLabel>
            <StatNumber color="white">₩{(mockTotalLiquidity / 100000000).toFixed(1)} Cr</StatNumber>
          </Stat>
          <Stat>
            <StatLabel color="railx.accent">Your Est. Yearly Reward</StatLabel>
            <StatNumber color="railx.accent">₩{Math.floor(myEstYearlyReturn).toLocaleString()}</StatNumber>
            <StatHelpText>Based on current volume</StatHelpText>
          </Stat>
        </SimpleGrid>

        <Divider borderColor="whiteAlpha.200" mb={6} />

        <VStack align="stretch" spacing={4}>
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.300">If I deposit liquidity:</Text>
            <Text fontWeight="bold" color="white">₩{myDeposit.toLocaleString()}</Text>
          </HStack>
          
          <Slider 
            defaultValue={50000000} 
            min={1000000} 
            max={500000000} 
            step={1000000}
            onChange={(val) => setMyDeposit(val)}
          >
            <SliderTrack bg="gray.700">
              <SliderFilledTrack bg="railx.accent" />
            </SliderTrack>
            <SliderThumb boxSize={6} borderColor="railx.accent" />
          </Slider>

          <HStack justify="space-between" fontSize="xs" color="gray.500">
            <Text>1M KRW</Text>
            <Text>500M KRW</Text>
          </HStack>
        </VStack>

        <Box mt={6} p={4} bg="whiteAlpha.100" borderRadius="md">
          <Text fontSize="xs" color="gray.400">
            * RailX collects <b>1.0% spread fee</b> on every cross-border settlement. 
            LPs earn <b>80%</b> of this fee proportional to their liquidity share.
          </Text>
        </Box>
      </CardBody>
    </Card>
  );
}