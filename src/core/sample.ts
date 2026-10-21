/**
 * Fictional demonstration data for the prototype. Every record is labelled as
 * sample data in the interface. Places, people and measurements are invented.
 */
import { daysAgo, daysFromNow, isoNow } from './dates';
import { SCHEMA_VERSION } from './types';
import type {
  Community,
  ConsentEvent,
  Gathering,
  GroupAgreement,
  InterCommunityAgreement,
  KnowledgeRecord,
  NodeData,
  NodeSettings,
  Observation,
  Person,
  PersonRelationship,
  Place,
  Project,
} from './types';

const people: Person[] = [
  {
    id: 'p-mara',
    name: 'Mara Ellery',
    handle: '@mara',
    nodeLabel: 'willowbank-mara',
    pronouns: 'she/her',
    locality: 'Hollowcombe',
    bio: 'Orchard keeper and facilitator. Helps hold the Willowbank allotment stewards together.',
    skills: ['orchard care', 'facilitation', 'seed saving'],
    keyFingerprint: '4F2A 91C7 0DB3 · simulated',
    joinedAt: daysAgo(420),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-idris',
    name: 'Idris Vale',
    handle: '@idris',
    nodeLabel: 'idris-hollow',
    pronouns: 'he/him',
    locality: 'Hollowcombe',
    bio: 'Earthworks and water. Digs a lot of ponds, measures a lot of levels.',
    skills: ['water', 'earthworks', 'grafting'],
    keyFingerprint: 'A71E 33B8 F204 · simulated',
    joinedAt: daysAgo(390),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-nia',
    name: 'Nia Okonkwo',
    handle: '@nia',
    nodeLabel: 'nia-willowbank',
    pronouns: 'she/her',
    locality: 'Hollowcombe',
    bio: 'Seed saver, woodworker, keeper of the tool shed keys.',
    skills: ['seed saving', 'woodwork', 'tool maintenance'],
    keyFingerprint: 'C109 8D44 5E77 · simulated',
    joinedAt: daysAgo(365),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-tomas',
    name: 'Tomas Reyes',
    handle: '@tomas',
    nodeLabel: 'tomas-mill',
    pronouns: 'they/them',
    locality: 'Hollowcombe',
    bio: 'Repairs tools and bicycles from a workshop behind the old mill.',
    skills: ['tool repair', 'metalwork', 'bicycle mechanics'],
    keyFingerprint: '7BC0 E6A1 92D4 · simulated',
    joinedAt: daysAgo(96),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-ilse',
    name: 'Ilse Brandt',
    handle: '@ilse',
    nodeLabel: 'bramble-ilse',
    pronouns: 'she/her',
    locality: 'Bramble Creek',
    bio: 'Hydrologist and careful dissenter. Keeps her field data close until the purpose is clear.',
    skills: ['hydrology', 'field survey', 'data analysis'],
    keyFingerprint: 'E4B2 71F0 3C6A · simulated',
    joinedAt: daysAgo(310),
    directoryOptIn: false,
    isSample: true,
  },
  {
    id: 'p-owen',
    name: 'Owen Larch',
    handle: '@owen',
    nodeLabel: 'owen-bramble',
    pronouns: 'he/him',
    locality: 'Bramble Creek',
    bio: 'Hedge layer, cider maker, and steward of the Bramble Creek restoration circle.',
    skills: ['hedge laying', 'cider', 'scything'],
    keyFingerprint: '0D93 B7E8 44A1 · simulated',
    joinedAt: daysAgo(300),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-priya',
    name: 'Priya Nair',
    handle: '@priya',
    nodeLabel: 'priya-bramble',
    pronouns: 'she/her',
    locality: 'Bramble Creek',
    bio: 'Oral historian. Records the people and practices around the creek.',
    skills: ['oral history', 'audio recording', 'archiving'],
    keyFingerprint: '6A17 C3D9 20EF · simulated',
    joinedAt: daysAgo(250),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-sam',
    name: 'Sam Holt',
    handle: '@sam',
    nodeLabel: 'sam-hollowcombe',
    pronouns: 'they/them',
    locality: 'Hollowcombe',
    bio: 'Fungi obsessive, study circle convener, amateur microscope owner.',
    skills: ['fungi', 'field recording', 'teaching'],
    keyFingerprint: 'B5E8 402C 7A19 · simulated',
    joinedAt: daysAgo(205),
    directoryOptIn: true,
    isSample: true,
  },
  {
    id: 'p-june',
    name: 'June Alder',
    handle: '@june',
    nodeLabel: 'june-orchard',
    pronouns: 'she/her',
    locality: 'Hollowcombe',
    bio: 'Beekeeper and orchard volunteer. Prefers to keep her details offline.',
    skills: ['beekeeping', 'pruning'],
    keyFingerprint: '19FA 6C52 E308 · simulated',
    joinedAt: daysAgo(180),
    directoryOptIn: false,
    isSample: true,
  },
];

const communities: Community[] = [
  {
    id: 'c-willowbank',
    name: 'Willowbank Allotment Stewards',
    description:
      'The stewards of a 14-plot allotment site on the edge of Hollowcombe. We share tools, water, seed and the work of keeping the ground healthy.',
    purpose: 'practical-work',
    principles: [
      'Work days are shared labour; everyone eats together afterwards.',
      'Water is measured before it is used.',
      'No one is named in a public record without asking first.',
    ],
    locality: 'Hollowcombe',
    geographicArea: 'Willowbank allotment site and the lower orchard',
    createdAt: daysAgo(400),
    createdBy: 'p-mara',
    joinPolicy: 'request',
    advertiseDirectory: false,
    members: [
      { personId: 'p-mara', role: 'steward', status: 'active', joinedAt: daysAgo(400) },
      { personId: 'p-idris', role: 'steward', status: 'active', joinedAt: daysAgo(390) },
      { personId: 'p-nia', role: 'member', status: 'active', joinedAt: daysAgo(365) },
      { personId: 'p-june', role: 'member', status: 'active', joinedAt: daysAgo(180) },
    ],
    isSample: true,
  },
  {
    id: 'c-bramble',
    name: 'Bramble Creek Restoration Circle',
    description:
      'Landowners, residents and volunteers working on bank stabilisation, water quality and habitat along a one-kilometre stretch of Bramble Creek.',
    purpose: 'regeneration',
    principles: [
      'The creek is the client; decisions are tested against its health.',
      'Consent is revocable and dissent is recorded, not smoothed over.',
      'Field data belongs first to the person who gathered it.',
    ],
    locality: 'Bramble Creek',
    geographicArea: 'Bramble Creek from the ford to the lower meadow',
    createdAt: daysAgo(330),
    createdBy: 'p-ilse',
    joinPolicy: 'request',
    advertiseDirectory: false,
    members: [
      { personId: 'p-ilse', role: 'steward', status: 'active', joinedAt: daysAgo(330) },
      { personId: 'p-owen', role: 'steward', status: 'active', joinedAt: daysAgo(300) },
      { personId: 'p-priya', role: 'member', status: 'active', joinedAt: daysAgo(250) },
      { personId: 'p-mara', role: 'member', status: 'active', joinedAt: daysAgo(120) },
    ],
    isSample: true,
  },
  {
    id: 'c-hollowcombe',
    name: 'Hollowcombe Study Circle',
    description:
      'A self-organising study circle for ecology, soil and local history. We meet monthly, read one thing properly, and go outside.',
    purpose: 'study',
    principles: [
      'Anyone can propose a topic; whoever proposes facilitates it.',
      'Notes are shared with the circle unless the speaker asks otherwise.',
      'Disagreement is part of the curriculum.',
    ],
    locality: 'Hollowcombe',
    geographicArea: 'Hollowcombe village hall and surrounding lanes',
    createdAt: daysAgo(210),
    createdBy: 'p-sam',
    joinPolicy: 'open',
    advertiseDirectory: true,
    members: [
      { personId: 'p-sam', role: 'steward', status: 'active', joinedAt: daysAgo(210) },
      { personId: 'p-mara', role: 'member', status: 'active', joinedAt: daysAgo(160) },
      { personId: 'p-june', role: 'member', status: 'active', joinedAt: daysAgo(150) },
    ],
    isSample: true,
  },
];

const relationships: PersonRelationship[] = [
  {
    id: 'rel-mara-idris',
    aId: 'p-mara',
    bId: 'p-idris',
    initiatedBy: 'p-mara',
    status: 'active',
    proposedAt: daysAgo(210, 9),
    respondedAt: daysAgo(209, 18),
    message: 'We share a lot of water data already. Shall we make it a proper exchange?',
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-mara-nia',
    aId: 'p-mara',
    bId: 'p-nia',
    initiatedBy: 'p-nia',
    status: 'active',
    proposedAt: daysAgo(150, 11),
    respondedAt: daysAgo(149, 8),
    message: 'For seed and tool notes.',
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-tomas-mara',
    aId: 'p-tomas',
    bId: 'p-mara',
    initiatedBy: 'p-tomas',
    status: 'pending',
    proposedAt: daysAgo(2, 16),
    message:
      'I have a repair guide for the old water pump that might be useful to you. I would like to exchange knowledge directly.',
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-mara-owen',
    aId: 'p-mara',
    bId: 'p-owen',
    initiatedBy: 'p-mara',
    status: 'declined',
    proposedAt: daysAgo(85, 9),
    respondedAt: daysAgo(82, 20),
    message: 'Would you like to exchange restoration notes directly?',
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-ilse-mara',
    aId: 'p-ilse',
    bId: 'p-mara',
    initiatedBy: 'p-ilse',
    status: 'revoked',
    proposedAt: daysAgo(240, 10),
    respondedAt: daysAgo(239, 10),
    revokedAt: daysAgo(30, 13),
    revokedBy: 'p-ilse',
    message: 'For the creek survey, initially.',
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-nia-owen',
    aId: 'p-nia',
    bId: 'p-owen',
    initiatedBy: 'p-owen',
    status: 'active',
    proposedAt: daysAgo(110, 9),
    respondedAt: daysAgo(110, 19),
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-idris-priya',
    aId: 'p-idris',
    bId: 'p-priya',
    initiatedBy: 'p-idris',
    status: 'pending',
    proposedAt: daysAgo(6, 12),
    cachedCopiesHeld: false,
  },
  {
    id: 'rel-ilse-priya',
    aId: 'p-ilse',
    bId: 'p-priya',
    initiatedBy: 'p-priya',
    status: 'active',
    proposedAt: daysAgo(200, 9),
    respondedAt: daysAgo(199, 15),
    cachedCopiesHeld: false,
  },
];

const groupAgreements: GroupAgreement[] = [
  {
    id: 'ga-willowbank',
    communityId: 'c-willowbank',
    title: 'Willowbank shared working knowledge',
    description:
      'All four stewards share working notes, water readings and meeting records within this agreement. Each person chooses which records are group-shared. Revoking consent closes the agreement for everyone; it does not quietly shrink to the remaining members.',
    proposedBy: 'p-mara',
    createdAt: daysAgo(300),
    responses: [
      { personId: 'p-mara', state: 'accepted', at: daysAgo(300) },
      { personId: 'p-idris', state: 'accepted', at: daysAgo(299) },
      { personId: 'p-nia', state: 'accepted', at: daysAgo(298) },
      { personId: 'p-june', state: 'accepted', at: daysAgo(175) },
    ],
  },
  {
    id: 'ga-bramble',
    communityId: 'c-bramble',
    title: 'Bramble Creek field data pool',
    description:
      'A proposed agreement to share field observations across the restoration circle. Ilse declined: her hydrological survey is gathered under a separate research agreement and cannot be pooled here. The agreement did not activate. Bilateral exchanges remain possible.',
    proposedBy: 'p-priya',
    createdAt: daysAgo(45),
    responses: [
      { personId: 'p-priya', state: 'accepted', at: daysAgo(45) },
      { personId: 'p-owen', state: 'accepted', at: daysAgo(43) },
      { personId: 'p-mara', state: 'accepted', at: daysAgo(41) },
      { personId: 'p-ilse', state: 'declined', at: daysAgo(39), note: 'Not this dataset.' },
    ],
  },
  {
    id: 'ga-hollowcombe',
    communityId: 'c-hollowcombe',
    title: 'Study circle notes agreement',
    description:
      'Meeting notes and reading lists can be shared with everyone in the circle. Personal reflections stay private.',
    proposedBy: 'p-sam',
    createdAt: daysAgo(155),
    responses: [
      { personId: 'p-sam', state: 'accepted', at: daysAgo(155) },
      { personId: 'p-mara', state: 'accepted', at: daysAgo(152) },
      { personId: 'p-june', state: 'accepted', at: daysAgo(149) },
    ],
  },
];

const interCommunityAgreements: InterCommunityAgreement[] = [
  {
    id: 'ia-tool-library',
    title: 'Shared tool library and cider press',
    terms:
      'Willowbank and Bramble Creek lend tools to each other for up to 28 days. Borrowers record the condition on return. No member lists, field data or knowledge records are exchanged under this agreement; it covers physical equipment only.',
    proposedBy: 'p-idris',
    createdAt: daysAgo(18),
    parties: [
      {
        communityId: 'c-willowbank',
        state: 'accepted',
        decidedBy: 'p-mara',
        decidedAt: daysAgo(14),
      },
      { communityId: 'c-bramble', state: 'pending' },
    ],
  },
  {
    id: 'ia-seed-archive',
    title: 'Seed and reading exchange (proposed)',
    terms:
      'An annual seed swap and a shared reading list. Explicitly excludes access to either community’s internal knowledge collections. Each community nominates what to publish publicly.',
    proposedBy: 'p-sam',
    createdAt: daysAgo(9),
    parties: [
      { communityId: 'c-hollowcombe', state: 'accepted', decidedBy: 'p-sam', decidedAt: daysAgo(8) },
      { communityId: 'c-willowbank', state: 'pending' },
    ],
  },
];

const places: Place[] = [
  {
    id: 'pl-wb14',
    ownerId: 'p-idris',
    name: 'Willowbank plot 14 and swale',
    locality: 'Hollowcombe',
    lat: 51.0912,
    lng: -3.4421,
    coordinatePolicy: 'community',
    communityId: 'c-willowbank',
    note: 'Reading point is the dip above the swale, marked with a hazel stake.',
    isSample: true,
  },
  {
    id: 'pl-orchard',
    ownerId: 'p-june',
    name: 'Hollowcombe community orchard',
    locality: 'Hollowcombe',
    lat: 51.0884,
    lng: -3.4475,
    coordinatePolicy: 'open',
    note: 'Public orchard; gate open during daylight.',
    isSample: true,
  },
  {
    id: 'pl-bramble-bend',
    ownerId: 'p-ilse',
    name: 'Bramble Creek — lower bend',
    locality: 'Bramble Creek',
    lat: 51.1021,
    lng: -3.4612,
    coordinatePolicy: 'community',
    communityId: 'c-bramble',
    note: 'Erosion pins are on the outside of the bend, 4 m apart.',
    isSample: true,
  },
  {
    id: 'pl-orchid-bank',
    ownerId: 'p-ilse',
    name: 'Bramble Creek — orchid bank',
    locality: 'Bramble Creek',
    lat: 51.1033,
    lng: -3.4598,
    coordinatePolicy: 'owner-only',
    communityId: 'c-bramble',
    note: 'Sensitive site. Precise location withheld from everyone except the observer.',
    isSample: true,
  },
  {
    id: 'pl-pond',
    ownerId: 'p-sam',
    name: 'Hollowcombe village pond',
    locality: 'Hollowcombe',
    lat: 51.0869,
    lng: -3.4402,
    coordinatePolicy: 'open',
    communityId: 'c-hollowcombe',
    note: 'Survey from the north bank; do not enter the reed bed.',
    isSample: true,
  },
  {
    id: 'pl-village-hall',
    ownerId: 'p-june',
    name: 'Hollowcombe village hall',
    locality: 'Hollowcombe',
    lat: 51.0874,
    lng: -3.4451,
    coordinatePolicy: 'open',
    communityId: 'c-hollowcombe',
    note: 'Main hall and kitchen. Use the step-free side entrance after dark.',
    nodal: {
      kind: 'community-centre',
      description:
        'The hall is the fallback room for study circles, winter meetings and shared meals. It holds the community bookshelf and the noticeboard for gatherings that are not on the node.',
      accessNotes:
        'Book through June. Step-free side entrance, hearing loop, kitchen and stacked chairs. No fixed fee; leave a donation for heating.',
      visibility: 'public',
      themes: ['study circles', 'shared meals', 'village meetings'],
      capacity: 60,
      contactId: 'p-june',
    },
    isSample: true,
  },
  {
    id: 'pl-field-shelter',
    ownerId: 'p-ilse',
    name: 'Bramble Creek field shelter',
    locality: 'Bramble Creek',
    lat: 51.1011,
    lng: -3.4602,
    coordinatePolicy: 'community',
    communityId: 'c-bramble',
    note: 'Three-sided timber shelter above the ford; the track is muddy after rain.',
    nodal: {
      kind: 'gathering-spot',
      description:
        'A simple shelter used after fieldwork and for small reading groups in dry weather. Notes and finds are laid out on the bench before anyone walks back.',
      accessNotes:
        'Park at the ford lay-by, then a ten-minute walk. No toilet. Bring a torch and a camp chair. Leave the shelter as you found it.',
      visibility: 'community',
      themes: ['field notes', 'fungi', 'oral history'],
      capacity: 12,
      contactId: 'p-ilse',
    },
    isSample: true,
  },
  {
    id: 'pl-tool-barn',
    ownerId: 'p-idris',
    name: 'Willowbank tool barn',
    locality: 'Hollowcombe',
    lat: 51.0918,
    lng: -3.4436,
    coordinatePolicy: 'community',
    communityId: 'c-willowbank',
    note: 'The long barn behind plot 3. Tools are logged in the inventory before they leave.',
    nodal: {
      kind: 'workshop',
      description:
        'A working repair space and tool store. The winter maintenance rota meets here, and broken tools are set aside for the next repair session rather than thrown away.',
      accessNotes:
        'Open on work-party days and by arrangement with Idris. Bench space, vice and hand tools. Bring your own gloves; children must be accompanied.',
      visibility: 'community',
      themes: ['repair', 'scything', 'seed saving'],
      capacity: 10,
      contactId: 'p-idris',
    },
    isSample: true,
  },
  {
    id: 'pl-common-house',
    ownerId: 'p-nia',
    name: 'Fernhill common house',
    locality: 'Hollowcombe',
    lat: 51.094,
    lng: -3.449,
    coordinatePolicy: 'community',
    communityId: 'c-hollowcombe',
    note: 'Shared common house for the co-housing group; please arrange visits first.',
    nodal: {
      kind: 'commune',
      description:
        'The common house of a small co-housing group. It hosts the mutual-aid rota, conflict-practice sessions and occasional open suppers for neighbouring projects.',
      accessNotes:
        'Visits by arrangement only. Step-free ground floor, shared kitchen, no overnight hosting without a resident sponsor. Quiet after 22:00.',
      visibility: 'community',
      themes: ['co-housing', 'mutual aid', 'conflict practice'],
      capacity: 25,
      contactId: 'p-nia',
    },
    isSample: true,
  },
];

const projects: Project[] = [
  {
    id: 'pr-retention',
    communityId: 'c-willowbank',
    title: 'Willowbank water retention trial',
    summary:
      'Slow the winter runoff from the top of the site and keep more water in the soil through the dry months.',
    objective:
      'Raise the summer water table at plot 14 by at least 10 cm within two seasons without flooding neighbouring plots.',
    outcomes: '',
    status: 'active',
    leadId: 'p-idris',
    participants: ['p-mara', 'p-nia', 'p-june'],
    startDate: daysAgo(190),
    targetDate: daysFromNow(120),
    tasks: [
      {
        id: 't-swale',
        title: 'Finish the second swale and mulch the bank',
        detail: 'Two barrow-loads of chipped hedge per metre. Keep the overflow clear of plot 12.',
        assigneeId: 'p-idris',
        dueDate: daysFromNow(4),
        status: 'doing',
        createdBy: 'p-idris',
        createdAt: daysAgo(60),
      },
      {
        id: 't-wells',
        title: 'Take monthly dip-well readings',
        assigneeId: 'p-mara',
        dueDate: daysFromNow(12),
        status: 'todo',
        createdBy: 'p-idris',
        createdAt: daysAgo(55),
      },
      {
        id: 't-gauge',
        title: 'Repair the rain gauge bracket',
        assigneeId: 'p-nia',
        dueDate: daysAgo(6),
        status: 'blocked',
        detail: 'Needs a new stainless bolt; Tomas may have one.',
        createdBy: 'p-nia',
        createdAt: daysAgo(30),
      },
      {
        id: 't-mulch',
        title: 'Collect mulch from the hedge work party',
        assigneeId: 'p-june',
        dueDate: daysAgo(18),
        status: 'done',
        createdBy: 'p-idris',
        createdAt: daysAgo(50),
      },
    ],
    resources: [
      { id: 'r-1', name: 'Borrowed level and staff', note: 'From Bramble Creek, due back in November.', status: 'secured' },
      { id: 'r-2', name: 'Stainless bolts (M8)', note: 'Two needed for the gauge bracket.', status: 'needed' },
    ],
    knowledgeIds: ['k-waterlog', 'k-swale', 'k-tools'],
    lessons: [
      'Cutting the swale in April was too late for the spring flow; aim for February.',
    ],
    createdAt: daysAgo(190),
    isSample: true,
  },
  {
    id: 'pr-bank',
    communityId: 'c-bramble',
    title: 'Bramble Creek bank stabilisation',
    summary:
      'Reduce erosion at the lower bend using woven hazel, native planting and a fenced buffer.',
    objective:
      'Stabilise 40 m of eroding bank and record water levels monthly for a year before and after intervention.',
    outcomes: '',
    status: 'active',
    leadId: 'p-ilse',
    participants: ['p-owen', 'p-priya', 'p-mara'],
    startDate: daysAgo(130),
    targetDate: daysFromNow(240),
    tasks: [
      {
        id: 't-pins',
        title: 'Re-read the erosion pins after high water',
        assigneeId: 'p-ilse',
        dueDate: daysFromNow(2),
        status: 'todo',
        createdBy: 'p-ilse',
        createdAt: daysAgo(20),
      },
      {
        id: 't-hazel',
        title: 'Cut and soak hazel for the woven revetment',
        assigneeId: 'p-owen',
        dueDate: daysFromNow(9),
        status: 'doing',
        createdBy: 'p-owen',
        createdAt: daysAgo(35),
      },
      {
        id: 't-interviews',
        title: 'Record three more creek recollections',
        assigneeId: 'p-priya',
        dueDate: daysFromNow(30),
        status: 'todo',
        detail: 'Ask about the 1998 flood and the old ford crossing.',
        createdBy: 'p-priya',
        createdAt: daysAgo(15),
      },
    ],
    resources: [
      { id: 'r-3', name: 'Chestnut stakes (60)', note: 'Cut from the coppice with owner permission.', status: 'secured' },
      { id: 'r-4', name: 'Live willow whips', note: 'Need 200 before the end of November.', status: 'needed' },
    ],
    knowledgeIds: ['k-erosion', 'k-oral', 'k-archive-guide'],
    lessons: [],
    createdAt: daysAgo(130),
    isSample: true,
  },
  {
    id: 'pr-pond',
    communityId: 'c-hollowcombe',
    title: 'Hollowcombe pond survey',
    summary:
      'A year of simple, repeatable observations of the village pond, run by the study circle.',
    objective:
      'Establish a baseline for water temperature, invertebrate counts and marginal plant cover, and publish an accessible summary.',
    outcomes:
      'Baseline now covers five months. Two volunteers can complete the full survey in 40 minutes.',
    status: 'active',
    leadId: 'p-sam',
    participants: ['p-mara', 'p-june'],
    startDate: daysAgo(150),
    targetDate: daysFromNow(180),
    tasks: [
      {
        id: 't-count',
        title: 'Autumn invertebrate count',
        assigneeId: 'p-sam',
        dueDate: daysFromNow(7),
        status: 'todo',
        createdBy: 'p-sam',
        createdAt: daysAgo(12),
      },
      {
        id: 't-method',
        title: 'Write up the survey method so others can repeat it',
        assigneeId: 'p-mara',
        dueDate: daysFromNow(25),
        status: 'doing',
        createdBy: 'p-sam',
        createdAt: daysAgo(40),
      },
    ],
    resources: [
      { id: 'r-5', name: 'Two pond nets and trays', note: 'Stored at the village hall.', status: 'secured' },
    ],
    knowledgeIds: ['k-pond-method', 'k-reading'],
    lessons: ['Count from the north bank only; the south side disturbs the reed bed.'],
    createdAt: daysAgo(150),
    isSample: true,
  },
  {
    id: 'pr-tools',
    communityId: 'c-willowbank',
    title: 'Tool shed inventory and winter rota',
    summary: 'Label every tool, record condition, and agree a winter maintenance rota.',
    objective: 'No shared tool out of service for more than a fortnight without a named repair.',
    outcomes: 'Inventory complete; 31 tools labelled; rota agreed at the September meeting.',
    status: 'complete',
    leadId: 'p-nia',
    participants: ['p-mara'],
    startDate: daysAgo(120),
    targetDate: daysAgo(25),
    tasks: [
      {
        id: 't-inventory',
        title: 'Photograph and number every tool',
        assigneeId: 'p-nia',
        status: 'done',
        createdBy: 'p-nia',
        createdAt: daysAgo(100),
      },
      {
        id: 't-rota',
        title: 'Agree the maintenance rota',
        assigneeId: 'p-mara',
        status: 'done',
        createdBy: 'p-nia',
        createdAt: daysAgo(80),
      },
    ],
    resources: [],
    knowledgeIds: ['k-tools'],
    lessons: ['Numbering with a punch is more durable than paint.'],
    createdAt: daysAgo(120),
    isSample: true,
  },
];

const gatherings: Gathering[] = [
  {
    id: 'g-wb-meeting',
    communityId: 'c-willowbank',
    title: 'Willowbank stewards’ autumn meeting',
    kind: 'meeting',
    description:
      'Review the season, agree the winter work plan and decide how the water trial data is shared.',
    startsAt: daysAgo(38, 18),
    endsAt: daysAgo(38, 20),
    venueName: 'Plot 3 shed',
    locality: 'Hollowcombe',
    organiserId: 'p-mara',
    agenda: [
      { id: 'a-1', title: 'Water trial readings and what they suggest', minutes: 25 },
      { id: 'a-2', title: 'Tool shed rota', minutes: 15 },
      { id: 'a-3', title: 'Winter work parties', minutes: 20 },
    ],
    requirements: ['Bring a chair', 'Bring the plot 14 log book if you have it'],
    responses: [
      { personId: 'p-mara', state: 'going', at: daysAgo(50) },
      { personId: 'p-idris', state: 'going', at: daysAgo(49) },
      { personId: 'p-nia', state: 'going', at: daysAgo(48) },
      { personId: 'p-june', state: 'going', at: daysAgo(47) },
    ],
    status: 'completed',
    outcomes: {
      recordedBy: 'p-mara',
      recordedAt: daysAgo(37),
      notes:
        'Four stewards present. Idris proposed pausing new swale work until the February flow is observed. The tool rota was agreed.',
      decisions: [
        'Record group-shared water readings monthly, not weekly.',
        'Return the borrowed level to Bramble Creek before 1 November.',
      ],
      lessons: ['Meeting in the shed worked better than the hall; keep it there until spring.'],
      followUps: ['Mara to write up the reading protocol.', 'Nia to order the gauge bolts.'],
    },
    knowledgeIds: ['k-wb-notes', 'k-waterlog'],
    createdAt: daysAgo(55),
    isSample: true,
  },
  {
    id: 'g-hedge',
    communityId: 'c-willowbank',
    title: 'Hedge laying work party',
    kind: 'working-party',
    description:
      'Finish the eastern hedge and collect the brash for mulch. Lunch provided by June.',
    startsAt: daysAgo(21, 9),
    endsAt: daysAgo(21, 16),
    venueName: 'Willowbank east boundary',
    locality: 'Hollowcombe',
    organiserId: 'p-idris',
    capacity: 8,
    agenda: [
      { id: 'a-4', title: 'Safety brief and tool allocation', minutes: 15 },
      { id: 'a-5', title: 'Laying the final 12 metres', minutes: 180 },
      { id: 'a-6', title: 'Brash to mulch', minutes: 60 },
    ],
    requirements: ['Stout boots', 'Gloves', 'Bring a billhook if you have one'],
    responses: [
      { personId: 'p-idris', state: 'going', at: daysAgo(30) },
      { personId: 'p-mara', state: 'going', at: daysAgo(28) },
      { personId: 'p-nia', state: 'going', at: daysAgo(27) },
      { personId: 'p-june', state: 'maybe', at: daysAgo(26) },
    ],
    status: 'completed',
    outcomes: {
      recordedBy: 'p-idris',
      recordedAt: daysAgo(20),
      notes:
        'Six people came, including two neighbours who are not on the node. The hedge is laid and the brash is stacked by the swale.',
      decisions: ['Leave the brash to settle before chipping.'],
      lessons: ['Start earlier: we lost an hour to a frozen trailer ramp.'],
      followUps: ['Chip the brash before the pruning workshop.'],
    },
    knowledgeIds: ['k-lessons', 'k-scythe'],
    createdAt: daysAgo(35),
    isSample: true,
  },
  {
    id: 'g-pruning',
    communityId: 'c-willowbank',
    title: 'Winter pruning workshop',
    kind: 'workshop',
    description:
      'Hands-on pruning for the old apple trees, led by Idris and June. Suitable for beginners.',
    startsAt: daysFromNow(3, 10),
    endsAt: daysFromNow(3, 13),
    venueName: 'Hollowcombe community orchard',
    locality: 'Hollowcombe',
    organiserId: 'p-idris',
    capacity: 10,
    agenda: [
      { id: 'a-7', title: 'Why we prune: light, air and fruit', minutes: 20 },
      { id: 'a-8', title: 'Cutting practice on the young trees', minutes: 60 },
      { id: 'a-9', title: 'Sharpen and clean up', minutes: 15 },
    ],
    requirements: ['Bring secateurs if you have them', 'Warm clothes', 'Tea provided'],
    responses: [
      { personId: 'p-idris', state: 'going', at: daysAgo(14) },
      { personId: 'p-june', state: 'going', at: daysAgo(13) },
      { personId: 'p-mara', state: 'going', at: daysAgo(10) },
      { personId: 'p-nia', state: 'maybe', at: daysAgo(8) },
    ],
    status: 'confirmed',
    knowledgeIds: ['k-grafting'],
    createdAt: daysAgo(20),
    isSample: true,
  },
  {
    id: 'g-foray',
    communityId: 'c-bramble',
    title: 'Fungal foray along Bramble Creek',
    kind: 'fieldwork',
    description:
      'A slow walk recording what is fruiting along the creek. Identification only; nothing is harvested without the landowner present.',
    startsAt: daysFromNow(6, 9),
    endsAt: daysFromNow(6, 12),
    venueName: 'Meet at Bramble Creek ford',
    locality: 'Bramble Creek',
    organiserId: 'p-priya',
    capacity: 12,
    agenda: [
      { id: 'a-10', title: 'Safety and the no-harvest rule', minutes: 10 },
      { id: 'a-11', title: 'Walk the north bank, recording as we go', minutes: 120 },
      { id: 'a-12', title: 'Compare notes and photograph finds', minutes: 40 },
    ],
    requirements: ['Waterproof boots', 'A phone or notebook for photos', 'No collecting'],
    responses: [
      { personId: 'p-priya', state: 'going', at: daysAgo(9) },
      { personId: 'p-owen', state: 'maybe', at: daysAgo(8) },
      { personId: 'p-mara', state: 'going', at: daysAgo(5) },
      { personId: 'p-ilse', state: 'no-response' },
    ],
    status: 'planned',
    knowledgeIds: ['k-oral'],
    createdAt: daysAgo(12),
    isSample: true,
  },
  {
    id: 'g-study',
    communityId: 'c-hollowcombe',
    title: 'Study circle: the soil food web',
    kind: 'study-circle',
    description:
      'Discussing the first three chapters of Lowenfels & Lewis. Bring one thing you have observed in your own soil.',
    startsAt: daysFromNow(12, 19),
    endsAt: daysFromNow(12, 21),
    venueName: 'Hollowcombe village hall',
    locality: 'Hollowcombe',
    nodalLocationId: 'pl-village-hall',
    organiserId: 'p-sam',
    capacity: 16,
    agenda: [
      { id: 'a-13', title: 'Check-in and observations', minutes: 20 },
      { id: 'a-14', title: 'Discussion of chapters 1–3', minutes: 60 },
      { id: 'a-15', title: 'Choose next reading and facilitator', minutes: 15 },
    ],
    requirements: ['Read what you can', 'Bring a sample of soil in a jar if you like'],
    responses: [
      { personId: 'p-sam', state: 'going', at: daysAgo(7) },
      { personId: 'p-mara', state: 'maybe', at: daysAgo(6) },
      { personId: 'p-june', state: 'no-response' },
    ],
    status: 'planned',
    knowledgeIds: ['k-reading', 'k-pond-method'],
    createdAt: daysAgo(10),
    isSample: true,
  },
  {
    id: 'g-dance',
    communityId: 'c-bramble',
    title: 'Harvest barn dance',
    kind: 'event',
    description:
      'Music, soup and a dance in the barn. Cancelled after the barn floor flooded.',
    startsAt: daysAgo(60, 19),
    endsAt: daysAgo(60, 23),
    venueName: 'Lower meadow barn',
    locality: 'Bramble Creek',
    organiserId: 'p-owen',
    capacity: 60,
    agenda: [],
    requirements: ['Bring a bowl and a spoon'],
    responses: [
      { personId: 'p-owen', state: 'going', at: daysAgo(90) },
      { personId: 'p-priya', state: 'going', at: daysAgo(88) },
      { personId: 'p-nia', state: 'going', at: daysAgo(80) },
      { personId: 'p-mara', state: 'declined', at: daysAgo(70), note: 'Away that week.' },
    ],
    status: 'cancelled',
    knowledgeIds: [],
    createdAt: daysAgo(90),
    isSample: true,
  },
];

const knowledge: KnowledgeRecord[] = [
  {
    id: 'k-waterlog',
    title: 'Willowbank water table log — spring and summer 2026',
    body: `Readings from the dip well at plot 14. Depth to water, measured from the top of the well casing. Lower numbers mean more water in the ground.

• 12 April — 82 cm
• 10 May — 76 cm
• 14 June — 64 cm
• 19 July — 58 cm
• 16 August — 61 cm

The swale filled during the May storms and held water for nine days. Plot 12 stayed dry. We need a February reading before deciding whether the second swale is working or whether this is just a wet spring.`,
    authorId: 'p-idris',
    kind: 'observation',
    tags: ['water', 'soil', 'monitoring', 'willowbank'],
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    placeId: 'pl-wb14',
    createdAt: daysAgo(140, 8),
    updatedAt: daysAgo(20, 17),
    versions: [
      {
        at: daysAgo(140, 8),
        byId: 'p-idris',
        note: 'Initial readings',
        title: 'Willowbank water table log — spring 2026',
        body: 'April 82 cm, May 76 cm, June 64 cm. Method as before: dip well, top of casing.',
        scope: 'community',
      },
      {
        at: daysAgo(20, 17),
        byId: 'p-idris',
        note: 'Added July and August readings',
        title: 'Willowbank water table log — spring and summer 2026',
        body: 'April 82 cm, May 76 cm, June 64 cm, July 58 cm, August 61 cm. Swale held water for nine days after the May storms.',
        scope: 'community',
      },
    ],
    links: [{ label: 'Dip well method notes', kind: 'document', note: 'Kept in the plot 3 shed folder.' }],
    sources: ['Field measurements by Idris Vale, Willowbank plot 14'],
    attachments: [
      {
        id: 'att-sample-dipwell',
        name: 'willowbank-dipwell-2026.csv',
        mime: 'text/csv',
        size: 168,
        kind: 'file',
        addedAt: daysAgo(20, 17),
        dataUrl:
          'data:text/csv;base64,ZGF0ZSxkZXB0aF9jbSxub3RlCjIwMjYtMDQtMTIsODIsc3ByaW5nIGJhc2VsaW5lCjIwMjYtMDUtMTAsNzYsYWZ0ZXIgdGhlIE1heSBzdG9ybXMKMjAyNi0wNi0xNCw2NCwKMjAyNi0wNy0xOSw1OCxkcmllc3QgcmVhZGluZwoyMDI2LTA4LTE2LDYxLHN3YWxlIHN0aWxsIGhvbGRpbmcgd2F0ZXIK',
      },
    ],
    isSample: true,
  },
  {
    id: 'k-grafting',
    title: 'Whip-and-tongue grafting: what worked on our old apple trees',
    body: `We grafted eight scions onto the old Bramley rootstock in March. Six took.

What mattered:
1. Cut the scion and rootstock in one clean motion. A dull knife tears the cambium.
2. Match the cambium on at least one side, and keep the joint wrapped tight.
3. Seal the top of the scion; drying out is the main failure.
4. Label immediately. Two of our failures were probably mislabelled scions, not bad technique.

The two that failed were both grafted later, in early April, when the sap was already moving hard. Next year: finish before the equinox.`,
    authorId: 'p-idris',
    kind: 'guide',
    tags: ['grafting', 'orchard', 'propagation'],
    scope: 'relationship',
    projectId: 'pr-retention',
    createdAt: daysAgo(100, 9),
    updatedAt: daysAgo(100, 9),
    versions: [],
    links: [{ label: 'RHS grafting guide', url: 'https://www.rhs.org.uk/', kind: 'website' }],
    sources: ['Willowbank orchard, spring 2026'],
    isSample: true,
  },
  {
    id: 'k-boundary',
    title: 'Family land boundary — do not share',
    body: `Notes on the disputed boundary at the top of the lane, including the solicitor's reference and the dates of the two site visits.

Kept here so it is findable when needed. This is deliberately private and should not be shared through any relationship or community agreement.`,
    authorId: 'p-mara',
    kind: 'note',
    tags: ['private', 'land'],
    scope: 'private',
    createdAt: daysAgo(65, 21),
    updatedAt: daysAgo(65, 21),
    versions: [],
    links: [],
    sources: [],
    isSample: true,
  },
  {
    id: 'k-erosion',
    title: 'Bramble Creek bank erosion: walk notes, 3 October',
    body: `Walked the lower bend with Owen after the high water. Erosion pins 2 and 3 have lost 4–6 cm of bank since August. Pin 4 is stable.

The exposed root plate on the outside bend is undercut. We should not put the woven revetment directly against it until we have another month of readings; the bank may still be moving.

Photographs are in the shared field folder, not attached here.`,
    authorId: 'p-ilse',
    kind: 'observation',
    tags: ['erosion', 'hydrology', 'bramble-creek', 'field-notes'],
    scope: 'community',
    communityId: 'c-bramble',
    projectId: 'pr-bank',
    placeId: 'pl-bramble-bend',
    createdAt: daysAgo(17, 16),
    updatedAt: daysAgo(16, 9),
    versions: [],
    links: [{ label: 'Erosion pin diagram', kind: 'document', note: 'Paper copy in the field folder.' }],
    sources: ['Site walk with Owen Larch, 3 October 2026'],
    isSample: true,
  },
  {
    id: 'k-scythe',
    title: 'Scything the orchard meadow: a beginner’s checklist',
    body: `Before you start:
• Check the blade for nicks and tighten the collar.
• Peg the wire at the height you actually want the grass left.
• Clear stones, sticks and dog toys from the strip.

Cutting:
• Stand upright. Let the blade do the work; do not muscle it.
• Cut in overlapping arcs, moving into the uncut grass.
• Sharpen every 10–15 minutes with the stone in your pocket. A sharp blade is safer than a blunt one.

After:
• Rake the cuttings into a windrow and leave them a day before moving to the compost.
• Oil the blade before hanging it up.

We run this as a two-hour session with a shared lunch. It is not a race.`,
    authorId: 'p-nia',
    kind: 'guide',
    tags: ['scything', 'meadow', 'tools', 'skills'],
    scope: 'public',
    createdAt: daysAgo(200, 11),
    updatedAt: daysAgo(75, 14),
    versions: [
      {
        at: daysAgo(200, 11),
        byId: 'p-nia',
        note: 'First version',
        title: 'Scything notes',
        body: 'A short list of things to remember when scything the orchard meadow.',
        scope: 'public',
      },
    ],
    links: [],
    sources: ['Learned from Owen Larch and the Scythe Association'],
    isSample: true,
  },
  {
    id: 'k-wb-notes',
    title: 'Willowbank stewards’ meeting — 12 September',
    body: `Present: Mara, Idris, Nia, June.

1. Water trial
Idris walked us through the dip-well readings. The swale is holding water longer than last year, but we only have one season of data. Agreed: keep monthly readings, add a February reading before any decision on the second swale.

2. Tool shed
Nia finished the inventory. Thirty-one tools labelled. Rota agreed. The borrowed level goes back to Bramble Creek by 1 November.

3. Winter work
Pruning workshop confirmed for the third Sunday of October. Hedge brash to be chipped before then.

Decisions are recorded here. Anything personal stays out of the shared notes.`,
    authorId: 'p-mara',
    kind: 'meeting-note',
    tags: ['meeting', 'governance', 'willowbank'],
    scope: 'community',
    communityId: 'c-willowbank',
    gatheringId: 'g-wb-meeting',
    createdAt: daysAgo(37, 21),
    updatedAt: daysAgo(37, 21),
    versions: [],
    links: [],
    sources: ['Notes taken at the meeting by Mara Ellery'],
    isSample: true,
  },
  {
    id: 'k-oral',
    title: 'Edith’s recollections of the ford',
    body: `Transcript extract from an interview recorded with Edith M., who has lived by the creek since 1958. Published with her written permission; her full surname is withheld.

“Before the bridge, you crossed at the ford unless it had been raining for a week. The old track went down past the willows — those are gone now. When they straightened the bank in the seventies, the water came through faster and the bend started to go.

We used to cut sedge there. Not for anything grand. For the hens.”

Recording and full transcript held by Priya Nair. Published extract is public; the full recording is not.`,
    authorId: 'p-priya',
    kind: 'oral-history',
    tags: ['oral-history', 'bramble-creek', 'water', 'memory'],
    scope: 'public',
    communityId: 'c-bramble',
    projectId: 'pr-bank',
    createdAt: daysAgo(55, 10),
    updatedAt: daysAgo(55, 10),
    versions: [],
    links: [],
    sources: ['Interview with Edith M., 21 August 2026, with written consent'],
    isSample: true,
  },
  {
    id: 'k-seed',
    title: 'Broad bean seed-saving protocol (2026)',
    body: `We grow 'Crimson Flowered' and a local landrace we call Hollowcombe Longpod. They cross easily, so keep at least 200 m between varieties or bag a few plants.

1. Select from plants with strong stems and early pods, not the biggest pod.
2. Let pods dry on the plant until the seeds rattle.
3. Pick in dry weather, shell indoors, and finish drying on a tray for a fortnight.
4. Label with year, variety and plot. Store in paper, not plastic, somewhere cool.
5. Germination test in spring: ten seeds in damp cloth, count sprouts at seven days.

Our 2025 seed had 80% germination after a year in the shed. Good enough to share.`,
    authorId: 'p-nia',
    kind: 'guide',
    tags: ['seeds', 'beans', 'propagation', 'willowbank'],
    scope: 'relationship',
    createdAt: daysAgo(130, 8),
    updatedAt: daysAgo(130, 8),
    versions: [],
    links: [],
    sources: ['Willowbank seed saving notes, 2024–2026'],
    isSample: true,
  },
  {
    id: 'k-reading',
    title: 'Hollowcombe study circle — autumn reading list',
    body: `October: Teaming with Microbes (Lowenfels & Lewis), chapters 1–3.
November: Entangled Life (Sheldrake), part one. Sam will bring the microscope.
December: no reading; shared meal and planning.

We read one thing properly rather than five things badly. If a book is hard to find, borrow from the village hall cupboard; there are three copies of the Lowenfels.

Suggested by members, chosen by the circle.`,
    authorId: 'p-sam',
    kind: 'note',
    tags: ['reading', 'study-circle', 'soil', 'fungi'],
    scope: 'public',
    communityId: 'c-hollowcombe',
    createdAt: daysAgo(24, 19),
    updatedAt: daysAgo(24, 19),
    versions: [],
    links: [],
    sources: ['Agreed at the September study circle'],
    isSample: true,
  },
  {
    id: 'k-tools',
    title: 'Tool shed inventory and winter maintenance rota',
    body: `Thirty-one tools numbered with a punch and logged in the shed folder.

Winter rota:
• October — Nia: clean and oil all edge tools.
• November — Idris: check handles and replace wedges.
• December — June: sharpening station restock.
• January — Mara: review what was borrowed and not returned.

Borrowing: write it in the book, return it clean, report damage rather than hiding it. The shed key stays with Nia and Idris.`,
    authorId: 'p-nia',
    kind: 'guide',
    tags: ['tools', 'maintenance', 'willowbank'],
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-tools',
    createdAt: daysAgo(100, 12),
    updatedAt: daysAgo(26, 12),
    versions: [],
    links: [],
    sources: ['Tool shed inventory, September 2026'],
    isSample: true,
  },
  {
    id: 'k-swale',
    title: 'Swale trial design notes (first season)',
    body: `Design intentions for the plot 14 swale. This is working material, not a finished result.

• Swale depth 30 cm, width 60 cm, length 18 m, following the contour.
• Overflow set 8 cm below the top of the downslope bank, directed into the orchard strip.
• Spoil used to build a low berm, mulched with chipped hedge.
• Dip well installed 2 m below the swale.

Concerns raised: the overflow may erode the orchard path in a big storm; we have not tested that yet. Idris wants a second season of readings before extending the design.`,
    authorId: 'p-idris',
    kind: 'research',
    tags: ['water', 'swale', 'design', 'willowbank'],
    scope: 'relationship',
    projectId: 'pr-retention',
    placeId: 'pl-wb14',
    createdAt: daysAgo(120, 7),
    updatedAt: daysAgo(48, 18),
    versions: [
      {
        at: daysAgo(120, 7),
        byId: 'p-idris',
        note: 'Initial design',
        title: 'Swale design notes',
        body: 'Swale 18 m long, 30 cm deep. Dip well below it. Overflow into orchard.',
        scope: 'relationship',
      },
    ],
    links: [],
    sources: ['Survey by Idris Vale, April 2026'],
    isSample: true,
  },
  {
    id: 'k-lessons',
    title: 'What we learned laying the east hedge',
    body: `Six of us, seven hours, twelve metres of hedge. Three things worth keeping:

1. Cut the pleachers longer than you think. A short pleacher splits at the hinge.
2. Someone must own the brash. Otherwise everyone cuts and nobody clears, and the next person cannot work safely.
3. The two neighbours who joined were not on the node. We should keep a paper sign-up sheet at work parties, and ask before adding anyone's name to a shared record.

The hedge is laying well. We will know in spring how much has taken.`,
    authorId: 'p-mara',
    kind: 'lesson',
    tags: ['hedge', 'work-party', 'skills', 'willowbank'],
    scope: 'community',
    communityId: 'c-willowbank',
    gatheringId: 'g-hedge',
    createdAt: daysAgo(19, 18),
    updatedAt: daysAgo(19, 18),
    versions: [],
    links: [],
    sources: ['Hedge laying work party, 29 September 2026'],
    isSample: true,
  },
  {
    id: 'k-archive-guide',
    title: 'Oral history recording kit — borrower’s guide',
    body: `The kit lives in the Bramble Creek village hall cupboard. It contains a recorder, two microphones, spare batteries and a consent form folder.

Before recording:
• Explain what the recording will be used for, and what will stay private.
• Get written consent for any public extract. A verbal yes is not enough.
• Test levels with the person speaking, not with yourself.

After:
• Copy the files to two places the same week.
• Label with date, speaker initials and interviewer.
• Do not upload interviews to shared folders without explicit permission.`,
    authorId: 'p-priya',
    kind: 'guide',
    tags: ['oral-history', 'kit', 'consent', 'bramble-creek'],
    scope: 'community',
    communityId: 'c-bramble',
    projectId: 'pr-bank',
    createdAt: daysAgo(70, 10),
    updatedAt: daysAgo(70, 10),
    versions: [],
    links: [],
    sources: ['Bramble Creek oral history project'],
    isSample: true,
  },
  {
    id: 'k-pond-method',
    title: 'Hollowcombe pond survey method (draft)',
    body: `Repeatable, low-tech, 40 minutes.

1. Water temperature: reading 10 cm below the surface, north bank, same spot each time.
2. Invertebrates: three one-minute sweeps with the net, emptied into the white tray. Count broad groups only; photograph anything unfamiliar rather than identifying it on the spot.
3. Plant cover: estimate percentage of the margin covered by reed, rush and sedge from the north-east corner.
4. Record the weather and whether the pond is below the overflow mark.

Do not enter the reed bed. Do not survey after heavy rain; wait 48 hours.`,
    authorId: 'p-sam',
    kind: 'dataset',
    tags: ['pond', 'survey', 'method', 'hollowcombe'],
    scope: 'public',
    communityId: 'c-hollowcombe',
    projectId: 'pr-pond',
    placeId: 'pl-pond',
    createdAt: daysAgo(45, 10),
    updatedAt: daysAgo(13, 18),
    versions: [],
    links: [],
    sources: ['Adapted from the Freshwater Habitats Trust survey guidance'],
    isSample: true,
  },
];

const observations: Observation[] = [
  {
    id: 'o-1',
    title: 'Dip well reading — plot 14',
    kind: 'water-table',
    value: 82,
    unit: 'cm',
    observedAt: daysAgo(191, 9),
    placeId: 'pl-wb14',
    method: 'Dip meter from top of casing, three readings averaged.',
    observerId: 'p-idris',
    notes: 'Ground still cold; no flow in the swale.',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-2',
    title: 'Dip well reading — plot 14',
    kind: 'water-table',
    value: 76,
    unit: 'cm',
    observedAt: daysAgo(163, 9),
    placeId: 'pl-wb14',
    method: 'Dip meter from top of casing, three readings averaged.',
    observerId: 'p-idris',
    notes: 'Swale held water for nine days after the storms.',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-3',
    title: 'Dip well reading — plot 14',
    kind: 'water-table',
    value: 64,
    unit: 'cm',
    observedAt: daysAgo(128, 9),
    placeId: 'pl-wb14',
    method: 'Dip meter from top of casing, three readings averaged.',
    observerId: 'p-idris',
    notes: 'First proper dry spell.',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-4',
    title: 'Dip well reading — plot 14',
    kind: 'water-table',
    value: 58,
    unit: 'cm',
    observedAt: daysAgo(93, 9),
    placeId: 'pl-wb14',
    method: 'Dip meter from top of casing, three readings averaged.',
    observerId: 'p-idris',
    notes: 'Driest reading so far. Plot 12 remains dry.',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-5',
    title: 'Dip well reading — plot 14',
    kind: 'water-table',
    value: 61,
    unit: 'cm',
    observedAt: daysAgo(65, 9),
    placeId: 'pl-wb14',
    method: 'Dip meter from top of casing, three readings averaged.',
    observerId: 'p-mara',
    notes: 'Slight recovery after two weeks of rain.',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-6',
    title: 'Surface soil moisture — plot 14',
    kind: 'soil-moisture',
    value: 34,
    unit: '%',
    observedAt: daysAgo(191, 10),
    placeId: 'pl-wb14',
    method: 'Handheld probe, five points across the bed.',
    observerId: 'p-mara',
    notes: '',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-7',
    title: 'Surface soil moisture — plot 14',
    kind: 'soil-moisture',
    value: 21,
    unit: '%',
    observedAt: daysAgo(93, 10),
    placeId: 'pl-wb14',
    method: 'Handheld probe, five points across the bed.',
    observerId: 'p-mara',
    notes: 'Hard to push the probe in; crust forming.',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
  {
    id: 'o-8',
    title: 'Invertebrate groups — village pond',
    kind: 'biodiversity-count',
    value: 23,
    unit: 'taxa',
    observedAt: daysAgo(72, 10),
    placeId: 'pl-pond',
    method: 'Three one-minute net sweeps from the north bank.',
    observerId: 'p-sam',
    notes: 'Includes two dragonfly nymphs and a leech. Photographs in the circle folder.',
    scope: 'community',
    communityId: 'c-hollowcombe',
    projectId: 'pr-pond',
    isSample: true,
  },
  {
    id: 'o-9',
    title: 'Pond water temperature',
    kind: 'temperature',
    value: 14.2,
    unit: '°C',
    observedAt: daysAgo(72, 10),
    placeId: 'pl-pond',
    method: 'Digital thermometer, 10 cm below surface, north bank.',
    observerId: 'p-sam',
    notes: 'Overcast, light breeze.',
    scope: 'community',
    communityId: 'c-hollowcombe',
    projectId: 'pr-pond',
    isSample: true,
  },
  {
    id: 'o-10',
    title: 'Orchard air temperature',
    kind: 'temperature',
    value: 17.8,
    unit: '°C',
    observedAt: daysAgo(30, 14),
    placeId: 'pl-orchard',
    method: 'Shaded thermometer at 1.5 m, read after five minutes.',
    observerId: 'p-june',
    notes: 'Useful for the pruning workshop planning.',
    scope: 'public',
    isSample: true,
  },
  {
    id: 'o-11',
    title: 'Creek stage at lower bend',
    kind: 'water-table',
    value: 45,
    unit: 'cm',
    observedAt: daysAgo(19, 8),
    placeId: 'pl-bramble-bend',
    method: 'Staff gauge bolted to the bridge footing.',
    observerId: 'p-ilse',
    notes: 'Falling after the high water event. Erosion pins 2 and 3 undercut.',
    scope: 'community',
    communityId: 'c-bramble',
    projectId: 'pr-bank',
    isSample: true,
  },
  {
    id: 'o-12',
    title: 'Orchid count — sensitive bank',
    kind: 'biodiversity-count',
    value: 14,
    unit: 'flowering spikes',
    observedAt: daysAgo(120, 8),
    placeId: 'pl-orchid-bank',
    method: 'Count from the far side of the bank, no entry.',
    observerId: 'p-ilse',
    notes: 'Precise location withheld; the landowner asked us to keep this quiet.',
    scope: 'private',
    communityId: 'c-bramble',
    isSample: true,
  },
  {
    id: 'o-13',
    title: 'Rainfall since last reading — plot 14',
    kind: 'rainfall',
    value: 38,
    unit: 'mm',
    observedAt: daysAgo(65, 9),
    placeId: 'pl-wb14',
    method: 'Tipping-bucket gauge, reset at each visit.',
    observerId: 'p-mara',
    notes: '',
    scope: 'community',
    communityId: 'c-willowbank',
    projectId: 'pr-retention',
    isSample: true,
  },
];

const consentLog: ConsentEvent[] = [
  {
    id: 'ce-1',
    at: daysAgo(210, 9),
    kind: 'invitation-sent',
    actorId: 'p-mara',
    detail: 'Bilateral invitation sent to Idris Vale.',
    relationshipId: 'rel-mara-idris',
    subjectIds: ['p-idris'],
  },
  {
    id: 'ce-2',
    at: daysAgo(209, 18),
    kind: 'invitation-accepted',
    actorId: 'p-idris',
    detail: 'Bilateral relationship activated with Mara Ellery.',
    relationshipId: 'rel-mara-idris',
    subjectIds: ['p-mara'],
  },
  {
    id: 'ce-3',
    at: daysAgo(149, 8),
    kind: 'invitation-accepted',
    actorId: 'p-mara',
    detail: 'Bilateral relationship activated with Nia Okonkwo.',
    relationshipId: 'rel-mara-nia',
    subjectIds: ['p-nia'],
  },
  {
    id: 'ce-4',
    at: daysAgo(82, 20),
    kind: 'invitation-declined',
    actorId: 'p-owen',
    detail: 'Bilateral invitation declined. No access granted.',
    relationshipId: 'rel-mara-owen',
    subjectIds: ['p-mara'],
  },
  {
    id: 'ce-5',
    at: daysAgo(30, 13),
    kind: 'relationship-revoked',
    actorId: 'p-ilse',
    detail: 'Bilateral relationship revoked by Ilse Brandt. Future access blocked.',
    relationshipId: 'rel-ilse-mara',
    subjectIds: ['p-mara'],
  },
  {
    id: 'ce-6',
    at: daysAgo(39, 11),
    kind: 'group-declined',
    actorId: 'p-ilse',
    detail:
      'Declined the Bramble Creek field data pool agreement. Agreement inactive; no group access granted.',
    agreementId: 'ga-bramble',
    communityId: 'c-bramble',
  },
  {
    id: 'ce-7',
    at: daysAgo(41, 9),
    kind: 'group-accepted',
    actorId: 'p-mara',
    detail: 'Accepted the proposed Bramble Creek field data pool agreement (pending one other response).',
    agreementId: 'ga-bramble',
    communityId: 'c-bramble',
  },
  {
    id: 'ce-8',
    at: daysAgo(14, 10),
    kind: 'agreement-accepted',
    actorId: 'p-mara',
    detail: 'Willowbank accepted the inter-community tool library agreement.',
    agreementId: 'ia-tool-library',
    communityId: 'c-willowbank',
  },
];

export function createSampleData(): NodeData {
  // Deep clone so callers can never mutate the seed fixture, and every reset
  // starts from a genuinely pristine demonstration scenario.
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    node: {
      id: 'node-willowbank-demo',
      name: 'Willowbank node · Mara’s laptop',
      createdAt: daysAgo(420),
      softwareVersion: '0.1.0',
      prototype: true,
    },
    people,
    communities,
    relationships,
    groupAgreements,
    interCommunityAgreements,
    knowledge,
    observations,
    places,
    projects,
    gatherings,
    consentLog,
  });
}

export function createDefaultSettings(): NodeSettings {
  return {
    theme: 'web',
    actorId: 'p-mara',
    ai: {
      enabled: false,
      provider: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      model: 'llama3.2:3b',
      timeoutMs: 15000,
    },
    showSampleBanner: true,
  };
}

export function createNewNode(name = 'A new Understory node'): NodeData {
  const now = isoNow();
  return {
    schemaVersion: SCHEMA_VERSION,
    node: {
      id: `node-${Math.random().toString(36).slice(2, 10)}`,
      name,
      createdAt: now,
      softwareVersion: '0.1.0',
      prototype: true,
    },
    people: [
      {
        id: 'p-you',
        name: 'You',
        handle: '@you',
        nodeLabel: 'local-node',
        locality: '',
        bio: 'Local node owner. Edit this identity in Node settings.',
        skills: [],
        keyFingerprint: 'SIMULATED · no cryptography',
        joinedAt: now,
        directoryOptIn: false,
      },
    ],
    communities: [],
    relationships: [],
    groupAgreements: [],
    interCommunityAgreements: [],
    knowledge: [],
    observations: [],
    places: [],
    projects: [],
    gatherings: [],
    consentLog: [],
  };
}
