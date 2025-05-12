using SpacetimeDB;
using System;
using System.Linq;
using System.Collections.Generic;

public static partial class Module
{
    // Helper to get SteamId from ReducerContext
    // This relies on the ActiveConnection table managed by reducers in Lib.cs
    private static string? GetValidatedSteamId(ReducerContext ctx)
    {
        // Accessing table via ctx.Db.table_name.PrimaryKeyName.Find()
        // Assumes "active_connection" is the [Table(Name = "active_connection")]
        // and ConnectionIdentity is its [PrimaryKey]
        var activeConnection = ctx.Db.active_connection.ConnectionIdentity.Find(ctx.Sender);
        if (activeConnection == null)
        {
            Log.Error($"User not authenticated: No active connection found for identity {ctx.Sender}. Client should call AuthenticateClient first.");
            return null;
        }
        
        // Assumes "user" is the [Table(Name = "user")]
        // and SteamId is its [PrimaryKey]
        var user = ctx.Db.user.SteamId.Find(activeConnection.SteamId);
        if (user == null)
        {
             Log.Error($"User record not found for SteamID {activeConnection.SteamId} despite active connection. This indicates a potential data integrity issue.");
             return null;
        }
        return activeConnection.SteamId;
    }

    // Example of how an admin check might look (implementation details omitted)
    // private static bool IsAdmin(string steamId) { 
    //     // TODO: Implement actual admin check logic, e.g., check against a list of admin SteamIDs
    //     return steamId == "admin_steam_id_placeholder"; // Placeholder
    // }

    // --- Bingo Game Reducers ---

    [Reducer]
    public static void AddBingoFieldDefinition(ReducerContext ctx, string text)
    {
        // For now, any authenticated user can add. In a real scenario, add admin checks:
        // string? requestorSteamId = GetValidatedSteamId(ctx);
        // if (requestorSteamId == null || !IsAdmin(requestorSteamId)) { 
        //     Log.Error("Unauthorized: Only admins can add bingo field definitions."); 
        //     return; 
        // }

        if (string.IsNullOrWhiteSpace(text))
        {
            Log.Error("Bingo field definition text cannot be empty.");
            return;
        }

        // Corrected: Use PascalCase table name as defined in [Table(Name = "BingoFieldDefinitions")]
        foreach (var def in ctx.Db.BingoFieldDefinitions.Iter())
        {
            if (def.Text.Equals(text, StringComparison.OrdinalIgnoreCase))
            {
                Log.Warn($"Bingo field definition with text '{text}' already exists with ID {def.FieldId}. Not adding duplicate.");
                return;
            }
        }

        var newField = new BingoFieldDefinition
        {
            Text = text,
            IsMarked = false // New fields are always unmarked initially
        };
        ctx.Db.BingoFieldDefinitions.Insert(newField);
        Log.Info($"Added new Bingo Field Definition: '{text}' (ID might be reflected in subsequent queries)");
    }

    [Reducer]
    public static void CreateGameSession(ReducerContext ctx, string? gameName, List<uint>? availableFieldIdsForGame)
    {
        // string? requestorSteamId = GetValidatedSteamId(ctx);
        // if (requestorSteamId == null) { 
        //     Log.Error("Unauthorized: User not authenticated."); 
        //     return; // Or throw exception
        // }
        // Potentially add admin check or specific permissions for creating games

        // Corrected: Use PascalCase table name as defined in [Table(Name = "BingoFieldDefinitions")]
        // Assumes FieldId is the PrimaryKey for BingoFieldDefinition
        if (availableFieldIdsForGame != null && availableFieldIdsForGame.Count > 0)
        {
            foreach (var fieldId in availableFieldIdsForGame)
            {
                if (ctx.Db.BingoFieldDefinitions.FieldId.Find(fieldId) == null)
                {
                    Log.Error($"Invalid field ID {fieldId} provided for game session. Field does not exist.");
                    return; // Indicate failure
                }
            }
        }

        var newGameSession = new GameSession
        {
            GameName = gameName,
            IsActive = true,
            AvailableFieldIds = availableFieldIdsForGame // Can be null
        };
        ctx.Db.GameSessions.Insert(newGameSession);
        Log.Info($"Created new Game Session with Name: {(string.IsNullOrEmpty(gameName) ? "[Unnamed]" : gameName)} (ID might be reflected in subsequent queries)");
        // Return type is void, client should subscribe or query to get the ID if needed.
    }

    [Reducer]
    public static void RequestNewBingoCard(ReducerContext ctx, uint gameId)
    {
        string? playerSteamId = GetValidatedSteamId(ctx);
        if (playerSteamId == null)
        {
            return;
        }

        var gameSessionNullable = ctx.Db.GameSessions.GameId.Find(gameId);
        if (gameSessionNullable == null)
        {
            Log.Error($"Game session {gameId} not found.");
            return;
        }
        // Access members via .Value after null check
        if (!gameSessionNullable.Value.IsActive)
        {
            Log.Error($"Game session {gameId} is not active.");
            return;
        }

        string cardId = PlayerBingoCard.GenerateCardId(playerSteamId, gameId);
        if (ctx.Db.PlayerBingoCards.CardId.Find(cardId) != null)
        {
            Log.Warn($"Player {playerSteamId} already has a bingo card (CardId: {cardId}) for game {gameId}.");
            return;
        }

        List<uint> availableFieldIds;
        // Use .Value to access AvailableFieldIds
        if (gameSessionNullable.Value.AvailableFieldIds != null && gameSessionNullable.Value.AvailableFieldIds.Count > 0)
        {
            availableFieldIds = gameSessionNullable.Value.AvailableFieldIds.ToList();
        }
        else
        {
            availableFieldIds = ctx.Db.BingoFieldDefinitions.Iter().Select(def => def.FieldId).ToList();
        }

        const int requiredFieldsCount = 25;
        if (availableFieldIds.Count < requiredFieldsCount)
        {
            Log.Error($"Not enough unique bingo fields available ({availableFieldIds.Count}) to create a card for game {gameId}. Need at least {requiredFieldsCount}.");
            return;
        }

        // Randomly select 25 fields
        var random = new Random((int)ctx.Timestamp.MicrosecondsSinceUnixEpoch); // Seed with timestamp for some variability
        List<uint> assignedFieldIds = new List<uint>();
        
        // Fisher-Yates shuffle principle for selecting K items
        for (int i = 0; i < requiredFieldsCount; i++)
        {
            int randomIndex = random.Next(i, availableFieldIds.Count);
            // Swap the chosen element with the current element
            uint temp = availableFieldIds[i];
            availableFieldIds[i] = availableFieldIds[randomIndex];
            availableFieldIds[randomIndex] = temp;
            // Add the chosen element to the assigned list
            assignedFieldIds.Add(availableFieldIds[i]);
        }

        var newCard = new PlayerBingoCard
        {
            CardId = cardId,
            PlayerSteamId = playerSteamId,
            GameId = gameId,
            AssignedFieldIds = assignedFieldIds
        };
        // Corrected: Use PascalCase table name as defined in [Table(Name = "PlayerBingoCards")]
        ctx.Db.PlayerBingoCards.Insert(newCard);
        Log.Info($"Player {playerSteamId} assigned a new bingo card (CardId: {cardId}) with {assignedFieldIds.Count} fields for game {gameId}.");
    }

    [Reducer]
    public static void MarkField(ReducerContext ctx, uint gameId, uint fieldIdToMark)
    {
        string? playerSteamId = GetValidatedSteamId(ctx);
        if (playerSteamId == null)
        {
            return; 
        }

        // Fetch player details for the system message
        var player = ctx.Db.user.SteamId.Find(playerSteamId); 
        string playerName = player?.Name ?? $"Player ({playerSteamId.Substring(0,6)})";

        string cardId = PlayerBingoCard.GenerateCardId(playerSteamId, gameId);
        var playerCardNullable = ctx.Db.PlayerBingoCards.CardId.Find(cardId);

        if (playerCardNullable == null)
        {
            Log.Error($"Player {playerSteamId} does not have a bingo card (CardId: {cardId}) for game {gameId}. Cannot mark field.");
            return;
        }
        var playerCard = playerCardNullable.Value; // Now non-nullable

        if (!playerCard.AssignedFieldIds.Contains(fieldIdToMark))
        {
            Log.Error($"Field ID {fieldIdToMark} is not on player {playerSteamId}\'s card for game {gameId}. Cannot mark.");
            return;
        }

        var fieldDefinitionNullable = ctx.Db.BingoFieldDefinitions.FieldId.Find(fieldIdToMark);
        if (fieldDefinitionNullable == null)
        {
            Log.Error($"Bingo field definition with ID {fieldIdToMark} not found. Cannot mark.");
            return;
        }
        var fieldDefinition = fieldDefinitionNullable.Value; // Now non-nullable
        string fieldText = fieldDefinition.Text ?? "Unnamed Field";

        string actionText;
        if (fieldDefinition.IsMarked)
        {
            // Create a mutable copy to modify for struct types
            var modifiedFieldDefinition = fieldDefinition;
            modifiedFieldDefinition.IsMarked = false;
            // Update via the Primary Key (FieldId)
            ctx.Db.BingoFieldDefinitions.FieldId.Update(modifiedFieldDefinition);
            actionText = "unmarked";
            Log.Info($"Player {playerSteamId} unmarked field ID {fieldIdToMark} ('{fieldText}') for game {gameId}. Global state updated.");
        }
        else
        {
            // Create a mutable copy to modify for struct types
            var modifiedFieldDefinition = fieldDefinition;
            modifiedFieldDefinition.IsMarked = true;
            // Update via the Primary Key (FieldId)
            ctx.Db.BingoFieldDefinitions.FieldId.Update(modifiedFieldDefinition);
            actionText = "marked";
            Log.Info($"Player {playerSteamId} marked field ID {fieldIdToMark} ('{fieldText}') for game {gameId}. Global state updated.");
        }

        // Add system message after successful mark/unmark
        string systemMessageText = $"{playerName} {actionText} '{fieldText}'.";
        SendSystemMessage(ctx, systemMessageText);
    }

    [Reducer]
    public static void ResetAllFieldStates(ReducerContext ctx)
    {
        // Potentially add admin check here:
        // string? requestorSteamId = GetValidatedSteamId(ctx);
        // if (requestorSteamId == null || !IsAdmin(requestorSteamId)) { 
        //     Log.Error("Unauthorized: Only admins can reset all field states."); 
        //     return; 
        // }
        
        int count = 0;
        // Corrected: Use PascalCase table name as defined in [Table(Name = "BingoFieldDefinitions")]
        // Need to collect IDs first if modifying and iterating the same source via .Iter() causes issues,
        // or if Update requires the PK. For now, assume simple iteration and update by PK is fine.
        var fieldDefsToUpdate = new List<BingoFieldDefinition>();

        foreach (var fieldDefInIterator in ctx.Db.BingoFieldDefinitions.Iter())
        {
            if (fieldDefInIterator.IsMarked)
            {
                var modifiedFieldDef = fieldDefInIterator; // Create a mutable copy
                modifiedFieldDef.IsMarked = false;       // Modify the copy
                fieldDefsToUpdate.Add(modifiedFieldDef);
            }
        }

        foreach(var modifiedFieldDef in fieldDefsToUpdate)
        {
            // Update via the Primary Key (FieldId)
            ctx.Db.BingoFieldDefinitions.FieldId.Update(modifiedFieldDef);
            count++;
        }
        Log.Info($"Reset {count} bingo field states to unmarked.");
    }
}