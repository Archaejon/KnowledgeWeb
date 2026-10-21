import { describe, expect, it } from 'vitest';
import { buildNetworkGraph, defaultFilters } from '../src/core/network';
import { createSampleData } from '../src/core/sample';

describe('consent-aware network graph', () => {
  it('draws only the acting identity’s own bilateral relationships', () => {
    const data = createSampleData();
    const graph = buildNetworkGraph(data, 'p-mara');
    const relationshipEdges = graph.edges.filter((edge) => edge.type.startsWith('relationship-'));
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    expect(nodeIds.has('p-idris')).toBe(true);
    expect(nodeIds.has('p-nia')).toBe(true);
    expect(nodeIds.has('p-tomas')).toBe(true);
    // Revoked relationship should not appear as an active network edge.
    expect(nodeIds.has('p-ilse')).toBe(false);
    // Nia–Owen relationship is private to them.
    expect(
      relationshipEdges.some(
        (edge) =>
          (edge.source === 'p-nia' && edge.target === 'p-owen') ||
          (edge.source === 'p-owen' && edge.target === 'p-nia'),
      ),
    ).toBe(false);
    expect(relationshipEdges.every((edge) => edge.source === 'p-mara' || edge.target === 'p-mara')).toBe(
      true,
    );
  });

  it('can hide pending and declined edges without affecting active access', () => {
    const data = createSampleData();
    const graph = buildNetworkGraph(data, 'p-mara', {
      ...defaultFilters,
      pending: false,
      declined: false,
    });
    expect(graph.edges.some((edge) => edge.type === 'relationship-pending')).toBe(false);
    expect(graph.nodes.some((node) => node.id === 'p-tomas')).toBe(false);
    expect(graph.edges.some((edge) => edge.type === 'relationship-active')).toBe(true);
  });

  it('shows inter-community agreements but never implies knowledge access', () => {
    const data = createSampleData();
    const graph = buildNetworkGraph(data, 'p-mara');
    expect(graph.edges.some((edge) => edge.type === 'agreement-proposed')).toBe(true);
    const bramble = graph.nodes.find((node) => node.id === 'c-bramble');
    expect(bramble).toBeDefined();
    // Being adjacent to Bramble does not grant group knowledge (agreement declined).
    expect(
      graph.nodes.filter((node) => node.type === 'community').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('computes structure without popularity or ranking data', () => {
    const data = createSampleData();
    const graph = buildNetworkGraph(data, 'p-mara');
    expect(graph.metrics.nodes).toBeGreaterThan(0);
    expect(graph.metrics.edges).toBeGreaterThan(0);
    expect(graph.metrics.density).toBeGreaterThanOrEqual(0);
    expect(graph.metrics.density).toBeLessThanOrEqual(100);
    expect(graph.metrics.components).toBeGreaterThanOrEqual(1);
    expect('popularity' in graph.metrics).toBe(false);
    expect('trust' in graph.metrics).toBe(false);
  });

  it('changes with the acting identity because visibility changes', () => {
    const data = createSampleData();
    const mara = buildNetworkGraph(data, 'p-mara');
    const sam = buildNetworkGraph(data, 'p-sam');
    expect(mara.nodes.some((node) => node.id === 'c-hollowcombe')).toBe(true);
    expect(mara.nodes.some((node) => node.id === 'p-idris')).toBe(true);
    expect(sam.edges.some((edge) => edge.target === 'p-idris' || edge.source === 'p-idris')).toBe(
      false,
    );
    expect(sam.nodes.some((node) => node.id === 'p-idris')).toBe(false);
    expect(sam.nodes.some((node) => node.id === 'p-ilse')).toBe(false);
    // Willowbank can appear only as the other party to a proposed inter-community
    // agreement, never with its members or internal relationships.
    expect(sam.nodes.some((node) => node.id === 'c-willowbank')).toBe(true);
    expect(sam.edges.some((edge) => edge.type === 'agreement-proposed')).toBe(true);
  });
});
