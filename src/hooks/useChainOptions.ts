import { useEffect, useState } from "react"
import { getChainOptions } from "../libs/getChainOptions"

export interface ChainOptions {
  defaultNetwork: NetworkInfo
  walletConnectChainIds: Record<number, NetworkInfo>
}

export interface NetworkInfo {
  name: string
  chainID: string
  lcd: string
  api?: string
  hive?: string
  mantle?: string
  walletconnectID: number
}

export const useChainOptions = (): ChainOptions | undefined => {
  const [chainOptions, setChainOptions] = useState<ChainOptions>()

  useEffect(() => {
    const fetchChainOptions = async () => {
      try {
        const options = await getChainOptions()
        setChainOptions(options)
      } catch (error) {
        console.error("Failed to fetch chain options:", error)
      }
    }

    fetchChainOptions()
  }, [])

  return chainOptions
}

export default useChainOptions
