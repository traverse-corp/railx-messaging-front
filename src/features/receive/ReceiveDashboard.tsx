import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Heading, Text, VStack, Code, useToast, Alert, AlertIcon,
  useDisclosure, HStack // 👈 누락되었던 컴포넌트 추가
} from '@chakra-ui/react';
import { useAccount, usePublicClient, useSignMessage } from 'wagmi';
import { parseAbiItem } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { deriveKeyFromSignature, unlockPrivateKey, decryptDataPacket } from '../../utils/crypto';
import { RAILX_SIGNING_MESSAGE } from '../../utils/constants';
import { ReportExportModal } from './ReportExportModal';

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

  // 3. 개별 메시지 복호화
  const decryptMessage = async (uri: string) => {
    if (!myPrivateKey) return toast({ status: 'error', title: '키 잠김', description: '먼저 잠금 해제 버튼을 눌러주세요.' });
    try {
      const res = await fetch(uri);
      if (!res.ok) throw new Error("파일을 찾을 수 없습니다 (404).");
      
      const packet = await res.json();
      const content = await decryptDataPacket(packet, myPrivateKey);
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
          <Text mr={4}>메시지가 암호화되어 있습니다.</Text>
          <Button size="sm" colorScheme="orange" onClick={unlockKeys}>잠금 해제 (서명)</Button>
        </Alert>
      )}

      <VStack align="stretch" spacing={4}>
        {logs.map((log: any) => (
          <Box key={log.transactionHash} p={4} bg="railx.800" borderRadius="md" border="1px solid" borderColor="railx.700">
            <Text color="gray.400" fontSize="sm">Tx: {log.args.relatedTxHash}</Text>
            <Text fontWeight="bold">From: {log.args.sender}</Text>
            <Button size="sm" mt={2} onClick={() => decryptMessage(log.args.metadataUri)}>
              리포트 보기
            </Button>
          </Box>
        ))}
      </VStack>

      {decryptedContent && (
        <Box mt={8} p={6} bg="gray.900" borderRadius="md" border="1px solid" borderColor="railx.700">
          <Heading size="md" mb={4} color="railx.accent">Decrypted Report</Heading>
          
          <Code display="block" whiteSpace="pre" p={4} borderRadius="md" mb={4} maxH="300px" overflowY="auto">
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
    </Box>
  );
}