/**
 * Global type definitions for project-specific types
 */

// Common types used across the application
interface ListedItem {
  symbol: string;
  name: string;
  token: string;
  pair: string;
  lpToken: string;
}

interface AssetInfo {
  token: {
    contract_addr: string;
  };
}

interface NativeInfo {
  native_token: {
    denom: string;
  };
}

interface Asset {
  amount: string;
  symbol: string;
}

interface Token {
  amount: string;
  info: AssetInfo | NativeInfo;
}

interface AssetToken {
  amount: string;
  info: AssetInfo;
}

interface NativeToken {
  amount: string;
  info: NativeInfo;
}
