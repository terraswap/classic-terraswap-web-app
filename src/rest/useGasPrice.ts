import { useEffect, useState } from "react"
import { useWallet } from "libs/CosmesWalletProvider"

export default (symbol: string) => {
  const [gasPrice, setGasPrice] = useState<string>("0")
  const { loadGasPrice } = useWallet()

  useEffect(() => {
    let isMounted = true

    const fetchGasPrice = async () => {
      try {
        const result = await loadGasPrice(symbol)
        if (isMounted) {
          setGasPrice(result)
        }
      } catch (e) {
        if (isMounted) {
          setGasPrice("0")
        }
      }
    }

    fetchGasPrice()

    return () => {
      isMounted = false
    }
  }, [loadGasPrice, symbol])

  return { gasPrice }
}
