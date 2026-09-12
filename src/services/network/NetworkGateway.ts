/**
 * StudyOS Network Access Gateway
 * 
 * Re-exports from NetworkAccessManager for backwards compatibility
 * and central access management across the codebase.
 */

export {
  NetworkAccessManager,
  networkAccessManager,
  networkAccessManager as networkGateway,
  NETWORK_ALLOWLIST,
} from './NetworkAccessManager';
