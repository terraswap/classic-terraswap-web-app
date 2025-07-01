import { useEffect, useState } from "react"
import { useAddress, useNetwork } from "../hooks"
import useAPI from "./useAPI"
import { useQuery } from "react-query"
import { bech32 } from "@goblinhunt/cosmes/codec"

export default (contractAddress: string) => {
  const { name: networkName } = useNetwork()
  const address = useAddress()

  const { loadDenomBalance, loadContractBalance } = useAPI()

  const [balance, setBalance] = useState<string>()

  const { data: denomBalances } = useQuery({
    queryKey: ["denomBalances", networkName, address],
    queryFn: loadDenomBalance,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })

  const { data: contractBalance, isLoading: isContractBalanceLoading } =
    useQuery({
      queryKey: ["contractBalance", networkName, address, contractAddress],
      queryFn: async () => {
        if (!contractAddress) return null
        if (!contractAddress.startsWith("terra")) return null
        if (!bech32.decode(contractAddress as `${string}1${string}`)) {
          return null
        }
        const res = loadContractBalance(contractAddress)
        return res
      },
    })

  useEffect(() => {
    let isAborted = false
    try {
      if (address === "" || address === undefined) {
        setBalance("")
        return
      }
      if (!contractAddress?.startsWith("terra")) {
        if (denomBalances) {
          const coin = denomBalances.get(contractAddress)
          if (coin && !isAborted) {
            setBalance(coin.amount.toString())
            return
          }
        }
        setBalance("")
      } else {
        if (!isAborted && !isContractBalanceLoading) {
          setBalance(contractBalance?.balance || "")
        }
      }
    } catch (error) {
      console.error(error)
      setBalance("")
    }

    return () => {
      isAborted = true
    }
  }, [
    address,
    contractAddress,
    contractBalance,
    denomBalances,
    isContractBalanceLoading,
  ])

  return { balance }
}
