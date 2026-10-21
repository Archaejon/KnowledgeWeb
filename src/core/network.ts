/**
 * Consent-aware network graph model.
 *
 * Only relationships the acting identity is party to are drawn; other people's
 * bilateral edges are never exposed. Node position and size carry no meaning
 * about trust, authority, popularity or knowledge quality.
 */
import { interAgreementStatus, membershipFor, relationshipFor } from './consent';
import type { NodeData, PersonRelationship } from './types';

export type GraphNodeType = 'self' | 'person' | 'community' | 'project';

export type GraphEdgeType =
  | 'relationship-active'
  | 'relationship-pending'
  | 'relationship-declined'
  | 'membership'
  | 'agreement-active'
  | 'agreement-proposed'
  | 'project';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  detail?: string;
  communityId?: string;
  status?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  label: string;
}

export interface NetworkFilters {
  active: boolean;
  pending: boolean;
  declined: boolean;
  communityId: string;
  locality: string;
  projectId: string;
  showMemberships: boolean;
  showProjects: boolean;
  showAgreements: boolean;
  showDensity: boolean;
}

export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: { communityId: string; nodeIds: string[] }[];
  metrics: {
    nodes: number;
    edges: number;
    density: number;
    components: number;
    isolated: number;
    activeRelationships: number;
    pendingInvitations: number;
    communitiesWithBridges: number;
  };
}

export const defaultFilters: NetworkFilters = {
  active: true,
  pending: true,
  declined: true,
  communityId: 'all',
  locality: 'all',
  projectId: 'all',
  showMemberships: true,
  showProjects: true,
  showAgreements: true,
  showDensity: false,
};

function directRelationships(db: NodeData, viewerId: string): PersonRelationship[] {
  const result: PersonRelationship[] = [];
  for (const relationship of db.relationships) {
    if (relationship.aId !== viewerId && relationship.bId !== viewerId) continue;
    const otherId = relationship.aId === viewerId ? relationship.bId : relationship.aId;
    // Only the current record per pair, so older revoked history does not
    // reappear as a live edge.
    if (relationshipFor(db, viewerId, otherId)?.id === relationship.id) result.push(relationship);
  }
  return result;
}

export function buildNetworkGraph(
  db: NodeData,
  viewerId: string,
  filters: NetworkFilters = defaultFilters,
): NetworkGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const self = db.people.find((p) => p.id === viewerId);
  if (!self) {
    return {
      nodes: [],
      edges: [],
      clusters: [],
      metrics: {
        nodes: 0,
        edges: 0,
        density: 0,
        components: 0,
        isolated: 0,
        activeRelationships: 0,
        pendingInvitations: 0,
        communitiesWithBridges: 0,
      },
    };
  }

  nodes.set(self.id, {
    id: self.id,
    type: 'self',
    label: self.name,
    detail: 'You, on this node',
  });

  const relationships = directRelationships(db, viewerId);
  const statusEnabled = { active: filters.active, pending: filters.pending, declined: filters.declined };

  for (const rel of relationships) {
    if (!statusEnabled[rel.status as 'active' | 'pending' | 'declined']) continue;
    const otherId = rel.aId === viewerId ? rel.bId : rel.aId;
    const other = db.people.find((p) => p.id === otherId);
    if (!other) continue;
    if (filters.locality !== 'all' && other.locality !== filters.locality) continue;
    nodes.set(other.id, {
      id: other.id,
      type: 'person',
      label: other.name,
      detail: other.locality,
      status: rel.status,
    });
    edges.push({
      id: `e-${rel.id}`,
      source: viewerId,
      target: other.id,
      type:
        rel.status === 'active'
          ? 'relationship-active'
          : rel.status === 'pending'
            ? 'relationship-pending'
            : 'relationship-declined',
      label:
        rel.status === 'active'
          ? 'Active bilateral relationship'
          : rel.status === 'pending'
            ? 'Pending invitation — no access'
            : 'Declined invitation — no access',
    });
  }

  const viewerCommunities = db.communities.filter(
    (c) => membershipFor(db, c.id, viewerId)?.status === 'active',
  );

  for (const community of viewerCommunities) {
    if (filters.communityId !== 'all' && filters.communityId !== community.id) continue;
    if (filters.locality !== 'all' && community.locality !== filters.locality) continue;
    nodes.set(community.id, {
      id: community.id,
      type: 'community',
      label: community.name,
      detail: community.locality,
      communityId: community.id,
      status: membershipFor(db, community.id, viewerId)?.role,
    });

    for (const member of community.members) {
      if (member.status !== 'active') continue;
      const person = db.people.find((p) => p.id === member.personId);
      if (!person) continue;
      const direct = relationships.some(
        (r) =>
          r.status !== 'revoked' && (r.aId === person.id || r.bId === person.id),
      );
      const directoryConsent = person.directoryOptIn || person.id === viewerId;
      if (!directoryConsent && !direct) continue;
      if (filters.locality !== 'all' && person.locality !== filters.locality) continue;
      nodes.set(person.id, {
        id: person.id,
        type: person.id === viewerId ? 'self' : 'person',
        label: person.name,
        detail: person.locality,
      });
      if (filters.showMemberships) {
        edges.push({
          id: `mem-${community.id}-${person.id}`,
          source: community.id,
          target: person.id,
          type: 'membership',
          label: `Member of ${community.name}`,
        });
      }
    }
    if (filters.showProjects) {
      for (const project of db.projects.filter((p) => p.communityId === community.id)) {
        if (filters.projectId !== 'all' && filters.projectId !== project.id) continue;
        nodes.set(project.id, {
          id: project.id,
          type: 'project',
          label: project.title,
          detail: project.status,
          communityId: community.id,
        });
        edges.push({
          id: `proj-${project.id}`,
          source: community.id,
          target: project.id,
          type: 'project',
          label: 'Project of this community',
        });
      }
    }
  }

  if (filters.showAgreements) {
    for (const agreement of db.interCommunityAgreements) {
      if (agreement.withdrawnAt) continue;
      const viewerParty = agreement.parties.find(
        (p) => membershipFor(db, p.communityId, viewerId)?.status === 'active',
      );
      if (!viewerParty) continue;
      const status = interAgreementStatus(agreement);
      if (status === 'declined' || status === 'withdrawn') continue;
      for (const party of agreement.parties) {
        if (party.communityId === viewerParty.communityId) continue;
        const otherCommunity = db.communities.find((c) => c.id === party.communityId);
        if (!otherCommunity) continue;
        if (filters.communityId !== 'all' && filters.communityId !== otherCommunity.id) continue;
        if (filters.locality !== 'all' && otherCommunity.locality !== filters.locality) continue;
        if (!nodes.has(otherCommunity.id)) {
          nodes.set(otherCommunity.id, {
            id: otherCommunity.id,
            type: 'community',
            label: otherCommunity.name,
            detail: otherCommunity.locality,
            communityId: otherCommunity.id,
            status: 'external',
          });
        }
        edges.push({
          id: `ia-${agreement.id}-${otherCommunity.id}`,
          source: viewerParty.communityId,
          target: otherCommunity.id,
          type: status === 'active' ? 'agreement-active' : 'agreement-proposed',
          label:
            status === 'active'
              ? `Inter-community agreement: ${agreement.title}`
              : `Proposed inter-community agreement: ${agreement.title}`,
        });
      }
    }
  }

  // Drop membership edges to nodes that were filtered out.
  const nodeIds = new Set(nodes.keys());
  const finalEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  const degree = new Map<string, number>();
  for (const edge of finalEdges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  // Connected components over the displayed structure.
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of finalEdges) {
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  const seen = new Set<string>();
  let components = 0;
  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    components += 1;
    const stack = [id];
    while (stack.length) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of adjacency.get(current) ?? []) stack.push(next);
    }
  }

  const clusters: { communityId: string; nodeIds: string[] }[] = [];
  for (const community of viewerCommunities) {
    if (!nodeIds.has(community.id)) continue;
    const memberIds = community.members
      .filter((m) => m.status === 'active' && nodeIds.has(m.personId))
      .map((m) => m.personId);
    const projectIds = db.projects
      .filter((p) => p.communityId === community.id && nodeIds.has(p.id))
      .map((p) => p.id);
    clusters.push({ communityId: community.id, nodeIds: [community.id, ...memberIds, ...projectIds] });
  }

  const nodeCount = nodeIds.size;
  const possible = (nodeCount * (nodeCount - 1)) / 2;
  const bridges = new Set(
    finalEdges
      .filter((e) => e.type === 'agreement-active' || e.type === 'agreement-proposed')
      .map((e) => e.id),
  ).size;

  return {
    nodes: Array.from(nodes.values()),
    edges: finalEdges,
    clusters,
    metrics: {
      nodes: nodeCount,
      edges: finalEdges.length,
      density: possible > 0 ? Math.round((finalEdges.length / possible) * 1000) / 10 : 0,
      components,
      isolated: Array.from(nodeIds).filter((id) => (degree.get(id) ?? 0) === 0).length,
      activeRelationships: finalEdges.filter((e) => e.type === 'relationship-active').length,
      pendingInvitations: finalEdges.filter((e) => e.type === 'relationship-pending').length,
      communitiesWithBridges: bridges,
    },
  };
}

/** Short explanation of what an edge means, used by the inspector. */
export function edgeExplanation(type: GraphEdgeType): string {
  switch (type) {
    case 'relationship-active':
      return 'Both people explicitly accepted. Each can read all knowledge the other marked relationship-shared.';
    case 'relationship-pending':
      return 'An invitation exists as a record. It grants no access in either direction until explicitly accepted.';
    case 'relationship-declined':
      return 'An invitation was declined. No relationship, no access. It remains visible here for transparency.';
    case 'membership':
      return 'Membership of a community. On its own it does not grant access to group-shared knowledge.';
    case 'agreement-active':
      return 'An explicit agreement between two independent communities. Terms are limited to what is written; no automatic federation.';
    case 'agreement-proposed':
      return 'One community has accepted, the other has not. Nothing is active until every party accepts.';
    case 'project':
      return 'A community project. Links to knowledge are filtered by the same access rules as everything else.';
  }
}

export function edgeLabel(type: GraphEdgeType): string {
  switch (type) {
    case 'relationship-active':
      return 'Active relationship';
    case 'relationship-pending':
      return 'Pending invitation';
    case 'relationship-declined':
      return 'Declined';
    case 'membership':
      return 'Community membership';
    case 'agreement-active':
      return 'Inter-community agreement';
    case 'agreement-proposed':
      return 'Proposed agreement';
    case 'project':
      return 'Project';
  }
}
