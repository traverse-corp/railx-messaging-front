import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Button, Heading, Text, VStack, Code, useToast, Alert, AlertIcon,
  useDisclosure, HStack, Divider, Badge, Icon, SimpleGrid, Card, CardBody
} from '@chakra-ui/react';
import { useAccount, usePublicClient, useSignMessage, useWriteContract } from 'wagmi';
import { parseAbiItem, parseUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { FaCheckCircle, FaLock, FaShieldAlt, FaExchangeAlt, FaArrowRight, FaFileSignature } from 'react-icons/fa';

import { deriveKeyFromSignature, unlockPrivateKey, decryptDataPacket } from '../../utils/crypto';
import { RAILX_SIGNING_MESSAGE } from '../../utils/constants';
import { ReportExportModal } from './ReportExportModal';
import { ComplianceScanModal } from '../../components/ComplianceScanModal';
import { RailXVaultAbi } from '../../shared/abi/RailXVault';
import { MockERC20Abi } from '../../shared/abi/MockERC20';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TOKEN_MAP: Record<string, `0x${string}`> = {
  USDC: import.meta.env.VITE_USDC_ADDRESS as `0x${string}`,
  USDT: import.meta.env.VITE_USDT_ADDRESS as `0x${string}`,
  RLUSD: import.meta.env.VITE_RLUSD_ADDRESS as `0x${string}`,
  KRWK: import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`,
  JPYC: import.meta.env.VITE_JPYC_ADDRESS as `0x${string}`,
  XSGD: import.meta.env.VITE_XSGD_ADDRESS as `0x${string}`,
};

export function ReceiveDashboard() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const toast = useToast();
  
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [nftLogs, setNftLogs] = useState<any[]>([]);
  const [decryptedContent, setDecryptedContent] = useState<any>(null);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  
  // 🔥 데이터를 확실하게 잡기 위해 useRef 사용
  const activeRequestRef = useRef<any>(null);

  // 1. 키 잠금 해제
  const unlockKeys = async () => {
    if (!address) return;
    try {
      const targetAddress = address.toLowerCase();
      const { data } = await supabase.from('profiles').select('encrypted_rsa_private_key').eq('wallet_address', targetAddress).single();
      if (!data) return toast({ status: 'warning', title: 'Identity Not Found', description: 'Please complete onboarding first.' });

      const message = `${RAILX_SIGNING_MESSAGE}${targetAddress}`;
      const sig = await signMessageAsync({ message });
      const derivedKey = await deriveKeyFromSignature(sig, targetAddress);
      const privKey = await unlockPrivateKey(data.encrypted_rsa_private_key, derivedKey);
      
      setMyPrivateKey(privKey);
      toast({ status: 'success', title: 'Unlocked Successfully', description: 'Secure vault access granted.' });
    } catch (e: any) {
      toast({ status: 'error', title: 'Unlock Failed', description: e.message });
    }
  };

  // 2. 데이터 조회
  useEffect(() => {
    if (!address) return;

    const fetchData = async () => {
      const targetAddr = address.toLowerCase();

      // (A) DB Requests (Pending Swap) - 내가 수신자인 대기 건
      const { data: dbRequests } = await supabase
        .from('trade_requests')
        .select('*')
        .eq('recipient_address', targetAddr)
        .eq('status', 'WAITING_RECIPIENT')
        .order('created_at', { ascending: false });

      if (dbRequests) setRequests(dbRequests);

      // (B) Chain Logs (Completed / Direct)
      if (publicClient) {
        try {
          const blockNumber = await publicClient.getBlockNumber();
          const fromBlock = blockNumber - 5000n > 0n ? blockNumber - 5000n : 0n;
          const events = await publicClient.getLogs({
            address: import.meta.env.VITE_RAILX_NFT_ADDRESS as `0x${string}`,
            event: parseAbiItem('event ComplianceRecordMinted(uint256 indexed tokenId, address indexed sender, address indexed receiver, string relatedTxHash, string metadataUri)'),
            args: { receiver: address },
            fromBlock: fromBlock,
            toBlock: 'latest'
          });
          setNftLogs(events);
        } catch (e) { console.error(e); }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [address, publicClient]);

  // 3. 리포트 보기 클릭
  const onReportClick = (uri: string, requestData?: any) => {
    if (!myPrivateKey) return toast({ status: 'error', title: 'Vault Locked', description: 'Please unlock your keys first.' });
    
    setPendingUri(uri);
    // 🔥 클릭한 요청 데이터를 Ref에 저장 (버튼 표시 여부 결정용)
    activeRequestRef.current = requestData; 
    setIsVerifying(true);
  };

  const handleVerifyComplete = async (logs: any[]) => {
    setIsVerifying(false);
    if (pendingUri) await decryptMessage(pendingUri, logs);
  };

  // 4. 복호화
  const decryptMessage = async (uri: string, recipientLogs?: any[]) => {
    try {
      const res = await fetch(uri);
      if (!res.ok) throw new Error("Data not found (404).");
      
      const packet = await res.json();
      const content = await decryptDataPacket(packet, myPrivateKey!);
      
      if (recipientLogs && content.complianceAudit) {
        content.complianceAudit.recipientChecked = true;
        content.complianceAudit.recipientCheckTime = new Date().toISOString();
        content.complianceAudit.logs.push(...recipientLogs);
      }
      
      // Ref에 저장된 요청 ID를 콘텐츠에 병합
      if (activeRequestRef.current) {
        content._dbId = activeRequestRef.current.id;
        content._matchedLP = activeRequestRef.current.lp_address;
      }

      setDecryptedContent(content);
    } catch (e: any) {
      console.error(e);
      toast({ status: 'error', title: 'Decryption Failed', description: e.message });
    }
  };

  // 5. 실행 (Execute)
  const handleExecuteSwap = async () => {
    if (!decryptedContent || !address) return;
    
    // Ref에서 데이터 가져오기
    const req = activeRequestRef.current; 
    if (!req) return toast({ status: "error", title: "Request data missing" });

    const vaultAddress = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;
    const tokenInAddr = TOKEN_MAP[req.from_token];
    const tokenOutAddr = TOKEN_MAP[req.to_token];
    
    // 금액 계산
    const amountIn = parseUnits(String(req.from_amount), 18);
    const amountOut = parseUnits(String(req.to_amount), 18);
    
    // Trade ID 생성
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    const tradeId = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

    try {
      toast({ title: "Executing Atomic Swap...", description: "Sending transaction to Vault.", status: "info" });
      
      await writeContractAsync({
        address: vaultAddress,
        abi: RailXVaultAbi,
        functionName: 'executeMarketSwap',
        args: [
          tradeId,
          req.sender_address as `0x${string}`, // Sender
          address as `0x${string}`,            // Recipient (Me)
          req.lp_address as `0x${string}`,     // LP
          tokenInAddr,
          tokenOutAddr,
          amountIn,
          amountOut
        ]
      });

      toast({ status: "success", title: "Swap Executed!", description: "Funds settled successfully." });

      // DB 업데이트
      await supabase.from('trade_requests').update({ status: 'EXECUTED' }).eq('id', req.id);
      
      // 화면 갱신
      setRequests(prev => prev.filter(r => r.id !== req.id));
      setDecryptedContent(null);
      activeRequestRef.current = null;

    } catch (e: any) {
      console.error(e);
      toast({ status: "error", title: "Execution Failed", description: e.message });
    }
  };

  return (
    <Box color="white">
      <Heading mb={6} size="lg">Compliance Inbox</Heading>
      
      {!myPrivateKey && (
        <Alert status="warning" mb={6} borderRadius="lg" variant="solid" bg="railx.accent" color="black">
          <AlertIcon color="black" />
          <Box>
            <Text fontWeight="bold">Secure Vault Locked</Text>
            <Text fontSize="sm">Please sign with your wallet to unlock encrypted messages.</Text>
          </Box>
          <Button size="sm" ml="auto" colorScheme="blackAlpha" onClick={unlockKeys}>Unlock Now</Button>
        </Alert>
      )}

      <VStack align="stretch" spacing={6}>
        
        {/* 1. ACTION REQUIRED (Pending) */}
        {requests.length > 0 && (
          <Box>
            <HStack mb={3}>
              <Icon as={FaFileSignature} color="yellow.400" />
              <Text fontSize="sm" fontWeight="bold" color="yellow.400" letterSpacing="wider">ACTION REQUIRED ({requests.length})</Text>
            </HStack>
            <VStack align="stretch" spacing={4}>
              {requests.map((req) => (
                <Card key={req.id} bg="railx.800" border="1px solid" borderColor="yellow.500" boxShadow="0 0 15px rgba(255, 215, 0, 0.1)">
                  <CardBody>
                    <HStack justify="space-between" mb={4}>
                      <VStack align="start" spacing={0}>
                        <Text fontSize="xs" color="gray.400">SENDER</Text>
                        <Text fontWeight="bold" fontFamily="monospace">{req.sender_address}</Text>
                      </VStack>
                      <Badge colorScheme="yellow" variant="solid" px={3} py={1} borderRadius="full">WAITING APPROVAL</Badge>
                    </HStack>

                    <HStack justify="space-between" bg="blackAlpha.400" p={4} borderRadius="md" mb={4}>
                       <VStack align="start" spacing={0}>
                         <Text fontSize="xs" color="gray.500">INCOMING</Text>
                         <Text fontWeight="bold" fontSize="lg">{Number(req.to_amount).toLocaleString()} {req.to_token}</Text>
                       </VStack>
                       <Icon as={FaArrowRight} color="gray.600" />
                       <VStack align="end" spacing={0}>
                         <Text fontSize="xs" color="gray.500">SOURCE</Text>
                         <Text fontWeight="bold" color="gray.300">{Number(req.from_amount).toLocaleString()} {req.from_token}</Text>
                       </VStack>
                    </HStack>

                    <Button 
                      w="full" colorScheme="yellow" leftIcon={<FaLock />} 
                      onClick={() => onReportClick(req.encrypted_compliance_data, req)}
                    >
                      Verify Compliance & Unlock
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </VStack>
          </Box>
        )}

        <Divider borderColor="railx.700" />

        {/* 2. COMPLETED (History) */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" color="gray.500" mb={3} letterSpacing="wider">HISTORY ({nftLogs.length})</Text>
          <VStack align="stretch" spacing={3}>
            {nftLogs.map((log: any) => (
              <Card key={log.transactionHash} bg="railx.800" border="1px solid" borderColor="railx.700" _hover={{ borderColor: 'railx.accent' }}>
                <CardBody py={4}>
                  <HStack justify="space-between">
                    <HStack>
                       <Icon as={FaCheckCircle} color="green.400" />
                       <Text fontWeight="bold" fontSize="sm">Settled</Text>
                       <Text fontSize="xs" color="gray.500" fontFamily="monospace">| Tx: {log.args.relatedTxHash.slice(0,10)}...</Text>
                    </HStack>
                    <Button size="sm" variant="ghost" leftIcon={<FaShieldAlt />} onClick={() => onReportClick(log.args.metadataUri)}>
                      View Report
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </VStack>
        </Box>
      </VStack>

      {/* --- 리포트 뷰어 --- */}
      {decryptedContent && (
        <Box mt={10} p={8} bg="gray.900" borderRadius="xl" border="1px solid" borderColor="railx.accent" position="relative" overflow="hidden" boxShadow="2xl">
          <Box position="absolute" top="-30px" right="-30px" opacity={0.05}><Icon as={FaShieldAlt} boxSize={60} /></Box>
          
          <HStack justify="space-between" mb={6}>
            <Heading size="md" color="white">Compliance Report</Heading>
            <HStack>
               <Badge colorScheme="green">KYC: PASS</Badge>
               <Badge colorScheme="green">KYT: CLEAN</Badge>
               <Badge colorScheme="green">SOF: VERIFIED</Badge>
            </HStack>
          </HStack>
          
          <SimpleGrid columns={2} spacing={6} mb={6} bg="whiteAlpha.50" p={5} borderRadius="lg">
             <Box>
               <Text fontSize="xs" color="gray.400" mb={1}>SENDER (Origin)</Text>
               <Text fontWeight="bold" fontSize="xl">{decryptedContent.amount} {decryptedContent.fromToken}</Text>
               <Text fontSize="sm" color="gray.400">{decryptedContent.senderAddress}</Text>
             </Box>
             <Box textAlign="right">
               <Text fontSize="xs" color="gray.400" mb={1}>YOU RECEIVE</Text>
               <Text fontWeight="bold" fontSize="xl" color="railx.accent">
                 {/* DB에서 가져온 정확한 to_amount가 있다면 표시, 없으면 계산 */}
                 {activeRequestRef.current ? Number(activeRequestRef.current.to_amount).toLocaleString() : "Unknown"} {decryptedContent.token}
               </Text>
               <Text fontSize="sm" color="gray.400">{decryptedContent.recipientAddress}</Text>
             </Box>
          </SimpleGrid>

          <Code display="block" whiteSpace="pre" p={4} borderRadius="md" mb={8} maxH="200px" overflowY="auto" bg="blackAlpha.800" fontSize="xs">
            {JSON.stringify(decryptedContent, null, 2)}
          </Code>

          <HStack spacing={4} justify="flex-end">
            <Button variant="ghost" onClick={() => setDecryptedContent(null)}>Close Viewer</Button>
            
            {/* 🔥 [핵심] DB 요청인 경우에만 실행 버튼 노출 */}
            {activeRequestRef.current ? (
              <Button 
                colorScheme="green" size="lg" leftIcon={<FaExchangeAlt />} 
                onClick={handleExecuteSwap}
                boxShadow="0 0 20px rgba(72, 187, 120, 0.4)"
              >
                Approve & Execute Swap
              </Button>
            ) : (
               <Button colorScheme="yellow" onClick={onOpen}>Generate Regulatory Report</Button>
            )}
          </HStack>
        </Box>
      )}

      <ReportExportModal isOpen={isOpen} onClose={onClose} decryptedData={decryptedContent} />
      <ComplianceScanModal isOpen={isVerifying} onClose={()=>setIsVerifying(false)} onComplete={handleVerifyComplete} targetAddress={address!} type="RECIPIENT" />
    </Box>
  );
}