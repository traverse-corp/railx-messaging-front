import React from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { polygonAmoy } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';

// 1. Ethena.fi 스타일: 칠흑 같은 배경 + 은은한 보더 + 골드 포인트 컬러
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  styles: {
    global: {
      body: {
        bg: '#080a0c', // 거의 완전한 검정 (Deep Dark)
        color: '#E2E8F0', // 기본 텍스트 (밝은 회색)
      },
    },
  },
  colors: {
    railx: {
      900: '#080a0c', // Main Background
      800: '#121417', // Card/Panel Background
      700: '#1e2126', // Border Color
      500: '#2D3748', // Muted Text
      accent: '#C9B037', // RailX Gold (Premium FX 느낌)
      success: '#4ADE80', // Success Green
    }
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          bg: 'railx.800',
          borderColor: 'railx.700',
          borderWidth: '1px',
          borderRadius: 'xl',
        }
      }
    },
Button: {
      baseStyle: {
        fontWeight: 'normal',
        borderRadius: 'lg',
      },
      variants: {
        // 'solid'를 객체가 아닌 함수로 만들어서 props를 받습니다.
        solid: (props: any) => {
          const { colorScheme: c } = props;

          // 1. colorScheme="yellow"일 때 (우리의 포인트 컬러)
          if (c === 'yellow') {
            return {
              bg: 'railx.accent', // 골드 색상
              color: 'black',
              fontWeight: 'bold',
              _hover: { 
                bg: '#b59d2f', // 약간 어두운 골드
                _disabled: { bg: 'railx.accent' } 
              },
              _active: { bg: '#a38d2a' },
            };
          }

          // 2. colorScheme="gray"이거나 없을 때 (기본 다크 버튼)
          if (c === 'gray') {
            return {
              bg: 'whiteAlpha.200',
              color: 'white',
              _hover: { bg: 'whiteAlpha.300' },
              _active: { bg: 'whiteAlpha.400' },
            };
          }

          // 3. 그 외 (blue, green, red 등) - Chakra 기본 로직 흉내
          return {
            bg: `${c}.500`,
            color: 'white',
            _hover: { bg: `${c}.600` },
            _active: { bg: `${c}.700` },
          };
        },
        // 'primary' variant는 유지 (편의상)
        primary: {
          bg: 'railx.accent',
          color: 'black',
          fontWeight: 'bold',
          _hover: { opacity: 0.9 },
          _active: { transform: 'scale(0.98)' },
        },
        outline: {
          borderColor: 'railx.700',
          color: 'gray.400',
          _hover: { bg: 'whiteAlpha.50', color: 'white' },
        }
      }
    },
    Input: {
      variants: {
        outline: {
          field: {
            bg: 'railx.900',
            borderColor: 'railx.700',
            _focus: {
              borderColor: 'railx.accent',
              boxShadow: '0 0 0 1px #C9B037',
            }
          }
        }
      }
    },
    Tabs: {
      variants: {
        'railx-segment': {
          root: { bg: 'transparent' },
          tab: {
            bg: 'transparent',
            color: 'gray.500',
            borderRadius: 'lg',
            fontWeight: 'semibold',
            transition: 'all 0.2s',
            _selected: {
              bg: 'whiteAlpha.100',
              color: 'railx.accent',
              borderColor: 'railx.700',
              borderWidth: '1px',
            },
            _hover: {
              color: 'gray.300',
            }
          }
        }
      }
    },
    // 🔥 [추가] 툴팁 스타일 강제 지정
    Tooltip: {
      baseStyle: {
        bg: 'gray.700', // 배경은 짙은 회색
        color: 'white', // 글씨는 흰색
        fontSize: 'xs',
        borderRadius: 'md',
        px: 3,
        py: 2,
        marginBottom: '2px',
      }
    }
  }
});

// 2. React Query 클라이언트 설정
const queryClient = new QueryClient();

// 3. Wagmi 설정 (Polygon Amoy)
const config = createConfig({
  chains: [polygonAmoy],
  connectors: [
    injected(), // MetaMask 등
  ],
  transports: {
    // .env 파일의 RPC URL을 사용하거나, 없으면 기본 public RPC 사용
    [polygonAmoy.id]: http(import.meta.env.VITE_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/'),
  },
  ssr: false,
});

// 4. 통합 Provider 컴포넌트
export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ChakraProvider>
  );
}