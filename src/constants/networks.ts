export const AVAILABLE_CHAIN_ID = ["columbus-5"]

// Add required properties for Cosmes SDK compatibility
type NetworkConfig = {
  URL?: string
  chainID: string
  gasAdjustment?: number
  name: string
  lcd: string
  rpc: string
  // Additional properties used in the app
  fcd?: string
  id?: string
  contract?: string
  swap?: string
  mantle?: string
  stats?: string
  factory?: string
  service?: string
  serviceV1?: string
  dashboard?: string
  router?: string
  fee?: {
    gasPrice: string
    amount: string
    gas: string
  }
}

type NetworkInfo = NetworkConfig

const networks: Record<string, NetworkInfo> = {
  "columbus-5": {
    name: "classic",
    chainID: "columbus-5",
    lcd: "https://terra-classic-lcd.publicnode.com",
    fcd: "https://terra-classic-fcd.publicnode.com",
    id: "columbus-5",
    contract: "/tequila.json",
    swap: "/swap.json",
    mantle: "https://fcd.terra.dev/",
    stats: "https://fcd.terra.dev/",
    fee: { gasPrice: "0.00506", amount: "1518", gas: "2000000" }, // 0.000500 UST
    factory: "terra1jkndu9w5attpz09ut02sgey5dd3e8sq5watzm0",
    service:
      process.env.REACT_APP_MAINNET_SERVICE_URL ||
      "https://api-classic.terraswap.io/v2",
    serviceV1:
      process.env.REACT_APP_MAINNET_SERVICE_V1_URL ||
      "https://api-classic.terraswap.io/v1",
    dashboard:
      process.env.REACT_APP_MAINNET_DASHBOARD_URL ||
      "https://api-classic.terraswap.io/v2/dashboard",
    router: "terra1g3zc8lwwmkrm0cz9wkgl849pdqaw6cq8lh7872",
    // Add required properties for Cosmes SDK compatibility
    URL: "https://terra-classic-lcd.publicnode.com",
    rpc: "https://terra-classic-rpc.publicnode.com",
    gasAdjustment: 1.4,
  },
}

export default networks
