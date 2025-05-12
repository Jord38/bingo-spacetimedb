using SpacetimeDB;
using System;

public static partial class Module
{
    [Table(Name = "user", Public = true)]
    public partial class User
    {
        [PrimaryKey]
        public string SteamId = default!;
        public string? Name;
        public bool Online;
    }

    // map active connections to SteamIDs
    [Table(Name = "active_connection", Public = false)]
    public partial class ActiveConnection
    {
        [PrimaryKey]
        public Identity ConnectionIdentity;
        public string SteamId = default!;
    }

    [Table(Name = "message", Public = true)]
    public partial class Message
    {
        [PrimaryKey]
        [AutoInc]
        public ulong MessageId;
        public string Sender = default!;
        public Timestamp Sent;
        public string Text = "";
    }

    [Table(Name = "system_message", Public = true)]
    public partial class SystemMessage
    {
        [PrimaryKey]
        [AutoInc]
        public ulong MessageId;
        public string Text = "";
        public Timestamp Sent;
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrEmpty(name))
        {
            throw new ArgumentException("Names must not be empty");
        }
        return name;
    }

    private static string ValidateMessage(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            throw new ArgumentException("Messages must not be empty");
        }
        return text;
    }

    [Reducer]
    public static void AuthenticateClient(ReducerContext ctx, string steamId, string? steamUsername)
    {
        if (string.IsNullOrEmpty(steamId))
        {
            throw new ArgumentException("Steam ID must not be empty.");
        }

        // Find or create user
        var user = ctx.Db.user.SteamId.Find(steamId);
        if (user == null)
        {
            user = new User
            {
                SteamId = steamId,
                Name = string.IsNullOrEmpty(steamUsername) ? null : steamUsername,
                Online = true,
            };
            ctx.Db.user.Insert(user);
            Log.Info($"New user created with SteamID: {steamId}" + (string.IsNullOrEmpty(steamUsername) ? "" : $" and initial name: {steamUsername}"));
        }
        else
        {
            user.Online = true;
            ctx.Db.user.SteamId.Update(user);
            Log.Info($"Existing user {steamId} marked as online.");
        }

        // Link connection to SteamId
        var existingConnection = ctx.Db.active_connection.ConnectionIdentity.Find(ctx.Sender);
        if (existingConnection != null)
        {
            if (existingConnection.SteamId != steamId)
            {
                Log.Warn($"Connection {ctx.Sender} re-authenticating from SteamID {existingConnection.SteamId} to {steamId}.");
                existingConnection.SteamId = steamId;
                ctx.Db.active_connection.ConnectionIdentity.Update(existingConnection);
            }
            // If SteamId is the same, no action needed for active_connection
        }
        else
        {
            ctx.Db.active_connection.Insert(new ActiveConnection
            {
                ConnectionIdentity = ctx.Sender,
                SteamId = steamId,
            });
        }
        Log.Info($"Client {ctx.Sender} authenticated and linked to SteamID: {steamId}" + (user.Name != null ? $", Name: {user.Name}" : ""));
    }


    [Reducer]
    public static void SetName(ReducerContext ctx, string name)
    {
        name = ValidateName(name);

        var connection = ctx.Db.active_connection.ConnectionIdentity.Find(ctx.Sender);
        if (connection == null)
        {
            throw new Exception("User is not authenticated. Cannot set name.");
        }

        var user = ctx.Db.user.SteamId.Find(connection.SteamId);
        if (user != null)
        {
            user.Name = name;
            ctx.Db.user.SteamId.Update(user); // Update based on PK SteamId
            Log.Info($"User {user.SteamId} name updated to: {name}");
        }
        else
        {
            Log.Error($"User with SteamID {connection.SteamId} not found, but an active connection exists for {ctx.Sender}. This should not happen.");
            throw new Exception($"Critical error: User record not found for authenticated user {connection.SteamId}.");
        }
    }

    [Reducer(ReducerKind.ClientConnected)]
    public static void ClientConnected(ReducerContext ctx)
    {
        Log.Info($"Client connected: {ctx.Sender}. Waiting for client to call AuthenticateClient with SteamID.");
        // The client is now expected to call AuthenticateClient with their SteamID.
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void ClientDisconnected(ReducerContext ctx)
    {
        Log.Info($"Client disconnected: {ctx.Sender}");
        var connection = ctx.Db.active_connection.ConnectionIdentity.Find(ctx.Sender);

        if (connection != null)
        {
            var user = ctx.Db.user.SteamId.Find(connection.SteamId);
            if (user != null)
            {
                user.Online = false;
                ctx.Db.user.SteamId.Update(user);
                Log.Info($"User {user.SteamId} marked as offline.");
            }
            else
            {
                // This could happen if the User record was somehow deleted while connection was active.
                Log.Warn($"User with SteamID {connection.SteamId} not found for disconnected client {ctx.Sender}, but active connection record existed.");
            }
            // Delete the active connection record
            // Assuming Delete takes the entity instance, similar to Update.
            // If it requires a key, it might be: ctx.Db.active_connection.ConnectionIdentity.DeleteByKey(connection.ConnectionIdentity);
            ctx.Db.active_connection.ConnectionIdentity.Delete(connection.ConnectionIdentity); 
            Log.Info($"Active connection for {ctx.Sender} (SteamID: {connection.SteamId}) removed.");
        }
        else
        {
            // This means the client disconnected before calling AuthenticateClient, or after an error during authentication.
            Log.Warn($"No active connection found for disconnected client: {ctx.Sender}. User online status (if any) may be stale if they never authenticated successfully.");
        }
    }

    [Reducer]
    public static void SendMessage(ReducerContext ctx, string text)
    {
        text = ValidateMessage(text);

        var connection = ctx.Db.active_connection.ConnectionIdentity.Find(ctx.Sender);
        if (connection == null)
        {
            throw new Exception("User is not authenticated. Cannot send message.");
        }

        Log.Info($"Attempting to send message from SteamID: {connection.SteamId}: {text}");
        ctx.Db.message.Insert(
            new Message
            {
                MessageId = 0,
                Sender = connection.SteamId,
                Text = text,
                Sent = ctx.Timestamp,
            }
        );
        Log.Info($"Message sent by SteamID: {connection.SteamId}");
    }

    [Reducer]
    public static void SendSystemMessage(ReducerContext ctx, string messageText)
    {
        Log.Info($"AddSystemMessageInternal called with: '{messageText}'");

        if (string.IsNullOrEmpty(messageText))
        {
            Log.Warn("Attempted to add an empty system message.");
            return; 
        }

        ctx.Db.system_message.Insert(
            new SystemMessage
            {
                MessageId = 0,
                Text = messageText,
                Sent = ctx.Timestamp,
            }
        );
    }
}
