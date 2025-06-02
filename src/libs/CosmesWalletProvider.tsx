import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  WalletController,
  ConnectedWallet,
  StationController,
  KeplrController,
  WalletType,
  UnsignedTx,
  WalletName,
  GalaxyStationController,
} from "@goblinhunt/cosmes/wallet"
import { RpcClient, getAccount, toBaseAccount } from "@goblinhunt/cosmes/client"
import {
  CosmosBankV1beta1QueryAllBalancesService as QueryAllBalancesService,
  CosmosTxV1beta1ServiceGetTxService as GetTxService,
  CosmosTxV1beta1Fee as Fee,
} from "@goblinhunt/cosmes/protobufs"
import networks from "constants/networks"
import axios from "axios"
import {
  UUSD,
  UKRW,
  UMNT,
  ULUNA,
  USDR,
  UAUD,
  UCAD,
  UCHF,
  UCNY,
  UEUR,
  UGBP,
  UHKD,
  UINR,
  UJPY,
  USGD,
  UTHB,
} from "constants/constants"
import { TxRaw } from "@goblinhunt/cosmes/dist/protobufs/cosmos/tx/v1beta1/tx_pb"
// Define the shape of our wallet context
interface WalletContextValue {
  network: {
    chainID: string
    name?: string
    fcd?: string
  }
  wallets: Map<string, ConnectedWallet>
  status: "connecting" | "connected" | "disconnected"
  connect: (walletName: WalletName, walletType: WalletType) => Promise<void>
  disconnect: () => void
  post: (tx: UnsignedTx, fee: Fee) => Promise<any>
  estimateFee: (tx: UnsignedTx) => Promise<Fee>
  availableWallets: WalletName[]
  walletControllers: Record<WalletName, WalletController>
  installedWallets: WalletName[]
  installableWallets: WalletName[]
  selectedWallet: WalletName | null
  loadGasPrice: (symbol: string) => Promise<string>
}

// Create the context with a default value
const WalletContext = createContext<WalletContextValue>({
  network: { chainID: "" },
  wallets: new Map(),
  status: "disconnected",
  connect: async () => {},
  disconnect: () => {},
  post: async () => null,
  estimateFee: async () => new Fee(),
  availableWallets: [],
  walletControllers: {} as Record<WalletName, WalletController>,
  installedWallets: [] as WalletName[],
  installableWallets: [] as WalletName[],
  selectedWallet: null,
  loadGasPrice: async () => "0",
})

// Custom hook to use the wallet context
export const useWallet = () => useContext(WalletContext)

// Create a custom LCD client using RpcClient for compatibility
export const useLCDClient = () => {
  const { network } = useWallet()
  const networkInfo = useMemo(() => networks[network.chainID], [network])

  // Create a terra-like client that wraps RpcClient for compatibility
  const terra = useMemo(() => {
    if (!networkInfo?.rpc) {
      console.error("No RPC endpoint found for network:", network.chainID)
      return null
    }

    // Create an RPC client instance with type assertion
    return {
      chainID: network.chainID,
      lcd: networkInfo?.lcd,
      rpc: networkInfo?.rpc,
      rpcClient: RpcClient,
      // Add missing properties that the original LCDClient had
      auth: {
        // Use rest parameters to handle variable argument count
        accountInfo: async (...args: any[]) => {
          // Extract address from args if provided, otherwise use empty string
          const address = args.length > 0 ? args[0] : ""
          if (!address) return
          try {
            // Use the RPC client to get account info
            const account = await getAccount(networkInfo?.rpc || "", {
              address,
            })
            const accountInfo = toBaseAccount(account)
            return {
              ...accountInfo,
              // Add compatibility methods
              getSequenceNumber: () => accountInfo?.sequence || "0",
              getPublicKey: () => accountInfo?.pubKey || null,
            }
          } catch (error) {
            console.error("Error fetching account info:", error)
            return {}
          }
        },
      },
      bank: {
        balance: async (address: string, pagination?: any) => {
          if (!address) return
          try {
            // Use the RPC client to get balance info
            const balances = await RpcClient.query(
              networkInfo?.rpc || "",
              QueryAllBalancesService,
              { address }
            )
            return {
              toArray: () => balances.balances || [],
              get: (denom: string) =>
                balances?.balances?.find(
                  (coin: { denom: string; amount: string }) =>
                    coin.denom === denom
                ) || null,
            }
          } catch (error) {
            console.error("Error fetching balance:", error)
            return { toArray: () => [], get: () => null }
          }
        },
      },
      treasury: {
        taxRate: async () => {
          // This is a simplified implementation - you may need to implement
          // actual tax rate fetching if your application requires it
          return "0.0"
        },
        taxCap: async (denom: string) => {
          // This is a simplified implementation - you may need to implement
          // actual tax cap fetching if your application requires it
          return { amount: "0" }
        },
      },
      config: {
        gasAdjustment: 1.4,
      },
      tx: {
        async getTx(txHash: string) {
          try {
            // Use the RPC client to get transaction info
            const txInfo = await RpcClient.query(
              networkInfo?.rpc || "",
              GetTxService,
              { hash: txHash }
            )
            return txInfo
          } catch (error) {
            console.error("Error fetching transaction:", error)
            return null
          }
        },
        async broadcastTx(tx: TxRaw) {
          try {
            // Use the RPC client to broadcast the transaction
            const result = await RpcClient.broadcastTx(
              networkInfo?.rpc || "",
              tx
            )
            return result
          } catch (error) {
            console.error("Error broadcasting transaction:", error)
            throw error
          }
        },
      },
    }
  }, [network, networkInfo])

  // Create a default terra object if it's null to avoid null checks throughout the app
  const safeTerra = terra || {
    chainID: network.chainID || "",
    lcd: "",
    rpc: "",
    rpcClient: {} as any,
    auth: {
      accountInfo: async () => ({}),
    },
    bank: {
      balance: async () => ({ toArray: () => [], get: () => null }),
    },
    treasury: {
      taxRate: async () => "0.0",
      taxCap: async () => ({ amount: "0" }),
    },
    config: {
      gasAdjustment: 1.4,
    },
    tx: {
      create: async () => ({
        auth_info: {
          fee: {
            gas_limit: "200000",
            amount: [],
          },
        },
      }),
      simulate: async () => ({ gas_used: "150000" }),
      estimateFee: async () => ({ gas_limit: "200000", amount: [] }),
      getTx: async () => null,
      broadcastTx: async () => ({}),
    },
  }

  return useMemo(() => ({ terra: safeTerra }), [safeTerra])
}

// Export a hook to use the LCD URL
export const useLCD = () => {
  const { network } = useWallet()
  const networkInfo = networks[network.chainID]
  return networkInfo?.lcd
}

// Props for the wallet provider component
interface WalletProviderProps {
  defaultNetwork: string
  walletConnectChainIds: Record<string, unknown>
  connectorOpts?: {
    bridge: string
  }
}

export const WalletLabel: Record<WalletName, string> = {
  [WalletName.KEPLR]: "Keplr",
  [WalletName.STATION]: "Terra Station",
  [WalletName.GALAXYSTATION]: "Galaxy Station",
  [WalletName.LUNCDASH]: "LUNC Dash",
  [WalletName.LEAP]: "Leap",
  [WalletName.COMPASS]: "Compass",
  [WalletName.COSMOSTATION]: "Cosmostation",
  [WalletName.METAMASK_INJECTIVE]: "Metamask Injective",
  [WalletName.NINJI]: "Ninji",
  [WalletName.OWALLET]: "OWallet",
  [WalletName.DAODAO]: "DaoDao",
}

// The wallet provider component
const CosmeWalletProvider: React.FC<PropsWithChildren<WalletProviderProps>> = ({
  children,
  defaultNetwork,
}) => {
  // State for wallet connection status and connected wallets
  const [status, setStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected")
  const [wallets, setWallets] = useState<Map<string, ConnectedWallet>>(
    new Map()
  )
  const [selectedWallet, setSelectedWallet] = useState<WalletName | null>(null)
  const [network, setNetwork] = useState(
    networks[defaultNetwork] || networks["columbus-5"]
  )
  const [installedWallets, setInstalledWallets] = useState<WalletName[]>([])
  const [installableWallets, setInstallableWallets] = useState<WalletName[]>([])

  const WC_PROJECT_ID = "2b7d5a2da89dd74fed821d184acabf95"

  // Available wallet controllers
  // Using type assertions to bypass TypeScript errors with constructor parameters
  const walletControllers = useMemo(() => {
    return {
      station: new StationController(),
      keplr: new KeplrController(WC_PROJECT_ID),
      galaxystation: new GalaxyStationController(WC_PROJECT_ID),
    } as Record<string, WalletController>
  }, [])

  // Map from WalletName to controller key
  const walletNameToKey = useMemo(() => {
    return {
      [WalletName.STATION]: "station",
      [WalletName.KEPLR]: "keplr",
      [WalletName.GALAXYSTATION]: "galaxystation",
    } as Record<WalletName, string>
  }, [])

  // Available wallets
  const availableWallets = useMemo(() => {
    const allowedWallets = [
      WalletName.KEPLR,
      WalletName.STATION,
      WalletName.GALAXYSTATION,
    ] as WalletName[]
    return (Object.keys(walletControllers) as WalletName[]).filter(
      (walletName: WalletName) => allowedWallets.includes(walletName)
    )
  }, [walletControllers])

  useEffect(() => {
    const updateWalletInstallStatus = async () => {
      const installedWallets = await Promise.all(
        availableWallets.map(async (walletName) => {
          const controllerKey = walletNameToKey[walletName]
          if (!controllerKey) {
            return null
          }

          const controller = walletControllers[controllerKey]
          if (!controller) {
            return null
          }

          const isInstalled = await controller.isInstalled(
            WalletType.WALLETCONNECT
          )
          return isInstalled ? walletName : null
        })
      )
      setInstalledWallets(
        installedWallets.filter(
          (walletName) => walletName !== null
        ) as WalletName[]
      )
      const installableWallets = availableWallets.filter(
        (walletName) => !installedWallets.includes(walletName)
      )
      setInstallableWallets(installableWallets)
    }
    updateWalletInstallStatus()
  }, [availableWallets, walletControllers])

  // Store wallet connection info in localStorage
  const saveWalletConnection = (
    walletName: WalletName,
    chainId: string,
    walletType: WalletType
  ) => {
    try {
      localStorage.setItem(
        "terraswap_wallet_connection",
        JSON.stringify({
          walletName,
          chainId,
          walletType,
          timestamp: Date.now(),
        })
      )
    } catch (error) {
      console.error("Failed to save wallet connection info:", error)
    }
  }

  // Clear wallet connection info from localStorage
  const clearWalletConnection = () => {
    try {
      localStorage.removeItem("terraswap_wallet_connection")
    } catch (error) {
      console.error("Failed to clear wallet connection info:", error)
    }
  }

  // Connect to a wallet
  const connect = async (walletName: WalletName, walletType: WalletType) => {
    clearWalletConnection()

    try {
      setStatus("connecting")
      const controllerKey = walletNameToKey[walletName]
      if (!controllerKey) {
        throw new Error(`Wallet ${walletName} not supported`)
      }

      const controller = walletControllers[controllerKey]
      if (!controller) {
        throw new Error(`Wallet ${walletName} not supported`)
      }

      const isInstalled = await controller.isInstalled(WalletType.EXTENSION)
      if (!isInstalled) {
        throw new Error(`Wallet ${walletName} is not installed`)
      }

      const networkInfo = networks[network.chainID]
      if (!networkInfo) {
        throw new Error(`Network ${network.chainID} not supported`)
      }

      const gasPrice = await loadGasPrice("uluna")

      const connectedWallets = await controller.connect(walletType, [
        {
          chainId: network.chainID,
          rpc: networkInfo.rpc || networkInfo.lcd,
          gasPrice: {
            denom: "uluna",
            amount: gasPrice,
          },
        },
      ])

      setWallets(connectedWallets)
      setSelectedWallet(walletName)
      setStatus("connected")

      // Save connection info to localStorage
      saveWalletConnection(walletName, network.chainID, walletType)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      setStatus("disconnected")
      throw error
    }
  }

  // Disconnect from the wallet
  const disconnect = () => {
    if (selectedWallet) {
      const controllerKey = walletNameToKey[selectedWallet]
      if (controllerKey) {
        const controller = walletControllers[controllerKey]
        controller.disconnect(Array.from(wallets.keys()))
      }
      setWallets(new Map())
      setSelectedWallet(null)
      setStatus("disconnected")

      // Clear connection info from localStorage
      clearWalletConnection()
    }
  }

  const estimateFee = async (tx: UnsignedTx) => {
    const wallet = Array.from(wallets.values())[0]
    if (!wallet) {
      throw new Error("No wallet connected")
    }

    try {
      // Use the RPC client to estimate fee
      const result = await wallet.estimateFee(tx)
      return result
    } catch (error) {
      console.error("Error estimating fee:", error)
      return new Fee()
    }
  }

  // Post a transaction
  const post = async (tx: UnsignedTx, fee: Fee) => {
    if (status !== "connected" || !selectedWallet) {
      throw new Error("Wallet not connected")
    }

    const wallet = Array.from(wallets.values())[0]
    if (!wallet) {
      throw new Error("No wallet connected")
    }

    try {
      const result = await wallet.broadcastTxSync(tx, fee)
      return result
    } catch (error) {
      console.error("Transaction failed:", error)
      throw error
    }
  }

  // Set up wallet disconnection handlers
  useEffect(() => {
    const unsubscribers: (() => void)[] = []

    Object.values(walletControllers).forEach((controller) => {
      const unsubscribe = controller.onDisconnect(() => {
        setWallets(new Map())
        setSelectedWallet(null)
        setStatus("disconnected")

        // Clear connection info from localStorage on disconnect
        clearWalletConnection()
      })

      unsubscribers.push(unsubscribe)
    })

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [walletControllers])

  // Auto-reconnect on page refresh
  useEffect(() => {
    const attemptReconnect = async () => {
      try {
        // Check if we have stored connection info
        const storedConnectionString = localStorage.getItem(
          "terraswap_wallet_connection"
        )
        if (!storedConnectionString) return

        const storedConnection = JSON.parse(storedConnectionString)
        const { walletName, chainId, walletType, timestamp } = storedConnection

        // Optional: Check if the stored connection is too old (e.g., older than 24 hours)
        const MAX_CONNECTION_AGE = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        if (Date.now() - timestamp > MAX_CONNECTION_AGE) {
          clearWalletConnection()
          return
        }

        // Check if the wallet is valid
        if (!walletName || !Object.values(WalletName).includes(walletName)) {
          clearWalletConnection()
          return
        }

        // If network chain ID doesn't match stored chain ID, update it
        if (network.chainID !== chainId && networks[chainId]) {
          setNetwork(networks[chainId])
        }

        console.log("Attempting to reconnect to wallet:", walletName)

        // Attempt to reconnect
        await connect(walletName, walletType)
      } catch (error) {
        console.error("Failed to auto-reconnect wallet:", error)
        clearWalletConnection()
      }
    }

    // Only attempt reconnection if we're not already connected
    if (status === "disconnected") {
      attemptReconnect()
    }
  }, [status, network, connect, clearWalletConnection])

  // Gas price loading function
  const loadGasPrice = useCallback(
    async (symbol: string) => {
      try {
        // Get the FCD URL from the network
        const fcd =
          network?.fcd ||
          networks[network.chainID]?.fcd ||
          "https://fcd.terra.dev"

        // Make the API call to get gas prices
        const url = `${fcd}/v1/txs/gas_prices`
        const response = await axios.get(url)
        const data = response.data

        // Determine the correct symbol name
        const symbolName = symbol.startsWith("u")
          ? symbol
          : `u${symbol.toLowerCase()}`

        // Check if the symbol is in the allowed list
        if (
          [
            UUSD,
            UKRW,
            UMNT,
            ULUNA,
            USDR,
            UAUD,
            UCAD,
            UCHF,
            UCNY,
            UEUR,
            UGBP,
            UHKD,
            UINR,
            UJPY,
            USGD,
            UTHB,
          ].includes(symbolName)
        ) {
          return data[symbolName] || "0"
        }

        return "0"
      } catch (error) {
        console.error("Error loading gas price:", error)
        return "0"
      }
    },
    [network]
  )

  // Create the context value
  const contextValue = useMemo<WalletContextValue>(
    () => ({
      network,
      wallets,
      status,
      connect,
      disconnect,
      post,
      estimateFee,
      availableWallets,
      walletControllers,
      installedWallets,
      installableWallets,
      selectedWallet,
      loadGasPrice,
    }),
    [
      network,
      wallets,
      status,
      availableWallets,
      installedWallets,
      installableWallets,
      selectedWallet,
      loadGasPrice,
    ]
  )

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export default CosmeWalletProvider
