import React from "react";
import { 
  Container, Heading, Tabs, TabList, Tab, TabPanels, TabPanel, 
  Text, Box, Flex, Button, HStack, Badge, Menu, MenuButton, MenuList, MenuItem,
  useToast // 👈 토스트 메시지 사용을 위해 추가
} from '@chakra-ui/react';
import { ChevronDownIcon, SettingsIcon } from '@chakra-ui/icons';
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useNavigate } from "react-router-dom";

// V2용 컴포넌트 Import
import { SendWizard } from "../send/SendWizard";
import { ReceiveDashboard } from "../receive/ReceiveDashboard";
// 아래 두 개는 기존 V1 코드를 그대로 쓰거나, 없으면 아래 2, 3번 코드로 생성하세요.
import { VaultPanel } from "./VaultPanel";
import { MyWalletPanel } from "./MyWalletPanel";

export function BankPortalPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const toast = useToast(); // 👈 안내 메시지용

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

  // 👇 [추가된 함수] 모바일 딥링크 처리 + Wagmi 연결 래퍼 함수
  const handleWalletConnect = () => {
    // 1. 모바일 기기인지 체크
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // 2. 모바일이면서 + 브라우저에 지갑(window.ethereum)이 없는 경우
    //    (즉, 메타마스크 앱 내부 브라우저가 아니라 일반 모바일 크롬/사파리인 경우)
    if (isMobile && !window.ethereum) {
      toast({
        title: "Opening MetaMask...",
        description: "Redirecting to MetaMask App.",
        status: "info",
        duration: 2000,
        isClosable: true,
      });

      // 현재 페이지 주소 (https:// 제외하고 깔끔하게)
      const currentUrl = window.location.host + window.location.pathname;
      
      // 딥링크 실행 (메타마스크 앱 열기)
      window.location.href = `https://metamask.app.link/dapp/${currentUrl}`;
      return;
    }

    // 3. 그 외 (PC 또는 메타마스크 앱 내부 브라우저) -> 기존 Wagmi 연결 실행
    connect({ connector: injected() });
  };

  return (
    <Box minH="100vh" bg="railx.900">
      {/* Top Navigation Bar */}
      <Box borderBottom="1px" borderColor="railx.700" py={4} mb={8} bg="rgba(8,10,12,0.8)" backdropFilter="blur(10px)" position="sticky" top={0} zIndex={10}>
        <Container maxW="container.xl">
          <Flex justify="space-between" align="center">
            <Heading as="h1" size="lg" letterSpacing="wider" color="white" cursor="pointer" onClick={() => navigate('/')}>
              RailX <Text as="span" fontSize="sm" color="railx.accent" fontWeight="normal">SAFESEND</Text>
            </Heading>

            <Box>
              {!isConnected ? (
                <Button 
                  size="sm" variant="primary" 
                  // 👇 [수정됨] 기존 직접 호출에서 -> handleWalletConnect 함수 호출로 변경
                  onClick={handleWalletConnect}
                  boxShadow="0 0 15px rgba(201, 176, 55, 0.2)"
                >
                  Connect Wallet
                </Button>
              ) : (
                <HStack spacing={3}>
                  <Badge colorScheme="green" variant="subtle" fontSize="0.6rem" px={2} py={1} borderRadius="full">
                    ● AMOY
                  </Badge>
                  
                  {/* 온보딩(키 설정) 페이지로 이동하는 버튼 */}
                  <Button size="sm" leftIcon={<SettingsIcon />} variant="outline" onClick={() => navigate('/onboarding')}>
                    User Keys
                  </Button>

                  <Menu>
                    <MenuButton as={Button} size="sm" variant="solid" rightIcon={<ChevronDownIcon />} fontFamily="monospace" bg="whiteAlpha.100" _hover={{ bg: "whiteAlpha.200" }}>
                      {shortAddress}
                    </MenuButton>
                    <MenuList bg="railx.800" borderColor="railx.700">
                      <MenuItem bg="transparent" _hover={{ bg: "whiteAlpha.100" }} onClick={() => disconnect()}>
                        Disconnect
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </HStack>
              )}
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* 메인 탭 콘텐츠 */}
      <Container maxW="container.xl" pb={20}>
        <Tabs isFitted variant="railx-segment" colorScheme="yellow" isLazy>
          <TabList mb={8} bg="railx.800" p={1} borderRadius="xl" border="1px" borderColor="railx.700">
            <Tab>Send (Compliance)</Tab>
            <Tab>Inbox (Receive)</Tab>
            {/* <Tab>Vault</Tab> */}
            <Tab>My Wallet</Tab>
          </TabList>

          <TabPanels>
            {/* 1. 송금 및 NFT 발행 위저드 */}
            <TabPanel p={0}><SendWizard /></TabPanel>
            
            {/* 2. 수신 및 복호화 대시보드 */}
            <TabPanel p={0}><ReceiveDashboard /></TabPanel>
            
            {/* 3. 볼트 (기존 유지)
            <TabPanel p={0}><VaultPanel /></TabPanel> */}
            
            {/* 4. 내 지갑 (기존 유지) */}
            <TabPanel p={0}><MyWalletPanel /></TabPanel>
          </TabPanels>
        </Tabs>
      </Container>
    </Box>
  );
}