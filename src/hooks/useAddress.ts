import useConnectedWallet from "./useConnectedWallet"
import { useMemo } from "react"

const useAddress = () => {
  const connectedWallet = useConnectedWallet()

  // Use useMemo to prevent creating a new string reference on every render
  return useMemo(() => {
    return connectedWallet?.address || ""
  }, [connectedWallet]) // Only recompute when connectedWallet changes
}

export default useAddress
