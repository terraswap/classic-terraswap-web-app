import { useAddress, useNetwork } from "hooks"

import { useCallback } from "react"
import useURL from "hooks/useURL"
import axios from "./request"
import { Type } from "pages/Swap"
import { Msg } from "@terra-money/terra.js"
import { AxiosError } from "axios"
interface DenomBalanceResponse {
  pagination: { next_key: string | null; total: string }
  balances: DenomInfo[]
}

interface DenomInfo {
  denom: string
  amount: string
}
interface LcdContractBalanceResponse {
  data: ContractBalance
}

interface ContractBalance {
  balance: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Pairs {
  pairs: Pair[]
}

export interface Pair {
  pair: TokenInfo[]
  contract: string
  liquidity_token: string
}

interface TokenInfo {
  symbol: string
  name: string
  contract_addr: string
}

interface PairsResponse {
  height: string
  result: PairsResult
}

interface PairsResult {
  pairs: PairResult[]
}

interface PairResult {
  liquidity_token: string
  contract_addr: string
  asset_infos: (NativeInfo | AssetInfo)[]
}

interface TokenResult {
  name: string
  symbol: string
  decimals: number
  total_supply: string
  contract_addr: string
  icon: string
  verified: boolean
}

interface PoolResponse {
  data: Pool
}

interface Pool {
  assets: Token[]
  total_share: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PoolResult {
  estimated: string
  price1: string
  price2: string
  afterPool: string
  LP: string
  // fromLP: Asset[]
  // text: string
}

interface SimulatedResponse {
  height: string
  result: SimulatedData
}
interface SimulatedData {
  return_amount: string
  offer_amount: string
  commission_amount: string
  spread_amount: string
}

export function isAssetInfo(object: any): object is AssetInfo {
  return "token" in object
}

export function isNativeInfo(object: any): object is NativeInfo {
  return "native_token" in object
}

const useAPI = () => {
  const { lcd, factory, service } = useNetwork()
  const address = useAddress()
  const getURL = useURL()

  // useBalance
  const loadDenomBalance = useCallback(async () => {
    const url = `${lcd}/cosmos/bank/v1beta1/balances/${address}`
    const res: DenomBalanceResponse = (await axios.get(url)).data
    return res.balances
  }, [address, lcd])

  const loadContractBalance = useCallback(
    async (localContractAddr: string) => {
      const url = getURL(
        localContractAddr,
        { balance: { address: address } },
        lcd
      )
      const res: LcdContractBalanceResponse = (await axios.get(url)).data
      return res.data
    },
    [address, getURL, lcd]
  )

  // useGasPrice

  // deprecated
  const loadGasPrice = useCallback(async (symbol?: string) => {
    return "11"
  }, [])

  // usePairs
  const loadPairs = useCallback(async () => {
    let result: PairsResult = {
      pairs: [],
    }
    let lastPair: (NativeInfo | AssetInfo)[] | null = null

    try {
      const res: PairsResult = (
        await axios.get(`${service}/pairs`, { params: { unverified: "true" } })
      ).data

      if (res?.pairs?.length) {
        res.pairs.forEach((pair) => {
          result.pairs.push(pair)
        })

        return result
      }
    } catch (error) {
      console.error(error)
    }

    while (true) {
      const url = getURL(factory, {
        pairs: { limit: 30, start_after: lastPair },
      })
      const pairs: PairsResponse = (await axios.get(url)).data

      if (!Array.isArray(pairs?.result?.pairs)) {
        // node might be down
        break
      }

      if (pairs.result.pairs.length <= 0) {
        break
      }

      pairs.result.pairs.forEach((pair) => {
        result.pairs.push(pair)
      })
      lastPair = pairs.result.pairs.slice(-1)[0]?.asset_infos
    }
    return result
  }, [service, factory, getURL])

  const loadTokens = useCallback(async (): Promise<TokenResult[]> => {
    const url = `${service}/tokens`
    const res: TokenResult[] = (await axios.get(url)).data
    return res
  }, [service])

  const loadSwappableTokenAddresses = useCallback(
    async (from: string) => {
      const res: string[] = (
        await axios.get(`${service}/tokens/swap`, { params: { from } })
      ).data
      return res
    },
    [service]
  )

  const loadTokenInfo = useCallback(
    async (contract: string): Promise<TokenResult> => {
      const url = getURL(contract, { token_info: {} })
      const res = (await axios.get(url)).data
      return res.data
    },
    [getURL]
  )

  // usePool
  const loadPool = useCallback(
    async (contract: string) => {
      const url = getURL(contract, { pool: {} })
      const res: PoolResponse = (await axios.get(url)).data
      return res.data
    },
    [getURL]
  )

  // useSwapSimulate
  const querySimulate = useCallback(
    async (variables: { contract: string; msg: any }) => {
      try {
        const { contract, msg } = variables
        const url = getURL(contract, msg, lcd)
        const res: SimulatedResponse = (await axios.get(url)).data
        return res
      } catch (error) {
        const { response }: AxiosError = error as any
        return response?.data
      }
    },
    [getURL, lcd]
  )

  const generateContractMessages = useCallback(
    async (
      query:
        | {
            type: Type.SWAP
            from: string
            to: string
            amount: number | string
            max_spread: number | string
            belief_price: number | string
            sender: string
          }
        | {
            type: Type.PROVIDE
            from: string
            to: string
            fromAmount: number | string
            toAmount: number | string
            slippage: number | string
            sender: string
          }
        | {
            type: Type.WITHDRAW
            lpAddr: string
            amount: number | string
            sender: string
          }
    ) => {
      const { type, ...params } = query
      const url = `${service}/tx/${type}`.toLowerCase()
      const res = (await axios.get(url, { params })).data
      return res.map((data: Msg.Amino | Msg.Amino[]) => {
        return (Array.isArray(data) ? data : [data]).map((item: Msg.Amino) => {
          const result = Msg.fromAmino(item)
          if ((result as any)?.execute_msg) {
            return result
          }
          return Msg.fromAmino(item, true)
        })
      })
    },
    [service]
  )

  return {
    loadDenomBalance,
    loadContractBalance,
    loadGasPrice,
    loadPairs,
    loadTokens,
    loadSwappableTokenAddresses,
    loadTokenInfo,
    loadPool,
    querySimulate,
    generateContractMessages,
  }
}

export default useAPI
