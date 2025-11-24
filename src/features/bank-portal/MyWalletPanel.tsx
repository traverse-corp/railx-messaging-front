import React from 'react';
import { Box, Button, HStack, Text, Heading, Card, CardBody, VStack, Divider } from '@chakra-ui/react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { MockERC20Abi } from '../../shared/abi/MockERC20';

export function MyWalletPanel() {
  const { address } = useAccount();
  const TOKEN_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `${string}`;

  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS, abi: MockERC20Abi, functionName: 'balanceOf', args: [address!]
  });

  return (
    <Card minH="400px">
      <CardBody>
        <HStack justify="space-between" mb={6}>
           <Heading size="md" color="white">My Assets</Heading>
           <Text fontFamily="monospace" color="gray.500" fontSize="sm">{address}</Text>
        </HStack>
        <VStack spacing={4} align="stretch">
          <HStack justify="space-between" p={4} bg="whiteAlpha.50" borderRadius="md">
             <HStack>
               <Box w="32px" h="32px" borderRadius="full" bg="blue.500" />
               <Box>
                 <Text fontWeight="bold">Mock USDC</Text>
                 <Text fontSize="xs" color="gray.500">Testnet Stablecoin</Text>
               </Box>
             </HStack>
             <Text fontSize="xl" fontWeight="bold" fontFamily="monospace">
               {balance ? Number(formatUnits(balance, 18)).toLocaleString() : '0'}
             </Text>
          </HStack>
        </VStack>
        <Divider my={8} borderColor="gray.700" />
        <Heading size="sm" mb={4} color="gray.400">Actions</Heading>
        <HStack spacing={4}>
          <Button flex={1} variant="solid">Export History</Button>
        </HStack>
      </CardBody>
    </Card>
  );
}