using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PPSolutionExplorer.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    import_id = table.Column<Guid>(type: "uuid", nullable: true),
                    node_id = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    progress = table.Column<int>(type: "integer", nullable: false),
                    total = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    output_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_jobs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ai_outputs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    import_id = table.Column<Guid>(type: "uuid", nullable: true),
                    node_id = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    content = table.Column<string>(type: "text", nullable: true),
                    model = table.Column<string>(type: "text", nullable: false),
                    prompt_name = table.Column<string>(type: "text", nullable: false),
                    prompt_version = table.Column<string>(type: "text", nullable: false),
                    cache_key = table.Column<string>(type: "text", nullable: false),
                    ai_status = table.Column<string>(type: "text", nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_outputs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "imports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    version = table.Column<string>(type: "text", nullable: true),
                    file_name = table.Column<string>(type: "text", nullable: false),
                    sha256 = table.Column<string>(type: "text", nullable: false),
                    imported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    warnings = table.Column<string>(type: "jsonb", nullable: false),
                    node_count = table.Column<int>(type: "integer", nullable: false),
                    edge_count = table.Column<int>(type: "integer", nullable: false),
                    unresolved_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_imports", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    node_id = table.Column<string>(type: "text", nullable: false),
                    text = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notes", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    node_id = table.Column<string>(type: "text", nullable: false),
                    tag = table.Column<string>(type: "text", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "edges",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    import_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<string>(type: "text", nullable: false),
                    target_id = table.Column<string>(type: "text", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    expression = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edges", x => x.id);
                    table.ForeignKey(
                        name: "FK_edges_imports_import_id",
                        column: x => x.import_id,
                        principalTable: "imports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "nodes",
                columns: table => new
                {
                    import_id = table.Column<Guid>(type: "uuid", nullable: false),
                    id = table.Column<string>(type: "text", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    parent_id = table.Column<string>(type: "text", nullable: true),
                    branch = table.Column<string>(type: "text", nullable: true),
                    sub_type = table.Column<string>(type: "text", nullable: true),
                    connector = table.Column<string>(type: "text", nullable: true),
                    operation = table.Column<string>(type: "text", nullable: true),
                    raw_json = table.Column<string>(type: "text", nullable: true),
                    properties = table.Column<string>(type: "jsonb", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nodes", x => new { x.import_id, x.id });
                    table.ForeignKey(
                        name: "FK_nodes_imports_import_id",
                        column: x => x.import_id,
                        principalTable: "imports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "unresolved_references",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    import_id = table.Column<Guid>(type: "uuid", nullable: false),
                    node_id = table.Column<string>(type: "text", nullable: false),
                    raw_expression = table.Column<string>(type: "text", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_unresolved_references", x => x.id);
                    table.ForeignKey(
                        name: "FK_unresolved_references_imports_import_id",
                        column: x => x.import_id,
                        principalTable: "imports",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ai_jobs_status",
                table: "ai_jobs",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_ai_outputs_cache_key",
                table: "ai_outputs",
                column: "cache_key");

            migrationBuilder.CreateIndex(
                name: "IX_ai_outputs_node_id_kind",
                table: "ai_outputs",
                columns: new[] { "node_id", "kind" });

            migrationBuilder.CreateIndex(
                name: "IX_edges_import_id_source_id",
                table: "edges",
                columns: new[] { "import_id", "source_id" });

            migrationBuilder.CreateIndex(
                name: "IX_edges_import_id_target_id",
                table: "edges",
                columns: new[] { "import_id", "target_id" });

            migrationBuilder.CreateIndex(
                name: "IX_imports_sha256",
                table: "imports",
                column: "sha256");

            migrationBuilder.CreateIndex(
                name: "IX_nodes_id",
                table: "nodes",
                column: "id");

            migrationBuilder.CreateIndex(
                name: "IX_nodes_import_id_parent_id",
                table: "nodes",
                columns: new[] { "import_id", "parent_id" });

            migrationBuilder.CreateIndex(
                name: "IX_nodes_import_id_type",
                table: "nodes",
                columns: new[] { "import_id", "type" });

            migrationBuilder.CreateIndex(
                name: "IX_notes_node_id",
                table: "notes",
                column: "node_id");

            migrationBuilder.CreateIndex(
                name: "IX_tags_node_id_tag",
                table: "tags",
                columns: new[] { "node_id", "tag" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_tags_tag",
                table: "tags",
                column: "tag");

            migrationBuilder.CreateIndex(
                name: "IX_unresolved_references_import_id_node_id",
                table: "unresolved_references",
                columns: new[] { "import_id", "node_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_jobs");

            migrationBuilder.DropTable(
                name: "ai_outputs");

            migrationBuilder.DropTable(
                name: "edges");

            migrationBuilder.DropTable(
                name: "nodes");

            migrationBuilder.DropTable(
                name: "notes");

            migrationBuilder.DropTable(
                name: "tags");

            migrationBuilder.DropTable(
                name: "unresolved_references");

            migrationBuilder.DropTable(
                name: "imports");
        }
    }
}
