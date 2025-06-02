import { FINDER } from "constants/constants"
import networks from "constants/networks"
import { useWallet } from "libs/CosmesWalletProvider"
import { useMemo } from "react"

const useNetwork = () => {
  const { network: extNetwork } = useWallet()

  // Use useMemo to prevent creating a new object on every render
  return useMemo(() => {
    const chainID = extNetwork?.chainID || "columbus-5"
    const network = networks[chainID] || networks["columbus-5"]

    const finder = (address: string, path: string = "account") =>
      `${FINDER}/${chainID}/${path}/${address}`

    return { ...extNetwork, ...network, finder }
  }, [extNetwork?.chainID])
}

export default useNetwork
