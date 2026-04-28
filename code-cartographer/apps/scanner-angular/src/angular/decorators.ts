import * as path from 'node:path';
import { ClassDeclaration, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { GraphEdge, GraphNode, NgKind, edgeId, nodeId } from '../types.js';

const DECORATOR_KIND: Record<string, NgKind> = {
  Component: 'ng-component',
  Injectable: 'ng-service',
  NgModule: 'ng-module',
  Pipe: 'ng-pipe',
  Directive: 'ng-directive',
};

export function extractDecorated(sourceFiles: SourceFile[], root: string, project: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // First pass: classes by name (used to resolve constructor DI).
  const classByName = new Map<string, GraphNode>();

  for (const sf of sourceFiles) {
    for (const cls of sf.getClasses()) {
      const decoratorNode = findAngularDecorator(cls);
      if (!decoratorNode) {
        // Could still be a Guard / Interceptor / Resolver detected by interface.
        const specialKind = detectSpecialClass(cls);
        if (!specialKind) continue;
        const node = makeNodeFromClass(cls, specialKind, root, project);
        nodes.push(node);
        classByName.set(cls.getName() ?? '', node);
        continue;
      }
      const kind = DECORATOR_KIND[decoratorNode.name];
      if (!kind) continue;
      const node = makeNodeFromClass(cls, kind, root, project, decoratorNode.args);
      nodes.push(node);
      classByName.set(cls.getName() ?? '', node);
    }
  }

  // Second pass: DI, NgModule declarations, base classes, interfaces.
  for (const sf of sourceFiles) {
    for (const cls of sf.getClasses()) {
      const owner = classByName.get(cls.getName() ?? '');
      if (!owner) continue;

      // Constructor injections.
      const ctor = cls.getConstructors()[0];
      if (ctor) {
        for (const param of ctor.getParameters()) {
          const typeText = param.getType().getSymbol()?.getName();
          if (!typeText) continue;
          const target = classByName.get(typeText);
          if (!target) continue;
          edges.push({
            id: edgeId('injects', owner.id, target.id, param.getName()),
            source: owner.id,
            target: target.id,
            kind: 'injects',
            meta: { paramName: param.getName(), via: 'ctor' },
          });
        }
      }

      // `inject(Foo)` calls (Angular 14+).
      cls.forEachDescendant((d) => {
        if (d.getKind() !== SyntaxKind.CallExpression) return;
        const ce = d.asKindOrThrow(SyntaxKind.CallExpression);
        const expr = ce.getExpression();
        if (expr.getText() !== 'inject') return;
        const arg = ce.getArguments()[0];
        if (!arg) return;
        const target = classByName.get(arg.getText());
        if (!target) return;
        edges.push({
          id: edgeId('injects', owner.id, target.id, ce.getStartLineNumber().toString()),
          source: owner.id,
          target: target.id,
          kind: 'injects',
          meta: { via: 'inject()' },
        });
      });

      // Base class.
      const base = cls.getBaseClass();
      if (base) {
        const target = classByName.get(base.getName() ?? '');
        if (target) {
          edges.push({ id: edgeId('extends', owner.id, target.id), source: owner.id, target: target.id, kind: 'extends', meta: {} });
        }
      }

      // Interfaces.
      for (const impl of cls.getImplements()) {
        const name = impl.getExpression().getText();
        const target = classByName.get(name);
        if (target) {
          edges.push({ id: edgeId('implements', owner.id, target.id), source: owner.id, target: target.id, kind: 'implements', meta: {} });
        }
      }

      // NgModule declarations / imports / providers.
      if (owner.kind === 'ng-module') {
        const decoratorNode = findAngularDecorator(cls);
        const meta = decoratorNode?.meta;
        if (meta) {
          for (const k of ['declarations', 'imports', 'exports', 'providers'] as const) {
            const arr = meta[k] ?? [];
            for (const ref of arr) {
              const target = classByName.get(ref);
              if (!target) continue;
              edges.push({ id: edgeId('declares', owner.id, target.id, k), source: owner.id, target: target.id, kind: 'declares', meta: { listName: k } });
            }
          }
        }
      }

      // Standalone component imports (Angular 17 standalone arrays).
      if (owner.kind === 'ng-component' && (owner.meta as Record<string, unknown>).standalone) {
        const decoratorNode = findAngularDecorator(cls);
        const arr = decoratorNode?.meta?.imports ?? [];
        for (const ref of arr) {
          const target = classByName.get(ref);
          if (!target) continue;
          edges.push({ id: edgeId('imports', owner.id, target.id), source: owner.id, target: target.id, kind: 'imports', meta: {} });
        }
      }
    }
  }

  return { nodes, edges };
}

interface DecoratorInfo {
  name: string;
  args?: string;
  meta?: Record<string, string[]>;
}

function findAngularDecorator(cls: ClassDeclaration): DecoratorInfo | undefined {
  for (const dec of cls.getDecorators()) {
    const name = dec.getName();
    if (name in DECORATOR_KIND) {
      const args = dec.getArguments()[0];
      if (!args) return { name };
      const text = args.getText();
      const meta: Record<string, string[]> = {};
      // Best-effort: pull declarations / imports / exports / providers arrays.
      if (Node.isObjectLiteralExpression(args)) {
        for (const prop of args.getProperties()) {
          if (!Node.isPropertyAssignment(prop)) continue;
          const key = prop.getName();
          const value = prop.getInitializer();
          if (!value) continue;
          if (key === 'standalone' && value.getText() === 'true') {
            meta['standalone'] = ['true'];
            continue;
          }
          if (Node.isArrayLiteralExpression(value)) {
            meta[key] = value.getElements().map((el) => el.getText());
          } else if (key === 'selector' || key === 'name' || key === 'templateUrl' || key === 'styleUrl') {
            meta[key] = [value.getText().replace(/['"`]/g, '')];
          }
        }
      }
      return { name, args: text, meta };
    }
  }
  return undefined;
}

function detectSpecialClass(cls: ClassDeclaration): NgKind | undefined {
  for (const impl of cls.getImplements()) {
    const t = impl.getExpression().getText();
    if (t === 'CanActivate' || t === 'CanActivateChild' || t === 'CanLoad' || t === 'CanMatch' || t === 'CanDeactivate') return 'ng-guard';
    if (t === 'HttpInterceptor') return 'ng-interceptor';
    if (t === 'Resolve') return 'ng-resolver';
  }
  // Heuristic: name ends with Guard / Interceptor / Resolver.
  const name = cls.getName() ?? '';
  if (/Guard$/.test(name)) return 'ng-guard';
  if (/Interceptor$/.test(name)) return 'ng-interceptor';
  if (/Resolver$/.test(name)) return 'ng-resolver';
  return undefined;
}

function makeNodeFromClass(cls: ClassDeclaration, kind: NgKind, root: string, project: string, decoratorArgs?: string): GraphNode {
  const name = cls.getName() ?? 'Anonymous';
  const filePath = path.relative(root, cls.getSourceFile().getFilePath()).replace(/\\/g, '/');
  const fqName = `${filePath}#${name}`;
  const standalone = decoratorArgs?.includes('standalone: true') ?? false;
  return {
    id: nodeId('ui', kind, fqName, project),
    kind,
    side: 'ui',
    project,
    name,
    fqName,
    filePath,
    line: cls.getStartLineNumber(),
    meta: {
      className: name,
      standalone,
    },
  };
}
