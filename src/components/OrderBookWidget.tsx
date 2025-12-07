import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Badge, Divider, Tooltip } from '@chakra-ui/react';
import { createClient } from '@supabase/supabase-js';
import { getLiveOracleRate } from '../utils/mockOracle'; // 🔥 추가됨

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface OrderBookProps {
  fromToken: string;
  toToken: string;
  currentAmount: string;
}

export function OrderBookWidget({ fromToken, toToken }: OrderBookProps) {
  const [asks, setAsks] = useState<any[]>([]);
  const [oracleRate, setOracleRate] = useState<number>(0);
  const [rawOrders, setRawOrders] = useState<any[]>([]); // DB 원본 데이터

  // 1. DB에서 주문 데이터 가져오기 (처음 한 번만, 또는 토큰 바뀔 때)
  useEffect(() => {
    const fetchOrders = async () => {
      const { data } = await supabase
        .from('liquidity_orders')
        .select('*')
        .eq('from_token', fromToken)
        .eq('to_token', toToken)
        .eq('is_active', true);
      
      if (data) setRawOrders(data);
      else setRawOrders([]);
    };
    fetchOrders();
  }, [fromToken, toToken]);

  // 2. 🔥 [핵심] 실시간 가격 업데이트 (1초마다)
  useEffect(() => {
    const updateMarket = () => {
      const pairKey = `${toToken}/${fromToken}`; // 예: USDC/KRWK
      const currentOracle = getLiveOracleRate(pairKey);
      setOracleRate(currentOracle);

      if (rawOrders.length === 0) {
        setAsks([]);
        return;
      }

      // 오라클 가격에 맞춰 LP 주문 가격 재계산
      const processed = rawOrders.map(order => {
        let price = Number(order.min_rate);
        
        if (order.strategy_type === 'ORACLE') {
          // Oracle Rate + Spread 적용
          const spread = Number(order.spread_bps) / 10000;
          price = currentOracle * (1 + spread);
        }

        return { ...order, finalPrice: price };
      });

      // 가격 내림차순 정렬 (매도 호가창)
      setAsks(processed.sort((a, b) => b.finalPrice - a.finalPrice));
    };

    updateMarket(); // 즉시 실행
    const timer = setInterval(updateMarket, 1000); // 1초마다 갱신
    return () => clearInterval(timer);
  }, [rawOrders, fromToken, toToken]);

  const maxVol = Math.max(...asks.map(a => Number(a.available_amount)), 1);

  return (
    <Box bg="railx.800" border="1px solid" borderColor="railx.700" borderRadius="xl" p={4} h="100%" minH="400px">
      <HStack justify="space-between" mb={4}>
        <Text fontWeight="bold" fontSize="sm" color="gray.300">ORDER BOOK</Text>
        <Badge colorScheme="purple">{toToken}/{fromToken}</Badge>
      </HStack>

      <HStack fontSize="xs" color="gray.500" mb={2} px={1}>
        <Text flex={1}>Price ({fromToken})</Text>
        <Text flex={1} textAlign="right">Amt ({toToken})</Text>
      </HStack>

      {/* 호가 리스트 (세로형 그래프) */}
      <VStack align="stretch" spacing="2px" overflowY="auto" maxH="320px" sx={{'&::-webkit-scrollbar':{width:'4px'}, '&::-webkit-scrollbar-thumb':{bg:'gray.700'}}}>
        {asks.length === 0 ? (
          <Text fontSize="xs" color="gray.600" textAlign="center" py={10}>No Liquidity</Text>
        ) : (
          asks.map((ask, idx) => {
            const barWidth = (Number(ask.available_amount) / maxVol) * 100;
            return (
              <Tooltip key={idx} label={`Strategy: ${ask.strategy_type}`} placement="left" hasArrow>
                <Box position="relative" h="28px" display="flex" alignItems="center" cursor="pointer" _hover={{ bg: 'whiteAlpha.100' }}>
                  {/* Depth Bar (배경 그래프) */}
                  <Box 
                    position="absolute" right={0} top={1} bottom={1} 
                    w={`${barWidth}%`} 
                    bg={ask.strategy_type === 'ORACLE' ? "cyan.900" : "red.900"} 
                    opacity={0.4} 
                    borderRadius="sm"
                  />
                  
                  <HStack w="full" justify="space-between" zIndex={1} px={2}>
                    <Text fontSize="xs" color={ask.strategy_type === 'ORACLE' ? "cyan.300" : "red.300"} fontWeight="bold">
                      {ask.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                    <Text fontSize="xs" color="white" fontFamily="monospace">
                      {Number(ask.available_amount).toLocaleString()}
                    </Text>
                  </HStack>
                </Box>
              </Tooltip>
            );
          })
        )}
      </VStack>

      <Divider my={3} borderColor="gray.700" />
      
      <HStack justify="space-between">
         <VStack align="start" spacing={0}>
           <Text fontSize="xs" color="gray.500">Index Price</Text>
           <Text fontSize="xs" color="gray.600">(Oracle)</Text>
         </VStack>
         <Text fontSize="md" color="white" fontWeight="bold">
           {oracleRate > 0 ? oracleRate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
         </Text>
      </HStack>
    </Box>
  );
}