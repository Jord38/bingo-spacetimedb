using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "BingoFieldDefinitions", Public = true)]
    public partial struct BingoFieldDefinition
    {
        [AutoInc]
        [PrimaryKey]
        public uint FieldId;

        public string Text;

        public bool IsMarked; // Global marked state for this field
    }
} 