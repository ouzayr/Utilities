using CodeCartographer.Api.Db;
using Microsoft.EntityFrameworkCore;

namespace CodeCartographer.Api.Diff;

public sealed class DiffEngine
{
    public async Task<DiffResult> DiffAsync(AppDbContext db, Guid leftScan, Guid rightScan)
    {
        var ln = await db.Nodes.Where(n => n.ScanId == leftScan).ToListAsync();
        var rn = await db.Nodes.Where(n => n.ScanId == rightScan).ToListAsync();
        var le = await db.Edges.Where(e => e.ScanId == leftScan).ToListAsync();
        var re = await db.Edges.Where(e => e.ScanId == rightScan).ToListAsync();
        var lf = await db.Findings.Where(f => f.ScanId == leftScan).ToListAsync();
        var rf = await db.Findings.Where(f => f.ScanId == rightScan).ToListAsync();

        var lnIds = ln.Select(n => n.NodeId).ToHashSet();
        var rnIds = rn.Select(n => n.NodeId).ToHashSet();
        var leIds = le.Select(e => e.EdgeId).ToHashSet();
        var reIds = re.Select(e => e.EdgeId).ToHashSet();
        var lfIds = lf.Select(f => f.FindingId).ToHashSet();
        var rfIds = rf.Select(f => f.FindingId).ToHashSet();

        return new DiffResult
        {
            LeftScan = leftScan,
            RightScan = rightScan,
            AddedNodes = rn.Where(n => !lnIds.Contains(n.NodeId)).Select(MapN).ToList(),
            RemovedNodes = ln.Where(n => !rnIds.Contains(n.NodeId)).Select(MapN).ToList(),
            AddedEdges = re.Where(e => !leIds.Contains(e.EdgeId)).Select(MapE).ToList(),
            RemovedEdges = le.Where(e => !reIds.Contains(e.EdgeId)).Select(MapE).ToList(),
            NewFindings = rf.Where(f => !lfIds.Contains(f.FindingId)).Select(MapF).ToList(),
            FixedFindings = lf.Where(f => !rfIds.Contains(f.FindingId)).Select(MapF).ToList(),
            StableFindings = lf.Where(f => rfIds.Contains(f.FindingId)).Select(MapF).ToList(),
        };
    }

    private static object MapN(Db.Node n) => new { id = n.NodeId, kind = n.Kind, side = n.Side, name = n.Name, project = n.Project, filePath = n.FilePath };
    private static object MapE(Db.Edge e) => new { id = e.EdgeId, source = e.SourceId, target = e.TargetId, kind = e.Kind };
    private static object MapF(Db.Finding f) => new { id = f.FindingId, ruleId = f.RuleId, severity = f.Severity, category = f.Category, title = f.Title, filePath = f.FilePath, line = f.Line };
}

public sealed class DiffResult
{
    public Guid LeftScan { get; set; }
    public Guid RightScan { get; set; }
    public List<object> AddedNodes { get; set; } = new();
    public List<object> RemovedNodes { get; set; } = new();
    public List<object> AddedEdges { get; set; } = new();
    public List<object> RemovedEdges { get; set; } = new();
    public List<object> NewFindings { get; set; } = new();
    public List<object> FixedFindings { get; set; } = new();
    public List<object> StableFindings { get; set; } = new();
}
