using SpacetimeDB;
using System.Collections.Generic;

public static partial class Module
{
    [Table(Name = "PlayerBingoCards", Public = true)]
    public partial struct PlayerBingoCard
    {
        [PrimaryKey]
        public string CardId; // Composite key: "PlayerSteamId_GameId"

        // We still store these separately for easier querying and direct access,
        // though they are part of the composite CardId.
        // Consider adding [Index] attributes if you frequently query by these individually.
        public string PlayerSteamId;
        public uint GameId;

        // List of FieldId from BingoFieldDefinition that are on this player's card for this game
        public List<uint> AssignedFieldIds;

        // Static helper method to create the composite CardId
        public static string GenerateCardId(string playerSteamId, uint gameId)
        {
            return $"{playerSteamId}_{gameId}";
        }
    }
} 