using SpacetimeDB;
using System.Collections.Generic;

public static partial class Module
{
    [Table(Name = "GameSessions", Public = true)]
    public partial struct GameSession
    {
        [AutoInc]
        [PrimaryKey]
        public uint GameId;

        public string? GameName;

        public bool IsActive;

        // If null or empty, all BingoFieldDefinitions are considered available for this game.
        // Otherwise, only fields from this list can be assigned to player cards in this game.
        public List<uint>? AvailableFieldIds; 
    }
} 