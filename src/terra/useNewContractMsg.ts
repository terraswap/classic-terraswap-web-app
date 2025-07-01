import { CosmosBaseV1beta1Coin as Coin } from "@goblinhunt/cosmes/protobufs"
import { MsgExecuteContract } from "@goblinhunt/cosmes/client"
import { useAddress } from "../hooks"

export default () => {
  const sender = useAddress()

  return (
    contract: string,
    msg: object,
    coins?: { denom: string; amount: string }[]
  ) => {
    let resCoins: Coin[] = []
    if (coins === undefined) {
      resCoins = []
    } else if (coins.length === 1) {
      resCoins = [coins[0] as Coin]
    } else if (coins.length === 2) {
      resCoins = [coins[0] as Coin, coins[1] as Coin]
    }

    return new MsgExecuteContract({
      sender,
      contract,
      msg,
      funds: resCoins,
    })
  }

  // return (
  //   contract: string,
  //   msg: object,
  //   coin?: { denom: string; amount: string }
  // ) =>
  //   new MsgExecuteContract(
  //     sender,
  //     contract,
  //     msg,
  //     new Coins(coin ? [Coin.fromData(coin)] : [])
  //   )
}
