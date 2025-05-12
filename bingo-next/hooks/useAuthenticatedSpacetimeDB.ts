"use client"

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { DbConnection, type ErrorContext, type EventContext } from "@/module_bindings"; // Assuming module_bindings are correctly set up
import { Identity } from '@clockworklabs/spacetimedb-sdk'; // Keep for onConnect signature, though we use steamId

export interface SpacetimeDBHookState {
  // conn: DbConnection | null; // Removed: conn will be in useRef
  connected: boolean;
  spacetimeIdentity: Identity | null; // SpacetimeDB's connection identity
  authenticatedWithBackend: boolean; // Tracks if AuthenticateClient was successful
  error: string | null;
}

const useAuthenticatedSpacetimeDB = () => {
  const { data: session, status: sessionStatus } = useSession();
  const connRef = useRef<DbConnection | null>(null);
  const [dbState, setDbState] = useState<SpacetimeDBHookState>({
    // conn: null, // Removed
    connected: false,
    spacetimeIdentity: null,
    authenticatedWithBackend: false,
    error: null,
  });

  const steamId = (session?.user as { steamId?: string })?.steamId;
  const steamName = (session?.user as { steamName?: string })?.steamName; // Get steamName from session

  useEffect(() => {
    if (sessionStatus === "authenticated" && steamId) {
      if (!connRef.current) { // Only connect if not already connected/connecting
        console.log("NextAuth session authenticated, SteamID found. Attempting to connect to SpacetimeDB (Connection Effect)...");

        const onConnect = (
          _connection: DbConnection, // The connection object is now connRef.current
          identity: Identity,
          _token: string
        ) => {
          console.log(
            'Connected to SpacetimeDB with identity (Connection Effect):',
            identity.toHexString()
          );
          setDbState(prevState => ({
            ...prevState,
            // conn: connRef.current, // No longer setting conn in state
            connected: true,
            spacetimeIdentity: identity,
            error: null,
            // authenticatedWithBackend will be set by the authentication effect
          }));

          // AuthenticateClient call moved to a separate effect
        };

        const onDisconnect = () => {
          console.log('Disconnected from SpacetimeDB');
          // connRef.current will be set to null in the cleanup of this effect or in the unauthenticated block
          setDbState({
            // conn: null, // Removed
            connected: false,
            spacetimeIdentity: null,
            authenticatedWithBackend: false,
            error: "Disconnected", // Can be more specific if needed
          });
        };

        const onConnectError = (_ctx: ErrorContext, err: Error) => {
          console.error('Error connecting to SpacetimeDB:', err);
          // connRef.current will be set to null in the cleanup of this effect
          setDbState(prevState => ({
            ...prevState,
            // conn: null, // Removed
            connected: false,
            authenticatedWithBackend: false,
            error: `Connection Error: ${err.message}`,
          }));
        };
        
        const newConn = DbConnection.builder()
          .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URI || 'ws://localhost:3000')
          .withModuleName('bingo')
          .withToken(localStorage.getItem('spacetimedb_auth_token') || '') // Attempt to use existing token
          .onConnect(onConnect)
          .onDisconnect(onDisconnect)
          .onConnectError(onConnectError)
          .build();

        connRef.current = newConn; // Store the connection in the ref
        // No explicit connect() call needed here, build() initiates the connection.
      }
    } else if (sessionStatus === "unauthenticated") {
      if (connRef.current) {
        console.log("NextAuth session unauthenticated, disconnecting SpacetimeDB (Connection Effect).");
        connRef.current.disconnect();
        connRef.current = null;
        setDbState({
          // conn: null, // Removed
          connected: false,
          spacetimeIdentity: null,
          authenticatedWithBackend: false, // Reset auth status on disconnect
          error: null, // Clear error on explicit sign out
        });
      }
    }

    // Cleanup function for the effect
    return () => {
      if (connRef.current) {
        console.log("Cleaning up SpacetimeDB connection object in Connection Effect cleanup.");
        connRef.current.disconnect();
        connRef.current = null;
        // Reset state flags related to connection status
        setDbState(prevState => ({
            ...prevState,
            connected: false,
            spacetimeIdentity: null,
            authenticatedWithBackend: false,
        }));
      }
    };
  }, [sessionStatus, steamId]); // Dependencies are now only sessionStatus and steamId for connection lifecycle

  // New effect for AuthenticateClient call
  useEffect(() => {
    if (connRef.current && dbState.connected && steamId && dbState.spacetimeIdentity) {
      // Check if already authenticated or if steamName is still pending for the first auth
      // This logic allows re-authentication if steamName changes later.
      console.log(`Authentication Effect: connRef ready, connected, steamId present. SteamName: ${steamName}. Current auth status: ${dbState.authenticatedWithBackend}`);
      try {
        console.log(`Calling AuthenticateClient with SteamID: ${steamId}` + (steamName ? ` and SteamName: ${steamName}` : ' (no steamName yet)'));
        connRef.current.reducers.authenticateClient(steamId, steamName); // steamName can be undefined/null
        setDbState(prevState => ({ ...prevState, authenticatedWithBackend: true, error: null }));
        console.log("AuthenticateClient called successfully (Authentication Effect).");
      } catch (e: any) {
        console.error("Error calling AuthenticateClient (Authentication Effect):", e);
        setDbState(prevState => ({ ...prevState, authenticatedWithBackend: false, error: `Failed to authenticate with backend: ${e.message}` }));
      }
    }
  }, [dbState.connected, dbState.spacetimeIdentity, steamId, steamName]); // connRef itself is stable, its .current is what matters and is checked

  const subscribeToQueries = useCallback((queries: string[]) => {
    console.log('[subscribeToQueries] Attempting to subscribe. Connected:', dbState.connected, 'Authenticated:', dbState.authenticatedWithBackend, 'connRef.current:', !!connRef.current);
    const currentConn = connRef.current; // Assign to a new const variable
    if (currentConn && dbState.connected && dbState.authenticatedWithBackend) { // Use currentConn in condition
      console.log('[subscribeToQueries] Conditions met. Subscribing to queries:', queries);
      let count = 0;
      queries.forEach((query, index) => {
        console.log(`[subscribeToQueries] Subscribing to query #${index + 1}: ${query}`);
        currentConn.subscriptionBuilder() // Use currentConn here
          .onApplied(() => {
            count++;
            console.log(`[subscribeToQueries] onApplied for query: ${query}. Total applied: ${count}/${queries.length}`);
            if (count === queries.length) {
              console.log('SpacetimeDB client cache initialized for subscribed queries.');
            }
          })
          .onError((errorCtx: ErrorContext) => { 
            console.error(`[subscribeToQueries] onError for query: ${query}. Full ErrorContext:`, errorCtx);
          })
          .subscribe(query);
      });
    } else {
      console.warn("[subscribeToQueries] Conditions NOT met. Cannot subscribe to SpacetimeDB queries.");
    }
  }, [dbState.connected, dbState.authenticatedWithBackend, connRef]); // Added connRef to dependency array as currentConn depends on it

  useEffect(() => {
    // Persist SpacetimeDB token when it becomes available (after successful connection and identity received)
    if (connRef.current && dbState.spacetimeIdentity && connRef.current.token) {
        const internalToken = connRef.current.token;
        if (internalToken) {
            localStorage.setItem('spacetimedb_auth_token', internalToken);
            console.log("SpacetimeDB auth token saved to localStorage.");
        }
    }
  }, [dbState.spacetimeIdentity]); // Re-run when spacetimeIdentity changes (implies a new connection/token)

  return { connRef, ...dbState, subscribeToQueries }; // Return connRef along with other state and functions
};

export default useAuthenticatedSpacetimeDB; 