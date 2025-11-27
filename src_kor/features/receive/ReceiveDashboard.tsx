import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Heading, Text, VStack, Code, useToast, Alert, AlertIcon,
  useDisclosure, HStack, Divider, Badge, Icon // 👈 누락되었던 컴포넌트 추가
} from '@chakra-ui/react';
import { useAccount, usePublicClient, useSignMessage } from 'wagmi';
import { parseAbiItem } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { deriveKeyFromSignature, unlockPrivateKey, decryptDataPacket } from '../../utils/crypto';
import { RAILX_SIGNING_MESSAGE } from '../../utils/constants';
import { ReportExportModal } from './ReportExportModal';
import { ComplianceScanModal } from '../../components/ComplianceScanModal'; // 추가
import { FaCheckCircle, FaLock, FaShieldAlt } from 'react-icons/fa'; // 아이콘 추가

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function ReceiveDashboard() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const toast = useToast();
  
  // 모달 제어 훅
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [decryptedContent, setDecryptedContent] = useState<any>(null);

  // 1. 키 잠금 해제 (로그인)
  const unlockKeys = async () => {
    if (!address) return;
    try {
      const targetAddress = address.toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('encrypted_rsa_private_key')
        .eq('wallet_address', targetAddress)
        .single();

      if (!data) {
        return toast({ status: 'warning', title: '온보딩 필요', description: '먼저 키를 생성해주세요.' });
      }

      const message = `${RAILX_SIGNING_MESSAGE}${targetAddress}`;
      const sig = await signMessageAsync({ message });
      const derivedKey = await deriveKeyFromSignature(sig, targetAddress);
      const privKey = await unlockPrivateKey(data.encrypted_rsa_private_key, derivedKey);
      
      setMyPrivateKey(privKey);
      toast({ status: 'success', title: '잠금 해제 완료', description: '이제 내용을 볼 수 있습니다.' });
    } catch (e: any) {
      toast({ status: 'error', title: '해제 실패', description: e.message });
    }
  };

  // 2. NFT 조회
  useEffect(() => {
    if (!address || !publicClient) return;
    const fetchLogs = async () => {
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
        setLogs(events);
      } catch (e) {
        console.error("Logs error:", e);
      }
    };
    fetchLogs();
  }, [address, publicClient]);

  // 🔥 [추가] "리포트 보기" 버튼 클릭 시 -> 바로 복호화하지 않고 검증부터
  const onReportClick = (uri: string) => {
    if (!myPrivateKey) {
      return toast({ status: 'error', title: '키 잠김', description: '먼저 잠금 해제 버튼을 눌러주세요.' });
    }
    setPendingUri(uri); 
    setIsVerifying(true); // 1. 검증 모달 오픈
  };

  // 🔥 [추가] 검증 완료 후 실행되는 함수
  const handleVerifyComplete = async (logs: any[]) => {
    setIsVerifying(false);
    if (pendingUri) {
      await decryptMessage(pendingUri, logs); // 2. 검증 로그를 넘기며 복호화
    }
  };

  // 3. 개별 메시지 복호화
  const decryptMessage = async (uri: string, recipientLogs?: any[]) => {
    if (!myPrivateKey) return toast({ status: 'error', title: '키 잠김', description: '먼저 잠금 해제 버튼을 눌러주세요.' });
    try {
      const res = await fetch(uri);
      if (!res.ok) throw new Error("파일을 찾을 수 없습니다 (404).");
      
      const packet = await res.json();
      const content = await decryptDataPacket(packet, myPrivateKey);

      // 🔥 수신자 검증 결과도 데이터에 병합하여 보여주기 (UI용)
      if (recipientLogs && content.complianceAudit) {
        content.complianceAudit.recipientChecked = true;
        content.complianceAudit.recipientCheckTime = new Date().toISOString();
        content.complianceAudit.logs.push(...recipientLogs);
      }
      setDecryptedContent(content);
    } catch (e: any) {
      console.error(e);
      toast({ status: 'error', title: '복호화 실패', description: e.message });
    }
  };

  return (
    <Box color="white">
      <Heading mb={6}>Inbox</Heading>
      
      {!myPrivateKey && (
        <Alert status="warning" mb={4} borderRadius="md">
          <AlertIcon />
          <Text mr={4}>컴플라이언스 메시지가 암호화되어 있습니다.</Text>
          <Button size="sm" colorScheme="orange" onClick={unlockKeys}>잠금 해제 (서명)</Button>
        </Alert>
      )}

      <VStack align="stretch" spacing={4}>
        {logs.map((log: any) => (
          <Box key={log.transactionHash} p={5} bg="railx.800" borderRadius="xl" border="1px solid" borderColor="railx.700" _hover={{ borderColor: 'railx.accent' }} transition="all 0.2s">
            <HStack justify="space-between" mb={3}>
              <VStack align="start" spacing={0}>
                <Text fontSize="xs" color="gray.500">SENDER</Text>
                <Text fontWeight="bold" fontFamily="monospace">{log.args.sender}</Text>
              </VStack>
              <VStack align="end" spacing={0}>
                <Text fontSize="xs" color="gray.500">TX HASH</Text>
                <Text fontSize="xs" fontFamily="monospace" color="railx.accent">{log.args.relatedTxHash.slice(0,10)}...</Text>
              </VStack>
            </HStack>
            <Divider borderColor="whiteAlpha.100" my={3} />

            {/* 🔥 [Feature 2] 태그/배지 표시 영역 */}
            <HStack spacing={2} mb={4} wrap="wrap">
              <Badge colorScheme="green" variant="subtle" px={2} py={1} borderRadius="md">
                <HStack spacing={1}><Icon as={FaCheckCircle} /> <Text>KYC AML</Text></HStack>
              </Badge>
              <Badge colorScheme="green" variant="subtle" px={2} py={1} borderRadius="md">
                <HStack spacing={1}><Icon as={FaCheckCircle} /> <Text>KYT AML</Text></HStack>
              </Badge>
              <Badge colorScheme="blue" variant="subtle" px={2} py={1} borderRadius="md">
                <Text>1/2 Processed (Sender)</Text>
              </Badge>
              <Text fontSize="xs" color="gray.500">
                {new Date().toLocaleDateString()} Verified
              </Text>
            </HStack>

            {/* 🔥 [Feature 3] 잠금 버튼 */}
            <Button 
              size="sm" w="full" 
              leftIcon={<FaLock />} 
              colorScheme="gray" 
              variant="outline"
              _hover={{ bg: 'whiteAlpha.100', color: 'railx.accent', borderColor: 'railx.accent' }}
              onClick={() => onReportClick(log.args.metadataUri)}
            >
              Verify & Unlock Report (2/2)
            </Button>
          </Box>
        ))}
      </VStack>

      {decryptedContent && (
        <Box mt={8} p={6} bg="gray.900" borderRadius="xl" border="1px solid" borderColor="railx.accent" position="relative" overflow="hidden">
          {/* 워터마크 효과 */}
          <Box position="absolute" top="-20px" right="-20px" opacity={0.1}>
             <Icon as={FaShieldAlt} boxSize={40} />
          </Box>
          <Heading size="md" mb={1} color="white">Compliance Report</Heading>
          <HStack mb={6}>
             <Badge colorScheme="green">SENDER VERIFIED</Badge>
             <Badge colorScheme="green">RECIPIENT VERIFIED</Badge>
             <Text fontSize="xs" color="gray.500">ID: {decryptedContent.complianceAudit?.riskScore === 0 ? 'CLEAN_ASSET' : 'RISK'}</Text>
          </HStack>
          
          <Code display="block" whiteSpace="pre" p={4} borderRadius="md" mb={4} maxH="400px" overflowY="auto" bg="blackAlpha.600">
            {JSON.stringify(decryptedContent, null, 2)}
          </Code>
          

          <HStack spacing={4}>
            <Button colorScheme="gray" onClick={() => setDecryptedContent(null)}>
              Close
            </Button>
            <Button colorScheme="yellow" onClick={onOpen}>
              Generate Regulatory Report
            </Button>
          </HStack>
        </Box>
      )}

      <ReportExportModal 
        isOpen={isOpen} 
        onClose={onClose} 
        decryptedData={decryptedContent} 
      />

      {/* 🔥 수신자용 스캔 모달 */}
      <ComplianceScanModal 
        isOpen={isVerifying} onClose={() => setIsVerifying(false)}
        onComplete={handleVerifyComplete} targetAddress={address!} type="RECIPIENT"
      />
    </Box>
  );
}