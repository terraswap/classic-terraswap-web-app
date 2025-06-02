import { useWallet } from "../layouts/WalletConnectProvider"
import { useMemo } from "react"

const useConnectedWallet = () => {
  const { wallets, selectedWallet, network } = useWallet()

  return useMemo(() => {
    return selectedWallet ? wallets.get(network.chainID) : undefined
  }, [wallets, selectedWallet, network])
}

export default useConnectedWallet
